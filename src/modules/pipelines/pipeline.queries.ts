export const PIPELINE_FIELDS = `
  id, 
  name, 
  source_token, 
  secret, 
  is_active, 
  is_deleted, 
  deleted_at, 
  created_at, 
  updated_at
`;

export const ACTION_FIELDS = `
  id, 
  pipeline_id, 
  action_type, 
  action_config, 
  order_index, 
  created_at
`;

export const SUBSCRIBER_FIELDS = `
  id, 
  pipeline_id, 
  url, 
  created_at
`;