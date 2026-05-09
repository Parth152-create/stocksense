import { Skeleton } from "@/components/ui/skeleton";

export default function PortfolioLoading() {
  return (
    <div className="p-6 space-y-6">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-9 w-28" />
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="rounded-xl p-5 space-y-3"
            style={{
              background: "var(--color-card)",
              border: "1px solid var(--color-line)",
            }}
          >
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-7 w-32" />
            <Skeleton className="h-3 w-20" />
          </div>
        ))}
      </div>

      {/* Donut + allocation side-by-side */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div
          className="lg:col-span-1 rounded-xl p-5 flex flex-col items-center gap-4"
          style={{
            background: "var(--color-card)",
            border: "1px solid var(--color-line)",
          }}
        >
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-48 w-48 rounded-full" />
          <div className="w-full space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-center gap-2">
                <Skeleton className="h-3 w-3 rounded-sm" />
                <Skeleton className="h-3 flex-1" />
                <Skeleton className="h-3 w-10" />
              </div>
            ))}
          </div>
        </div>

        <div
          className="lg:col-span-2 rounded-xl p-5 space-y-4"
          style={{
            background: "var(--color-card)",
            border: "1px solid var(--color-line)",
          }}
        >
          <Skeleton className="h-5 w-28" />
          <Skeleton className="h-48 w-full" />
        </div>
      </div>

      {/* Holdings table */}
      <div
        className="rounded-xl overflow-hidden"
        style={{
          background: "var(--color-card)",
          border: "1px solid var(--color-line)",
        }}
      >
        <div className="p-4 border-b" style={{ borderColor: "var(--color-line)" }}>
          <Skeleton className="h-5 w-28" />
        </div>
        <div className="divide-y" style={{ borderColor: "var(--color-line)" }}>
          {/* Table header */}
          <div className="grid grid-cols-8 gap-4 px-4 py-3">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-3 w-full" />
            ))}
          </div>
          {/* Table rows */}
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="grid grid-cols-8 gap-4 px-4 py-4 items-center">
              <div className="flex items-center gap-2 col-span-2">
                <Skeleton className="h-8 w-8 rounded-lg" />
                <div className="space-y-1">
                  <Skeleton className="h-4 w-16" />
                  <Skeleton className="h-3 w-24" />
                </div>
              </div>
              {Array.from({ length: 6 }).map((_, j) => (
                <Skeleton key={j} className="h-4 w-full" />
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}