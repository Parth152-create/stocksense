import { Skeleton } from "@/components/ui/skeleton";

export default function WatchlistLoading() {
  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <Skeleton className="h-8 w-36" />
        <div className="flex gap-2">
          <Skeleton className="h-9 w-32" />
          <Skeleton className="h-9 w-24" />
        </div>
      </div>

      {/* Search / filter bar */}
      <div className="flex gap-3">
        <Skeleton className="h-10 flex-1 max-w-xs" />
        <Skeleton className="h-10 w-24" />
      </div>

      {/* Watchlist cards grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
        {Array.from({ length: 9 }).map((_, i) => (
          <div
            key={i}
            className="rounded-xl p-4 space-y-3"
            style={{
              background: "var(--color-card)",
              border: "1px solid var(--color-line)",
            }}
          >
            {/* Symbol row */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Skeleton className="h-9 w-9 rounded-lg" />
                <div className="space-y-1">
                  <Skeleton className="h-4 w-14" />
                  <Skeleton className="h-3 w-28" />
                </div>
              </div>
              <Skeleton className="h-6 w-6 rounded-md" />
            </div>

            {/* Sparkline */}
            <Skeleton className="h-16 w-full rounded-lg" />

            {/* Price row */}
            <div className="flex items-center justify-between">
              <Skeleton className="h-6 w-20" />
              <Skeleton className="h-5 w-16 rounded-full" />
            </div>

            {/* Alert badge */}
            <Skeleton className="h-7 w-full rounded-md" />
          </div>
        ))}
      </div>
    </div>
  );
}