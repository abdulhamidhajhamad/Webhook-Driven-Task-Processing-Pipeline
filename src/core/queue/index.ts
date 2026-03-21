import amqp, { ChannelModel, ConfirmChannel } from 'amqplib';
import { config } from '../config';

const EXCHANGE_NAME = 'webhook.events';
const QUEUE_NAME = 'webhook.jobs';
const DEAD_LETTER_EXCHANGE = 'webhook.dead';
const DEAD_LETTER_QUEUE = 'webhook.dead.jobs';
const MAX_RECONNECT_DELAY = 30000;

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