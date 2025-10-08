import React, { useState } from "react";

interface AutotuneButtonProps {
  alpha?: number;
  onSuccess?: () => void;
  className?: string;
}

export const AutotuneButton: React.FC<AutotuneButtonProps> = ({
  alpha = 0.5,
  onSuccess,
  className = "",
}) => {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleAutotune = async () => {
    setLoading(true);
    setMessage(null);
    setError(null);

    try {
      const res = await fetch(`/agent/autotune?alpha=${alpha}`, {
        method: "POST",
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`HTTP ${res.status}: ${text}`);
      }

      const result = await res.json();
      setMessage(result.message || "Autotune completed successfully");

      // Dispatch event to refresh admin badge
      window.dispatchEvent(
        new CustomEvent("siteagent:layout:updated", {
          detail: { source: "autotune", weights: result.new_weights },
        })
      );

      // Call success callback if provided
      onSuccess?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={`space-y-2 ${className}`}>
      <button
        onClick={handleAutotune}
        disabled={loading}
        className="rounded bg-purple-600 px-4 py-2 text-sm text-white hover:bg-purple-700 disabled:opacity-50"
      >
        {loading ? "Running Autotune..." : "🤖 Run Autotune"}
      </button>

      {message && (
        <div className="rounded bg-green-50 px-3 py-2 text-xs text-green-800">
          ✅ {message}
        </div>
      )}

      {error && (
        <div className="rounded bg-red-50 px-3 py-2 text-xs text-red-800">
          ❌ {error}
        </div>
      )}

      <div className="text-xs text-gray-500">
        Learning rate (alpha): {alpha.toFixed(2)}
      </div>
    </div>
  );
};
