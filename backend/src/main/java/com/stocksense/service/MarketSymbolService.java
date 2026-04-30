package com.stocksense.service;

import org.springframework.cache.annotation.Cacheable;
import org.springframework.stereotype.Service;

import java.util.*;

/**
 * Static registry of all tradeable symbols per market.
 * Symbol lists are comprehensive and cached for 24h.
 * Prices are fetched live via AlphaVantageService.
 */
@Service
public class MarketSymbolService {

    // ── NIFTY 50 (NSE India) ──────────────────────────────────────────────────
    public static final List<Map<String, String>> NIFTY_50 = List.of(
        sym("RELIANCE.BSE",  "Reliance Industries",      "Energy"),
        sym("TCS.BSE",       "Tata Consultancy Services","IT"),
        sym("HDFCBANK.BSE",  "HDFC Bank",                "Banking"),
        sym("INFY.BSE",      "Infosys",                  "IT"),
        sym("ICICIBANK.BSE", "ICICI Bank",               "Banking"),
        sym("HINDUNILVR.BSE","Hindustan Unilever",       "FMCG"),
        sym("ITC.BSE",       "ITC Limited",              "FMCG"),
        sym("SBIN.BSE",      "State Bank of India",      "Banking"),
        sym("BHARTIARTL.BSE","Bharti Airtel",            "Telecom"),
        sym("KOTAKBANK.BSE", "Kotak Mahindra Bank",      "Banking"),
        sym("LT.BSE",        "Larsen & Toubro",          "Infrastructure"),
        sym("AXISBANK.BSE",  "Axis Bank",                "Banking"),
        sym("ASIANPAINT.BSE","Asian Paints",             "Consumer"),
        sym("MARUTI.BSE",    "Maruti Suzuki",            "Auto"),
        sym("BAJFINANCE.BSE","Bajaj Finance",            "Finance"),
        sym("TITAN.BSE",     "Titan Company",            "Consumer"),
        sym("WIPRO.BSE",     "Wipro",                    "IT"),
        sym("ULTRACEMCO.BSE","UltraTech Cement",         "Cement"),
        sym("NESTLEIND.BSE", "Nestle India",             "FMCG"),
        sym("POWERGRID.BSE", "Power Grid Corporation",   "Energy"),
        sym("NTPC.BSE",      "NTPC Limited",             "Energy"),
        sym("TECHM.BSE",     "Tech Mahindra",            "IT"),
        sym("SUNPHARMA.BSE", "Sun Pharmaceutical",       "Pharma"),
        sym("HCLTECH.BSE",   "HCL Technologies",         "IT"),
        sym("ONGC.BSE",      "Oil & Natural Gas Corp",   "Energy"),
        sym("TATAMOTORS.BSE","Tata Motors",              "Auto"),
        sym("TATASTEEL.BSE", "Tata Steel",               "Metals"),
        sym("JSWSTEEL.BSE",  "JSW Steel",                "Metals"),
        sym("ADANIENT.BSE",  "Adani Enterprises",        "Conglomerate"),
        sym("ADANIPORTS.BSE","Adani Ports",              "Infrastructure"),
        sym("COALINDIA.BSE", "Coal India",               "Energy"),
        sym("BAJAJFINSV.BSE","Bajaj Finserv",            "Finance"),
        sym("DIVISLAB.BSE",  "Divi's Laboratories",      "Pharma"),
        sym("DRREDDY.BSE",   "Dr. Reddy's Labs",         "Pharma"),
        sym("CIPLA.BSE",     "Cipla",                    "Pharma"),
        sym("EICHERMOT.BSE", "Eicher Motors",            "Auto"),
        sym("HEROMOTOCO.BSE","Hero MotoCorp",            "Auto"),
        sym("BPCL.BSE",      "BPCL",                    "Energy"),
        sym("BRITANNIA.BSE", "Britannia Industries",     "FMCG"),
        sym("GRASIM.BSE",    "Grasim Industries",        "Diversified"),
        sym("HINDALCO.BSE",  "Hindalco Industries",      "Metals"),
        sym("INDUSINDBK.BSE","IndusInd Bank",            "Banking"),
        sym("M&M.BSE",       "Mahindra & Mahindra",      "Auto"),
        sym("SBILIFE.BSE",   "SBI Life Insurance",       "Insurance"),
        sym("HDFCLIFE.BSE",  "HDFC Life Insurance",      "Insurance"),
        sym("APOLLOHOSP.BSE","Apollo Hospitals",         "Healthcare"),
        sym("TATACONSUM.BSE","Tata Consumer Products",   "FMCG"),
        sym("UPL.BSE",       "UPL Limited",              "Agri"),
        sym("SHREECEM.BSE",  "Shree Cement",             "Cement"),
        sym("BAJAJ-AUTO.BSE","Bajaj Auto",               "Auto")
    );

