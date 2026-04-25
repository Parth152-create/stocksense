package com.stocksense.service;

import com.stocksense.dto.LoginRequestDTO;
import com.stocksense.model.User;
import com.stocksense.repository.UserRepository;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Service
public class UserService {

    private final UserRepository userRepository;
    private final BCryptPasswordEncoder passwordEncoder;

    public UserService(UserRepository userRepository,
                       BCryptPasswordEncoder passwordEncoder) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
    }

    // 🔐 REGISTER
    public User createUser(User user) {
        user.setPassword(passwordEncoder.encode(user.getPassword()));
        user.setCreatedAt(LocalDateTime.now());
        return userRepository.save(user);
    }

    // 📄 GET USERS
    public List<User> getAllUsers() {
        return userRepository.findAll();
    }

    // 🔑 LOGIN (SAFE VERSION)
    public User login(LoginRequestDTO request) {

        if (request.getEmail() == null || request.getPassword() == null) {
            throw new RuntimeException("Email or password missing");
        }

        Optional<User> userOpt = userRepository.findByEmail(request.getEmail());

        if (userOpt.isEmpty()) {
            throw new RuntimeException("User not found");
        }

        User user = userOpt.get();

        if (user.getPassword() == null) {
            throw new RuntimeException("Password not set");
        }

        if (!passwordEncoder.matches(request.getPassword(), user.getPassword())) {
            throw new RuntimeException("Invalid password");
        }

        return user;
    }
}