/** @jsxImportSource preact */
import { render } from 'preact';
import Contact from './components/Contact';

// Initialize Preact Contact component
const mount = document.getElementById('contact-root');
if (mount) {
  render(<Contact />, mount);
  console.log('Contact component initialized');
}
