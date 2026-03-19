export interface Pipeline {
  id: string;
  name: string;
  source_token: string;
  secret: string | null;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface PipelineAction {
  id: string;
  pipeline_id: string;
  action_type: ActionType;
  action_config: Record<string, unknown>;
  order_index: number;
  created_at: Date;
}

export interface Subscriber {
  id: string;
  pipeline_id: string;
  url: string;
  created_at: Date;
}

export interface Job {
  id: string;
  pipeline_id: string;
  status: JobStatus;
  payload: Record<string, unknown>;
  result: Record<string, unknown> | null;
  error: string | null;
  error_detail: Record<string, unknown> | null;
  failed_at_action: number | null;
  actions_log: ActionLog[];
  attempts: number;
  created_at: Date;
  processed_at: Date | null;
}

export interface DeliveryAttempt {
  id: string;
  job_id: string;
  subscriber_id: string;
  status: DeliveryStatus;
  response_status: number | null;
  error: string | null;
  attempt_number: number;
  attempted_at: Date;
  next_retry_at: Date | null;
}

export interface ActionLog {
  order_index: number;
  action_type: ActionType;
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
  action_type: ActionType;
  action_config: Record<string, unknown>;
  order_index: number;
}

export interface PipelineWithDetails extends Pipeline {
  actions: PipelineAction[];
  subscribers: Subscriber[];
}