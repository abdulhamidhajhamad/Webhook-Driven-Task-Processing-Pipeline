# Webhook-Driven Task Processing Pipeline

A robust, background-job-based system for ingesting webhooks and running pipeline tasks, functioning similarly to a simplified Zapier. This project accepts incoming event payloads, processes them through configurable actions asynchronously, and delivers the results to registered subscribers with a built-in retry mechanism for failures.

---

## Overview

The core purpose of this service is to ensure heavy or unpredictable webhook payloads do not block the main API thread. By utilizing a "Fire and Forget" methodology, clients submitting webhooks get an immediate `202 Accepted` response while the heavy lifting, processing, and HTTP delivery attempts happen safely in the background using Worker services.

### Key Features
* **Asynchronous Processing:** Webhooks are queued immediately in PostgreSQL & RabbitMQ.
* **Dynamic Pipelines:** Define custom data transformations (e.g., Currency Conversion, Amount Filtering).
* **Resiliency (Retry Logic):** Failed webhook deliveries to subscribers are picked up by a dedicated retry worker with exponential backoff.
* **Disaster Recovery (Sweep Worker):** A secondary polling mechanism recovers stalled jobs if the message broker crashes, guaranteeing zero data loss.
* **Containerized:** Instant setup via Docker Compose.
* **Clean Architecture:** Strict Separation of Concerns (SRP) ensuring code maintainability and testability for independent scaling.

---

## Tech Stack

* **Language:** TypeScript / Node.js
* **API Framework:** Express.js
* **Database:** PostgreSQL (with raw SQL queries for optimized performance)
* **Message Broker:** RabbitMQ
* **Testing:** Vitest
* **CI/CD:** GitHub Actions
* **Documentation:** Swagger / OpenAPI

---

## Quick Setup & Installation

### Requirements
You only need to have **Docker** and **Docker Compose** installed on your machine.

### Run the Application

1. Clone the repository:
   ```bash
   git clone https://github.com/abdulhamidhajhamad/Webhook-Driven-Task-Processing-Pipeline
   cd Webhook-Driven-Task-Processing-Pipeline
   ```

2. Start the entire infrastructure (Database, Message Queue, API, and Workers) using Docker:
   ```bash
   docker compose up -d
   ```
   *Wait a few seconds for the `healthcheck` to pass on PostgreSQL and RabbitMQ.*

3. Verify containers are running:
   ```bash
   docker ps
   ```
   You should see 5 active containers (`db`, `rabbitmq`, `api`, `worker-main`, `worker-retry`).

The API is now running on: **http://localhost:3001**

### Worker Subsystems
This application operates using three specialized background routines:
1. **Main Worker:** Consumes real-time webhooks, runs the pipeline actions (Data filters, formatting, etc.), and attempts the first external HTTP delivery.
2. **Retry Worker:** Listens to RabbitMQ's Dead Letter Exchange (DLX). If a subscriber's server is down, this worker handles the Exponential Backoff retries over time.
3. **Sweep Worker:** A crontab disaster recovery mechanism that queries PostgreSQL every 5 minutes to rescue and re-queue webhooks that stalled due to sudden infrastructure crashes.

### Running Tests
To run the automated test suite locally:
```bash
npm install
npm run test
```

---

## API Documentation (Swagger / OpenAPI)

This project utilizes dynamically generated OpenAPI specifications. Instead of reading static text, you can interact with the endpoints directly through the Swagger UI.

Once the application is running, navigate to the following link to view the complete API flow and test the Endpoints:

**[Interactive API Docs (Swagger UI) - http://localhost:3001/api-docs](http://localhost:3001/api-docs)**

### Standard API Flow
If you want to test the flow manually, here is the expected sequence of actions:
1. **Create a Pipeline:** `POST /pipelines` - Register a new pipeline with specific data transformations.
2. **Add a Subscriber:** `POST /pipelines/:id/subscribers` - Add a destination URL that will receive the processed data.
3. **Trigger the Webhook:** `POST /webhooks/:sourceId` - Send the payload. The API will respond immediately.
4. **Monitor Jobs:** `GET /jobs/pipeline/:pipelineId` - Track the lifecycle of the job as it moves from `pending` -> `processing` -> `completed` (or `failed` -> `retrying`).

---

## Architecture & Design Decisions

Curious about how the components communicate or why specific tools were chosen? 
Please refer to the detailed **[DECISIONS.md](./DECISIONS.md)** file where the system architecture, database schema, and retry logic are thoroughly explained.
