import amqp, { ChannelModel, Channel } from 'amqplib';
import { config } from '../config';

const EXCHANGE_NAME = 'webhook.events';
const QUEUE_NAME = 'webhook.jobs';
const DEAD_LETTER_EXCHANGE = 'webhook.dead';
const DEAD_LETTER_QUEUE = 'webhook.dead.jobs';

class RabbitMQClient {
  private static instance: RabbitMQClient;
  private connection: ChannelModel | null = null;
  private channel: Channel | null = null;

  private constructor() {}

  static getInstance(): RabbitMQClient {
    if (!RabbitMQClient.instance) {
      RabbitMQClient.instance = new RabbitMQClient();
    }
    return RabbitMQClient.instance;
  }

  async connect(): Promise<void> {
    try {
      this.connection = await amqp.connect(config.rabbitmqUrl);
      this.channel = await this.connection.createChannel();

      await this.setup();

      this.connection.on('close', async () => {
        console.log('RabbitMQ connection closed, reconnecting...');
        await this.reconnect();
      });

      this.connection.on('error', async (error) => {
        console.error('RabbitMQ connection error:', error);
        await this.reconnect();
      });

      console.log('RabbitMQ connected');
    } catch (error) {
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
    this.connection = null;
    this.channel = null;

    await new Promise((resolve) => setTimeout(resolve, 5000));

    console.log('Attempting to reconnect to RabbitMQ...');
    await this.connect();
  }

  async publish(jobId: string): Promise<void> {
    if (!this.channel) {
      throw new Error('RabbitMQ channel not available');
    }

    const message = JSON.stringify({ jobId });

    this.channel.publish(
      EXCHANGE_NAME,
      'job',
      Buffer.from(message),
      {
        persistent: true,
        messageId: jobId,
      }
    );
  }

  async consume(handler: (jobId: string) => Promise<void>): Promise<void> {
    if (!this.channel) {
      throw new Error('RabbitMQ channel not available');
    }

    await this.channel.prefetch(1);

    await this.channel.consume(QUEUE_NAME, async (msg) => {
      if (!msg) return;

      try {
        const { jobId } = JSON.parse(msg.content.toString());
        await handler(jobId);
        this.channel!.ack(msg);
      } catch (error) {
        console.error('Job processing failed:', error);
        this.channel!.nack(msg, false, false);
      }
    });
  }

  getChannel(): Channel | null {
    return this.channel;
  }
}

export const rabbitMQ = RabbitMQClient.getInstance();