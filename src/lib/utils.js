export function fmt(amount, currency = "EUR") {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency, minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(amount);
}
export function fmtNum(n) { return new Intl.NumberFormat("fr-FR").format(Math.round(n)); }
export function fmtDate(d) { if (!d) return "—"; return new Date(d).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" }); }
export function fmtMonth(d) { return new Date(d + "-01").toLocaleDateString("fr-FR", { month: "short", year: "2-digit" }); }
function localDateStr(d) {
  const m = (d.getMonth() + 1).toString().padStart(2, "0");
  const y = d.getFullYear();
  const day = d.getDate().toString().padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function today() { return localDateStr(new Date()); }
export function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }

/* ── Date helpers ─────────────────────────────────────────────── */
export function addMonths(dateStr, n) {
  const d = new Date(dateStr); d.setMonth(d.getMonth() + n);
  return localDateStr(d);
}
export function daysLeftInMonth(dateStr) {
  const d = dateStr ? new Date(dateStr) : new Date();
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  return last - d.getDate();
}
export function monthKey(dateStr) { return (dateStr || today()).slice(0, 7); }

/* ── Occurrence generator (weekly/biweekly/monthly/quarterly/yearly) ── */
export function generateOccurrences(startDate, endDate, frequency, upToDate) {
  const dates = [];
  if (!startDate) return dates;
  const start = new Date(startDate);
  const limit = new Date(upToDate);
  const end = endDate ? new Date(endDate) : null;
  let cur = new Date(start);
  let safety = 0;
  while (cur <= limit && safety < 600) {
    if (end && cur > end) break;
    dates.push(localDateStr(cur));
    safety++;
    const next = new Date(cur);
    switch (frequency) {
      case "weekly": next.setDate(next.getDate() + 7); break;
      case "biweekly": next.setDate(next.getDate() + 14); break;
      case "monthly": next.setMonth(next.getMonth() + 1); break;
      case "quarterly": next.setMonth(next.getMonth() + 3); break;
      case "yearly": next.setFullYear(next.getFullYear() + 1); break;
      default: next.setMonth(next.getMonth() + 1);
    }
    cur = next;
  }
  return dates;
}

/* ── Alternance payments ─────────────────────────────────────── */
export function getAlternancePayments(salary, startDateStr, endDateStr, paymentDay = 5) {
  if (!salary || !endDateStr || !startDateStr) return [];
  const payments = [];
  const end = new Date(endDateStr);
  const now = new Date();
  const start = new Date(startDateStr);
  let cur = new Date(start.getFullYear(), start.getMonth(), paymentDay);
  if (cur < start) cur.setMonth(cur.getMonth() + 1);
  while (cur <= end) {
    payments.push({ date: localDateStr(cur), amount: salary, past: cur < now });
    cur.setMonth(cur.getMonth() + 1);
  }
  return payments;
}

/* ══════════════════════════════════════════════════════════════
   CENTRALIZED COMPUTATION — Single source of truth
   ══════════════════════════════════════════════════════════════ */

function isNextMonthOrLater(dateStr) {
  if (!dateStr) return false;
  const now = new Date();
  const firstOfNextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const yyyymmdd = firstOfNextMonth.toISOString().slice(0, 10);
  return dateStr >= yyyymmdd;
}

export function computeAllTransactions(store, asOfDate, probabilityMode = "expected", warEconomy = false) {
  const d = asOfDate || today();
  const all = [];
  const now = today();

  function applyProb(amt, type, date, prob) {
    if (!prob || prob >= 100 || date <= now) return amt;
    const p = prob / 100;
    if (probabilityMode === "expected") return amt * p;
    if (probabilityMode === "min") {
      if (type === "income") return 0;
      return amt; // worst case: expenses still happen
    }
    if (probabilityMode === "max") {
      if (type === "income") return amt; // best case: all income happens
      return 0; // optimized: uncertain expenses don't happen
    }
    return amt; // fallback (raw)
  }

  // 1. Manual transactions
  (store.transactions || []).forEach(t => {
    if (t.isRepeat) return; // Skip recurring templates to avoid double-counting with generated occurrences
    if (t.date && t.date <= d) {
      let amt;
      if (t.type === "expense" && warEconomy) {
        if (t.cancellable && isNextMonthOrLater(t.date)) {
          return; // completely skipped starting next month
        }
        if (t.reducible && t.reduciblePrice != null) {
          amt = parseFloat(t.reduciblePrice) || 0;
        } else if (t.isRange && t.amountMin != null && t.amountMax != null) {
          if (probabilityMode === "min") amt = t.amountMax;
          else if (probabilityMode === "max") amt = t.amountMin;
          else amt = (t.amountMin + t.amountMax) / 2;
        } else {
          amt = t.amount;
        }
      } else {
        if (t.isRange && t.amountMin != null && t.amountMax != null) {
          // Range transaction: use scenario to pick value
          if (probabilityMode === "min") {
            // Worst case: for expense the max cost, for income the min gain
            amt = t.type === "expense" ? t.amountMax : t.amountMin;
          } else if (probabilityMode === "max") {
            // Best case: for expense the min cost, for income the max gain
            amt = t.type === "expense" ? t.amountMin : t.amountMax;
          } else {
            // Expected/median: middle value
            amt = (t.amountMin + t.amountMax) / 2;
          }
        } else {
          amt = t.amount;
        }
      }
      amt = applyProb(amt, t.type, t.date, t.probability);
      all.push({ ...t, amount: amt, source: "manual" });
    }
  });

  // 2. Recurring expenses
  (store.recurringExpenses || []).forEach(r => {
    if (r.active === false) return;
    generateOccurrences(r.startDate, r.endDate, r.frequency || "monthly", d).forEach(date => {
      if (warEconomy && r.cancellable && isNextMonthOrLater(date)) {
        return; // completely skipped starting next month
      }
      let amt;
      if (warEconomy && r.reducible && r.reduciblePrice != null) {
        amt = parseFloat(r.reduciblePrice) || 0;
      } else if (r.isRange && r.amountMin != null && r.amountMax != null) {
        if (probabilityMode === "min") {
          amt = r.amountMax; // Worst case: maximum cost
        } else if (probabilityMode === "max") {
          amt = r.amountMin; // Best case: minimum cost
        } else {
          amt = (r.amountMin + r.amountMax) / 2; // Expected/median
        }
      } else {
        amt = r.amount;
      }
      all.push({
        id: `rec-exp-${r.id}-${date}`,
        parentRecId: r.id,
        amount: amt,
        amountMin: r.amountMin,
        amountMax: r.amountMax,
        isRange: r.isRange,
        type: "expense",
        category: r.category || "Récurrent",
        note: r.name,
        date,
        source: "recurring",
        isRepeat: true,
        repeatFrequency: r.frequency || "monthly",
        repeatEndDate: r.endDate || null,
        reducible: r.reducible,
        reduciblePrice: r.reduciblePrice,
        cancellable: r.cancellable,
      });
    });
  });

  // Recurring incomes
  (store.recurringIncomes || []).forEach(r => {
    if (r.active === false) return;
    generateOccurrences(r.startDate, r.endDate, r.frequency || "monthly", d).forEach(date => {
      let amt;
      if (r.isRange && r.amountMin != null && r.amountMax != null) {
        if (probabilityMode === "min") {
          amt = r.amountMin; // Worst case: minimum gain
        } else if (probabilityMode === "max") {
          amt = r.amountMax; // Best case: maximum gain
        } else {
          amt = (r.amountMin + r.amountMax) / 2; // Expected/median
        }
      } else {
        amt = r.amount;
      }
      all.push({
        id: `rec-inc-${r.id}-${date}`,
        parentRecId: r.id,
        amount: amt,
        amountMin: r.amountMin,
        amountMax: r.amountMax,
        isRange: r.isRange,
        type: "income",
        category: r.category || "Récurrent",
        note: r.name,
        date,
        source: "recurring",
        isRepeat: true,
        repeatFrequency: r.frequency || "monthly",
        repeatEndDate: r.endDate || null,
      });
    });
  });

  // 3. Alternance auto-income
  if (store.alternance?.salary > 0 && store.alternance?.startDate) {
    getAlternancePayments(store.alternance.salary, store.alternance.startDate, store.alternance.endDate, store.alternance.paymentDay || 5)
      .filter(p => p.date <= d)
      .forEach(p => {
        all.push({ id: `alt-${p.date}`, amount: p.amount, type: "income", category: "Alternance", note: "Salaire", date: p.date, source: "alternance" });
      });
  }

  // 4. Freelance (paid)
  (store.freelance || []).forEach(f => {
    if (f.status === "paid" && f.date && f.date <= d) {
      all.push({ id: `fl-${f.id}`, amount: applyProb(f.net, "income", f.date, f.probability), type: "income", category: "Freelance", note: f.client, date: f.date, source: "freelance" });
    }
  });



  // 6. Family transfers
  (store.familyTransfers || []).forEach(f => {
    if (f.active === false && f.frequency === "monthly") return;
    if (f.frequency === "monthly") {
      generateOccurrences(f.date, f.endDate, "monthly", d).forEach(date => {
        all.push({ id: `fam-${f.id}-${date}`, amount: f.amount, type: "expense", category: "Famille", note: f.to, date, source: "family" });
      });
    } else if (f.date && f.date <= d) {
      all.push({ id: `fam-${f.id}`, amount: f.amount, type: "expense", category: "Famille", note: f.to, date: f.date, source: "family" });
    }
  });

  return all.sort((a, b) => (a.date || "").localeCompare(b.date || ""));
}

export function computeTotalInvestments(store) {
  if (!store) return 0;
  let total = 0;
  
  // 1. Crypto
  if (store.settings?.cryptoActive !== false) {
    total += store.cryptoValueCached || 0;
  }
  
  // 2. Stocks
  if (store.settings?.stocksActive !== false) {
    (store.stocks || []).forEach(s => {
      if (s.active !== false) {
        total += (s.quantity || 0) * (s.currentPrice || s.buyPrice || 0);
      }
    });
  }
  
  // 3. Gold
  if (store.settings?.goldActive !== false) {
    (store.gold || []).forEach(g => {
      if (g.active !== false) {
        total += (g.grams || 0) * (g.currentPrice || g.buyPrice || 0);
      }
    });
  }
  
  // 4. Real Estate
  if (store.settings?.realEstateActive !== false) {
    (store.realEstate || []).forEach(r => {
      if (r.active !== false) {
        total += r.currentPrice || r.buyPrice || 0;
      }
    });
  }
  
  // 5. ETFs
  if (store.settings?.etfsActive !== false) {
    (store.etfs || []).forEach(e => {
      if (e.active !== false) {
        total += (e.quantity || 0) * (e.currentPrice || e.buyPrice || 0);
      }
    });
  }
  
  return total;
}

export function computeTotalTreasury(store, probabilityMode = "expected") {
  if (!store || !store.treasury) return 0;
  let total = 0;
  store.treasury.forEach(item => {
    if (item.isRange) {
      const itemMin = parseFloat(item.priceMin) || 0;
      const itemMax = parseFloat(item.priceMax) || 0;
      if (probabilityMode === "min") {
        total += itemMin;
      } else if (probabilityMode === "max") {
        total += itemMax;
      } else {
        total += (itemMin + itemMax) / 2;
      }
    } else {
      const itemPrice = parseFloat(item.price) || 0;
      total += itemPrice;
    }
  });
  return total;
}

export function computeWarEconomySavings(store) {
  if (!store || !store.recurringExpenses) return { reducibleSavings: 0, cancellableSavings: 0, totalSavings: 0, reducibleCount: 0, cancellableCount: 0 };
  let reducibleSavings = 0;
  let cancellableSavings = 0;
  let reducibleCount = 0;
  let cancellableCount = 0;

  store.recurringExpenses.forEach(r => {
    if (r.active === false) return;
    const normalAmt = r.isRange ? (parseFloat(r.amountMin) + parseFloat(r.amountMax)) / 2 : r.amount;
    if (r.reducible && r.reduciblePrice != null) {
      const redPrice = parseFloat(r.reduciblePrice) || 0;
      if (normalAmt > redPrice) {
        reducibleSavings += (normalAmt - redPrice);
        reducibleCount++;
      }
    }
    if (r.cancellable) {
      cancellableSavings += normalAmt;
      cancellableCount++;
    }
  });

  return {
    reducibleSavings,
    cancellableSavings,
    totalSavings: reducibleSavings + cancellableSavings,
    reducibleCount,
    cancellableCount
  };
}

export function computeCapital(store, asOfDate, probabilityMode = "expected", warEconomy = false) {
  const txs = computeAllTransactions(store, asOfDate, probabilityMode, warEconomy);
  let cap = (store.capitalInitial || 0) + txs.reduce((s, t) => s + (t.type === "income" ? t.amount : -t.amount), 0);
  if (store.settings?.includeInvestmentsInCapital) {
    cap += computeTotalInvestments(store);
  }
  if (store.settings?.includeTreasuryInCapital) {
    cap += computeTotalTreasury(store, probabilityMode);
  }
  return cap;
}

export function computeCapitalFrom(base, store, asOfDate, probabilityMode = "expected", warEconomy = false) {
  const txs = computeAllTransactions(store, asOfDate, probabilityMode, warEconomy);
  let cap = base + txs.reduce((s, t) => s + (t.type === "income" ? t.amount : -t.amount), 0);
  if (store.settings?.includeInvestmentsInCapital) {
    cap += computeTotalInvestments(store);
  }
  if (store.settings?.includeTreasuryInCapital) {
    cap += computeTotalTreasury(store, probabilityMode);
  }
  return cap;
}

export function getCapitalHistoryFrom(base, store, monthsBack = 6, monthsForward = 6, warEconomy = false) {
  const result = [];
  const now = new Date();
  for (let i = -monthsBack; i <= monthsForward; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i + 1, 0);
    const m = (d.getMonth() + 1).toString().padStart(2, "0");
    const y = d.getFullYear();
    const day = d.getDate().toString().padStart(2, "0");
    const ds = `${y}-${m}-${day}`;
    result.push({ month: ds.slice(0, 7), label: fmtMonth(ds.slice(0, 7)), capital: computeCapitalFrom(base, store, ds, "expected", warEconomy), projected: i > 0 });
  }
  return result;
}

