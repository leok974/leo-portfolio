import React from 'react';
import { createRoot, Root } from 'react-dom/client';
import { RouteBadge } from './RouteBadge';

interface BackendSnap { last_backend?: string; last_ms?: number }
interface Scope { route?: 'rag' | 'faq' | 'chitchat'; reason?: string; project_id?: string | null }

interface Props {
  scope?: Scope;
  grounded?: boolean;
  sourcesCount?: number;
  backends?: { gen?: BackendSnap; embeddings?: BackendSnap; rerank?: BackendSnap };
}

const roots = new WeakMap<HTMLElement, Root>();

export function renderRouteBadge(container: HTMLElement, props: Props) {
  let root = roots.get(container);
  if (!root) {
    root = createRoot(container);
    roots.set(container, root);
  }
  root.render(<RouteBadge {...props} />);
}
