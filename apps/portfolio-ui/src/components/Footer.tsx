export default function Footer() {
  return (
    <footer className="mt-16 border-t border-white/10 py-10">
      <div className="mx-auto max-w-5xl px-4 flex items-center justify-between">
        <p className="text-sm text-slate-400 select-none" data-testid="footer-rights">
          © {new Date().getFullYear()} Leo Klemet. All rights reserved.
        </p>

        <a
          href="#top"
          className="rounded-lg px-3 py-2 text-sm text-slate-300 hover:text-white ring-1 ring-white/10"
          data-testid="back-to-top"
        >
          Back to Top
        </a>
      </div>
    </footer>
  );
}
