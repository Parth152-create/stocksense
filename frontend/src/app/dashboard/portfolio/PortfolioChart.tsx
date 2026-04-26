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

  // 🔥 generate smooth trend based on real value
  const data = [
    { time: "9:30", value: currentValue * 0.85 },
    { time: "10:00", value: currentValue * 0.88 },
    { time: "11:00", value: currentValue * 0.92 },
    { time: "12:00", value: currentValue * 0.95 },
    { time: "13:00", value: currentValue * 0.97 },
    { time: "14:00", value: currentValue * 1.01 },
    { time: "15:00", value: currentValue * 1.03 },
    { time: "16:00", value: currentValue },
  ];

  return (
    <div className="bg-surface-card p-6 rounded-2xl border border-border">

      <h3 className="text-lg mb-4">Price Trend</h3>

      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={data}>

          <XAxis dataKey="time" stroke="#888" />
          <YAxis stroke="#888" />

          <Tooltip
            contentStyle={{
              backgroundColor: "#222226",
              border: "1px solid #333338",
              borderRadius: "8px",
            }}
          />

          <Line
            type="monotone"
            dataKey="value"
            stroke="#8FFFD6"
            strokeWidth={2}
            dot={false}
          />

        </LineChart>
      </ResponsiveContainer>

    </div>
  );
}