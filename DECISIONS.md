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
When a job fails mid-pipeline, the system records which action failed and logs the results of all previously completed actions. This makes debugging in production straightforward without needing external tooling.

## 8. Database Transactions for Pipeline Creation
Pipeline creation uses a single database transaction (BEGIN/COMMIT/ROLLBACK). All inserts (pipeline, actions, subscribers) either succeed together or roll back together, preventing partial/broken pipelines in the database.

## 9. Shared Client for Transactions
Repository methods accept an optional QueryClient parameter (Pool | PoolClient). This allows the service layer to pass a transaction client without the repository knowing about transaction logic, keeping each layer in its own responsibility.

## 10. Soft Delete over Hard Delete
Instead of permanently removing pipelines, we set `is_deleted = true` and record `deleted_at`. All queries filter by `is_deleted = false`. This preserves job history tied to a pipeline and makes accidental deletions recoverable.

## 11. camelCase in TypeScript, snake_case in Database
We follow PostgreSQL's snake_case convention for column names and JavaScript's camelCase for TypeScript interfaces. The mapping happens once in the repository layer, so neither the service nor the controller ever sees a snake_case key.

## 12. Automatic snake_case to camelCase Conversion
Instead of writing `AS "camelCase"` aliases in every query, we use a `toCamelCase` utility that converts all keys after the query returns. This keeps SQL clean and means adding a new column only requires updating the TypeScript interface.

## 13. Raw Body for Signature Verification
We capture the raw request body before JSON parsing and use it for HMAC verification. Verifying against `JSON.stringify(payload)` would break for senders like GitHub or Stripe that don't guarantee field order.

## 14. Timing-Safe Signature Comparison
Signatures are compared with `crypto.timingSafeEqual` after an explicit length check. Without the length check, `timingSafeEqual` throws on mismatched buffer sizes, which would leak timing information to an attacker.

## 15. Webhook Transaction Wrapping
Job creation on webhook ingestion is wrapped in a transaction. If the insert fails for any reason, nothing is persisted and the caller gets a clean error rather than a ghost record in an inconsistent state.

## 16. Rollback Error Isolation
The `ROLLBACK` call inside the catch block is itself wrapped in a try/catch. A failed rollback should never swallow the original error, and the connection is always released in `finally` regardless of what happens.

## 17. Idempotency via External Delivery IDs
To prevent double-processing we store the unique id from the event in a UNIQUE column. By checking for existence before insertion we ensure a payment event creates exactly one Job even if received multiple times.

## 18. RabbitMQ over PostgreSQL Polling
The worker polls PostgreSQL in most systems I've seen, but I wanted a cleaner separation between ingestion and processing. RabbitMQ lets the API layer drop a message and move on — the worker picks it up independently with no shared timing dependency. The Dead Letter Exchange also gave us failed-job handling without writing retry logic from scratch.

## 19. Publisher Confirms
Switched from a regular Channel to ConfirmChannel so that publish() only resolves after RabbitMQ has written the message to disk. Without this, a broker restart between publish and persist would silently drop jobs.

## 20. Exponential Backoff on Reconnect
Fixed reconnect delays either recover too slowly or flood a restarting broker. Doubling the wait after each attempt (1s → 2s → 4s, capped at 30s) keeps pressure off the broker while still recovering quickly after short outages.

## 21. Publish After Commit
The RabbitMQ publish call happens after the database transaction commits, not inside it. If publish fails, the job record still exists in the database and can be recovered. The reverse order would risk a ROLLBACK triggered by a broker error wiping out a perfectly valid job.

## 22. Circuit Breaker on Publish
If the channel is null when publish is called, we throw immediately rather than waiting or retrying inline. This keeps the webhook ingestion API responsive even when the broker is temporarily unavailable and pushes the failure handling decision to the caller.

## 23. Three Focused Actions as a Processing Chain
Built three domain-specific actions that work as a deliberate sequence: full_name merges identity fields, currency_converter normalizes the amount to USD, and amount_filter acts as the final gate. Each action has one job and passes its output directly to the next, so the chain is predictable and easy to debug when something fails mid-way.

## 24. In-memory Cache for Exchange Rates
Added a module-level cache with a 1-hour TTL for exchange rates instead of hitting the external API on every job. No extra infrastructure needed — just a variable and a timestamp check.

## 25. Database-Backed Retries over In-Memory Timers
Instead of using setTimeout for retries—which would vanish if the worker crashed or restarted—I persist the exact attempt count and status in the database. When a delivery fails, we calculate the next delay and hand it off to the message broker. This ensures 100% reliability; even if the worker crashes, the delivery record in the DB accurately reflects what happened and the broker safely holds the pending retry.

## 26. Zero-Polling Retries via RabbitMQ TTL
Initially, I implemented retry polling using `FOR UPDATE SKIP LOCKED` in PostgreSQL. However, querying the database constantly for delayed jobs wasted resources. I ripped out the polling completely and replaced it with RabbitMQ Time-To-Live (TTL) queues. Now, when a delivery fails, it gets published to a temporary "waiting" queue with a TTL matching the backoff delay. When it naturally expires, Dead Letter routing pushes it to an active retry queue. This turns retries into a fully event-driven architecture with zero database polling overhead.

## 27. Tiered Rate Limiting
I implemented express-rate-limit with two distinct strategies. There’s a loose global limit to prevent general resource exhaustion, and a much stricter "Tight Gate" on the webhook ingestion endpoints. This specifically protects the database and RabbitMQ from being flooded by a malfunctioning or malicious external sender before the request even hits our business logic.