    // ── NASDAQ 100 (US) ───────────────────────────────────────────────────────
    public static final List<Map<String, String>> NASDAQ_100 = List.of(
        sym("AAPL",  "Apple Inc.",                "Technology"),
        sym("MSFT",  "Microsoft Corporation",     "Technology"),
        sym("NVDA",  "NVIDIA Corporation",        "Semiconductors"),
        sym("AMZN",  "Amazon.com Inc.",           "Consumer"),
        sym("META",  "Meta Platforms",            "Technology"),
        sym("GOOGL", "Alphabet Inc. Class A",     "Technology"),
        sym("GOOG",  "Alphabet Inc. Class C",     "Technology"),
        sym("TSLA",  "Tesla Inc.",                "Auto"),
        sym("AVGO",  "Broadcom Inc.",             "Semiconductors"),
        sym("COST",  "Costco Wholesale",          "Retail"),
        sym("NFLX",  "Netflix Inc.",              "Media"),
        sym("AMD",   "Advanced Micro Devices",    "Semiconductors"),
        sym("ADBE",  "Adobe Inc.",                "Technology"),
        sym("QCOM",  "Qualcomm Inc.",             "Semiconductors"),
        sym("INTC",  "Intel Corporation",         "Semiconductors"),
        sym("INTU",  "Intuit Inc.",               "Technology"),
        sym("CSCO",  "Cisco Systems",             "Technology"),
        sym("AMAT",  "Applied Materials",         "Semiconductors"),
        sym("MU",    "Micron Technology",         "Semiconductors"),
        sym("LRCX",  "Lam Research",              "Semiconductors"),
        sym("PANW",  "Palo Alto Networks",        "Cybersecurity"),
        sym("KLAC",  "KLA Corporation",           "Semiconductors"),
        sym("SNPS",  "Synopsys Inc.",             "Technology"),
        sym("CDNS",  "Cadence Design Systems",    "Technology"),
        sym("MRVL",  "Marvell Technology",        "Semiconductors"),
        sym("PYPL",  "PayPal Holdings",           "Fintech"),
        sym("NXPI",  "NXP Semiconductors",        "Semiconductors"),
        sym("ASML",  "ASML Holding",              "Semiconductors"),
        sym("ON",    "ON Semiconductor",          "Semiconductors"),
        sym("MCHP",  "Microchip Technology",      "Semiconductors"),
        sym("PCAR",  "PACCAR Inc.",               "Industrial"),
        sym("ORLY",  "O'Reilly Automotive",       "Retail"),
        sym("ADP",   "Automatic Data Processing", "Technology"),
        sym("CTAS",  "Cintas Corporation",        "Services"),
        sym("REGN",  "Regeneron Pharmaceuticals", "Biotech"),
        sym("BIIB",  "Biogen Inc.",               "Biotech"),
        sym("GILD",  "Gilead Sciences",           "Biotech"),
        sym("VRTX",  "Vertex Pharmaceuticals",    "Biotech"),
        sym("AMGN",  "Amgen Inc.",                "Biotech"),
        sym("ISRG",  "Intuitive Surgical",        "Healthcare"),
        sym("IDXX",  "IDEXX Laboratories",        "Healthcare"),
        sym("DXCM",  "DexCom Inc.",               "Healthcare"),
        sym("ILMN",  "Illumina Inc.",             "Healthcare"),
        sym("MRNA",  "Moderna Inc.",              "Biotech"),
        sym("SHOP",  "Shopify Inc.",              "Ecommerce"),
        sym("UBER",  "Uber Technologies",         "Transport"),
        sym("ABNB",  "Airbnb Inc.",               "Travel"),
        sym("ZM",    "Zoom Video Communications", "Technology"),
        sym("COIN",  "Coinbase Global",           "Fintech"),
        sym("HOOD",  "Robinhood Markets",         "Fintech"),
        sym("CRWD",  "CrowdStrike Holdings",      "Cybersecurity"),
        sym("SNOW",  "Snowflake Inc.",            "Cloud"),
        sym("DDOG",  "Datadog Inc.",              "Cloud"),
        sym("NET",   "Cloudflare Inc.",           "Cloud"),
        sym("OKTA",  "Okta Inc.",                 "Cybersecurity"),
        sym("TEAM",  "Atlassian Corporation",     "Technology"),
        sym("WDAY",  "Workday Inc.",              "Cloud"),
        sym("NOW",   "ServiceNow Inc.",           "Cloud"),
        sym("CRM",   "Salesforce Inc.",           "Cloud"),
        sym("ORCL",  "Oracle Corporation",        "Technology"),
        sym("IBM",   "IBM Corporation",           "Technology"),
        sym("ANET",  "Arista Networks",           "Technology"),
        sym("FTNT",  "Fortinet Inc.",             "Cybersecurity"),
        sym("SMCI",  "Super Micro Computer",      "Technology"),
        sym("ARM",   "Arm Holdings",              "Semiconductors"),
        sym("PLTR",  "Palantir Technologies",     "AI/Data"),
        sym("AI",    "C3.ai Inc.",                "AI/Data"),
        sym("SOUN",  "SoundHound AI",             "AI/Data"),
        sym("RIVN",  "Rivian Automotive",         "Auto"),
        sym("LCID",  "Lucid Group",               "Auto"),
        sym("NIO",   "NIO Inc.",                  "Auto"),
        sym("BIDU",  "Baidu Inc.",                "Technology"),
        sym("BABA",  "Alibaba Group",             "Ecommerce"),
        sym("JD",    "JD.com Inc.",               "Ecommerce"),
        sym("PDD",   "PDD Holdings",              "Ecommerce"),
        sym("TMUS",  "T-Mobile US",               "Telecom"),
        sym("CMCSA", "Comcast Corporation",       "Media"),
        sym("CHTR",  "Charter Communications",    "Media"),
        sym("DISH",  "DISH Network",              "Media"),
        sym("SIRI",  "SiriusXM Holdings",         "Media"),
        sym("PARA",  "Paramount Global",          "Media"),
        sym("WBD",   "Warner Bros. Discovery",    "Media"),
        sym("SPOT",  "Spotify Technology",        "Media"),
        sym("TTD",   "The Trade Desk",            "AdTech"),
        sym("PINS",  "Pinterest Inc.",            "Social"),
        sym("SNAP",  "Snap Inc.",                 "Social"),
        sym("MTCH",  "Match Group",               "Social"),
        sym("LYFT",  "Lyft Inc.",                 "Transport"),
        sym("DASH",  "DoorDash Inc.",             "Delivery"),
        sym("ABNB",  "Airbnb Inc.",               "Travel"),
        sym("EXPE",  "Expedia Group",             "Travel"),
        sym("BKNG",  "Booking Holdings",          "Travel"),
        sym("MAR",   "Marriott International",    "Hospitality"),
        sym("HLT",   "Hilton Worldwide",          "Hospitality"),
        sym("MCD",   "McDonald's Corporation",    "Food"),
        sym("SBUX",  "Starbucks Corporation",     "Food"),
        sym("YUM",   "Yum! Brands",               "Food"),
        sym("CMG",   "Chipotle Mexican Grill",    "Food"),
        sym("KO",    "Coca-Cola Company",         "Beverages"),
        sym("PEP",   "PepsiCo Inc.",              "Beverages")
    );

