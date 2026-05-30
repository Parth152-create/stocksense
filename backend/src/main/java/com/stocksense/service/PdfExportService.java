package com.stocksense.service;

import com.lowagie.text.*;
import com.lowagie.text.Font;
import com.lowagie.text.Rectangle;
import com.lowagie.text.pdf.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.awt.Color;
import java.io.ByteArrayOutputStream;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Map;

/**
 * PdfExportService
 *
 * Generates a styled PDF portfolio report using OpenPDF.
 *
 * Report sections:
 *   1. Header — StockSense branding + generated date
 *   2. Summary cards — Total Value, Invested, P&L, Positions
 *   3. P&L Breakdown — Unrealized vs Realized
 *   4. Holdings table — Symbol, Name, Qty, Avg Price, Current, Value, P&L, P&L%
 *   5. Allocation — sector breakdown
 *   6. Footer — disclaimer
 */
@Service
public class PdfExportService {

    private static final Logger log = LoggerFactory.getLogger(PdfExportService.class);

    // ── Brand colors ──────────────────────────────────────────────────────────
    private static final Color ACCENT      = new Color(0x8F, 0xFF, 0xD6);   // #8FFFD6
    private static final Color BG_DARK     = new Color(0x11, 0x13, 0x18);   // #111318
    private static final Color BG_CARD     = new Color(0x1A, 0x1D, 0x27);   // #1a1d27
    private static final Color TEXT_PRIMARY = new Color(0xF9, 0xFA, 0xFB);  // #f9fafb
    private static final Color TEXT_MUTED  = new Color(0x9C, 0xA3, 0xAF);   // #9ca3af
    private static final Color GREEN       = new Color(0x22, 0xC5, 0x5E);   // #22c55e
    private static final Color RED         = new Color(0xEF, 0x44, 0x44);   // #ef4444
    private static final Color LINE        = new Color(0x1E, 0x21, 0x30);   // #1e2130

    // ── Fonts ─────────────────────────────────────────────────────────────────
    private static final Font FONT_TITLE   = new Font(Font.HELVETICA, 22, Font.BOLD,   TEXT_PRIMARY);
    private static final Font FONT_SECTION = new Font(Font.HELVETICA, 13, Font.BOLD,   TEXT_PRIMARY);
    private static final Font FONT_LABEL   = new Font(Font.HELVETICA,  9, Font.NORMAL, TEXT_MUTED);
    private static final Font FONT_VALUE   = new Font(Font.HELVETICA, 14, Font.BOLD,   TEXT_PRIMARY);
    private static final Font FONT_BODY    = new Font(Font.HELVETICA, 10, Font.NORMAL, TEXT_PRIMARY);
    private static final Font FONT_SMALL   = new Font(Font.HELVETICA,  8, Font.NORMAL, TEXT_MUTED);
    private static final Font FONT_ACCENT  = new Font(Font.HELVETICA, 22, Font.BOLD,   ACCENT);

    public byte[] generatePortfolioReport(Map<String, Object> summary, String currency) {
        try (ByteArrayOutputStream baos = new ByteArrayOutputStream()) {

            Document doc = new Document(PageSize.A4, 40, 40, 40, 40);
            PdfWriter writer = PdfWriter.getInstance(doc, baos);
            doc.open();

            // Background
            PdfContentByte cb = writer.getDirectContentUnder();
            cb.setColorFill(BG_DARK);
            cb.rectangle(0, 0, PageSize.A4.getWidth(), PageSize.A4.getHeight());
            cb.fill();

            // ── Header ────────────────────────────────────────────────────────
            addHeader(doc, currency);

            // ── Summary Cards ─────────────────────────────────────────────────
            addSummaryCards(doc, summary, currency);

            // ── P&L Breakdown ─────────────────────────────────────────────────
            addPnlBreakdown(doc, summary, currency);

            // ── Holdings Table ────────────────────────────────────────────────
            @SuppressWarnings("unchecked")
            List<Map<String, Object>> holdings =
                    (List<Map<String, Object>>) summary.getOrDefault("holdings", List.of());
            if (!holdings.isEmpty()) {
                addHoldingsTable(doc, holdings, currency);
            }

            // ── Allocation ────────────────────────────────────────────────────
            @SuppressWarnings("unchecked")
            List<Map<String, Object>> allocation =
                    (List<Map<String, Object>>) summary.getOrDefault("allocation", List.of());
            if (!allocation.isEmpty()) {
                addAllocation(doc, allocation);
            }

            // ── Footer ────────────────────────────────────────────────────────
            addFooter(doc);

            doc.close();
            log.info("[PdfExport] Generated portfolio PDF ({} bytes)", baos.size());
            return baos.toByteArray();

        } catch (Exception e) {
            log.error("[PdfExport] Failed to generate PDF: {}", e.getMessage());
            throw new RuntimeException("PDF generation failed: " + e.getMessage(), e);
        }
    }

