package com.stocksense.controller;

import com.stocksense.dto.LoginRequestDTO;
import com.stocksense.dto.LoginResponseDTO;
import com.stocksense.model.User;
import com.stocksense.service.JwtService;
import com.stocksense.service.UserService;
import org.springframework.http.ResponseEntity;
import com.stocksense.dto.UserResponseDTO;
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

    @PostMapping("/register")
    public ResponseEntity<String> register(@RequestBody User user) {
        userService.register(user);
        return ResponseEntity.ok("User registered successfully");
    }

    @PostMapping("/login")
    public ResponseEntity<LoginResponseDTO> login(@RequestBody LoginRequestDTO request) {
        User user = userService.login(request.getEmail(), request.getPassword());
        String token = jwtService.generateToken(user.getEmail());
        return ResponseEntity.ok(new LoginResponseDTO(token));
    }

   @GetMapping("/me")
public ResponseEntity<?> getCurrentUser(@RequestHeader("Authorization") String authHeader) {
    if (authHeader == null || !authHeader.startsWith("Bearer ")) {
        return ResponseEntity.status(401).body("Missing or invalid token");
    }

    String token = authHeader.substring(7);
    String email = jwtService.extractEmail(token);
    User user = userService.getUserByEmail(email);

    UserResponseDTO response = new UserResponseDTO(
            user.getId(),
            user.getEmail(),
            user.getProvider(),
            user.getCreatedAt(),
            user.getPortfolioId()
    );

    return ResponseEntity.ok(response);
}
}