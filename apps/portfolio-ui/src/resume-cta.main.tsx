/** @jsxImportSource preact */
import { render } from 'preact';
import ResumeCta from './components/ResumeCta';

// Initialize Preact ResumeCta component (About section)
const mount = document.getElementById('resume-cta-root');
if (mount) {
  render(<ResumeCta />, mount);
  console.log('ResumeCta component initialized (about section)');
}

// Initialize Preact ResumeCta component (Contact section footer)
const mountFooter = document.getElementById('resume-cta-footer-root');
if (mountFooter) {
  render(<ResumeCta />, mountFooter);
  console.log('ResumeCta component initialized (contact section)');
}
