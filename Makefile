# TTEK-SIS Makefile
# Usage: make <command>

# ── Docker ─────────────────────────────────────────────────────────
up:
	docker compose up

down:
	docker compose down

build:
	docker compose build --no-cache backend

restart:
	docker compose restart backend

logs:
	docker compose logs backend --tail=50 -f

# ── Database ────────────────────────────────────────────────────────
migrate:
	docker exec -it -w /app ttek_backend alembic upgrade head

migration:
	docker exec -it -w /app ttek_backend alembic revision --autogenerate -m "$(msg)"

rollback:
	docker exec -it -w /app ttek_backend alembic downgrade -1

db-current:
	docker exec -it -w /app ttek_backend alembic current

db-history:
	docker exec -it -w /app ttek_backend alembic history

db-shell:
	docker exec -it ttek_postgres psql -U ttek_user -d ttek_sis

# ── Development ─────────────────────────────────────────────────────
shell:
	docker exec -it ttek_backend bash

reset-db:
	docker compose down -v
	docker compose up -d postgres
	sleep 3
	docker compose up -d

.PHONY: up down build restart logs migrate migration rollback db-current db-history db-shell shell reset-db