    // ── Section builders ──────────────────────────────────────────────────────

    private void addHeader(Document doc, String currency) throws DocumentException {
        // Brand name
        Paragraph brand = new Paragraph("StockSense", FONT_ACCENT);
        brand.setSpacingAfter(2);
        doc.add(brand);

        // Subtitle + date
        String date = LocalDate.now().format(DateTimeFormatter.ofPattern("d MMMM yyyy"));
        Paragraph sub = new Paragraph("Portfolio Report  ·  Generated " + date, FONT_SMALL);
        sub.setSpacingAfter(16);
        doc.add(sub);

        // Divider
        addDivider(doc);
    }

    private void addSummaryCards(Document doc, Map<String, Object> summary, String currency)
            throws DocumentException {

        double totalValue   = getDouble(summary, "totalValue");
        double totalCost    = getDouble(summary, "totalInvested");
        double totalPnl     = getDouble(summary, "totalPnl");
        double totalPnlPct  = getDouble(summary, "totalPnlPct");
        int    positions    = ((List<?>) summary.getOrDefault("holdings", List.of())).size();

        Paragraph sectionTitle = new Paragraph("Portfolio Summary", FONT_SECTION);
        sectionTitle.setSpacingBefore(12);
        sectionTitle.setSpacingAfter(10);
        doc.add(sectionTitle);

        // 2×2 card table
        PdfPTable table = new PdfPTable(2);
        table.setWidthPercentage(100);
        table.setSpacingAfter(16);

        addSummaryCard(table, "Total Value",
                currency + String.format("%,.2f", totalValue), null);
        addSummaryCard(table, "Total Invested",
                currency + String.format("%,.2f", totalCost), null);
        addSummaryCard(table, "Overall P&L",
                (totalPnl >= 0 ? "+" : "") + currency + String.format("%,.2f", Math.abs(totalPnl)),
                totalPnl >= 0 ? GREEN : RED);
        addSummaryCard(table, "Active Positions",
                String.valueOf(positions), ACCENT);

        doc.add(table);
    }

    private void addSummaryCard(PdfPTable table, String label, String value, Color valueColor) {
        PdfPCell cell = new PdfPCell();
        cell.setBackgroundColor(BG_CARD);
        cell.setBorderColor(LINE);
        cell.setBorderWidth(1);
        cell.setPadding(14);

        Paragraph l = new Paragraph(label.toUpperCase(), FONT_LABEL);
        l.setSpacingAfter(6);
        cell.addElement(l);

        Font vFont = new Font(Font.HELVETICA, 16, Font.BOLD, valueColor != null ? valueColor : TEXT_PRIMARY);
        cell.addElement(new Paragraph(value, vFont));
        table.addCell(cell);
    }

