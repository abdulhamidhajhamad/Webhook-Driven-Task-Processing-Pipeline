export interface Pipeline {
  id: string;
  name: string;
  sourceToken: string;
  secret: string | null;
  isActive: boolean;
  isDeleted: boolean;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface PipelineAction {
  id: string;
  pipelineId: string;
  actionType: ActionType;
  actionConfig: Record<string, unknown>;
  orderIndex: number;
  createdAt: Date;
}

export interface Subscriber {
  id: string;
  pipelineId: string;
  url: string;
  createdAt: Date;
}

export interface Job {
  id: string;
  pipelineId: string;
  status: JobStatus;
  payload: Record<string, unknown>;
  result: Record<string, unknown> | null;
  error: string | null;
  errorDetail: Record<string, unknown> | null;
  failedAtAction: number | null;
  actionsLog: ActionLog[];
  attempts: number;
  createdAt: Date;
  processedAt: Date | null;
}

export interface DeliveryAttempt {
  id: string;
  jobId: string;
  subscriberId: string;
  status: DeliveryStatus;
  responseStatus: number | null;
  error: string | null;
  attemptNumber: number;
  attemptedAt: Date;
  nextRetryAt: Date | null;
}

export interface ActionLog {
  orderIndex: number;
  actionType: ActionType;
  status: 'completed' | 'failed';
  result?: Record<string, unknown>;
  error?: string;
}

export type ActionType = 'transform' | 'filter' | 'enrich';
export type JobStatus = 'pending' | 'processing' | 'completed' | 'failed';
export type DeliveryStatus = 'success' | 'failed';

export interface CreatePipelineDto {
  name: string;
  actions: CreateActionDto[];
  subscribers: string[];
  secret?: string;
}

export interface CreateActionDto {
  actionType: ActionType;
  actionConfig: Record<string, unknown>;
  orderIndex: number;
}

export interface PipelineWithDetails extends Pipeline {
  actions: PipelineAction[];
  subscribers: Subscriber[];
}