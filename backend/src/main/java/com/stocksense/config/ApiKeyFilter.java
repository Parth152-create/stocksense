package com.stocksense.config;

import com.stocksense.model.User;
import com.stocksense.service.ApiKeyService;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;

/**
 * ApiKeyFilter
 *
 * Intercepts requests to /api/v1/** and authenticates them via X-API-Key header.
 * Runs BEFORE JwtAuthFilter so API key requests bypass JWT checks.
 *
 * Rate limiting (in-memory, per key):
 *   - 60 requests per minute per API key
 *   - Returns 429 with Retry-After header when exceeded
 *   - Resets every 60 seconds
 *
 * Note: For production with multiple backend instances, move rate limit
 * state to Redis using INCR + EXPIRE commands.
 */
@Component
public class ApiKeyFilter extends OncePerRequestFilter {

    private static final Logger log = LoggerFactory.getLogger(ApiKeyFilter.class);

    private static final String API_KEY_HEADER  = "X-API-Key";
    private static final String API_V1_PREFIX   = "/api/v1/";
    private static final int    RATE_LIMIT_RPM  = 60;    // requests per minute
    private static final long   WINDOW_MS       = 60_000L;

    private final ApiKeyService apiKeyService;

    // Simple in-memory rate limiter: keyHash → [count, windowStartMs]
    private final Map<String, long[]> rateLimitMap = new ConcurrentHashMap<>();

    public ApiKeyFilter(ApiKeyService apiKeyService) {
        this.apiKeyService = apiKeyService;
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        // Only intercept /api/v1/** routes
        return !request.getRequestURI().startsWith(API_V1_PREFIX);
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain filterChain)
            throws ServletException, IOException {

        String rawKey = request.getHeader(API_KEY_HEADER);

        if (rawKey == null || rawKey.isBlank()) {
            writeError(response, 401, "missing_api_key",
                "Provide your API key in the X-API-Key header");
            return;
        }

        // Validate key
        Optional<User> userOpt = apiKeyService.validateKey(rawKey);
        if (userOpt.isEmpty()) {
            writeError(response, 401, "invalid_api_key",
                "The API key is invalid or has been revoked");
            return;
        }

        User user = userOpt.get();

        // Rate limit check
        if (isRateLimited(rawKey)) {
            response.setHeader("Retry-After", "60");
            response.setHeader("X-RateLimit-Limit",     String.valueOf(RATE_LIMIT_RPM));
            response.setHeader("X-RateLimit-Remaining", "0");
            writeError(response, 429, "rate_limit_exceeded",
                "Rate limit exceeded — " + RATE_LIMIT_RPM + " requests/min. Retry after 60 seconds.");
            return;
        }

        // Set rate limit headers
        long remaining = getRemainingRequests(rawKey);
        response.setHeader("X-RateLimit-Limit",     String.valueOf(RATE_LIMIT_RPM));
        response.setHeader("X-RateLimit-Remaining", String.valueOf(remaining));
        response.setHeader("X-RateLimit-Reset",     String.valueOf(getWindowResetMs(rawKey)));

        // Authenticate — set email as principal (matches @AuthenticationPrincipal String email pattern)
        UsernamePasswordAuthenticationToken auth = new UsernamePasswordAuthenticationToken(
            user.getEmail(),
            null,
            List.of(new SimpleGrantedAuthority("ROLE_API"))
        );
        SecurityContextHolder.getContext().setAuthentication(auth);

        log.debug("[ApiKey] Authenticated user {} via API key", user.getEmail());
        filterChain.doFilter(request, response);
    }

    // ── Rate limiter ──────────────────────────────────────────────────────────

    private boolean isRateLimited(String rawKey) {
        String mapKey = rawKey.substring(0, Math.min(20, rawKey.length())); // use prefix as map key
        long   now    = System.currentTimeMillis();

        long[] state = rateLimitMap.compute(mapKey, (k, v) -> {
            if (v == null || now - v[1] >= WINDOW_MS) {
                return new long[]{ 1, now };          // new window
            }
            v[0]++;
            return v;
        });

        return state[0] > RATE_LIMIT_RPM;
    }

    private long getRemainingRequests(String rawKey) {
        String mapKey = rawKey.substring(0, Math.min(20, rawKey.length()));
        long[] state  = rateLimitMap.get(mapKey);
        if (state == null) return RATE_LIMIT_RPM;
        return Math.max(0, RATE_LIMIT_RPM - state[0]);
    }

    private long getWindowResetMs(String rawKey) {
        String mapKey = rawKey.substring(0, Math.min(20, rawKey.length()));
        long[] state  = rateLimitMap.get(mapKey);
        if (state == null) return System.currentTimeMillis() + WINDOW_MS;
        return state[1] + WINDOW_MS;
    }

    // ── Helper ────────────────────────────────────────────────────────────────

    private void writeError(HttpServletResponse response, int status,
                            String code, String message) throws IOException {
        response.setStatus(status);
        response.setContentType("application/json");
        response.getWriter().write(String.format(
            "{\"error\":\"%s\",\"message\":\"%s\",\"status\":%d}",
            code, message, status
        ));
    }
}