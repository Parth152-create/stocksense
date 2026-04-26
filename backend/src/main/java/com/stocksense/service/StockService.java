package com.stocksense.service;

import com.stocksense.dto.StockResponseDTO;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.util.Map;

@Service
public class StockService {

    private final RestTemplate restTemplate;

    private static final String API_KEY = "YOUR_API_KEY"; // 🔥 replace

    public StockService(RestTemplate restTemplate) {
        this.restTemplate = restTemplate;
    }

    public StockResponseDTO getStock(String symbol) {

        String url = "https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol="
                + symbol + "&apikey=" + API_KEY;

        try {
            Map<String, Object> response = restTemplate.getForObject(url, Map.class);

            Map<String, String> quote =
                    (Map<String, String>) response.get("Global Quote");

            if (quote == null || quote.isEmpty()) {
                throw new RuntimeException("No data from Alpha Vantage");
            }

            double price = Double.parseDouble(quote.get("05. price"));
            double change = Double.parseDouble(quote.get("09. change"));
            double changePercent = Double.parseDouble(
                    quote.get("10. change percent").replace("%", "")
            );

            return new StockResponseDTO(symbol, price, change, changePercent);

        } catch (Exception e) {
            e.printStackTrace();
            return new StockResponseDTO(symbol, 0.0, 0.0, 0.0);
        }
    }
}