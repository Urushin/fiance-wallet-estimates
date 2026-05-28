"use client";
import { useMemo, useState, useEffect, useRef } from "react";
import { useStore } from "@/lib/store";
import {
  fmtNum, today, addMonths, computeCapital, computeMonthData, computeAllTransactions,
  fetchCryptoPrices, groupBySource,
  computeCapitalFrom, getCapitalHistoryFrom, computeCapitalFromToday, getCapitalHistoryFromToday,
  fetchCryptoPortfolioPrices, computeTotalInvestments, computeWarEconomySavings,
} from "@/lib/utils";
import { CRYPTO_PORTFOLIO, ALL_COINGECKO_IDS, getCoinGeckoId, TOTAL_INVESTED_USD } from "@/lib/cryptoData";
import {
  Wallet, TrendingUp, TrendingDown, Zap, Target, Calendar, Sparkles,
  ArrowUpRight, ArrowDownRight, Coins, AlertTriangle, ChevronLeft, ChevronRight, Clock,
  Plus, Trash2, Check, Circle, CheckCircle2, StickyNote, ChevronDown, ChevronUp, Edit2, FlaskConical,
  GripVertical, X
} from "lucide-react";
import { AreaChart, Area, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";

function Tip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="glass p-2 shadow-xl text-xs">
      <p className="text-text-muted mb-0.5">{label}</p>
      {payload.map((e, i) => <p key={i} style={{ color: e.color }} className="font-semibold">{e.name}: {fmtNum(e.value)} €</p>)}
    </div>
  );
}

