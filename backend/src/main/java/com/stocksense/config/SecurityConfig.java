package com.stocksense.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import java.util.List;

@Configuration
@EnableWebSecurity
public class SecurityConfig {

    private final JwtAuthFilter   jwtAuthFilter;
    private final ApiKeyFilter    apiKeyFilter;

    public SecurityConfig(JwtAuthFilter jwtAuthFilter, ApiKeyFilter apiKeyFilter) {
        this.jwtAuthFilter = jwtAuthFilter;
        this.apiKeyFilter  = apiKeyFilter;
    }

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        http
            .cors(cors -> cors.configurationSource(corsConfigurationSource()))
            .csrf(csrf -> csrf.disable())
            .sessionManagement(sm -> sm.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
            .authorizeHttpRequests(auth -> auth
                .requestMatchers("/api/auth/**").permitAll()
                .requestMatchers("/api/stocks/search").permitAll()
                .requestMatchers(HttpMethod.GET, "/api/stocks/**").permitAll()
                .requestMatchers(HttpMethod.GET, "/api/market/**").permitAll()
                .requestMatchers("/ws/**").permitAll()
                // Public shared watchlist — no auth needed
                .requestMatchers(HttpMethod.GET, "/api/watchlist/shared/**").permitAll()
                // Stripe webhook — verified by signature
                .requestMatchers(HttpMethod.POST, "/api/payments/stripe/webhook").permitAll()
                // API v1 routes — authenticated via ApiKeyFilter (runs before this)
                .requestMatchers("/api/v1/**").authenticated()
                // All payment endpoints require JWT
                .requestMatchers("/api/payments/**").authenticated()
                .anyRequest().authenticated()
            )
            // ApiKeyFilter runs first — handles /api/v1/** before JWT filter sees it
            .addFilterBefore(apiKeyFilter,  UsernamePasswordAuthenticationFilter.class)
            .addFilterBefore(jwtAuthFilter, UsernamePasswordAuthenticationFilter.class);

        return http.build();
    }

    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration config = new CorsConfiguration();
        config.setAllowedOrigins(List.of(
            "http://localhost:3000",
            "http://localhost:8081"
        ));
        config.setAllowedMethods(List.of("GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"));
        config.setAllowedHeaders(List.of(
            "Authorization",
            "Content-Type",
            "Accept",
            "Origin",
            "X-Requested-With",
            "Access-Control-Request-Method",
            "Access-Control-Request-Headers",
            "Stripe-Signature",
            "X-API-Key"          // allow API key header through CORS
        ));
        config.setExposedHeaders(List.of(
            "Authorization",
            "X-RateLimit-Limit",
            "X-RateLimit-Remaining",
            "X-RateLimit-Reset",
            "Retry-After"
        ));
        config.setAllowCredentials(true);
        config.setMaxAge(3600L);

        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", config);
        return source;
    }
}