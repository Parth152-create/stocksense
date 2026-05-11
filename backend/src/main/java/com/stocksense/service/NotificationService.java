package com.stocksense.service;

import com.stocksense.model.Notification;
import com.stocksense.model.User;
import com.stocksense.repository.NotificationRepository;
import com.stocksense.repository.UserRepository;
import jakarta.transaction.Transactional;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.UUID;

@Service
public class NotificationService {

    private final NotificationRepository notificationRepository;
    private final UserRepository userRepository;

    public NotificationService(NotificationRepository notificationRepository,
                                UserRepository userRepository) {
        this.notificationRepository = notificationRepository;
        this.userRepository = userRepository;
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

    // ─── Internal ─────────────────────────────────────────────────────────────

    private UUID resolveUserId(String email) {
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new RuntimeException("User not found: " + email));
        return user.getId();
    }
}