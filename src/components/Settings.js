"use client";
import { useState, useMemo } from "react";
import { useStore } from "@/lib/store";
import { fmtNum, exportCSV, exportJSON, sendDiscordWebhook, sendTelegramMessage } from "@/lib/utils";
import {
  Settings, Shield, Download, Bell, Trash2, AlertTriangle,
  Check, Swords, Target, Send, FileJson, FileSpreadsheet, PieChart, Plus
} from "lucide-react";
import { EXPENSE_CATEGORIES } from "@/lib/constants";

import DraggableTabs from "@/components/DraggableTabs";

export default function SettingsPage() {
  const [sub, setSub] = useState("general");
  const tabs = [
    { id: "general", label: "Général", Icon: Settings },
    { id: "budgets", label: "Budgets", Icon: PieChart },
    { id: "webhooks", label: "Notifications", Icon: Bell },
    { id: "export", label: "Export", Icon: Download },
    { id: "danger", label: "Danger", Icon: Trash2 },
  ];

  return (
    <div className="space-y-4 anim-in">
      <DraggableTabs
        tabs={tabs}
        activeId={sub}
        onChange={setSub}
        settingsKey="settingsTabOrder"
      />
      {sub === "general" && <General />}
      {sub === "budgets" && <BudgetSettings />}
      {sub === "webhooks" && <Webhooks />}
      {sub === "export" && <ExportData />}
      {sub === "danger" && <DangerZone />}
    </div>
  );
}

