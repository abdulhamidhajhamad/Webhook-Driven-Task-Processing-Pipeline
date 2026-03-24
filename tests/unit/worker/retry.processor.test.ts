import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest';
import { deliverWithRetry, RETRY_DELAYS } from '../../../src/worker/processors/retry.processor';
import { deliveryRepository } from '../../../src/modules/delivery/delivery.repository';
import { rabbitMQ } from '../../../src/core/queue';
import dns from 'dns/promises';

// Mock dependencies
vi.mock('../../../src/modules/delivery/delivery.repository', () => ({
  deliveryRepository: {
    create: vi.fn(),
  },
}));

vi.mock('../../../src/core/queue', () => ({
  rabbitMQ: {
    publishRetry: vi.fn(),
  },
}));

vi.mock('dns/promises', () => ({
  default: {
    lookup: vi.fn(),
  },
}));

const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('Retry Processor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const baseSubscriber = { id: 'sub-1', url: 'https://example.com/webhook' };
  const basePayload = { test: true };

  it('should block SSRF attempts (e.g., localhost)', async () => {
    const maliciousSubscriber = { id: 'sub-2', url: 'http://localhost:8080/foo' };
    
    await deliverWithRetry('job-1', maliciousSubscriber, basePayload, 0);

   
    expect(deliveryRepository.create).toHaveBeenCalledWith({
      jobId: 'job-1',
      subscriberId: maliciousSubscriber.id,
      status: 'failed',
      responseStatus: undefined,
      error: 'Delivery failed',
      attemptNumber: 1, 
    });

   
    expect(rabbitMQ.publishRetry).toHaveBeenCalledWith(RETRY_DELAYS[1], {
      jobId: 'job-1',
      subscriber: maliciousSubscriber,
      payload: basePayload,
      attempt: 1,
    });
    
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('should deliver successfully when url is safe and fetch succeeds', async () => {
    // Mock DNS to return safe IP
    (dns.lookup as Mock).mockResolvedValueOnce({ address: '8.8.8.8' });
    mockFetch.mockResolvedValueOnce({ ok: true, status: 200 });

    await deliverWithRetry('job-1', baseSubscriber, basePayload, 0);

    expect(dns.lookup).toHaveBeenCalled();
    expect(mockFetch).toHaveBeenCalledWith(baseSubscriber.url, expect.objectContaining({
      method: 'POST',
      body: JSON.stringify(basePayload),
    }));

    expect(deliveryRepository.create).toHaveBeenCalledWith({
      jobId: 'job-1',
      subscriberId: baseSubscriber.id,
      status: 'success',
      responseStatus: 200,
      attemptNumber: 1,
    });

    // Since it succeeded, there shouldn't be a retry scheduled
    expect(rabbitMQ.publishRetry).not.toHaveBeenCalled();
  });

  it('should schedule retry up to the maximum retry attempts', async () => {
    (dns.lookup as Mock).mockResolvedValue({ address: '8.8.8.8' });
    mockFetch.mockResolvedValue({ ok: false, status: 500 }); // simulate server failure (500)

    // Run the final retry attempt (index 4 in RETRY_DELAYS)
    await deliverWithRetry('job-2', baseSubscriber, basePayload, 4);

    expect(deliveryRepository.create).toHaveBeenCalledWith(expect.objectContaining({
      status: 'failed',
      attemptNumber: 5, // attempt 4 + 1
    }));

    // Next retry should NOT be scheduled because we've exhausted RETRY_DELAYS
    expect(rabbitMQ.publishRetry).not.toHaveBeenCalled();
  });

  it('should schedule the next retry step correctly on failure', async () => {
    (dns.lookup as Mock).mockResolvedValue({ address: '8.8.8.8' });
    mockFetch.mockRejectedValueOnce(new Error('Network disconnected'));

    await deliverWithRetry('job-3', baseSubscriber, basePayload, 1);

    expect(deliveryRepository.create).toHaveBeenCalledWith(expect.objectContaining({
        status: 'failed',
        attemptNumber: 2,
    }));

    // Next delay for attempt 1 -> index 2 in RETRY_DELAYS = 300_000
    expect(rabbitMQ.publishRetry).toHaveBeenCalledWith(RETRY_DELAYS[2], {
        jobId: 'job-3',
        subscriber: baseSubscriber,
        payload: basePayload,
        attempt: 2,
    });
  });
});