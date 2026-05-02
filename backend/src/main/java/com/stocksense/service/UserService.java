package com.stocksense.service;

import com.stocksense.model.Portfolio;
import com.stocksense.model.User;
import com.stocksense.repository.PortfolioRepository;
import com.stocksense.repository.UserRepository;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Service
public class UserService {

    private final UserRepository userRepository;
    private final PortfolioRepository portfolioRepository;
    private final BCryptPasswordEncoder passwordEncoder;

    public UserService(UserRepository userRepository,
                       PortfolioRepository portfolioRepository,
                       BCryptPasswordEncoder passwordEncoder) {
        this.userRepository = userRepository;
        this.portfolioRepository = portfolioRepository;
        this.passwordEncoder = passwordEncoder;
    }

    @Transactional
    public User register(User user) {
        if (user.getEmail() == null || user.getPassword() == null) {
            throw new RuntimeException("Email and password are required");
        }

        if (userRepository.findByEmail(user.getEmail()).isPresent()) {
            throw new RuntimeException("Email already in use");
        }

        // Hash password + timestamp
        user.setPassword(passwordEncoder.encode(user.getPassword()));
        user.setCreatedAt(LocalDateTime.now());
        user.setProvider("local"); // ✅ important for distinguishing login types

        // Save user
        User savedUser = userRepository.save(user);

        // Create portfolio
        Portfolio portfolio = new Portfolio();
        portfolio.setId(UUID.randomUUID());
        portfolio.setUserId(savedUser.getId());

        Portfolio savedPortfolio = portfolioRepository.save(portfolio);

        // Link portfolio to user
        savedUser.setPortfolioId(savedPortfolio.getId());

        return userRepository.save(savedUser); // ✅ return user instead of void
    }

    public User login(String email, String password) {
        if (email == null || password == null) {
            throw new RuntimeException("Email or password missing");
        }

        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new RuntimeException("User not found"));

        // ❗ Prevent Google users from logging in via password
        if ("google".equals(user.getProvider())) {
            throw new RuntimeException("Please login using Google");
        }

        if (!passwordEncoder.matches(password, user.getPassword())) {
            throw new RuntimeException("Invalid password");
        }

        return user;
    }

    public User getUserByEmail(String email) {
        return userRepository.findByEmail(email)
                .orElseThrow(() -> new RuntimeException("User not found"));
    }

    public List<User> getAllUsers() {
        return userRepository.findAll();
    }

    @Transactional
    public User findOrCreateGoogleUser(String email, String name) {

        Optional<User> existing = userRepository.findByEmail(email);
        if (existing.isPresent()) {
            return existing.get();
        }

        // Create new Google user
        User user = new User();
        user.setEmail(email);
        user.setName(name);
        user.setPassword(""); // no password
        user.setProvider("google");
        user.setCreatedAt(LocalDateTime.now());

        User savedUser = userRepository.save(user);

        // Create portfolio
        Portfolio portfolio = new Portfolio();
        portfolio.setId(UUID.randomUUID());
        portfolio.setUserId(savedUser.getId());

        Portfolio savedPortfolio = portfolioRepository.save(portfolio);

        // Link portfolio
        savedUser.setPortfolioId(savedPortfolio.getId());

        return userRepository.save(savedUser); // ✅ FIXED (was returning wrong object earlier)
    }
}