/* ── General Settings ───────────────────────────────────────────── */
function General() {
  const store = useStore();
  const { settings, capitalInitial } = store;
  const [goalVal, setGoalVal] = useState(settings.goalTotal?.toString() || "20000");
  const [asiaVal, setAsiaVal] = useState(settings.asiaCostMonthly?.toString() || "800");
  const [capitalVal, setCapitalVal] = useState(capitalInitial?.toString() || "0");
  const [saved, setSaved] = useState(false);
  const [layoutReset, setLayoutReset] = useState(false);

  function resetLayout() {
    store.setNested("settings", "dashboardBlockOrder", ["main_kpi", "kpi_cards", "net_balance", "goals", "scenario", "investments", "war_mode"]);
    store.setNested("settings", "hiddenDashboardBlocks", []);
    setLayoutReset(true);
    setTimeout(() => setLayoutReset(false), 1500);
  }

  function save() {
    store.setNested("settings", "goalTotal", parseFloat(goalVal) || 20000);
    store.setNested("settings", "asiaCostMonthly", parseFloat(asiaVal) || 800);
    store.set("capitalInitial", parseFloat(capitalVal) || 0);
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  }

  return (
    <div className="space-y-3">
      <div className="glass p-4 space-y-3">
        <div className="flex items-center gap-2 mb-1">
          <Settings className="w-4 h-4 text-text-secondary" />
          <span className="text-xs uppercase tracking-widest text-text-muted">Paramètres généraux</span>
        </div>

        <div>
          <label className="text-xs text-text-muted block mb-1">Capital initial (€)</label>
          <input type="number" value={capitalVal} onChange={(e) => setCapitalVal(e.target.value)} className="input mono" />
          <p className="text-[10px] text-text-muted mt-0.5">Le montant de départ avec lequel tu commences le suivi.</p>
        </div>
        <div>
          <label className="text-xs text-text-muted block mb-1">Objectif total (€)</label>
          <input type="number" value={goalVal} onChange={(e) => setGoalVal(e.target.value)} className="input mono" />
        </div>
        <div>
          <label className="text-xs text-text-muted block mb-1">Coût de vie Asie (€/mois)</label>
          <input type="number" value={asiaVal} onChange={(e) => setAsiaVal(e.target.value)} className="input mono" />
          <p className="text-[10px] text-text-muted mt-0.5">Utilisé pour le calcul du Runway.</p>
        </div>

        <button onClick={save} className="btn btn-green w-full cursor-pointer">
          {saved ? <><Check className="w-4 h-4" /> Sauvegardé</> : "Sauvegarder"}
        </button>
      </div>

      {/* War Mode */}
      <div className="glass p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Swords className="w-4 h-4 text-neon-red" />
            <div>
              <p className="text-sm font-medium text-text-primary">Mode Économie de Guerre</p>
              <p className="text-[10px] text-text-muted">Grise les dépenses non-essentielles pour forcer l'épargne.</p>
            </div>
          </div>
          <button
            onClick={() => store.setNested("settings", "warMode", !settings.warMode)}
            className={`w-11 h-6 rounded-full transition-colors cursor-pointer flex items-center px-0.5 ${
              settings.warMode ? "bg-neon-red" : "bg-slate-700"
            }`}
          >
            <div className={`w-5 h-5 rounded-full bg-white transition-transform ${settings.warMode ? "translate-x-5" : ""}`} />
          </button>
        </div>
      </div>

      {/* Dashboard Layout Reset */}
      <div className="glass p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Settings className="w-4 h-4 text-neon-cyan animate-spin-slow" />
            <div>
              <p className="text-sm font-medium text-text-primary">Disposition du Dashboard</p>
              <p className="text-[10px] text-text-muted">Réinitialise l'ordre et la visibilité des blocs.</p>
            </div>
          </div>
          <button
            onClick={resetLayout}
            className={`btn text-xs px-4 py-1.5 cursor-pointer ${
              layoutReset
                ? "btn-green"
                : "btn-ghost border border-neon-cyan/30 text-neon-cyan hover:bg-neon-cyan/10"
            }`}
          >
            {layoutReset ? <><Check className="w-3.5 h-3.5" /> Réinitialisé</> : "Réinitialiser"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Budgets (Envelopes) ────────────────────────────────────────── */
function BudgetSettings() {
  const store = useStore();
  const { budgets } = store;
  const [cat, setCat] = useState("Loisirs");
  const [limit, setLimit] = useState("");

  function add(e) {
    e.preventDefault();
    const v = parseFloat(limit);
    if (!v || !cat) return;
    if (budgets.find(b => b.category === cat)) {
      store.set("budgets", prev => prev.map(b => b.category === cat ? { ...b, limit: v } : b));
    } else {
      store.set("budgets", prev => [...prev, { category: cat, limit: v }]);
    }
    setLimit("");
  }

  function remove(c) {
    store.set("budgets", prev => prev.filter(b => b.category !== c));
  }

  return (
    <div className="space-y-3">
      <form onSubmit={add} className="glass p-4 space-y-3">
        <div className="flex items-center gap-2 mb-1">
          <PieChart className="w-4 h-4 text-neon-cyan" />
          <span className="text-xs uppercase tracking-widest text-text-muted">Nouvelle Enveloppe</span>
        </div>
        <p className="text-[10px] text-text-muted mb-2">Fixe des plafonds stricts pour tes catégories de dépenses mensuelles.</p>
        <div className="flex gap-2">
          <select value={cat} onChange={e => setCat(e.target.value)} className="input text-xs cursor-pointer flex-1">
            {EXPENSE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <input type="number" placeholder="Limite €" value={limit} onChange={e => setLimit(e.target.value)} className="input mono w-24" />
        </div>
        <button type="submit" disabled={!limit} className={`btn w-full text-xs ${limit ? "btn-cyan" : "btn-disabled btn-ghost"}`}>
          <Plus className="w-3.5 h-3.5" /> Ajouter ou Modifier
        </button>
      </form>

      <div className="glass p-3">
        {budgets.length === 0 && <p className="text-xs text-text-muted text-center py-2">Aucun budget défini.</p>}
        <div className="space-y-1">
          {budgets.map(b => (
            <div key={b.category} className="flex items-center justify-between py-2 px-2 rounded-lg hover:bg-surface-hover group">
              <span className="text-sm text-text-primary">{b.category}</span>
              <div className="flex items-center gap-3">
                <span className="text-sm mono text-neon-cyan font-bold">{fmtNum(b.limit)} €</span>
                <button onClick={() => remove(b.category)} className="opacity-0 group-hover:opacity-100 text-text-muted hover:text-neon-red cursor-pointer">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ── Webhooks ────────────────────────────────────────────────────── */
function Webhooks() {
  const store = useStore();
  const { settings, capitalInitial, transactions } = store;
  const [discordUrl, setDiscordUrl] = useState(settings.discordWebhook || "");
  const [teleToken, setTeleToken] = useState(settings.telegramToken || "");
  const [teleChatId, setTeleChatId] = useState(settings.telegramChatId || "");
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState("");

  const totalIncome = useMemo(() => transactions.filter(t => t.type === "income").reduce((s, t) => s + t.amount, 0), [transactions]);
  const totalExpense = useMemo(() => transactions.filter(t => t.type === "expense").reduce((s, t) => s + t.amount, 0), [transactions]);
  const capital = capitalInitial + totalIncome - totalExpense;

  function saveWebhooks() {
    store.setNested("settings", "discordWebhook", discordUrl);
    store.setNested("settings", "telegramToken", teleToken);
    store.setNested("settings", "telegramChatId", teleChatId);
    setResult("Sauvegardé !");
    setTimeout(() => setResult(""), 1500);
  }

  async function testDiscord() {
    setSending(true);
    const msg = `💰 **Finance Wallet** — Capital: ${fmtNum(capital)} € | Revenus: ${fmtNum(totalIncome)} € | Dépenses: ${fmtNum(totalExpense)} €`;
    const ok = await sendDiscordWebhook(discordUrl, msg);
    setResult(ok ? "✅ Discord OK" : "❌ Erreur Discord");
    setSending(false);
    setTimeout(() => setResult(""), 3000);
  }

  async function testTelegram() {
    setSending(true);
    const msg = `💰 <b>Finance Wallet</b>\nCapital: ${fmtNum(capital)} €\nRevenus: ${fmtNum(totalIncome)} €\nDépenses: ${fmtNum(totalExpense)} €`;
    const ok = await sendTelegramMessage(teleToken, teleChatId, msg);
    setResult(ok ? "✅ Telegram OK" : "❌ Erreur Telegram");
    setSending(false);
    setTimeout(() => setResult(""), 3000);
  }

  return (
    <div className="space-y-3">
      <div className="glass p-4 space-y-3">
        <div className="flex items-center gap-2 mb-1">
          <Bell className="w-4 h-4 text-neon-violet" />
          <span className="text-xs uppercase tracking-widest text-text-muted">Discord Webhook</span>
        </div>
        <input placeholder="URL du webhook Discord" value={discordUrl}
          onChange={(e) => setDiscordUrl(e.target.value)} className="input text-xs" />
        <div className="flex gap-2">
          <button onClick={saveWebhooks} className="btn btn-ghost flex-1 cursor-pointer text-xs">Sauvegarder</button>
          <button onClick={testDiscord} disabled={!discordUrl || sending}
            className={`btn btn-violet flex-1 cursor-pointer text-xs ${!discordUrl ? "btn-disabled" : ""}`}>
            <Send className="w-3.5 h-3.5" /> Tester
          </button>
        </div>
      </div>

      <div className="glass p-4 space-y-3">
        <div className="flex items-center gap-2 mb-1">
          <Bell className="w-4 h-4 text-neon-cyan" />
          <span className="text-xs uppercase tracking-widest text-text-muted">Telegram Bot</span>
        </div>
        <input placeholder="Bot Token" value={teleToken}
          onChange={(e) => setTeleToken(e.target.value)} className="input text-xs" />
        <input placeholder="Chat ID" value={teleChatId}
          onChange={(e) => setTeleChatId(e.target.value)} className="input text-xs" />
        <div className="flex gap-2">
          <button onClick={saveWebhooks} className="btn btn-ghost flex-1 cursor-pointer text-xs">Sauvegarder</button>
          <button onClick={testTelegram} disabled={!teleToken || !teleChatId || sending}
            className={`btn btn-cyan flex-1 cursor-pointer text-xs ${!teleToken || !teleChatId ? "btn-disabled" : ""}`}>
            <Send className="w-3.5 h-3.5" /> Tester
          </button>
        </div>
      </div>

      {result && (
        <div className="glass p-3 text-center text-sm font-medium text-neon-green">{result}</div>
      )}
    </div>
  );
}

/* ── Export ──────────────────────────────────────────────────────── */
function ExportData() {
  const store = useStore();
  const { transactions, freelance, recurringExpenses, familyTransfers, pockets, crypto, itCosts } = store;

  function handleExportCSV() {
    exportCSV(
      transactions.map((t) => ({
        date: t.date,
        type: t.type,
        category: t.category,
        amount: t.amount,
        note: t.note || "",
      })),
      "transactions.csv"
    );
  }

  function handleExportAll() {
    exportJSON(
      { transactions, freelance, recurringExpenses, familyTransfers, pockets, crypto, itCosts },
      "finance-wallet-export.json"
    );
  }

  return (
    <div className="glass p-4 space-y-3">
      <div className="flex items-center gap-2 mb-2">
        <Download className="w-4 h-4 text-neon-cyan" />
        <span className="text-xs uppercase tracking-widest text-text-muted">Exporter les données</span>
      </div>

      <button onClick={handleExportCSV} className="btn btn-ghost w-full cursor-pointer">
        <FileSpreadsheet className="w-4 h-4 text-neon-green" />
        Exporter les transactions (CSV)
      </button>
      <button onClick={handleExportAll} className="btn btn-ghost w-full cursor-pointer">
        <FileJson className="w-4 h-4 text-neon-cyan" />
        Exporter toutes les données (JSON)
      </button>

      <p className="text-[10px] text-text-muted text-center pt-2">
        {transactions.length} transactions · {freelance.length} projets freelance
      </p>
    </div>
  );
}

/* ── Danger Zone ────────────────────────────────────────────────── */
function DangerZone() {
  const store = useStore();
  const [confirm, setConfirm] = useState(false);

  function handleReset() {
    if (!confirm) {
      setConfirm(true);
      return;
    }
    store.resetAll();
    setConfirm(false);
    window.location.reload();
  }

  return (
    <div className="glass p-4 border-neon-red/20">
      <div className="flex items-center gap-2 mb-3">
        <AlertTriangle className="w-4 h-4 text-neon-red" />
        <span className="text-xs uppercase tracking-widest text-neon-red">Zone Dangereuse</span>
      </div>

      <p className="text-xs text-text-muted mb-3">
        Supprimer toutes les données de l'application. Cette action est irréversible.
      </p>

      <button onClick={handleReset}
        className={`btn w-full cursor-pointer ${confirm ? "btn-red" : "btn-ghost border-neon-red/30 text-neon-red"}`}>
        <Trash2 className="w-4 h-4" />
        {confirm ? "Confirmer la suppression complète" : "Réinitialiser toutes les données"}
      </button>

      {confirm && (
        <button onClick={() => setConfirm(false)} className="btn btn-ghost w-full mt-2 cursor-pointer text-xs">
          Annuler
        </button>
      )}
    </div>
  );
}
