import { Skeleton } from "@/components/ui/skeleton";

export default function WalletLoading() {
  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-9 w-36" />
      </div>

      {/* Balance hero card */}
      <div
        className="rounded-xl p-6 space-y-4"
        style={{
          background: "var(--color-card)",
          border: "1px solid var(--color-line)",
        }}
      >
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-12 w-48" />
        <div className="flex gap-3">
          <Skeleton className="h-9 w-28 rounded-lg" />
          <Skeleton className="h-9 w-28 rounded-lg" />
        </div>
      </div>

      {/* Bank accounts grid */}
      <div>
        <Skeleton className="h-5 w-32 mb-3" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="rounded-xl p-4 space-y-3"
              style={{
                background: "var(--color-card)",
                border: "1px solid var(--color-line)",
              }}
            >
              <div className="flex items-center gap-3">
                <Skeleton className="h-10 w-10 rounded-xl" />
                <div className="space-y-1 flex-1">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-24" />
                </div>
              </div>
              <Skeleton className="h-6 w-28" />
              <Skeleton className="h-7 w-full rounded-md" />
            </div>
          ))}
        </div>
      </div>

      {/* Funding history chart */}
      <div
        className="rounded-xl p-5 space-y-4"
        style={{
          background: "var(--color-card)",
          border: "1px solid var(--color-line)",
        }}
      >
        <div className="flex items-center justify-between">
          <Skeleton className="h-5 w-36" />
          <Skeleton className="h-8 w-24 rounded-lg" />
        </div>
        <Skeleton className="h-48 w-full rounded-lg" />
      </div>

      {/* Transactions table */}
      <div
        className="rounded-xl overflow-hidden"
        style={{
          background: "var(--color-card)",
          border: "1px solid var(--color-line)",
        }}
      >
        <div className="p-4 border-b" style={{ borderColor: "var(--color-line)" }}>
          <Skeleton className="h-5 w-32" />
        </div>
        <div className="divide-y" style={{ borderColor: "var(--color-line)" }}>
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="flex items-center justify-between px-4 py-3">
              <div className="flex items-center gap-3">
                <Skeleton className="h-9 w-9 rounded-full" />
                <div className="space-y-1">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-24" />
                </div>
              </div>
              <div className="text-right space-y-1">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-5 w-16 rounded-full" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}