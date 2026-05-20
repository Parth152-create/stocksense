package com.stocksense.service;

import jakarta.mail.MessagingException;
import jakarta.mail.internet.MimeMessage;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;

@Service
public class EmailService {

    private static final Logger log = LoggerFactory.getLogger(EmailService.class);

    private final JavaMailSender mailSender;

    public EmailService(JavaMailSender mailSender) {
        this.mailSender = mailSender;
    }

    public void sendPriceAlert(String toEmail, String toName,
                                String symbol, String direction,
                                BigDecimal alertPrice, BigDecimal currentPrice) {
        try {
            MimeMessage message = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(message, true, "UTF-8");

            helper.setTo(toEmail);
            helper.setSubject("StockSense Alert: " + symbol + " crossed ₹" + alertPrice.toPlainString());
            helper.setText(buildHtml(toName, symbol, direction, alertPrice, currentPrice), true);

            mailSender.send(message);
            log.info("[EmailService] Alert email sent to {} for {}", toEmail, symbol);

        } catch (MessagingException e) {
            // Don't crash the scheduler if email fails
            log.error("[EmailService] Failed to send email to {}: {}", toEmail, e.getMessage());
        }
    }

    private String buildHtml(String name, String symbol, String direction,
                              BigDecimal alertPrice, BigDecimal currentPrice) {
        String directionLabel = direction.equals("above")
            ? "risen above 📈"
            : "fallen below 📉";

        return """
            <!DOCTYPE html>
            <html>
            <body style="margin:0;padding:0;background:#0f1117;font-family:'Segoe UI',sans-serif;">
              <div style="max-width:520px;margin:40px auto;background:#1a1d27;border-radius:12px;
                          border:1px solid #2a2d3a;overflow:hidden;">

                <!-- Header -->
                <div style="background:#0f1117;padding:24px 32px;border-bottom:1px solid #2a2d3a;">
                  <span style="font-size:20px;font-weight:700;color:#8FFFD6;">StockSense</span>
                  <span style="font-size:13px;color:#6b7280;margin-left:8px;">Price Alert</span>
                </div>

                <!-- Body -->
                <div style="padding:32px;">
                  <p style="color:#9ca3af;font-size:14px;margin:0 0 24px;">
                    Hi %s,
                  </p>

                  <div style="background:#0f1117;border-radius:8px;padding:20px 24px;
                               border-left:3px solid #8FFFD6;margin-bottom:24px;">
                    <p style="margin:0 0 8px;font-size:22px;font-weight:700;color:#f9fafb;">
                      %s
                    </p>
                    <p style="margin:0;font-size:14px;color:#9ca3af;">
                      has %s your alert of
                      <span style="color:#8FFFD6;font-weight:600;">₹%s</span>
                    </p>
                  </div>

                  <div style="display:flex;gap:16px;margin-bottom:28px;">
                    <div style="flex:1;background:#0f1117;border-radius:8px;padding:16px;text-align:center;">
                      <p style="margin:0 0 4px;font-size:11px;color:#6b7280;text-transform:uppercase;
                                 letter-spacing:.05em;">Alert Price</p>
                      <p style="margin:0;font-size:20px;font-weight:700;color:#f9fafb;">₹%s</p>
                    </div>
                    <div style="flex:1;background:#0f1117;border-radius:8px;padding:16px;text-align:center;">
                      <p style="margin:0 0 4px;font-size:11px;color:#6b7280;text-transform:uppercase;
                                 letter-spacing:.05em;">Current Price</p>
                      <p style="margin:0;font-size:20px;font-weight:700;color:#8FFFD6;">₹%s</p>
                    </div>
                  </div>

                  <a href="http://localhost:3000/dashboard/watchlist"
                     style="display:block;text-align:center;background:#8FFFD6;color:#0f1117;
                            font-weight:700;font-size:14px;padding:12px;border-radius:8px;
                            text-decoration:none;">
                    View Watchlist →
                  </a>
                </div>

                <!-- Footer -->
                <div style="padding:16px 32px;border-top:1px solid #2a2d3a;">
                  <p style="margin:0;font-size:12px;color:#4b5563;text-align:center;">
                    You're receiving this because you set a price alert on StockSense.
                  </p>
                </div>

              </div>
            </body>
            </html>
            """.formatted(name, symbol, directionLabel,
                          alertPrice.toPlainString(),
                          alertPrice.toPlainString(),
                          currentPrice.toPlainString(),
                          currentPrice.toPlainString());
    }
}