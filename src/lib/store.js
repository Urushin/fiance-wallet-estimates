"use client";
import { createContext, useContext, useState, useEffect, useCallback, useMemo } from "react";

const Ctx = createContext(null);
const KEY = "fw_store_v2";

const INITIAL = {
  capitalInitial: 0,
  transactions: [],
  treasury: [],
  pockets: [],
  alternance: { salary: 0, startDate: "", endDate: "", paymentDay: 5 },
  freelance: [],
  crypto: [],
  stocks: [],
  gold: [],
  realEstate: [],
  etfs: [],
  cryptoValueCached: 0,
  recurringExpenses: [],
  recurringIncomes: [],
  financialGoals: [],
  customCountries: [],
  budgets: [],
  snapshots: [],
  scenarios: [],
  itCosts: [],
  familyTransfers: [],
  fitness: { gymCost: 0, proteinCost: 0, logs: [] },
  settings: {
    warMode: false,
    cryptoInDashboard: false,
    includeInvestmentsInCapital: false,
    includeTreasuryInCapital: false,
    cryptoActive: true,
    stocksActive: true,
    goldActive: true,
    realEstateActive: true,
    etfsActive: true,
    transactionsTabOrder: ["quick", "history", "recurring", "alternance", "treasury"],
    investmentsTabOrder: ["overview", "crypto", "stocks", "gold", "realEstate", "etfs"],
    settingsTabOrder: ["general", "budgets", "webhooks", "export", "danger"],
    dashboardBlockOrder: ["main_kpi", "kpi_cards", "net_balance", "goals", "scenario", "investments", "war_mode"],
    hiddenDashboardBlocks: [],
    discordWebhook: "",
    telegramToken: "",
    telegramChatId: "",
    goalTotal: 0,
    simInflation: 2.0, // %
    simYield: 5.0, // %
  },
};

function deepMerge(base, saved) {
  const result = { ...base };
  for (const key of Object.keys(saved)) {
    if (saved[key] !== null && typeof saved[key] === "object" && !Array.isArray(saved[key]) && typeof base[key] === "object" && !Array.isArray(base[key])) {
      result[key] = deepMerge(base[key], saved[key]);
    } else {
      result[key] = saved[key];
    }
  }
  return result;
}

