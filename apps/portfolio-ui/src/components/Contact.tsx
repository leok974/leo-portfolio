/** @jsxImportSource preact */
import { useEffect, useRef } from 'preact/hooks';

export default function Contact() {
  const widgetRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // inject Calendly script once (safe for SSR/hydration)
    const id = 'calendly-widget-js';
    if (!document.getElementById(id)) {
      const s = document.createElement('script');
      s.id = id;
      s.src = 'https://assets.calendly.com/assets/external/widget.js';
      s.async = true;
      document.body.appendChild(s);
    }

    // Auto-height: listen to Calendly postMessage
    const handleMessage = (e: MessageEvent) => {
      try {
        const data = e.data;
        // Accept both stringified and object payloads
        const msg = (typeof data === 'string') ? JSON.parse(data) : data;
        if (msg && msg.event === 'calendly:frameHeight' && Number(msg.payload)) {
          if (widgetRef.current) {
            widgetRef.current.style.height = msg.payload + 'px';
          }
        }
      } catch {}
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  return (
    <section id="contact" class="contact-section">
      <h2 class="section-title">Contact</h2>
      <div class="cal-wrap">
        <div
          ref={widgetRef}
          id="calendly"
          class="calendly-inline-widget"
          data-url="https://calendly.com/leoklemet/30min"
          data-testid="calendly"
          // height via CSS; auto-adjusted by postMessage
        />
      </div>
    </section>
  );
}
