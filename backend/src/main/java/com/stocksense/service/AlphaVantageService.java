package com.stocksense.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.*;

@Service
public class AlphaVantageService {

    @Value("${alphavantage.api.key:HXW27CL9C8V78EXL}")
    private String apiKey;

    private final RestTemplate restTemplate = new RestTemplate();
    private final ObjectMapper mapper = new ObjectMapper();
    private static final String BASE = "https://www.alphavantage.co/query";

    @Cacheable(value = "stockQuote", key = "#symbol")
    public Map<String, Object> getQuote(String symbol) {
        try {
            String url = BASE + "?function=GLOBAL_QUOTE&symbol=" + symbol + "&apikey=" + apiKey;
            String json = restTemplate.getForObject(url, String.class);
            JsonNode root = mapper.readTree(json);
            JsonNode q = root.path("Global Quote");
            Map<String, Object> result = new LinkedHashMap<>();
            result.put("symbol",           q.path("01. symbol").asText(symbol));
            result.put("price",            parseDouble(q.path("05. price").asText("0")));
            result.put("open",             parseDouble(q.path("02. open").asText("0")));
            result.put("high",             parseDouble(q.path("03. high").asText("0")));
            result.put("low",              parseDouble(q.path("04. low").asText("0")));
            result.put("previousClose",    parseDouble(q.path("08. previous close").asText("0")));
            result.put("change",           parseDouble(q.path("09. change").asText("0")));
            result.put("changePercent",    parseDoublePercent(q.path("10. change percent").asText("0%")));
            result.put("volume",           parseLong(q.path("06. volume").asText("0")));
            result.put("latestTradingDay", q.path("07. latest trading day").asText(""));
            result.put("analystBuy",  65);
            result.put("analystHold", 25);
            result.put("analystSell", 10);
            return result;
        } catch (Exception e) {
            return mockQuote(symbol);
        }
    }

    @Cacheable(value = "stockHistory", key = "#symbol")
    public Map<String, Object> getDailyHistory(String symbol) {
        try {
            String url = BASE + "?function=TIME_SERIES_DAILY&symbol=" + symbol
                    + "&outputsize=compact&apikey=" + apiKey;
            String json = restTemplate.getForObject(url, String.class);
            JsonNode root = mapper.readTree(json);
            JsonNode series = root.path("Time Series (Daily)");
            List<Map<String, Object>> candles = new ArrayList<>();
            Iterator<Map.Entry<String, JsonNode>> it = series.fields();
            while (it.hasNext()) {
                Map.Entry<String, JsonNode> entry = it.next();
                JsonNode v = entry.getValue();
                Map<String, Object> c = new LinkedHashMap<>();
                c.put("date",   entry.getKey());
                c.put("open",   parseDouble(v.path("1. open").asText("0")));
                c.put("high",   parseDouble(v.path("2. high").asText("0")));
                c.put("low",    parseDouble(v.path("3. low").asText("0")));
                c.put("close",  parseDouble(v.path("4. close").asText("0")));
                c.put("volume", parseLong(v.path("5. volume").asText("0")));
                candles.add(c);
            }
            Collections.reverse(candles);
            return Map.of("symbol", symbol, "candles", candles);
        } catch (Exception e) {
            return Map.of("symbol", symbol, "candles", mockCandles());
        }
    }

    // ── Search — debug version ────────────────────────────────────────────────

    public List<Map<String, Object>> search(String query) {
        try {
            String encoded = URLEncoder.encode(query, StandardCharsets.UTF_8);
            String url = BASE + "?function=SYMBOL_SEARCH&keywords=" + encoded + "&apikey=" + apiKey;

            System.out.println("=== SEARCH DEBUG ===");
            System.out.println("Query   : " + query);
            System.out.println("API Key : " + apiKey);
            System.out.println("URL     : " + url);

            String json = restTemplate.getForObject(url, String.class);
            System.out.println("Response: " + json);
            System.out.println("====================");

            JsonNode root = mapper.readTree(json);

            if (root.has("Note") || root.has("Information")) {
                System.out.println("RATE LIMITED by Alpha Vantage");
                return List.of();
            }

            JsonNode matches = root.path("bestMatches");
            List<Map<String, Object>> results = new ArrayList<>();
            for (JsonNode m : matches) {
                Map<String, Object> item = new LinkedHashMap<>();
                item.put("symbol",   m.path("1. symbol").asText());
                item.put("name",     m.path("2. name").asText());
                item.put("type",     m.path("3. type").asText());
                item.put("region",   m.path("4. region").asText());
                item.put("currency", m.path("8. currency").asText());
                results.add(item);
            }

            System.out.println("Results : " + results.size());
            return results;

        } catch (Exception e) {
            System.out.println("SEARCH EXCEPTION: " + e.getClass().getName() + " — " + e.getMessage());
            e.printStackTrace();
            return List.of();
        }
    }

    @Cacheable(value = "batchQuotes", key = "#symbols.toString()")
    public List<Map<String, Object>> getBatchQuotes(List<String> symbols) {
        List<Map<String, Object>> results = new ArrayList<>();
        for (String symbol : symbols) {
            results.add(getQuote(symbol));
            try { Thread.sleep(200); } catch (InterruptedException ignored) {}
        }
        return results;
    }

    private double parseDouble(String s) {
        try { return Double.parseDouble(s.trim()); } catch (Exception e) { return 0.0; }
    }

    private double parseDoublePercent(String s) {
        try { return Double.parseDouble(s.replace("%", "").trim()); } catch (Exception e) { return 0.0; }
    }

    private long parseLong(String s) {
        try { return Long.parseLong(s.trim()); } catch (Exception e) { return 0L; }
    }

    private Map<String, Object> mockQuote(String symbol) {
        double price = 100 + (Math.abs(symbol.hashCode()) % 900);
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("symbol",          symbol);
        result.put("price",           price);
        result.put("open",            price - 2);
        result.put("high",            price + 5);
        result.put("low",             price - 8);
        result.put("previousClose",   price - 1.5);
        result.put("change",          1.5);
        result.put("changePercent",   1.5);
        result.put("volume",          1000000L);
        result.put("latestTradingDay","2025-04-30");
        result.put("analystBuy",      65);
        result.put("analystHold",     25);
        result.put("analystSell",     10);
        return result;
    }

    private List<Map<String, Object>> mockCandles() {
        List<Map<String, Object>> candles = new ArrayList<>();
        double base = 2700;
        for (int i = 30; i >= 0; i--) {
            double open  = base + (Math.random() - 0.5) * 60;
            double close = open + (Math.random() - 0.48) * 50;
            double high  = Math.max(open, close) + Math.random() * 30;
            double low   = Math.min(open, close) - Math.random() * 30;
            candles.add(Map.of(
                "date",   "2025-" + String.format("%02d", (i % 12) + 1) + "-01",
                "open",   Math.round(open  * 100) / 100.0,
                "high",   Math.round(high  * 100) / 100.0,
                "low",    Math.round(low   * 100) / 100.0,
                "close",  Math.round(close * 100) / 100.0,
                "volume", (long)(Math.random() * 5000000 + 1000000)
            ));
            base = close;
        }
        return candles;
    }
}