    // ── Crypto (via Alpha Vantage DIGITAL_CURRENCY_DAILY) ────────────────────
    public static final List<Map<String, String>> CRYPTO = List.of(
        sym("BTC",  "Bitcoin",          "Layer 1"),
        sym("ETH",  "Ethereum",         "Layer 1"),
        sym("BNB",  "BNB",             "Exchange"),
        sym("SOL",  "Solana",          "Layer 1"),
        sym("XRP",  "XRP",             "Payments"),
        sym("ADA",  "Cardano",         "Layer 1"),
        sym("AVAX", "Avalanche",       "Layer 1"),
        sym("DOGE", "Dogecoin",        "Meme"),
        sym("DOT",  "Polkadot",        "Layer 0"),
        sym("MATIC","Polygon",         "Layer 2"),
        sym("LINK", "Chainlink",       "Oracle"),
        sym("UNI",  "Uniswap",         "DeFi"),
        sym("LTC",  "Litecoin",        "Payments"),
        sym("ATOM", "Cosmos",          "Layer 0"),
        sym("XLM",  "Stellar",         "Payments"),
        sym("ALGO", "Algorand",        "Layer 1"),
        sym("VET",  "VeChain",         "Supply Chain"),
        sym("ICP",  "Internet Computer","Layer 1"),
        sym("FIL",  "Filecoin",        "Storage"),
        sym("SHIB", "Shiba Inu",       "Meme")
    );

