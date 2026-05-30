package com.stocksense.service;

import com.stocksense.model.User;
import com.stocksense.repository.UserRepository;
import jakarta.mail.MessagingException;
import jakarta.mail.internet.MimeMessage;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Map;

/**
 * DigestService
 *
 * Sends a weekly portfolio summary email to every user who has
 * prefMentMessages = true.
 *
 * Schedule: every Monday at 08:00 UTC (cron = "0 0 8 * * MON")
 * Manual trigger: POST /api/digest/send-now  (DigestController)
 *
 * Email includes:
 *   - Portfolio value + total P&L
 *   - Realized vs unrealized P&L split
 *   - Best + worst performer
 *   - Number of open positions
 *   - CTA button → dashboard
 */
@Service
public class DigestService {

    private static final Logger log = LoggerFactory.getLogger(DigestService.class);

    private final UserRepository    userRepository;
    private final PortfolioService  portfolioService;
    private final JavaMailSender    mailSender;

    public DigestService(UserRepository userRepository,
                         PortfolioService portfolioService,
                         JavaMailSender mailSender) {
        this.userRepository   = userRepository;
        this.portfolioService = portfolioService;
        this.mailSender       = mailSender;
    }

    // ── Scheduled job — every Monday 08:00 UTC ────────────────────────────────

    @Scheduled(cron = "0 0 8 * * MON", zone = "UTC")
    public void sendWeeklyDigests() {
        log.info("[Digest] Starting weekly digest run");
        List<User> users = userRepository.findAll();

        int sent   = 0;
        int skipped = 0;
        int errors  = 0;

        for (User user : users) {
            if (!user.isPrefMentMessages()) {
                skipped++;
                continue;
            }
            if (user.getEmail() == null || user.getEmail().isBlank()) {
                skipped++;
                continue;
            }
            try {
                sendDigestForUser(user);
                sent++;
            } catch (Exception e) {
                errors++;
                log.error("[Digest] Failed for user {}: {}", user.getEmail(), e.getMessage());
            }
        }

        log.info("[Digest] Weekly run complete — sent={} skipped={} errors={}", sent, skipped, errors);
    }

    // ── Manual trigger (called by DigestController) ───────────────────────────

    /**
     * Sends digest to a single user immediately.
     * Used by POST /api/digest/send-now for testing.
     */
    public void sendDigestForUser(User user) throws MessagingException {
        Map<String, Object> summary = portfolioService.getSummary(user.getId());

        double totalValue       = getDouble(summary, "totalValue");
        double totalInvested    = getDouble(summary, "totalInvested");
        double totalPnl         = getDouble(summary, "totalPnl");
        double totalPnlPct      = getDouble(summary, "totalPnlPct");
        double unrealizedPnl    = getDouble(summary, "unrealizedPnl");
        double realizedPnl      = getDouble(summary, "realizedPnl");

        @SuppressWarnings("unchecked")
        List<Map<String, Object>> holdings =
                (List<Map<String, Object>>) summary.getOrDefault("holdings", List.of());
        int positionCount = holdings.size();

        Map<String, Object> best  = getMap(summary, "bestPerformer");
        Map<String, Object> worst = getMap(summary, "worstPerformer");

        String bestSymbol  = best  != null ? str(best,  "symbol")  : "—";
        double bestPct     = best  != null ? getDouble(best,  "changePct") : 0;
        String worstSymbol = worst != null ? str(worst, "symbol")  : "—";
        double worstPct    = worst != null ? getDouble(worst, "changePct") : 0;

        String name    = user.getName() != null ? user.getName() : "Investor";
        String week    = LocalDate.now().format(DateTimeFormatter.ofPattern("d MMM yyyy"));
        boolean isUp   = totalPnl >= 0;

        String html = buildDigestHtml(
            name, week, totalValue, totalInvested,
            totalPnl, totalPnlPct, unrealizedPnl, realizedPnl,
            positionCount, bestSymbol, bestPct, worstSymbol, worstPct, isUp
        );

        MimeMessage message = mailSender.createMimeMessage();
        MimeMessageHelper helper = new MimeMessageHelper(message, true, "UTF-8");
        helper.setTo(user.getEmail());
        helper.setSubject("📊 Your StockSense Weekly — " + week);
        helper.setText(html, true);
        mailSender.send(message);

        log.info("[Digest] Sent to {} — value={} pnl={}", user.getEmail(), totalValue, totalPnl);
    }

    // ── HTML builder ──────────────────────────────────────────────────────────

