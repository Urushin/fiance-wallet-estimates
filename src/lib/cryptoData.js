/**
 * Crypto Data — Symbol to CoinGecko ID mapping and portfolio helpers.
 * Add your own holdings via the Investments tab in the app.
 */

/* ── Symbol → CoinGecko ID mapping ───────────────────────────── */
export const SYMBOL_TO_COINGECKO = {
  BTC: "bitcoin",
  ETH: "ethereum",
  SOL: "solana",
  BNB: "binancecoin",
  ADA: "cardano",
  XRP: "ripple",
  DOT: "polkadot",
  MATIC: "matic-network",
  AVAX: "avalanche-2",
  LINK: "chainlink",
  UNI: "uniswap",
  ATOM: "cosmos",
  LTC: "litecoin",
  DOGE: "dogecoin",
  SHIB: "shiba-inu",
  PEPE: "pepe",
  FET: "fetch-ai",
  NEAR: "near",
  AR: "arweave",
  RENDER: "render-token",
  TAO: "bittensor",
  JASMY: "jasmycoin",
  RSR: "reserve-rights-token",
  TRX: "tron",
  CKB: "nervos-network",
  AXL: "axelar",
  FLUX: "zelcash",
  CETUS: "cetus-protocol",
};

/**
 * Returns the CoinGecko ID for a given symbol.
 * Falls back to lowercase symbol if not found.
 */
export function getCoinGeckoId(symbol) {
  return SYMBOL_TO_COINGECKO[symbol?.toUpperCase()] || symbol?.toLowerCase() || "";
}

/* ── Portfolio holdings — empty by default, add yours via the app ── */
export const CRYPTO_PORTFOLIO = [];

/* ── Total invested ─────────────────────────────────────────────── */
export const TOTAL_INVESTED_USD = 0;

/* ── Transaction history — empty by default ─────────────────────── */
export const CRYPTO_TRANSACTIONS = [];

/* ── All CoinGecko IDs for price fetching ──────────────────────── */
export const ALL_COINGECKO_IDS = Object.values(SYMBOL_TO_COINGECKO);
