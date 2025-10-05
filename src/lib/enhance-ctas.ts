import { createRoot } from 'react-dom/client';
import * as React from 'react';
import { ArrowRight, FileDown } from 'lucide-react';

// Helper to inject Lucide icons into buttons/links
export function enhanceCTAs() {
  // Add ArrowRight icon to "See My Work" CTA
  const seeWorkCTA = document.querySelector<HTMLAnchorElement>('a.cta[href="#projects"]');
  if (seeWorkCTA) {
    const textContent = seeWorkCTA.textContent?.trim() || '';
    seeWorkCTA.textContent = '';
    const iconContainer = document.createElement('span');
    iconContainer.className = 'inline-flex items-center gap-2';
    seeWorkCTA.appendChild(iconContainer);

    createRoot(iconContainer).render(
      React.createElement(React.Fragment, null, [
        React.createElement('span', { key: 'text' }, textContent.replace('⟶', '').trim()),
        React.createElement(ArrowRight, { key: 'icon', size: 20, className: 'inline-block' })
      ])
    );
  }

  // Add FileDown icon to "Download Resume" CTA
  const resumeCTA = document.querySelector<HTMLAnchorElement>('a.cta[href="/dl/resume"]');
  if (resumeCTA) {
    const textContent = resumeCTA.textContent?.trim() || '';
    resumeCTA.textContent = '';
    const iconContainer = document.createElement('span');
    iconContainer.className = 'inline-flex items-center gap-2';
    resumeCTA.appendChild(iconContainer);

    createRoot(iconContainer).render(
      React.createElement(React.Fragment, null, [
        React.createElement(FileDown, { key: 'icon', size: 18, className: 'inline-block' }),
        React.createElement('span', { key: 'text' }, textContent.replace('📄', '').trim())
      ])
    );
  }
}
