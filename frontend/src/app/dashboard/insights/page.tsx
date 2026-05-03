"use client";

import { useState, useEffect } from "react";
import { useMarket, type MarketId } from "@/hooks/useMarket";
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis,
  ResponsiveContainer, AreaChart, Area,
} from "recharts";

// ─── Types ────────────────────────────────────────────────────────────────────

type SignalType = "BUY" | "SELL" | "HOLD";

interface StockInsight {
  symbol: string;
  name: string;
  color: string;
  bg: string;
  letter: string;
  signal: SignalType;
  signalStrength: number;
  sentiment: number;
  sentimentLabel: string;
  newsCount: number;
  socialScore: number;
  priceTarget: string;
  currentPrice: string;
  upside: number;
  riskRating: "LOW" | "MEDIUM" | "HIGH" | "EXTREME";
  riskScore: number;
  anomalyFlag: boolean;
  anomalyDesc: string;
  earningsSurprise: number | null;
  sectorRotation: "INFLOW" | "OUTFLOW" | "NEUTRAL";
  radarData: { subject: string; value: number }[];
  priceHistory: { t: string; v: number }[];
  newsFeed: { headline: string; source: string; sentiment: "pos" | "neg" | "neu"; ago: string }[];
  socialSources: { source: string; score: number; color: string }[];
}

// ─── Data ─────────────────────────────────────────────────────────────────────

