package com.stocksense.repository;

import com.stocksense.model.Order;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

import java.util.List;

@Repository
public interface OrderRepository extends JpaRepository<Order, Long> {
  List<Order> findByUserIdOrderByCreatedAtDesc(String userId);
    List<Order> findByUserIdAndSymbolOrderByCreatedAtDesc(String userId, String symbol);
    List<Order> findByStatus(String status);
    Page<Order> findByUserId(String userId, Pageable pageable);
    void deleteByUserId(String userId);
}