    private void addPnlBreakdown(Document doc, Map<String, Object> summary, String currency)
            throws DocumentException {

        double unrealized    = getDouble(summary, "unrealizedPnl");
        double unrealizedPct = getDouble(summary, "unrealizedPnlPct");
        double realized      = getDouble(summary, "realizedPnl");
        double combined      = getDouble(summary, "totalCombinedPnl");

        Paragraph title = new Paragraph("P&L Breakdown", FONT_SECTION);
        title.setSpacingBefore(4);
        title.setSpacingAfter(10);
        doc.add(title);

        PdfPTable table = new PdfPTable(3);
        table.setWidthPercentage(100);
        table.setWidths(new float[]{1f, 1f, 1f});
        table.setSpacingAfter(16);

        addPnlCard(table, "🔓 Unrealized",
                (unrealized >= 0 ? "+" : "") + currency + String.format("%,.2f", Math.abs(unrealized)),
                String.format("%+.2f%%", unrealizedPct),
                unrealized >= 0 ? GREEN : RED);

        addPnlCard(table, "🔒 Realized",
                (realized >= 0 ? "+" : "") + currency + String.format("%,.2f", Math.abs(realized)),
                realized == 0 ? "No closed trades" : "Locked in",
                realized >= 0 ? GREEN : RED);

        addPnlCard(table, "Combined Total",
                (combined >= 0 ? "+" : "") + currency + String.format("%,.2f", Math.abs(combined)),
                "",
                combined >= 0 ? GREEN : RED);

        doc.add(table);
    }

    private void addPnlCard(PdfPTable table, String label, String value, String sub, Color color) {
        PdfPCell cell = new PdfPCell();
        cell.setBackgroundColor(BG_CARD);
        cell.setBorderColor(LINE);
        cell.setBorderWidth(1);
        cell.setPadding(12);

        cell.addElement(new Paragraph(label, FONT_LABEL));
        Font vf = new Font(Font.HELVETICA, 14, Font.BOLD, color);
        Paragraph vp = new Paragraph(value, vf);
        vp.setSpacingBefore(4);
        cell.addElement(vp);
        if (!sub.isEmpty()) {
            cell.addElement(new Paragraph(sub, new Font(Font.HELVETICA, 8, Font.NORMAL, color)));
        }
        table.addCell(cell);
    }

    private void addHoldingsTable(Document doc, List<Map<String, Object>> holdings, String currency)
            throws DocumentException {

        Paragraph title = new Paragraph("Holdings", FONT_SECTION);
        title.setSpacingBefore(4);
        title.setSpacingAfter(10);
        doc.add(title);

        PdfPTable table = new PdfPTable(8);
        table.setWidthPercentage(100);
        table.setWidths(new float[]{1.2f, 1.8f, 0.7f, 1f, 1f, 1.1f, 1f, 0.9f});
        table.setSpacingAfter(16);

        // Header row
        String[] headers = {"Symbol", "Name", "Qty", "Avg Price", "Current", "Value", "P&L", "P&L %"};
        for (String h : headers) {
            PdfPCell hCell = new PdfPCell(new Phrase(h, FONT_LABEL));
            hCell.setBackgroundColor(BG_CARD);
            hCell.setBorderColor(LINE);
            hCell.setPadding(8);
            table.addCell(hCell);
        }

        // Data rows
        for (int i = 0; i < holdings.size(); i++) {
            Map<String, Object> h = holdings.get(i);
            Color rowBg = i % 2 == 0 ? BG_DARK : BG_CARD;

            double pnl    = getDouble(h, "pnl");
            double pnlPct = getDouble(h, "pnlPct");
            Color pnlCol  = pnl >= 0 ? GREEN : RED;

            addCell(table, str(h, "symbol"),                              rowBg, FONT_BODY);
            addCell(table, str(h, "name"),                                rowBg, FONT_SMALL);
            addCell(table, fmt(getDouble(h, "qty"), 0),                   rowBg, FONT_BODY);
            addCell(table, currency + fmt(getDouble(h, "avgPrice"),    2), rowBg, FONT_BODY);
            addCell(table, currency + fmt(getDouble(h, "currentPrice"),2), rowBg, FONT_BODY);
            addCell(table, currency + fmt(getDouble(h, "marketValue"), 2), rowBg, FONT_BODY);

            // P&L colored cell
            PdfPCell pnlCell = new PdfPCell(new Phrase(
                (pnl >= 0 ? "+" : "") + currency + fmt(Math.abs(pnl), 2),
                new Font(Font.HELVETICA, 10, Font.BOLD, pnlCol)));
            pnlCell.setBackgroundColor(rowBg);
            pnlCell.setBorderColor(LINE);
            pnlCell.setPadding(7);
            table.addCell(pnlCell);

            PdfPCell pctCell = new PdfPCell(new Phrase(
                String.format("%+.2f%%", pnlPct),
                new Font(Font.HELVETICA, 9, Font.NORMAL, pnlCol)));
            pctCell.setBackgroundColor(rowBg);
            pctCell.setBorderColor(LINE);
            pctCell.setPadding(7);
            table.addCell(pctCell);
        }

        doc.add(table);
    }

