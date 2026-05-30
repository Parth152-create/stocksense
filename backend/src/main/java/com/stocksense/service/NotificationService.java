package com.stocksense.service;

import com.stocksense.model.Notification;
import com.stocksense.model.User;
import com.stocksense.repository.NotificationRepository;
import com.stocksense.repository.UserRepository;
import jakarta.transaction.Transactional;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.UUID;

@Service
public class NotificationService {

    private static final Logger log = LoggerFactory.getLogger(NotificationService.class);

    private final NotificationRepository notificationRepository;
    private final UserRepository         userRepository;

    public NotificationService(NotificationRepository notificationRepository,
                                UserRepository userRepository) {
        this.notificationRepository = notificationRepository;
        this.userRepository         = userRepository;
    }

    // ─── Read ─────────────────────────────────────────────────────────────────

    public List<Notification> getForUser(String email) {
        UUID userId = resolveUserId(email);
        return notificationRepository.findByUserIdOrderByCreatedAtDesc(userId);
    }

    public List<Notification> getUnreadForUser(String email) {
        UUID userId = resolveUserId(email);
        return notificationRepository.findByUserIdAndReadFalseOrderByCreatedAtDesc(userId);
    }

    public long getUnreadCount(String email) {
        UUID userId = resolveUserId(email);
        return notificationRepository.countByUserIdAndReadFalse(userId);
    }

    // ─── Write ────────────────────────────────────────────────────────────────

    @Transactional
    public void markRead(UUID notificationId) {
        notificationRepository.findById(notificationId).ifPresent(n -> {
            n.setRead(true);
            notificationRepository.save(n);
        });
    }

    @Transactional
    public void markAllRead(String email) {
        UUID userId = resolveUserId(email);
        notificationRepository.markAllReadByUserId(userId);
    }

    // ─── Create — called internally by services ───────────────────────────────

    /**
     * Persists a new in-app notification for a user.
     * Called by OrderExecutionService, PriceAlertScheduler, etc.
     *
     * @param userId  target user's UUID
     * @param type    Notification.Type enum value
     * @param title   short headline shown in the notification row
     * @param message longer detail line shown below the title
     * @param symbol  optional stock ticker (nullable)
     */
    @Transactional
    public Notification createNotification(UUID userId,
                                           Notification.Type type,
                                           String title,
                                           String message,
                                           String symbol) {
        Notification n = new Notification(userId, type, title, message, symbol);
        Notification saved = notificationRepository.save(n);
        log.info("[Notification] Created {} for userId={} — {}", type, userId, title);
        return saved;
    }

    /**
     * Convenience overload — looks up userId by email.
     */
    @Transactional
    public Notification createNotification(String email,
                                           Notification.Type type,
                                           String title,
                                           String message,
                                           String symbol) {
        UUID userId = resolveUserId(email);
        return createNotification(userId, type, title, message, symbol);
    }

    // ─── Internal ─────────────────────────────────────────────────────────────

    private UUID resolveUserId(String email) {
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new RuntimeException("User not found: " + email));
        return user.getId();
    }
}