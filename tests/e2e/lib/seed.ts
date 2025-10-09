/**
 * Seed utilities for E2E tests
 * Used to set up test data before running admin tests
 */
import type { APIRequestContext } from '@playwright/test';
import { API_URL } from './api';

/**
 * Seed a layout optimization for testing
 * This ensures the admin panel has data to display
 */
export async function seedLayout(request: APIRequestContext, preset = 'recruiter') {
  try {
    const response = await request.post(`${API_URL}/agent/act`, {
      headers: { 'Content-Type': 'application/json' },
      data: {
        task: 'layout.optimize',
        payload: { preset }
      }
    });

    if (!response.ok()) {
      console.warn('[seed] Layout optimization failed:', response.status());
    }
  } catch (error) {
    console.warn('[seed] Failed to seed layout:', error);
  }
}

/**
 * Seed AB test events for analytics testing
 */
export async function seedAbEvents(request: APIRequestContext) {
  try {
    // Fire a few test events
    const visitorId = 'test-visitor-' + Date.now();

    // View event
    await request.post(`${API_URL}/api/ab/track`, {
      headers: { 'Content-Type': 'application/json' },
      data: {
        visitor_id: visitorId,
        bucket: 'A',
        event_type: 'view'
      }
    });

    // Click event
    await request.post(`${API_URL}/api/ab/track`, {
      headers: { 'Content-Type': 'application/json' },
      data: {
        visitor_id: visitorId,
        bucket: 'A',
        event_type: 'click',
        project_slug: 'test-project'
      }
    });
  } catch (error) {
    console.warn('[seed] Failed to seed AB events:', error);
  }
}
