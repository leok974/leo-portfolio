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
  }, []);

  return (
    <section id="contact" class="contact-section">
      <h2 class="section-title">Contact</h2>
      <div class="calendly-wrap">
        <div
          ref={widgetRef}
          class="calendly-inline-widget"
          data-url="https://calendly.com/leoklemet/30min"
          // height via CSS; avoids layout shift
        />
      </div>
    </section>
  );
}
