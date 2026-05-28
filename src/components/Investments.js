"use client";
import { useState, useEffect, useMemo, useCallback } from "react";
import { useStore } from "@/lib/store";
import {
  CRYPTO_PORTFOLIO, CRYPTO_TRANSACTIONS, TOTAL_INVESTED_USD,
  ALL_COINGECKO_IDS, getCoinGeckoId, SYMBOL_TO_COINGECKO,
} from "@/lib/cryptoData";
import { fmtNum, fmtUsd, fmtPct, fetchCryptoPortfolioPrices, fetchCryptoHistory, computeTotalInvestments } from "@/lib/utils";
import { CRYPTO_LIST } from "@/lib/constants";
import DraggableTabs from "@/components/DraggableTabs";
import {
  Coins, TrendingUp, TrendingDown, ArrowUpRight, ArrowDownRight,
  RefreshCw, Clock, ChevronDown, ChevronUp, ToggleLeft, ToggleRight,
  BarChart3, History, Wallet, AlertTriangle, Zap, ArrowUp, ArrowDown,
  Home, Briefcase, Award, Layers, Trash2, Plus, Edit2, Check, X, Sparkles, CircleDollarSign
} from "lucide-react";
import {
  AreaChart, Area, ResponsiveContainer, XAxis, YAxis, Tooltip,
  CartesianGrid, ReferenceLine, BarChart, Bar, Cell, PieChart, Pie
} from "recharts";

/* ── Tooltip for charts ─────────────────────────────────────── */
function ChartTip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="glass p-2 shadow-xl text-xs">
      <p className="text-text-muted mb-0.5">{label}</p>
      {payload.map((e, i) => (
        <p key={i} style={{ color: e.color || "#00d4ff" }} className="font-semibold">
          {e.name}: {e.value.toLocaleString("fr-FR")} €
        </p>
      ))}
    </div>
  );
}

export default function Investments() {
  const store = useStore();
  const { settings } = store;
  const [sub, setSub] = useState("overview");

  // Fetch prices for Crypto component
  const [prices, setPrices] = useState({});
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState(null);

  const activeCoingeckoIds = useMemo(() => {
    const list = store.crypto || [];
    const ids = list.map(h => getCoinGeckoId(h.symbol));
    return Array.from(new Set([...ALL_COINGECKO_IDS, ...ids])).filter(Boolean);
  }, [store.crypto]);

  const fetchPrices = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchCryptoPortfolioPrices(activeCoingeckoIds);
      if (data && !data.error) {
        setPrices(data);
        setLastUpdate(new Date());
      }
    } catch (e) {
      console.error("Failed to fetch crypto prices:", e);
    }
    setLoading(false);
  }, [activeCoingeckoIds]);

  useEffect(() => {
    fetchPrices();
    const interval = setInterval(fetchPrices, 120_000); // 2 mins
    return () => clearInterval(interval);
  }, [fetchPrices]);

  // Enriched crypto holdings to calculate current total value in EUR
  const cryptoHoldings = useMemo(() => {
    const list = store.crypto || [];
    return list.map(h => {
      const coinId = getCoinGeckoId(h.symbol);
      const priceData = prices[coinId] || {};
      const eurPrice = priceData.eur || 0;
      const eurValue = (h.active !== false ? (h.quantity || 0) : 0) * eurPrice;
      return { ...h, eurValue };
    });
  }, [store.crypto, prices]);

  const totalCryptoEur = useMemo(() => {
    return cryptoHoldings.reduce((s, h) => s + h.eurValue, 0);
  }, [cryptoHoldings]);

  // Synchronize crypto value to cache in store safely to prevent infinite loop
  useEffect(() => {
    const rounded = Math.round(totalCryptoEur);
    if (rounded > 0 && store.cryptoValueCached !== rounded) {
      store.set("cryptoValueCached", rounded);
    }
  }, [totalCryptoEur, store.cryptoValueCached, store]);

  const tabs = [
    { id: "overview", label: "Vue d'ensemble", Icon: Wallet },
    { id: "crypto", label: "Crypto", Icon: Coins },
    { id: "stocks", label: "Actions", Icon: Briefcase },
    { id: "gold", label: "Or (Minerais)", Icon: Award },
    { id: "realEstate", label: "Immobilier", Icon: Home },
    { id: "etfs", label: "ETFs", Icon: Layers },
  ];

  return (
    <div className="space-y-4 anim-in">
      <DraggableTabs
        tabs={tabs}
        activeId={sub}
        onChange={setSub}
        settingsKey="investmentsTabOrder"
      />

      {sub === "overview" && (
        <Overview
          store={store}
          totalCryptoEur={totalCryptoEur}
          prices={prices}
          loading={loading}
          lastUpdate={lastUpdate}
          onRefreshPrices={fetchPrices}
        />
      )}
      {sub === "crypto" && (
        <CryptoTab
          store={store}
          prices={prices}
          loading={loading}
          lastUpdate={lastUpdate}
          onRefreshPrices={fetchPrices}
          cryptoHoldings={cryptoHoldings}
          totalCryptoEur={totalCryptoEur}
        />
      )}
      {sub === "stocks" && <StocksTab store={store} />}
      {sub === "gold" && <GoldTab store={store} />}
      {sub === "realEstate" && <RealEstateTab store={store} />}
      {sub === "etfs" && <EtfsTab store={store} />}
    </div>
  );
}

