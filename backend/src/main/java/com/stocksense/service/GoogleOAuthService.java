package com.stocksense.service;

import com.google.api.client.googleapis.auth.oauth2.GoogleIdToken;
import com.google.api.client.googleapis.auth.oauth2.GoogleIdTokenVerifier;
import com.google.api.client.http.javanet.NetHttpTransport;
import com.google.api.client.json.gson.GsonFactory;
import com.stocksense.model.User;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.util.Collections;

/**
 * Verifies a Google ID token (credential) from the frontend and returns/creates
 * the matching StockSense user.
 *
 * Dependency (add to pom.xml):
 * <dependency>
 *   <groupId>com.google.api-client</groupId>
 *   <artifactId>google-api-client</artifactId>
 *   <version>2.2.0</version>
 * </dependency>
 */
@Service
public class GoogleOAuthService {

    private final UserService userService;

    @Value("${google.client-id}")
    private String clientId;

    public GoogleOAuthService(UserService userService) {
        this.userService = userService;
    }

    /**
     * Verifies the Google ID token and returns the corresponding User.
     * Creates the user (via findOrCreateGoogleUser) if this is their first login.
     *
     * @param credential  The raw ID token string sent from the frontend
     * @return            The StockSense User for this Google account
     * @throws IllegalArgumentException  if the token is invalid or expired
     */
    public User verifyAndGetUser(String credential) {
        GoogleIdToken idToken = verify(credential);
        GoogleIdToken.Payload payload = idToken.getPayload();

        String email  = payload.getEmail();
        String name   = (String) payload.get("name");
        return userService.findOrCreateGoogleUser(email, name);
    }

    // ─── Private ──────────────────────────────────────────────────────────────

    private GoogleIdToken verify(String credential) {
        try {
            GoogleIdTokenVerifier verifier = new GoogleIdTokenVerifier.Builder(
                    new NetHttpTransport(), GsonFactory.getDefaultInstance())
                    .setAudience(Collections.singletonList(clientId))
                    .build();

            GoogleIdToken idToken = verifier.verify(credential);
            if (idToken == null) {
                throw new IllegalArgumentException("Invalid or expired Google token");
            }
            return idToken;
        } catch (IllegalArgumentException e) {
            throw e;
        } catch (Exception e) {
            throw new RuntimeException("Google token verification failed: " + e.getMessage(), e);
        }
    }
}