export function StoreProvider({ children }) {
  const [state, setState] = useState(INITIAL);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        let loadedState = JSON.parse(raw);
        let transactions = loadedState.transactions || [];
        let recurringExpenses = loadedState.recurringExpenses || [];
        let recurringIncomes = loadedState.recurringIncomes || [];
        let updated = false;

        // 1. Sync recurringExpenses to transactions
        recurringExpenses.forEach(rec => {
          const match = transactions.find(t => t.id === rec.id);
          if (!match) {
            transactions.push({
              id: rec.id,
              amount: rec.amount,
              amountMin: rec.amountMin,
              amountMax: rec.amountMax,
              type: "expense",
              category: rec.category || "Autre",
              note: rec.name || rec.note || "",
              date: rec.startDate,
              probability: 100,
              isRange: rec.isRange || false,
              isRepeat: true,
              repeatFrequency: rec.frequency || "monthly",
              repeatEndDate: rec.endDate || null,
            });
            updated = true;
          } else if (!match.isRepeat) {
            match.isRepeat = true;
            updated = true;
          }
        });

        // 2. Sync recurringIncomes to transactions
        recurringIncomes.forEach(rec => {
          const match = transactions.find(t => t.id === rec.id);
          if (!match) {
            transactions.push({
              id: rec.id,
              amount: rec.amount,
              amountMin: rec.amountMin,
              amountMax: rec.amountMax,
              type: "income",
              category: rec.category || "Autre",
              note: rec.name || rec.note || "",
              date: rec.startDate,
              probability: 100,
              isRange: rec.isRange || false,
              isRepeat: true,
              repeatFrequency: rec.frequency || "monthly",
              repeatEndDate: rec.endDate || null,
            });
            updated = true;
          } else if (!match.isRepeat) {
            match.isRepeat = true;
            updated = true;
          }
        });

        // 3. Sync transactions (isRepeat) back to recurringExpenses/recurringIncomes
        transactions.forEach(t => {
          if (t.isRepeat) {
            if (t.type === "expense") {
              const match = recurringExpenses.find(r => r.id === t.id);
              if (!match) {
                recurringExpenses.push({
                  id: t.id,
                  name: t.note || t.category || "Sans nom",
                  amount: t.amount,
                  amountMin: t.amountMin,
                  amountMax: t.amountMax,
                  isRange: t.isRange || false,
                  category: t.category || "Autre",
                  frequency: t.repeatFrequency || "monthly",
                  startDate: t.date,
                  endDate: t.repeatEndDate || null,
                  note: t.note || "",
                  active: true,
                });
                updated = true;
              }
            } else {
              const match = recurringIncomes.find(r => r.id === t.id);
              if (!match) {
                recurringIncomes.push({
                  id: t.id,
                  name: t.note || t.category || "Sans nom",
                  amount: t.amount,
                  amountMin: t.amountMin,
                  amountMax: t.amountMax,
                  isRange: t.isRange || false,
                  category: t.category || "Autre",
                  frequency: t.repeatFrequency || "monthly",
                  startDate: t.date,
                  endDate: t.repeatEndDate || null,
                  note: t.note || "",
                  active: true,
                });
                updated = true;
              }
            }
          }
        });

        const merged = deepMerge(INITIAL, loadedState);
        const hasExistingData = (loadedState.transactions && loadedState.transactions.length > 0) || loadedState.capitalInitial > 0;

        if (!merged.crypto || merged.crypto.length === 0) {
          if (hasExistingData) {
            merged.crypto = [
              { id: "fet", symbol: "FET", name: "Artificial Superintelligence Alliance", quantity: 3972.63, buyPrice: 0.8777, active: true },
              { id: "near", symbol: "NEAR", name: "NEAR Protocol", quantity: 337.00, buyPrice: 2.8996, active: true },
              { id: "ar", symbol: "AR", name: "Arweave", quantity: 171.77, buyPrice: 6.0897, active: true },
              { id: "render", symbol: "RENDER", name: "Render", quantity: 188.96, buyPrice: 3.9978, active: true },
              { id: "tao", symbol: "TAO", name: "Bittensor", quantity: 1.0000, buyPrice: 842.57, active: true },
              { id: "jasmy", symbol: "JASMY", name: "JasmyCoin", quantity: 44924.24, buyPrice: 0.01683, active: true },
              { id: "rsr", symbol: "RSR", name: "Reserve Rights", quantity: 77369.31, buyPrice: 0.009622, active: true },
              { id: "link", symbol: "LINK", name: "Chainlink", quantity: 12.86, buyPrice: 13.60, active: true },
              { id: "trx", symbol: "TRX", name: "TRON", quantity: 251.85, buyPrice: 0.4648, active: true },
              { id: "uni", symbol: "UNI", name: "Uniswap", quantity: 11.67, buyPrice: 9.9946, active: true },
              { id: "ckb", symbol: "CKB", name: "Nervos Network", quantity: 23954.64, buyPrice: 0.004881, active: true },
              { id: "pepe", symbol: "PEPE", name: "Pepe", quantity: 7444716.52, buyPrice: 0.00002347, active: true },
              { id: "shib", symbol: "SHIB", name: "Shiba Inu", quantity: 4322080.00, buyPrice: 0.00002707, active: true },
              { id: "axl", symbol: "AXL", name: "Axelar", quantity: 89.20, buyPrice: 0.6566, active: true },
              { id: "flux", symbol: "FLUX", name: "Flux", quantity: 62.81, buyPrice: 0.9297, active: true },
              { id: "cetus", symbol: "CETUS", name: "Cetus Protocol", quantity: 104.80, buyPrice: 0.4532, active: true },
            ];
          } else {
            merged.crypto = [
              { id: "btc", symbol: "BTC", name: "Bitcoin", quantity: 0.25, buyPrice: 62000, active: true },
              { id: "eth", symbol: "ETH", name: "Ethereum", quantity: 1.5, buyPrice: 3100, active: true }
            ];
          }
        }
        setState({
          ...merged,
          transactions,
          recurringExpenses,
          recurringIncomes
        });
      }
    } catch (e) {
      console.error("Failed to parse and sync local store:", e);
    }
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (loaded) localStorage.setItem(KEY, JSON.stringify(state));
  }, [state, loaded]);

  const set = useCallback((key, val) => {
    setState((p) => ({ ...p, [key]: typeof val === "function" ? val(p[key]) : val }));
  }, []);

  const setNested = useCallback((key, sub, val) => {
    setState((p) => ({
      ...p,
      [key]: { ...p[key], [sub]: typeof val === "function" ? val(p[key]?.[sub]) : val },
    }));
  }, []);

  const resetAll = useCallback(() => {
    setState(INITIAL);
    localStorage.removeItem(KEY);
  }, []);

  const value = useMemo(
    () => ({ ...state, set, setNested, resetAll, loaded }),
    [state, set, setNested, resetAll, loaded]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useStore = () => useContext(Ctx);
export { INITIAL };
