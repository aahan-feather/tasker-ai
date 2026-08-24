# Task Studio

Horizontal task orchestration with **goals**, **policies**, and **web-based simulation**.

Inspired by long-horizon agent platforms (e.g. Sierra Horizon), but simulation-first: click **Run simulation** to compress a multi-day outreach journey into seconds — no real email, SMS, or calls.

## Stack

- **React + TypeScript** (`client/`) — Task Studio UI
- **Node + TypeScript** (`server/`) — REST API
- **Shared core** (`packages/core/`) — policy engine, planner, simulation loop

## Quick start

```bash
npm install
npm run build --workspace=@task-studio/core
npm run dev:server   # http://localhost:3001
npm run dev:client   # http://localhost:5173
```

Open http://localhost:5173, pick a template, adjust policies (e.g. call caps), choose a recipient persona, and click **Run simulation**.

CLI smoke test:

```bash
npm run simulate --workspace=server
```

## Architecture

```
Task definition + policies + persona
        ↓
Policy engine (deterministic ALLOW / DENY / DEFER)
        ↓
Agent planner (rule-based next action)
        ↓
Mock tools (email / SMS / voice — simulated)
        ↓
Recipient simulator (persona-driven reactions)
        ↓
Timeline + audit log in the UI
```

Production durable execution (Temporal / Inngest) can reuse the same policy engine and task schema later.

## Project structure

```
packages/core/   Shared simulation engine
server/          Express API
client/          React app
```
