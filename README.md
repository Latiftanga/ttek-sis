# TTEK-SIS

Student Information System for Tagnatek. Manages students, staff, classes, attendance, and assessments.

**Stack:** Next.js 16 · FastAPI · PostgreSQL · Redis · Nginx · Docker

---

## Getting Started

### Prerequisites

- [Docker](https://docs.docker.com/get-docker/) and Docker Compose

### Setup

```bash
git clone https://github.com/Latiftanga/ttek-sis.git
cd ttek-sis

# Copy and fill in your environment variables
cp .env.example .env
```

Edit `.env` — at minimum change the three passwords and generate a `SECRET_KEY`:

```bash
python -c "import secrets; print(secrets.token_urlsafe(64))"
```

### Run

```bash
make up
```

On first run, database migrations apply automatically. The app will be available at:

| Service  | URL                          |
|----------|------------------------------|
| App      | http://localhost             |
| Frontend | http://localhost:3000        |
| API docs | http://localhost:8000/api/docs |

---

## Development

```bash
make up          # start all services
make down        # stop all services
make logs        # tail backend logs
make shell       # bash into backend container
make restart     # restart backend (after code changes that don't hot-reload)
```

### Database

```bash
make migrate                  # apply pending migrations
make migration msg="add X"    # generate a new migration
make rollback                 # revert last migration
make db-shell                 # open a psql session
make db-current               # show current revision
make db-history               # show migration history
```

### Reset everything

```bash
make reset-db   # wipe volumes and restart fresh
```

---

## Project Structure

```
ttek-sis/
├── backend/          # FastAPI app
│   ├── app/
│   │   ├── models/   # SQLAlchemy models
│   │   ├── routers/  # API endpoints
│   │   ├── schemas/  # Pydantic schemas
│   │   └── migrations/  # Alembic migrations
│   └── entrypoint.sh
├── frontend/         # Next.js app
│   └── app/
│       ├── (dashboard)/
│       │   ├── students/
│       │   ├── staff/
│       │   └── academic/
│       └── login/
├── nginx/            # Reverse proxy config
├── scripts/          # DB init scripts
├── docker-compose.yml
└── .env.example
```

---

## License

MIT © Adams Latif