/* Only counts transactions from today onwards — for the scenario simulation */
export function computeCapitalFromToday(base, store, asOfDate, probabilityMode = "expected", warEconomy = false) {
  const start = today();
  const txs = computeAllTransactions(store, asOfDate, probabilityMode, warEconomy);
  const future = txs.filter(t => t.date >= start);
  let cap = base + future.reduce((s, t) => s + (t.type === "income" ? t.amount : -t.amount), 0);
  if (store.settings?.includeTreasuryInCapital) {
    cap += computeTotalTreasury(store, probabilityMode);
  }
  return cap;
}

export function getCapitalHistoryFromToday(base, store, monthsForward = 9, warEconomy = false) {
  const result = [];
  const now = new Date();
  // First point = today with just the base
  result.push({ month: today().slice(0, 7), label: "Auj.", capital: base, projected: false });
  for (let i = 1; i <= monthsForward; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i + 1, 0);
    const m = (d.getMonth() + 1).toString().padStart(2, "0");
    const y = d.getFullYear();
    const day = d.getDate().toString().padStart(2, "0");
    const ds = `${y}-${m}-${day}`;
    result.push({ month: ds.slice(0, 7), label: fmtMonth(ds.slice(0, 7)), capital: computeCapitalFromToday(base, store, ds, "expected", warEconomy), projected: true });
  }
  return result;
}


