"use client";
import { useState, useMemo } from "react";
import { useStore } from "@/lib/store";
import { INCOME_CATEGORIES, EXPENSE_CATEGORIES, FREQUENCIES, PLATFORMS } from "@/lib/constants";
import { uid, today, fmtNum, fmtDate, generateOccurrences, calcCommission, getAlternancePayments, computeAllTransactions, addMonths } from "@/lib/utils";
import {
  Plus, TrendingUp, TrendingDown, Search, Trash2, Repeat, Users,
  ChevronDown, Check, ArrowUpRight, ArrowDownRight, Edit2, Power, Calendar,
  Briefcase, ShoppingBag, Package, Info, DollarSign, Clock, ToggleLeft, ToggleRight, Zap, Sparkles
} from "lucide-react";

import DraggableTabs from "@/components/DraggableTabs";

export default function Transactions() {
  const store = useStore();
  const [sub, setSub] = useState("quick");
  const tabs = [
    { id: "quick", label: "Saisie", Icon: Plus },
    { id: "history", label: "Historique", Icon: Search },
    { id: "recurring", label: "Récurrents", Icon: Repeat },
    { id: "alternance", label: "Salaire", Icon: Briefcase },
    { id: "treasury", label: "Trésorerie", Icon: Package },
  ];

  return (
    <div className="space-y-4 anim-in">
      <DraggableTabs
        tabs={tabs}
        activeId={sub}
        onChange={setSub}
        settingsKey="transactionsTabOrder"
      />
      {sub === "quick" && <QuickInput store={store} />}
      {sub === "recurring" && <Recurring store={store} />}
      {sub === "history" && <History store={store} />}
      {sub === "alternance" && <Salaire />}
      {sub === "treasury" && <Treasury />}
    </div>
  );
}

