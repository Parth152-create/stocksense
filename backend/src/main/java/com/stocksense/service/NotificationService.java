package com.stocksense.service;

import com.stocksense.model.Notification;
import com.stocksense.model.User;
import com.stocksense.repository.NotificationRepository;
import com.stocksense.repository.UserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
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

    public List<Notification> getForUser(String email) {
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new RuntimeException("User not found"));

        List<Notification> notifications =
                notificationRepository.findByUserIdOrderByCreatedAtDesc(user.getId());

        // Seed demo notifications if none exist yet
        if (notifications.isEmpty()) {
            seedDemoNotifications(user.getId());
            notifications = notificationRepository.findByUserIdOrderByCreatedAtDesc(user.getId());
        }

        return notifications;
    }

    public long getUnreadCount(String email) {
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new RuntimeException("User not found"));
        return notificationRepository.countByUserIdAndReadFalse(user.getId());
    }

    @Transactional
    public void markRead(UUID notificationId) {
        notificationRepository.findById(notificationId).ifPresent(n -> {
            n.setRead(true);
            notificationRepository.save(n);
        });
    }

    @Transactional
    public void markAllRead(String email) {
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new RuntimeException("User not found"));
        List<Notification> unread =
                notificationRepository.findByUserIdOrderByCreatedAtDesc(user.getId())
                        .stream().filter(n -> !n.isRead()).toList();
        unread.forEach(n -> n.setRead(true));
        notificationRepository.saveAll(unread);
    }

    // ── Demo seeder ───────────────────────────────────────────────────────────

    private void seedDemoNotifications(UUID userId) {
        Object[][] seeds = {
            { Notification.Type.PRICE_ALERT,  "AAPL hit your target",
              "Apple crossed $195 — your price alert triggered.", "AAPL", false, -2 },
            { Notification.Type.ORDER_FILLED, "Order filled: TSLA",
              "Your buy order for 5 shares of Tesla was filled at $242.10.", "TSLA", false, -15 },
            { Notification.Type.EARNINGS,     "NVDA earnings tomorrow",
              "NVIDIA reports Q2 earnings after market close tomorrow.", "NVDA", false, -60 },
            { Notification.Type.ANOMALY,      "Unusual volume: AMD",
              "AMD is trading 3.2× its average volume. Possible catalyst.", "AMD", true, -120 },
            { Notification.Type.PRICE_ALERT,  "Portfolio up 4.2%",
              "Your portfolio gained $3,920 today — best day this month.", null, true, -180 },
        };

        for (Object[] s : seeds) {
            Notification n = new Notification();
            n.setUserId(userId);
            n.setType((Notification.Type) s[0]);
            n.setTitle((String) s[1]);
            n.setMessage((String) s[2]);
            n.setSymbol((String) s[3]);
            n.setRead((boolean) s[4]);
            n.setCreatedAt(LocalDateTime.now().plusMinutes((int) s[5]));
            notificationRepository.save(n);
        }
    }
}