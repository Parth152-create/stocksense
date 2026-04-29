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
    public void register(User user) {
        if (user.getEmail() == null || user.getPassword() == null) {
            throw new RuntimeException("Email and password are required");
        }

        if (userRepository.findByEmail(user.getEmail()).isPresent()) {
            throw new RuntimeException("Email already in use");
        }

        // 1. Hash password + timestamp
        user.setPassword(passwordEncoder.encode(user.getPassword()));
        user.setCreatedAt(LocalDateTime.now());

        // 2. Save user first so the ID exists
        User savedUser = userRepository.save(user);

        // 3. Create portfolio row linked to this user
        Portfolio portfolio = new Portfolio();
        portfolio.setId(UUID.randomUUID());
        portfolio.setUserId(savedUser.getId());
        Portfolio savedPortfolio = portfolioRepository.save(portfolio);

        // 4. Write portfolioId back onto the user so /api/users/me returns it
        savedUser.setPortfolioId(savedPortfolio.getId());
        userRepository.save(savedUser);
    }

    public User login(String email, String password) {
        if (email == null || password == null) {
            throw new RuntimeException("Email or password missing");
        }

        Optional<User> userOpt = userRepository.findByEmail(email);
        if (userOpt.isEmpty()) {
            throw new RuntimeException("User not found");
        }

        User user = userOpt.get();
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
}