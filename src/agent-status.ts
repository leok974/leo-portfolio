// agent-status.ts - status badge for assistant dock (TypeScript)
import { statusWithFallback, StatusSummary } from './api';

interface InternalStatus extends StatusSummary { tooltip?: string }

const isPages = typeof location !== 'undefined' && location.hostname.endsWith('github.io');
const BASE = ((window as any).__API_BASE__ || (window as any).AGENT_BASE_URL || (isPages ? 'https://assistant.ledger-mind.org/api' : '/api')).replace(/\/$/, '');
const STATUS_URL = BASE + '/status/summary';
const REFRESH_MS = 30_000;

function el(){ return document.getElementById('agent-status'); }

function dot(color: string){ const d=document.createElement('span'); d.className='agent-dot'; d.style.background=color; return d; }

function classify(s: InternalStatus){
  if (s.llm?.path !== 'down' && s.rag?.ok && s.openai_configured) return 'ok';
  if (s.llm?.path !== 'down' || s.rag?.ok || s.openai_configured) return 'warn';
  return 'err';
}

function label(s: InternalStatus){
  const llm = s.llm?.path || 'down';
  const k = s.openai_configured ? 'yes' : 'no';
  const r = s.rag?.ok ? 'ok' : 'err';
  return `LLM: ${llm} • OpenAI key: ${k} • RAG: ${r}`;
}

async function fetchStatus(): Promise<InternalStatus>{
  return statusWithFallback({ attempts: 3 }) as any;
}

function render(s: InternalStatus){
  const node = el(); if (!node) return;
  node.classList.remove('ok','warn','err');
  node.classList.add(classify(s));
  const color = s.llm?.path==='local' ? '#2ecc71' : s.llm?.path==='fallback' ? '#f1c40f' : '#e74c3c';
  const text = document.createElement('span');
  text.className = 'agent-kv';
  text.textContent = 'Agent';
  node.replaceChildren(dot(color), text);
  const src = (s as any)._source ? `\n(source: ${(s as any)._source})` : '';
  const tip = s.tooltip ? `${label(s)}${src}\n${s.tooltip}` : `${label(s)}${src}`;
  node.setAttribute('data-tip', tip);
  node.title = tip;
}

async function tick(){
  try { render(await fetchStatus()); }
  catch (e: any) {
    const node = el();
    const reason = (e && (e.errors || e.message)) ? (Array.isArray(e.errors)? e.errors.slice(-1)[0] : e.message) : 'unknown error';
    render({ llm:{path:'down'}, openai_configured:false, rag:{ok:false}, tooltip: `Last error: ${reason}` });
  }
}

function updateServed(served: string){
  const path = served === 'fallback' ? 'fallback' : 'local';
  render({ llm:{ path }, openai_configured:true, rag:{ ok:true }, tooltip: 'Live stream metadata' });
}

function start(){
  const node = el();
  if (!node) return;
  node.style.cursor = 'pointer';
  node.addEventListener('click', () => { tick(); });
  tick();
  setInterval(tick, REFRESH_MS);
}

(window as any).AgentStatus = Object.assign((window as any).AgentStatus||{}, { start, updateServed });
window.addEventListener('DOMContentLoaded', start);