export function computeMonthData(store, monthStr) {
  const d = monthStr || monthKey();
  const txs = computeAllTransactions(store, d + "-31");
  const monthTxs = txs.filter(t => t.date?.startsWith(d));
  const income = monthTxs.filter(t => t.type === "income").reduce((s, t) => s + t.amount, 0);
  const expense = monthTxs.filter(t => t.type === "expense").reduce((s, t) => s + t.amount, 0);
  return { income, expense, net: income - expense, transactions: monthTxs };
}

/* Capital at end of each month — for charts */
export function getCapitalHistory(store, monthsBack = 12, monthsForward = 0) {
  const result = [];
  const now = new Date();
  for (let i = -monthsBack; i <= monthsForward; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i + 1, 0);
    const m = (d.getMonth() + 1).toString().padStart(2, "0");
    const y = d.getFullYear();
    const day = d.getDate().toString().padStart(2, "0");
    const ds = `${y}-${m}-${day}`;
    result.push({ month: ds.slice(0, 7), label: fmtMonth(ds.slice(0, 7)), capital: computeCapital(store, ds), projected: i > 0 });
  }
  return result;
}

/* Monthly breakdown: income/expense/net, for ALL months in data range */
export function getMonthlyBreakdown(store) {
  const allTxs = computeAllTransactions(store, addMonths(today(), 6));
  const months = {};
  allTxs.forEach(t => {
    const k = t.date?.slice(0, 7);
    if (!k) return;
    if (!months[k]) months[k] = { month: k, label: fmtMonth(k), income: 0, expense: 0 };
    if (t.type === "income") months[k].income += t.amount;
    else months[k].expense += t.amount;
  });
  return Object.values(months).sort((a, b) => a.month.localeCompare(b.month)).map(m => ({ ...m, net: m.income - m.expense }));
}

