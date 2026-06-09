package com.stocksense.config;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * AuthRateLimitFilter
 *
 * Rate limits /api/auth/login and /api/auth/register to 10 requests
 * per IP per minute. Returns 429 with Retry-After header on breach.
 *
 * Runs before JwtAuthFilter and ApiKeyFilter.
 */
@Component
public class AuthRateLimitFilter extends OncePerRequestFilter {

    private static final Logger log = LoggerFactory.getLogger(AuthRateLimitFilter.class);

    private static final int  MAX_ATTEMPTS = 10;
    private static final long WINDOW_MS    = 60_000L;

    // IP → [count, windowStartMs]
    private final Map<String, long[]> rateLimitMap = new ConcurrentHashMap<>();

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        String uri = request.getRequestURI();
        return !uri.equals("/api/auth/login") && !uri.equals("/api/auth/register");
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain filterChain)
            throws ServletException, IOException {

        String ip  = getClientIp(request);
        long   now = System.currentTimeMillis();

        long[] state = rateLimitMap.compute(ip, (k, v) -> {
            if (v == null || now - v[1] >= WINDOW_MS) return new long[]{ 1, now };
            v[0]++;
            return v;
        });

        long remaining = Math.max(0, MAX_ATTEMPTS - state[0]);
        long resetMs   = state[1] + WINDOW_MS;

        response.setHeader("X-RateLimit-Limit",     String.valueOf(MAX_ATTEMPTS));
        response.setHeader("X-RateLimit-Remaining", String.valueOf(remaining));
        response.setHeader("X-RateLimit-Reset",     String.valueOf(resetMs));

        if (state[0] > MAX_ATTEMPTS) {
            long retryAfterSec = Math.max(1, (resetMs - now) / 1000);
            response.setHeader("Retry-After", String.valueOf(retryAfterSec));
            response.setStatus(429);
            response.setContentType("application/json");
            response.getWriter().write(String.format(
                "{\"error\":\"rate_limit_exceeded\",\"message\":\"Too many attempts — retry after %ds\",\"status\":429}",
                retryAfterSec
            ));
            log.warn("[AuthRateLimit] IP {} blocked on {}", ip, request.getRequestURI());
            return;
        }

        filterChain.doFilter(request, response);
    }

    private String getClientIp(HttpServletRequest request) {
        String forwarded = request.getHeader("X-Forwarded-For");
        if (forwarded != null && !forwarded.isBlank()) {
            return forwarded.split(",")[0].trim();
        }
        return request.getRemoteAddr();
    }
}
