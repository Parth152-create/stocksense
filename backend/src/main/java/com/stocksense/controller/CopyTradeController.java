package com.stocksense.controller;

import com.stocksense.model.User;
import com.stocksense.service.CopyTradeService;
import com.stocksense.service.UserService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * CopyTradeController
 *
 * POST /api/community/copy/{username}
 *   — Copies the named public user's portfolio for the authenticated user.
 *     Requires no request body; everything is derived from the source profile
 *     and the copier's current wallet balance.
 */
@RestController
@RequestMapping("/api/community")
public class CopyTradeController {

    private final CopyTradeService copyTradeService;
    private final UserService      userService;

    public CopyTradeController(CopyTradeService copyTradeService,
                               UserService userService) {
        this.copyTradeService = copyTradeService;
        this.userService      = userService;
    }

    @PostMapping("/copy/{username}")
    public ResponseEntity<?> copyPortfolio(
            @AuthenticationPrincipal String email,
            @PathVariable String username) {

        if (email == null)
            return ResponseEntity.status(401).body(Map.of("error", "Unauthorized"));

        User copier = userService.getUserByEmail(email);
        CopyTradeService.CopyTradeResult result =
            copyTradeService.copyPortfolio(copier, username);

        if (!result.success)
            return ResponseEntity.badRequest().body(Map.of("error", result.message));

        // Shape the response to match what the frontend needs
        List<Map<String, Object>> orderList = result.orders.stream()
            .map(o -> {
                Map<String, Object> m = new LinkedHashMap<>();
                m.put("symbol",   o.symbol);
                m.put("quantity", o.quantity);
                m.put("price",    o.price);
                m.put("total",    o.total);
                return m;
            })
            .collect(Collectors.toList());

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("success",    true);
        response.put("message",    result.message);
        response.put("orders",     orderList);
        response.put("totalSpent", result.totalSpent);
        response.put("skipped",    result.skipped);
        response.put("placed",     orderList.size());

        return ResponseEntity.ok(response);
    }
}