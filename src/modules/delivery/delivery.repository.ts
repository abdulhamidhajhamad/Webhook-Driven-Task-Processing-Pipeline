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
  }
};
