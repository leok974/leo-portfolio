/**
 * Global setup for analytics tests
 * Ensures analytics endpoints are accessible and dev guards are bypassed
 */
import { request, FullConfig } from '@playwright/test';

export default async function globalSetup(config: FullConfig) {
  const baseURL = config.projects[0].use?.baseURL as string || 'http://localhost:5173';
  
  console.log('🔧 Global Setup: Analytics Tests');
  console.log(`   Base URL: ${baseURL}`);
  
  try {
    const req = await request.newContext({
      baseURL,
      extraHTTPHeaders: {
        'Authorization': 'Bearer dev',
      },
    });

    // Check if analytics is enabled
    const healthRes = await req.get('/analytics/health');
    if (healthRes.ok()) {
      const health = await healthRes.json();
      console.log(`   ✓ Analytics enabled: ${health.status}`);
    } else {
      console.log(`   ⚠ Analytics endpoint not available (status: ${healthRes.status()})`);
    }

    // Optional: Unlock dev mode if you have a test-only endpoint
    // Uncomment if you added /agent/mock/unlock-dev
    // try {
    //   await req.post('/agent/mock/unlock-dev', { 
    //     data: { token: process.env.TEST_UNLOCK || 'ok' } 
    //   });
    //   console.log('   ✓ Dev mode unlocked');
    // } catch (e) {
    //   console.log('   ℹ Dev unlock endpoint not available (expected)');
    // }

    await req.dispose();
  } catch (error) {
    console.log(`   ⚠ Setup warning: ${error}`);
    // Don't fail - tests should handle unavailable endpoints gracefully
  }
}