/* Group by category */
export function groupByCategory(txs, type) {
  const c = {};
  txs.filter(t => t.type === type).forEach(t => { c[t.category] = (c[t.category] || 0) + t.amount; });
  return Object.entries(c).map(([name, amount]) => ({ name, amount })).sort((a, b) => b.amount - a.amount);
}

/* Group by source */
export function groupBySource(txs, type) {
  const s = {};
  txs.filter(t => t.type === type).forEach(t => { s[t.source] = (s[t.source] || 0) + t.amount; });
  const labels = { manual: "Saisie manuelle", recurring: "Récurrents", alternance: "Alternance", freelance: "Freelance", family: "Famille" };
  return Object.entries(s).map(([src, amount]) => ({ name: labels[src] || src, amount })).sort((a, b) => b.amount - a.amount);
}

/* ── Other utils ─────────────────────────────────────────────── */
export function calcCommission(amount, rate) { const c = amount * rate; return { commission: c, net: amount - c }; }

export function resteAVivre(capitalThisMonth, daysLeft) {
  if (daysLeft <= 0) return 0;
  return Math.max(0, Math.round(capitalThisMonth / daysLeft));
}

export function predictGoalDate(current, target, monthlyRate) {
  if (current >= target) return "Objectif atteint !";
  if (monthlyRate <= 0) return "∞";
  const months = Math.ceil((target - current) / monthlyRate);
  const d = new Date(); d.setMonth(d.getMonth() + months);
  return d.toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
}

