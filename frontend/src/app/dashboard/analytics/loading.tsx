import { Skeleton } from "@/components/ui/skeleton";

export default function AnalyticsLoading() {
  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <Skeleton className="h-8 w-40" />
        <div className="flex gap-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-8 w-14 rounded-lg" />
          ))}
        </div>
      </div>

      {/* Top metric cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="rounded-xl p-4 space-y-2"
            style={{
              background: "var(--color-card)",
              border: "1px solid var(--color-line)",
            }}
          >
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-7 w-28" />
            <Skeleton className="h-3 w-16" />
          </div>
        ))}
      </div>

      {/* Multi-line chart */}
      <div
        className="rounded-xl p-5 space-y-4"
        style={{
          background: "var(--color-card)",
          border: "1px solid var(--color-line)",
        }}
      >
        <div className="flex items-center justify-between">
          <Skeleton className="h-5 w-40" />
          <div className="flex gap-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-5 w-20 rounded-full" />
            ))}
          </div>
        </div>
        <Skeleton className="h-64 w-full rounded-lg" />
      </div>

      {/* Bottom row: risk gauge + allocation + monthly returns */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Risk gauge */}
        <div
          className="rounded-xl p-5 space-y-4"
          style={{
            background: "var(--color-card)",
            border: "1px solid var(--color-line)",
          }}
        >
          <Skeleton className="h-5 w-24" />
          <Skeleton className="h-32 w-32 rounded-full mx-auto" />
          <Skeleton className="h-4 w-36 mx-auto" />
        </div>

        {/* Allocation donut */}
        <div
          className="rounded-xl p-5 space-y-4"
          style={{
            background: "var(--color-card)",
            border: "1px solid var(--color-line)",
          }}
        >
          <Skeleton className="h-5 w-28" />
          <Skeleton className="h-36 w-36 rounded-full mx-auto" />
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-center gap-2">
                <Skeleton className="h-3 w-3 rounded-sm" />
                <Skeleton className="h-3 flex-1" />
              </div>
            ))}
          </div>
        </div>

        {/* Monthly returns bar chart */}
        <div
          className="rounded-xl p-5 space-y-4"
          style={{
            background: "var(--color-card)",
            border: "1px solid var(--color-line)",
          }}
        >
          <Skeleton className="h-5 w-32" />
          <div className="flex items-end gap-2 h-36">
            {Array.from({ length: 12 }).map((_, i) => (
              <Skeleton
                key={i}
                className="flex-1 rounded-sm"
                style={{ height: `${30 + Math.random() * 70}%` }}
              />
            ))}
          </div>
          <div className="flex justify-between">
            {["J", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"].map((m, i) => (
              <Skeleton key={i} className="h-3 w-3" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