## 28. Response-Based Retry Backoff
The retry logic doesn't just blindly guess when to try again. It captures the response_status from the subscriber. If we get a 429 (Too Many Requests), the system pushes the next_retry_at further out than it would for a 500 (Internal Server Error), respecting the destination's own rate limits and preventing us from being blocked.

## 29. Graceful Poller Shutdown
The background retry interval is tied to the worker's lifecycle. On SIGTERM or SIGINT, we explicitly clear the interval and wait for the current polling tick to finish before exiting. This prevents database connections and ensures that a shutdown mid-poll doesn't leave rows in a locked state.

## 30. Structured Request Context for Debugging
Instead of just logging string messages, I attached a unique request_id to every incoming webhook. This ID travels from the API to the Queue and finally to the Worker. If a customer reports a missing event, I can grep the logs for that specific ID and see the entire lifecycle—from the moment it hit our server to the final delivery attempt—without guessing which log belongs to which request.

## 31. Health Check Endpoints for Orchestration
I didn't just rely on Docker's restart policy. I added a /health endpoint that actually pings the Database and checks the RabbitMQ connection status. This is crucial for Docker Compose or Kubernetes; it prevents the API from accepting traffic if the backing services are still booting up, ensuring we never return a 500 just because the DB was a few seconds slow to start.

## 32. Manual "Kill Switch" for Pipelines
I added an is_active toggle for pipelines. If a subscriber's server goes down and starts throwing thousands of errors, the user can temporarily "pause" the pipeline. The jobs will still be queued, but the worker will skip delivery until the toggle is flipped back. This prevents our retry queue from being flooded with doomed attempts and saves server resources during external outages.

## 33. Dedicated Workers for Separation of Concerns
To prevent failed jobs from clogging up the pipeline for new events (Head-of-Line blocking), I split the worker into two distinct roles. Instead of maintaining two separate codebases, I used a `WORKER_TYPE` environment variable in a single script. Now we can run `WORKER_TYPE=main` to process fresh jobs, and `WORKER_TYPE=retry` in a separate container for delayed attempts. This lets us scale independently—we can spin up multiple main workers to handle traffic spikes in Docker, while keeping just one lightweight worker solely for retries.

## 34. SSRF Protection for Subscriber Deliveries
Since users provide the subscriber URLs, the worker was vulnerable to Server-Side Request Forgery (SSRF). I added a validation layer in the delivery logic that resolves the hostname and blocks any requests to private IP ranges (127.0.0.1, 192.168.x.x, etc.) or reserved cloud metadata IPs. This ensures the worker can't be used as a proxy to attack our internal database or the host's infrastructure.

## 35. Sweep Worker for Disaster Recovery (Transactional Outbox Pattern)
While RabbitMQ handles the happy path exceptionally well, a catastrophic broker crash mid-flight could leave jobs stuck in a pending state in PostgreSQL. Instead of merging polling logic into the Main/Retry workers, I introduced a dedicated Sweep Worker. It runs every 5 minutes and strictly queries for pending jobs older than 15 minutes, pushing them back to the queue. This represents a lightweight Transactional Outbox pattern that guarantees zero data loss without hammering the database during normal traffic.

## 36. Processing State to Prevent Race Conditions
To safely enable database polling alongside RabbitMQ without causing double-processing, I added a processing state to the Jobs table. The moment the Main worker pulls a message from the queue, it synchronously updates the database state to processing. Because the Sweep Worker only looks for stalled pending records, it completely ignores active jobs, eliminating race conditions entirely.

## 37. Strict Single Responsibility Principle in Workers
Initially, the different worker logics (handling actions, polling databases, making HTTP deliveries) were somewhat coupled. I refactored the worker topology to strictly adhere to SRP. Now, the codebase is split into three decoupled components: Main (pipeline actions), Retry (delayed external HTTP requests + backoff), and Sweep (polling recovery). Each has its own dedicated consumer and processor file. This makes testing easier and prevents an SSRF delivery bug from crashing the main pipeline execution loop.

## 38. RabbitMQ over Redis for Guaranteed Delivery
While Redis (via libraries like BullMQ) is popular for background jobs, it is primarily an in-memory data store. If a Redis server crashes before persisting to disk, jobs can be permanently lost. I specifically chose RabbitMQ because it is a true Message Broker designed for reliability. By enabling **Publisher Confirms**, **Durable Queues**, and **Persistent Messages**, RabbitMQ guarantees that once the API accepts a webhook, the job is safely written to disk and will not be lost even in the event of a total broker restart. This perfectly aligns with the system's core requirement of Zero Data Loss.

## 39. Automated Code Quality Enforcement in CI/CD
To maintain a clean and consistent codebase as the project grows, I integrated ESLint directly into the GitHub Actions pipeline. Instead of relying on developers to manually run the linter before pushing, the CI pipeline enforces it automatically, failing the build if any unresolved warnings or errors exist. This keeps the codebase free of unused variables and stylistic inconsistencies without manual oversight.

## 40. Proactive Security Auditing
To prevent known vulnerabilities from sneaking into production through third-party dependencies, I added a proactive security scan (`npm audit`) to the CI pipeline. By enforcing this before the Docker images are even built, the pipeline acts as an automated gatekeeper, immediately blocking any PR or commit that introduces high or critical severity vulnerabilities.
