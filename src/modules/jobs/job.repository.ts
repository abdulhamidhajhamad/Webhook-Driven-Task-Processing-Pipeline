import { db } from '../../core/db';
import { Pool, PoolClient } from 'pg';
import { toCamelCase, toCamelCaseArray } from '../../core/utils/db-helpers';
import { Job, JobStatus } from '../../core/types';

type QueryClient = Pool | PoolClient;

export interface CreateJobDto {
  pipelineId: string;
  payload: Record<string, unknown>;
  externalDeliveryId?: string;
}

export interface CreateJobResult {
  job: Job;
  isDuplicate: boolean;
}

export const jobRepository = {
  async create(data: CreateJobDto, client: QueryClient): Promise<CreateJobResult> {
    if (data.externalDeliveryId) {
      const existing = await client.query(
        `SELECT * FROM jobs WHERE external_delivery_id = $1`,
        [data.externalDeliveryId]
      );

      if (existing.rows[0]) {
        return {
          job: toCamelCase<Job>(existing.rows[0]),
          isDuplicate: true,
        };
      }
    }

    const result = await client.query(
      `INSERT INTO jobs (pipeline_id, payload, external_delivery_id)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [data.pipelineId, data.payload, data.externalDeliveryId ?? null]
    );

    return {
      job: toCamelCase<Job>(result.rows[0]),
      isDuplicate: false,
    };
  },

  async findById(id: string): Promise<Job | null> {
    const result = await db.query(
      `SELECT * FROM jobs WHERE id = $1`,
      [id]
    );
    if (!result.rows[0]) return null;
    return toCamelCase<Job>(result.rows[0]);
  },

  async findAll(filters: { pipelineId?: string; status?: JobStatus } = {}): Promise<Job[]> {
    let query = `SELECT * FROM jobs WHERE 1=1`;
    const params: unknown[] = [];

    if (filters.pipelineId) {
      params.push(filters.pipelineId);
      query += ` AND pipeline_id = $${params.length}`;
    }

    if (filters.status) {
      params.push(filters.status);
      query += ` AND status = $${params.length}`;
    }

    query += ` ORDER BY created_at DESC LIMIT 50`;

    const result = await db.query(query, params);
    return toCamelCaseArray<Job>(result.rows);
  },

  async getNextPending(): Promise<Job | null> {
    const result = await db.query(
      `UPDATE jobs
       SET status = 'processing', attempts = attempts + 1
       WHERE id = (
         SELECT id FROM jobs
         WHERE status = 'pending'
         ORDER BY created_at ASC
         FOR UPDATE SKIP LOCKED
         LIMIT 1
       )
       RETURNING *`
    );
    if (!result.rows[0]) return null;
    return toCamelCase<Job>(result.rows[0]);
  },

  async markCompleted(
    id: string,
    result: Record<string, unknown>,
    actionsLog: unknown[]
  ): Promise<void> {
    await db.query(
      `UPDATE jobs
       SET status       = 'completed',
           result       = $1,
           actions_log  = $2,
           processed_at = NOW()
       WHERE id = $3`,
      [result, JSON.stringify(actionsLog), id]
    );
  },

  async markFailed(
    id: string,
    error: string,
    errorDetail: Record<string, unknown>,
    failedAtAction: number,
    actionsLog: unknown[]
  ): Promise<void> {
    await db.query(
      `UPDATE jobs
       SET status           = 'failed',
           error            = $1,
           error_detail     = $2,
           failed_at_action = $3,
           actions_log      = $4,
           processed_at     = NOW()
       WHERE id = $5`,
      [error, JSON.stringify(errorDetail), failedAtAction, JSON.stringify(actionsLog), id]
    );
  },
};