    // ── Forex pairs ───────────────────────────────────────────────────────────
    public static final List<Map<String, String>> FOREX = List.of(
        sym("USD/INR", "US Dollar / Indian Rupee",     "Major"),
        sym("EUR/USD", "Euro / US Dollar",             "Major"),
        sym("GBP/USD", "British Pound / US Dollar",    "Major"),
        sym("USD/JPY", "US Dollar / Japanese Yen",     "Major"),
        sym("AUD/USD", "Australian Dollar / USD",      "Major"),
        sym("USD/CAD", "US Dollar / Canadian Dollar",  "Major"),
        sym("USD/CHF", "US Dollar / Swiss Franc",      "Major"),
        sym("NZD/USD", "New Zealand Dollar / USD",     "Major"),
        sym("EUR/GBP", "Euro / British Pound",         "Cross"),
        sym("EUR/JPY", "Euro / Japanese Yen",          "Cross"),
        sym("GBP/JPY", "British Pound / Japanese Yen", "Cross"),
        sym("EUR/INR", "Euro / Indian Rupee",          "Cross"),
        sym("GBP/INR", "British Pound / Indian Rupee", "Cross"),
        sym("USD/SGD", "US Dollar / Singapore Dollar", "EM"),
        sym("USD/HKD", "US Dollar / Hong Kong Dollar", "EM"),
        sym("USD/CNY", "US Dollar / Chinese Yuan",     "EM"),
        sym("USD/KRW", "US Dollar / Korean Won",       "EM"),
        sym("USD/BRL", "US Dollar / Brazilian Real",   "EM"),
        sym("USD/MXN", "US Dollar / Mexican Peso",     "EM"),
        sym("USD/ZAR", "US Dollar / South African Rand","EM")
    );

    @Cacheable("marketList")
    public List<Map<String, String>> getSymbolsForMarket(String marketId) {
        return switch (marketId.toUpperCase()) {
            case "IN"  -> NIFTY_50;
            case "US"  -> NASDAQ_100;
            case "CRYPTO" -> CRYPTO;
            case "FX"  -> FOREX;
            default    -> NASDAQ_100;
        };
    }

    private static Map<String, String> sym(String symbol, String name, String sector) {
        return Map.of("symbol", symbol, "name", name, "sector", sector);
    }
}