# TOS Service

Microservice for TOS to APACS real-time integration.

## Run

```bash
npm install
npm run dev
```

Default port: `5009`

## Environment

Copy `.env.example` to `.env` and set:

- `PORT`
- `PG_HOST`
- `PG_PORT`
- `PG_USER`
- `PG_PASSWORD`
- `PG_DATABASE`
- `JWT_SECRET`
- `JWT_EXPIRES_IN`

## API Docs

See [docs/TOS_API.md](docs/TOS_API.md)
