import { useEffect, useState } from "react";

interface Toast {
  id: number;
  message: string;
}

export function emitToast(message: string) {
  window.dispatchEvent(new CustomEvent("siteagent:toast", { detail: { message } }));
}

export function ToastHost() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  useEffect(() => {
    let id = 0;
    function handler(e: Event) {
      const detail = (e as CustomEvent).detail as { message: string };
      const t = { id: ++id, message: detail?.message ?? "Done" };
      setToasts((prev) => [...prev, t]);
      // auto-remove after 2 seconds
      setTimeout(() => setToasts((prev) => prev.filter((x) => x.id !== t.id)), 2000);
    }
    window.addEventListener("siteagent:toast", handler);
    return () => window.removeEventListener("siteagent:toast", handler);
  }, []);

  return (
    <div className="fixed bottom-4 right-4 z-[9999] space-y-2 pointer-events-none">
      {toasts.map((t) => (
        <div
          key={t.id}
          data-testid="toast"
          className="pointer-events-auto select-none rounded-xl border bg-black/80 text-white px-3 py-2 text-sm shadow-lg animate-in fade-in slide-in-from-bottom-2 duration-200"
        >
          {t.message}
        </div>
      ))}
    </div>
  );
}
