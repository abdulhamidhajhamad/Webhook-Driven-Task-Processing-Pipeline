import { db } from '../../core/db';
import { Pool, PoolClient } from 'pg';
import {
  Pipeline,
  PipelineAction,
  Subscriber,
  PipelineWithDetails,
  CreatePipelineDto,
} from '../../core/types';

type QueryClient = Pool | PoolClient;

export const pipelineRepository = {
  async create(data: CreatePipelineDto, client: QueryClient = db): Promise<Pipeline> {
    const result = await client.query<Pipeline>(
      `INSERT INTO pipelines (name, secret)
       VALUES ($1, $2)
       RETURNING *`,
      [data.name, data.secret ?? null]
    );
    return result.rows[0];
  },

  async addAction(
    pipelineId: string,
    action: { action_type: string; action_config: Record<string, unknown>; order_index: number },
    client: QueryClient = db
  ): Promise<PipelineAction> {
    const result = await client.query<PipelineAction>(
      `INSERT INTO pipeline_actions (pipeline_id, action_type, action_config, order_index)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [pipelineId, action.action_type, action.action_config, action.order_index]
    );
    return result.rows[0];
  },

  async addSubscriber(
    pipelineId: string,
    url: string,
    client: QueryClient = db
  ): Promise<Subscriber> {
    const result = await client.query<Subscriber>(
      `INSERT INTO subscribers (pipeline_id, url)
       VALUES ($1, $2)
       RETURNING *`,
      [pipelineId, url]
    );
    return result.rows[0];
  },

  async findById(id: string): Promise<Pipeline | null> {
    const result = await db.query<Pipeline>(
      `SELECT * FROM pipelines WHERE id = $1`,
      [id]
    );
    return result.rows[0] ?? null;
  },

  async findByToken(token: string): Promise<Pipeline | null> {
    const result = await db.query<Pipeline>(
      `SELECT * FROM pipelines WHERE source_token = $1 AND is_active = true`,
      [token]
    );
    return result.rows[0] ?? null;
  },

  async findAll(): Promise<Pipeline[]> {
    const result = await db.query<Pipeline>(
      `SELECT * FROM pipelines ORDER BY created_at DESC`
    );
    return result.rows;
  },

  async findActions(pipelineId: string): Promise<PipelineAction[]> {
    const result = await db.query<PipelineAction>(
      `SELECT * FROM pipeline_actions
       WHERE pipeline_id = $1
       ORDER BY order_index ASC`,
      [pipelineId]
    );
    return result.rows;
  },

  async findSubscribers(pipelineId: string): Promise<Subscriber[]> {
    const result = await db.query<Subscriber>(
      `SELECT * FROM subscribers WHERE pipeline_id = $1`,
      [pipelineId]
    );
    return result.rows;
  },

  async findWithDetails(id: string): Promise<PipelineWithDetails | null> {
    const pipeline = await this.findById(id);
    if (!pipeline) return null;

    const [actions, subscribers] = await Promise.all([
      this.findActions(id),
      this.findSubscribers(id),
    ]);

    return { ...pipeline, actions, subscribers };
  },

  async update(
    id: string,
    data: Partial<Pick<Pipeline, 'name' | 'secret' | 'is_active'>>
  ): Promise<Pipeline | null> {
    const result = await db.query<Pipeline>(
      `UPDATE pipelines
       SET name = COALESCE($1, name),
           secret = COALESCE($2, secret),
           is_active = COALESCE($3, is_active),
           updated_at = NOW()
       WHERE id = $4
       RETURNING *`,
      [data.name ?? null, data.secret ?? null, data.is_active ?? null, id]
    );
    return result.rows[0] ?? null;
  },

  async delete(id: string): Promise<void> {
    await db.query(`DELETE FROM pipelines WHERE id = $1`, [id]);
  },
};