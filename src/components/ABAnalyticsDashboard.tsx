import React, { useState, useEffect } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

interface DailyStat {
  day: string;
  A_ctr: number;
  B_ctr: number;
  A_views: number;
  A_clicks: number;
  B_views: number;
  B_clicks: number;
}

interface OverallStat {
  A_ctr: number;
  B_ctr: number;
  A: { views: number; clicks: number };
  B: { views: number; clicks: number };
  days: number;
}

interface SummaryData {
  series: DailyStat[];
  overall: OverallStat;
}

export const ABAnalyticsDashboard: React.FC = () => {
  const [data, setData] = useState<SummaryData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (fromDate) params.append("from", fromDate);
      if (toDate) params.append("to", toDate);

      const url = `/agent/ab/summary${params.toString() ? `?${params.toString()}` : ""}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Load on mount
    fetchData();
  }, []);

  if (loading && !data) {
    return <div data-testid="ab-analytics-dashboard" className="p-4 text-sm text-gray-500">Loading AB analytics...</div>;
  }

  if (error) {
    return <div data-testid="ab-analytics-dashboard" className="p-4 text-sm text-red-600">Error: {error}</div>;
  }

  if (!data) {
    return <div data-testid="ab-analytics-dashboard" className="p-4 text-sm text-gray-500">No data available</div>;
  }

  const winner =
    data.overall.A_ctr > data.overall.B_ctr
      ? "A"
      : data.overall.B_ctr > data.overall.A_ctr
        ? "B"
        : "Tie";

  return (
    <div data-testid="ab-analytics-dashboard" className="space-y-6 p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">A/B Test Analytics</h2>
        <button
          onClick={fetchData}
          disabled={loading}
          className="rounded bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      {/* Date filters */}
      <div className="flex flex-wrap items-end gap-4">
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-700">From Date</label>
          <input
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            className="rounded border border-gray-300 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-700">To Date</label>
          <input
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            className="rounded border border-gray-300 px-3 py-2 text-sm"
          />
        </div>
        <button
          onClick={fetchData}
          className="rounded bg-gray-600 px-4 py-2 text-sm text-white hover:bg-gray-700"
        >
          Apply Filter
        </button>
        {(fromDate || toDate) && (
          <button
            onClick={() => {
              setFromDate("");
              setToDate("");
              fetchData();
            }}
            className="rounded border border-gray-300 px-4 py-2 text-sm hover:bg-gray-50"
          >
            Clear
          </button>
        )}
      </div>

      {/* Overall Stats */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="rounded-lg bg-blue-50 p-4">
          <div className="text-xs font-medium uppercase text-gray-600">Variant A</div>
          <div className="mt-2 text-2xl font-bold">
            {(data.overall.A_ctr * 100).toFixed(2)}%
          </div>
          <div className="mt-1 text-xs text-gray-600">
            {data.overall.A.clicks} / {data.overall.A.views} clicks
          </div>
        </div>
        <div className="rounded-lg bg-purple-50 p-4">
          <div className="text-xs font-medium uppercase text-gray-600">Variant B</div>
          <div className="mt-2 text-2xl font-bold">
            {(data.overall.B_ctr * 100).toFixed(2)}%
          </div>
          <div className="mt-1 text-xs text-gray-600">
            {data.overall.B.clicks} / {data.overall.B.views} clicks
          </div>
        </div>
        <div className="rounded-lg bg-green-50 p-4">
          <div className="text-xs font-medium uppercase text-gray-600">Winner</div>
          <div className="mt-2 text-2xl font-bold">{winner}</div>
          <div className="mt-1 text-xs text-gray-600">{data.overall.days} days</div>
        </div>
      </div>

      {/* Chart */}
      {data.series.length > 0 ? (
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <h3 className="mb-4 text-sm font-semibold">Daily CTR Trends</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={data.series}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="day" fontSize={12} />
              <YAxis
                tickFormatter={(val) => `${(val * 100).toFixed(0)}%`}
                fontSize={12}
              />
              <Tooltip
                formatter={(value: number) => `${(value * 100).toFixed(2)}%`}
                labelStyle={{ color: "#000" }}
              />
              <Legend />
              <Line
                type="monotone"
                dataKey="A_ctr"
                stroke="#3b82f6"
                name="Variant A CTR"
                strokeWidth={2}
              />
              <Line
                type="monotone"
                dataKey="B_ctr"
                stroke="#a855f7"
                name="Variant B CTR"
                strokeWidth={2}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="rounded-lg border border-gray-200 bg-white p-8 text-center text-sm text-gray-500">
          No data in selected date range
        </div>
      )}
    </div>
  );
};
