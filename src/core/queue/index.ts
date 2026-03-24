import amqp, { ChannelModel, ConfirmChannel } from 'amqplib';
import { config } from '../config';

const EXCHANGE_NAME = 'webhook.events';
const QUEUE_NAME = 'webhook.jobs';
const DEAD_LETTER_EXCHANGE = 'webhook.dead';
const DEAD_LETTER_QUEUE = 'webhook.dead.jobs';

const RETRY_EXCHANGE = 'webhook.retry';
const RETRY_QUEUE = 'webhook.retry.jobs';
const DELAY_EXCHANGE = 'webhook.delay';

const MAX_RECONNECT_DELAY = 30000;

export interface RetryPayload {
  jobId: string;
  subscriber: { id: string; url: string };
  payload: Record<string, unknown>;
  attempt: number;
}

class RabbitMQClient {
  private static instance: RabbitMQClient;
  private connection: ChannelModel | null = null;
  private channel: ConfirmChannel | null = null;
  private reconnectAttempts = 0;
  private isConnecting = false;

  private constructor() {}

  static getInstance(): RabbitMQClient {
    if (!RabbitMQClient.instance) {
      RabbitMQClient.instance = new RabbitMQClient();
    }
    return RabbitMQClient.instance;
  }

  async connect(): Promise<void> {
    if (this.isConnecting) return;
    this.isConnecting = true;

    try {
      this.connection = await amqp.connect(config.rabbitmqUrl);
      this.channel = await this.connection.createConfirmChannel();

      await this.setup();

      this.reconnectAttempts = 0;
      this.isConnecting = false;

      this.connection.on('close', async () => {
        console.log('RabbitMQ connection closed, reconnecting...');
        this.channel = null;
        this.connection = null;
        await this.reconnect();
      });

      this.connection.on('error', async (error) => {
        console.error('RabbitMQ connection error:', error);
        this.channel = null;
        this.connection = null;
        await this.reconnect();
      });

      console.log('RabbitMQ connected');
    } catch (error) {
      this.isConnecting = false;
      console.error('RabbitMQ connection failed:', error);
      await this.reconnect();
    }
  }

  private async setup(): Promise<void> {
    if (!this.channel) return;

    await this.channel.assertExchange(DEAD_LETTER_EXCHANGE, 'direct', {
      durable: true,
    });

    await this.channel.assertQueue(DEAD_LETTER_QUEUE, {
      durable: true,
    });

    await this.channel.bindQueue(
      DEAD_LETTER_QUEUE,
      DEAD_LETTER_EXCHANGE,
      'dead'
    );

    await this.channel.assertExchange(EXCHANGE_NAME, 'direct', {
      durable: true,
    });

    await this.channel.assertQueue(QUEUE_NAME, {
      durable: true,
      arguments: {
        'x-dead-letter-exchange': DEAD_LETTER_EXCHANGE,
        'x-dead-letter-routing-key': 'dead',
        'x-message-ttl': 86400000,
      },
    });

    await this.channel.bindQueue(QUEUE_NAME, EXCHANGE_NAME, 'job');

    await this.channel.assertExchange(DELAY_EXCHANGE, 'topic', {
      durable: true,
    });
    await this.channel.assertExchange(RETRY_EXCHANGE, 'direct', {
      durable: true,
    });
    await this.channel.assertQueue(RETRY_QUEUE, {
      durable: true,
    });
    await this.channel.bindQueue(RETRY_QUEUE, RETRY_EXCHANGE, 'retry');
  }

  private async reconnect(): Promise<void> {
    if (this.isConnecting) return;

    const delay = Math.min(
      1000 * Math.pow(2, this.reconnectAttempts),
      MAX_RECONNECT_DELAY
    );

    this.reconnectAttempts++;

    console.log(
      `Reconnect attempt ${this.reconnectAttempts}, waiting ${delay}ms...`
    );

    await new Promise((resolve) => setTimeout(resolve, delay));
    await this.connect();
  }

  async publish(jobId: string): Promise<void> {
    if (!this.channel || !this.connection) {
      throw new Error('Queue Service Unavailable');
    }

    const message = JSON.stringify({ jobId });

    return new Promise<void>((resolve, reject) => {
      this.channel!.publish(
        EXCHANGE_NAME,
        'job',
        Buffer.from(message),
        { persistent: true, messageId: jobId },
        (error) => {
          if (error) {
            reject(new Error(`Message publish failed: ${error.message}`));
          } else {
            resolve();
          }
        }
      );
    });
  }

  async consume(handler: (jobId: string) => Promise<void>): Promise<void> {
    if (!this.channel) {
      throw new Error('Queue Service Unavailable');
    }

    await this.channel.prefetch(1);

    await this.channel.consume(QUEUE_NAME, async (msg) => {
      if (!msg) return;

      try {
        const { jobId } = JSON.parse(msg.content.toString());
        await handler(jobId);
        this.channel!.ack(msg);
      } catch (error) {
        console.error('Job processing failed, sending to DLX:', error);
        this.channel!.nack(msg, false, false);
      }
    });
  }

  async publishRetry(delayMs: number, payload: RetryPayload): Promise<void> {
    const delayQueue = `webhook.delay.${delayMs}`;
    
    await this.channel!.assertQueue(delayQueue, {
      durable: true,
      arguments: {
        'x-dead-letter-exchange': RETRY_EXCHANGE,
        'x-dead-letter-routing-key': 'retry',
        'x-message-ttl': delayMs,
        'x-expires': delayMs * 2 + 60000,
      },
    });

    await this.channel!.bindQueue(delayQueue, DELAY_EXCHANGE, `delay.${delayMs}`);

    const message = JSON.stringify(payload);

    return new Promise<void>((resolve, reject) => {
      this.channel!.publish(
        DELAY_EXCHANGE,
        `delay.${delayMs}`,
        Buffer.from(message),
        { persistent: true, messageId: `${payload.jobId}-${payload.attempt}` },
        (error) => {
          if (error) {
            reject(new Error(`Retry publish failed: ${error.message}`));
          } else {
            resolve();
          }
        }
      );
    });
  }

  async consumeRetry(handler: (payload: RetryPayload) => Promise<void>): Promise<void> {
    if (!this.channel) {
      throw new Error('Queue Service Unavailable');
    }

    await this.channel.prefetch(1);

    await this.channel.consume(RETRY_QUEUE, async (msg) => {
      if (!msg) return;

      try {
        const payload: RetryPayload = JSON.parse(msg.content.toString());
        await handler(payload);
        this.channel!.ack(msg);
      } catch (error) {
        console.error('Retry processing failed:', error);
        this.channel!.nack(msg, false, false);
      }
    });
  }

  getChannel(): ConfirmChannel | null {
    return this.channel;
  }
  async close(): Promise<void> {
  try {
    if (this.channel) await this.channel.close();
    if (this.connection) await this.connection.close();
    console.log('RabbitMQ connection closed gracefully');
  } catch (error) {
    console.error('Error during RabbitMQ shutdown:', error);
  }
}
}

export const rabbitMQ = RabbitMQClient.getInstance();