    private void addAllocation(Document doc, List<Map<String, Object>> allocation)
            throws DocumentException {

        Paragraph title = new Paragraph("Asset Allocation", FONT_SECTION);
        title.setSpacingBefore(4);
        title.setSpacingAfter(10);
        doc.add(title);

        PdfPTable table = new PdfPTable(2);
        table.setWidthPercentage(60);
        table.setSpacingAfter(16);

        for (Map<String, Object> seg : allocation) {
            String label = str(seg, "label");
            double pct   = getDouble(seg, "pct");

            PdfPCell lCell = new PdfPCell(new Phrase(label, FONT_BODY));
            lCell.setBackgroundColor(BG_CARD);
            lCell.setBorderColor(LINE);
            lCell.setPadding(8);
            table.addCell(lCell);

            PdfPCell pCell = new PdfPCell(new Phrase(String.format("%.1f%%", pct),
                    new Font(Font.HELVETICA, 10, Font.BOLD, ACCENT)));
            pCell.setBackgroundColor(BG_CARD);
            pCell.setBorderColor(LINE);
            pCell.setPadding(8);
            table.addCell(pCell);
        }

        doc.add(table);
    }

    private void addFooter(Document doc) throws DocumentException {
        addDivider(doc);
        Paragraph footer = new Paragraph(
            "This report is generated by StockSense for informational purposes only. " +
            "Past performance is not indicative of future results. " +
            "This is not financial advice.",
            FONT_SMALL);
        footer.setSpacingBefore(8);
        doc.add(footer);
    }

    private void addDivider(Document doc) throws DocumentException {
        Paragraph divider = new Paragraph(" ");
        divider.setSpacingBefore(2);
        divider.setSpacingAfter(2);
        // Draw a line using a table with no content
        PdfPTable line = new PdfPTable(1);
        line.setWidthPercentage(100);
        line.setSpacingAfter(10);
        PdfPCell cell = new PdfPCell(new Phrase(""));
        cell.setBorderWidthBottom(1);
        cell.setBorderColorBottom(LINE);
        cell.setBorderWidthTop(0);
        cell.setBorderWidthLeft(0);
        cell.setBorderWidthRight(0);
        cell.setPadding(0);
        cell.setPaddingBottom(6);
        line.addCell(cell);
        doc.add(line);
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private void addCell(PdfPTable table, String text, Color bg, Font font) {
        PdfPCell cell = new PdfPCell(new Phrase(text, font));
        cell.setBackgroundColor(bg);
        cell.setBorderColor(LINE);
        cell.setPadding(7);
        table.addCell(cell);
    }

    private double getDouble(Map<String, Object> map, String key) {
        Object v = map.get(key);
        return v instanceof Number ? ((Number) v).doubleValue() : 0;
    }

    private String str(Map<String, Object> map, String key) {
        Object v = map.get(key);
        return v != null ? String.valueOf(v) : "";
    }

    private String fmt(double v, int decimals) {
        return String.format("%,." + decimals + "f", v);
    }
}