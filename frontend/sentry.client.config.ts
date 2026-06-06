import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Capture 10% of transactions for performance monitoring (free tier friendly)
  tracesSampleRate: 0.1,

  // Replay 1% of sessions, 100% of sessions with errors
  replaysSessionSampleRate: 0.01,
  replaysOnErrorSampleRate: 1.0,

  // Only enable in production
  enabled: process.env.NODE_ENV === "production",

  integrations: [
    Sentry.replayIntegration({
      maskAllText:   true,
      blockAllMedia: true,
    }),
  ],

  // Don't send these noisy errors
  ignoreErrors: [
    "ResizeObserver loop limit exceeded",
    "ResizeObserver loop completed with undelivered notifications",
    "Non-Error promise rejection captured",
    "Network request failed",
    "Failed to fetch",
    "Load failed",
  ],

  beforeSend(event) {
    // Strip auth tokens from breadcrumbs
    if (event.breadcrumbs) {
      event.breadcrumbs = event.breadcrumbs.map((breadcrumb) => {
        const breadcrumbUrl = breadcrumb.data?.url;

        if (typeof breadcrumbUrl === "string" && breadcrumbUrl.includes("/api/")) {
          const url = new URL(breadcrumbUrl, "https://x");
          url.searchParams.delete("token");
          return {
            ...breadcrumb,
            data: {
              ...breadcrumb.data,
              url: url.toString(),
            },
          };
        }

        return breadcrumb;
      });
    }
    return event;
  },
});
