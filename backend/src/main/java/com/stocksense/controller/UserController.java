package com.stocksense.controller;

import com.stocksense.dto.LoginRequestDTO;
import com.stocksense.dto.LoginResponseDTO;
import com.stocksense.dto.UserResponseDTO;
import com.stocksense.model.User;
import com.stocksense.service.JwtService;
import com.stocksense.service.UserService;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/users")
public class UserController {

    private final UserService userService;
    private final JwtService jwtService;

    public UserController(UserService userService, JwtService jwtService) {
        this.userService = userService;
        this.jwtService = jwtService;
    }

    // 🔐 REGISTER
    @PostMapping
    public UserResponseDTO createUser(@RequestBody User user) {
        User saved = userService.createUser(user);

        return new UserResponseDTO(
                saved.getId(),
                saved.getEmail(),
                saved.getProvider(),
                saved.getCreatedAt()
        );
    }

    // 📄 GET USERS
    @GetMapping
    public List<UserResponseDTO> getUsers() {
        return userService.getAllUsers()
                .stream()
                .map(user -> new UserResponseDTO(
                        user.getId(),
                        user.getEmail(),
                        user.getProvider(),
                        user.getCreatedAt()
                ))
                .collect(Collectors.toList());
    }

    // 🔑 LOGIN → RETURNS JWT TOKEN
    @PostMapping("/login")
    public LoginResponseDTO login(@RequestBody LoginRequestDTO request) {
        User user = userService.login(request);

        String token = jwtService.generateToken(user.getEmail());

        return new LoginResponseDTO(token);
    }
}