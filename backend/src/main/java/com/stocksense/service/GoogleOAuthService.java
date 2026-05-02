package com.stocksense.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.util.Map;

/**
 * Verifies a Google ID token by calling Google's tokeninfo endpoint.
 * No extra dependency needed — uses the RestTemplate already configured.
 *
 * Flow:
 *   Frontend  →  Google Sign-In JS  →  gets idToken (JWT)
 *   Frontend  →  POST /api/auth/google { idToken }
 *   Backend   →  GET https://oauth2.googleapis.com/tokeninfo?id_token=<idToken>
 *   Google    →  { email, name, aud, ... }
 *   Backend   →  verifies aud == our clientId, returns our JWT
 */
@Service
public class GoogleOAuthService {

    @Value("${google.client-id}")
    private String clientId;

    private final RestTemplate restTemplate;

    public GoogleOAuthService(RestTemplate restTemplate) {
        this.restTemplate = restTemplate;
    }

    @SuppressWarnings("unchecked")
    public GoogleUserInfo verify(String idToken) {
        String url = "https://oauth2.googleapis.com/tokeninfo?id_token=" + idToken;

        Map<String, Object> payload;
        try {
            payload = restTemplate.getForObject(url, Map.class);
        } catch (Exception e) {
            throw new RuntimeException("Failed to verify token with Google: " + e.getMessage());
        }

        if (payload == null) {
            throw new RuntimeException("Empty response from Google tokeninfo");
        }

        // Validate audience matches our client ID
        String aud = (String) payload.get("aud");
        if (!clientId.equals(aud)) {
            throw new RuntimeException("Token audience mismatch — possible token spoofing");
        }

        String email = (String) payload.get("email");
        String name  = (String) payload.getOrDefault("name", email);

        if (email == null) {
            throw new RuntimeException("Google token does not contain email");
        }

        return new GoogleUserInfo(email, name);
    }

    public record GoogleUserInfo(String email, String name) {}
}