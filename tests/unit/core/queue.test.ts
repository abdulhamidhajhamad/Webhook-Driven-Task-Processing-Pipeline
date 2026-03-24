import { describe, it, expect, beforeEach, vi } from 'vitest';
import amqp from 'amqplib';
import { rabbitMQ } from '../../../src/core/queue';
import { mockAmqpConnection, mockAmqpChannel } from '../../setup';

describe('RabbitMQClient', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should connect and assert exchanges/queues successfully', async () => {
    await rabbitMQ.connect();

    expect(amqp.connect).toHaveBeenCalled();
    expect(mockAmqpConnection.createConfirmChannel).toHaveBeenCalled();
    expect(mockAmqpChannel.assertExchange).toHaveBeenCalledWith('webhook.events', 'direct', { durable: true });
    expect(mockAmqpChannel.assertQueue).toHaveBeenCalledWith('webhook.jobs', expect.any(Object));
  });

  it('should publish a job successfully', async () => {
    mockAmqpChannel.publish.mockImplementationOnce((ex, rk, buf, opts, cb) => {
      if (cb) cb(null);
    });

    await expect(rabbitMQ.publish('test-job-uuid')).resolves.not.toThrow();

    expect(mockAmqpChannel.publish).toHaveBeenCalledWith(
      'webhook.events',
      'job',
      expect.any(Buffer),
      expect.objectContaining({ persistent: true, messageId: 'test-job-uuid' }),
      expect.any(Function)
    );
  });

  it('should handle publish failures from callback', async () => {
      mockAmqpChannel.publish.mockImplementationOnce((ex, rk, buf, opts, cb) => {
        if (cb) cb(new Error('Broker disk full')); 
      });

      await expect(rabbitMQ.publish('test-job-uuid-fail')).rejects.toThrow('Message publish failed: Broker disk full');
  });

  it('should publish a delayed retry job successfully', async () => {
    mockAmqpChannel.publish.mockImplementationOnce((ex, rk, buf, opts, cb) => {
      if (cb) cb(null);
    });

    const payload = {
        jobId: '123',
        subscriber: { id: 's1', url: 'http://foo' },
        payload: { test: '1' },
        attempt: 1
    };

    await expect(rabbitMQ.publishRetry(5000, payload)).resolves.not.toThrow();
    
    expect(mockAmqpChannel.assertQueue).toHaveBeenCalledWith('webhook.delay.5000', expect.any(Object));
    expect(mockAmqpChannel.bindQueue).toHaveBeenCalledWith('webhook.delay.5000', 'webhook.delay', 'delay.5000');
  });
});
