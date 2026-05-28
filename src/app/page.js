"use client";
import { useState } from "react";
import { StoreProvider, useStore } from "@/lib/store";
import Dashboard from "@/components/Dashboard";
import Transactions from "@/components/Transactions";
import Tools from "@/components/Tools";
import Settings from "@/components/Settings";
import Investments from "@/components/Investments";
import {
  LayoutDashboard, ArrowLeftRight,
  Wrench, Settings as SettingsIcon, Loader2, Menu, X, Coins,
  ChevronLeft, ChevronRight
} from "lucide-react";

const TABS = [
  { id: "dashboard", label: "Dashboard", Icon: LayoutDashboard },
  { id: "transactions", label: "Transactions", Icon: ArrowLeftRight },
  { id: "investments", label: "Investissement", Icon: Coins },
  { id: "tools", label: "Outils", Icon: Wrench },
  { id: "settings", label: "Config", Icon: SettingsIcon },
];

const COMPONENTS = {
  dashboard: Dashboard,
  transactions: Transactions,
  investments: Investments,
  tools: Tools,
  settings: Settings,
};

function Shell() {
  const { loaded, settings } = useStore();
  const [tab, setTab] = useState("dashboard");
  const [sideOpen, setSideOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const ActiveComponent = COMPONENTS[tab];

  if (!loaded) {
    return (
      <div className="min-h-dvh flex items-center justify-center">
        <Loader2 className="w-6 h-6 text-neon-cyan animate-spin" />
      </div>
    );
  }

  return (
    <div className={`min-h-dvh flex ${settings?.warMode ? "war-mode" : ""}`}>
      {/* Desktop Sidebar */}
      <aside className={`hidden lg:flex flex-col fixed inset-y-0 left-0 z-40 border-r border-border-subtle bg-[#060b18]/90 backdrop-blur-md transition-all duration-300 ${sidebarCollapsed ? "w-16" : "w-56"}`}>
        <div className="px-4 py-5 border-b border-border-subtle flex items-center justify-between min-h-[73px]">
          {!sidebarCollapsed ? (
            <div className="min-w-0 flex-1">
              <h1 className="text-sm font-bold tracking-widest uppercase text-neon-green glow-g truncate">
                Finance Wallet
              </h1>
              <p className="text-[10px] text-text-muted mt-0.5 truncate">Budget & Objectifs</p>
            </div>
          ) : (
            <div className="flex-1 flex justify-center">
              <span className="text-sm font-bold tracking-widest uppercase text-neon-green glow-g">FW</span>
            </div>
          )}
          
          <button 
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="p-1 rounded hover:bg-surface-hover text-text-muted hover:text-text-secondary cursor-pointer transition-colors"
            title={sidebarCollapsed ? "Agrandir le menu" : "Réduire le menu"}
          >
            {sidebarCollapsed ? (
              <ChevronRight className="w-4 h-4" />
            ) : (
              <ChevronLeft className="w-4 h-4" />
            )}
          </button>
        </div>
        <nav className="flex-1 py-3 px-2 space-y-1 overflow-y-auto">
          {TABS.map(({ id, label, Icon }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`w-full flex items-center rounded-lg text-[13px] font-medium transition-all duration-200 cursor-pointer ${
                sidebarCollapsed ? "justify-center py-2.5 px-0" : "gap-2.5 px-3 py-2"
              } ${
                tab === id
                  ? "bg-neon-cyan/10 text-neon-cyan"
                  : "text-text-muted hover:text-text-secondary hover:bg-surface-hover"
              }`}
              title={sidebarCollapsed ? label : undefined}
            >
              <Icon className="w-4 h-4 shrink-0" />
              {!sidebarCollapsed && <span>{label}</span>}
            </button>
          ))}
        </nav>
        <div className="px-4 py-3 border-t border-border-subtle">
          <p className="text-[10px] text-text-muted text-center truncate">
            {sidebarCollapsed ? "v1" : "v1.0 · Local Storage"}
          </p>
        </div>
      </aside>

      {/* Mobile header */}
      <header className="lg:hidden fixed top-0 inset-x-0 z-40 h-12 flex items-center justify-between px-4 border-b border-border-subtle bg-[#060b18]/90 backdrop-blur-md">
        <span className="text-xs font-bold tracking-widest uppercase text-neon-green">FW</span>
        <span className="text-xs font-medium text-text-secondary">{TABS.find(t => t.id === tab)?.label}</span>
        <button onClick={() => setSideOpen(!sideOpen)} className="text-text-muted cursor-pointer">
          {sideOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </header>

      {/* Mobile menu overlay */}
      {sideOpen && (
        <div className="lg:hidden fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/60" onClick={() => setSideOpen(false)} />
          <nav className="absolute right-0 top-0 bottom-0 w-56 bg-[#060b18] border-l border-border-subtle p-4 space-y-1">
            <p className="text-xs text-text-muted mb-3 font-medium">Navigation</p>
            {TABS.map(({ id, label, Icon }) => (
              <button
                key={id}
                onClick={() => { setTab(id); setSideOpen(false); }}
                className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
                  tab === id ? "bg-neon-cyan/10 text-neon-cyan" : "text-text-muted hover:text-text-secondary"
                }`}
              >
                <Icon className="w-4 h-4" />
                {label}
              </button>
            ))}
          </nav>
        </div>
      )}

      {/* Mobile bottom bar */}
      <nav className="lg:hidden fixed bottom-0 inset-x-0 z-40 h-14 flex items-center justify-around border-t border-border-subtle bg-[#060b18]/95 backdrop-blur-md">
        {TABS.slice(0, 5).map(({ id, label, Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`flex flex-col items-center gap-0.5 px-2 py-1 cursor-pointer transition-colors ${
              tab === id ? "text-neon-cyan" : "text-text-muted"
            }`}
          >
            <Icon className="w-4.5 h-4.5" />
            <span className="text-[9px] font-medium">{label}</span>
          </button>
        ))}
      </nav>

      {/* Main content */}
      <main className={`flex-1 pt-12 lg:pt-0 pb-16 lg:pb-0 transition-all duration-300 ${sidebarCollapsed ? "lg:ml-16" : "lg:ml-56"}`}>
        <div className="max-w-4xl mx-auto px-4 py-5">
          <ActiveComponent />
        </div>
      </main>
    </div>
  );
}

export default function Page() {
  return (
    <StoreProvider>
      <Shell />
    </StoreProvider>
  );
}
