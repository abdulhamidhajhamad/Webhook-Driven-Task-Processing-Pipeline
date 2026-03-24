import { vi } from 'vitest';

// This runs before all tests
export const mockAmqpChannel = {
  assertExchange: vi.fn().mockResolvedValue({}),
  assertQueue: vi.fn().mockResolvedValue({ queue: 'test_queue' }),
  bindQueue: vi.fn().mockResolvedValue({}),
  publish: vi.fn().mockImplementation((ex, rk, buf, opts, cb) => cb(null)),
  consume: vi.fn().mockResolvedValue({ consumerTag: 'test_tag' }),
  prefetch: vi.fn().mockResolvedValue({}),
  ack: vi.fn(),
  nack: vi.fn(),
  close: vi.fn().mockResolvedValue({}),
};

export const mockAmqpConnection = {
  createConfirmChannel: vi.fn().mockResolvedValue(mockAmqpChannel),
  on: vi.fn(),
  close: vi.fn().mockResolvedValue({}),
};

vi.mock('amqplib', () => ({
  default: {
    connect: vi.fn().mockResolvedValue(mockAmqpConnection),
  },
  connect: vi.fn().mockResolvedValue(mockAmqpConnection)
}));

// Also mock postgres if necessary so it doesn't crash on import
vi.mock('pg', () => {
    const mPool = {
        connect: vi.fn(),
        query: vi.fn(),
        end: vi.fn(),
        on: vi.fn(),
    };
    return { Pool: vi.fn(() => mPool) };
});
