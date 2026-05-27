package com.stocksense.service;

import com.stocksense.model.Portfolio;
import com.stocksense.model.User;
import com.stocksense.repository.*;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Service
public class UserService {

    private final UserRepository              userRepository;
    private final PortfolioRepository         portfolioRepository;
    private final BCryptPasswordEncoder       passwordEncoder;

    private final HoldingRepository           holdingRepository;
    private final OrderRepository             orderRepository;
    private final WatchlistRepository         watchlistRepository;
    private final NotificationRepository      notificationRepository;
    private final WalletBalanceRepository     walletBalanceRepository;
    private final WalletTransactionRepository walletTransactionRepository;
    private final RefreshTokenRepository      refreshTokenRepository;

    public UserService(UserRepository userRepository,
                       PortfolioRepository portfolioRepository,
                       BCryptPasswordEncoder passwordEncoder,
                       HoldingRepository holdingRepository,
                       OrderRepository orderRepository,
                       WatchlistRepository watchlistRepository,
                       NotificationRepository notificationRepository,
                       WalletBalanceRepository walletBalanceRepository,
                       WalletTransactionRepository walletTransactionRepository,
                       RefreshTokenRepository refreshTokenRepository) {
        this.userRepository              = userRepository;
        this.portfolioRepository         = portfolioRepository;
        this.passwordEncoder             = passwordEncoder;
        this.holdingRepository           = holdingRepository;
        this.orderRepository             = orderRepository;
        this.watchlistRepository         = watchlistRepository;
        this.notificationRepository      = notificationRepository;
        this.walletBalanceRepository     = walletBalanceRepository;
        this.walletTransactionRepository = walletTransactionRepository;
        this.refreshTokenRepository      = refreshTokenRepository;
    }

    // ── register ──────────────────────────────────────────────────────────────
    @Transactional
    public User register(User user) {
        if (user.getEmail() == null || user.getPassword() == null)
            throw new RuntimeException("Email and password are required");
        if (userRepository.findByEmail(user.getEmail()).isPresent())
            throw new RuntimeException("Email already in use");

        user.setPassword(passwordEncoder.encode(user.getPassword()));
        user.setCreatedAt(LocalDateTime.now());
        user.setProvider("local");

        User savedUser = userRepository.save(user);

        Portfolio portfolio = new Portfolio();
        portfolio.setId(UUID.randomUUID());
        portfolio.setUserId(savedUser.getId());
        Portfolio savedPortfolio = portfolioRepository.save(portfolio);

        savedUser.setPortfolioId(savedPortfolio.getId());
        return userRepository.save(savedUser);
    }

    // ── login ─────────────────────────────────────────────────────────────────
    public User login(String email, String password) {
        if (email == null || password == null)
            throw new RuntimeException("Email or password missing");

        User user = userRepository.findByEmail(email)
            .orElseThrow(() -> new RuntimeException("User not found"));

        if ("google".equals(user.getProvider()))
            throw new RuntimeException("Please login using Google");

        if (!passwordEncoder.matches(password, user.getPassword()))
            throw new RuntimeException("Invalid password");

        return user;
    }

    // ── getUserByEmail ────────────────────────────────────────────────────────
    public User getUserByEmail(String email) {
        return userRepository.findByEmail(email)
            .orElseThrow(() -> new RuntimeException("User not found"));
    }

    // ── getAllUsers ───────────────────────────────────────────────────────────
    public List<User> getAllUsers() {
        return userRepository.findAll();
    }

    // ── findOrCreateGoogleUser ────────────────────────────────────────────────
    @Transactional
    public User findOrCreateGoogleUser(String email, String name) {
        Optional<User> existing = userRepository.findByEmail(email);
        if (existing.isPresent()) return existing.get();

        User user = new User();
        user.setEmail(email);
        user.setName(name);
        user.setPassword("");
        user.setProvider("google");
        user.setCreatedAt(LocalDateTime.now());

        User savedUser = userRepository.save(user);

        Portfolio portfolio = new Portfolio();
        portfolio.setId(UUID.randomUUID());
        portfolio.setUserId(savedUser.getId());
        Portfolio savedPortfolio = portfolioRepository.save(portfolio);

        savedUser.setPortfolioId(savedPortfolio.getId());
        return userRepository.save(savedUser);
    }

    // ── deleteUser — full cascade delete ─────────────────────────────────────
    //
    // Delete order:
    //   1. refresh_tokens
    //   2. notifications
    //   3. wallet_transactions
    //   4. wallet_balances
    //   5. watchlist_items
    //   6. orders
    //   7. holdings (via portfolioId)
    //   8. portfolio
    //   9. user
    // ─────────────────────────────────────────────────────────────────────────
    @Transactional
    public void deleteUser(User user) {
        UUID   userId    = user.getId();
        String userIdStr = userId.toString();

        // 1. Refresh tokens
        refreshTokenRepository.deleteByUserId(userId);

        // 2. Notifications
        notificationRepository.deleteByUserId(userId);

        // 3. Wallet transactions
        walletTransactionRepository.deleteByUserId(userId);

        // 4. Wallet balance
        walletBalanceRepository.deleteByUserId(userId);

        // 5. Watchlist
        watchlistRepository.deleteByUserId(userId);

        // 6. Orders — Order.userId is String
        orderRepository.deleteByUserId(userIdStr);

        // 7. Holdings — Holding has no userId, linked via portfolioId
        if (user.getPortfolioId() != null) {
            holdingRepository.deleteByPortfolioId(user.getPortfolioId());
        }

        // 8. Portfolio
        if (user.getPortfolioId() != null) {
            portfolioRepository.deleteById(user.getPortfolioId());
        }

        // 9. User — last
        userRepository.delete(user);
    }
}