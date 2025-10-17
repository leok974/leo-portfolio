import React from 'react';
import { render } from 'preact';
import { RouteBadge } from './RouteBadge';

interface BackendSnap { last_backend?: string; last_ms?: number }
interface Scope { route?: 'rag' | 'faq' | 'chitchat'; reason?: string; project_id?: string | null }

interface Props {
  scope?: Scope;
  grounded?: boolean;
  sourcesCount?: number;
  backends?: { gen?: BackendSnap; embeddings?: BackendSnap; rerank?: BackendSnap };
}

export function renderRouteBadge(container: HTMLElement, props: Props) {
  render(<RouteBadge {...props} />, container);
}
