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

    private final JwtAuthFilter         jwtAuthFilter;
    private final ApiKeyFilter          apiKeyFilter;
    private final AuthRateLimitFilter   authRateLimitFilter;

    public SecurityConfig(JwtAuthFilter jwtAuthFilter,
                          ApiKeyFilter apiKeyFilter,
                          AuthRateLimitFilter authRateLimitFilter) {
        this.jwtAuthFilter       = jwtAuthFilter;
        this.apiKeyFilter        = apiKeyFilter;
        this.authRateLimitFilter = authRateLimitFilter;
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
                .requestMatchers(HttpMethod.GET, "/api/watchlist/shared/**").permitAll()
                .requestMatchers(HttpMethod.POST, "/api/payments/stripe/webhook").permitAll()
                .requestMatchers("/api/v1/**").authenticated()
                .requestMatchers("/api/payments/**").authenticated()
                .anyRequest().authenticated()
            )
            .addFilterBefore(authRateLimitFilter, UsernamePasswordAuthenticationFilter.class)
            .addFilterBefore(apiKeyFilter,        UsernamePasswordAuthenticationFilter.class)
            .addFilterBefore(jwtAuthFilter,       UsernamePasswordAuthenticationFilter.class);

        return http.build();
    }

    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration config = new CorsConfiguration();
        config.setAllowedOrigins(List.of(
            "http://localhost:3000",
            "http://localhost:8081",
             "https://stocksense-ivory.vercel.app"
        ));
        config.setAllowedMethods(List.of("GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"));
        config.setAllowedHeaders(List.of(
            "Authorization", "Content-Type", "Accept", "Origin",
            "X-Requested-With", "Access-Control-Request-Method",
            "Access-Control-Request-Headers", "Stripe-Signature", "X-API-Key"
        ));
        config.setExposedHeaders(List.of(
            "Authorization", "X-RateLimit-Limit",
            "X-RateLimit-Remaining", "X-RateLimit-Reset", "Retry-After"
        ));
        config.setAllowCredentials(true);
        config.setMaxAge(3600L);

        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", config);
        return source;
    }
}