export default function Dashboard() {
  const store = useStore();
  const { settings, crypto, pockets, alternance, capitalInitial, transactions } = store;

  const [isCustomizing, setIsCustomizing] = useState(false);
  const [draggedIdx, setDraggedIdx] = useState(null);
  const [dragOverIdx, setDragOverIdx] = useState(null);
  const longPressTimer = useRef(null);
  const isPressing = useRef(false);

  const startLongPress = (e) => {
    isPressing.current = true;
    longPressTimer.current = setTimeout(() => {
      if (isPressing.current) {
        setIsCustomizing(true);
        if (navigator.vibrate) {
          navigator.vibrate(60);
        }
      }
    }, 750);
  };

  const endLongPress = () => {
    isPressing.current = false;
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
    }
  };

  const defaultOrder = ["main_kpi", "kpi_cards", "net_balance", "goals", "scenario", "investments", "war_mode"];
  const blockOrder = useMemo(() => {
    const savedOrder = settings?.dashboardBlockOrder || [];
    const merged = [...savedOrder];
    defaultOrder.forEach(blockId => {
      if (!merged.includes(blockId)) {
        merged.push(blockId);
      }
    });
    return merged;
  }, [settings?.dashboardBlockOrder]);

  const hiddenBlocks = settings?.hiddenDashboardBlocks || [];

  const shiftBlock = (idx, direction) => {
    const targetIdx = idx + direction;
    if (targetIdx < 0 || targetIdx >= blockOrder.length) return;

    const newOrder = [...blockOrder];
    const [movedId] = newOrder.splice(idx, 1);
    newOrder.splice(targetIdx, 0, movedId);

    store.setNested("settings", "dashboardBlockOrder", newOrder);
    
    if (navigator.vibrate) {
      navigator.vibrate(30);
    }
  };

  const hideBlock = (id) => {
    if (!hiddenBlocks.includes(id)) {
      const newHidden = [...hiddenBlocks, id];
      store.setNested("settings", "hiddenDashboardBlocks", newHidden);
    }
  };

  const restoreBlock = (id) => {
    const newHidden = hiddenBlocks.filter(b => b !== id);
    store.setNested("settings", "hiddenDashboardBlocks", newHidden);
  };

  const blockNames = {
    main_kpi: "Capital Total",
    kpi_cards: "Revenus & Dépenses",
    net_balance: "Balance Nette",
    goals: "Objectifs",
    scenario: "Solde actuel",
    investments: "Portefeuille Investissement",
    war_mode: "Bannière Économie de Guerre",
  };

  const handleDragStart = (e, idx) => {
    if (!isCustomizing) return;
    setDraggedIdx(idx);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e, idx) => {
    e.preventDefault();
    if (draggedIdx === null || draggedIdx === idx) return;
    setDragOverIdx(idx);
  };

  const handleDrop = (e, targetIdx) => {
    e.preventDefault();
    if (draggedIdx === null || draggedIdx === targetIdx) return;

    const newOrder = [...blockOrder];
    const [movedId] = newOrder.splice(draggedIdx, 1);
    newOrder.splice(targetIdx, 0, movedId);

    store.setNested("settings", "dashboardBlockOrder", newOrder);
    setDraggedIdx(null);
    setDragOverIdx(null);
  };

  const handleDragEnd = () => {
    setDraggedIdx(null);
    setDragOverIdx(null);
  };
  const [simDate, setSimDate] = useState(today());
  const [showSetup, setShowSetup] = useState(false);
  const [setupVal, setSetupVal] = useState("");
  const [cryptoPrices, setCryptoPrices] = useState({});
  const [portfolioPrices, setPortfolioPrices] = useState({});

  const isProjection = simDate > today();
  const simMonthKey = simDate.slice(0, 7);

  useEffect(() => {
    if (capitalInitial === 0 && transactions.length === 0) setShowSetup(true);
  }, [capitalInitial, transactions.length]);

  useEffect(() => {
    if (crypto?.length > 0) fetchCryptoPrices(crypto.map(c => c.coinId || getCoinGeckoId(c.symbol))).then(setCryptoPrices);
  }, [crypto]);

  // Fetch portfolio crypto prices for dashboard integration
  useEffect(() => {
    fetchCryptoPortfolioPrices(ALL_COINGECKO_IDS).then(setPortfolioPrices);
  }, []);

  // Snapshot logic
  useEffect(() => {
    if (!store.loaded) return;
    const m = today().slice(0, 7);
    const existing = store.snapshots?.find(s => s.month === m);
    // Take snapshot if it's a new month and we have a capital
    if (!existing && capitalInitial > 0) {
      const cryptoVal = crypto?.length ? crypto.reduce((s, h) => s + h.quantity * (cryptoPrices[h.coinId || getCoinGeckoId(h.symbol)]?.eur || 0), 0) : 0;
      const snap = { month: m, date: today(), capital: computeCapital(store, today()), cryptoValue: cryptoVal };
      store.set("snapshots", prev => [...(prev || []), snap]);
    }
  }, [store.loaded, capitalInitial, crypto, cryptoPrices, store.snapshots]);

  // ── Centralized computations ─────────────────────────────
  const capital = useMemo(() => computeCapital(store, simDate, "expected"), [store, simDate]);
  const capitalMin = useMemo(() => computeCapital(store, simDate, "min"), [store, simDate]);
  const capitalMax = useMemo(() => computeCapital(store, simDate, "max"), [store, simDate]);

  const goal = settings?.goalTotal || 20000;
  const remaining = Math.max(0, goal - capital);
  const pct = Math.min(100, goal > 0 ? (capital / goal) * 100 : 0);

  const monthData = useMemo(() => computeMonthData(store, simMonthKey), [store, simMonthKey]);
  const allTxs = useMemo(() => computeAllTransactions(store, simDate), [store, simDate]);

  const cryptoValue = useMemo(() => {
    if (!crypto?.length) return 0;
    return crypto.reduce((s, h) => s + h.quantity * (cryptoPrices[h.coinId || getCoinGeckoId(h.symbol)]?.eur || 0), 0);
  }, [crypto, cryptoPrices]);

  // Portfolio crypto value (from CSV data)
  const portfolioCryptoEur = useMemo(() => {
    return CRYPTO_PORTFOLIO.reduce((s, h) => {
      const coinId = getCoinGeckoId(h.symbol);
      const eurPrice = portfolioPrices[coinId]?.eur || 0;
      return s + h.amount * eurPrice;
    }, 0);
  }, [portfolioPrices]);

  const portfolioCryptoUsd = useMemo(() => {
    return CRYPTO_PORTFOLIO.reduce((s, h) => {
      const coinId = getCoinGeckoId(h.symbol);
      const usdPrice = portfolioPrices[coinId]?.usd || 0;
      return s + h.amount * usdPrice;
    }, 0);
  }, [portfolioPrices]);

  const showRange = (isProjection || settings?.includeTreasuryInCapital) && (capitalMin !== capital || capitalMax !== capital);

  // Revenue by source for this month
  const incomeSources = useMemo(() => groupBySource(monthData.transactions, "income"), [monthData]);
  const expenseSources = useMemo(() => groupBySource(monthData.transactions, "expense"), [monthData]);



  // Quick date nav

  function handleSetup(e) {
    e.preventDefault();
    const v = parseFloat(setupVal);
    if (v >= 0) { store.set("capitalInitial", v); setShowSetup(false); }
  }

  const renderBlock = (id) => {
    switch (id) {
      case "main_kpi":
        return (
          <section className="glass p-5 text-center relative overflow-hidden h-full">
            {showRange && <div className="absolute top-0 right-0 p-3 opacity-20"><TrendingUp className="w-20 h-20 text-neon-cyan" /></div>}
            <span className="text-[11px] uppercase tracking-[0.15em] text-text-muted"> Capital Total {showRange ? "(Médian)" : ""}{settings?.includeInvestmentsInCapital ? " + Investissements" : ""}</span>
            <p className={`text-4xl sm:text-5xl font-extrabold mono mt-1 ${capital >= 0 ? "text-neon-green glow-g" : "text-neon-red glow-r"}`}>
              {fmtNum(capital)} €
            </p>

            {settings?.includeInvestmentsInCapital && computeTotalInvestments(store) > 0 && (
              <div className="flex items-center justify-center gap-2 mt-1">
                <Sparkles className="w-3 h-3 text-neon-cyan" />
                <span className="text-[10px] text-neon-cyan mono font-semibold">dont investissement : {fmtNum(computeTotalInvestments(store))} €</span>
                <span className="text-[10px] text-text-muted">(hors investissement : {fmtNum(capital - computeTotalInvestments(store))} €)</span>
              </div>
            )}

            {showRange && (
              <div className="flex justify-center gap-6 mt-3 text-[10px] text-text-muted px-4 py-2 rounded-xl bg-[#030712] border border-border-subtle inline-flex mx-auto">
                <span className="flex flex-col items-center">
                  <span className="uppercase tracking-widest opacity-60">Pire cas</span>
                  <span className="mono text-neon-red font-bold text-xs">{fmtNum(capitalMin)} €</span>
                </span>
                <div className="w-[1px] bg-border-subtle" />
                <span className="flex flex-col items-center">
                  <span className="uppercase tracking-widest opacity-60">Optimiste</span>
                  <span className="mono text-neon-cyan font-bold text-xs">{fmtNum(capitalMax)} €</span>
                </span>
              </div>
            )}

            <p className="text-xs text-text-muted mt-3">
              objectif <span className="text-text-secondary font-semibold">{fmtNum(goal)} €</span>
            </p>
            <div className="max-w-md mx-auto mt-3">
              <div className="progress-track h-2.5">
                <div className="progress-fill h-full bg-gradient-to-r from-emerald-600 to-neon-green" style={{ width: `${Math.min(100, goal > 0 ? (capital / goal) * 100 : 0)}%` }} />
              </div>
              <div className="flex justify-between mt-1 text-[10px] text-text-muted">
                <span>{(Math.min(100, goal > 0 ? (capital / goal) * 100 : 0)).toFixed(1)}%</span>
                <span>Reste : <span className="text-neon-red mono">{fmtNum(Math.max(0, goal - capital))} €</span></span>
              </div>
            </div>
            {capitalInitial === 0 && transactions.length === 0 && (
              <button onClick={() => setShowSetup(true)} className="btn btn-ghost text-xs mt-3 mx-auto">
                <Wallet className="w-3.5 h-3.5" /> Définir mon capital initial
              </button>
            )}
          </section>
        );
      case "kpi_cards":
        return (
          <div className="grid grid-cols-2 gap-2.5 h-full">
            <KPI icon={<ArrowUpRight className="w-3.5 h-3.5 text-neon-green" />}
              label={`Revenus ${isProjection ? "mois" : "ce mois"}`} value={`${fmtNum(monthData.income)} €`} color="text-neon-green" />
            <KPI icon={<ArrowDownRight className="w-3.5 h-3.5 text-neon-red" />}
              label={`Dépenses ${isProjection ? "mois" : "ce mois"}`} value={`${fmtNum(monthData.expense)} €`} color="text-neon-red" />
          </div>
        );
      case "net_balance":
        return (
          <div className="glass p-3.5 h-full">
            <div className="flex items-center gap-2 mb-1.5">
              <TrendingUp className="w-4 h-4 text-neon-cyan" />
              <span className="text-[10px] uppercase tracking-widest text-text-muted">Balance nette du mois</span>
            </div>
            <p className={`text-lg font-bold mono ${monthData.net >= 0 ? "text-neon-green" : "text-neon-red"}`}>
              {monthData.net >= 0 ? "+" : ""}{fmtNum(monthData.net)} €
            </p>
            <div className="flex gap-2 mt-1 text-[10px] text-text-muted">
              {incomeSources.slice(0, 2).map(s => <span key={s.name} className="text-neon-green">{s.name}</span>)}
              {expenseSources.slice(0, 2).map(s => <span key={s.name} className="text-neon-red">{s.name}</span>)}
            </div>
          </div>
        );
      case "goals":
        return <GoalsBlock />;
      case "scenario":
        return <ScenarioBlock />;
      case "investments":
        if (computeTotalInvestments(store) <= 0 && !isCustomizing) return null;
        return (
          <div className="glass p-3.5 border-neon-cyan/20 h-full">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-neon-cyan" />
                <span className="text-xs text-text-muted font-medium">Portefeuille Investissement</span>
              </div>
              <span className="mono text-sm text-neon-cyan font-bold">
                {computeTotalInvestments(store).toLocaleString("fr-FR")} €
              </span>
            </div>
            <div className="mt-1.5 flex items-center justify-between text-[9px] text-text-muted">
              <span>Actions, Or, Immo, ETF & Crypto actifs</span>
              {settings?.includeInvestmentsInCapital ? (
                <span className="text-neon-cyan font-semibold flex items-center gap-1">
                  <Zap className="w-2.5 h-2.5 animate-pulse" /> Inclus dans le capital
                </span>
              ) : (
                <span className="text-text-muted italic">Exclu du capital</span>
              )}
            </div>
          </div>
        );
      case "war_mode": {
        const warSavings = computeWarEconomySavings(store);
        const warCapital = computeCapital(store, simDate, "expected", true);
        const warCapitalMin = computeCapital(store, simDate, "min", true);
        const warCapitalMax = computeCapital(store, simDate, "max", true);
        const capitalDiff = warCapital - capital;
        const hasWarItems = warSavings.reducibleCount > 0 || warSavings.cancellableCount > 0;
        return (
          <div className="glass p-4 space-y-4 border border-neon-red/20 relative overflow-hidden">
            {/* Background glow */}
            <div className="absolute -top-20 -right-20 w-52 h-52 bg-neon-red/5 blur-[80px] rounded-full pointer-events-none" />

            {/* Header + Toggle */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-neon-red" />
                <span className="text-xs font-bold uppercase tracking-wider text-neon-red">Économie de Guerre</span>
                {settings?.warMode && <span className="text-[9px] bg-neon-red/20 text-neon-red border border-neon-red/30 px-1.5 py-0.5 rounded-full font-bold animate-pulse">ACTIF</span>}
              </div>
              <button
                onClick={() => store.setNested("settings", "warMode", !settings?.warMode)}
                className={`relative w-11 h-6 rounded-full cursor-pointer transition-all duration-300 ${settings?.warMode ? "bg-neon-red/70" : "bg-slate-700"}`}
              >
                <div className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-all duration-300 ${settings?.warMode ? "left-6" : "left-1"}`} />
              </button>
            </div>

            {/* Capital Comparison */}
            <div className="grid grid-cols-2 gap-2">
              <div className="p-3 rounded-xl bg-[#030712]/60 border border-border-subtle text-center">
                <p className="text-[8px] text-text-muted uppercase tracking-wider mb-1">Capital Normal</p>
                <p className="text-sm font-bold mono text-text-primary">{fmtNum(capital)} €</p>
              </div>
              <div className="p-3 rounded-xl bg-neon-red/5 border border-neon-red/20 text-center">
                <p className="text-[8px] text-neon-orange uppercase tracking-wider mb-1">Capital Guerre ⚔️</p>
                <p className="text-sm font-bold mono text-neon-orange">{fmtNum(warCapital)} €</p>
                {capitalDiff !== 0 && (
                  <p className={`text-[9px] font-bold ${capitalDiff >= 0 ? "text-neon-green" : "text-neon-red"}`}>
                    {capitalDiff >= 0 ? "+" : ""}{fmtNum(capitalDiff)} €
                  </p>
                )}
              </div>
            </div>

            {/* Savings breakdown */}
            {hasWarItems ? (
              <div className="space-y-2">
                <p className="text-[9px] uppercase tracking-wider text-text-muted font-bold">Économies potentielles / mois</p>
                {warSavings.reducibleCount > 0 && (
                  <div className="flex items-center justify-between p-2 rounded-lg bg-neon-orange/10 border border-neon-orange/20">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[9px] text-neon-orange font-bold">✂️ Réductibles</span>
                      <span className="text-[8px] text-text-muted">({warSavings.reducibleCount} charges)</span>
                    </div>
                    <span className="text-xs font-bold mono text-neon-orange">−{fmtNum(warSavings.reducibleSavings)} €</span>
                  </div>
                )}
                {warSavings.cancellableCount > 0 && (
                  <div className="flex items-center justify-between p-2 rounded-lg bg-neon-red/10 border border-neon-red/20">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[9px] text-neon-red font-bold">🚫 Annulables</span>
                      <span className="text-[8px] text-text-muted">({warSavings.cancellableCount} charges)</span>
                    </div>
                    <span className="text-xs font-bold mono text-neon-red">−{fmtNum(warSavings.cancellableSavings)} €</span>
                  </div>
                )}
                <div className="flex items-center justify-between p-2.5 rounded-lg bg-neon-green/10 border border-neon-green/20">
                  <span className="text-[10px] text-neon-green font-bold uppercase tracking-wider">💰 Économie Totale</span>
                  <span className="text-sm font-black mono text-neon-green">+{fmtNum(warSavings.totalSavings)} €/mois</span>
                </div>
              </div>
            ) : (
              <p className="text-[10px] text-text-muted italic text-center py-2 leading-relaxed">
                Marquez vos charges comme <span className="text-neon-orange font-bold">Réductible</span> ou <span className="text-neon-red font-bold">Annulable</span> dans l'onglet <span className="text-neon-cyan font-bold">Récurrents</span> pour voir les économies ici.
              </p>
            )}
          </div>
        );
      }
      default:
        return null;
    }
  };

  return (
    <div className="space-y-4 anim-in select-none">
      {/* Setup Modal */}
      {showSetup && (
        <div className="modal-overlay" onClick={() => setShowSetup(false)}>
          <form onClick={e => e.stopPropagation()} onSubmit={handleSetup} className="glass p-6 w-full max-w-sm space-y-4">
            <div className="text-center">
              <Wallet className="w-8 h-8 text-neon-green mx-auto mb-2" />
              <h2 className="text-lg font-bold">Bienvenue !</h2>
              <p className="text-xs text-text-muted mt-1">Entre ton capital actuel pour démarrer.</p>
            </div>
            <input type="number" step="0.01" min="0" placeholder="Capital actuel en €" value={setupVal}
              onChange={e => setSetupVal(e.target.value)} className="input text-center text-lg mono" autoFocus />
            <button type="submit" className="btn btn-green w-full"><Sparkles className="w-4 h-4" /> Commencer</button>
            <button type="button" onClick={() => setShowSetup(false)} className="btn btn-ghost w-full text-xs">Passer</button>
          </form>
        </div>
      )}

      {/* Visual Reorder/Customize Banner Indicator */}
      {isCustomizing && (
        <div className="flex flex-col gap-3 p-4 bg-neon-cyan/5 border border-dashed border-neon-cyan/30 rounded-2xl anim-in relative overflow-hidden">
          <div className="flex items-center justify-between">
            <p className="text-xs text-neon-cyan font-bold flex items-center gap-1.5 uppercase tracking-wider">
              <GripVertical className="w-4 h-4 animate-bounce" />
              Mode Personnalisation — Glisse les blocs ou clique sur les flèches
            </p>
            <button 
              onClick={() => setIsCustomizing(false)}
              className="flex items-center gap-1 text-[10px] font-bold text-neon-green bg-neon-green/10 border border-neon-green/20 px-3 py-1 rounded-lg cursor-pointer hover:bg-neon-green/20 transition-all"
            >
              <Check className="w-3.5 h-3.5" /> Terminer
            </button>
          </div>
          <p className="text-[11px] text-text-muted">
            Tu peux réorganiser l'affichage en glissant-déposant les blocs ou en utilisant les boutons directionnels. Clique sur la croix (✕) pour supprimer un bloc.
          </p>

          {/* Hidden/Deleted blocks recovery list */}
          {hiddenBlocks.length > 0 && (
            <div className="mt-1 pt-2.5 border-t border-border-subtle">
              <span className="text-[9px] uppercase tracking-widest text-text-muted block mb-1.5">Restaurer des blocs supprimés :</span>
              <div className="flex gap-1.5 flex-wrap">
                {hiddenBlocks.map(id => (
                  <button
                    key={id}
                    onClick={() => restoreBlock(id)}
                    className="flex items-center gap-1 text-[10px] px-2.5 py-0.5 rounded-full border border-border-subtle bg-slate-900/40 hover:bg-neon-cyan/10 hover:border-neon-cyan/40 text-text-secondary hover:text-neon-cyan cursor-pointer transition-all"
                  >
                    <Plus className="w-3 h-3 text-neon-cyan" />
                    {blockNames[id] || id}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Date Selector ───────────────────────────────────── */}
      <div className="glass p-3">
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-neon-cyan" />
            <span className="text-[11px] uppercase tracking-widest text-text-muted">Capital au</span>
          </div>
          <div className="flex items-center gap-1">
            <button onClick={() => setSimDate(addMonths(simDate, -1))} className="btn btn-ghost p-1 cursor-pointer"><ChevronLeft className="w-3.5 h-3.5" /></button>
            <input type="date" value={simDate} onChange={e => setSimDate(e.target.value)} className="input w-auto text-xs mono px-2 py-1" />
            <button onClick={() => setSimDate(addMonths(simDate, 1))} className="btn btn-ghost p-1 cursor-pointer"><ChevronRight className="w-3.5 h-3.5" /></button>
          </div>
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {[
            { label: "Auj.", date: today() },
            { label: "+1m", date: addMonths(today(), 1) },
            { label: "+3m", date: addMonths(today(), 3) },
            { label: "+6m", date: addMonths(today(), 6) },
            { label: "+1an", date: addMonths(today(), 12) },
          ].map(b => (
            <button key={b.label} onClick={() => setSimDate(b.date)}
              className={`text-[10px] px-2 py-0.5 rounded-full border cursor-pointer transition-colors ${
                simDate === b.date ? "border-neon-cyan text-neon-cyan bg-neon-cyan/10" : "border-border-subtle text-text-muted hover:text-text-secondary"
              }`}>{b.label}</button>
          ))}
        </div>
        {isProjection && (
          <div className="flex items-center gap-1.5 mt-2 text-[10px] text-neon-cyan">
            <Clock className="w-3 h-3" /> Projection future — basée sur tes récurrents et revenus planifiés
          </div>
        )}
      </div>

      {/* ── Dashboard Blocks ─────────────────────────────────── */}
      <div className="space-y-4">
        {blockOrder
          .filter(id => !hiddenBlocks.includes(id) || isCustomizing)
          .map((id, idx) => {
            const blockContent = renderBlock(id);
            if (!blockContent) return null;

            const isDragged = draggedIdx === idx;
            const isOver = dragOverIdx === idx;
            const isHidden = hiddenBlocks.includes(id);

            return (
              <div
                key={id}
                draggable={isCustomizing}
                onDragStart={(e) => handleDragStart(e, idx)}
                onDragOver={(e) => handleDragOver(e, idx)}
                onDrop={(e) => handleDrop(e, idx)}
                onDragEnd={handleDragEnd}
                onMouseDown={!isCustomizing ? startLongPress : undefined}
                onMouseUp={!isCustomizing ? endLongPress : undefined}
                onMouseLeave={!isCustomizing ? endLongPress : undefined}
                onTouchStart={!isCustomizing ? startLongPress : undefined}
                onTouchEnd={!isCustomizing ? endLongPress : undefined}
                className={`relative transition-all duration-200 ${
                  isCustomizing
                    ? `border border-dashed p-1 rounded-2xl cursor-grab active:cursor-grabbing hover:border-neon-cyan/40 hover:bg-slate-900/10 ${
                        isDragged ? "opacity-35 scale-95" : ""
                      } ${
                        isOver ? "border-neon-cyan bg-neon-cyan/5 scale-[1.01]" : "border-slate-800"
                      } ${
                        isHidden ? "opacity-40 grayscale border-red-500/20" : ""
                      }`
                    : ""
                }`}
              >
                {/* Visual indicator / Controls overlay in Customize Mode */}
                {isCustomizing && (
                  <div className="absolute top-2 right-2 flex items-center gap-1.5 z-10 bg-slate-950/85 backdrop-blur-sm px-2 py-1 rounded-lg border border-border-subtle">
                    {/* Block Name Label */}
                    <span className="text-[9px] uppercase tracking-wider text-text-muted mr-1.5 font-semibold">
                      {blockNames[id] || id}
                    </span>

                    {/* Move Up Button */}
                    {idx > 0 && (
                      <button
                        onClick={(e) => { e.stopPropagation(); shiftBlock(idx, -1); }}
                        className="p-1 rounded bg-slate-900 hover:bg-slate-800 text-text-muted hover:text-neon-cyan cursor-pointer transition-colors"
                        title="Monter"
                      >
                        <ChevronUp className="w-3.5 h-3.5" />
                      </button>
                    )}

                    {/* Move Down Button */}
                    {idx < blockOrder.length - 1 && (
                      <button
                        onClick={(e) => { e.stopPropagation(); shiftBlock(idx, 1); }}
                        className="p-1 rounded bg-slate-900 hover:bg-slate-800 text-text-muted hover:text-neon-cyan cursor-pointer transition-colors"
                        title="Descendre"
                      >
                        <ChevronDown className="w-3.5 h-3.5" />
                      </button>
                    )}

                    {/* Drag Handle */}
                    <span className="p-1 text-text-muted cursor-grab">
                      <GripVertical className="w-3.5 h-3.5" />
                    </span>

                    {/* Hide/Delete Button */}
                    {!isHidden && (
                      <button
                        onClick={(e) => { e.stopPropagation(); hideBlock(id); }}
                        className="p-1 rounded bg-slate-900 hover:bg-red-500/20 text-text-muted hover:text-neon-red cursor-pointer transition-colors"
                        title="Supprimer"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                )}

                {/* Render the actual block content */}
                <div className={isCustomizing ? "pointer-events-none select-none" : ""}>
                  {blockContent}
                </div>
              </div>
            );
          })}
      </div>
    </div>
  );
}

function KPI({ icon, label, value, color }) {
  return (
    <div className="glass p-2.5">
      <div className="flex items-center gap-1 mb-0.5">
        {icon}
        <span className="text-[9px] uppercase tracking-widest text-text-muted truncate">{label}</span>
      </div>
      <p className={`text-sm font-bold mono ${color}`}>{value}</p>
    </div>
  );
}

/* ── Goals Block ─────────────────────────────────────────────── */
function GoalsBlock() {
  const store = useStore();
  const goals = store.financialGoals || [];
  const [expanded, setExpanded] = useState(true);
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState("");
  const [note, setNote] = useState("");
  const [editNoteId, setEditNoteId] = useState(null);
  const [editNoteVal, setEditNoteVal] = useState("");

  function addGoal(e) {
    e.preventDefault();
    if (!title.trim()) return;
    const newGoal = { id: Date.now().toString(36), title: title.trim(), note: note.trim(), done: false, createdAt: new Date().toISOString(), notes: [] };
    store.set("financialGoals", prev => [...prev, newGoal]);
    setTitle(""); setNote(""); setAdding(false);
  }

  function toggleDone(id) {
    store.set("financialGoals", prev => prev.map(g => g.id === id ? { ...g, done: !g.done } : g));
  }

  function removeGoal(id) {
    store.set("financialGoals", prev => prev.filter(g => g.id !== id));
  }

  function addNote(id) {
    if (!editNoteVal.trim()) return;
    store.set("financialGoals", prev => prev.map(g => g.id === id
      ? { ...g, notes: [...(g.notes || []), { id: Date.now().toString(36), text: editNoteVal.trim(), createdAt: new Date().toISOString() }] }
      : g
    ));
    setEditNoteVal(""); setEditNoteId(null);
  }

  function removeNote(goalId, noteId) {
    store.set("financialGoals", prev => prev.map(g => g.id === goalId
      ? { ...g, notes: (g.notes || []).filter(n => n.id !== noteId) }
      : g
    ));
  }

  const doneCount = goals.filter(g => g.done).length;

  return (
    <section className="glass p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <button onClick={() => setExpanded(e => !e)} className="flex items-center gap-2 cursor-pointer">
          <StickyNote className="w-4 h-4 text-neon-violet" />
          <span className="text-[10px] uppercase tracking-widest text-text-muted">Objectifs</span>
          {goals.length > 0 && (
            <span className="text-[9px] bg-neon-violet/20 text-neon-violet px-1.5 py-0.5 rounded-full font-bold">
              {doneCount}/{goals.length}
            </span>
          )}
          {expanded ? <ChevronUp className="w-3.5 h-3.5 text-text-muted" /> : <ChevronDown className="w-3.5 h-3.5 text-text-muted" />}
        </button>
        <button onClick={() => { setAdding(a => !a); }} className="text-text-muted hover:text-neon-cyan cursor-pointer p-1">
          <Plus className="w-4 h-4" />
        </button>
      </div>

      {/* Add form */}
      {adding && (
        <form onSubmit={addGoal} className="mb-3 space-y-2 bg-[#030712] p-3 rounded-xl border border-border-subtle">
          <input
            autoFocus
            placeholder="Titre de l'objectif (ex: Rembourser dettes)"
            value={title}
            onChange={e => setTitle(e.target.value)}
            className="input text-sm w-full"
          />
          <textarea
            placeholder="Note (optionnel)…"
            value={note}
            onChange={e => setNote(e.target.value)}
            rows={2}
            className="input text-xs w-full resize-none"
          />
          <div className="flex gap-2">
            <button type="submit" className="btn btn-cyan flex-1 text-xs cursor-pointer"><Check className="w-3.5 h-3.5" /> Ajouter</button>
            <button type="button" onClick={() => setAdding(false)} className="btn btn-ghost flex-1 text-xs cursor-pointer">Annuler</button>
          </div>
        </form>
      )}

      {/* Empty state */}
      {expanded && goals.length === 0 && !adding && (
        <p className="text-xs text-text-muted text-center py-3">
          Aucun objectif. Clique sur <span className="text-neon-cyan">+</span> pour en ajouter.
        </p>
      )}

      {/* Goals list */}
      {expanded && (
        <div className="space-y-2">
          {goals.map(g => (
            <div key={g.id} className={`rounded-xl border transition-all ${
              g.done ? "border-border-subtle bg-surface/30 opacity-60" : "border-neon-violet/20 bg-neon-violet/5"
            } p-3`}>
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-start gap-2 flex-1 min-w-0">
                  <button onClick={() => toggleDone(g.id)} className="mt-0.5 shrink-0 cursor-pointer">
                    {g.done
                      ? <CheckCircle2 className="w-4 h-4 text-neon-green" />
                      : <Circle className="w-4 h-4 text-neon-violet" />
                    }
                  </button>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-semibold leading-snug ${g.done ? "line-through text-text-muted" : "text-text-primary"}`}>
                      {g.title}
                    </p>
                    {g.note && <p className="text-[10px] text-text-muted mt-0.5">{g.note}</p>}
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => setEditNoteId(editNoteId === g.id ? null : g.id)}
                    className="text-text-muted hover:text-neon-cyan cursor-pointer p-1"
                    title="Ajouter une note"
                  >
                    <StickyNote className="w-3 h-3" />
                  </button>
                  <button onClick={() => removeGoal(g.id)} className="text-text-muted hover:text-neon-red cursor-pointer p-1">
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </div>

              {/* Sub-notes */}
              {(g.notes || []).length > 0 && (
                <div className="mt-2 ml-6 space-y-1">
                  {g.notes.map(n => (
                    <div key={n.id} className="flex items-center justify-between gap-2 bg-[#030712] rounded-lg px-2 py-1">
                      <span className="text-[10px] text-text-secondary flex-1">{n.text}</span>
                      <button onClick={() => removeNote(g.id, n.id)} className="text-text-muted hover:text-neon-red cursor-pointer shrink-0">
                        <Trash2 className="w-2.5 h-2.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Add sub-note inline */}
              {editNoteId === g.id && (
                <div className="mt-2 ml-6 flex gap-2">
                  <input
                    autoFocus
                    placeholder="Ajouter une note…"
                    value={editNoteVal}
                    onChange={e => setEditNoteVal(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter") addNote(g.id); if (e.key === "Escape") setEditNoteId(null); }}
                    className="input text-xs flex-1"
                  />
                  <button onClick={() => addNote(g.id)} className="text-neon-green cursor-pointer">
                    <Check className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

/* ── Scenario Block ───────────────────────────────────────────── */
function ScenarioBlock() {
  const store = useStore();
  const [expanded, setExpanded] = useState(false);
  const [editingBase, setEditingBase] = useState(false);
  const [baseInput, setBaseInput] = useState("");
  const [baseCapital, setBaseCapital] = useState(null);
  const [simDate, setSimDate] = useState(today());

  const base = baseCapital ?? 0;

  const capExp = useMemo(() => computeCapitalFromToday(base, store, simDate, "expected"),  [base, store, simDate]);
  const capMin = useMemo(() => computeCapitalFromToday(base, store, simDate, "min"),       [base, store, simDate]);
  const capMax = useMemo(() => computeCapitalFromToday(base, store, simDate, "max"),       [base, store, simDate]);
  const showRange = capMin !== capExp || capMax !== capExp;

  const goal = store.settings?.goalTotal || 0;
  const pct  = Math.min(100, goal > 0 ? (capExp / goal) * 100 : 0);

  const chartData = useMemo(
    () => baseCapital !== null ? getCapitalHistoryFromToday(base, store, 9) : [],
    [base, store, baseCapital]
  );

  function saveBase() {
    const v = parseFloat(baseInput);
    if (!isNaN(v) && v >= 0) setBaseCapital(v);
    setEditingBase(false);
  }

  return (
    <section className="glass p-4 border border-neon-cyan/10">
      <div className="flex items-center justify-between mb-3">
        <button onClick={() => setExpanded(e => !e)} className="flex items-center gap-2 cursor-pointer">
          <FlaskConical className="w-4 h-4 text-neon-cyan" />
          <span className="text-[10px] uppercase tracking-widest text-text-muted">Solde actuel</span>
          {expanded ? <ChevronUp className="w-3.5 h-3.5 text-text-muted" /> : <ChevronDown className="w-3.5 h-3.5 text-text-muted" />}
        </button>
        {baseCapital !== null && (
          <span className="text-[9px] bg-neon-cyan/10 text-neon-cyan px-2 py-0.5 rounded-full font-bold mono">
            base {fmtNum(baseCapital)} €
          </span>
        )}
      </div>

      {!expanded && baseCapital === null && (
        <p className="text-[11px] text-text-muted">
          Simule tes projections a partir d&apos;un solde de depart different.{" "}
          <button onClick={() => setExpanded(true)} className="text-neon-cyan underline cursor-pointer">Ouvrir</button>
        </p>
      )}

      {expanded && (
        <div className="space-y-4">
          <div className="bg-[#030712] rounded-xl px-4 py-3 border border-border-subtle flex items-center justify-between">
            <div>
              <p className="text-[10px] text-text-muted mb-1">Solde de depart simule</p>
              {editingBase ? (
                <div className="flex items-center gap-2">
                  <input
                    type="number" step="1" min="0"
                    value={baseInput}
                    onChange={e => setBaseInput(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter") saveBase(); if (e.key === "Escape") setEditingBase(false); }}
                    className="input mono text-sm w-32"
                    autoFocus
                    placeholder="ex: 5000"
                  />
                  <span className="text-text-muted text-sm">€</span>
                  <button onClick={saveBase} className="text-neon-green cursor-pointer"><Check className="w-4 h-4" /></button>
                  <button onClick={() => setEditingBase(false)} className="text-text-muted hover:text-white cursor-pointer text-xs">✕</button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  {baseCapital !== null
                    ? <span className="text-2xl font-bold mono text-neon-cyan">{fmtNum(baseCapital)} €</span>
                    : <span className="text-sm text-text-muted">Non defini</span>
                  }
                  <button
                    onClick={() => { setBaseInput(baseCapital !== null ? baseCapital.toString() : ""); setEditingBase(true); }}
                    className="text-text-muted hover:text-neon-cyan cursor-pointer p-1"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>
            {baseCapital !== null && (
              <div className="text-right">
                <p className="text-[10px] text-text-muted">Delta vs. solde reel</p>
                <p className={`text-sm font-bold mono ${baseCapital >= (store.capitalInitial || 0) ? "text-neon-green" : "text-neon-red"}`}>
                  {baseCapital >= (store.capitalInitial || 0) ? "+" : ""}{fmtNum(baseCapital - (store.capitalInitial || 0))} €
                </p>
              </div>
            )}
          </div>

          {baseCapital !== null && (
            <>
              <div className="flex items-center gap-2 flex-wrap">
                <Calendar className="w-3.5 h-3.5 text-text-muted" />
                <span className="text-[10px] text-text-muted">Au</span>
                <div className="flex items-center gap-1">
                  <button onClick={() => setSimDate(addMonths(simDate, -1))} className="btn btn-ghost p-1 cursor-pointer text-text-muted"><ChevronLeft className="w-3 h-3" /></button>
                  <input type="date" value={simDate} onChange={e => setSimDate(e.target.value)} className="input w-auto text-xs mono px-2 py-1" />
                  <button onClick={() => setSimDate(addMonths(simDate, 1))} className="btn btn-ghost p-1 cursor-pointer text-text-muted"><ChevronRight className="w-3 h-3" /></button>
                </div>
                <div className="flex gap-1 ml-auto flex-wrap">
                  {[
                    { label: "Auj.", date: today() },
                    { label: "+1m", date: addMonths(today(), 1) },
                    { label: "+3m", date: addMonths(today(), 3) },
                    { label: "+6m", date: addMonths(today(), 6) },
                    { label: "+1an", date: addMonths(today(), 12) },
                  ].map(b => (
                    <button key={b.label} onClick={() => setSimDate(b.date)}
                      className={`text-[9px] px-1.5 py-0.5 rounded-full border cursor-pointer transition-colors ${
                        simDate === b.date ? "border-neon-cyan text-neon-cyan bg-neon-cyan/10" : "border-border-subtle text-text-muted"
                      }`}>{b.label}</button>
                  ))}
                </div>
              </div>

              <div className="text-center py-2">
                <p className="text-[10px] text-text-muted uppercase tracking-widest mb-1">Capital projete (median)</p>
                <p className={`text-4xl font-extrabold mono ${capExp >= 0 ? "text-neon-green" : "text-neon-red"}`}>
                  {fmtNum(capExp)} €
                </p>
                {showRange && (
                  <div className="flex justify-center gap-6 mt-3 text-[10px] text-text-muted bg-[#030712] border border-border-subtle rounded-xl px-4 py-2 mx-auto w-fit">
                    <span className="flex flex-col items-center">
                      <span className="uppercase tracking-widest opacity-60">Pire cas</span>
                      <span className="mono text-neon-red font-bold text-xs">{fmtNum(capMin)} €</span>
                    </span>
                    <div className="w-[1px] bg-border-subtle" />
                    <span className="flex flex-col items-center">
                      <span className="uppercase tracking-widest opacity-60">Optimiste</span>
                      <span className="mono text-neon-cyan font-bold text-xs">{fmtNum(capMax)} €</span>
                    </span>
                  </div>
                )}
                <div className="max-w-md mx-auto mt-3">
                  <div className="progress-track h-2">
                    <div className="progress-fill h-full bg-gradient-to-r from-cyan-600 to-neon-cyan" style={{ width: `${pct}%` }} />
                  </div>
                  <div className="flex justify-between mt-1 text-[10px] text-text-muted">
                    <span>{pct.toFixed(1)}% de l&apos;objectif</span>
                    <span>Objectif : <span className="mono">{fmtNum(goal)} €</span></span>
                  </div>
                </div>
              </div>

              {chartData.length > 2 && (
                <div className="h-28 -mx-1">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                      <defs>
                        <linearGradient id="gscen" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%"  stopColor="#22d3ee" stopOpacity={0.2} />
                          <stop offset="95%" stopColor="#22d3ee" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(100,116,139,0.06)" />
                      <XAxis dataKey="label" tick={{ fill: "#64748b", fontSize: 9 }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fill: "#64748b", fontSize: 9 }} axisLine={false} tickLine={false} tickFormatter={v => `${(v/1000).toFixed(0)}k`} />
                      <Tooltip content={<Tip />} />
                      <Area type="monotone" dataKey="capital" name="Simulation" stroke="#22d3ee" strokeWidth={2}
                        fill="url(#gscen)" dot={false} activeDot={{ r: 3, fill: "#030712", stroke: "#22d3ee", strokeWidth: 2 }}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                  <p className="text-[9px] text-text-muted text-center mt-1">Depuis aujourd&apos;hui → 9 mois de projection</p>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </section>
  );
}
