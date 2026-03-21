import { db } from '../../core/db';
import { toCamelCase, toCamelCaseArray } from '../../core/utils/db-helpers';
import { DeliveryAttempt } from '../../core/types';

export const deliveryRepository = {
  async create(data: {
    jobId: string;
    subscriberId: string;
    status: string;
    responseStatus?: number;
    error?: string;
    attemptNumber: number;
    nextRetryAt?: Date;
  }): Promise<DeliveryAttempt> {
    const result = await db.query(
      `INSERT INTO delivery_attempts
         (job_id, subscriber_id, status, response_status, error, attempt_number, next_retry_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        data.jobId,
        data.subscriberId,
        data.status,
        data.responseStatus ?? null,
        data.error ?? null,
        data.attemptNumber,
        data.nextRetryAt ?? null,
      ]
    );
    return toCamelCase<DeliveryAttempt>(result.rows[0]);
  },

  async findByJobId(jobId: string): Promise<DeliveryAttempt[]> {
    const result = await db.query(
      `SELECT * FROM delivery_attempts
       WHERE job_id = $1
       ORDER BY attempted_at ASC`,
      [jobId]
    );
    return toCamelCaseArray<DeliveryAttempt>(result.rows);
  },

  async countAttempts(jobId: string, subscriberId: string): Promise<number> {
    const result = await db.query(
      `SELECT COUNT(*) FROM delivery_attempts
       WHERE job_id = $1 AND subscriber_id = $2`,
      [jobId, subscriberId]
    );
    return parseInt(result.rows[0].count);
  },

  async getDueRetries(limit = 50): Promise<Array<{ attempt: DeliveryAttempt, payload: Record<string, unknown>, url: string }>> {
    const query = `
      WITH locked_attempts AS (
        SELECT id FROM delivery_attempts
        WHERE status = 'failed'
          AND next_retry_at IS NOT NULL
          AND next_retry_at <= NOW()
        FOR UPDATE SKIP LOCKED
        LIMIT $1
      ),
      updated_attempts AS (
        UPDATE delivery_attempts da
        SET next_retry_at = NULL
        FROM locked_attempts la
        WHERE da.id = la.id
        RETURNING da.*
      )
      SELECT ua.*, j.payload as job_payload, s.url as subscriber_url
      FROM updated_attempts ua
      JOIN jobs j ON ua.job_id = j.id
      JOIN subscribers s ON ua.subscriber_id = s.id;
    `;
    const result = await db.query(query, [limit]);
    
    return result.rows.map(row => ({
      attempt: toCamelCase<DeliveryAttempt>({
        id: row.id,
        job_id: row.job_id,
        subscriber_id: row.subscriber_id,
        status: row.status,
        response_status: row.response_status,
        error: row.error,
        attempt_number: row.attempt_number,
        attempted_at: row.attempted_at,
        next_retry_at: row.next_retry_at
      }),
      payload: row.job_payload,
      url: row.subscriber_url
    }));
  }
};