    private String buildDigestHtml(
            String name, String week,
            double totalValue, double totalInvested,
            double totalPnl, double totalPnlPct,
            double unrealizedPnl, double realizedPnl,
            int positions,
            String bestSymbol, double bestPct,
            String worstSymbol, double worstPct,
            boolean isUp) {

        String pnlColor   = isUp ? "#22c55e" : "#ef4444";
        String pnlArrow   = isUp ? "↑" : "↓";
        String pnlSign    = isUp ? "+" : "";

        String unrColor   = unrealizedPnl >= 0 ? "#22c55e" : "#ef4444";
        String realColor  = realizedPnl   >= 0 ? "#22c55e" : "#ef4444";
        String bestColor  = bestPct       >= 0 ? "#22c55e" : "#ef4444";
        String worstColor = worstPct      >= 0 ? "#22c55e" : "#ef4444";

        return """
            <!DOCTYPE html>
            <html lang="en">
            <head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
            <body style="margin:0;padding:0;background:#0a0a0a;font-family:'Segoe UI',Arial,sans-serif;">
            <div style="max-width:560px;margin:40px auto;background:#111318;border-radius:16px;
                        border:1px solid #1e2130;overflow:hidden;">

              <!-- Header -->
              <div style="background:linear-gradient(135deg,#0d1f18 0%%,#0a0a0a 100%%);
                           padding:28px 32px;border-bottom:1px solid #1e2130;">
                <div style="display:flex;align-items:center;justify-content:space-between;">
                  <div>
                    <span style="font-size:22px;font-weight:800;color:#8FFFD6;letter-spacing:-0.5px;">
                      StockSense
                    </span>
                    <span style="display:block;font-size:12px;color:#4b5563;margin-top:2px;">
                      Weekly Portfolio Digest
                    </span>
                  </div>
                  <span style="font-size:11px;color:#4b5563;background:#1a1d27;
                                border:1px solid #2a2d3a;border-radius:6px;padding:4px 10px;">
                    %s
                  </span>
                </div>
              </div>

              <!-- Greeting -->
              <div style="padding:28px 32px 0;">
                <p style="margin:0 0 6px;font-size:16px;font-weight:600;color:#f9fafb;">
                  Hey %s 👋
                </p>
                <p style="margin:0;font-size:13px;color:#6b7280;">
                  Here's your portfolio summary for this week.
                </p>
              </div>

              <!-- Hero stat — portfolio value -->
              <div style="padding:20px 32px;">
                <div style="background:#0a0a0a;border-radius:12px;padding:24px;
                             border:1px solid #1e2130;text-align:center;">
                  <p style="margin:0 0 6px;font-size:11px;color:#6b7280;
                              text-transform:uppercase;letter-spacing:.08em;">
                    Portfolio Value
                  </p>
                  <p style="margin:0 0 10px;font-size:36px;font-weight:800;
                              color:#f9fafb;letter-spacing:-1px;">
                    $%s
                  </p>
                  <div style="display:inline-flex;align-items:center;gap:6px;
                               padding:5px 14px;border-radius:999px;
                               background:%s18;border:1px solid %s30;">
                    <span style="font-size:15px;color:%s;">%s</span>
                    <span style="font-size:14px;font-weight:700;color:%s;">
                      %s$%s (%s%.2f%%)
                    </span>
                  </div>
                </div>
              </div>

              <!-- P&L split -->
              <div style="padding:0 32px 20px;">
                <p style="margin:0 0 12px;font-size:12px;font-weight:700;color:#6b7280;
                            text-transform:uppercase;letter-spacing:.08em;">
                  P&amp;L Breakdown
                </p>
                <div style="display:flex;gap:12px;">
                  <!-- Unrealized -->
                  <div style="flex:1;background:#0a0a0a;border-radius:10px;padding:16px;
                               border:1px solid #1e2130;border-left:3px solid %s;">
                    <p style="margin:0 0 4px;font-size:10px;color:#6b7280;
                                text-transform:uppercase;letter-spacing:.06em;">
                      🔓 Unrealized
                    </p>
                    <p style="margin:0;font-size:18px;font-weight:700;color:%s;">
                      %s$%.2f
                    </p>
                    <p style="margin:4px 0 0;font-size:10px;color:#4b5563;">Open positions</p>
                  </div>
                  <!-- Realized -->
                  <div style="flex:1;background:#0a0a0a;border-radius:10px;padding:16px;
                               border:1px solid #1e2130;border-left:3px solid %s;">
                    <p style="margin:0 0 4px;font-size:10px;color:#6b7280;
                                text-transform:uppercase;letter-spacing:.06em;">
                      🔒 Realized
                    </p>
                    <p style="margin:0;font-size:18px;font-weight:700;color:%s;">
                      %s$%.2f
                    </p>
                    <p style="margin:4px 0 0;font-size:10px;color:#4b5563;">Closed trades · FIFO</p>
                  </div>
                </div>
              </div>

              <!-- Stats row -->
              <div style="padding:0 32px 20px;">
                <div style="display:flex;gap:12px;">
                  <div style="flex:1;background:#0a0a0a;border-radius:10px;padding:14px 16px;
                               border:1px solid #1e2130;text-align:center;">
                    <p style="margin:0 0 4px;font-size:10px;color:#6b7280;
                                text-transform:uppercase;letter-spacing:.06em;">Invested</p>
                    <p style="margin:0;font-size:16px;font-weight:700;color:#f9fafb;">
                      $%s
                    </p>
                  </div>
                  <div style="flex:1;background:#0a0a0a;border-radius:10px;padding:14px 16px;
                               border:1px solid #1e2130;text-align:center;">
                    <p style="margin:0 0 4px;font-size:10px;color:#6b7280;
                                text-transform:uppercase;letter-spacing:.06em;">Positions</p>
                    <p style="margin:0;font-size:16px;font-weight:700;color:#8FFFD6;">%d</p>
                  </div>
                </div>
              </div>

              <!-- Performers -->
              <div style="padding:0 32px 24px;">
                <p style="margin:0 0 12px;font-size:12px;font-weight:700;color:#6b7280;
                            text-transform:uppercase;letter-spacing:.08em;">
                  This Week's Performers
                </p>
                <div style="background:#0a0a0a;border-radius:10px;overflow:hidden;
                             border:1px solid #1e2130;">
                  <div style="display:flex;justify-content:space-between;align-items:center;
                               padding:14px 18px;border-bottom:1px solid #1e2130;">
                    <div style="display:flex;align-items:center;gap:8px;">
                      <span style="font-size:16px;">🏆</span>
                      <div>
                        <p style="margin:0;font-size:13px;font-weight:600;color:#f9fafb;">%s</p>
                        <p style="margin:0;font-size:11px;color:#6b7280;">Best performer</p>
                      </div>
                    </div>
                    <span style="font-size:14px;font-weight:700;color:%s;">
                      %s%.2f%%
                    </span>
                  </div>
                  <div style="display:flex;justify-content:space-between;align-items:center;
                               padding:14px 18px;">
                    <div style="display:flex;align-items:center;gap:8px;">
                      <span style="font-size:16px;">📉</span>
                      <div>
                        <p style="margin:0;font-size:13px;font-weight:600;color:#f9fafb;">%s</p>
                        <p style="margin:0;font-size:11px;color:#6b7280;">Worst performer</p>
                      </div>
                    </div>
                    <span style="font-size:14px;font-weight:700;color:%s;">
                      %s%.2f%%
                    </span>
                  </div>
                </div>
              </div>

              <!-- CTA -->
              <div style="padding:0 32px 28px;">
                <a href="http://localhost:3000/dashboard"
                   style="display:block;text-align:center;background:#8FFFD6;color:#0a0a0a;
                          font-weight:800;font-size:14px;padding:14px;border-radius:10px;
                          text-decoration:none;letter-spacing:0.2px;">
                  Open Dashboard →
                </a>
              </div>

              <!-- Footer -->
              <div style="padding:16px 32px;border-top:1px solid #1e2130;">
                <p style="margin:0;font-size:11px;color:#374151;text-align:center;">
                  You're receiving this because weekly digests are enabled in your StockSense settings.
                  <br>
                  <a href="http://localhost:3000/dashboard/settings"
                     style="color:#4b5563;text-decoration:underline;">Unsubscribe</a>
                </p>
              </div>

            </div>
            </body>
            </html>
            """.formatted(
                week, name,
                fmt(totalValue),
                pnlColor, pnlColor, pnlColor, pnlArrow, pnlColor,
                pnlSign, fmt(Math.abs(totalPnl)), pnlSign, totalPnlPct,
                unrColor, unrColor,
                unrealizedPnl >= 0 ? "+" : "-", Math.abs(unrealizedPnl),
                realColor, realColor,
                realizedPnl >= 0 ? "+" : "-", Math.abs(realizedPnl),
                fmt(totalInvested), positions,
                bestSymbol, bestColor, bestPct >= 0 ? "+" : "", bestPct,
                worstSymbol, worstColor, worstPct >= 0 ? "+" : "", worstPct
            );
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private double getDouble(Map<String, Object> map, String key) {
        Object v = map.get(key);
        return v instanceof Number ? ((Number) v).doubleValue() : 0;
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> getMap(Map<String, Object> map, String key) {
        Object v = map.get(key);
        return v instanceof Map ? (Map<String, Object>) v : null;
    }

    private String str(Map<String, Object> map, String key) {
        Object v = map.get(key);
        return v != null ? String.valueOf(v) : "—";
    }

    private String fmt(double v) {
        return String.format("%,.2f", v);
    }
}