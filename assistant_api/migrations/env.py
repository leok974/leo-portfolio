"""Alembic environment configuration for assistant_api migrations."""
import os
import sys
from logging.config import fileConfig
from pathlib import Path

from alembic import context
from sqlalchemy import engine_from_config, pool

# Add parent directory to path so we can import assistant_api modules
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

# Interpret the config file for Python logging
config = context.config
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# Inject DB URL from environment variable
# Support both DATABASE_URL (standard) and DB_URL (from alembic.ini template)
db_url = os.getenv("DATABASE_URL") or os.getenv("DB_URL")

# If no URL provided, fall back to SQLite (same as agents/database.py)
if not db_url:
    db_path = os.getenv("AGENTS_DB") or os.getenv("RAG_DB", "./data/rag.sqlite")
    # Ensure data directory exists
    Path(db_path).parent.mkdir(parents=True, exist_ok=True)
    db_url = f"sqlite:///{db_path}"
    print(f"No DATABASE_URL or DB_URL set, using SQLite: {db_url}")

config.set_main_option("sqlalchemy.url", db_url)

# Import all models so Base.metadata includes them
from assistant_api.models.agents_tasks import Base as TaskBase  # noqa: E402

# Use the Base from agents_tasks model
target_metadata = TaskBase.metadata


def run_migrations_offline():
    """Run migrations in 'offline' mode.

    This configures the context with just a URL
    and not an Engine, though an Engine is acceptable
    here as well. By skipping the Engine creation
    we don't even need a DBAPI to be available.
    """
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online():
    """Run migrations in 'online' mode.

    In this scenario we need to create an Engine
    and associate a connection with the context.
    """
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata
        )

        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
