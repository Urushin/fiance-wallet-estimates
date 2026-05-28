/**
 * Portefeuille Crypto Théorique — Données extraites des CSV
 * Source: portefeuille_theorique_overview.csv & portefeuille_theorique_transactions.csv
 */

/* ── Symbol → CoinGecko ID mapping ───────────────────────────── */
export const SYMBOL_TO_COINGECKO = {
  FET: "fetch-ai",
  NEAR: "near",
  AR: "arweave",
  RENDER: "render-token",
  TAO: "bittensor",
  JASMY: "jasmycoin",
  RSR: "reserve-rights-token",
  LINK: "chainlink",
  TRX: "tron",
  UNI: "uniswap",
  CKB: "nervos-network",
  PEPE: "pepe",
  SHIB: "shiba-inu",
  AXL: "axelar",
  FLUX: "zelcash",
  CETUS: "cetus-protocol",
};

/* ── Portfolio holdings (from overview CSV) ───────────────────── */
export const CRYPTO_PORTFOLIO = [
  { symbol: "FET",    name: "Artificial Superintelligence Alliance", amount: 3972.63,      avgBuyPrice: 0.8777,    totalInvested: 3487.09 },
  { symbol: "NEAR",   name: "NEAR Protocol",                        amount: 337.00,       avgBuyPrice: 2.8996,    totalInvested: 977.16  },
  { symbol: "AR",     name: "Arweave",                              amount: 171.77,       avgBuyPrice: 6.0897,    totalInvested: 1046.00 },
  { symbol: "RENDER", name: "Render",                               amount: 188.96,       avgBuyPrice: 3.9978,    totalInvested: 755.44  },
  { symbol: "TAO",    name: "Bittensor",                            amount: 1.0000,       avgBuyPrice: 842.57,    totalInvested: 842.57  },
  { symbol: "JASMY",  name: "JasmyCoin",                            amount: 44924.24,     avgBuyPrice: 0.01683,   totalInvested: 756.51  },
  { symbol: "RSR",    name: "Reserve Rights",                       amount: 77369.31,     avgBuyPrice: 0.009622,  totalInvested: 744.50  },
  { symbol: "LINK",   name: "Chainlink",                            amount: 12.86,        avgBuyPrice: 13.60,     totalInvested: 174.93  },
  { symbol: "TRX",    name: "TRON",                                 amount: 251.85,       avgBuyPrice: 0.4648,    totalInvested: 117.08  },
  { symbol: "UNI",    name: "Uniswap",                              amount: 11.67,        avgBuyPrice: 9.9946,    totalInvested: 116.62  },
  { symbol: "CKB",    name: "Nervos Network",                       amount: 23954.64,     avgBuyPrice: 0.004881,  totalInvested: 116.92  },
  { symbol: "PEPE",   name: "Pepe",                                 amount: 7444716.52,   avgBuyPrice: 0.00002347, totalInvested: 174.77 },
  { symbol: "SHIB",   name: "Shiba Inu",                            amount: 4322080.00,   avgBuyPrice: 0.00002707, totalInvested: 117.03 },
  { symbol: "AXL",    name: "Axelar",                               amount: 89.20,        avgBuyPrice: 0.6566,    totalInvested: 58.57   },
  { symbol: "FLUX",   name: "Flux",                                 amount: 62.81,        avgBuyPrice: 0.9297,    totalInvested: 58.40   },
  { symbol: "CETUS",  name: "Cetus Protocol",                       amount: 104.80,       avgBuyPrice: 0.4532,    totalInvested: 47.50   },
];

/* ── Total invested (sum of all) ─────────────────────────────── */
export const TOTAL_INVESTED_USD = CRYPTO_PORTFOLIO.reduce((s, h) => s + h.totalInvested, 0);

/* ── Transaction history (from transactions CSV) ─────────────── */
export const CRYPTO_TRANSACTIONS = [
  { date: "2026-05-21 12:15", symbol: "CETUS",  type: "buy", price: 0.4532,    amount: 104.80,      total: 47.50   },
  { date: "2025-01-21 12:15", symbol: "FLUX",   type: "buy", price: 0.9297,    amount: 62.81,       total: 58.40   },
  { date: "2025-01-21 12:10", symbol: "AXL",    type: "buy", price: 0.6566,    amount: 89.20,       total: 58.57   },
  { date: "2025-01-21 12:10", symbol: "UNI",    type: "buy", price: 9.9946,    amount: 11.67,       total: 116.62  },
  { date: "2025-01-21 12:10", symbol: "TRX",    type: "buy", price: 0.4648,    amount: 251.85,      total: 117.08  },
  { date: "2025-01-21 12:05", symbol: "LINK",   type: "buy", price: 13.60,     amount: 12.86,       total: 174.93  },
  { date: "2025-01-21 12:05", symbol: "SHIB",   type: "buy", price: 0.00002707, amount: 4322080.00, total: 117.03  },
  { date: "2025-01-21 12:05", symbol: "PEPE",   type: "buy", price: 0.00002347, amount: 7444716.52, total: 174.77  },
  { date: "2025-01-21 12:05", symbol: "CKB",    type: "buy", price: 0.004881,  amount: 23954.64,    total: 116.92  },
  { date: "2025-01-21 12:00", symbol: "JASMY",  type: "buy", price: 0.01683,   amount: 44924.24,    total: 756.51  },
  { date: "2025-01-21 12:00", symbol: "TAO",    type: "buy", price: 842.57,    amount: 1.0000,      total: 842.57  },
  { date: "2025-01-21 12:00", symbol: "RSR",    type: "buy", price: 0.009622,  amount: 77369.31,    total: 744.50  },
  { date: "2025-01-21 11:50", symbol: "RENDER", type: "buy", price: 3.9978,    amount: 188.96,      total: 755.44  },
  { date: "2025-01-21 11:50", symbol: "AR",     type: "buy", price: 6.0897,    amount: 171.77,      total: 1046.00 },
  { date: "2025-01-21 11:50", symbol: "NEAR",   type: "buy", price: 2.8996,    amount: 337.00,      total: 977.16  },
  { date: "2025-01-21 11:45", symbol: "FET",    type: "buy", price: 0.8777,    amount: 3972.63,     total: 3487.09 },
];

/* ── CoinGecko IDs list (for API calls) ──────────────────────── */
export const ALL_COINGECKO_IDS = Object.values(SYMBOL_TO_COINGECKO);

/* ── Helper: get CoinGecko ID for a symbol ───────────────────── */
export function getCoinGeckoId(symbol) {
  return SYMBOL_TO_COINGECKO[symbol.toUpperCase()] || symbol.toLowerCase();
}
