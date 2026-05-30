
package com.stocksense.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.*;

/**
 * BenchmarkService
 *
 * Fetches weekly adjusted close prices from Alpha Vantage for benchmark
 * indices and normalizes them alongside portfolio history to base 10,000.
 *
 * Index mapping:
 *   US     → SPY   (S&P 500 ETF)
 *   IN     → INFY  (best AV proxy for Indian market)
 *   CRYPTO → ETH   (Ethereum as crypto benchmark via standard equity endpoint)
 *   default → SPY
 *
 * Injects @Value("${alphavantage.api.key}") directly — same property
 * AlphaVantageService uses — so no changes to that class needed.
 */
@Service
public class BenchmarkService {

    private static final Logger log = LoggerFactory.getLogger(BenchmarkService.class);
    private static final String BASE = "https://www.alphavantage.co/query";

    @Value("${alphavantage.api.key:demo}")
    private String apiKey;

    private final RestTemplate restTemplate = new RestTemplate();

    // ── Index selection ───────────────────────────────────────────────────────

    public String benchmarkTickerFor(String market) {
        if (market == null) return "SPY";
        return switch (market.toUpperCase()) {
            case "IN"     -> "INFY";
            case "CRYPTO" -> "COIN";   // Coinbase — crypto proxy on AV
            default       -> "SPY";
        };
    }

    public String benchmarkLabelFor(String market) {
        if (market == null) return "S&P 500";
        return switch (market.toUpperCase()) {
            case "IN"     -> "Nifty 50 (proxy)";
            case "CRYPTO" -> "Crypto Index (proxy)";
            default       -> "S&P 500";
        };
    }

    // ── Main public API ───────────────────────────────────────────────────────

    public List<Map<String, Object>> getBenchmarkComparison(
            List<Map<String, Object>> portfolioHistory,
            String market,
            String range) {

        if (portfolioHistory == null || portfolioHistory.isEmpty()) {
            return Collections.emptyList();
        }

        String ticker = benchmarkTickerFor(market);
        String label  = benchmarkLabelFor(market);

        log.info("[Benchmark] Fetching {} for market={} range={}", ticker, market, range);

        List<Double> closes  = fetchWeeklyAdjustedCloses(ticker, range);
        List<Double> sampled = closes.isEmpty() ? Collections.emptyList()
                                                : sampleToSize(closes, portfolioHistory.size());

        double portBase  = findFirstNonZero(portfolioHistory);
        double benchBase = findFirstNonZeroInList(sampled);

        log.info("[Benchmark] portBase={} benchBase={} benchPoints={}", portBase, benchBase, sampled.size());

        List<Map<String, Object>> result = new ArrayList<>();

        for (int i = 0; i < portfolioHistory.size(); i++) {
            Map<String, Object> ph  = portfolioHistory.get(i);
            double portRaw  = getDouble(ph.get("value"));

            double portNorm = (portBase > 0 && portRaw > 0)
                    ? Math.round((portRaw / portBase) * 10_000.0 * 100.0) / 100.0
                    : (portRaw > 0 ? 10_000.0 : 0.0);

            Double benchNorm = null;
            if (!sampled.isEmpty() && i < sampled.size() && benchBase > 0) {
                benchNorm = Math.round((sampled.get(i) / benchBase) * 10_000.0 * 100.0) / 100.0;
            }

            Map<String, Object> row = new LinkedHashMap<>();
            row.put("date",           ph.get("date"));
            row.put("portfolio",      portNorm);
            row.put("portfolioRaw",   Math.round(portRaw * 100.0) / 100.0);
            row.put("benchmark",      benchNorm);
            row.put("benchmarkLabel", label);
            result.add(row);
        }

        return result;
    }

    // ── Alpha Vantage TIME_SERIES_WEEKLY_ADJUSTED ─────────────────────────────

    @SuppressWarnings("unchecked")
    private List<Double> fetchWeeklyAdjustedCloses(String ticker, String range) {
        try {
            LocalDate cutoff = switch (range) {
                case "1M"  -> LocalDate.now().minusMonths(1);
                case "1Y"  -> LocalDate.now().minusYears(1);
                default    -> LocalDate.now().minusYears(5);
            };

            String url = BASE + "?function=TIME_SERIES_WEEKLY_ADJUSTED"
                    + "&symbol=" + ticker
                    + "&apikey=" + apiKey;

            log.debug("[Benchmark] GET {}", url);

            Map<String, Object> response = restTemplate.getForObject(url, Map.class);
            if (response == null) {
                log.warn("[Benchmark] Null response for {}", ticker);
                return Collections.emptyList();
            }

            // Key is "Weekly Adjusted Time Series"
            Map<String, Object> timeSeries = null;
            for (String key : response.keySet()) {
                if (key.toLowerCase().contains("weekly")) {
                    timeSeries = (Map<String, Object>) response.get(key);
                    break;
                }
            }

            if (timeSeries == null || timeSeries.isEmpty()) {
                log.warn("[Benchmark] No weekly series for {} — keys: {}", ticker, response.keySet());
                return Collections.emptyList();
            }

            DateTimeFormatter fmt = DateTimeFormatter.ofPattern("yyyy-MM-dd");

            // Sort ascending, filter by cutoff
            List<String> dates = new ArrayList<>(timeSeries.keySet());
            dates.sort(Comparator.naturalOrder());

            List<Double> closes = new ArrayList<>();
            for (String dateStr : dates) {
                try {
                    if (LocalDate.parse(dateStr, fmt).isBefore(cutoff)) continue;
                    Map<String, Object> bar = (Map<String, Object>) timeSeries.get(dateStr);
                    // "5. adjusted close"
                    String val = null;
                    for (String k : bar.keySet()) {
                        if (k.contains("adjusted close")) { val = String.valueOf(bar.get(k)); break; }
                    }
                    if (val == null) {
                        for (String k : bar.keySet()) {
                            if (k.contains("close")) { val = String.valueOf(bar.get(k)); break; }
                        }
                    }
                    if (val != null) closes.add(Double.parseDouble(val));
                } catch (Exception ignored) {}
            }

            log.info("[Benchmark] {} closes extracted for {} (cutoff={})", closes.size(), ticker, cutoff);
            return closes;

        } catch (Exception e) {
            log.warn("[Benchmark] fetchWeeklyAdjustedCloses failed for {}: {}", ticker, e.getMessage());
            return Collections.emptyList();
        }
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private List<Double> sampleToSize(List<Double> prices, int targetSize) {
        if (prices.size() == targetSize) return prices;
        List<Double> result = new ArrayList<>(targetSize);
        double step = (double)(prices.size() - 1) / Math.max(targetSize - 1, 1);
        for (int i = 0; i < targetSize; i++) {
            int idx = Math.min((int) Math.round(i * step), prices.size() - 1);
            result.add(prices.get(idx));
        }
        return result;
    }

    private double findFirstNonZero(List<Map<String, Object>> history) {
        for (Map<String, Object> p : history) {
            double v = getDouble(p.get("value"));
            if (v > 0) return v;
        }
        return 0;
    }

    private double findFirstNonZeroInList(List<Double> list) {
        for (Double d : list) { if (d != null && d > 0) return d; }
        return 0;
    }

    private double getDouble(Object o) {
        return o instanceof Number ? ((Number) o).doubleValue() : 0;
    }
}
