"""Add agents_tasks table for orchestration tracking

Revision ID: 001_agents_tasks
Revises:
Create Date: 2025-01-XX
"""
import sqlalchemy as sa
from alembic import op

try:
    from sqlalchemy.dialects.postgresql import JSONB
    has_postgres = True
except ImportError:
    has_postgres = False

# revision identifiers, used by Alembic
revision = '001_agents_tasks'
down_revision = None
branch_labels = None
depends_on = None


def upgrade():
    # Use JSON for SQLite, JSONB for PostgreSQL
    json_type = JSONB if has_postgres and op.get_bind().dialect.name == 'postgresql' else sa.JSON

    op.create_table(
        'agents_tasks',
        sa.Column('id', sa.Integer(), nullable=False, autoincrement=True),
        sa.Column('task', sa.String(64), nullable=False),
        sa.Column('run_id', sa.String(64), nullable=False),
        sa.Column('status', sa.String(32), nullable=False),
        sa.Column('started_at', sa.DateTime(), nullable=True),
        sa.Column('finished_at', sa.DateTime(), nullable=True),
        sa.Column('duration_ms', sa.Integer(), nullable=True),
        sa.Column('inputs', json_type, nullable=True),
        sa.Column('outputs_uri', sa.String(512), nullable=True),
        sa.Column('log_excerpt', sa.Text(), nullable=True),
        sa.Column('approval_state', sa.String(32), nullable=True),
        sa.Column('approver', sa.String(128), nullable=True),
        sa.Column('webhook_notified_at', sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint('id')
    )

    # Create indexes for common queries
    op.create_index('idx_agents_tasks_run_id', 'agents_tasks', ['run_id'])
    op.create_index('idx_agents_tasks_started_at', 'agents_tasks', ['started_at'])
    # Composite index for keyset pagination (started_at DESC, id DESC)
    op.create_index('idx_agents_tasks_started_id_desc', 'agents_tasks', ['started_at', 'id'])


def downgrade():
    op.drop_index('idx_agents_tasks_started_id_desc', table_name='agents_tasks')
    op.drop_index('idx_agents_tasks_started_at', table_name='agents_tasks')
    op.drop_index('idx_agents_tasks_run_id', table_name='agents_tasks')
    op.drop_table('agents_tasks')
