# Market Desk V1

A paper-trading and market-analysis workspace built as a modular Vue 3 + NestJS monorepo. No broker integration or real-money execution is present. Prices currently come from an internal deterministic/demo provider and must not be treated as investment data.

## Architecture

- `apps/web`: Vue 3, TypeScript, Vite, Pinia, Vue Router, TanStack Query, Lightweight Charts, Tailwind CSS, Socket.IO client.
- `apps/api`: NestJS modular monolith with GraphQL market queries, REST auth/user-data endpoints, TypeORM/PostgreSQL, Redis cache/pub-sub, BullMQ alert email jobs, and Socket.IO market rooms.
- `nginx`: SPA serving and API, GraphQL, and WebSocket reverse proxy.
- `docker-compose.yml`: PostgreSQL 16, Redis 7, API, and Nginx frontend.

Market flow: provider adapter -> validation -> Redis latest/history and pub/sub -> market WebSocket gateway. The provider interface can be implemented by a licensed external data vendor without changing market services.

## Run with Docker

1. Copy `.env.example` to `.env` and replace both JWT secrets with independent random values. The local HTTP Compose profile sets `COOKIE_SECURE=false`; set it to `true` behind TLS in production.
2. Start the stack with `docker compose up --build`.
3. Open `http://localhost:8080`. GraphQL is available at `/graphql`; API health is available at `/health`.
4. Stop with `docker compose down`. Persistent PostgreSQL/Redis volumes are retained.

The initial TypeORM migration runs automatically in Compose. Never enable TypeORM `synchronize` in production; it is disabled.

## Local development

Requirements: Node.js 20.20+ (Node 22 is recommended for deployment), npm, PostgreSQL, and Redis.

1. Install dependencies with `npm install`.
2. Start local PostgreSQL and Redis, create a `marketdesk` database, and set `DATABASE_URL`, `REDIS_URL`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, and `DB_MIGRATIONS_RUN=true` in your shell or `.env`.
3. Run `npm run dev` for both apps. Vite listens on `http://localhost:5173`; Nest listens on `http://localhost:3000`.

## Commands

- `npm run build` builds API then web.
- `npm run typecheck` runs both application type checks.
- `npm test --workspace @market-desk/api` runs API unit tests.
- `npm run test:e2e --workspace @market-desk/api` runs API e2e tests and requires PostgreSQL/Redis.

## Current V1 scope and limitations

- Market data is simulated. Configure a licensed provider by implementing `MarketDataProvider`; no production vendor adapter or market-data redistribution rights are included.
- Demo chart updates are generated locally until an authenticated market socket is connected. Authenticated sockets receive the API provider feed.
- Auth uses bcrypt password hashes, short-lived access JWTs, rotating refresh JWTs in HttpOnly cookies, and per-user API guards.
- Paper calculations use decimal arithmetic and database transactions. Limits fill against the latest internal provider price; no short selling, commissions, fractional-share policy configuration, or external broker is implemented.
- SMTP alert delivery is optional and requires SMTP environment values. In-app notifications are persisted.
- The frontend is desktop-first and responsive, but advanced multi-pane chart studies, server-side drawing synchronization in the UI, market news, and complete administrative/user-management screens remain follow-up work.

## Production checklist

Use Node 22, TLS termination, independent high-entropy JWT secrets, a private PostgreSQL/Redis network, Redis authentication, a managed SMTP relay, licensed market data, migration review, backups, log/metrics retention, and security review before exposing the service publicly. The demo provider, sample symbol metadata, market-status indicator, and chart snapshots are illustrative only.