/* ═══════════════════════════ Quick Input ═══════════════════════ */
function QuickInput({ store }) {
  const [type, setType] = useState("expense");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("");
  const [note, setNote] = useState("");
  const [date, setDate] = useState(today());
  const [probability, setProbability] = useState("100");
  const [dropOpen, setDropOpen] = useState(false);
  const [success, setSuccess] = useState(false);
  const cats = type === "income" ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
  const isWar = store.settings?.warMode;
  const nonEssential = ["Restaurant", "Vêtements", "Loisirs"];
  const [isRange, setIsRange] = useState(false);
  const [isRepeat, setIsRepeat] = useState(false);
  const [repeatEndDate, setRepeatEndDate] = useState("");
  const [repeatFrequency, setRepeatFrequency] = useState("monthly");
  const [amountMin, setAmountMin] = useState("");
  const [amountMax, setAmountMax] = useState("");

  const isFuture = date > today();

  function submit(e) {
    e.preventDefault();
    let v, aMin, aMax;
    if (isRange) {
      aMin = parseFloat(amountMin);
      aMax = parseFloat(amountMax);
      if (isNaN(aMin) || isNaN(aMax)) return;
      v = (aMin + aMax) / 2;
    } else {
      v = parseFloat(amount);
      if (!v) return;
    }
    if (!category) return;

    if (isRepeat) {
      // If repeat payment is checked, add to BOTH collections using a single shared ID
      const recId = uid();
      if (type === "expense") {
        const newRecExpense = {
          id: recId,
          name: note.trim() || category,
          amount: v,
          amountMin: isRange ? aMin : undefined,
          amountMax: isRange ? aMax : undefined,
          isRange,
          category,
          frequency: repeatFrequency,
          startDate: date,
          endDate: repeatEndDate || null,
          note: note.trim(),
          active: true,
        };
        store.set("recurringExpenses", prev => [...(prev || []), newRecExpense]);
      } else {
        const newRecIncome = {
          id: recId,
          name: note.trim() || category,
          amount: v,
          amountMin: isRange ? aMin : undefined,
          amountMax: incIsRange ? aMin : undefined, // fallback or aMin
          isRange,
          category: "Autre",
          frequency: repeatFrequency,
          startDate: date,
          endDate: repeatEndDate || null,
          note: note.trim(),
          active: true,
        };
        store.set("recurringIncomes", prev => [...(prev || []), newRecIncome]);
      }

      // Add corresponding transaction to history
      const newTransaction = { 
        id: recId, 
        amount: v, 
        amountMin: isRange ? aMin : undefined, 
        amountMax: isRange ? aMax : undefined, 
        type, 
        category: type === "expense" ? category : "Autre", 
        note: note.trim(), 
        date, 
        probability: 100,
        isRange,
        isRepeat: true,
        repeatFrequency,
        repeatEndDate: repeatEndDate || null,
      };
      store.set("transactions", prev => [...prev, newTransaction]);
    } else {
      // Normal fixed/range ponctuel transaction added to history
      const probInt = isFuture ? parseInt(probability) || 100 : 100;
      const newTransaction = { 
        id: uid(), 
        amount: v, 
        amountMin: isRange ? aMin : undefined, 
        amountMax: isRange ? aMax : undefined, 
        type, 
        category, 
        note: note.trim(), 
        date, 
        probability: probInt,
        isRange 
      };
      store.set("transactions", prev => [...prev, newTransaction]);
    }
    
    setAmount(""); setAmountMin(""); setAmountMax(""); setCategory(""); setNote(""); setSuccess(true); setProbability("100");
    setIsRepeat(false); setRepeatEndDate(""); setRepeatFrequency("monthly");
    setTimeout(() => setSuccess(false), 1500);
  }

  return (
    <form onSubmit={submit} className="glass p-4 space-y-3">
      <p className="text-[10px] text-text-muted">Les transactions ponctuelles sont comptabilisées dans le capital, tandis que les récurrentes sont planifiées.</p>
      <div className="flex gap-2">
        <button type="button" onClick={() => { setType("income"); setCategory(""); }}
          className={`flex-1 btn text-xs cursor-pointer ${type === "income" ? "btn-green" : "btn-ghost"}`}>
          <TrendingUp className="w-3.5 h-3.5" /> Revenu
        </button>
        <button type="button" onClick={() => { setType("expense"); setCategory(""); }}
          className={`flex-1 btn text-xs cursor-pointer ${type === "expense" ? "btn-red" : "btn-ghost"}`}>
          <TrendingDown className="w-3.5 h-3.5" /> Dépense
        </button>
      </div>
      <div className="flex items-center justify-between mt-2 mb-1 px-2 border border-border-subtle rounded-lg bg-surface-hover">
        <span className="text-[10px] text-text-muted">Type de montant</span>
        <div className="flex gap-1 p-1">
          <button type="button" onClick={() => setIsRange(false)} className={`text-[10px] px-2 py-0.5 rounded cursor-pointer ${!isRange ? "bg-neon-cyan/20 text-neon-cyan" : "text-text-muted"}`}>Fixe</button>
          <button type="button" onClick={() => setIsRange(true)} className={`text-[10px] px-2 py-0.5 rounded cursor-pointer ${isRange ? "bg-neon-cyan/20 text-neon-cyan" : "text-text-muted"}`}>Fourchette (Est.)</button>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {isRange ? (
           <>
             <input type="number" step="0.01" min="0" placeholder="Pire Cas (€)" value={amountMin} onChange={e => setAmountMin(e.target.value)} className="input mono text-neon-orange" />
             <input type="number" step="0.01" min="0" placeholder="Meilleur Cas (€)" value={amountMax} onChange={e => setAmountMax(e.target.value)} className="input mono text-emerald-400" />
           </>
        ) : (
           <input type="number" step="0.01" min="0" placeholder="Montant €" value={amount} onChange={e => setAmount(e.target.value)} className="input mono" />
        )}
        <input type="date" value={date} onChange={e => setDate(e.target.value)} className={`input text-xs ${isRange ? "col-span-2" : ""}`} />
      </div>
      <div className="relative">
        <button type="button" onClick={() => setDropOpen(!dropOpen)} className="input flex items-center justify-between cursor-pointer">
          <span className={category ? "text-text-primary" : "text-text-muted"}>{category || "Catégorie"}</span>
          <ChevronDown className={`w-3.5 h-3.5 text-text-muted transition-transform ${dropOpen ? "rotate-180" : ""}`} />
        </button>
        {dropOpen && (
          <div className="absolute z-50 top-full left-0 right-0 mt-1 py-1 rounded-xl bg-[#0f172a] border border-border-subtle shadow-2xl max-h-48 overflow-y-auto">
            {cats.map(c => (
              <button key={c} type="button" onClick={() => { setCategory(c); setDropOpen(false); }}
                className={`w-full text-left px-3 py-1.5 text-sm cursor-pointer hover:bg-surface-hover ${
                  category === c ? "text-neon-cyan" : "text-text-secondary"
                } ${isWar && nonEssential.includes(c) ? "war-hide" : ""}`}>{c}</button>
            ))}
          </div>
        )}
      </div>

      {/* Répétition récurrente */}
      <div className={`p-3 rounded-xl border transition-all ${isRepeat ? "border-neon-cyan bg-neon-cyan/5 shadow-[0_0_15px_-5px_rgba(0,212,255,0.3)]" : "border-border-subtle bg-[#030712]/50 hover:border-text-muted cursor-pointer"}`} 
           onClick={() => !isRepeat && setIsRepeat(true)}>
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <Repeat className={`w-3.5 h-3.5 ${isRepeat ? "text-neon-cyan glow-c" : "text-text-muted"}`} />
            <span className={`text-[10px] uppercase font-bold tracking-wider ${isRepeat ? "text-neon-cyan" : "text-text-muted"}`}>Paiement Récurrent</span>
          </div>
          <input type="checkbox" checked={isRepeat} onChange={e => setIsRepeat(e.target.checked)} 
                 className="w-4 h-4 rounded border-border-subtle bg-input-bg text-neon-cyan focus:ring-neon-cyan accent-neon-cyan cursor-pointer" 
                 onClick={e => e.stopPropagation()} />
        </div>
        
        {isRepeat ? (
          <div className="pt-2 mt-2 border-t border-neon-cyan/10 anim-in space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[9px] text-text-muted uppercase block mb-1">Fréquence de répétition</label>
                <select value={repeatFrequency} onChange={e => setRepeatFrequency(e.target.value)} className="input text-xs cursor-pointer">
                  {FREQUENCIES.map(f => <option key={f.id} value={f.id}>{f.label}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[9px] text-text-muted uppercase block mb-1">Date de fin (optionnel)</label>
                <div className="relative">
                   <Calendar className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-muted" />
                   <input type="date" value={repeatEndDate} onChange={e => setRepeatEndDate(e.target.value)} 
                          className="input text-xs pl-8 border-neon-cyan/30 focus:border-neon-cyan" />
                </div>
              </div>
            </div>
            <p className="text-[8px] text-text-muted mt-2 leading-relaxed">
              Ce flux récurrent s'ajoutera directement dans le sous-onglet <strong>Récurrents</strong> et se mettra à jour automatiquement.
            </p>
          </div>
        ) : (
          <p className="text-[8px] text-text-muted italic">Clique pour transformer cette transaction ponctuelle en flux récurrent planifié.</p>
        )}
      </div>

      <input placeholder="Note (optionnel)" value={note} onChange={e => setNote(e.target.value)} className="input text-xs" />
      

      {isFuture && !isRepeat && (
        <div className="bg-[#030712] p-3 rounded-xl border border-border-subtle">
           <div className="flex justify-between text-xs mb-2">
             <span className="text-text-muted">Probabilité d'occurrence</span>
             <span className={`font-bold mono ${parseInt(probability) > 50 ? "text-neon-cyan" : "text-neon-orange"}`}>{probability}%</span>
           </div>
           <input type="range" min="0" max="100" step="10" value={probability} onChange={e => setProbability(e.target.value)} className="w-full accent-neon-cyan" />
        </div>
      )}
      {isFuture && isRange && !isRepeat && (
        <p className="text-[9px] text-text-muted text-center italic">En mode "Fourchette", le moteur probabiliste calcule automatiquement le pire scénario, le médian et le meilleur.</p>
      )}
      <button type="submit" disabled={(!amount && !isRange) || (isRange && (!amountMin || !amountMax)) || !category}
        className={`btn w-full cursor-pointer ${((amount && !isRange) || (amountMin && amountMax && isRange)) && category ? (type === "income" ? "btn-green" : "btn-red") : "btn-disabled btn-ghost"}`}>
        {success ? <><Check className="w-4 h-4" /> Ajouté !</> : <><Plus className="w-4 h-4" /> Ajouter</>}
      </button>
    </form>
  );
}

/* ═══════════════════════════ Unified Recurring ═══════════════════════ */
function Recurring({ store }) {
  const { recurringExpenses = [], recurringIncomes = [] } = store;
  const [addingExpense, setAddingExpense] = useState(false);
  const [addingIncome, setAddingIncome] = useState(false);

  // Expense form state
  const [expName, setExpName] = useState("");
  const [expAmount, setExpAmount] = useState("");
  const [expCategory, setExpCategory] = useState("Autre");
  const [expFrequency, setExpFrequency] = useState("monthly");
  const [expStartDate, setExpStartDate] = useState(today());
  const [expEndDate, setExpEndDate] = useState("");
  const [expNote, setExpNote] = useState("");
  const [expCatDrop, setExpCatDrop] = useState(false);
  const [expIsRange, setExpIsRange] = useState(false);
  const [expAmountMin, setExpAmountMin] = useState("");
  const [expAmountMax, setExpAmountMax] = useState("");
  const [expReducible, setExpReducible] = useState(false);
  const [expReduciblePrice, setExpReduciblePrice] = useState("");
  const [expCancellable, setExpCancellable] = useState(false);

  // Recurring inline edit state
  const [editingRecId, setEditingRecId] = useState(null);
  const [editRec, setEditRec] = useState({});

  // Income form state
  const [incName, setIncName] = useState("");
  const [incAmount, setIncAmount] = useState("");
  const [incStartDate, setIncStartDate] = useState(today());
  const [incEndDate, setIncEndDate] = useState("2026-12-31");
  const [incIsRange, setIncIsRange] = useState(false);
  const [incAmountMin, setIncAmountMin] = useState("");
  const [incAmountMax, setIncAmountMax] = useState("");
  const [incFrequency, setIncFrequency] = useState("monthly");
  const [incNote, setIncNote] = useState("");

  const totalMonthlyExpenses = useMemo(() => {
    return recurringExpenses.filter(r => r.active !== false).reduce((s, r) => {
      const mult = { weekly: 4.33, biweekly: 2.17, monthly: 1, quarterly: 1/3, yearly: 1/12 };
      const amt = r.isRange ? (parseFloat(r.amountMin) + parseFloat(r.amountMax)) / 2 : parseFloat(r.amount);
      return s + amt * (mult[r.frequency] || 1);
    }, 0);
  }, [recurringExpenses]);

  const totalMonthlyIncomes = useMemo(() => {
    return recurringIncomes.filter(r => r.active !== false).reduce((s, r) => {
      const mult = { weekly: 4.33, biweekly: 2.17, monthly: 1, quarterly: 1/3, yearly: 1/12 };
      const amt = r.isRange ? (parseFloat(r.amountMin) + parseFloat(r.amountMax)) / 2 : parseFloat(r.amount);
      return s + amt * (mult[r.frequency || "monthly"] || 1);
    }, 0);
  }, [recurringIncomes]);

  const netMonthly = totalMonthlyIncomes - totalMonthlyExpenses;

  function addExpense(e) {
    e.preventDefault();
    let v, aMin, aMax;
    if (expIsRange) {
      aMin = parseFloat(expAmountMin);
      aMax = parseFloat(expAmountMax);
      if (isNaN(aMin) || isNaN(aMax)) return;
      v = (aMin + aMax) / 2;
    } else {
      v = parseFloat(expAmount);
      if (isNaN(v)) return;
    }
    if (!expName.trim()) return;

    const recId = uid();
    const redPrice = expReducible && expReduciblePrice ? parseFloat(expReduciblePrice) : undefined;
    store.set("recurringExpenses", prev => [...(prev || []), {
      id: recId,
      name: expName.trim(),
      amount: v,
      amountMin: expIsRange ? aMin : undefined,
      amountMax: expIsRange ? aMax : undefined,
      isRange: expIsRange,
      category: expCategory,
      frequency: expFrequency,
      startDate: expStartDate,
      endDate: expEndDate || null,
      note: expNote.trim(),
      active: true,
      reducible: expReducible || false,
      reduciblePrice: redPrice,
      cancellable: expCancellable || false,
    }]);

    // Also add corresponding transaction to history
    store.set("transactions", prev => [...(prev || []), {
      id: recId,
      amount: v,
      amountMin: expIsRange ? aMin : undefined,
      amountMax: expIsRange ? aMax : undefined,
      type: "expense",
      category: expCategory,
      note: expName.trim(),
      date: expStartDate,
      probability: 100,
      isRange: expIsRange,
      isRepeat: true,
      repeatFrequency: expFrequency,
      repeatEndDate: expEndDate || null,
    }]);

    setExpName(""); setExpAmount(""); setExpAmountMin(""); setExpAmountMax(""); setExpNote(""); setExpCategory("Autre"); setExpFrequency("monthly"); setExpEndDate(""); setExpIsRange(false); setExpReducible(false); setExpReduciblePrice(""); setExpCancellable(false); setAddingExpense(false);
  }

  function addIncome(e) {
    e.preventDefault();
    let v, aMin, aMax;
    if (incIsRange) {
      aMin = parseFloat(incAmountMin);
      aMax = parseFloat(incAmountMax);
      if (isNaN(aMin) || isNaN(aMax)) return;
      v = (aMin + aMax) / 2;
    } else {
      v = parseFloat(incAmount);
      if (isNaN(v)) return;
    }
    if (!incName.trim()) return;

    const recId = uid();
    store.set("recurringIncomes", prev => [...(prev || []), {
      id: recId,
      name: incName.trim(),
      amount: v,
      amountMin: incIsRange ? aMin : undefined,
      amountMax: incIsRange ? aMax : undefined,
      isRange: incIsRange,
      category: "Autre",
      frequency: incFrequency,
      startDate: incStartDate,
      endDate: incEndDate || null,
      note: incNote.trim(),
      active: true,
    }]);

    // Also add corresponding transaction to history
    store.set("transactions", prev => [...(prev || []), {
      id: recId,
      amount: v,
      amountMin: incIsRange ? aMin : undefined,
      amountMax: incIsRange ? aMax : undefined,
      type: "income",
      category: "Autre",
      note: incName.trim(),
      date: incStartDate,
      probability: 100,
      isRange: incIsRange,
      isRepeat: true,
      repeatFrequency: incFrequency,
      repeatEndDate: incEndDate || null,
    }]);

    setIncName(""); setIncAmount(""); setIncAmountMin(""); setIncAmountMax(""); setIncNote(""); setIncFrequency("monthly"); setIncStartDate(today()); setIncEndDate("2026-12-31"); setIncIsRange(false); setAddingIncome(false);
  }

  function toggleExpense(id) {
    store.set("recurringExpenses", prev => prev.map(r => r.id === id ? { ...r, active: !r.active } : r));
  }

  function removeExpense(id) {
    store.set("recurringExpenses", prev => prev.filter(r => r.id !== id));
    store.set("transactions", prev => prev.filter(t => t.id !== id));
  }

  function toggleIncome(id) {
    store.set("recurringIncomes", prev => prev.map(r => r.id === id ? { ...r, active: !r.active } : r));
  }

  function removeIncome(id) {
    store.set("recurringIncomes", prev => prev.filter(r => r.id !== id));
    store.set("transactions", prev => prev.filter(t => t.id !== id));
  }

  function startEditRec(r, type) {
    setEditingRecId(r.id);
    setEditRec({ ...r, _type: type });
  }

  function saveEditRec() {
    const recType = editRec._type;
    const { _type, ...rec } = editRec;
    const v = parseFloat(rec.amount) || 0;
    const updated = { ...rec, amount: v };
    if (recType === "expense") {
      store.set("recurringExpenses", prev => prev.map(r => r.id === editingRecId ? updated : r));
      store.set("transactions", prev => prev.map(t => t.id === editingRecId ? {
        ...t, amount: v, note: rec.name, category: rec.category,
        repeatFrequency: rec.frequency, repeatEndDate: rec.endDate || null,
      } : t));
    } else {
      store.set("recurringIncomes", prev => prev.map(r => r.id === editingRecId ? updated : r));
      store.set("transactions", prev => prev.map(t => t.id === editingRecId ? {
        ...t, amount: v, note: rec.name,
        repeatFrequency: rec.frequency, repeatEndDate: rec.endDate || null,
      } : t));
    }
    setEditingRecId(null);
    setEditRec({});
  }

  function cancelEditRec() {
    setEditingRecId(null);
    setEditRec({});
  }

  const freqLabels = { weekly: "Hebdo", biweekly: "2x/mois", monthly: "Mensuel", quarterly: "Trim.", yearly: "Annuel" };

  return (
    <div className="space-y-4">
      {/* Overview Card */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="glass p-3 flex flex-col justify-between">
          <span className="text-[10px] text-text-muted uppercase font-bold tracking-wider">Revenus Récurrents</span>
          <span className="text-lg font-bold mono text-neon-green">+{fmtNum(totalMonthlyIncomes)} €/mois</span>
        </div>
        <div className="glass p-3 flex flex-col justify-between">
          <span className="text-[10px] text-text-muted uppercase font-bold tracking-wider">Charges Récurrentes</span>
          <span className="text-lg font-bold mono text-neon-red">−{fmtNum(totalMonthlyExpenses)} €/mois</span>
        </div>
        <div className="glass p-3 flex flex-col justify-between border-l-2 border-l-neon-cyan">
          <span className="text-[10px] text-text-muted uppercase font-bold tracking-wider">Bilan Mensuel</span>
          <span className={`text-lg font-bold mono ${netMonthly >= 0 ? "text-neon-cyan" : "text-neon-orange"}`}>
            {netMonthly >= 0 ? "+" : ""}{fmtNum(netMonthly)} €/mois
          </span>
        </div>
      </div>


      {/* Two Column Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        
        {/* Column 1: Incomes */}
        <div className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <h3 className="text-xs uppercase font-bold tracking-wider text-neon-green flex items-center gap-1.5">
              <TrendingUp className="w-4 h-4" /> Revenus Récurrents
            </h3>
            {!addingIncome && (
              <button onClick={() => setAddingIncome(true)} className="btn btn-ghost text-[10px] py-1 px-2.5 cursor-pointer">
                <Plus className="w-3 h-3 mr-1" /> Nouveau
              </button>
            )}
          </div>

          {addingIncome && (
            <form onSubmit={addIncome} className="glass p-3.5 space-y-2 anim-in">
              <div className="flex items-center justify-between px-1 border border-border-subtle rounded-lg bg-surface-hover">
                <span className="text-[10px] text-text-muted">Type de montant</span>
                <div className="flex gap-1 p-1">
                  <button type="button" onClick={() => setIncIsRange(false)} className={`text-[10px] px-2 py-0.5 rounded cursor-pointer ${!incIsRange ? "bg-neon-cyan/20 text-neon-cyan" : "text-text-muted"}`}>Fixe</button>
                  <button type="button" onClick={() => setIncIsRange(true)} className={`text-[10px] px-2 py-0.5 rounded cursor-pointer ${incIsRange ? "bg-neon-cyan/20 text-neon-cyan" : "text-text-muted"}`}>Fourchette</button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <input placeholder="Nom (ex: Salaire, Aide)" value={incName} onChange={e => setIncName(e.target.value)} className="input text-xs" required />
                {incIsRange ? (
                  <div className="grid grid-cols-2 gap-1">
                    <input type="number" step="0.01" min="0" placeholder="Min (€)" value={incAmountMin} onChange={e => setIncAmountMin(e.target.value)} className="input mono text-[10px] text-neon-orange" required />
                    <input type="number" step="0.01" min="0" placeholder="Max (€)" value={incAmountMax} onChange={e => setIncAmountMax(e.target.value)} className="input mono text-[10px] text-emerald-400" required />
                  </div>
                ) : (
                  <input type="number" step="0.01" placeholder="Montant net €" value={incAmount} onChange={e => setIncAmount(e.target.value)} className="input mono text-xs" required />
                )}
              </div>
              
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[9px] text-text-muted ml-1">Fréquence</label>
                  <select value={incFrequency} onChange={e => setIncFrequency(e.target.value)} className="input text-xs cursor-pointer">
                    {FREQUENCIES.map(f => <option key={f.id} value={f.id}>{f.label}</option>)}
                  </select>
                </div>
                <div className="flex flex-col gap-0.5">
                  <label className="text-[9px] text-text-muted ml-1">Début</label>
                  <input type="date" value={incStartDate} onChange={e => setIncStartDate(e.target.value)} className="input text-xs" required />
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-2">
                <div className="flex flex-col gap-0.5">
                  <label className="text-[9px] text-text-muted ml-1">Fin (optionnel)</label>
                  <input type="date" value={incEndDate} onChange={e => setIncEndDate(e.target.value)} className="input text-xs" />
                </div>
                <div className="flex flex-col gap-0.5">
                  <label className="text-[9px] text-text-muted ml-1">Note (optionnel)</label>
                  <input placeholder="Note" value={incNote} onChange={e => setIncNote(e.target.value)} className="input text-xs" />
                </div>
              </div>

              <div className="flex gap-2 pt-1">
                <button type="submit" className="btn btn-green flex-1 text-xs cursor-pointer"><Plus className="w-3.5 h-3.5" /> Ajouter</button>
                <button type="button" onClick={() => setAddingIncome(false)} className="btn btn-ghost text-xs cursor-pointer">Annuler</button>
              </div>
            </form>
          )}

          <div className="glass p-3 space-y-2">
            {recurringIncomes.length === 0 && <p className="text-xs text-text-muted text-center py-4">Aucun revenu mensuel.</p>}
            <div className="space-y-1.5 max-h-80 overflow-y-auto">
              {recurringIncomes.map(r => {
                if (editingRecId === r.id && editRec._type === "income") {
                  return (
                    <div key={r.id} className="glass p-3 border border-neon-green/40 rounded-xl space-y-2 anim-in">
                      <div className="flex items-center justify-between text-[10px] font-bold text-neon-green uppercase tracking-wider">
                        <span>✏️ Modifier — {r.name}</span>
                        <button onClick={cancelEditRec} className="text-text-muted hover:text-white cursor-pointer text-[10px] normal-case">Annuler</button>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <input placeholder="Nom" value={editRec.name || ""} onChange={e => setEditRec(v => ({...v, name: e.target.value}))} className="input text-xs" />
                        <input type="number" step="0.01" min="0" placeholder="Montant €" value={editRec.amount || ""} onChange={e => setEditRec(v => ({...v, amount: e.target.value}))} className="input text-xs mono" />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <select value={editRec.frequency || "monthly"} onChange={e => setEditRec(v => ({...v, frequency: e.target.value}))} className="input text-xs cursor-pointer">
                          {FREQUENCIES.map(f => <option key={f.id} value={f.id}>{f.label}</option>)}
                        </select>
                        <div><label className="text-[8px] text-text-muted block mb-0.5">Note</label><input placeholder="Note" value={editRec.note || ""} onChange={e => setEditRec(v => ({...v, note: e.target.value}))} className="input text-xs" /></div>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div><label className="text-[8px] text-text-muted block mb-0.5">Début</label><input type="date" value={editRec.startDate || ""} onChange={e => setEditRec(v => ({...v, startDate: e.target.value}))} className="input text-xs" /></div>
                        <div><label className="text-[8px] text-text-muted block mb-0.5">Fin (optionnel)</label><input type="date" value={editRec.endDate || ""} onChange={e => setEditRec(v => ({...v, endDate: e.target.value}))} className="input text-xs" /></div>
                      </div>
                      <button onClick={saveEditRec} className="btn btn-green w-full text-xs cursor-pointer"><Check className="w-3.5 h-3.5"/> Sauvegarder</button>
                    </div>
                  );
                }
                return (
                  <div key={r.id} className={`flex items-center justify-between p-2.5 rounded-xl bg-surface/50 border border-border-subtle hover:bg-surface-hover ${!r.active ? "opacity-40" : ""}`}>
                    <div className="flex items-center gap-2.5 min-w-0">
                      <button onClick={() => toggleIncome(r.id)} className={`w-7 h-7 rounded-lg flex items-center justify-center cursor-pointer transition-colors ${r.active ? "bg-neon-green/20 text-neon-green" : "bg-slate-800 text-text-muted"}`}>
                        <Power className="w-3.5 h-3.5" />
                      </button>
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-text-primary truncate">{r.name}</p>
                        <div className="flex items-center gap-1.5 text-[8px] text-text-muted">
                          <span className="badge bg-slate-800 text-text-muted">{freqLabels[r.frequency || "monthly"]}</span>
                          <span>{fmtDate(r.startDate)} → {r.endDate ? fmtDate(r.endDate) : "∞"}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <div className="text-right">
                        {r.isRange ? (
                          <>
                            <p className="text-xs font-bold mono text-neon-green">+{fmtNum(r.amountMin)} – {fmtNum(r.amountMax)} €</p>
                            <p className="text-[8px] text-text-muted">Moy: {fmtNum(r.amount)} €/m</p>
                          </>
                        ) : (
                          <>
                            <p className="text-xs font-bold mono text-neon-green">+{fmtNum(r.amount)} €</p>
                            <p className="text-[8px] text-text-muted">/mois</p>
                          </>
                        )}
                      </div>
                      <button onClick={() => startEditRec(r, "income")} className="text-text-muted hover:text-neon-green cursor-pointer p-1">
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => removeIncome(r.id)} className="text-text-muted hover:text-neon-red cursor-pointer p-1">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Column 2: Expenses */}
        <div className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <h3 className="text-xs uppercase font-bold tracking-wider text-neon-red flex items-center gap-1.5">
              <TrendingDown className="w-4 h-4" /> Charges Récurrentes
            </h3>
            {!addingExpense && (
              <button onClick={() => setAddingExpense(true)} className="btn btn-ghost text-[10px] py-1 px-2.5 cursor-pointer">
                <Plus className="w-3 h-3 mr-1" /> Nouvelle
              </button>
            )}
          </div>

          {addingExpense && (
            <form onSubmit={addExpense} className="glass p-3.5 space-y-2.5 anim-in">
              <div className="flex items-center justify-between px-1 border border-border-subtle rounded-lg bg-surface-hover">
                <span className="text-[10px] text-text-muted">Type de montant</span>
                <div className="flex gap-1 p-1">
                  <button type="button" onClick={() => setExpIsRange(false)} className={`text-[10px] px-2 py-0.5 rounded cursor-pointer ${!expIsRange ? "bg-neon-cyan/20 text-neon-cyan" : "text-text-muted"}`}>Fixe</button>
                  <button type="button" onClick={() => setExpIsRange(true)} className={`text-[10px] px-2 py-0.5 rounded cursor-pointer ${expIsRange ? "bg-neon-cyan/20 text-neon-cyan" : "text-text-muted"}`}>Fourchette</button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <input placeholder="Nom (ex: Netflix)" value={expName} onChange={e => setExpName(e.target.value)} className="input text-xs" required />
                {expIsRange ? (
                  <div className="grid grid-cols-2 gap-1">
                    <input type="number" step="0.01" min="0" placeholder="Min (€)" value={expAmountMin} onChange={e => setExpAmountMin(e.target.value)} className="input mono text-[10px] text-neon-orange" required />
                    <input type="number" step="0.01" min="0" placeholder="Max (€)" value={expAmountMax} onChange={e => setExpAmountMax(e.target.value)} className="input mono text-[10px] text-emerald-400" required />
                  </div>
                ) : (
                  <input type="number" step="0.01" placeholder="Montant €" value={expAmount} onChange={e => setExpAmount(e.target.value)} className="input mono text-xs" required />
                )}
              </div>
              
              <div className="grid grid-cols-2 gap-2">
                {/* Category */}
                <div className="relative">
                  <button type="button" onClick={() => setExpCatDrop(!expCatDrop)} className="input flex items-center justify-between cursor-pointer text-xs">
                    <span className="text-text-primary truncate">{expCategory}</span>
                    <ChevronDown className="w-3.5 h-3.5 text-text-muted" />
                  </button>
                  {expCatDrop && (
                    <div className="absolute z-50 top-full left-0 right-0 mt-1 py-1 rounded-xl bg-[#0f172a] border border-border-subtle shadow-2xl max-h-40 overflow-y-auto">
                      {EXPENSE_CATEGORIES.map(c => (
                        <button key={c} type="button" onClick={() => { setExpCategory(c); setExpCatDrop(false); }}
                          className="w-full text-left px-3 py-1 text-xs cursor-pointer hover:bg-surface-hover text-text-secondary">{c}</button>
                      ))}
                    </div>
                  )}
                </div>
                {/* Frequency */}
                <select value={expFrequency} onChange={e => setExpFrequency(e.target.value)} className="input text-xs cursor-pointer">
                  {FREQUENCIES.map(f => <option key={f.id} value={f.id}>{f.label}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[9px] text-text-muted">Début</label>
                  <input type="date" value={expStartDate} onChange={e => setExpStartDate(e.target.value)} className="input text-xs" required />
                </div>
                <div>
                  <label className="text-[9px] text-text-muted">Fin (optionnel)</label>
                  <input type="date" value={expEndDate} onChange={e => setExpEndDate(e.target.value)} className="input text-xs" />
                </div>
              </div>
              <input placeholder="Note (optionnel)" value={expNote} onChange={e => setExpNote(e.target.value)} className="input text-xs" />

              {/* War Economy Options */}
              <div className="p-2.5 rounded-xl border border-neon-orange/20 bg-neon-orange/5 space-y-2">
                <p className="text-[9px] uppercase tracking-wider text-neon-orange font-bold">⚔️ Économie de Guerre</p>
                <label className="flex items-center gap-2 cursor-pointer text-[10px]">
                  <input type="checkbox" checked={expCancellable} onChange={e => setExpCancellable(e.target.checked)} className="accent-neon-red w-3 h-3" />
                  <span className="text-text-primary font-medium">Annulable</span>
                  <span className="text-text-muted">— peut être supprimée dès le mois prochain</span>
                </label>
                <div className="space-y-1.5">
                  <label className="flex items-center gap-2 cursor-pointer text-[10px]">
                    <input type="checkbox" checked={expReducible} onChange={e => setExpReducible(e.target.checked)} className="accent-neon-orange w-3 h-3" />
                    <span className="text-text-primary font-medium">Réductible</span>
                    <span className="text-text-muted">— peut être réduite à un prix minimal</span>
                  </label>
                  {expReducible && (
                    <div className="flex items-center gap-2 pl-5 anim-in">
                      <input type="number" step="0.01" min="0" placeholder="Prix minimal possible (€)" value={expReduciblePrice} onChange={e => setExpReduciblePrice(e.target.value)} className="input text-xs mono flex-1" />
                    </div>
                  )}
                </div>
              </div>

              <div className="flex gap-2 pt-1">
                <button type="submit" className="btn btn-red flex-1 text-xs cursor-pointer"><Plus className="w-3.5 h-3.5" /> Ajouter</button>
                <button type="button" onClick={() => setAddingExpense(false)} className="btn btn-ghost text-xs cursor-pointer">Annuler</button>
              </div>
            </form>
          )}

          <div className="glass p-3 space-y-2">
            {recurringExpenses.length === 0 && <p className="text-xs text-text-muted text-center py-4">Aucune charge mensuelle.</p>}
            <div className="space-y-1.5 max-h-80 overflow-y-auto">
              {recurringExpenses.map(r => {
                if (editingRecId === r.id && editRec._type === "expense") {
                  return (
                    <div key={r.id} className="glass p-3 border border-neon-orange/40 rounded-xl space-y-2 anim-in">
                      <div className="flex items-center justify-between text-[10px] font-bold text-neon-orange uppercase tracking-wider">
                        <span>✏️ Modifier — {r.name}</span>
                        <button onClick={cancelEditRec} className="text-text-muted hover:text-white cursor-pointer text-[10px] normal-case">Annuler</button>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <input placeholder="Nom" value={editRec.name || ""} onChange={e => setEditRec(v => ({...v, name: e.target.value}))} className="input text-xs" />
                        <input type="number" step="0.01" min="0" placeholder="Montant €" value={editRec.amount || ""} onChange={e => setEditRec(v => ({...v, amount: e.target.value}))} className="input text-xs mono" />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <select value={editRec.frequency || "monthly"} onChange={e => setEditRec(v => ({...v, frequency: e.target.value}))} className="input text-xs cursor-pointer">
                          {FREQUENCIES.map(f => <option key={f.id} value={f.id}>{f.label}</option>)}
                        </select>
                        <select value={editRec.category || "Autre"} onChange={e => setEditRec(v => ({...v, category: e.target.value}))} className="input text-xs cursor-pointer">
                          {EXPENSE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div><label className="text-[8px] text-text-muted block mb-0.5">Début</label><input type="date" value={editRec.startDate || ""} onChange={e => setEditRec(v => ({...v, startDate: e.target.value}))} className="input text-xs" /></div>
                        <div><label className="text-[8px] text-text-muted block mb-0.5">Fin (optionnel)</label><input type="date" value={editRec.endDate || ""} onChange={e => setEditRec(v => ({...v, endDate: e.target.value}))} className="input text-xs" /></div>
                      </div>
                      <div className="p-2 rounded-lg border border-neon-orange/20 bg-neon-orange/5 space-y-1.5">
                        <p className="text-[8px] text-neon-orange font-bold uppercase tracking-wider">⚔️ Économie de Guerre</p>
                        <label className="flex items-center gap-2 cursor-pointer text-[10px]">
                          <input type="checkbox" checked={!!editRec.cancellable} onChange={e => setEditRec(v => ({...v, cancellable: e.target.checked}))} className="accent-neon-red w-3 h-3" />
                          <span>Annulable</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer text-[10px]">
                          <input type="checkbox" checked={!!editRec.reducible} onChange={e => setEditRec(v => ({...v, reducible: e.target.checked}))} className="accent-neon-orange w-3 h-3" />
                          <span>Réductible</span>
                        </label>
                        {editRec.reducible && (
                          <input type="number" step="0.01" min="0" placeholder="Prix minimal (€)" value={editRec.reduciblePrice || ""} onChange={e => setEditRec(v => ({...v, reduciblePrice: parseFloat(e.target.value) || undefined}))} className="input text-xs mono ml-5" />
                        )}
                      </div>
                      <button onClick={saveEditRec} className="btn w-full text-xs cursor-pointer bg-neon-orange/20 text-neon-orange border border-neon-orange/30 hover:bg-neon-orange/30"><Check className="w-3.5 h-3.5"/> Sauvegarder</button>
                    </div>
                  );
                }
                return (
                  <div key={r.id} className={`flex items-center justify-between p-2.5 rounded-xl bg-surface/50 border border-border-subtle hover:bg-surface-hover ${r.active === false ? "opacity-40" : ""}`}>
                    <div className="flex items-center gap-2.5 min-w-0">
                      <button onClick={() => toggleExpense(r.id)} className={`w-7 h-7 rounded-lg flex items-center justify-center cursor-pointer transition-colors ${r.active !== false ? "bg-neon-red/20 text-neon-red" : "bg-slate-800 text-text-muted"}`}>
                        <Power className="w-3.5 h-3.5" />
                      </button>
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-text-primary truncate">{r.name}</p>
                        <div className="flex items-center gap-1 text-[8px] text-text-muted flex-wrap">
                          <span className="badge bg-slate-800 text-text-muted">{freqLabels[r.frequency] || r.frequency}</span>
                          <span>{r.category}</span>
                          {r.cancellable && <span className="badge bg-neon-red/20 text-neon-red border border-neon-red/30">🚫 Annulable</span>}
                          {r.reducible && <span className="badge bg-neon-orange/20 text-neon-orange border border-neon-orange/30">✂️ Réductible</span>}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <div className="text-right">
                        {r.isRange ? (
                          <>
                            <p className="text-xs font-bold mono text-neon-red">−{fmtNum(r.amountMin)} – {fmtNum(r.amountMax)} €</p>
                            <p className="text-[8px] text-text-muted">Moy: {fmtNum(r.amount)} €/m</p>
                          </>
                        ) : (
                          <>
                            <p className="text-xs font-bold mono text-neon-red">−{fmtNum(r.amount)} €</p>
                            {r.reducible && r.reduciblePrice != null ? <p className="text-[8px] text-neon-orange">min: {fmtNum(r.reduciblePrice)} €</p> : <p className="text-[8px] text-text-muted">/mois</p>}
                          </>
                        )}
                      </div>
                      <button onClick={() => startEditRec(r, "expense")} className="text-text-muted hover:text-neon-orange cursor-pointer p-1">
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => removeExpense(r.id)} className="text-text-muted hover:text-neon-red cursor-pointer p-1">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}

/* ═══════════════════════════ History ═══════════════════════════ */
function History({ store }) {
  const { transactions } = store;
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState("all");
  
  // Edit State
  const [editingId, setEditingId] = useState(null);
  const [editAmt, setEditAmt] = useState("");
  const [editDate, setEditDate] = useState("");
  const [editCat, setEditCat] = useState("");
  const [editNote, setEditNote] = useState("");
  const [editProb, setEditProb] = useState(100);
  const [editIsRepeat, setEditIsRepeat] = useState(false);
  const [editFrequency, setEditFrequency] = useState("monthly");
  const [editEndDate, setEditEndDate] = useState("");

  // Get all transactions including generated recurring occurrences for a 12-month horizon
  const historyList = useMemo(() => {
    return computeAllTransactions(store, addMonths(today(), 12));
  }, [store]);

  const filtered = useMemo(() => {
    let list = [...historyList].sort((a, b) => (b.date || "").localeCompare(a.date || ""));
    if (filterType !== "all") list = list.filter(t => t.type === filterType);
    if (search) { const s = search.toLowerCase(); list = list.filter(t => t.category?.toLowerCase().includes(s) || t.note?.toLowerCase().includes(s)); }
    return list;
  }, [historyList, search, filterType]);

  const totalInc = useMemo(() => filtered.filter(t => t.type === "income").reduce((s, t) => s + t.amount, 0), [filtered]);
  const totalExp = useMemo(() => filtered.filter(t => t.type === "expense").reduce((s, t) => s + t.amount, 0), [filtered]);

  const groupedByMonth = useMemo(() => {
    const groups = {};
    filtered.forEach(tx => {
      const monthStr = tx.date ? tx.date.slice(0, 7) : "Indéterminé";
      if (!groups[monthStr]) groups[monthStr] = [];
      groups[monthStr].push(tx);
    });
    return Object.entries(groups).sort((a, b) => b[0].localeCompare(a[0]));
  }, [filtered]);

  function remove(occurrenceId) { 
    const occurrence = historyList.find(t => t.id === occurrenceId);
    const baseId = occurrence?.parentRecId || occurrenceId;

    store.set("transactions", prev => prev.filter(t => t.id !== baseId));
    store.set("recurringExpenses", prev => (prev || []).filter(r => r.id !== baseId));
    store.set("recurringIncomes", prev => (prev || []).filter(r => r.id !== baseId));
  }

  function startEdit(tx) {
    const baseId = tx.parentRecId || tx.id;
    const template = transactions.find(t => t.id === baseId) || tx;

    setEditingId(tx.id); // Keep the occurrence ID to show the edit panel on the correct row
    setEditAmt(template.amount.toString());
    setEditDate(template.date || today());
    setEditCat(template.category || "");
    setEditNote(template.note || "");
    setEditProb(template.probability !== undefined ? template.probability : 100);
    setEditIsRepeat(template.isRepeat || false);
    setEditFrequency(template.repeatFrequency || "monthly");
    setEditEndDate(template.repeatEndDate || "");
  }

  function saveEdit(occurrenceId) {
    const occurrence = historyList.find(t => t.id === occurrenceId);
    const baseId = occurrence?.parentRecId || occurrenceId;
    const v = parseFloat(editAmt);
    if (!v || !editCat) return;

    const oldTx = transactions.find(t => t.id === baseId) || occurrence;
    const type = oldTx?.type || "expense";
    const wasRepeat = oldTx?.isRepeat || false;

    // 1. Update the base transaction in store.transactions
    store.set("transactions", prev => {
      const list = prev || [];
      if (list.some(t => t.id === baseId)) {
        return list.map(t => 
          t.id === baseId ? { 
            ...t, 
            amount: v, 
            date: editDate, 
            category: editCat, 
            note: editNote, 
            probability: parseInt(editProb) || 100,
            isRepeat: editIsRepeat,
            repeatFrequency: editFrequency,
            repeatEndDate: editEndDate || null,
          } : t
        );
      } else {
        return [...list, {
          id: baseId,
          amount: v,
          date: editDate,
          category: editCat,
          note: editNote,
          probability: 100,
          isRepeat: editIsRepeat,
          repeatFrequency: editFrequency,
          repeatEndDate: editEndDate || null,
          type
        }];
      }
    });

    // 2. Synchronize to the recurring list
    if (editIsRepeat) {
      const recItem = {
        id: baseId,
        name: editNote.trim() || editCat,
        amount: v,
        amountMin: oldTx?.amountMin,
        amountMax: oldTx?.amountMax,
        isRange: oldTx?.isRange || false,
        category: editCat,
        frequency: editFrequency,
        startDate: editDate,
        endDate: editEndDate || null,
        note: editNote.trim(),
        active: true,
      };

      if (type === "expense") {
        store.set("recurringExpenses", prev => {
          const list = prev || [];
          if (list.some(r => r.id === baseId)) {
            return list.map(r => r.id === baseId ? recItem : r);
          } else {
            return [...list, recItem];
          }
        });
      } else {
        store.set("recurringIncomes", prev => {
          const list = prev || [];
          if (list.some(r => r.id === baseId)) {
            return list.map(r => r.id === baseId ? recItem : r);
          } else {
            return [...list, recItem];
          }
        });
      }
    } else if (wasRepeat) {
      if (type === "expense") {
        store.set("recurringExpenses", prev => (prev || []).filter(r => r.id !== baseId));
      } else {
        store.set("recurringIncomes", prev => (prev || []).filter(r => r.id !== baseId));
      }
    }

    setEditingId(null);
  }

  return (
    <div className="space-y-3">
      <div className="glass p-2.5 flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-muted" />
          <input placeholder="Rechercher..." value={search} onChange={e => setSearch(e.target.value)} className="input pl-8 text-xs" />
        </div>
        <select value={filterType} onChange={e => setFilterType(e.target.value)} className="input w-auto text-xs cursor-pointer">
          <option value="all">Tout</option>
          <option value="income">Revenus</option>
          <option value="expense">Dépenses</option>
        </select>
      </div>
      <div className="flex gap-3 text-xs px-1">
        <span className="text-text-muted">{filtered.length} résultats</span>
        <span className="text-neon-green mono">+{fmtNum(totalInc)} €</span>
        <span className="text-neon-red mono">−{fmtNum(totalExp)} €</span>
      </div>
      <div className="glass p-2.5">
        {filtered.length === 0 && <p className="text-xs text-text-muted text-center py-6">Aucune transaction.</p>}
        <div className="space-y-4 max-h-[28rem] overflow-y-auto pr-1">
          {groupedByMonth.map(([monthKey, list]) => {
            const formattedHeader = monthKey === "Indéterminé" 
              ? "Date non spécifiée" 
              : new Date(monthKey + "-02").toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
            
            const monthInc = list.filter(t => t.type === "income").reduce((s, t) => s + t.amount, 0);
            const monthExp = list.filter(t => t.type === "expense").reduce((s, t) => s + t.amount, 0);
            return (
              <div key={monthKey} className="space-y-1">
                <div className="sticky top-0 bg-[#060b18]/95 backdrop-blur-sm z-10 pb-1 mb-2 mt-2 border-b border-border-subtle/40">
                  <div className="flex items-center justify-between pl-1 pr-1">
                    <h4 className="text-[10px] uppercase font-extrabold tracking-widest text-neon-cyan">
                      {formattedHeader}
                    </h4>
                    <div className="flex gap-2.5 text-[9px] font-bold mono">
                      {monthInc > 0 && <span className="text-neon-green">+{fmtNum(monthInc)} €</span>}
                      {monthExp > 0 && <span className="text-neon-red">−{fmtNum(monthExp)} €</span>}
                    </div>
                  </div>
                </div>
                <div className="space-y-1">
                  {list.map(tx => {
                    const isPast = tx.date && tx.date <= today();
                    if (editingId === tx.id) {
                      const cats = tx.type === "income" ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
                      return (
                        <div key={tx.id} className="glass p-3 border border-neon-cyan/50 rounded-lg space-y-2">
                          <div className="flex justify-between items-center text-xs font-bold mb-1">
                            <span className={tx.type === "income" ? "text-neon-green" : "text-neon-red"}>{tx.type === "income" ? "Modifier Revenu" : "Modifier Dépense"}</span>
                            <button onClick={() => setEditingId(null)} className="text-text-muted hover:text-white cursor-pointer">Annuler</button>
                          </div>
                          <div className="grid grid-cols-2 gap-2 mt-1">
                            <input type="number" step="0.01" value={editAmt} onChange={e => setEditAmt(e.target.value)} className="input text-xs mono" />
                            <input type="date" value={editDate} onChange={e => setEditDate(e.target.value)} className="input text-xs" />
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <select value={editCat} onChange={e => setEditCat(e.target.value)} className="input text-xs cursor-pointer">
                              {cats.map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                            <input placeholder="Note" value={editNote} onChange={e => setEditNote(e.target.value)} className="input text-xs" />
                          </div>
                          <div className="bg-[#030712] p-2 rounded flex flex-col gap-1">
                            <div className="flex justify-between text-[10px] text-text-muted">
                              <span>Proba. {editProb}%</span>
                            </div>
                            <input type="range" min="0" max="100" step="10" value={editProb} onChange={e => setEditProb(e.target.value)} className="w-full accent-neon-cyan h-1" />
                          </div>
                          
                          {/* Recurring Toggle Block inside History Edit */}
                          <div className="bg-[#030712] p-2 rounded flex flex-col gap-2 border border-border-subtle/50">
                            <label className="flex items-center gap-2 cursor-pointer select-none">
                              <input type="checkbox" checked={editIsRepeat} onChange={e => setEditIsRepeat(e.target.checked)} className="accent-neon-cyan" />
                              <span className="text-[10px] text-text-primary font-bold uppercase tracking-wider">Paiement Récurrent</span>
                            </label>
                            {editIsRepeat && (
                              <div className="grid grid-cols-2 gap-2 mt-1 anim-in">
                                <div>
                                  <label className="text-[8px] text-text-muted block mb-0.5">Fréquence</label>
                                  <select value={editFrequency} onChange={e => setEditFrequency(e.target.value)} className="input text-[10px] py-1 bg-[#060b18] border border-border-subtle cursor-pointer w-full">
                                    <option value="weekly">Hebdomadaire</option>
                                    <option value="biweekly">2x par mois</option>
                                    <option value="monthly">Mensuel</option>
                                    <option value="quarterly">Trimestriel</option>
                                    <option value="yearly">Annuel</option>
                                  </select>
                                </div>
                                <div>
                                  <label className="text-[8px] text-text-muted block mb-0.5">Date de fin</label>
                                  <input type="date" value={editEndDate} onChange={e => setEditEndDate(e.target.value)} className="input text-[10px] py-1 w-full bg-[#060b18]" />
                                </div>
                              </div>
                            )}
                          </div>

                          <button onClick={() => saveEdit(tx.id)} className="btn btn-cyan w-full text-xs cursor-pointer"><Check className="w-3.5 h-3.5"/> Sauvegarder</button>
                        </div>
                      );
                    }

                    return (
                      <div key={tx.id} className={`flex items-center justify-between py-2 px-2 rounded-lg hover:bg-surface-hover group transition-opacity duration-200 ${isPast ? "opacity-35" : ""}`}>
                        <div className="flex items-center gap-2">
                          <div className={`w-6 h-6 rounded flex items-center justify-center ${tx.type === "income" ? "bg-emerald-500/10 text-neon-green" : "bg-red-500/10 text-neon-red"}`}>
                            {tx.type === "income" ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                          </div>
                          <div>
                            <p className="text-sm font-bold text-text-primary leading-tight">
                              {tx.note || tx.category}
                            </p>
                            <p className="text-[10px] text-text-muted flex items-center gap-1.5 mt-0.5 flex-wrap">
                              {tx.note && <span>{tx.category}</span>}
                              {tx.note && <span>·</span>}
                              <span>{fmtDate(tx.date)}</span>
                              {tx.probability !== undefined && tx.probability < 100 && (
                                <span className="badge bg-neon-orange/20 text-neon-orange text-[8px] px-1 py-0.5 rounded">Prob. {tx.probability}%</span>
                              )}
                              {tx.isRepeat && (
                                <span className="badge bg-neon-cyan/25 text-neon-cyan text-[8px] px-1 py-0.5 rounded flex items-center gap-1 font-bold border border-neon-cyan/20">
                                  <Repeat className="w-2.5 h-2.5 animate-spin-slow text-neon-cyan" /> Récurrent
                                </span>
                              )}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <div>
                            <span className={`text-sm mono font-bold ${tx.type === "income" ? "text-neon-green" : "text-neon-red"} ${tx.probability !== undefined && tx.probability < 100 ? "opacity-60" : ""}`}>
                              {tx.type === "income" ? "+" : "−"}{fmtNum(tx.amount)} €
                            </span>
                            {tx.isRange && (
                              <span className="block text-[9px] text-text-muted text-right">
                                {fmtNum(tx.amountMin)} à {fmtNum(tx.amountMax)}€
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-1">
                            <button onClick={() => startEdit(tx)} className="text-text-muted hover:text-neon-cyan cursor-pointer p-1">
                              <Edit2 className="w-3 h-3" />
                            </button>
                            <button onClick={() => remove(tx.id)} className="text-text-muted hover:text-neon-red cursor-pointer p-1">
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ── Salaire (Ex-Alternance) ─────────────────────────────────── */
function Salaire() {
  const store = useStore();
  const { alternance } = store;
  const [editSalary, setEditSalary] = useState(false);
  const [salaryVal, setSalaryVal] = useState("");
  const [editStart, setEditStart] = useState(false);
  const [startVal, setStartVal] = useState("");
  const [editEnd, setEditEnd] = useState(false);
  const [endVal, setEndVal] = useState("");
  const [editDay, setEditDay] = useState(false);
  const [dayVal, setDayVal] = useState("");

  const payments = useMemo(
    () => getAlternancePayments(alternance.salary, alternance.startDate, alternance.endDate, alternance.paymentDay || 5),
    [alternance.salary, alternance.startDate, alternance.endDate, alternance.paymentDay]
  );
  const future = payments.filter(p => !p.past);
  const past = payments.filter(p => p.past);
  const totalRemaining = future.reduce((s, p) => s + p.amount, 0);
  const totalReceived = past.reduce((s, p) => s + p.amount, 0);

  function saveSalary() {
    const v = parseFloat(salaryVal);
    if (!isNaN(v) && v >= 0) store.setNested("alternance", "salary", v);
    setEditSalary(false);
  }
  function saveStart() { store.setNested("alternance", "startDate", startVal); setEditStart(false); }
  function saveEnd() { store.setNested("alternance", "endDate", endVal); setEditEnd(false); }
  function saveDay() {
    const v = parseInt(dayVal);
    if (!isNaN(v) && v >= 1 && v <= 31) store.setNested("alternance", "paymentDay", v);
    setEditDay(false);
  }

  return (
    <div className="space-y-3">
      <div className="glass p-4">
        <div className="flex items-center gap-2 mb-3">
          <Briefcase className="w-4 h-4 text-neon-cyan" />
          <span className="text-xs uppercase tracking-widest text-text-muted">Configuration du Salaire</span>
        </div>
        <div className="space-y-3">
          {/* Salaire */}
          <div className="flex items-center justify-between bg-[#030712] rounded-xl px-4 py-3 border border-border-subtle">
            <div>
              <p className="text-[10px] text-text-muted mb-1">Salaire net / mois</p>
              {editSalary ? (
                <div className="flex items-center gap-2">
                  <input
                    type="number" step="1" min="0"
                    value={salaryVal}
                    onChange={e => setSalaryVal(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter") saveSalary(); if (e.key === "Escape") setEditSalary(false); }}
                    className="input mono text-sm w-28"
                    autoFocus
                    placeholder="ex: 1200"
                  />
                  <span className="text-text-muted text-sm">€</span>
                  <button onClick={saveSalary} className="text-neon-green cursor-pointer"><Check className="w-4 h-4" /></button>
                  <button onClick={() => setEditSalary(false)} className="text-text-muted hover:text-white cursor-pointer text-xs">✕</button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  {alternance.salary > 0
                    ? <span className="text-2xl font-bold mono text-neon-cyan">{fmtNum(alternance.salary)} €</span>
                    : <span className="text-base text-text-muted">Non configuré</span>
                  }
                  <button
                    onClick={() => { setSalaryVal(alternance.salary > 0 ? alternance.salary.toString() : ""); setEditSalary(true); }}
                    className="text-text-muted hover:text-neon-cyan cursor-pointer p-1 rounded"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>
            {alternance.salary > 0 && payments.length > 0 && (
              <div className="text-right">
                <p className="text-[10px] text-text-muted">Total estimé du contrat</p>
                <p className="text-sm font-bold mono text-neon-violet">{fmtNum(payments.length * alternance.salary)} €</p>
                <p className="text-[10px] text-text-muted">{payments.length} versement(s)</p>
              </div>
            )}
          </div>

          {/* Dates & Day */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <EditableField label="Début de paie" value={alternance.startDate} isDate editing={editStart}
              editValue={startVal} onEditChange={setStartVal}
              onEdit={() => { setStartVal(alternance.startDate || ""); setEditStart(true); }}
              onSave={saveStart} type="date" />
            <EditableField label="Fin contrat / Suivi" value={alternance.endDate} isDate editing={editEnd}
              editValue={endVal} onEditChange={setEndVal}
              onEdit={() => { setEndVal(alternance.endDate || ""); setEditEnd(true); }}
              onSave={saveEnd} type="date" />
            <EditableField label="Jour de paye" value={alternance.paymentDay || 5} suffix=" du mois" editing={editDay}
              editValue={dayVal} onEditChange={setDayVal}
              onEdit={() => { setDayVal((alternance.paymentDay || 5).toString()); setEditDay(true); }}
              onSave={saveDay} type="number" />
          </div>
        </div>
      </div>

      {alternance.salary > 0 && alternance.startDate && (
        <>
          <div className="grid grid-cols-2 gap-2.5">
            <div className="glass p-3 text-center">
              <p className="text-[10px] text-text-muted">Déjà reçu</p>
              <p className="text-lg font-bold mono text-neon-green">{fmtNum(totalReceived)} €</p>
              <p className="text-[10px] text-text-muted">{past.length} versement(s)</p>
            </div>
            <div className="glass p-3 text-center">
              <p className="text-[10px] text-text-muted">À venir</p>
              <p className="text-lg font-bold mono text-neon-cyan">{fmtNum(totalRemaining)} €</p>
              <p className="text-[10px] text-text-muted">{future.length} versement(s)</p>
            </div>
          </div>
          <div className="glass p-4">
            <div className="flex items-center gap-2 mb-3">
              <Calendar className="w-4 h-4 text-neon-violet" />
              <span className="text-xs uppercase tracking-widest text-text-muted">Historique des salaires</span>
            </div>
            <div className="space-y-0.5 max-h-60 overflow-y-auto">
              {payments.map((p, i) => (
                <div key={i} className={`flex items-center justify-between py-1.5 px-2 rounded ${p.past ? "opacity-35" : ""}`}>
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${p.past ? "bg-text-muted" : "bg-neon-green"}`} />
                    <span className="text-sm text-text-secondary">{fmtDate(p.date)}</span>
                    {p.past && <span className="badge bg-slate-800 text-text-muted text-[9px]">Reçu</span>}
                  </div>
                  <span className="text-sm mono text-neon-green">{fmtNum(p.amount)} €</span>
                </div>
              ))}
              {payments.length === 0 && <p className="text-xs text-text-muted text-center py-3">Aucun versement identifié.</p>}
            </div>
          </div>
        </>
      )}

      {!(alternance.salary > 0 && alternance.startDate) && (
        <div className="glass p-4 text-center text-xs text-text-muted">
          Configure les détails du salaire et la date de début de suivi pour générer l'échéancier.
        </div>
      )}
    </div>
  );
}

function EditableField({ label, value, suffix = "", editing, editValue, onEditChange, onEdit, onSave, type = "number", isDate }) {
  return (
    <div>
      <p className="text-[10px] text-text-muted mb-1">{label}</p>
      {editing ? (
        <div className="flex items-center gap-1">
          <input type={type} value={editValue} onChange={e => onEditChange(e.target.value)}
            className="input mono text-sm" onKeyDown={e => e.key === "Enter" && onSave()} autoFocus />
          <button onClick={onSave} className="text-neon-green cursor-pointer"><Check className="w-4 h-4" /></button>
        </div>
      ) : (
        <button onClick={onEdit} className="text-sm font-bold mono text-neon-cyan cursor-pointer hover:opacity-80">
          {value ? (isDate ? fmtDate(value) : `${fmtNum(value)}${suffix}`) : "Configurer →"}
        </button>
      )}
    </div>
  );
}

/* ── Treasury ────────────────═════════════════════════════════ */
function Treasury() {
  const store = useStore();
  const { treasury = [] } = store;
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [priceMin, setPriceMin] = useState("");
  const [priceMax, setPriceMax] = useState("");
  const [note, setNote] = useState("");
  const [date, setDate] = useState(today());
  const [isRange, setIsRange] = useState(false);

  // Calculations
  const totals = useMemo(() => {
    let min = 0;
    let max = 0;
    let median = 0;

    treasury.forEach(item => {
      if (item.isRange) {
        const itemMin = parseFloat(item.priceMin) || 0;
        const itemMax = parseFloat(item.priceMax) || 0;
        min += itemMin;
        max += itemMax;
        median += (itemMin + itemMax) / 2;
      } else {
        const itemPrice = parseFloat(item.price) || 0;
        min += itemPrice;
        max += itemPrice;
        median += itemPrice;
      }
    });

    return { min, max, median, hasRange: treasury.some(t => t.isRange) };
  }, [treasury]);

  function add(e) {
    e.preventDefault();
    if (!name.trim()) return;

    let p, pMin, pMax;
    if (isRange) {
      pMin = parseFloat(priceMin);
      pMax = parseFloat(priceMax);
      if (isNaN(pMin) || isNaN(pMax)) return;
      p = (pMin + pMax) / 2;
    } else {
      p = parseFloat(price);
      if (isNaN(p)) return;
    }

    const newItem = {
      id: uid(),
      name: name.trim(),
      price: p,
      priceMin: isRange ? pMin : undefined,
      priceMax: isRange ? pMax : undefined,
      isRange,
      note: note.trim(),
      date,
    };

    store.set("treasury", prev => [...(prev || []), newItem]);

    setName("");
    setPrice("");
    setPriceMin("");
    setPriceMax("");
    setNote("");
  }

  function remove(id) {
    store.set("treasury", prev => (prev || []).filter(t => t.id !== id));
  }

  // Edit State
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState("");
  const [editPrice, setEditPrice] = useState("");
  const [editPriceMin, setEditPriceMin] = useState("");
  const [editPriceMax, setEditPriceMax] = useState("");
  const [editDate, setEditDate] = useState("");
  const [editNote, setEditNote] = useState("");
  const [editIsRange, setEditIsRange] = useState(false);

  function startEdit(t) {
    setEditingId(t.id);
    setEditName(t.name);
    setEditPrice(t.price?.toString() || "");
    setEditPriceMin(t.priceMin?.toString() || "");
    setEditPriceMax(t.priceMax?.toString() || "");
    setEditDate(t.date || today());
    setEditNote(t.note || "");
    setEditIsRange(!!t.isRange);
  }

  function saveEdit(id) {
    if (!editName.trim()) return;

    let p, pMin, pMax;
    if (editIsRange) {
      pMin = parseFloat(editPriceMin);
      pMax = parseFloat(editPriceMax);
      if (isNaN(pMin) || isNaN(pMax)) return;
      p = (pMin + pMax) / 2;
    } else {
      p = parseFloat(editPrice);
      if (isNaN(p)) return;
    }

    store.set("treasury", prev => (prev || []).map(t =>
      t.id === id ? { ...t, name: editName, price: p, priceMin: editIsRange ? pMin : undefined, priceMax: editIsRange ? pMax : undefined, isRange: editIsRange, date: editDate, note: editNote } : t
    ));
    setEditingId(null);
  }

  return (
    <div className="space-y-4">
      {/* Total Overview Banner */}
      <div className="glass p-5 border-l-4 border-l-neon-cyan bg-neon-cyan/5 shadow-[0_0_20px_-5px_rgba(0,212,255,0.15)] flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 animate-in">
        <div>
          <span className="text-[10px] text-text-muted uppercase font-bold tracking-wider block mb-1">Valeur Totale Possédée (Physique)</span>
          {totals.hasRange ? (
            <div className="flex flex-col">
              <span className="text-3xl font-extrabold mono text-neon-cyan glow-c">
                {fmtNum(totals.min)} € – {fmtNum(totals.max)} €
              </span>
              <span className="text-[10px] text-text-muted mt-1">Valeur médiane estimée : <strong className="text-text-secondary">{fmtNum(totals.median)} €</strong></span>
            </div>
          ) : (
            <span className="text-3xl font-extrabold mono text-neon-cyan glow-c">
              {fmtNum(totals.median)} €
            </span>
          )}
        </div>
        <div className="text-left sm:text-right">
          <p className="text-[10px] text-text-muted">Nombre de biens</p>
          <p className="text-lg font-bold mono text-text-primary">{treasury.length} objet(s)</p>
        </div>
      </div>

      {/* Activation Dashboard Global pour Trésorerie */}
      <div className="glass p-4 border-neon-cyan/20 space-y-3">
        <label className="flex items-center justify-between cursor-pointer select-none group">
          <div className="flex items-start gap-3">
            <input
              type="checkbox"
              id="include-treasury-checkbox"
              checked={!!store.settings?.includeTreasuryInCapital}
              onChange={() => store.setNested("settings", "includeTreasuryInCapital", !store.settings?.includeTreasuryInCapital)}
              className="accent-neon-cyan w-5 h-5 cursor-pointer rounded border-border-subtle bg-slate-900/60 shrink-0 mt-0.5 transition-transform group-hover:scale-105"
            />
            <div>
              <p className="text-sm font-semibold text-text-primary flex items-center gap-1.5 group-hover:text-neon-cyan transition-colors">
                <Zap className={`w-4 h-4 ${store.settings?.includeTreasuryInCapital ? "text-neon-cyan animate-pulse" : "text-text-muted"}`} />
                Prendre en compte dans le capital total du dashboard
              </p>
              <p className="text-[10px] text-text-muted mt-0.5">
                La fourchette de trésorerie sera prise en compte dans les projections (la valeur minimale en pire cas, la valeur maximale en optimiste, et le prix habituel dans le dashboard).
              </p>
            </div>
          </div>
        </label>
        
        <div className="flex items-center gap-2 text-[10px] border-t border-border-subtle/50 pt-2.5 text-text-muted">
          <Info className="w-3.5 h-3.5 shrink-0 text-neon-cyan" />
          <span>
            {store.settings?.includeTreasuryInCapital 
              ? "Succès — La trésorerie (valeurs minimales, maximales et moyennes) est intégrée dans le calcul du capital global !"
              : "Ces estimations de biens physiques sont indépendantes et n'affectent pas votre capital liquide."
            }
          </span>
        </div>
      </div>

      {/* Form to add item */}
      <form onSubmit={add} className="glass p-4 space-y-3">
        <div className="flex items-center justify-between mt-1 mb-1 px-2 border border-border-subtle rounded-lg bg-surface-hover">
          <span className="text-[10px] text-text-muted">Mode de tarification</span>
          <div className="flex gap-1 p-1">
            <button type="button" onClick={() => setIsRange(false)} className={`text-[10px] px-2 py-0.5 rounded cursor-pointer ${!isRange ? "bg-neon-cyan/20 text-neon-cyan" : "text-text-muted"}`}>Fixe</button>
            <button type="button" onClick={() => setIsRange(true)} className={`text-[10px] px-2 py-0.5 rounded cursor-pointer ${isRange ? "bg-neon-cyan/20 text-neon-cyan" : "text-text-muted"}`}>Fourchette (Est.)</button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <input placeholder="Nom de l'objet (ex: MacBook Pro, Vélo)" value={name} onChange={e => setName(e.target.value)} className="input" required />
          
          <div className="grid grid-cols-2 gap-2">
            {isRange ? (
              <>
                <input type="number" step="0.01" min="0" placeholder="Prix Min (€)" value={priceMin} onChange={e => setPriceMin(e.target.value)} className="input mono text-neon-orange" required />
                <input type="number" step="0.01" min="0" placeholder="Prix Max (€)" value={priceMax} onChange={e => setPriceMax(e.target.value)} className="input mono text-emerald-400" required />
              </>
            ) : (
              <input type="number" step="0.01" min="0" placeholder="Prix (€)" value={price} onChange={e => setPrice(e.target.value)} className="input mono col-span-2" required />
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <input placeholder="Note (optionnel)" value={note} onChange={e => setNote(e.target.value)} className="input text-xs" />
          <input type="date" value={date} onChange={e => setDate(e.target.value)} className="input text-xs" />
        </div>

        <button type="submit" className="btn btn-cyan w-full cursor-pointer"><Plus className="w-4 h-4" /> Ajouter à la trésorerie</button>
      </form>

      {/* List of items */}
      <div className="glass p-3.5">
        <h3 className="text-xs uppercase font-bold tracking-wider text-text-muted mb-3 flex items-center gap-1.5">
          <Package className="w-4 h-4 text-neon-cyan" /> Inventaire des Biens Physiques
        </h3>

        {treasury.length === 0 && <p className="text-xs text-text-muted text-center py-6">Aucun bien physique enregistré.</p>}
        
        <div className="space-y-1.5 max-h-[30rem] overflow-y-auto">
          {treasury.map(item => {
            if (editingId === item.id) {
              return (
                <div key={item.id} className="glass p-3 border border-neon-cyan/50 rounded-lg space-y-2.5">
                  <div className="flex justify-between items-center text-xs font-bold mb-1">
                    <span className="text-neon-cyan">Modifier le bien</span>
                    <button onClick={() => setEditingId(null)} className="text-text-muted hover:text-white cursor-pointer">Annuler</button>
                  </div>
                  
                  <div className="flex items-center justify-between px-2 border border-border-subtle rounded-lg bg-surface-hover">
                    <span className="text-[10px] text-text-muted">Tarification</span>
                    <div className="flex gap-1 p-1">
                      <button type="button" onClick={() => setEditIsRange(false)} className={`text-[10px] px-2 py-0.5 rounded cursor-pointer ${!editIsRange ? "bg-neon-cyan/20 text-neon-cyan" : "text-text-muted"}`}>Fixe</button>
                      <button type="button" onClick={() => setEditIsRange(true)} className={`text-[10px] px-2 py-0.5 rounded cursor-pointer ${editIsRange ? "bg-neon-cyan/20 text-neon-cyan" : "text-text-muted"}`}>Fourchette</button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <input value={editName} onChange={e => setEditName(e.target.value)} className="input text-xs" required />
                    {editIsRange ? (
                      <div className="grid grid-cols-2 gap-1">
                        <input type="number" step="0.01" placeholder="Min" value={editPriceMin} onChange={e => setEditPriceMin(e.target.value)} className="input text-xs mono text-neon-orange" required />
                        <input type="number" step="0.01" placeholder="Max" value={editPriceMax} onChange={e => setEditPriceMax(e.target.value)} className="input text-xs mono text-emerald-400" required />
                      </div>
                    ) : (
                      <input type="number" step="0.01" value={editPrice} onChange={e => setEditPrice(e.target.value)} className="input text-xs mono" required />
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <input type="date" value={editDate} onChange={e => setEditDate(e.target.value)} className="input text-xs" />
                    <input placeholder="Note" value={editNote} onChange={e => setEditNote(e.target.value)} className="input text-xs" />
                  </div>

                  <button onClick={() => saveEdit(item.id)} className="btn btn-cyan w-full text-xs cursor-pointer"><Check className="w-3.5 h-3.5"/> Sauvegarder</button>
                </div>
              );
            }

            return (
              <div key={item.id} className="flex items-center justify-between py-2 px-2.5 rounded-lg hover:bg-surface-hover group">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-7 h-7 rounded bg-neon-cyan/10 flex items-center justify-center text-neon-cyan shrink-0">
                    <Package className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-text-primary truncate">{item.name}</p>
                    <p className="text-[9px] text-text-muted">
                      {fmtDate(item.date)}
                      {item.note && ` · ${item.note}`}
                    </p>
                  </div>
                </div>
                
                <div className="flex items-center gap-3 shrink-0">
                  <div className="text-right">
                    {item.isRange ? (
                      <>
                        <span className="text-xs mono font-bold text-neon-cyan">
                          {fmtNum(item.priceMin)} – {fmtNum(item.priceMax)} €
                        </span>
                        <span className="block text-[8px] text-text-muted">Moy : {fmtNum(item.price)} €</span>
                      </>
                    ) : (
                      <span className="text-xs mono font-bold text-neon-cyan">
                        {fmtNum(item.price)} €
                      </span>
                    )}
                  </div>
                  
                  <div className="flex items-center gap-1">
                    <button onClick={() => startEdit(item)} className="text-text-muted hover:text-neon-cyan cursor-pointer p-1">
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => remove(item.id)} className="text-text-muted hover:text-neon-red cursor-pointer p-1">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