export function monthsOfRunway(capital, monthlyCost) {
  if (monthlyCost <= 0) return Infinity;
  return Math.floor(capital / monthlyCost);
}

export function costOfOpportunity(expenseEUR, dailyCostAbroad) {
  if (dailyCostAbroad <= 0) return 0;
  return Math.floor(expenseEUR / dailyCostAbroad);
}

/* ── Export ───────────────────────────────────────────────────── */
export function exportCSV(data, filename = "finance-wallet.csv") {
  if (!data?.length) return;
  const h = Object.keys(data[0]);
  const rows = [h.join(";"), ...data.map(r => h.map(k => JSON.stringify(r[k] ?? "")).join(";"))].join("\n");
  dl(rows, filename, "text/csv;charset=utf-8");
}
export function exportJSON(data, filename = "finance-wallet.json") { dl(JSON.stringify(data, null, 2), filename, "application/json"); }
function dl(content, filename, mime) {
  const b = new Blob(["\uFEFF" + content], { type: mime });
  const u = URL.createObjectURL(b);
  const a = document.createElement("a"); a.href = u; a.download = filename; a.click();
  URL.revokeObjectURL(u);
}

/* ── API ─────────────────────────────────────────────────────── */
export async function fetchCryptoPrices(ids = ["bitcoin", "ethereum"]) {
  try { const r = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${ids.join(",")}&vs_currencies=eur&include_24hr_change=true`); return await r.json(); }
  catch { return {}; }
}
export async function sendDiscordWebhook(url, msg) {
  if (!url) return false;
  try { const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ content: msg }) }); return r.ok; }
  catch { return false; }
}
export async function sendTelegramMessage(token, chatId, msg) {
  if (!token || !chatId) return false;
  try { const r = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ chat_id: chatId, text: msg, parse_mode: "HTML" }) }); return r.ok; }
  catch { return false; }
}

/* ── Crypto Portfolio helpers ────────────────────────────────── */
export function fmtUsd(n, decimals = 2) {
  if (n == null || isNaN(n)) return "$0";
  if (Math.abs(n) < 0.01 && n !== 0) {
    // Very small numbers (like PEPE/SHIB prices) — show more decimals
    return "$" + n.toLocaleString("en-US", { minimumFractionDigits: 6, maximumFractionDigits: 8 });
  }
  return "$" + n.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

export function fmtPct(n) {
  if (n == null || isNaN(n)) return "0%";
  const sign = n >= 0 ? "+" : "";
  return `${sign}${n.toFixed(2)}%`;
}

export async function fetchCryptoPortfolioPrices(ids = []) {
  if (!ids.length) return {};
  try {
    const r = await fetch(`/api/crypto?ids=${ids.join(",")}`);
    if (!r.ok) throw new Error("API error");
    return await r.json();
  } catch {
    // Fallback: direct CoinGecko call
    try {
      const r = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${ids.join(",")}&vs_currencies=usd,eur&include_24hr_change=true`);
      return await r.json();
    } catch { return {}; }
  }
}

export async function fetchCryptoHistory(coinId, days = 30) {
  try {
    const r = await fetch(`/api/crypto?type=history&coinId=${coinId}&days=${days}`);
    if (!r.ok) throw new Error("API error");
    return await r.json();
  } catch { return { prices: [] }; }
}