const INSIGHTS_DATA: Record<MarketId, StockInsight[]> = {
  US: [
    {
      symbol: "NVDA", name: "NVIDIA Corp", color: "#76b900", bg: "#76b90018", letter: "N",
      signal: "BUY", signalStrength: 91, sentiment: 78, sentimentLabel: "Very Bullish",
      newsCount: 47, socialScore: 88, priceTarget: "$1,240", currentPrice: "$1,089", upside: 13.8,
      riskRating: "MEDIUM", riskScore: 42, anomalyFlag: true,
      anomalyDesc: "Unusual call options volume — 4.2× daily avg",
      earningsSurprise: 18.4, sectorRotation: "INFLOW",
      radarData: [
        { subject: "Momentum", value: 92 }, { subject: "Value", value: 34 },
        { subject: "Growth", value: 96 }, { subject: "Quality", value: 88 },
        { subject: "Sentiment", value: 85 }, { subject: "Technicals", value: 79 },
      ],
      priceHistory: [
        { t: "Aug", v: 420 }, { t: "Sep", v: 440 }, { t: "Oct", v: 480 }, { t: "Nov", v: 510 },
        { t: "Dec", v: 495 }, { t: "Jan", v: 670 }, { t: "Feb", v: 790 }, { t: "Mar", v: 875 },
        { t: "Apr", v: 940 }, { t: "May", v: 1089 },
      ],
      newsFeed: [
        { headline: "Blackwell chip demand far exceeds supply forecasts", source: "Reuters", sentiment: "pos", ago: "2h" },
        { headline: "Data center revenue hits $22B, smashing estimates", source: "Bloomberg", sentiment: "pos", ago: "5h" },
        { headline: "Regulatory scrutiny over AI chip exports tightens", source: "WSJ", sentiment: "neg", ago: "8h" },
        { headline: "Morgan Stanley raises price target to $1,400", source: "CNBC", sentiment: "pos", ago: "1d" },
      ],
      socialSources: [
        { source: "Reddit", score: 92, color: "#ff4500" },
        { source: "Twitter/X", score: 87, color: "#1da1f2" },
        { source: "StockTwits", score: 81, color: "#8FFFD6" },
      ],
    },
    {
      symbol: "AAPL", name: "Apple Inc", color: "#aaaaaa", bg: "#aaaaaa18", letter: "",
      signal: "HOLD", signalStrength: 58, sentiment: 22, sentimentLabel: "Mildly Bullish",
      newsCount: 31, socialScore: 66, priceTarget: "$212", currentPrice: "$198", upside: 7.1,
      riskRating: "LOW", riskScore: 21, anomalyFlag: false, anomalyDesc: "",
      earningsSurprise: 4.2, sectorRotation: "NEUTRAL",
      radarData: [
        { subject: "Momentum", value: 54 }, { subject: "Value", value: 62 },
        { subject: "Growth", value: 48 }, { subject: "Quality", value: 94 },
        { subject: "Sentiment", value: 61 }, { subject: "Technicals", value: 57 },
      ],
      priceHistory: [
        { t: "Aug", v: 175 }, { t: "Sep", v: 172 }, { t: "Oct", v: 177 }, { t: "Nov", v: 181 },
        { t: "Dec", v: 185 }, { t: "Jan", v: 188 }, { t: "Feb", v: 184 }, { t: "Mar", v: 192 },
        { t: "Apr", v: 195 }, { t: "May", v: 198 },
      ],
      newsFeed: [
        { headline: "iPhone 17 Pro pre-orders exceed expectations in key markets", source: "9to5Mac", sentiment: "pos", ago: "3h" },
        { headline: "Services revenue growth slowing, analysts warn", source: "FT", sentiment: "neg", ago: "6h" },
        { headline: "EU antitrust fine could reach €2B over App Store rules", source: "Reuters", sentiment: "neg", ago: "12h" },
        { headline: "Apple Intelligence drives 14% YoY upgrade cycle acceleration", source: "MS", sentiment: "pos", ago: "2d" },
      ],
      socialSources: [
        { source: "Reddit", score: 71, color: "#ff4500" },
        { source: "Twitter/X", score: 65, color: "#1da1f2" },
        { source: "StockTwits", score: 58, color: "#8FFFD6" },
      ],
    },
    {
      symbol: "TSLA", name: "Tesla Inc", color: "#ef4444", bg: "#ef444418", letter: "T",
      signal: "SELL", signalStrength: 72, sentiment: -45, sentimentLabel: "Bearish",
      newsCount: 62, socialScore: 74, priceTarget: "$148", currentPrice: "$182", upside: -18.7,
      riskRating: "HIGH", riskScore: 74, anomalyFlag: true,
      anomalyDesc: "Insider selling: 3 executives sold $28M in past 30 days",
      earningsSurprise: -8.1, sectorRotation: "OUTFLOW",
      radarData: [
        { subject: "Momentum", value: 28 }, { subject: "Value", value: 18 },
        { subject: "Growth", value: 44 }, { subject: "Quality", value: 52 },
        { subject: "Sentiment", value: 31 }, { subject: "Technicals", value: 24 },
      ],
      priceHistory: [
        { t: "Aug", v: 260 }, { t: "Sep", v: 248 }, { t: "Oct", v: 220 }, { t: "Nov", v: 235 },
        { t: "Dec", v: 251 }, { t: "Jan", v: 212 }, { t: "Feb", v: 198 }, { t: "Mar", v: 188 },
        { t: "Apr", v: 174 }, { t: "May", v: 182 },
      ],
      newsFeed: [
        { headline: "EV delivery numbers miss Q2 estimates by 11%", source: "Reuters", sentiment: "neg", ago: "1h" },
        { headline: "Cybertruck recall expanded to 46,000 units", source: "WSJ", sentiment: "neg", ago: "4h" },
        { headline: "China market share falls to 8.2% amid BYD competition", source: "Bloomberg", sentiment: "neg", ago: "9h" },
        { headline: "FSD v13 launches in Europe — key regulatory milestone", source: "Electrek", sentiment: "pos", ago: "1d" },
      ],
      socialSources: [
        { source: "Reddit", score: 38, color: "#ff4500" },
        { source: "Twitter/X", score: 58, color: "#1da1f2" },
        { source: "StockTwits", score: 41, color: "#8FFFD6" },
      ],
    },
    {
      symbol: "AMD", name: "Advanced Micro Devices", color: "#ed1c24", bg: "#ed1c2418", letter: "A",
      signal: "BUY", signalStrength: 77, sentiment: 54, sentimentLabel: "Bullish",
      newsCount: 28, socialScore: 72, priceTarget: "$265", currentPrice: "$220", upside: 20.5,
      riskRating: "MEDIUM", riskScore: 48, anomalyFlag: false, anomalyDesc: "",
      earningsSurprise: 9.7, sectorRotation: "INFLOW",
      radarData: [
        { subject: "Momentum", value: 74 }, { subject: "Value", value: 58 },
        { subject: "Growth", value: 81 }, { subject: "Quality", value: 77 },
        { subject: "Sentiment", value: 68 }, { subject: "Technicals", value: 72 },
      ],
      priceHistory: [
        { t: "Aug", v: 105 }, { t: "Sep", v: 112 }, { t: "Oct", v: 125 }, { t: "Nov", v: 138 },
        { t: "Dec", v: 148 }, { t: "Jan", v: 165 }, { t: "Feb", v: 178 }, { t: "Mar", v: 198 },
        { t: "Apr", v: 210 }, { t: "May", v: 220 },
      ],
      newsFeed: [
        { headline: "MI300X AI accelerator wins key Google Cloud contract", source: "Bloomberg", sentiment: "pos", ago: "4h" },
        { headline: "Data center GPU revenue doubles year-over-year", source: "CNBC", sentiment: "pos", ago: "7h" },
        { headline: "PC market recovery to boost CPU sales in H2 2025", source: "IDC", sentiment: "pos", ago: "1d" },
        { headline: "Intel competitive response narrows AMD's consumer lead", source: "AnandTech", sentiment: "neg", ago: "2d" },
      ],
      socialSources: [
        { source: "Reddit", score: 78, color: "#ff4500" },
        { source: "Twitter/X", score: 69, color: "#1da1f2" },
        { source: "StockTwits", score: 74, color: "#8FFFD6" },
      ],
    },
  ],

  IN: [
    {
      symbol: "RELIANCE", name: "Reliance Industries", color: "#0ea5e9", bg: "#0ea5e918", letter: "R",
      signal: "BUY", signalStrength: 83, sentiment: 67, sentimentLabel: "Bullish",
      newsCount: 38, socialScore: 79, priceTarget: "₹3,200", currentPrice: "₹2,940", upside: 8.8,
      riskRating: "LOW", riskScore: 28, anomalyFlag: false, anomalyDesc: "",
      earningsSurprise: 6.3, sectorRotation: "INFLOW",
      radarData: [
        { subject: "Momentum", value: 81 }, { subject: "Value", value: 72 },
        { subject: "Growth", value: 78 }, { subject: "Quality", value: 88 },
        { subject: "Sentiment", value: 74 }, { subject: "Technicals", value: 82 },
      ],
      priceHistory: [
        { t: "Aug", v: 2480 }, { t: "Sep", v: 2510 }, { t: "Oct", v: 2560 }, { t: "Nov", v: 2620 },
        { t: "Dec", v: 2700 }, { t: "Jan", v: 2750 }, { t: "Feb", v: 2810 }, { t: "Mar", v: 2870 },
        { t: "Apr", v: 2910 }, { t: "May", v: 2940 },
      ],
      newsFeed: [
        { headline: "Jio Financial Services posts 34% profit jump in Q4", source: "ET", sentiment: "pos", ago: "2h" },
        { headline: "Reliance Retail to enter quick commerce with 2,000 dark stores", source: "Mint", sentiment: "pos", ago: "6h" },
        { headline: "Green energy capex revised upward to ₹75,000 Cr by 2027", source: "BS", sentiment: "pos", ago: "1d" },
        { headline: "5G network completion pledged by year-end", source: "NDTV Profit", sentiment: "pos", ago: "2d" },
      ],
      socialSources: [
        { source: "Reddit", score: 82, color: "#ff4500" },
        { source: "Twitter/X", score: 76, color: "#1da1f2" },
        { source: "StockTwits", score: 79, color: "#8FFFD6" },
      ],
    },
    {
      symbol: "TCS", name: "Tata Consultancy Services", color: "#8b5cf6", bg: "#8b5cf618", letter: "T",
      signal: "HOLD", signalStrength: 61, sentiment: 30, sentimentLabel: "Mildly Bullish",
      newsCount: 22, socialScore: 58, priceTarget: "₹4,100", currentPrice: "₹3,920", upside: 4.6,
      riskRating: "LOW", riskScore: 18, anomalyFlag: false, anomalyDesc: "",
      earningsSurprise: 2.1, sectorRotation: "NEUTRAL",
      radarData: [
        { subject: "Momentum", value: 56 }, { subject: "Value", value: 74 },
        { subject: "Growth", value: 52 }, { subject: "Quality", value: 91 },
        { subject: "Sentiment", value: 58 }, { subject: "Technicals", value: 61 },
      ],
      priceHistory: [
        { t: "Aug", v: 3650 }, { t: "Sep", v: 3680 }, { t: "Oct", v: 3720 }, { t: "Nov", v: 3750 },
        { t: "Dec", v: 3800 }, { t: "Jan", v: 3820 }, { t: "Feb", v: 3850 }, { t: "Mar", v: 3870 },
        { t: "Apr", v: 3900 }, { t: "May", v: 3920 },
      ],
      newsFeed: [
        { headline: "TCS bags ₹18,000 Cr BSNL 4G/5G rollout mega-contract", source: "ET", sentiment: "pos", ago: "5h" },
        { headline: "Attrition falls to 12.1%, lowest in 10 quarters", source: "Mint", sentiment: "pos", ago: "9h" },
        { headline: "US discretionary spending slowdown clouds IT outlook", source: "BS", sentiment: "neg", ago: "1d" },
        { headline: "AI-led deals pipeline reaches $3B", source: "NDTV Profit", sentiment: "neu", ago: "2d" },
      ],
      socialSources: [
        { source: "Reddit", score: 62, color: "#ff4500" },
        { source: "Twitter/X", score: 55, color: "#1da1f2" },
        { source: "StockTwits", score: 58, color: "#8FFFD6" },
      ],
    },
    {
      symbol: "WIPRO", name: "Wipro Ltd", color: "#ef4444", bg: "#ef444418", letter: "W",
      signal: "SELL", signalStrength: 64, sentiment: -28, sentimentLabel: "Mildly Bearish",
      newsCount: 19, socialScore: 44, priceTarget: "₹420", currentPrice: "₹468", upside: -10.3,
      riskRating: "MEDIUM", riskScore: 55, anomalyFlag: true,
      anomalyDesc: "Short interest spiked 38% over last 2 weeks",
      earningsSurprise: -3.4, sectorRotation: "OUTFLOW",
      radarData: [
        { subject: "Momentum", value: 32 }, { subject: "Value", value: 58 },
        { subject: "Growth", value: 28 }, { subject: "Quality", value: 62 },
        { subject: "Sentiment", value: 38 }, { subject: "Technicals", value: 30 },
      ],
      priceHistory: [
        { t: "Aug", v: 520 }, { t: "Sep", v: 505 }, { t: "Oct", v: 490 }, { t: "Nov", v: 510 },
        { t: "Dec", v: 498 }, { t: "Jan", v: 485 }, { t: "Feb", v: 478 }, { t: "Mar", v: 472 },
        { t: "Apr", v: 465 }, { t: "May", v: 468 },
      ],
      newsFeed: [
        { headline: "Q4 guidance cut: revenue to fall 1-3% sequentially", source: "Mint", sentiment: "neg", ago: "3h" },
        { headline: "CEO Srinivas resigns — third leadership change in 4 years", source: "ET", sentiment: "neg", ago: "8h" },
        { headline: "Capco acquisition yet to yield expected synergies", source: "BS", sentiment: "neg", ago: "1d" },
        { headline: "New AI practice unit targets $500M revenue by FY27", source: "NDTV Profit", sentiment: "pos", ago: "3d" },
      ],
      socialSources: [
        { source: "Reddit", score: 41, color: "#ff4500" },
        { source: "Twitter/X", score: 44, color: "#1da1f2" },
        { source: "StockTwits", score: 38, color: "#8FFFD6" },
      ],
    },
    {
      symbol: "INFY", name: "Infosys Ltd", color: "#f59e0b", bg: "#f59e0b18", letter: "I",
      signal: "BUY", signalStrength: 71, sentiment: 48, sentimentLabel: "Bullish",
      newsCount: 26, socialScore: 65, priceTarget: "₹1,980", currentPrice: "₹1,820", upside: 8.8,
      riskRating: "LOW", riskScore: 24, anomalyFlag: false, anomalyDesc: "",
      earningsSurprise: 5.8, sectorRotation: "INFLOW",
      radarData: [
        { subject: "Momentum", value: 69 }, { subject: "Value", value: 71 },
        { subject: "Growth", value: 64 }, { subject: "Quality", value: 86 },
        { subject: "Sentiment", value: 62 }, { subject: "Technicals", value: 68 },
      ],
      priceHistory: [
        { t: "Aug", v: 1520 }, { t: "Sep", v: 1548 }, { t: "Oct", v: 1580 }, { t: "Nov", v: 1610 },
        { t: "Dec", v: 1650 }, { t: "Jan", v: 1690 }, { t: "Feb", v: 1720 }, { t: "Mar", v: 1760 },
        { t: "Apr", v: 1795 }, { t: "May", v: 1820 },
      ],
      newsFeed: [
        { headline: "Infosys wins $2.1B Siemens digital transformation deal", source: "ET", sentiment: "pos", ago: "4h" },
        { headline: "FY26 revenue guidance raised to 6-8% in constant currency", source: "Mint", sentiment: "pos", ago: "8h" },
        { headline: "Headcount additions resume after 6-quarter freeze", source: "BS", sentiment: "pos", ago: "1d" },
        { headline: "Margin pressure from wage hikes could weigh on Q2", source: "NDTV Profit", sentiment: "neg", ago: "2d" },
      ],
      socialSources: [
        { source: "Reddit", score: 71, color: "#ff4500" },
        { source: "Twitter/X", score: 63, color: "#1da1f2" },
        { source: "StockTwits", score: 67, color: "#8FFFD6" },
      ],
    },
  ],

  CRYPTO: [
    {
      symbol: "BTC", name: "Bitcoin", color: "#f7931a", bg: "#f7931a18", letter: "₿",
      signal: "BUY", signalStrength: 86, sentiment: 72, sentimentLabel: "Very Bullish",
      newsCount: 94, socialScore: 96, priceTarget: "$112,000", currentPrice: "$96,400", upside: 16.2,
      riskRating: "HIGH", riskScore: 61, anomalyFlag: true,
      anomalyDesc: "Whale wallets accumulated 18,400 BTC in 72h — largest since Nov 2023",
      earningsSurprise: null, sectorRotation: "INFLOW",
      radarData: [
        { subject: "Momentum", value: 88 }, { subject: "Value", value: 52 },
        { subject: "Growth", value: 91 }, { subject: "Quality", value: 94 },
        { subject: "Sentiment", value: 86 }, { subject: "Technicals", value: 82 },
      ],
      priceHistory: [
        { t: "Aug", v: 58000 }, { t: "Sep", v: 61000 }, { t: "Oct", v: 67000 }, { t: "Nov", v: 74000 },
        { t: "Dec", v: 88000 }, { t: "Jan", v: 97000 }, { t: "Feb", v: 84000 }, { t: "Mar", v: 88000 },
        { t: "Apr", v: 93000 }, { t: "May", v: 96400 },
      ],
      newsFeed: [
        { headline: "BlackRock BTC ETF records $1.2B single-day inflow", source: "Bloomberg", sentiment: "pos", ago: "3h" },
        { headline: "US Strategic Bitcoin Reserve bill advances in Senate", source: "Reuters", sentiment: "pos", ago: "6h" },
        { headline: "Halving supply shock effects fully priced in — analyst", source: "CoinDesk", sentiment: "neu", ago: "10h" },
        { headline: "Mt. Gox creditor distribution resumes — 8,000 BTC moved", source: "The Block", sentiment: "neg", ago: "1d" },
      ],
      socialSources: [
        { source: "Reddit", score: 94, color: "#ff4500" },
        { source: "Twitter/X", score: 97, color: "#1da1f2" },
        { source: "StockTwits", score: 91, color: "#8FFFD6" },
      ],
    },
    {
      symbol: "ETH", name: "Ethereum", color: "#627eea", bg: "#627eea18", letter: "Ξ",
      signal: "BUY", signalStrength: 74, sentiment: 58, sentimentLabel: "Bullish",
      newsCount: 61, socialScore: 82, priceTarget: "$4,200", currentPrice: "$3,580", upside: 17.3,
      riskRating: "HIGH", riskScore: 58, anomalyFlag: false, anomalyDesc: "",
      earningsSurprise: null, sectorRotation: "INFLOW",
      radarData: [
        { subject: "Momentum", value: 72 }, { subject: "Value", value: 64 },
        { subject: "Growth", value: 84 }, { subject: "Quality", value: 88 },
        { subject: "Sentiment", value: 76 }, { subject: "Technicals", value: 70 },
      ],
      priceHistory: [
        { t: "Aug", v: 2600 }, { t: "Sep", v: 2750 }, { t: "Oct", v: 2900 }, { t: "Nov", v: 3100 },
        { t: "Dec", v: 3400 }, { t: "Jan", v: 3200 }, { t: "Feb", v: 2900 }, { t: "Mar", v: 3100 },
        { t: "Apr", v: 3350 }, { t: "May", v: 3580 },
      ],
      newsFeed: [
        { headline: "Ethereum ETF sees $480M weekly inflow — record high", source: "Bloomberg", sentiment: "pos", ago: "2h" },
        { headline: "Pectra upgrade cuts validator exit times by 60%", source: "CoinDesk", sentiment: "pos", ago: "7h" },
        { headline: "Layer 2 TVL surpasses $60B — Ethereum dominance grows", source: "DeFiLlama", sentiment: "pos", ago: "12h" },
        { headline: "SEC clarifies ETH staking rewards taxability guidance", source: "Reuters", sentiment: "neu", ago: "2d" },
      ],
      socialSources: [
        { source: "Reddit", score: 84, color: "#ff4500" },
        { source: "Twitter/X", score: 80, color: "#1da1f2" },
        { source: "StockTwits", score: 78, color: "#8FFFD6" },
      ],
    },
    {
      symbol: "SOL", name: "Solana", color: "#9945ff", bg: "#9945ff18", letter: "◎",
      signal: "BUY", signalStrength: 79, sentiment: 64, sentimentLabel: "Bullish",
      newsCount: 48, socialScore: 88, priceTarget: "$240", currentPrice: "$188", upside: 27.7,
      riskRating: "HIGH", riskScore: 66, anomalyFlag: true,
      anomalyDesc: "DEX volume 3.8× 30-day average — meme coin season activity spike",
      earningsSurprise: null, sectorRotation: "INFLOW",
      radarData: [
        { subject: "Momentum", value: 84 }, { subject: "Value", value: 48 },
        { subject: "Growth", value: 92 }, { subject: "Quality", value: 74 },
        { subject: "Sentiment", value: 81 }, { subject: "Technicals", value: 78 },
      ],
      priceHistory: [
        { t: "Aug", v: 98 }, { t: "Sep", v: 112 }, { t: "Oct", v: 128 }, { t: "Nov", v: 148 },
        { t: "Dec", v: 168 }, { t: "Jan", v: 184 }, { t: "Feb", v: 152 }, { t: "Mar", v: 164 },
        { t: "Apr", v: 178 }, { t: "May", v: 188 },
      ],
      newsFeed: [
        { headline: "Solana processes 65M daily transactions — new all-time high", source: "The Block", sentiment: "pos", ago: "4h" },
        { headline: "Firedancer validator client live on mainnet — latency halved", source: "CoinDesk", sentiment: "pos", ago: "8h" },
        { headline: "Franklin Templeton launches Solana ETF application", source: "Reuters", sentiment: "pos", ago: "1d" },
        { headline: "Network congestion returns during meme coin surge", source: "Decrypt", sentiment: "neg", ago: "2d" },
      ],
      socialSources: [
        { source: "Reddit", score: 88, color: "#ff4500" },
        { source: "Twitter/X", score: 91, color: "#1da1f2" },
        { source: "StockTwits", score: 84, color: "#8FFFD6" },
      ],
    },
    {
      symbol: "BNB", name: "BNB Chain", color: "#f3ba2f", bg: "#f3ba2f18", letter: "B",
      signal: "HOLD", signalStrength: 56, sentiment: 24, sentimentLabel: "Mildly Bullish",
      newsCount: 28, socialScore: 61, priceTarget: "$620", currentPrice: "$578", upside: 7.3,
      riskRating: "HIGH", riskScore: 62, anomalyFlag: false, anomalyDesc: "",
      earningsSurprise: null, sectorRotation: "NEUTRAL",
      radarData: [
        { subject: "Momentum", value: 58 }, { subject: "Value", value: 66 },
        { subject: "Growth", value: 54 }, { subject: "Quality", value: 62 },
        { subject: "Sentiment", value: 52 }, { subject: "Technicals", value: 56 },
      ],
      priceHistory: [
        { t: "Aug", v: 480 }, { t: "Sep", v: 492 }, { t: "Oct", v: 510 }, { t: "Nov", v: 524 },
        { t: "Dec", v: 548 }, { t: "Jan", v: 562 }, { t: "Feb", v: 541 }, { t: "Mar", v: 555 },
        { t: "Apr", v: 568 }, { t: "May", v: 578 },
      ],
      newsFeed: [
        { headline: "Binance receives regulatory approval in UAE for full operations", source: "Reuters", sentiment: "pos", ago: "5h" },
        { headline: "BNB burn reduces supply by 1.8M tokens in Q1", source: "CoinDesk", sentiment: "pos", ago: "9h" },
        { headline: "CZ's prison release fuels short-term BNB speculation", source: "Bloomberg", sentiment: "neu", ago: "1d" },
        { headline: "SEC enforcement action against Binance.US still pending", source: "WSJ", sentiment: "neg", ago: "3d" },
      ],
      socialSources: [
        { source: "Reddit", score: 64, color: "#ff4500" },
        { source: "Twitter/X", score: 59, color: "#1da1f2" },
        { source: "StockTwits", score: 62, color: "#8FFFD6" },
      ],
    },
    {
      symbol: "DOGE", name: "Dogecoin", color: "#c2a633", bg: "#c2a63318", letter: "Ð",
      signal: "SELL", signalStrength: 67, sentiment: -34, sentimentLabel: "Mildly Bearish",
      newsCount: 42, socialScore: 78, priceTarget: "$0.12", currentPrice: "$0.18", upside: -33.3,
      riskRating: "EXTREME", riskScore: 88, anomalyFlag: true,
      anomalyDesc: "Social volume 5.1× avg — historically precedes sharp reversal",
      earningsSurprise: null, sectorRotation: "OUTFLOW",
      radarData: [
        { subject: "Momentum", value: 42 }, { subject: "Value", value: 14 },
        { subject: "Growth", value: 22 }, { subject: "Quality", value: 18 },
        { subject: "Sentiment", value: 44 }, { subject: "Technicals", value: 31 },
      ],
      priceHistory: [
        { t: "Aug", v: 0.08 }, { t: "Sep", v: 0.09 }, { t: "Oct", v: 0.11 }, { t: "Nov", v: 0.14 },
        { t: "Dec", v: 0.22 }, { t: "Jan", v: 0.28 }, { t: "Feb", v: 0.21 }, { t: "Mar", v: 0.19 },
        { t: "Apr", v: 0.17 }, { t: "May", v: 0.18 },
      ],
      newsFeed: [
        { headline: "DOGE soars 18% on Elon Musk tweet — then gives back gains", source: "CoinDesk", sentiment: "neg", ago: "6h" },
        { headline: "D.O.G.E government dept rebranded — DOGE token unrelated", source: "Reuters", sentiment: "neu", ago: "10h" },
        { headline: "On-chain fundamentals show zero developer activity growth", source: "Messari", sentiment: "neg", ago: "1d" },
        { headline: "Retail FOMO buying accelerates despite analyst warnings", source: "Bloomberg", sentiment: "neg", ago: "2d" },
      ],
      socialSources: [
        { source: "Reddit", score: 72, color: "#ff4500" },
        { source: "Twitter/X", score: 84, color: "#1da1f2" },
        { source: "StockTwits", score: 68, color: "#8FFFD6" },
      ],
    },
    {
      symbol: "XRP", name: "Ripple XRP", color: "#00aae4", bg: "#00aae418", letter: "✕",
      signal: "HOLD", signalStrength: 62, sentiment: 38, sentimentLabel: "Mildly Bullish",
      newsCount: 35, socialScore: 72, priceTarget: "$0.72", currentPrice: "$0.61", upside: 18.0,
      riskRating: "HIGH", riskScore: 64, anomalyFlag: false, anomalyDesc: "",
      earningsSurprise: null, sectorRotation: "NEUTRAL",
      radarData: [
        { subject: "Momentum", value: 62 }, { subject: "Value", value: 58 },
        { subject: "Growth", value: 68 }, { subject: "Quality", value: 72 },
        { subject: "Sentiment", value: 64 }, { subject: "Technicals", value: 60 },
      ],
      priceHistory: [
        { t: "Aug", v: 0.42 }, { t: "Sep", v: 0.44 }, { t: "Oct", v: 0.48 }, { t: "Nov", v: 0.52 },
        { t: "Dec", v: 0.64 }, { t: "Jan", v: 0.72 }, { t: "Feb", v: 0.61 }, { t: "Mar", v: 0.58 },
        { t: "Apr", v: 0.60 }, { t: "May", v: 0.61 },
      ],
      newsFeed: [
        { headline: "Ripple wins summary judgment — SEC appeal narrowed", source: "Reuters", sentiment: "pos", ago: "3h" },
        { headline: "XRP Ledger processes $4.2B in institutional settlements in Q1", source: "CoinDesk", sentiment: "pos", ago: "7h" },
        { headline: "RLUSD stablecoin crosses $800M market cap in 60 days", source: "The Block", sentiment: "pos", ago: "1d" },
        { headline: "Legal uncertainty caps institutional adoption appetite", source: "Bloomberg", sentiment: "neg", ago: "3d" },
      ],
      socialSources: [
        { source: "Reddit", score: 74, color: "#ff4500" },
        { source: "Twitter/X", score: 70, color: "#1da1f2" },
        { source: "StockTwits", score: 68, color: "#8FFFD6" },
      ],
    },
    {
      symbol: "AVAX", name: "Avalanche", color: "#e84142", bg: "#e8414218", letter: "A",
      signal: "BUY", signalStrength: 68, sentiment: 46, sentimentLabel: "Bullish",
      newsCount: 22, socialScore: 64, priceTarget: "$52", currentPrice: "$38", upside: 36.8,
      riskRating: "EXTREME", riskScore: 82, anomalyFlag: false, anomalyDesc: "",
      earningsSurprise: null, sectorRotation: "INFLOW",
      radarData: [
        { subject: "Momentum", value: 66 }, { subject: "Value", value: 54 },
        { subject: "Growth", value: 78 }, { subject: "Quality", value: 68 },
        { subject: "Sentiment", value: 58 }, { subject: "Technicals", value: 64 },
      ],
      priceHistory: [
        { t: "Aug", v: 22 }, { t: "Sep", v: 24 }, { t: "Oct", v: 27 }, { t: "Nov", v: 32 },
        { t: "Dec", v: 38 }, { t: "Jan", v: 42 }, { t: "Feb", v: 34 }, { t: "Mar", v: 36 },
        { t: "Apr", v: 37 }, { t: "May", v: 38 },
      ],
      newsFeed: [
        { headline: "Avalanche9000 upgrade cuts subnet launch cost by 99.9%", source: "CoinDesk", sentiment: "pos", ago: "5h" },
        { headline: "Amazon AWS integrates Avalanche for enterprise blockchain", source: "The Block", sentiment: "pos", ago: "9h" },
        { headline: "Subnet ecosystem crosses 100 active chains milestone", source: "Decrypt", sentiment: "pos", ago: "1d" },
        { headline: "AVAX underperforms BTC and ETH YTD despite strong fundamentals", source: "Messari", sentiment: "neg", ago: "2d" },
      ],
      socialSources: [
        { source: "Reddit", score: 66, color: "#ff4500" },
        { source: "Twitter/X", score: 62, color: "#1da1f2" },
        { source: "StockTwits", score: 64, color: "#8FFFD6" },
      ],
    },
  ],

  FX: [
    {
      symbol: "EUR/USD", name: "Euro / US Dollar", color: "#3b82f6", bg: "#3b82f618", letter: "€",
      signal: "BUY", signalStrength: 69, sentiment: 44, sentimentLabel: "Bullish",
      newsCount: 24, socialScore: 61, priceTarget: "1.1240", currentPrice: "1.0890", upside: 3.2,
      riskRating: "LOW", riskScore: 24, anomalyFlag: false, anomalyDesc: "",
      earningsSurprise: null, sectorRotation: "INFLOW",
      radarData: [
        { subject: "Momentum", value: 68 }, { subject: "Value", value: 71 },
        { subject: "Growth", value: 55 }, { subject: "Quality", value: 82 },
        { subject: "Sentiment", value: 62 }, { subject: "Technicals", value: 74 },
      ],
      priceHistory: [
        { t: "Aug", v: 1.085 }, { t: "Sep", v: 1.072 }, { t: "Oct", v: 1.061 }, { t: "Nov", v: 1.058 },
        { t: "Dec", v: 1.048 }, { t: "Jan", v: 1.062 }, { t: "Feb", v: 1.071 }, { t: "Mar", v: 1.079 },
        { t: "Apr", v: 1.085 }, { t: "May", v: 1.089 },
      ],
      newsFeed: [
        { headline: "ECB signals end of rate cuts — EUR strengthens", source: "Reuters", sentiment: "pos", ago: "2h" },
        { headline: "Eurozone PMI surprises to upside at 52.4", source: "Bloomberg", sentiment: "pos", ago: "5h" },
        { headline: "USD weakens as Fed holds rates amid mixed jobs data", source: "FT", sentiment: "pos", ago: "9h" },
        { headline: "Political uncertainty in France caps EUR gains", source: "WSJ", sentiment: "neg", ago: "1d" },
      ],
      socialSources: [
        { source: "Reddit", score: 65, color: "#ff4500" },
        { source: "Twitter/X", score: 59, color: "#1da1f2" },
        { source: "StockTwits", score: 62, color: "#8FFFD6" },
      ],
    },
    {
      symbol: "USD/JPY", name: "US Dollar / Japanese Yen", color: "#f59e0b", bg: "#f59e0b18", letter: "¥",
      signal: "SELL", signalStrength: 74, sentiment: -52, sentimentLabel: "Bearish",
      newsCount: 31, socialScore: 55, priceTarget: "142.0", currentPrice: "157.8", upside: -10.0,
      riskRating: "HIGH", riskScore: 68, anomalyFlag: true,
      anomalyDesc: "BOJ intervention chatter — reserves data suggests readiness",
      earningsSurprise: null, sectorRotation: "OUTFLOW",
      radarData: [
        { subject: "Momentum", value: 24 }, { subject: "Value", value: 36 },
        { subject: "Growth", value: 42 }, { subject: "Quality", value: 58 },
        { subject: "Sentiment", value: 28 }, { subject: "Technicals", value: 22 },
      ],
      priceHistory: [
        { t: "Aug", v: 145 }, { t: "Sep", v: 148 }, { t: "Oct", v: 151 }, { t: "Nov", v: 149 },
        { t: "Dec", v: 153 }, { t: "Jan", v: 155 }, { t: "Feb", v: 152 }, { t: "Mar", v: 154 },
        { t: "Apr", v: 156 }, { t: "May", v: 157.8 },
      ],
      newsFeed: [
        { headline: "BOJ hawkish pivot: rate hike on table for June meeting", source: "Reuters", sentiment: "neg", ago: "1h" },
        { headline: "Japan CPI hits 3.2% — pressure mounts on Ueda", source: "Bloomberg", sentiment: "neg", ago: "4h" },
        { headline: "USD/JPY nears 160 — traders eye intervention threshold", source: "FT", sentiment: "neg", ago: "7h" },
        { headline: "US yields retreat slightly, offering yen brief respite", source: "WSJ", sentiment: "pos", ago: "12h" },
      ],
      socialSources: [
        { source: "Reddit", score: 34, color: "#ff4500" },
        { source: "Twitter/X", score: 52, color: "#1da1f2" },
        { source: "StockTwits", score: 38, color: "#8FFFD6" },
      ],
    },
    {
      symbol: "GBP/USD", name: "British Pound / US Dollar", color: "#8b5cf6", bg: "#8b5cf618", letter: "£",
      signal: "HOLD", signalStrength: 54, sentiment: 18, sentimentLabel: "Mildly Bullish",
      newsCount: 18, socialScore: 48, priceTarget: "1.2950", currentPrice: "1.2720", upside: 1.8,
      riskRating: "MEDIUM", riskScore: 44, anomalyFlag: false, anomalyDesc: "",
      earningsSurprise: null, sectorRotation: "NEUTRAL",
      radarData: [
        { subject: "Momentum", value: 52 }, { subject: "Value", value: 60 },
        { subject: "Growth", value: 46 }, { subject: "Quality", value: 70 },
        { subject: "Sentiment", value: 48 }, { subject: "Technicals", value: 54 },
      ],
      priceHistory: [
        { t: "Aug", v: 1.268 }, { t: "Sep", v: 1.272 }, { t: "Oct", v: 1.265 }, { t: "Nov", v: 1.258 },
        { t: "Dec", v: 1.254 }, { t: "Jan", v: 1.262 }, { t: "Feb", v: 1.268 }, { t: "Mar", v: 1.271 },
        { t: "Apr", v: 1.270 }, { t: "May", v: 1.272 },
      ],
      newsFeed: [
        { headline: "UK inflation cools to 2.3% — BoE rate cut path clearer", source: "Reuters", sentiment: "pos", ago: "4h" },
        { headline: "UK-EU trade deal talks resume after 2-year impasse", source: "FT", sentiment: "pos", ago: "8h" },
        { headline: "BoE holds at 4.75% — two dissenters vote for cut", source: "Bloomberg", sentiment: "neu", ago: "1d" },
        { headline: "UK GDP growth revised down to 0.1% in Q4", source: "WSJ", sentiment: "neg", ago: "2d" },
      ],
      socialSources: [
        { source: "Reddit", score: 51, color: "#ff4500" },
        { source: "Twitter/X", score: 48, color: "#1da1f2" },
        { source: "StockTwits", score: 46, color: "#8FFFD6" },
      ],
    },
  ],
};

