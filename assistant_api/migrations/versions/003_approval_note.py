"""Add approval_note column and approval_state index

Revision ID: 003_approval_note
Revises: 002_agents_tasks_prune_fn
Create Date: 2025-01-10
"""
import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = "003_approval_note"
down_revision = "002_agents_tasks_prune_fn"
branch_labels = None
depends_on = None


def upgrade():
    """Add approval_note column and create index on approval_state"""
    op.add_column("agents_tasks", sa.Column("approval_note", sa.Text(), nullable=True))
    op.create_index("idx_agents_tasks_approval_state", "agents_tasks", ["approval_state"])


def downgrade():
    """Remove approval_note column and approval_state index"""
    op.drop_index("idx_agents_tasks_approval_state", table_name="agents_tasks")
    op.drop_column("agents_tasks", "approval_note")
