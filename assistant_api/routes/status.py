from fastapi import APIRouter
from pydantic import BaseModel
import os
from ..status_common import build_status

router = APIRouter()


class Status(BaseModel):
    llm: dict
    openai_configured: bool
    rag: dict
    ready: bool
    metrics_hint: dict
    tooltip: str | None = None
    primary: dict | None = None
    last_served_by: str | None = None


@router.get('/status/summary', response_model=Status)
async def status_summary():
    base = os.getenv('BASE_URL_PUBLIC', 'http://127.0.0.1:8001')
    data = await build_status(base)
    return Status(**data, last_served_by=os.environ.get('LAST_SERVED_BY'))
