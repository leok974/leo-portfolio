/** @jsxImportSource preact */
import { useCallback } from 'preact/hooks';

export default function ResumeCta() {
  const resumeHref = '/resume/Leo_Klemet_Resume_2025.pdf';

  const onCopyLinkedIn = useCallback(async () => {
    const text = [
      'Leo Klemet — AI Engineer / Full-Stack',
      'Portfolio: https://www.leoklemet.com',
      'Resume (PDF): https://www.leoklemet.com' + resumeHref
    ].join('\n');
    try {
      await navigator.clipboard.writeText(text);
      // optionally show a toast if you have one
    } catch {
      // noop
    }
  }, []);

  return (
    <div
      style={{
        marginTop: '1.5rem',
        display: 'flex',
        gap: '0.75rem',
        flexWrap: 'wrap'
      }}
      data-testid="resume-cta"
      role="group"
      aria-label="Resume actions"
    >
      {/* REAL link button: just this anchor navigates to PDF */}
      <a
        href={resumeHref}
        className="btn-secondary"
        target="_blank"
        rel="noopener"
        data-testid="resume-link"
        aria-label="View Resume as PDF"
      >
        📑 Resume (PDF)
      </a>

      {/* REAL button: copies text; DOES NOT navigate */}
      <button
        type="button"
        onClick={onCopyLinkedIn}
        className="btn-secondary"
        data-testid="copy-linkedin"
        aria-label="Copy Resume for LinkedIn"
      >
        📋 Copy for LinkedIn
      </button>
    </div>
  );
}
