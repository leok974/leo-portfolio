"""Add agents_tasks_prune function for PostgreSQL

Revision ID: 002_agents_tasks_prune_fn
Revises: 001_agents_tasks
Create Date: 2025-10-10

"""

from alembic import op

# revision identifiers, used by Alembic.
revision = "002_agents_tasks_prune_fn"
down_revision = "001_agents_tasks"
branch_labels = None
depends_on = None


def upgrade():
    """Create PostgreSQL function for pruning old agent task records."""
    # Only create function for PostgreSQL (SQLite doesn't support CREATE FUNCTION)
    bind = op.get_bind()
    if bind.dialect.name == "postgresql":
        op.execute(
            """
        CREATE OR REPLACE FUNCTION agents_tasks_prune(before_ts timestamptz)
        RETURNS integer
        LANGUAGE plpgsql
        AS $$
        DECLARE v_count integer;
        BEGIN
          DELETE FROM agents_tasks WHERE started_at < before_ts;
          GET DIAGNOSTICS v_count = ROW_COUNT;
          RETURN v_count;
        END;
        $$;
        """
        )


def downgrade():
    """Drop the prune function."""
    bind = op.get_bind()
    if bind.dialect.name == "postgresql":
        op.execute("DROP FUNCTION IF EXISTS agents_tasks_prune(timestamptz);")
