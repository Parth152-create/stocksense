package com.stocksense.repository;

import com.stocksense.model.WalletBalance;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Optional;
import java.util.UUID;

public interface WalletBalanceRepository extends JpaRepository<WalletBalance, UUID> {
    Optional<WalletBalance> findByUserId(UUID userId);
    void deleteByUserId(UUID userId);
}