const KEY = 'theme';
const prefersDark = window.matchMedia?.('(prefers-color-scheme: dark)').matches;
const saved = (localStorage.getItem(KEY) || '').toLowerCase();
const initial = (saved === 'dark' || saved === 'light') ? saved : (prefersDark ? 'dark' : 'light');

export function applyTheme(t: 'dark' | 'light') {
  document.documentElement.setAttribute('data-theme', t);
  localStorage.setItem(KEY, t);
}

export function initThemeToggle(btn: HTMLElement) {
  applyTheme(initial as 'dark' | 'light');
  btn.addEventListener('click', () => {
    const current = document.documentElement.getAttribute('data-theme');
    const next = current === 'dark' ? 'light' : 'dark';
    applyTheme(next as 'dark' | 'light');
  });
}
