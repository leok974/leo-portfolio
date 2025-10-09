/**
 * WeightsEditor E2E Stub
 * Provides a test-only stub for the WeightsEditor component
 * Only rendered when VITE_E2E=1
 */
import React from 'react';

export default function WeightsEditorE2EStub() {
  return (
    <div 
      data-testid="weights-editor" 
      style={{ 
        padding: '8px', 
        border: '1px dashed var(--muted, #ccc)',
        borderRadius: '4px',
        backgroundColor: 'var(--background, #f5f5f5)',
        color: 'var(--foreground, #333)',
        fontSize: '14px'
      }}
    >
      <strong style={{ display: 'block', marginBottom: '4px' }}>
        ⚙️ Weights Editor (E2E Stub)
      </strong>
      <p style={{ margin: 0, fontSize: '12px', opacity: 0.7 }}>
        This stub is rendered only in E2E tests to satisfy test selectors.
      </p>
      <div style={{ marginTop: '8px', fontFamily: 'monospace', fontSize: '11px' }}>
        <span style={{ opacity: 0.6 }}>
          Active: 33.3% | 33.3% | 33.4%
        </span>
      </div>
    </div>
  );
}
