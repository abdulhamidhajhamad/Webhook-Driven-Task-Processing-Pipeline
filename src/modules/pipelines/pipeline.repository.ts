import { db } from '../../core/db';
import { Pool, PoolClient } from 'pg';
import { toCamelCase, toCamelCaseArray } from '../../core/utils/db-helpers';
import {
  Pipeline,
  PipelineAction,
  Subscriber,
  PipelineWithDetails,
  CreatePipelineDto,
} from '../../core/types';

type QueryClient = Pool | PoolClient;

export const pipelineRepository = {
  async create(data: CreatePipelineDto, client: QueryClient): Promise<Pipeline> {
    const result = await client.query(
      `INSERT INTO pipelines (name, secret)
       VALUES ($1, $2)
       RETURNING *`,
      [data.name, data.secret ?? null]
    );
    return toCamelCase<Pipeline>(result.rows[0]);
  },

  async addAction(
    pipelineId: string,
    action: { actionType: string; actionConfig: Record<string, unknown>; orderIndex: number },
    client: QueryClient
  ): Promise<PipelineAction> {
    const result = await client.query(
      `INSERT INTO pipeline_actions (pipeline_id, action_type, action_config, order_index)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [pipelineId, action.actionType, action.actionConfig, action.orderIndex]
    );
    return toCamelCase<PipelineAction>(result.rows[0]);
  },

  async addSubscriber(
    pipelineId: string,
    url: string,
    client: QueryClient
  ): Promise<Subscriber> {
    const result = await client.query(
      `INSERT INTO subscribers (pipeline_id, url)
       VALUES ($1, $2)
       RETURNING *`,
      [pipelineId, url]
    );
    return toCamelCase<Subscriber>(result.rows[0]);
  },

  async findById(id: string): Promise<Pipeline | null> {
    const result = await db.query(
      `SELECT * FROM pipelines
       WHERE id = $1
         AND is_deleted = false`,
      [id]
    );
    if (!result.rows[0]) return null;
    return toCamelCase<Pipeline>(result.rows[0]);
  },

  async findByToken(token: string): Promise<Pipeline | null> {
    const result = await db.query(
      `SELECT * FROM pipelines
       WHERE source_token = $1
         AND is_active = true
         AND is_deleted = false`,
      [token]
    );
    if (!result.rows[0]) return null;
    return toCamelCase<Pipeline>(result.rows[0]);
  },

  async findAll(): Promise<Pipeline[]> {
    const result = await db.query(
      `SELECT * FROM pipelines
       WHERE is_deleted = false
       ORDER BY created_at DESC`
    );
    return toCamelCaseArray<Pipeline>(result.rows);
  },

  async findActions(pipelineId: string): Promise<PipelineAction[]> {
    const result = await db.query(
      `SELECT * FROM pipeline_actions
       WHERE pipeline_id = $1
       ORDER BY order_index ASC`,
      [pipelineId]
    );
    return toCamelCaseArray<PipelineAction>(result.rows);
  },

  async findSubscribers(pipelineId: string): Promise<Subscriber[]> {
    const result = await db.query(
      `SELECT * FROM subscribers
       WHERE pipeline_id = $1`,
      [pipelineId]
    );
    return toCamelCaseArray<Subscriber>(result.rows);
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
    data: Partial<Pick<Pipeline, 'name' | 'secret' | 'isActive'>>,
    client: QueryClient
  ): Promise<Pipeline | null> {
    const result = await client.query(
      `UPDATE pipelines
       SET name       = COALESCE($1, name),
           secret     = COALESCE($2, secret),
           is_active  = COALESCE($3, is_active),
           updated_at = NOW()
       WHERE id = $4
         AND is_deleted = false
       RETURNING *`,
      [data.name ?? null, data.secret ?? null, data.isActive ?? null, id]
    );
    if (!result.rows[0]) return null;
    return toCamelCase<Pipeline>(result.rows[0]);
  },

  async delete(id: string, client: QueryClient): Promise<void> {
    await client.query(
      `UPDATE pipelines
       SET is_deleted = true,
           deleted_at = NOW(),
           updated_at = NOW()
       WHERE id = $1
         AND is_deleted = false`,
      [id]
    );
  },
};