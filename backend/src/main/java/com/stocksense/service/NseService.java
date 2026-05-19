package com.stocksense.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Fetches real-time prices from NSE India's public API.
 * No API key required — NSE provides this publicly.
 *
 * Endpoint: https://www.nseindia.com/api/quote-equity?symbol=RELIANCE
 *
 * NSE requires browser-like headers and a session cookie.
 * We maintain a session by first hitting the main page, then the API.
 *
 * Cache: 15s TTL per symbol to avoid hammering NSE.
 */
@Service
public class NseService {

    private static final Logger log = LoggerFactory.getLogger(NseService.class);

    private static final String NSE_HOME = "https://www.nseindia.com";
    private static final String NSE_API  = "https://www.nseindia.com/api/quote-equity?symbol=";
    private static final long   CACHE_TTL_MS = 15_000L;

    private final ObjectMapper mapper = new ObjectMapper();
    private final HttpClient   client;

    // Cookie store — NSE requires a session cookie
    private volatile String sessionCookie = "";
    private volatile long   cookieExpiry  = 0L;

    // Price cache — symbol → { price, changePct, expiresAt }
    private record CachedPrice(double price, double changePct, long expiresAt) {
        boolean isAlive() { return System.currentTimeMillis() < expiresAt; }
    }
    private final Map<String, CachedPrice> priceCache = new ConcurrentHashMap<>();

    public NseService() {
        this.client = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(8))
            .followRedirects(HttpClient.Redirect.NORMAL)
            .build();
    }

    // ── Public API ────────────────────────────────────────────────────────────

    /**
     * Returns { price, changePct } for an NSE symbol.
     * Returns null if the fetch fails (caller should fall back to mock).
     */
    public double[] getPrice(String symbol) {
        // Strip exchange suffix
        String clean = symbol.replace(".BSE", "")
                             .replace(".NSE", "")
                             .toUpperCase()
                             .trim();

        // Check cache
        CachedPrice cached = priceCache.get(clean);
        if (cached != null && cached.isAlive()) {
            log.debug("[NSE] Cache hit: {} → {}", clean, cached.price());
            return new double[]{ cached.price(), cached.changePct() };
        }

        // Refresh session cookie if needed
        ensureSession();

        try {
            HttpRequest req = HttpRequest.newBuilder()
                .uri(URI.create(NSE_API + clean))
                .timeout(Duration.ofSeconds(8))
                .header("User-Agent",      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36")
                .header("Accept",          "application/json, text/plain, */*")
                .header("Accept-Language", "en-US,en;q=0.9")
                .header("Referer",         "https://www.nseindia.com/get-quotes/equity?symbol=" + clean)
                .header("Cookie",          sessionCookie)
                .build();

            HttpResponse<String> resp = client.send(req, HttpResponse.BodyHandlers.ofString());

            if (resp.statusCode() != 200) {
                log.warn("[NSE] HTTP {} for {}", resp.statusCode(), clean);
                // Session may have expired — refresh on next call
                cookieExpiry = 0;
                return null;
            }

            double[] result = parseNseResponse(resp.body());
            if (result != null) {
                priceCache.put(clean, new CachedPrice(result[0], result[1],
                    System.currentTimeMillis() + CACHE_TTL_MS));
                log.info("[NSE] {} → price={} changePct={}", clean, result[0], result[1]);
            }
            return result;

        } catch (Exception e) {
            log.warn("[NSE] Failed to fetch {}: {}", clean, e.getMessage());
            return null;
        }
    }

    // ── Session management ────────────────────────────────────────────────────

    private synchronized void ensureSession() {
        if (System.currentTimeMillis() < cookieExpiry) return;

        log.info("[NSE] Refreshing session cookie…");
        try {
            HttpRequest req = HttpRequest.newBuilder()
                .uri(URI.create(NSE_HOME))
                .timeout(Duration.ofSeconds(10))
                .header("User-Agent",      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36")
                .header("Accept",          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8")
                .header("Accept-Language", "en-US,en;q=0.9")
                .build();

            HttpResponse<String> resp = client.send(req, HttpResponse.BodyHandlers.ofString());

            // Extract Set-Cookie headers
            StringBuilder cookies = new StringBuilder();
            resp.headers().allValues("Set-Cookie").forEach(c -> {
                String cookiePart = c.split(";")[0];
                if (cookies.length() > 0) cookies.append("; ");
                cookies.append(cookiePart);
            });

            if (cookies.length() > 0) {
                sessionCookie = cookies.toString();
                cookieExpiry  = System.currentTimeMillis() + 300_000L; // 5 min
                log.info("[NSE] Session cookie refreshed.");
            } else {
                log.warn("[NSE] No cookies received from NSE home page.");
            }

        } catch (Exception e) {
            log.warn("[NSE] Failed to refresh session: {}", e.getMessage());
        }
    }

    // ── Response parser ───────────────────────────────────────────────────────

    @SuppressWarnings("unchecked")
    private double[] parseNseResponse(String body) {
        try {
            Map<String, Object> root = mapper.readValue(body, Map.class);

            // NSE response structure:
            // { "priceInfo": { "lastPrice": 2940.50, "change": 12.3,
            //                  "pChange": 0.42, "previousClose": 2928.2 } }
            Map<String, Object> priceInfo = (Map<String, Object>) root.get("priceInfo");
            if (priceInfo == null) return null;

            double price     = toDouble(priceInfo.get("lastPrice"));
            double changePct = toDouble(priceInfo.get("pChange"));

            if (price <= 0) return null;
            return new double[]{ price, changePct };

        } catch (Exception e) {
            log.warn("[NSE] Failed to parse response: {}", e.getMessage());
            return null;
        }
    }

    private double toDouble(Object val) {
        if (val == null) return 0.0;
        try { return Double.parseDouble(val.toString()); }
        catch (Exception e) { return 0.0; }
    }
}