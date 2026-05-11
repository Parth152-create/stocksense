package com.stocksense.controller;

import com.stocksense.dto.UserResponseDTO;
import com.stocksense.model.User;
import com.stocksense.service.JwtService;
import com.stocksense.service.UserService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/users")
public class UserController {

    private final UserService userService;
    private final JwtService jwtService;

    public UserController(UserService userService, JwtService jwtService) {
        this.userService = userService;
        this.jwtService = jwtService;
    }

    /**
     * GET /api/users/me
     * Called by the dashboard layout sidebar to show the logged-in user's info.
     * JWT is already validated by JwtAuthFilter — we just read the email claim.
     */
    @GetMapping("/me")
    public ResponseEntity<UserResponseDTO> getCurrentUser(
            @RequestHeader("Authorization") String authHeader) {

        if (authHeader == null || !authHeader.startsWith("Bearer ")) {
            return ResponseEntity.status(401).build();
        }

        String token = authHeader.substring(7);
        String email = jwtService.extractEmail(token);
        User user = userService.getUserByEmail(email);

        UserResponseDTO response = new UserResponseDTO(
                user.getId(),
                user.getEmail(),
                user.getName(),       // ← now included
                user.getProvider(),
                user.getCreatedAt(),
                user.getPortfolioId()
        );

        return ResponseEntity.ok(response);
    }
}