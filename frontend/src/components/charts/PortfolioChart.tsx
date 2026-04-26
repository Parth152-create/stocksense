"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

type Props = {
  currentValue: number;
};

export default function PortfolioChart({ currentValue }: Props) {

  const data = [
    { day: "Mon", value: currentValue * 0.75 },
    { day: "Tue", value: currentValue * 0.8 },
    { day: "Wed", value: currentValue * 0.85 },
    { day: "Thu", value: currentValue * 0.92 },
    { day: "Fri", value: currentValue },
  ];

  return (
    <div className="bg-surface-card p-6 rounded-2xl border border-border mt-10">
      <h3 className="mb-4 text-lg">Portfolio Trend</h3>

      <ResponsiveContainer width="100%" height={250}>
        <LineChart data={data}>
          <XAxis dataKey="day" stroke="#888" />
          <YAxis stroke="#888" />
          <Tooltip />
          <Line
            type="monotone"
            dataKey="value"
            stroke="#8FFFD6"
            strokeWidth={2}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}