// ─── Sector Rotation ──────────────────────────────────────────────────────────

const SECTOR_DATA: Record<MarketId, { sector: string; flow: number }[]> = {
  US: [
    { sector: "Technology", flow: 84 }, { sector: "Energy", flow: 61 },
    { sector: "Healthcare", flow: 45 }, { sector: "Financials", flow: 38 },
    { sector: "Consumer", flow: -12 }, { sector: "Real Estate", flow: -28 },
    { sector: "Utilities", flow: -41 },
  ],
  IN: [
    { sector: "IT", flow: 72 }, { sector: "Banking", flow: 65 },
    { sector: "Energy", flow: 58 }, { sector: "Auto", flow: 42 },
    { sector: "FMCG", flow: -8 }, { sector: "Realty", flow: -22 },
    { sector: "Metals", flow: -34 },
  ],
  CRYPTO: [
    { sector: "L1 Chains", flow: 88 }, { sector: "DeFi", flow: 72 },
    { sector: "AI Tokens", flow: 64 }, { sector: "Gaming", flow: 31 },
    { sector: "Stablecoins", flow: 12 }, { sector: "Meme Coins", flow: -28 },
    { sector: "Privacy", flow: -44 },
  ],
  FX: [
    { sector: "EUR", flow: 62 }, { sector: "GBP", flow: 48 },
    { sector: "AUD", flow: 31 }, { sector: "CHF", flow: 18 },
    { sector: "JPY", flow: -44 }, { sector: "CAD", flow: -21 },
    { sector: "EM FX", flow: -38 },
  ],
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function signalColor(s: SignalType) {
  return s === "BUY" ? "#22c55e" : s === "SELL" ? "#ef4444" : "#f59e0b";
}
function riskColor(r: StockInsight["riskRating"]) {
  return r === "LOW" ? "#22c55e" : r === "MEDIUM" ? "#f59e0b" : r === "HIGH" ? "#ef4444" : "#a855f7";
}
function sentimentColor(v: number) {
  return v > 30 ? "#22c55e" : v < -30 ? "#ef4444" : "#f59e0b";
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SentimentBar({ value }: { value: number }) {
  const norm = (value + 100) / 200;
  const col = sentimentColor(value);
  return (
    <div className="relative h-1.5 rounded-full" style={{ background: "#1f1f1f" }}>
      <div className="absolute top-0 left-1/2 h-full w-px" style={{ background: "#333" }} />
      <div className="absolute top-0 h-full rounded-full transition-all duration-700"
        style={{ left: value < 0 ? `${norm * 100}%` : "50%", width: `${Math.abs(value) / 2}%`, background: col }} />
      <div className="absolute -top-0.5 h-2 w-0.5 rounded-full"
        style={{ left: `${norm * 100}%`, background: col }} />
    </div>
  );
}

function MiniSparkline({ data, color }: { data: { t: string; v: number }[]; color: string }) {
  const id = `sg${color.replace(/[^a-z0-9]/gi, "")}`;
  return (
    <ResponsiveContainer width="100%" height={48}>
      <AreaChart data={data} margin={{ top: 4, right: 0, bottom: 0, left: 0 }}>
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={color} stopOpacity={0.25} />
            <stop offset="95%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <Area type="monotone" dataKey="v" stroke={color} strokeWidth={1.5}
          fill={`url(#${id})`} dot={false} isAnimationActive={false} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

function SignalMeter({ value, signal }: { value: number; signal: SignalType }) {
  const col = signalColor(signal);
  const c = 2 * Math.PI * 28;
  return (
    <div className="relative flex items-center justify-center" style={{ width: 72, height: 72 }}>
      <svg width="72" height="72" viewBox="0 0 72 72" style={{ transform: "rotate(-90deg)" }}>
        <circle cx="36" cy="36" r="28" fill="none" stroke="#1f1f1f" strokeWidth="5" />
        <circle cx="36" cy="36" r="28" fill="none" stroke={col} strokeWidth="5"
          strokeDasharray={c} strokeDashoffset={c * (1 - value / 100)}
          strokeLinecap="round" style={{ transition: "stroke-dashoffset 1s ease" }} />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className="text-white font-bold text-sm leading-none">{value}</span>
        <span className="text-[9px] font-semibold mt-0.5" style={{ color: col }}>{signal}</span>
      </div>
    </div>
  );
}

function useMlData(symbol: string | null) {
  const [mlData, setMlData] = useState<any>(null);
  const [mlLoading, setMlLoading] = useState(false);

  useEffect(() => {
    if (!symbol) return;
    setMlLoading(true);
    fetch(`http://localhost:8082/ml/full/${symbol}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { setMlData(d); setMlLoading(false); })
      .catch(() => setMlLoading(false));
  }, [symbol]);

  return { mlData, mlLoading };
}

function InsightCard({ s, expanded, onToggle }: { s: StockInsight; expanded: boolean; onToggle: () => void }) {
  const { mlData, mlLoading } = useMlData(expanded ? s.symbol : null);  return (
    <div className="rounded-2xl cursor-pointer transition-all duration-300"
      style={{ background: "#111111", border: `1px solid ${expanded ? s.color + "44" : "#1f1f1f"}`, overflow: "hidden" }}
      onClick={onToggle}>

      <div className="p-4 flex items-center gap-4">
        <div className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0"
          style={{ background: s.bg, color: s.color, border: `1px solid ${s.color}33` }}>
          {s.letter || s.symbol.charAt(0)}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-white font-semibold text-sm leading-none">{s.symbol}</p>
          <p className="text-[#555] text-[11px] mt-0.5 truncate">{s.name}</p>
        </div>
        <div className="w-24 hidden sm:block">
          <MiniSparkline data={s.priceHistory} color={s.upside >= 0 ? "#22c55e" : "#ef4444"} />
        </div>
        <div className="text-right hidden md:block">
          <p className="text-white font-bold text-sm">{s.currentPrice}</p>
          <p className="text-[11px] font-semibold" style={{ color: s.upside >= 0 ? "#22c55e" : "#ef4444" }}>
            {s.upside >= 0 ? "▲" : "▼"} {Math.abs(s.upside)}%
          </p>
        </div>
        <SignalMeter value={s.signalStrength} signal={s.signal} />
        <div className="hidden lg:flex flex-col gap-1 items-end">
          <div className="flex items-center gap-2">
            <div className="flex gap-0.5">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="w-1.5 rounded-sm"
                  style={{ height: 6 + i * 3, background: s.riskScore > i * 25 ? riskColor(s.riskRating) : "#1f1f1f" }} />
              ))}
            </div>
            <span className="text-xs font-bold" style={{ color: riskColor(s.riskRating) }}>{s.riskRating}</span>
          </div>
          {s.anomalyFlag && (
            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full"
              style={{ background: "#f59e0b18", color: "#f59e0b" }}>⚡ ANOMALY</span>
          )}
        </div>
        <div className="ml-1 text-[#333] transition-transform duration-300"
          style={{ transform: expanded ? "rotate(180deg)" : "rotate(0deg)" }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </div>
      </div>

      <div className="px-4 pb-3">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[#444] text-[10px]">Bearish</span>
          <span className="text-[11px] font-semibold" style={{ color: sentimentColor(s.sentiment) }}>{s.sentimentLabel}</span>
          <span className="text-[#444] text-[10px]">Bullish</span>
        </div>
        <SentimentBar value={s.sentiment} />
      </div>

      {expanded && (
        <div className="px-4 pb-4 border-t" style={{ borderColor: "#1a1a1a" }} onClick={(e) => e.stopPropagation()}>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mt-4">

            <div className="flex flex-col gap-3">
              <p className="text-[#555] text-[10px] font-semibold uppercase tracking-wider">Factor Radar</p>
              <ResponsiveContainer width="100%" height={180}>
                <RadarChart data={s.radarData}>
                  <PolarGrid stroke="#1f1f1f" />
                  <PolarAngleAxis dataKey="subject" tick={{ fill: "#444", fontSize: 9 }} />
                  <Radar dataKey="value" stroke={s.color} fill={s.color} fillOpacity={0.15} strokeWidth={1.5} />
                </RadarChart>
              </ResponsiveContainer>
              {s.earningsSurprise !== null && (
                <div className="rounded-xl p-3" style={{ background: "#0d0d0d", border: "1px solid #1f1f1f" }}>
                  <p className="text-[#555] text-[10px] mb-1">Earnings Surprise</p>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-base" style={{ color: s.earningsSurprise >= 0 ? "#22c55e" : "#ef4444" }}>
                      {s.earningsSurprise >= 0 ? "+" : ""}{s.earningsSurprise}%
                    </span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full"
                      style={{ background: s.earningsSurprise >= 0 ? "#22c55e18" : "#ef444418", color: s.earningsSurprise >= 0 ? "#22c55e" : "#ef4444" }}>
                      vs consensus
                    </span>
                  </div>
                </div>
              )}
              {s.anomalyFlag && (
                <div className="flex items-start gap-2 px-3 py-2 rounded-xl"
                  style={{ background: "#f59e0b0e", border: "1px solid #f59e0b33" }}>
                  <span className="text-sm mt-0.5">⚡</span>
                  <p className="text-[11px] leading-snug" style={{ color: "#f59e0b" }}>{s.anomalyDesc}</p>
                </div>
              )}
            </div>

            <div className="flex flex-col gap-3">
              <p className="text-[#555] text-[10px] font-semibold uppercase tracking-wider">Sentiment Sources</p>
              {s.socialSources.map((src) => (
                <div key={src.source}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[#888] text-xs">{src.source}</span>
                    <span className="text-white text-xs font-bold">{src.score}</span>
                  </div>
                  <div className="h-1.5 rounded-full" style={{ background: "#1f1f1f" }}>
                    <div className="h-full rounded-full transition-all duration-700"
                      style={{ width: `${src.score}%`, background: src.color }} />
                  </div>
                </div>
              ))}
              <div className="rounded-xl p-3 mt-1" style={{ background: "#0d0d0d", border: "1px solid #1f1f1f" }}>
                <div className="flex items-center justify-between">
                  <span className="text-[#555] text-[10px]">News articles (24h)</span>
                  <span className="text-white font-bold text-sm">{s.newsCount}</span>
                </div>
                <div className="flex items-center justify-between mt-1">
                  <span className="text-[#555] text-[10px]">Social mentions</span>
                  <span className="text-white font-bold text-sm">{(s.socialScore * 120).toLocaleString()}</span>
                </div>
              </div>
              <div className="rounded-xl p-3" style={{ background: "#0d0d0d", border: "1px solid #1f1f1f" }}>
                <p className="text-[#555] text-[10px] mb-1">ML Price Target (30d)</p>
                {mlLoading ? (
                  <p className="text-[#555] text-xs">Fetching ML data…</p>
                ) : mlData ? (
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-white font-bold text-base">${mlData.prediction.next_week.toFixed(2)}</span>
                      <span className="text-xs font-semibold" style={{ color: mlData.prediction.next_week_change_pct >= 0 ? "#22c55e" : "#ef4444" }}>
                        {mlData.prediction.next_week_change_pct >= 0 ? "↑" : "↓"} {Math.abs(mlData.prediction.next_week_change_pct)}% (7d)
                      </span>
                    </div>
                    <p className="text-[10px] mt-1" style={{ color: mlData.signal.signal_color }}>
                      Signal: {mlData.signal.signal} · Strength: {mlData.signal.strength}%
                    </p>
                    <p className="text-[#555] text-[10px] mt-1">RSI: {mlData.prediction.rsi} · Confidence: {mlData.prediction.confidence}%</p>
                    {mlData.anomaly.is_anomaly && (
                      <p className="text-[10px] mt-1" style={{ color: "#f59e0b" }}>⚡ {mlData.anomaly.summary}</p>
                    )}
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <span className="text-white font-bold text-base">{s.priceTarget}</span>
                    <span className="text-xs font-semibold" style={{ color: s.upside >= 0 ? "#22c55e" : "#ef4444" }}>
                      {s.upside >= 0 ? "↑" : "↓"} {Math.abs(s.upside)}% upside
                    </span>
                  </div>
                )}
              </div>
            </div>

            <div className="flex flex-col gap-3">
              <p className="text-[#555] text-[10px] font-semibold uppercase tracking-wider">News Feed</p>
              <div className="flex flex-col gap-2">
                {s.newsFeed.map((n, i) => (
                  <div key={i} className="flex gap-2.5 p-2.5 rounded-xl"
                    style={{ background: "#0d0d0d", border: "1px solid #1a1a1a" }}>
                    <div className="w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0"
                      style={{ background: n.sentiment === "pos" ? "#22c55e" : n.sentiment === "neg" ? "#ef4444" : "#555" }} />
                    <div className="flex-1 min-w-0">
                      <p className="text-white text-[11px] leading-snug">{n.headline}</p>
                      <div className="flex items-center gap-1.5 mt-1">
                        <span className="text-[#444] text-[9px]">{n.source}</span>
                        <span className="text-[#333] text-[9px]">·</span>
                        <span className="text-[#444] text-[9px]">{n.ago}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function SectorRotationPanel({ marketKey }: { marketKey: MarketId }) {
  const data = SECTOR_DATA[marketKey];
  const maxAbs = Math.max(...data.map((d) => Math.abs(d.flow)));
  return (
    <div className="rounded-2xl p-5" style={{ background: "#111111", border: "1px solid #1f1f1f" }}>
      <div className="flex items-center justify-between mb-4">
        <p className="text-white font-semibold text-sm">Sector Rotation</p>
        <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold"
          style={{ background: "#8FFFD618", color: "#8FFFD6" }}>7D FLOW</span>
      </div>
      <div className="flex flex-col gap-2">
        {data.map((d) => {
          const pct = (Math.abs(d.flow) / maxAbs) * 100;
          const isIn = d.flow >= 0;
          return (
            <div key={d.sector} className="flex items-center gap-3">
              <span className="text-[#888] text-xs w-24 text-right flex-shrink-0">{d.sector}</span>
              <div className="flex-1 flex items-center" style={{ height: 20 }}>
                <div className="flex-1 flex justify-end">
                  {!isIn && <div className="h-3 rounded-l-sm" style={{ width: `${pct}%`, background: "#ef444444" }} />}
                </div>
                <div className="w-px h-4 flex-shrink-0" style={{ background: "#333" }} />
                <div className="flex-1">
                  {isIn && <div className="h-3 rounded-r-sm" style={{ width: `${pct}%`, background: "#22c55e44" }} />}
                </div>
              </div>
              <span className="text-xs font-bold w-12 flex-shrink-0" style={{ color: isIn ? "#22c55e" : "#ef4444" }}>
                {isIn ? "+" : ""}{d.flow}%
              </span>
            </div>
          );
        })}
      </div>
      <div className="flex items-center justify-between mt-3">
        <span className="text-[#444] text-[9px]">← OUTFLOW</span>
        <span className="text-[#444] text-[9px]">INFLOW →</span>
      </div>
    </div>
  );
}

function MarketPulse({ insights, marketKey }: { insights: StockInsight[]; marketKey: MarketId }) {
  const buy  = insights.filter((s) => s.signal === "BUY").length;
  const sell = insights.filter((s) => s.signal === "SELL").length;
  const hold = insights.filter((s) => s.signal === "HOLD").length;
  const avg  = Math.round(insights.reduce((a, s) => a + s.sentiment, 0) / insights.length);
  const labels: Record<MarketId, string> = { US: "NASDAQ 100", IN: "Nifty 50", CRYPTO: "Top Crypto", FX: "Major Pairs" };
  return (
    <div className="rounded-2xl p-5" style={{ background: "#111111", border: "1px solid #1f1f1f" }}>
      <div className="flex items-center gap-2 mb-4">
        <div className="w-2 h-2 rounded-full animate-pulse" style={{ background: "#8FFFD6" }} />
        <p className="text-white font-semibold text-sm">Market Pulse — {labels[marketKey]}</p>
        <span className="text-[10px] px-2 py-0.5 rounded-full ml-auto"
          style={{ background: "#8FFFD618", color: "#8FFFD6" }}>LIVE ML</span>
      </div>
      <div className="grid grid-cols-4 gap-3">
        {[
          { val: buy,  label: "BUY signals",  col: "#22c55e" },
          { val: hold, label: "HOLD signals", col: "#f59e0b" },
          { val: sell, label: "SELL signals", col: "#ef4444" },
          { val: `${avg > 0 ? "+" : ""}${avg}`, label: "Avg sentiment", col: sentimentColor(avg) },
        ].map(({ val, label, col }) => (
          <div key={label} className="rounded-xl p-3 text-center" style={{ background: "#0d0d0d" }}>
            <p className="text-2xl font-bold" style={{ color: col }}>{val}</p>
            <p className="text-[10px] text-[#555] mt-0.5">{label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function InsightsPage() {
  const { market } = useMarket();
  const key = market.id as MarketId;
  const insights = INSIGHTS_DATA[key] ?? INSIGHTS_DATA["US"];

  const [expandedIdx, setExpandedIdx] = useState<number | null>(0);
  const [filterSignal, setFilterSignal] = useState<SignalType | "ALL">("ALL");

  const filtered = filterSignal === "ALL" ? insights : insights.filter((s) => s.signal === filterSignal);

  return (
    <div className="min-h-screen p-5 flex flex-col gap-4"
      style={{ background: "#0a0a0a", fontFamily: "'Geist', 'Inter', sans-serif" }}>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-white font-bold text-xl tracking-tight">AI Insights</h1>
          <p className="text-[#555] text-xs mt-0.5">ML-powered signals · {market.flag} {market.label}</p>
        </div>
        <div className="flex items-center gap-1.5">
          {(["ALL", "BUY", "HOLD", "SELL"] as const).map((f) => (
            <button key={f} onClick={() => { setFilterSignal(f); setExpandedIdx(null); }}
              className="px-3 py-1.5 rounded-full text-xs font-semibold transition-all"
              style={{
                background: filterSignal === f
                  ? f === "ALL" ? "#fff" : f === "BUY" ? "#22c55e" : f === "SELL" ? "#ef4444" : "#f59e0b"
                  : "#111",
                color: filterSignal === f ? "#000" : "#555",
                border: filterSignal === f ? "none" : "1px solid #1f1f1f",
              }}>
              {f}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-4" style={{ gridTemplateColumns: "1fr 340px" }}>
        <MarketPulse insights={insights} marketKey={key} />
        <SectorRotationPanel marketKey={key} />
      </div>

      <div className="flex flex-col gap-3">
        {filtered.length === 0 && (
          <div className="rounded-2xl p-8 text-center" style={{ background: "#111111", border: "1px solid #1f1f1f" }}>
            <p className="text-[#555] text-sm">No {filterSignal} signals for {market.label} right now.</p>
          </div>
        )}
        {filtered.map((s, i) => (
          <InsightCard key={s.symbol} s={s}
            expanded={expandedIdx === i}
            onToggle={() => setExpandedIdx(expandedIdx === i ? null : i)} />
        ))}
      </div>

      <p className="text-[#333] text-[10px] text-center pb-2">
        StockSense AI Insights are for informational purposes only and do not constitute financial advice.
      </p>
    </div>
  );
}