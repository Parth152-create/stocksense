import { Skeleton } from "@/components/ui/skeleton";

export default function InsightsLoading() {
  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <Skeleton className="h-8 w-36" />
          <Skeleton className="h-4 w-56" />
        </div>
        <Skeleton className="h-5 w-32 rounded-full" />
      </div>

      {/* ML signal cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="rounded-xl p-4 space-y-3"
            style={{
              background: "var(--color-card)",
              border: "1px solid var(--color-line)",
            }}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Skeleton className="h-8 w-8 rounded-lg" />
                <Skeleton className="h-4 w-14" />
              </div>
              <Skeleton className="h-6 w-16 rounded-full" />
            </div>
            <div className="space-y-1">
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-4/5" />
            </div>
            <div className="flex items-center gap-2">
              <Skeleton className="h-2 flex-1 rounded-full" />
              <Skeleton className="h-3 w-8" />
            </div>
          </div>
        ))}
      </div>

      {/* Bottom row: radar + sector rotation + sentiment bars */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Radar chart */}
        <div
          className="rounded-xl p-5 space-y-4"
          style={{
            background: "var(--color-card)",
            border: "1px solid var(--color-line)",
          }}
        >
          <Skeleton className="h-5 w-36" />
          <Skeleton className="h-52 w-52 rounded-full mx-auto" />
        </div>

        {/* Sector rotation */}
        <div
          className="rounded-xl p-5 space-y-3"
          style={{
            background: "var(--color-card)",
            border: "1px solid var(--color-line)",
          }}
        >
          <Skeleton className="h-5 w-32" />
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="space-y-1">
              <div className="flex justify-between">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-3 w-10" />
              </div>
              <Skeleton className="h-2 w-full rounded-full" />
            </div>
          ))}
        </div>

        {/* Sentiment bars */}
        <div
          className="rounded-xl p-5 space-y-3"
          style={{
            background: "var(--color-card)",
            border: "1px solid var(--color-line)",
          }}
        >
          <Skeleton className="h-5 w-28" />
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-6 flex-1 rounded-md" />
              <Skeleton className="h-3 w-8" />
            </div>
          ))}
          <Skeleton className="h-px w-full mt-2" />
          <Skeleton className="h-16 w-full rounded-lg" />
        </div>
      </div>
    </div>
  );
}