/* ═══════════════════════════ 1. VUE D'ENSEMBLE ═══════════════════════ */
function Overview({ store, totalCryptoEur, prices, loading, lastUpdate, onRefreshPrices }) {
  const { settings } = store;

  // Calculate each class total
  const cryptoVal = settings.cryptoActive !== false ? Math.round(totalCryptoEur) : 0;

  const stocksVal = useMemo(() => {
    if (settings.stocksActive === false) return 0;
    return (store.stocks || []).reduce((s, x) => s + (x.active !== false ? (x.quantity * (x.currentPrice || x.buyPrice)) : 0), 0);
  }, [store.stocks, settings.stocksActive]);

  const goldVal = useMemo(() => {
    if (settings.goldActive === false) return 0;
    return (store.gold || []).reduce((s, x) => s + (x.active !== false ? (x.grams * (x.currentPrice || x.buyPrice)) : 0), 0);
  }, [store.gold, settings.goldActive]);

  const realEstateVal = useMemo(() => {
    if (settings.realEstateActive === false) return 0;
    return (store.realEstate || []).reduce((s, x) => s + (x.active !== false ? (x.currentPrice || x.buyPrice) : 0), 0);
  }, [store.realEstate, settings.realEstateActive]);

  const etfsVal = useMemo(() => {
    if (settings.etfsActive === false) return 0;
    return (store.etfs || []).reduce((s, x) => s + (x.active !== false ? (x.quantity * (x.currentPrice || x.buyPrice)) : 0), 0);
  }, [store.etfs, settings.etfsActive]);

  const totalInvestments = cryptoVal + stocksVal + goldVal + realEstateVal + etfsVal;

  const distribution = [
    { name: "Crypto", value: cryptoVal, active: settings.cryptoActive !== false, color: "#ff8c00" },
    { name: "Actions", value: stocksVal, active: settings.stocksActive !== false, color: "#3b82f6" },
    { name: "Or (Minerais)", value: goldVal, active: settings.goldActive !== false, color: "#eab308" },
    { name: "Immobilier", value: realEstateVal, active: settings.realEstateActive !== false, color: "#10b981" },
    { name: "ETFs", value: etfsVal, active: settings.etfsActive !== false, color: "#8b5cf6" },
  ].filter(d => d.value > 0);

  return (
    <div className="space-y-4">
      {/* Total Card */}
      <section className="glass p-6 text-center relative overflow-hidden">
        <div className="absolute -top-12 -right-12 opacity-5">
          <CircleDollarSign className="w-40 h-40 text-neon-cyan" />
        </div>

        <div className="flex items-center justify-center gap-2 mb-1">
          <CircleDollarSign className="w-5 h-5 text-neon-cyan" />
          <span className="text-[11px] uppercase tracking-[0.18em] text-text-muted">
            Valeur Totale des Investissements Actifs
          </span>
        </div>

        <p className="text-4xl sm:text-5xl font-extrabold mono mt-2 text-neon-cyan glow-cyan">
          {totalInvestments.toLocaleString("fr-FR")} €
        </p>

        <div className="flex items-center justify-center gap-4 mt-3 text-[10px] text-text-muted">
          <span>Classes Actives: <span className="mono text-text-secondary">{distribution.filter(d => d.active).length} / 5</span></span>
          {lastUpdate && (
            <>
              <span className="w-px h-3 bg-border-subtle" />
              <span className="flex items-center gap-1">
                Prix live Crypto:
                <span className="mono font-bold text-neon-orange">
                  {lastUpdate.toLocaleTimeString("fr-FR")}
                </span>
                <button onClick={onRefreshPrices} disabled={loading} className="text-neon-cyan hover:text-white ml-0.5 cursor-pointer">
                  <RefreshCw className={`w-3 h-3 ${loading ? "animate-spin" : ""}`} />
                </button>
              </span>
            </>
          )}
        </div>
      </section>

      {/* Activation Dashboard Global */}
      <div className="glass p-4 border-neon-cyan/20">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Zap className={`w-4 h-4 ${settings.includeInvestmentsInCapital ? "text-neon-cyan" : "text-text-muted"}`} />
            <div>
              <p className="text-sm font-medium text-text-primary">Prendre en compte dans le capital total</p>
              <p className="text-[10px] text-text-muted">
                Ajoute le total de {totalInvestments.toLocaleString("fr-FR")} € au capital global affiché dans le Dashboard.
              </p>
            </div>
          </div>
          <button
            onClick={() => store.setNested("settings", "includeInvestmentsInCapital", !settings.includeInvestmentsInCapital)}
            className="cursor-pointer transition-all shrink-0"
          >
            {settings.includeInvestmentsInCapital ? (
              <ToggleRight className="w-9 h-9 text-neon-cyan" />
            ) : (
              <ToggleLeft className="w-9 h-9 text-text-muted" />
            )}
          </button>
        </div>
        {settings.includeInvestmentsInCapital && (
          <div className="mt-2 px-3 py-1.5 bg-neon-cyan/10 border border-neon-cyan/20 rounded-lg">
            <p className="text-[10px] text-neon-cyan flex items-center gap-1.5 font-medium">
              <Sparkles className="w-3.5 h-3.5 animate-pulse" />
              Succès — Le capital global du Dashboard inclut maintenant vos investissements !
            </p>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
        {/* Classes list and toggles */}
        <section className="glass p-4 md:col-span-7 space-y-3">
          <div className="flex items-center gap-2 mb-2">
            <Wallet className="w-4 h-4 text-text-secondary" />
            <span className="text-[10px] uppercase tracking-widest text-text-muted">Répartition & Activation</span>
          </div>

          <div className="space-y-2.5">
            {[
              {
                id: "cryptoActive",
                label: "Crypto-monnaies",
                val: cryptoVal,
                orig: totalCryptoEur,
                color: "text-neon-orange",
                icon: Coins,
                active: settings.cryptoActive !== false
              },
              {
                id: "stocksActive",
                label: "Actions",
                val: stocksVal,
                orig: stocksVal,
                color: "text-blue-400",
                icon: Briefcase,
                active: settings.stocksActive !== false
              },
              {
                id: "goldActive",
                label: "Or & Minerais",
                val: goldVal,
                orig: goldVal,
                color: "text-yellow-400",
                icon: Award,
                active: settings.goldActive !== false
              },
              {
                id: "realEstateActive",
                label: "Immobilier",
                val: realEstateVal,
                orig: realEstateVal,
                color: "text-emerald-400",
                icon: Home,
                active: settings.realEstateActive !== false
              },
              {
                id: "etfsActive",
                label: "ETFs",
                val: etfsVal,
                orig: etfsVal,
                color: "text-purple-400",
                icon: Layers,
                active: settings.etfsActive !== false
              },
            ].map(c => {
              const ClIcon = c.icon;
              return (
                <div key={c.id} className="flex items-center justify-between p-2.5 rounded-xl bg-surface/50 border border-border-subtle hover:border-slate-800 transition-colors">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-slate-900 flex items-center justify-center shrink-0">
                      <ClIcon className={`w-4 h-4 ${c.color}`} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-text-primary">{c.label}</p>
                      <p className="text-[10px] text-text-muted mono">
                        {c.active ? `${Math.round(c.orig).toLocaleString("fr-FR")} €` : "Désactivé"}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {c.active && totalInvestments > 0 && (
                      <span className="text-[10px] mono text-text-muted font-bold">
                        {Math.round((c.val / totalInvestments) * 100)}%
                      </span>
                    )}
                    <button
                      onClick={() => store.setNested("settings", c.id, !c.active)}
                      className="cursor-pointer"
                    >
                      {c.active ? (
                        <ToggleRight className="w-7 h-7 text-neon-cyan" />
                      ) : (
                        <ToggleLeft className="w-7 h-7 text-text-muted" />
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Donut Chart visual */}
        <section className="glass p-4 md:col-span-5 flex flex-col justify-between">
          <div className="flex items-center gap-2 mb-2">
            <BarChart3 className="w-4 h-4 text-text-secondary" />
            <span className="text-[10px] uppercase tracking-widest text-text-muted">Répartition Graphique</span>
          </div>

          {distribution.length > 0 ? (
            <div className="h-44 flex items-center justify-center relative my-3">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={distribution}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={70}
                    paddingAngle={3}
                  >
                    {distribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip content={<ChartTip />} />
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute text-center">
                <span className="text-[10px] text-text-muted uppercase block">Total</span>
                <span className="text-sm font-bold mono text-text-secondary">
                  {totalInvestments.toLocaleString("fr-FR")} €
                </span>
              </div>
            </div>
          ) : (
            <div className="h-44 flex items-center justify-center text-center">
              <p className="text-xs text-text-muted px-4 py-8">Aucun investissement actif disponible.</p>
            </div>
          )}

          <div className="flex flex-wrap justify-center gap-2 text-[9px] text-text-muted mt-2">
            {distribution.map(d => (
              <span key={d.name} className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: d.color }} />
                {d.name} ({Math.round((d.value / Math.max(1, totalInvestments)) * 100)}%)
              </span>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

/* ═══════════════════════════ 2. CRYPTO PORTFOLIO ═══════════════════════ */
function CryptoTab({ store, prices, loading, lastUpdate, onRefreshPrices, cryptoHoldings, totalCryptoEur }) {
  const { settings } = store;
  const [sortBy, setSortBy] = useState("value"); // value | pnl | pnlPct | name
  const [sortDir, setSortDir] = useState("desc");
  const [historyPeriod, setHistoryPeriod] = useState("30");
  const [historyData, setHistoryData] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [showTransactions, setShowTransactions] = useState(false);
  const [expandedToken, setExpandedToken] = useState(null);

  // Edit / Add States
  const [name, setName] = useState("");
  const [symbol, setSymbol] = useState("");
  const [quantity, setQuantity] = useState("");
  const [buyPrice, setBuyPrice] = useState("");
  const [editId, setEditId] = useState(null);

  const allKnownCryptos = useMemo(() => {
    return [
      ...CRYPTO_LIST,
      { symbol: "FET", name: "Artificial Superintelligence Alliance" },
      { symbol: "NEAR", name: "NEAR Protocol" },
      { symbol: "AR", name: "Arweave" },
      { symbol: "RENDER", name: "Render" },
      { symbol: "TAO", name: "Bittensor" },
      { symbol: "JASMY", name: "JasmyCoin" },
      { symbol: "RSR", name: "Reserve Rights" },
      { symbol: "LINK", name: "Chainlink" },
      { symbol: "TRX", name: "TRON" },
      { symbol: "UNI", name: "Uniswap" },
      { symbol: "CKB", name: "Nervos Network" },
      { symbol: "PEPE", name: "Pepe" },
      { symbol: "SHIB", name: "Shiba Inu" },
      { symbol: "AXL", name: "Axelar" },
      { symbol: "FLUX", name: "Flux" },
      { symbol: "CETUS", name: "Cetus Protocol" },
    ];
  }, []);

  function submit(e) {
    e.preventDefault();
    const qty = parseFloat(quantity);
    const buy = parseFloat(buyPrice);
    if (!name || !symbol || isNaN(qty) || isNaN(buy)) return;

    if (editId) {
      store.set("crypto", (prev) =>
        prev.map((x) =>
          x.id === editId
            ? { ...x, name, symbol: symbol.toUpperCase(), quantity: qty, buyPrice: buy, active: x.active !== false }
            : x
        )
      );
      setEditId(null);
    } else {
      const newItem = {
        id: Date.now().toString(36),
        name,
        symbol: symbol.toUpperCase(),
        quantity: qty,
        buyPrice: buy,
        active: true,
      };
      store.set("crypto", (prev) => [...(prev || []), newItem]);
    }

    setName("");
    setSymbol("");
    setQuantity("");
    setBuyPrice("");
  }

  function edit(x) {
    setEditId(x.id);
    setName(x.name);
    setSymbol(x.symbol);
    setQuantity(x.quantity.toString());
    setBuyPrice(x.buyPrice.toString());
  }

  function remove(id) {
    store.set("crypto", (prev) => prev.filter((x) => x.id !== id));
  }

  function toggleActive(id, activeVal) {
    store.set("crypto", (prev) =>
      prev.map((x) => (x.id === id ? { ...x, active: !activeVal } : x))
    );
  }

  // Enrich positions table with live pricing and dynamic fields
  const holdings = useMemo(() => {
    const list = store.crypto || [];
    return list.map(h => {
      const coinId = getCoinGeckoId(h.symbol);
      const priceData = prices[coinId] || {};
      const currentPrice = priceData.usd || h.buyPrice || 0; // live price or fallback
      const currentValue = h.quantity * currentPrice;
      const totalInvested = h.quantity * h.buyPrice;
      const pnl = currentValue - totalInvested;
      const pnlPct = totalInvested > 0 ? (pnl / totalInvested) * 100 : 0;
      const change24h = priceData.usd_24h_change || 0;
      const eurPrice = priceData.eur || 0;
      const eurValue = h.quantity * eurPrice;

      return {
        ...h,
        amount: h.quantity,
        avgBuyPrice: h.buyPrice,
        totalInvested,
        coinId,
        currentPrice,
        currentValue,
        pnl,
        pnlPct,
        change24h,
        eurPrice,
        eurValue,
      };
    });
  }, [store.crypto, prices]);

  const activeHoldings = useMemo(() => holdings.filter(h => h.active !== false), [holdings]);
  const totalInvestedUsd = useMemo(() => activeHoldings.reduce((s, h) => s + h.totalInvested, 0), [activeHoldings]);
  const totalCurrentValueUsd = useMemo(() => activeHoldings.reduce((s, h) => s + h.currentValue, 0), [activeHoldings]);
  const totalPnlUsd = totalCurrentValueUsd - totalInvestedUsd;
  const totalPnlPct = totalInvestedUsd > 0 ? (totalPnlUsd / totalInvestedUsd) * 100 : 0;
  const totalEurVal = useMemo(() => activeHoldings.reduce((s, h) => s + h.eurValue, 0), [activeHoldings]);

  const totalChange24h = useMemo(() => {
    if (!activeHoldings.length || totalCurrentValueUsd === 0) return 0;
    return activeHoldings.reduce((s, h) => s + (h.change24h * h.currentValue / totalCurrentValueUsd), 0);
  }, [activeHoldings, totalCurrentValueUsd]);

  const sortedHoldings = useMemo(() => {
    const sorted = [...holdings].sort((a, b) => {
      switch (sortBy) {
        case "name": return a.name.localeCompare(b.name);
        case "pnl": return a.pnl - b.pnl;
        case "pnlPct": return a.pnlPct - b.pnlPct;
        case "change24h": return a.change24h - b.change24h;
        case "value":
        default: return a.currentValue - b.currentValue;
      }
    });
    return sortDir === "desc" ? sorted.reverse() : sorted;
  }, [holdings, sortBy, sortDir]);

  const bestPerformer = useMemo(() => activeHoldings.reduce((best, h) => h.pnlPct > (best?.pnlPct || -Infinity) ? h : best, null), [activeHoldings]);
  const worstPerformer = useMemo(() => activeHoldings.reduce((worst, h) => h.pnlPct < (worst?.pnlPct || Infinity) ? h : worst, null), [activeHoldings]);

  // Fetch portfolio value history (from Coingecko)
  useEffect(() => {
    async function loadHistory() {
      setHistoryLoading(true);
      try {
        const topTokens = activeHoldings.slice(0, 6);
        const histories = await Promise.all(
          topTokens.map(h => fetchCryptoHistory(getCoinGeckoId(h.symbol), historyPeriod))
        );

        if (histories[0]?.prices?.length) {
          const baseLen = histories[0].prices.length;
          const aggregated = [];
          
          for (let i = 0; i < baseLen; i += Math.max(1, Math.floor(baseLen / 60))) {
            const timestamp = histories[0].prices[i][0];
            let totalValue = 0;
            let hasData = false;

            topTokens.forEach((h, idx) => {
              const priceData = histories[idx]?.prices;
              if (priceData && priceData[i]) {
                totalValue += h.quantity * priceData[i][1];
                hasData = true;
              }
            });

            activeHoldings.slice(6).forEach(h => {
              const coinId = getCoinGeckoId(h.symbol);
              const currentPrice = prices[coinId]?.usd || 0;
              totalValue += h.quantity * currentPrice;
            });

            if (hasData) {
              const d = new Date(timestamp);
              const eurConversion = 0.92; 
              aggregated.push({
                date: d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short" }),
                value: totalValue * eurConversion,
                invested: totalInvestedUsd * eurConversion,
              });
            }
          }
          setHistoryData(aggregated);
        }
      } catch (e) {
        console.error("Failed to fetch history:", e);
      }
      setHistoryLoading(false);
    }
    if (Object.keys(prices).length > 0 && activeHoldings.length > 0) loadHistory();
  }, [historyPeriod, prices, activeHoldings, totalInvestedUsd]);

  function handleSort(key) {
    if (sortBy === key) setSortDir(d => d === "desc" ? "asc" : "desc");
    else { setSortBy(key); setSortDir("desc"); }
  }

  const SortIcon = ({ k }) => {
    if (sortBy !== k) return null;
    return sortDir === "desc" ? <ChevronDown className="w-3 h-3 inline" /> : <ChevronUp className="w-3 h-3 inline" />;
  };

  return (
    <div className="space-y-4">
      {/* Live total display */}
      <section className="glass p-5 text-center relative overflow-hidden border-neon-orange/20">
        <div className="absolute -top-8 -right-8 opacity-5">
          <Coins className="w-32 h-32 text-neon-orange" />
        </div>

        <div className="flex items-center justify-center gap-2 mb-1">
          <Coins className="w-5 h-5 text-neon-orange" />
          <span className="text-[11px] uppercase tracking-[0.15em] text-text-muted">
            Portefeuille Crypto
          </span>
        </div>

        <p className={`text-4xl sm:text-5xl font-extrabold mono mt-2 ${totalPnlUsd >= 0 ? "text-neon-green glow-g" : "text-neon-red glow-r"}`}>
          {totalEurVal.toLocaleString("fr-FR")} €
        </p>

        <div className="flex items-center justify-center gap-3 mt-2">
          <span className={`text-sm font-bold mono ${totalPnlUsd >= 0 ? "text-neon-green" : "text-neon-red"}`}>
            {totalPnlUsd >= 0 ? "+" : ""}{fmtUsd(totalPnlUsd, 0)} ({fmtPct(totalPnlPct)})
          </span>
          <span className="text-[10px] text-text-muted">vs investi</span>
        </div>

        <div className="flex items-center justify-center gap-4 mt-3 text-[10px] text-text-muted">
          <span>Investi: <span className="mono text-text-secondary">{fmtUsd(totalInvestedUsd, 0)}</span></span>
          <span className="w-px h-3 bg-border-subtle" />
          <span className="flex items-center gap-1">
            24h: 
            <span className={`mono font-bold ${totalChange24h >= 0 ? "text-neon-green" : "text-neon-red"}`}>
              {fmtPct(totalChange24h)}
            </span>
          </span>
          <span className="w-px h-3 bg-border-subtle" />
          <span>≈ <span className="mono text-text-secondary">{fmtUsd(totalCurrentValueUsd, 0)} USD</span></span>
        </div>

        {lastUpdate && (
          <div className="flex items-center justify-center gap-1 mt-2 text-[9px] text-text-muted">
            <Clock className="w-2.5 h-2.5" />
            Mis à jour: {lastUpdate.toLocaleTimeString("fr-FR")}
            <button onClick={onRefreshPrices} disabled={loading} className="text-neon-cyan hover:text-white ml-1 cursor-pointer">
              <RefreshCw className={`w-3 h-3 ${loading ? "animate-spin" : ""}`} />
            </button>
          </div>
        )}
      </section>

      {/* KPI stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <div className="glass p-2.5">
          <div className="flex items-center gap-1 mb-0.5">
            <Wallet className="w-3.5 h-3.5 text-neon-orange" />
            <span className="text-[9px] uppercase tracking-widest text-text-muted truncate">Actifs</span>
          </div>
          <p className="text-sm font-bold mono text-neon-orange">{activeHoldings.length}</p>
        </div>
        <div className="glass p-2.5">
          <div className="flex items-center gap-1 mb-0.5">
            {totalPnlUsd >= 0 ? <TrendingUp className="w-3.5 h-3.5 text-neon-green" /> : <TrendingDown className="w-3.5 h-3.5 text-neon-red" />}
            <span className="text-[9px] uppercase tracking-widest text-text-muted truncate">P&L Crypto</span>
          </div>
          <p className={`text-sm font-bold mono ${totalPnlUsd >= 0 ? "text-neon-green" : "text-neon-red"}`}>
            {fmtPct(totalPnlPct)}
          </p>
        </div>
        <div className="glass p-2.5">
          <div className="flex items-center gap-1 mb-0.5">
            <ArrowUpRight className="w-3.5 h-3.5 text-neon-green" />
            <span className="text-[9px] uppercase tracking-widest text-text-muted truncate">Top Token</span>
          </div>
          <p className="text-[11px] font-bold text-neon-green truncate">{bestPerformer?.symbol}</p>
          <p className="text-[9px] mono text-text-muted">{bestPerformer ? fmtPct(bestPerformer.pnlPct) : ""}</p>
        </div>
        <div className="glass p-2.5">
          <div className="flex items-center gap-1 mb-0.5">
            <ArrowDownRight className="w-3.5 h-3.5 text-neon-red" />
            <span className="text-[9px] uppercase tracking-widest text-text-muted truncate">Flop Token</span>
          </div>
          <p className="text-[11px] font-bold text-neon-red truncate">{worstPerformer?.symbol}</p>
          <p className="text-[9px] mono text-text-muted">{worstPerformer ? fmtPct(worstPerformer.pnlPct) : ""}</p>
        </div>
      </div>

      {/* Historical charts */}
      <section className="glass p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-neon-orange" />
            <span className="text-[10px] uppercase tracking-widest text-text-muted">Historique de valeur (EUR)</span>
          </div>
          <div className="flex gap-1">
            {[
              { label: "7j", value: "7" },
              { label: "30j", value: "30" },
              { label: "90j", value: "90" },
              { label: "1an", value: "365" },
            ].map(p => (
              <button key={p.value} onClick={() => setHistoryPeriod(p.value)}
                className={`text-[9px] px-2 py-0.5 rounded-full border cursor-pointer transition-colors ${
                  historyPeriod === p.value
                    ? "border-neon-orange text-neon-orange bg-neon-orange/10"
                    : "border-border-subtle text-text-muted hover:text-text-secondary"
                }`}>{p.label}</button>
            ))}
          </div>
        </div>

        {historyLoading ? (
          <div className="h-40 flex items-center justify-center">
            <RefreshCw className="w-5 h-5 text-neon-orange animate-spin" />
          </div>
        ) : historyData.length > 2 ? (
          <div className="h-48 -mx-1">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={historyData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="gCryptoVal" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ff8c00" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#ff8c00" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(100,116,139,0.06)" />
                <XAxis dataKey="date" tick={{ fill: "#64748b", fontSize: 9 }} axisLine={false} tickLine={false}
                  interval={Math.floor(historyData.length / 6)} />
                <YAxis tick={{ fill: "#64748b", fontSize: 9 }} axisLine={false} tickLine={false}
                  tickFormatter={v => `${(v/1000).toFixed(1)}k`} />
                <Tooltip content={<ChartTip />} />
                <ReferenceLine y={totalInvestedUsd * 0.92} stroke="#ff3b5c" strokeDasharray="6 3"
                  strokeWidth={1.5} label={{ value: "Investi", fill: "#ff3b5c", fontSize: 9, position: "right" }} />
                <Area type="monotone" dataKey="value" name="Valeur" stroke="#ff8c00" strokeWidth={2}
                  fill="url(#gCryptoVal)" dot={false}
                  activeDot={{ r: 3, fill: "#030712", stroke: "#ff8c00", strokeWidth: 2 }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <p className="text-xs text-text-muted text-center py-8">Aucune donnée historique. Ajoutez des cryptos actives pour tracer l'historique.</p>
        )}
      </section>

      {/* Dynamic Saisie Cryptos */}
      <section className="glass p-4">
        <div className="flex items-center gap-2 mb-3">
          <Plus className="w-4 h-4 text-neon-orange" />
          <span className="text-[10px] uppercase tracking-widest text-text-muted">
            {editId ? "Modifier la Position" : "Ajouter une Crypto"}
          </span>
        </div>

        <form onSubmit={submit} className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
          <div className="col-span-2 sm:col-span-1">
            <label className="text-[10px] text-text-muted block mb-0.5">Symbole (e.g. BTC)</label>
            <input
              type="text"
              value={symbol}
              onChange={(e) => {
                setSymbol(e.target.value);
                const match = allKnownCryptos.find(t => t.symbol.toUpperCase() === e.target.value.toUpperCase());
                if (match) {
                  setName(match.name);
                }
              }}
              placeholder="Symbole"
              className="input text-xs"
              required
            />
          </div>
          <div className="col-span-2 sm:col-span-1">
            <label className="text-[10px] text-text-muted block mb-0.5">Nom de la crypto</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nom complet"
              className="input text-xs"
              required
            />
          </div>
          <div>
            <label className="text-[10px] text-text-muted block mb-0.5">Quantité</label>
            <input
              type="number"
              step="any"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              placeholder="Quantité"
              className="input text-xs mono"
              required
            />
          </div>
          <div>
            <label className="text-[10px] text-text-muted block mb-0.5">PRU Achat ($ USD)</label>
            <input
              type="number"
              step="any"
              value={buyPrice}
              onChange={(e) => setBuyPrice(e.target.value)}
              placeholder="Prix d'achat moyen ($)"
              className="input text-xs mono"
              required
            />
          </div>

          <div className="col-span-2 sm:col-span-4 flex items-center gap-1.5 mt-2 justify-end">
            {editId && (
              <button
                type="button"
                onClick={() => {
                  setEditId(null);
                  setName("");
                  setSymbol("");
                  setQuantity("");
                  setBuyPrice("");
                }}
                className="btn btn-ghost text-[10px] py-1.5 cursor-pointer"
              >
                Annuler
              </button>
            )}
            <button type="submit" className="btn btn-orange text-[10px] py-1.5 font-bold cursor-pointer">
              {editId ? "Enregistrer" : "Ajouter la position"}
            </button>
          </div>
        </form>
      </section>

      {/* Positions Table */}
      <section className="glass p-4">
        <div className="flex items-center gap-2 mb-3">
          <Coins className="w-4 h-4 text-neon-orange" />
          <span className="text-[10px] uppercase tracking-widest text-text-muted">Positions Possédées ({holdings.length})</span>
        </div>

        {holdings.length > 0 ? (
          <>
            <div className="hidden sm:grid grid-cols-12 gap-2 px-2 pb-2 border-b border-border-subtle text-[9px] uppercase tracking-widest text-text-muted">
              <button onClick={() => handleSort("name")} className="col-span-2 text-left cursor-pointer hover:text-text-secondary">
                Token <SortIcon k="name" />
              </button>
              <span className="col-span-2 text-right">Prix Actuel</span>
              <button onClick={() => handleSort("value")} className="col-span-2 text-right cursor-pointer hover:text-text-secondary">
                Valeur (EUR) <SortIcon k="value" />
              </button>
              <button onClick={() => handleSort("pnl")} className="col-span-2 text-right cursor-pointer hover:text-text-secondary">
                P&L (USD) <SortIcon k="pnl" />
              </button>
              <button onClick={() => handleSort("pnlPct")} className="col-span-1 text-right cursor-pointer hover:text-text-secondary text-[8px] truncate">
                P&L % <SortIcon k="pnlPct" />
              </button>
              <button onClick={() => handleSort("change24h")} className="col-span-1 text-right cursor-pointer hover:text-text-secondary">
                24h <SortIcon k="change24h" />
              </button>
              <span className="col-span-2 text-right">Actions</span>
            </div>

            <div className="space-y-0.5 mt-1">
              {sortedHoldings.map(h => (
                <div key={h.id || h.symbol}>
                  <div
                    onClick={() => setExpandedToken(expandedToken === h.symbol ? null : h.symbol)}
                    className={`hidden sm:grid grid-cols-12 gap-2 px-2 py-2.5 rounded-xl hover:bg-surface-hover transition-colors cursor-pointer group items-center ${
                      h.active !== false ? "" : "opacity-40"
                    }`}
                  >
                    <div className="col-span-2 flex items-center gap-2 min-w-0">
                      <div className="w-7 h-7 rounded-full bg-neon-orange/10 flex items-center justify-center shrink-0">
                        <span className="text-[10px] font-bold text-neon-orange">{h.symbol.slice(0, 3)}</span>
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-text-primary truncate">{h.symbol}</p>
                        <p className="text-[9px] text-text-muted truncate">{h.name}</p>
                      </div>
                    </div>
                    <div className="col-span-2 flex items-center justify-end">
                      <span className="text-xs mono text-text-secondary">{fmtUsd(h.currentPrice)}</span>
                    </div>
                    <div className="col-span-2 flex items-center justify-end font-semibold text-text-primary">
                      <span className="text-xs mono">{Math.round(h.eurValue).toLocaleString("fr-FR")} €</span>
                    </div>
                    <div className="col-span-2 flex items-center justify-end">
                      <span className={`text-xs mono font-semibold ${h.pnl >= 0 ? "text-neon-green" : "text-neon-red"}`}>
                        {h.pnl >= 0 ? "+" : ""}{fmtUsd(h.pnl, 0)}
                      </span>
                    </div>
                    <div className="col-span-1 flex items-center justify-end">
                      <span className={`text-[10px] mono font-bold px-1 py-0.5 rounded ${
                        h.pnlPct >= 0 ? "text-neon-green bg-neon-green/10" : "text-neon-red bg-neon-red/10"
                      }`}>
                        {fmtPct(h.pnlPct)}
                      </span>
                    </div>
                    <div className="col-span-1 flex items-center justify-end">
                      <span className={`text-[10px] mono ${h.change24h >= 0 ? "text-neon-green" : "text-neon-red"}`}>
                        {h.change24h >= 0 ? "↑" : "↓"}{Math.abs(h.change24h).toFixed(1)}%
                      </span>
                    </div>
                    <div className="col-span-2 flex items-center justify-end gap-1.5">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleActive(h.id || h.symbol.toLowerCase(), h.active !== false);
                        }}
                        className="cursor-pointer text-text-muted hover:text-neon-cyan transition-colors"
                      >
                        {h.active !== false ? (
                          <ToggleRight className="w-6 h-6 text-neon-cyan" />
                        ) : (
                          <ToggleLeft className="w-6 h-6 text-text-muted" />
                        )}
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          edit(h);
                        }}
                        className="p-1 rounded hover:bg-surface-hover text-text-muted hover:text-neon-cyan cursor-pointer transition-colors"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          remove(h.id || h.symbol.toLowerCase());
                        }}
                        className="p-1 rounded hover:bg-surface-hover text-text-muted hover:text-neon-red cursor-pointer transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Mobile layout */}
                  <div
                    onClick={() => setExpandedToken(expandedToken === h.symbol ? null : h.symbol)}
                    className={`sm:hidden flex items-center justify-between px-2 py-2.5 rounded-xl hover:bg-surface-hover transition-colors cursor-pointer ${
                      h.active !== false ? "" : "opacity-40"
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <div className="w-8 h-8 rounded-full bg-neon-orange/10 flex items-center justify-center shrink-0">
                        <span className="text-[10px] font-bold text-neon-orange">{h.symbol.slice(0, 3)}</span>
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-text-primary">{h.symbol}</p>
                        <p className="text-[9px] text-text-muted">{fmtUsd(h.currentPrice)}</p>
                      </div>
                    </div>
                    <div className="text-right flex items-center gap-2.5">
                      <div>
                        <p className="text-xs mono font-semibold text-text-primary">{Math.round(h.eurValue).toLocaleString("fr-FR")} €</p>
                        <p className={`text-[10px] mono font-bold ${h.pnl >= 0 ? "text-neon-green" : "text-neon-red"}`}>
                          {fmtPct(h.pnlPct)}
                        </p>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleActive(h.id || h.symbol.toLowerCase(), h.active !== false);
                        }}
                        className="cursor-pointer text-text-muted hover:text-neon-cyan transition-colors"
                      >
                        {h.active !== false ? (
                          <ToggleRight className="w-6 h-6 text-neon-cyan" />
                        ) : (
                          <ToggleLeft className="w-6 h-6 text-text-muted" />
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Expanded position info */}
                  {expandedToken === h.symbol && (
                    <div className="mx-2 mb-2 p-3 rounded-xl bg-[#030712] border border-border-subtle space-y-2.5 anim-in">
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[10px]">
                        <div>
                          <span className="text-text-muted block">Quantité</span>
                          <span className="mono text-text-primary font-semibold">
                            {h.amount < 1 ? h.amount.toFixed(4) : h.amount.toLocaleString("fr-FR")}
                          </span>
                        </div>
                        <div>
                          <span className="text-text-muted block">PRU moyen (USD)</span>
                          <span className="mono text-text-primary font-semibold">{fmtUsd(h.avgBuyPrice)}</span>
                        </div>
                        <div>
                          <span className="text-text-muted block">Total investi (USD)</span>
                          <span className="mono text-text-primary font-semibold">{fmtUsd(h.totalInvested, 0)}</span>
                        </div>
                        <div>
                          <span className="text-text-muted block">Prix actuel (EUR)</span>
                          <span className="mono text-text-primary font-semibold">~{h.eurPrice.toFixed(4)} €</span>
                        </div>
                      </div>
                      
                      {/* Mobile Actions */}
                      <div className="sm:hidden flex items-center justify-end gap-2 border-t border-border-subtle pt-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            edit(h);
                          }}
                          className="btn btn-ghost text-[9px] py-1 px-2.5 flex items-center gap-1 cursor-pointer"
                        >
                          <Edit2 className="w-3 h-3 text-neon-cyan" /> Modifier
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            remove(h.id || h.symbol.toLowerCase());
                          }}
                          className="btn btn-ghost text-[9px] py-1 px-2.5 flex items-center gap-1 cursor-pointer hover:bg-neon-red/10"
                        >
                          <Trash2 className="w-3 h-3 text-neon-red" /> Supprimer
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </>
        ) : (
          <p className="text-xs text-text-muted text-center py-6">Aucun token possédé pour l'instant. Utilisez le formulaire ci-dessus pour en ajouter.</p>
        )}
      </section>

      {/* Transaction History trigger */}
      <section className="glass p-4">
        <button
          onClick={() => setShowTransactions(t => !t)}
          className="flex items-center justify-between w-full cursor-pointer"
        >
          <div className="flex items-center gap-2">
            <History className="w-4 h-4 text-neon-violet" />
            <span className="text-[10px] uppercase tracking-widest text-text-muted">
              Historique des transactions ({CRYPTO_TRANSACTIONS.length})
            </span>
          </div>
          {showTransactions ? <ChevronUp className="w-4 h-4 text-text-muted" /> : <ChevronDown className="w-4 h-4 text-text-muted" />}
        </button>

        {showTransactions && (
          <div className="mt-3 space-y-1">
            {CRYPTO_TRANSACTIONS.map((tx, i) => (
              <div key={i} className="flex items-center justify-between px-2 py-2 rounded-lg hover:bg-surface-hover transition-colors">
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${
                    tx.type === "buy" ? "bg-neon-green/10" : "bg-neon-red/10"
                  }`}>
                    {tx.type === "buy" ? <ArrowDown className="w-3 h-3 text-neon-green" /> : <ArrowUp className="w-3 h-3 text-neon-red" />}
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-text-primary">
                      Achat {tx.symbol}
                    </p>
                    <p className="text-[9px] text-text-muted">{tx.date}</p>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-xs mono text-text-primary font-semibold">{fmtUsd(tx.total, 0)}</p>
                  <p className="text-[9px] text-text-muted">
                    {tx.amount.toLocaleString("fr-FR")} × {fmtUsd(tx.price)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

/* ═══════════════════════════ 3. ACTIONS (STOCKS) ═══════════════════════ */
function StocksTab({ store }) {
  const { stocks = [], settings } = store;
  const [name, setName] = useState("");
  const [symbol, setSymbol] = useState("");
  const [quantity, setQuantity] = useState("");
  const [buyPrice, setBuyPrice] = useState("");
  const [currentPrice, setCurrentPrice] = useState("");
  const [editId, setEditId] = useState(null);

  // Simulated live trend stocks
  const trends = [
    { ticker: "AAPL", name: "Apple Inc.", price: 189.84, change: 1.45 },
    { ticker: "TSLA", name: "Tesla Inc.", price: 178.20, change: -2.31 },
    { ticker: "NVDA", name: "NVIDIA Corp.", price: 948.12, change: 4.82 },
    { ticker: "MSFT", name: "Microsoft Corp.", price: 421.90, change: 0.88 },
  ];

  function submit(e) {
    e.preventDefault();
    const qty = parseFloat(quantity);
    const buy = parseFloat(buyPrice);
    const cur = parseFloat(currentPrice) || buy;
    if (!name || !symbol || isNaN(qty) || isNaN(buy)) return;

    if (editId) {
      store.set("stocks", (prev) =>
        prev.map((x) =>
          x.id === editId
            ? { ...x, name, symbol: symbol.toUpperCase(), quantity: qty, buyPrice: buy, currentPrice: cur }
            : x
        )
      );
      setEditId(null);
    } else {
      const newItem = {
        id: Date.now().toString(36),
        name,
        symbol: symbol.toUpperCase(),
        quantity: qty,
        buyPrice: buy,
        currentPrice: cur,
        active: true,
      };
      store.set("stocks", (prev) => [...(prev || []), newItem]);
    }

    setName("");
    setSymbol("");
    setQuantity("");
    setBuyPrice("");
    setCurrentPrice("");
  }

  function edit(x) {
    setEditId(x.id);
    setName(x.name);
    setSymbol(x.symbol);
    setQuantity(x.quantity.toString());
    setBuyPrice(x.buyPrice.toString());
    setCurrentPrice(x.currentPrice.toString());
  }

  function remove(id) {
    store.set("stocks", (prev) => prev.filter((x) => x.id !== id));
  }

  function toggleActive(id, activeVal) {
    store.set("stocks", (prev) =>
      prev.map((x) => (x.id === id ? { ...x, active: !activeVal } : x))
    );
  }

  const stocksTotalValue = stocks.reduce((s, x) => s + (x.active !== false ? x.quantity * x.currentPrice : 0), 0);
  const stocksInvested = stocks.reduce((s, x) => s + (x.active !== false ? x.quantity * x.buyPrice : 0), 0);
  const stocksPnl = stocksTotalValue - stocksInvested;
  const stocksPnlPct = stocksInvested > 0 ? (stocksPnl / stocksInvested) * 100 : 0;

  return (
    <div className="space-y-4">
      {/* Header Info */}
      <section className="glass p-5 border-blue-500/20 text-center relative overflow-hidden">
        <div className="absolute -top-8 -right-8 opacity-5">
          <Briefcase className="w-32 h-32 text-blue-500" />
        </div>
        <div className="flex items-center justify-center gap-2 mb-1">
          <Briefcase className="w-5 h-5 text-blue-500" />
          <span className="text-[11px] uppercase tracking-widest text-text-muted">Portefeuille Actions (Titres vifs)</span>
        </div>
        <p className="text-4xl font-extrabold mono mt-1 text-blue-400 glow-blue">
          {stocksTotalValue.toLocaleString("fr-FR")} €
        </p>
        <div className="flex items-center justify-center gap-3 mt-1.5 text-xs">
          <span className={`font-bold mono ${stocksPnl >= 0 ? "text-neon-green" : "text-neon-red"}`}>
            {stocksPnl >= 0 ? "+" : ""}{stocksPnl.toLocaleString("fr-FR")} € ({fmtPct(stocksPnlPct)})
          </span>
          <span className="text-[10px] text-text-muted">P&L Global</span>
        </div>
      </section>

      {/* Saisie Actions */}
      <section className="glass p-4">
        <div className="flex items-center gap-2 mb-3">
          <Plus className="w-4 h-4 text-neon-cyan" />
          <span className="text-[10px] uppercase tracking-widest text-text-muted">
            {editId ? "Modifier le Titre" : "Ajouter une Action"}
          </span>
        </div>

        <form onSubmit={submit} className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs">
          <div className="col-span-2 sm:col-span-1">
            <label className="text-[10px] text-text-muted block mb-0.5">Symbole (e.g. AAPL)</label>
            <input
              type="text"
              value={symbol}
              onChange={(e) => {
                setSymbol(e.target.value);
                // Autocomplete name if it matches trend
                const match = trends.find(t => t.ticker === e.target.value.toUpperCase());
                if (match) {
                  setName(match.name);
                  if (!currentPrice) setCurrentPrice(match.price.toString());
                }
              }}
              placeholder="Symbole"
              className="input text-xs"
              required
            />
          </div>
          <div className="col-span-2">
            <label className="text-[10px] text-text-muted block mb-0.5">Nom de l'entreprise</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Entreprise"
              className="input text-xs"
              required
            />
          </div>
          <div>
            <label className="text-[10px] text-text-muted block mb-0.5">Quantité</label>
            <input
              type="number"
              step="any"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              placeholder="Quantité"
              className="input text-xs mono"
              required
            />
          </div>
          <div>
            <label className="text-[10px] text-text-muted block mb-0.5">PRU (€)</label>
            <input
              type="number"
              step="any"
              value={buyPrice}
              onChange={(e) => setBuyPrice(e.target.value)}
              placeholder="Achat moyen"
              className="input text-xs mono"
              required
            />
          </div>
          <div className="col-span-2 sm:col-span-1">
            <label className="text-[10px] text-text-muted block mb-0.5">Prix Actuel (€)</label>
            <input
              type="number"
              step="any"
              value={currentPrice}
              onChange={(e) => setCurrentPrice(e.target.value)}
              placeholder="Actuel (opt.)"
              className="input text-xs mono"
            />
          </div>

          <div className="col-span-2 sm:col-span-4 flex items-center gap-1.5 mt-2 justify-end">
            {editId && (
              <button
                type="button"
                onClick={() => {
                  setEditId(null);
                  setName("");
                  setSymbol("");
                  setQuantity("");
                  setBuyPrice("");
                  setCurrentPrice("");
                }}
                className="btn btn-ghost text-[10px] py-1.5 cursor-pointer"
              >
                Annuler
              </button>
            )}
            <button type="submit" className="btn btn-cyan text-[10px] py-1.5 font-bold cursor-pointer">
              {editId ? "Enregistrer" : "Ajouter l'action"}
            </button>
          </div>
        </form>
      </section>

      {/* Listing Actions */}
      {stocks.length > 0 ? (
        <section className="glass p-4">
          <div className="flex items-center gap-2 mb-3">
            <Briefcase className="w-4 h-4 text-text-secondary" />
            <span className="text-[10px] uppercase tracking-widest text-text-muted">Titres Possédés ({stocks.length})</span>
          </div>

          <div className="space-y-1">
            {stocks.map((x) => {
              const itemTotal = x.quantity * x.currentPrice;
              const itemInvested = x.quantity * x.buyPrice;
              const itemPnl = itemTotal - itemInvested;
              const itemPnlPct = itemInvested > 0 ? (itemPnl / itemInvested) * 100 : 0;
              const isActive = x.active !== false;

              return (
                <div
                  key={x.id}
                  className={`flex flex-col sm:flex-row sm:items-center justify-between p-3 rounded-xl border transition-all duration-200 ${
                    isActive
                      ? "bg-surface border-border-subtle hover:border-slate-800"
                      : "bg-surface/30 border-dashed border-border-subtle opacity-50"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => toggleActive(x.id, isActive)}
                      className="cursor-pointer text-text-muted hover:text-neon-cyan transition-colors shrink-0"
                    >
                      {isActive ? (
                        <ToggleRight className="w-8 h-8 text-neon-cyan" />
                      ) : (
                        <ToggleLeft className="w-8 h-8 text-text-muted" />
                      )}
                    </button>
                    <div>
                      <p className="text-xs font-semibold text-text-primary flex items-center gap-1.5">
                        <span className="px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400 font-bold mono text-[9px]">
                          {x.symbol}
                        </span>
                        {x.name}
                      </p>
                      <p className="text-[10px] text-text-muted">
                        Quantité: <span className="mono text-text-secondary">{x.quantity}</span> · PRU: <span className="mono text-text-secondary">{x.buyPrice} €</span>
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-4 mt-2 sm:mt-0 text-right">
                    <div>
                      <p className="text-xs font-bold mono text-text-primary">
                        {itemTotal.toLocaleString("fr-FR")} €
                      </p>
                      <p className={`text-[10px] mono font-semibold ${itemPnl >= 0 ? "text-neon-green" : "text-neon-red"}`}>
                        {itemPnl >= 0 ? "+" : ""}{itemPnl.toLocaleString("fr-FR")} € ({Math.round(itemPnlPct)}%)
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => edit(x)}
                        className="p-1 rounded hover:bg-surface-hover text-text-muted hover:text-neon-cyan cursor-pointer transition-colors"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => remove(x.id)}
                        className="p-1 rounded hover:bg-surface-hover text-text-muted hover:text-neon-red cursor-pointer transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      ) : null}

      {/* Tendance Section */}
      <section className="glass p-4">
        <div className="flex items-center gap-2 mb-3">
          <Sparkles className="w-4 h-4 text-neon-cyan" />
          <span className="text-[10px] uppercase tracking-widest text-text-muted">Tendances Actuelles Marché</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          {trends.map(t => (
            <div key={t.ticker} className="p-2.5 rounded-xl bg-[#030712] border border-border-subtle text-xs">
              <span className="px-1 py-0.2 rounded bg-slate-900 font-bold text-[8px] text-text-muted mono block w-max mb-1">
                {t.ticker}
              </span>
              <p className="font-semibold text-text-primary truncate">{t.name}</p>
              <p className="font-bold mono text-sm text-text-secondary mt-1">{t.price.toFixed(2)} USD</p>
              <span className={`text-[9px] font-bold flex items-center gap-0.5 mt-0.5 ${t.change >= 0 ? "text-neon-green" : "text-neon-red"}`}>
                {t.change >= 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                {t.change >= 0 ? "+" : ""}{t.change}%
              </span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

/* ═══════════════════════════ 4. OR (MINERAIS) ═══════════════════════ */
function GoldTab({ store }) {
  const { gold = [], settings } = store;
  const [name, setName] = useState("");
  const [grams, setGrams] = useState("");
  const [buyPrice, setBuyPrice] = useState(""); // per gram
  const [currentPrice, setCurrentPrice] = useState(""); // per gram
  const [editId, setEditId] = useState(null);

  // Live gold spot estimate
  const goldSpot = 71.42; // €/g

  function submit(e) {
    e.preventDefault();
    const g = parseFloat(grams);
    const buy = parseFloat(buyPrice);
    const cur = parseFloat(currentPrice) || goldSpot;
    if (!name || isNaN(g) || isNaN(buy)) return;

    if (editId) {
      store.set("gold", (prev) =>
        prev.map((x) =>
          x.id === editId
            ? { ...x, name, grams: g, buyPrice: buy, currentPrice: cur }
            : x
        )
      );
      setEditId(null);
    } else {
      const newItem = {
        id: Date.now().toString(36),
        name,
        grams: g,
        buyPrice: buy,
        currentPrice: cur,
        active: true,
      };
      store.set("gold", (prev) => [...(prev || []), newItem]);
    }

    setName("");
    setGrams("");
    setBuyPrice("");
    setCurrentPrice("");
  }

  function edit(x) {
    setEditId(x.id);
    setName(x.name);
    setGrams(x.grams.toString());
    setBuyPrice(x.buyPrice.toString());
    setCurrentPrice(x.currentPrice.toString());
  }

  function remove(id) {
    store.set("gold", (prev) => prev.filter((x) => x.id !== id));
  }

  function toggleActive(id, activeVal) {
    store.set("gold", (prev) =>
      prev.map((x) => (x.id === id ? { ...x, active: !activeVal } : x))
    );
  }

  const goldTotalValue = gold.reduce((s, x) => s + (x.active !== false ? x.grams * x.currentPrice : 0), 0);
  const goldInvested = gold.reduce((s, x) => s + (x.active !== false ? x.grams * x.buyPrice : 0), 0);
  const goldPnl = goldTotalValue - goldInvested;
  const goldPnlPct = goldInvested > 0 ? (goldPnl / goldInvested) * 100 : 0;

  return (
    <div className="space-y-4">
      <section className="glass p-5 border-yellow-500/20 text-center relative overflow-hidden">
        <div className="absolute -top-8 -right-8 opacity-5">
          <Award className="w-32 h-32 text-yellow-500" />
        </div>
        <div className="flex items-center justify-center gap-2 mb-1">
          <Award className="w-5 h-5 text-yellow-500" />
          <span className="text-[11px] uppercase tracking-widest text-text-muted">Métaux Précieux & Or</span>
        </div>
        <p className="text-4xl font-extrabold mono mt-1 text-yellow-400 glow-gold">
          {goldTotalValue.toLocaleString("fr-FR")} €
        </p>
        <div className="flex items-center justify-center gap-3 mt-1.5 text-xs">
          <span className={`font-bold mono ${goldPnl >= 0 ? "text-neon-green" : "text-neon-red"}`}>
            {goldPnl >= 0 ? "+" : ""}{goldPnl.toLocaleString("fr-FR")} € ({fmtPct(goldPnlPct)})
          </span>
          <span className="text-[10px] text-text-muted">P&L Métaux</span>
        </div>
      </section>

      {/* Saisie Or */}
      <section className="glass p-4">
        <div className="flex items-center gap-2 mb-3">
          <Plus className="w-4 h-4 text-neon-cyan" />
          <span className="text-[10px] uppercase tracking-widest text-text-muted">
            {editId ? "Modifier le Métal" : "Ajouter de l'Or / Métal"}
          </span>
        </div>

        <form onSubmit={submit} className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
          <div className="col-span-2">
            <label className="text-[10px] text-text-muted block mb-0.5">Description (e.g. Lingot 10g, Union Latine)</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Lingot d'Or Valcambi"
              className="input text-xs"
              required
            />
          </div>
          <div>
            <label className="text-[10px] text-text-muted block mb-0.5">Masse (Grammes)</label>
            <input
              type="number"
              step="any"
              value={grams}
              onChange={(e) => setGrams(e.target.value)}
              placeholder="Grammes"
              className="input text-xs mono"
              required
            />
          </div>
          <div>
            <label className="text-[10px] text-text-muted block mb-0.5">Prix d'Achat (€/g)</label>
            <input
              type="number"
              step="any"
              value={buyPrice}
              onChange={(e) => setBuyPrice(e.target.value)}
              placeholder="Ex: 68.50"
              className="input text-xs mono"
              required
            />
          </div>
          <div className="col-span-2 sm:col-span-1">
            <label className="text-[10px] text-text-muted block mb-0.5">Prix Actuel Estimé (€/g)</label>
            <input
              type="number"
              step="any"
              value={currentPrice}
              onChange={(e) => setCurrentPrice(e.target.value)}
              placeholder={`Par défaut: ${goldSpot} €/g`}
              className="input text-xs mono"
            />
          </div>

          <div className="col-span-2 sm:col-span-3 flex items-center gap-1.5 mt-2 justify-end">
            {editId && (
              <button
                type="button"
                onClick={() => {
                  setEditId(null);
                  setName("");
                  setGrams("");
                  setBuyPrice("");
                  setCurrentPrice("");
                }}
                className="btn btn-ghost text-[10px] py-1.5 cursor-pointer"
              >
                Annuler
              </button>
            )}
            <button type="submit" className="btn btn-cyan text-[10px] py-1.5 font-bold cursor-pointer">
              {editId ? "Enregistrer" : "Ajouter"}
            </button>
          </div>
        </form>
      </section>

      {/* Listings */}
      {gold.length > 0 ? (
        <section className="glass p-4">
          <div className="flex items-center gap-2 mb-3">
            <Award className="w-4 h-4 text-text-secondary" />
            <span className="text-[10px] uppercase tracking-widest text-text-muted">Actifs Précieux ({gold.length})</span>
          </div>

          <div className="space-y-1">
            {gold.map((x) => {
              const itemTotal = x.grams * x.currentPrice;
              const itemInvested = x.grams * x.buyPrice;
              const itemPnl = itemTotal - itemInvested;
              const itemPnlPct = itemInvested > 0 ? (itemPnl / itemInvested) * 100 : 0;
              const isActive = x.active !== false;

              return (
                <div
                  key={x.id}
                  className={`flex flex-col sm:flex-row sm:items-center justify-between p-3 rounded-xl border transition-all duration-200 ${
                    isActive
                      ? "bg-surface border-border-subtle hover:border-slate-800"
                      : "bg-surface/30 border-dashed border-border-subtle opacity-50"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => toggleActive(x.id, isActive)}
                      className="cursor-pointer text-text-muted hover:text-neon-cyan transition-colors shrink-0"
                    >
                      {isActive ? (
                        <ToggleRight className="w-8 h-8 text-neon-cyan" />
                      ) : (
                        <ToggleLeft className="w-8 h-8 text-text-muted" />
                      )}
                    </button>
                    <div>
                      <p className="text-xs font-semibold text-text-primary flex items-center gap-1.5">
                        <span className="px-1.5 py-0.5 rounded bg-yellow-500/10 text-yellow-400 font-bold mono text-[9px]">
                          OR
                        </span>
                        {x.name}
                      </p>
                      <p className="text-[10px] text-text-muted">
                        Masse: <span className="mono text-text-secondary">{x.grams} g</span> · Achat: <span className="mono text-text-secondary">{x.buyPrice} €/g</span> · Actuel: <span className="mono text-text-secondary">{x.currentPrice} €/g</span>
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-4 mt-2 sm:mt-0 text-right">
                    <div>
                      <p className="text-xs font-bold mono text-text-primary">
                        {itemTotal.toLocaleString("fr-FR")} €
                      </p>
                      <p className={`text-[10px] mono font-semibold ${itemPnl >= 0 ? "text-neon-green" : "text-neon-red"}`}>
                        {itemPnl >= 0 ? "+" : ""}{itemPnl.toLocaleString("fr-FR")} € ({Math.round(itemPnlPct)}%)
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => edit(x)}
                        className="p-1 rounded hover:bg-surface-hover text-text-muted hover:text-neon-cyan cursor-pointer transition-colors"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => remove(x.id)}
                        className="p-1 rounded hover:bg-surface-hover text-text-muted hover:text-neon-red cursor-pointer transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      ) : null}

      {/* Spot Price Visual */}
      <section className="glass p-3 flex justify-between items-center bg-[#030712]">
        <div className="flex items-center gap-2">
          <Award className="w-4 h-4 text-neon-orange" />
          <div>
            <span className="text-[9px] uppercase tracking-wider text-text-muted block">Cours Spot Or de Référence</span>
            <span className="text-xs font-bold text-text-primary">{goldSpot} € / gramme</span>
          </div>
        </div>
        <span className="text-[10px] text-neon-green bg-neon-green/10 border border-neon-green/20 px-2 py-0.5 rounded font-bold">
          ↑ +0.8% sur 24h
        </span>
      </section>
    </div>
  );
}

/* ═══════════════════════════ 5. IMMOBILIER ═══════════════════════ */
function RealEstateTab({ store }) {
  const { realEstate = [], settings } = store;
  const [name, setName] = useState("");
  const [buyPrice, setBuyPrice] = useState("");
  const [currentPrice, setCurrentPrice] = useState("");
  const [type, setType] = useState("Appartement");
  const [editId, setEditId] = useState(null);

  function submit(e) {
    e.preventDefault();
    const buy = parseFloat(buyPrice);
    const cur = parseFloat(currentPrice) || buy;
    if (!name || isNaN(buy)) return;

    if (editId) {
      store.set("realEstate", (prev) =>
        prev.map((x) =>
          x.id === editId
            ? { ...x, name, buyPrice: buy, currentPrice: cur, type }
            : x
        )
      );
      setEditId(null);
    } else {
      const newItem = {
        id: Date.now().toString(36),
        name,
        buyPrice: buy,
        currentPrice: cur,
        type,
        active: true,
      };
      store.set("realEstate", (prev) => [...(prev || []), newItem]);
    }

    setName("");
    setBuyPrice("");
    setCurrentPrice("");
    setType("Appartement");
  }

  function edit(x) {
    setEditId(x.id);
    setName(x.name);
    setBuyPrice(x.buyPrice.toString());
    setCurrentPrice(x.currentPrice.toString());
    setType(x.type);
  }

  function remove(id) {
    store.set("realEstate", (prev) => prev.filter((x) => x.id !== id));
  }

  function toggleActive(id, activeVal) {
    store.set("realEstate", (prev) =>
      prev.map((x) => (x.id === id ? { ...x, active: !activeVal } : x))
    );
  }

  const immoTotalValue = realEstate.reduce((s, x) => s + (x.active !== false ? x.currentPrice : 0), 0);
  const immoInvested = realEstate.reduce((s, x) => s + (x.active !== false ? x.buyPrice : 0), 0);
  const immoPnl = immoTotalValue - immoInvested;
  const immoPnlPct = immoInvested > 0 ? (immoPnl / immoInvested) * 100 : 0;

  return (
    <div className="space-y-4">
      <section className="glass p-5 border-emerald-500/20 text-center relative overflow-hidden">
        <div className="absolute -top-8 -right-8 opacity-5">
          <Home className="w-32 h-32 text-emerald-500" />
        </div>
        <div className="flex items-center justify-center gap-2 mb-1">
          <Home className="w-5 h-5 text-emerald-500" />
          <span className="text-[11px] uppercase tracking-widest text-text-muted">Patrimoine Immobilier (Estimé)</span>
        </div>
        <p className="text-4xl font-extrabold mono mt-1 text-emerald-400 glow-green">
          {immoTotalValue.toLocaleString("fr-FR")} €
        </p>
        <div className="flex items-center justify-center gap-3 mt-1.5 text-xs">
          <span className={`font-bold mono ${immoPnl >= 0 ? "text-neon-green" : "text-neon-red"}`}>
            {immoPnl >= 0 ? "+" : ""}{immoPnl.toLocaleString("fr-FR")} € ({fmtPct(immoPnlPct)})
          </span>
          <span className="text-[10px] text-text-muted">Plus-value Estimée</span>
        </div>
      </section>

      {/* Saisie Immo */}
      <section className="glass p-4">
        <div className="flex items-center gap-2 mb-3">
          <Plus className="w-4 h-4 text-neon-cyan" />
          <span className="text-[10px] uppercase tracking-widest text-text-muted">
            {editId ? "Modifier le bien" : "Ajouter un Bien / SCPI"}
          </span>
        </div>

        <form onSubmit={submit} className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs">
          <div className="col-span-2">
            <label className="text-[10px] text-text-muted block mb-0.5">Désignation du bien</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Studio Paris XI, SCPI Pierval"
              className="input text-xs"
              required
            />
          </div>
          <div>
            <label className="text-[10px] text-text-muted block mb-0.5">Type de bien</label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="input text-xs bg-slate-950"
            >
              <option value="Appartement">Appartement</option>
              <option value="Maison">Maison</option>
              <option value="SCPI">SCPI</option>
              <option value="Terrain">Terrain</option>
            </select>
          </div>
          <div>
            <label className="text-[10px] text-text-muted block mb-0.5">Prix d'Achat (€)</label>
            <input
              type="number"
              value={buyPrice}
              onChange={(e) => setBuyPrice(e.target.value)}
              placeholder="Achat"
              className="input text-xs mono"
              required
            />
          </div>
          <div>
            <label className="text-[10px] text-text-muted block mb-0.5">Valeur Actuelle (€)</label>
            <input
              type="number"
              value={currentPrice}
              onChange={(e) => setCurrentPrice(e.target.value)}
              placeholder="Estimé actuel"
              className="input text-xs mono"
            />
          </div>

          <div className="col-span-2 sm:col-span-4 flex items-center gap-1.5 mt-2 justify-end">
            {editId && (
              <button
                type="button"
                onClick={() => {
                  setEditId(null);
                  setName("");
                  setBuyPrice("");
                  setCurrentPrice("");
                  setType("Appartement");
                }}
                className="btn btn-ghost text-[10px] py-1.5 cursor-pointer"
              >
                Annuler
              </button>
            )}
            <button type="submit" className="btn btn-cyan text-[10px] py-1.5 font-bold cursor-pointer">
              {editId ? "Enregistrer" : "Ajouter le bien"}
            </button>
          </div>
        </form>
      </section>

      {/* Listing Immo */}
      {realEstate.length > 0 ? (
        <section className="glass p-4">
          <div className="flex items-center gap-2 mb-3">
            <Home className="w-4 h-4 text-text-secondary" />
            <span className="text-[10px] uppercase tracking-widest text-text-muted">Biens en Possession ({realEstate.length})</span>
          </div>

          <div className="space-y-1">
            {realEstate.map((x) => {
              const itemPnl = x.currentPrice - x.buyPrice;
              const itemPnlPct = x.buyPrice > 0 ? (itemPnl / x.buyPrice) * 100 : 0;
              const isActive = x.active !== false;

              return (
                <div
                  key={x.id}
                  className={`flex flex-col sm:flex-row sm:items-center justify-between p-3 rounded-xl border transition-all duration-200 ${
                    isActive
                      ? "bg-surface border-border-subtle hover:border-slate-800"
                      : "bg-surface/30 border-dashed border-border-subtle opacity-50"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => toggleActive(x.id, isActive)}
                      className="cursor-pointer text-text-muted hover:text-neon-cyan transition-colors shrink-0"
                    >
                      {isActive ? (
                        <ToggleRight className="w-8 h-8 text-neon-cyan" />
                      ) : (
                        <ToggleLeft className="w-8 h-8 text-text-muted" />
                      )}
                    </button>
                    <div>
                      <p className="text-xs font-semibold text-text-primary flex items-center gap-1.5">
                        <span className="px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 font-bold mono text-[9px]">
                          {x.type || "IMMO"}
                        </span>
                        {x.name}
                      </p>
                      <p className="text-[10px] text-text-muted">
                        Achat: <span className="mono text-text-secondary">{x.buyPrice.toLocaleString("fr-FR")} €</span> · Estimé: <span className="mono text-text-secondary">{x.currentPrice.toLocaleString("fr-FR")} €</span>
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-4 mt-2 sm:mt-0 text-right">
                    <div>
                      <p className="text-xs font-bold mono text-text-primary">
                        {x.currentPrice.toLocaleString("fr-FR")} €
                      </p>
                      <p className={`text-[10px] mono font-semibold ${itemPnl >= 0 ? "text-neon-green" : "text-neon-red"}`}>
                        {itemPnl >= 0 ? "+" : ""}{itemPnl.toLocaleString("fr-FR")} € ({Math.round(itemPnlPct)}%)
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => edit(x)}
                        className="p-1 rounded hover:bg-surface-hover text-text-muted hover:text-neon-cyan cursor-pointer transition-colors"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => remove(x.id)}
                        className="p-1 rounded hover:bg-surface-hover text-text-muted hover:text-neon-red cursor-pointer transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      ) : null}
    </div>
  );
}

/* ═══════════════════════════ 6. ETFS ═══════════════════════ */
function EtfsTab({ store }) {
  const { etfs = [], settings } = store;
  const [name, setName] = useState("");
  const [symbol, setSymbol] = useState("");
  const [quantity, setQuantity] = useState("");
  const [buyPrice, setBuyPrice] = useState(""); // PRU
  const [currentPrice, setCurrentPrice] = useState("");
  const [editId, setEditId] = useState(null);

  // Simulated live index etf pricing
  const popularEtfs = [
    { symbol: "CW8", name: "Amundi MSCI World UCITS", price: 518.42, change: 0.65 },
    { symbol: "WPEA", name: "iShares MSCI World Swap", price: 5.48, change: 0.72 },
    { symbol: "ESE", name: "BNP Paribas S&P 500", price: 23.94, change: 1.15 },
  ];

  function submit(e) {
    e.preventDefault();
    const qty = parseFloat(quantity);
    const buy = parseFloat(buyPrice);
    const cur = parseFloat(currentPrice) || buy;
    if (!name || !symbol || isNaN(qty) || isNaN(buy)) return;

    if (editId) {
      store.set("etfs", (prev) =>
        prev.map((x) =>
          x.id === editId
            ? { ...x, name, symbol: symbol.toUpperCase(), quantity: qty, buyPrice: buy, currentPrice: cur }
            : x
        )
      );
      setEditId(null);
    } else {
      const newItem = {
        id: Date.now().toString(36),
        name,
        symbol: symbol.toUpperCase(),
        quantity: qty,
        buyPrice: buy,
        currentPrice: cur,
        active: true,
      };
      store.set("etfs", (prev) => [...(prev || []), newItem]);
    }

    setName("");
    setSymbol("");
    setQuantity("");
    setBuyPrice("");
    setCurrentPrice("");
  }

  function edit(x) {
    setEditId(x.id);
    setName(x.name);
    setSymbol(x.symbol);
    setQuantity(x.quantity.toString());
    setBuyPrice(x.buyPrice.toString());
    setCurrentPrice(x.currentPrice.toString());
  }

  function remove(id) {
    store.set("etfs", (prev) => prev.filter((x) => x.id !== id));
  }

  function toggleActive(id, activeVal) {
    store.set("etfs", (prev) =>
      prev.map((x) => (x.id === id ? { ...x, active: !activeVal } : x))
    );
  }

  const etfsTotalValue = etfs.reduce((s, x) => s + (x.active !== false ? x.quantity * x.currentPrice : 0), 0);
  const etfsInvested = etfs.reduce((s, x) => s + (x.active !== false ? x.quantity * x.buyPrice : 0), 0);
  const etfsPnl = etfsTotalValue - etfsInvested;
  const etfsPnlPct = etfsInvested > 0 ? (etfsPnl / etfsInvested) * 100 : 0;

  return (
    <div className="space-y-4">
      <section className="glass p-5 border-purple-500/20 text-center relative overflow-hidden">
        <div className="absolute -top-8 -right-8 opacity-5">
          <Layers className="w-32 h-32 text-purple-500" />
        </div>
        <div className="flex items-center justify-center gap-2 mb-1">
          <Layers className="w-5 h-5 text-purple-500" />
          <span className="text-[11px] uppercase tracking-widest text-text-muted">Portefeuille ETF (Indices)</span>
        </div>
        <p className="text-4xl font-extrabold mono mt-1 text-purple-400 glow-purple">
          {etfsTotalValue.toLocaleString("fr-FR")} €
        </p>
        <div className="flex items-center justify-center gap-3 mt-1.5 text-xs">
          <span className={`font-bold mono ${etfsPnl >= 0 ? "text-neon-green" : "text-neon-red"}`}>
            {etfsPnl >= 0 ? "+" : ""}{etfsPnl.toLocaleString("fr-FR")} € ({fmtPct(etfsPnlPct)})
          </span>
          <span className="text-[10px] text-text-muted">P&L ETFs</span>
        </div>
      </section>

      {/* Saisie ETFs */}
      <section className="glass p-4">
        <div className="flex items-center gap-2 mb-3">
          <Plus className="w-4 h-4 text-neon-cyan" />
          <span className="text-[10px] uppercase tracking-widest text-text-muted">
            {editId ? "Modifier l'ETF" : "Ajouter une position ETF"}
          </span>
        </div>

        <form onSubmit={submit} className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs">
          <div className="col-span-2 sm:col-span-1">
            <label className="text-[10px] text-text-muted block mb-0.5">Symbole (e.g. CW8)</label>
            <input
              type="text"
              value={symbol}
              onChange={(e) => {
                setSymbol(e.target.value);
                const match = popularEtfs.find(p => p.symbol === e.target.value.toUpperCase());
                if (match) {
                  setName(match.name);
                  if (!currentPrice) setCurrentPrice(match.price.toString());
                }
              }}
              placeholder="Symbole"
              className="input text-xs"
              required
            />
          </div>
          <div className="col-span-2">
            <label className="text-[10px] text-text-muted block mb-0.5">Nom de l'ETF</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Description"
              className="input text-xs"
              required
            />
          </div>
          <div>
            <label className="text-[10px] text-text-muted block mb-0.5">Nombre de parts</label>
            <input
              type="number"
              step="any"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              placeholder="Parts"
              className="input text-xs mono"
              required
            />
          </div>
          <div>
            <label className="text-[10px] text-text-muted block mb-0.5">PRU (€)</label>
            <input
              type="number"
              step="any"
              value={buyPrice}
              onChange={(e) => setBuyPrice(e.target.value)}
              placeholder="Prix de revient"
              className="input text-xs mono"
              required
            />
          </div>
          <div className="col-span-2 sm:col-span-1">
            <label className="text-[10px] text-text-muted block mb-0.5">Prix Actuel (€)</label>
            <input
              type="number"
              step="any"
              value={currentPrice}
              onChange={(e) => setCurrentPrice(e.target.value)}
              placeholder="Prix actuel (opt.)"
              className="input text-xs mono"
            />
          </div>

          <div className="col-span-2 sm:col-span-4 flex items-center gap-1.5 mt-2 justify-end">
            {editId && (
              <button
                type="button"
                onClick={() => {
                  setEditId(null);
                  setName("");
                  setSymbol("");
                  setQuantity("");
                  setBuyPrice("");
                  setCurrentPrice("");
                }}
                className="btn btn-ghost text-[10px] py-1.5 cursor-pointer"
              >
                Annuler
              </button>
            )}
            <button type="submit" className="btn btn-cyan text-[10px] py-1.5 font-bold cursor-pointer">
              {editId ? "Enregistrer" : "Ajouter la position"}
            </button>
          </div>
        </form>
      </section>

      {/* Listing ETFs */}
      {etfs.length > 0 ? (
        <section className="glass p-4">
          <div className="flex items-center gap-2 mb-3">
            <Layers className="w-4 h-4 text-text-secondary" />
            <span className="text-[10px] uppercase tracking-widest text-text-muted">Positions ETF ({etfs.length})</span>
          </div>

          <div className="space-y-1">
            {etfs.map((x) => {
              const itemTotal = x.quantity * x.currentPrice;
              const itemInvested = x.quantity * x.buyPrice;
              const itemPnl = itemTotal - itemInvested;
              const itemPnlPct = itemInvested > 0 ? (itemPnl / itemInvested) * 100 : 0;
              const isActive = x.active !== false;

              return (
                <div
                  key={x.id}
                  className={`flex flex-col sm:flex-row sm:items-center justify-between p-3 rounded-xl border transition-all duration-200 ${
                    isActive
                      ? "bg-surface border-border-subtle hover:border-slate-800"
                      : "bg-surface/30 border-dashed border-border-subtle opacity-50"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => toggleActive(x.id, isActive)}
                      className="cursor-pointer text-text-muted hover:text-neon-cyan transition-colors shrink-0"
                    >
                      {isActive ? (
                        <ToggleRight className="w-8 h-8 text-neon-cyan" />
                      ) : (
                        <ToggleLeft className="w-8 h-8 text-text-muted" />
                      )}
                    </button>
                    <div>
                      <p className="text-xs font-semibold text-text-primary flex items-center gap-1.5">
                        <span className="px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-400 font-bold mono text-[9px]">
                          {x.symbol}
                        </span>
                        {x.name}
                      </p>
                      <p className="text-[10px] text-text-muted">
                        Parts: <span className="mono text-text-secondary">{x.quantity}</span> · PRU: <span className="mono text-text-secondary">{x.buyPrice} €</span>
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-4 mt-2 sm:mt-0 text-right">
                    <div>
                      <p className="text-xs font-bold mono text-text-primary">
                        {itemTotal.toLocaleString("fr-FR")} €
                      </p>
                      <p className={`text-[10px] mono font-semibold ${itemPnl >= 0 ? "text-neon-green" : "text-neon-red"}`}>
                        {itemPnl >= 0 ? "+" : ""}{itemPnl.toLocaleString("fr-FR")} € ({Math.round(itemPnlPct)}%)
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => edit(x)}
                        className="p-1 rounded hover:bg-surface-hover text-text-muted hover:text-neon-cyan cursor-pointer transition-colors"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => remove(x.id)}
                        className="p-1 rounded hover:bg-surface-hover text-text-muted hover:text-neon-red cursor-pointer transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      ) : null}

      {/* ETF Indices Visual */}
      <section className="glass p-4">
        <div className="flex items-center gap-2 mb-3">
          <Sparkles className="w-4 h-4 text-neon-cyan" />
          <span className="text-[10px] uppercase tracking-widest text-text-muted">Indices de Référence ETF</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          {popularEtfs.map(e => (
            <div key={e.symbol} className="p-2.5 rounded-xl bg-[#030712] border border-border-subtle text-xs flex justify-between items-center">
              <div>
                <span className="px-1.5 py-0.2 rounded bg-slate-900 font-bold text-[8px] text-text-muted mono block w-max mb-0.5">
                  {e.symbol}
                </span>
                <p className="font-semibold text-text-primary truncate max-w-[140px]">{e.name}</p>
                <p className="font-bold mono text-xs text-text-secondary mt-0.5">{e.price.toFixed(2)} €</p>
              </div>
              <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${e.change >= 0 ? "text-neon-green bg-neon-green/10" : "text-neon-red bg-neon-red/10"}`}>
                {e.change >= 0 ? "+" : ""}{e.change}%
              </span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
