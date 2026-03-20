# Design Decisions

## 1. Multiple Actions per Pipeline
Instead of a single action per pipeline, I created a separate `pipeline_actions` table that allows users to chain multiple actions in a custom order. This makes the system closer to a real Zapier-like experience.

## 2. JSONB for Action Config
Each action type has a different config shape. Using JSONB gives full flexibility without needing to alter the schema when adding new action types.

## 3. UUID over Serial IDs
All tables use UUID as primary keys to prevent ID enumeration from external systems.

## 4. Raw SQL over ORM
Used `pg` directly with raw SQL to maintain full control, especially for `SKIP LOCKED` which is awkward to express in most ORMs.

## 5. ON DELETE CASCADE
All child tables cascade on pipeline deletion to avoid orphaned records without manual cleanup code.

## 6. Indexed Hot Paths
Added indexes on `jobs.status`, `jobs.pipeline_id`, and `jobs.created_at` since the worker queries these fields constantly.

## 7. Action-level Error Logging
When a job fails mid-pipeline, the system records which action failed 
and logs the results of all previously completed actions. This makes 
debugging in production straightforward without needing external tooling.

## 8. Database Transactions for Pipeline Creation
Pipeline creation uses a single database transaction (BEGIN/COMMIT/ROLLBACK).
All inserts (pipeline, actions, subscribers) either succeed together or roll
back together, preventing partial/broken pipelines in the database.

## 9. Shared Client for Transactions
Repository methods accept an optional QueryClient parameter (Pool | PoolClient).
This allows the service layer to pass a transaction client without the repository
knowing about transaction logic, keeping each layer in its own responsibility.