"use client";
import { useState, useMemo, useEffect } from "react";
import { useStore } from "@/lib/store";
import { COST_OF_LIVING, JAPAN_DEFAULTS } from "@/lib/constants";
import { fmtNum, monthsOfRunway, computeCapital, today } from "@/lib/utils";
import {
  Globe, Plane, MapPin, Search, Plus, Trash2, Check, X, RotateCcw, Filter, ChevronDown, ChevronUp, Sparkles, ArrowUpDown
} from "lucide-react";

export default function Tools() {
  const [sub, setSub] = useState("runway");
  const tabs = [
    { id: "runway", label: "Runway" },
    { id: "trip", label: "Voyage" },
    { id: "costliving", label: "Coût de vie" },
  ];

  return (
    <div className="space-y-4 anim-in">
      <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
        {tabs.map(t => (
          <button key={t.id} onClick={() => setSub(t.id)}
            className={`btn text-xs whitespace-nowrap cursor-pointer ${sub === t.id ? "btn-cyan" : "btn-ghost"}`}>{t.label}</button>
        ))}
      </div>
      {sub === "runway" && <Runway />}
      {sub === "trip" && <TripEstimator />}
      {sub === "costliving" && <CostLiving />}
    </div>
  );
}

/* ── Runway ───────────────────────────────────────────────── */
function getFlightCost(country) {
  const map = {
    "États-Unis": 600, "Royaume-Uni": 120, "Angleterre (England)": 120,
    "Australie": 1100, "Canada": 650, "Thaïlande": 450, "Vietnam": 500,
    "Indonésie": 600, "Malaisie": 500, "Japon": 650, "Corée du Sud": 600,
    "Taïwan": 550, "Chine": 500, "France": 50, "Qatar": 450, "Émirats": 450
  };
  return map[country] || 500;
}

function Runway() {
  const store = useStore();
  const [runwayDate, setRunwayDate] = useState(today());
  const [scenario, setScenario] = useState("expected"); // min, expected, max
  const [includeReturn, setIncludeReturn] = useState(false);
  const [includeNeighbors, setIncludeNeighbors] = useState(false);
  const [neighborCost, setNeighborCost] = useState(150);

  const allCountries = useMemo(() => {
    return [...COST_OF_LIVING, ...(store.customCountries || [])];
  }, [store.customCountries]);

  const [selectedCountryName, setSelectedCountryName] = useState("France");
  const [checkedCountries, setCheckedCountries] = useState([]);
  const [showFilters, setShowFilters] = useState(false);
  const [sortMode, setSortMode] = useState("months_desc"); // months_desc, months_asc, cost_asc, cost_desc
  const [showMainBlock, setShowMainBlock] = useState(true);

  const countryData = useMemo(() => {
    return allCountries.find(l => l.name === selectedCountryName) || allCountries[0];
  }, [selectedCountryName, allCountries]);

  // Editable parameters for main country
  const [customHousing, setCustomHousing] = useState("");
  const [customFood, setCustomFood] = useState("");
  const [customTransport, setCustomTransport] = useState("");
  const [customOther, setCustomOther] = useState("");
  const [customFlight, setCustomFlight] = useState("");

  // Sync / reset inputs when main country selection changes
  useEffect(() => {
    if (countryData) {
      setCustomHousing(countryData.housing.toString());
      setCustomFood(countryData.food.toString());
      setCustomTransport(countryData.transport.toString());
      setCustomOther((countryData.other || 150).toString());
      setCustomFlight(getFlightCost(countryData.name).toString());
    }
  }, [countryData]);

  // Initialize checkedCountries with all available countries
  useEffect(() => {
    if (allCountries.length > 0 && checkedCountries.length === 0) {
      setCheckedCountries(allCountries.map(c => c.name));
    }
  }, [allCountries]);

  const rawCapital = useMemo(() => computeCapital(store, runwayDate, scenario), [store, runwayDate, scenario]);

  const housingVal = parseFloat(customHousing) || 0;
  const foodVal = parseFloat(customFood) || 0;
  const transportVal = parseFloat(customTransport) || 0;
  const otherVal = parseFloat(customOther) || 0;
  const flightVal = parseFloat(customFlight) || 0;

  const customMonthlyCost = housingVal + foodVal + transportVal + otherVal;
  
  const extras = (includeReturn ? 500 : 0) + (includeNeighbors ? neighborCost * 5 : 0);
  const totalDeducted = flightVal + extras;
  const netCapital = Math.max(0, rawCapital - totalDeducted);
  const months = monthsOfRunway(netCapital, customMonthlyCost);
  const isDead = netCapital <= 0 || months === 0;

  const isCustomized = countryData && (
    housingVal !== countryData.housing ||
    foodVal !== countryData.food ||
    transportVal !== countryData.transport ||
    otherVal !== (countryData.other || 150) ||
    flightVal !== getFlightCost(countryData.name)
  );

  const resetMainCountry = () => {
    if (countryData) {
      setCustomHousing(countryData.housing.toString());
      setCustomFood(countryData.food.toString());
      setCustomTransport(countryData.transport.toString());
      setCustomOther((countryData.other || 150).toString());
      setCustomFlight(getFlightCost(countryData.name).toString());
    }
  };

  const toggleCheckedCountry = (name) => {
    setCheckedCountries(prev => 
      prev.includes(name) ? prev.filter(n => n !== name) : [...prev, name]
    );
  };

  // Sorted compared countries
  const sortedCheckedCountries = useMemo(() => {
    const list = allCountries.filter(l => l.name !== selectedCountryName && checkedCountries.includes(l.name));
    return [...list].sort((a, b) => {
      const flightA = getFlightCost(a.name);
      const flightB = getFlightCost(b.name);
      const netA = Math.max(0, rawCapital - (flightA + extras));
      const netB = Math.max(0, rawCapital - (flightB + extras));
      const mA = monthsOfRunway(netA, a.monthly);
      const mB = monthsOfRunway(netB, b.monthly);
      if (sortMode === "months_desc") return (mB === Infinity ? 99999 : mB) - (mA === Infinity ? 99999 : mA);
      if (sortMode === "months_asc") return (mA === Infinity ? 99999 : mA) - (mB === Infinity ? 99999 : mB);
      if (sortMode === "cost_asc") return a.monthly - b.monthly;
      if (sortMode === "cost_desc") return b.monthly - a.monthly;
      if (sortMode === "name_asc") return a.name.localeCompare(b.name);
      return 0;
    });
  }, [allCountries, selectedCountryName, checkedCountries, rawCapital, extras, sortMode]);

  return (
    <div className="glass p-4 space-y-4">
      {/* Header and Selectors */}
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3">
        <div className="flex items-center gap-2">
          <Globe className="w-4 h-4 text-neon-cyan" />
          <span className="text-xs uppercase tracking-widest text-text-muted">Calculateur de Runway Extrême</span>
        </div>
        
        {/* Main Country Dropdown */}
        <div className="flex items-center gap-2">
          <span className="text-[10px] uppercase text-text-muted">Destination principale :</span>
          <select 
            value={selectedCountryName} 
            onChange={e => setSelectedCountryName(e.target.value)} 
            className="input w-auto text-xs cursor-pointer py-1 px-2.5 bg-slate-900 border-border-subtle"
          >
            {allCountries.map(c => (
              <option key={c.name} value={c.name}>{c.flag} {c.name}</option>
            ))}
          </select>
        </div>
      </div>
      
      {/* Global settings */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-2">
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-[9px] text-text-muted uppercase block mb-1">Cible temporelle</label>
            <input type="date" value={runwayDate} onChange={e => setRunwayDate(e.target.value)} className="input text-xs px-2 py-1" />
          </div>
          <div>
            <label className="text-[9px] text-text-muted uppercase block mb-1">Scénario de richesse</label>
            <select value={scenario} onChange={e => setScenario(e.target.value)} className="input text-xs px-2 py-1 cursor-pointer">
              <option value="min">Pire Scénario (Retards, Crash)</option>
              <option value="expected">Probable (Médian)</option>
              <option value="max">Optimiste (100% de réussite)</option>
            </select>
          </div>
        </div>

        <div className="flex flex-col gap-1.5 bg-[#030712]/50 p-2 border border-border-subtle rounded">
          <label className="flex items-center gap-2 cursor-pointer text-[10px]">
            <input type="checkbox" checked={includeReturn} onChange={e => setIncludeReturn(e.target.checked)} className="accent-neon-violet w-3 h-3" />
            <span className="text-text-primary">Vol Retour anticipé (+500€)</span>
          </label>
          <div className="flex items-center gap-2 justify-between">
            <label className="flex items-center gap-2 cursor-pointer text-[10px] flex-1">
              <input type="checkbox" checked={includeNeighbors} onChange={e => setIncludeNeighbors(e.target.checked)} className="accent-neon-cyan w-3 h-3" />
              <span className="text-text-primary">5 Vols Pays Voisins (A/R)</span>
            </label>
            {includeNeighbors && (
              <div className="flex items-center gap-1">
                <label className="text-[8px] text-text-muted uppercase">Prix/Vol</label>
                <input type="number" value={neighborCost} onChange={e => setNeighborCost(parseInt(e.target.value) || 0)} className="input text-[10px] px-1 py-0.5 mono w-12" />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main editable country values */}
      <div className="space-y-1.5">
        <span className="text-[10px] uppercase tracking-wider text-text-muted flex items-center justify-between">
          <span>Ajuster le budget pour {countryData?.flag} {countryData?.name} :</span>
          {isCustomized && (
            <span className="text-neon-violet font-semibold animate-pulse text-[9px]">Budget personnalisé</span>
          )}
        </span>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 bg-[#030712]/30 p-2.5 rounded-xl border border-border-subtle">
          <div>
            <label className="text-[9px] text-text-muted uppercase block mb-0.5">Logement (€/m)</label>
            <input type="number" value={customHousing} onChange={e => setCustomHousing(e.target.value)} className="input text-xs mono px-2 py-1" />
          </div>
          <div>
            <label className="text-[9px] text-text-muted uppercase block mb-0.5">Nourriture (€/m)</label>
            <input type="number" value={customFood} onChange={e => setCustomFood(e.target.value)} className="input text-xs mono px-2 py-1" />
          </div>
          <div>
            <label className="text-[9px] text-text-muted uppercase block mb-0.5">Transport (€/m)</label>
            <input type="number" value={customTransport} onChange={e => setCustomTransport(e.target.value)} className="input text-xs mono px-2 py-1" />
          </div>
          <div>
            <label className="text-[9px] text-text-muted uppercase block mb-0.5">Autre/Extras (€/m)</label>
            <input type="number" value={customOther} onChange={e => setCustomOther(e.target.value)} className="input text-xs mono px-2 py-1" />
          </div>
          <div>
            <label className="text-[9px] text-text-muted uppercase block mb-0.5">Vol Aller Simple (€)</label>
            <input type="number" value={customFlight} onChange={e => setCustomFlight(e.target.value)} className="input text-xs mono px-2 py-1" />
          </div>
        </div>
        {isCustomized && (
          <button 
            onClick={resetMainCountry}
            className="btn btn-ghost border border-neon-violet/30 text-neon-violet px-3 py-1 text-[9px] cursor-pointer hover:bg-neon-violet/10 flex items-center gap-1.5 self-start transition-all"
          >
            <RotateCcw className="w-3 h-3" /> Restaurer les valeurs de base ({countryData.name})
          </button>
        )}
      </div>

      <p className="text-[11px] text-text-muted">
        Capital retenu = <span className="mono text-neon-green font-bold">{fmtNum(Math.max(0, rawCapital))} €</span>.
      </p>

      {/* Main block visualization */}
      <div className="grid grid-cols-1 gap-4">
        {/* Main block header with toggle */}
        <div className="flex items-center justify-between">
          <button
            onClick={() => setShowMainBlock(!showMainBlock)}
            className={`flex items-center gap-1.5 text-xs cursor-pointer transition-colors ${showMainBlock ? "text-neon-cyan" : "text-text-muted hover:text-neon-cyan"}`}
          >
            {showMainBlock ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            <span>{showMainBlock ? "Masquer" : "Afficher"} la destination principale</span>
          </button>
        </div>

        {showMainBlock && (() => {
          if (!countryData) return null;

          return (
            <div className={`p-6 rounded-3xl border relative overflow-hidden transition-all duration-500 hover:scale-[1.01] shadow-2xl ${
              isDead 
                ? "bg-red-950/20 border-red-500/30" 
                : "bg-gradient-to-br from-surface-card via-surface-card to-neon-cyan/10 border-neon-cyan/30"
            }`}>
              {/* Background Glow */}
              {!isDead && <div className="absolute -top-24 -right-24 w-64 h-64 bg-neon-cyan/10 blur-[100px] rounded-full" />}
              {!isDead && <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-neon-violet/10 blur-[100px] rounded-full" />}

              <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div className="space-y-4 flex-1">
                  <div className="flex items-center gap-4">
                    <span className="text-5xl">{countryData.flag}</span>
                    <div>
                      <h3 className="text-2xl font-bold text-text-primary tracking-tight">{countryData.name}</h3>
                      <p className="text-xs text-text-muted uppercase tracking-widest flex items-center gap-2">
                        <MapPin className="w-3 h-3 text-neon-cyan" /> {countryData.region}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    <div className="space-y-1">
                      <p className="text-[10px] text-text-muted uppercase">Logement</p>
                      <p className="text-sm mono text-text-primary">{fmtNum(housingVal)} €</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[10px] text-text-muted uppercase">Nourriture</p>
                      <p className="text-sm mono text-text-primary">{fmtNum(foodVal)} €</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[10px] text-text-muted uppercase">Transport</p>
                      <p className="text-sm mono text-text-primary">{fmtNum(transportVal)} €</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[10px] text-text-muted uppercase">Budget Total</p>
                      <p className="text-sm mono text-neon-cyan font-bold">{fmtNum(customMonthlyCost)} €/m</p>
                    </div>
                  </div>
                </div>

                <div className="bg-black/20 backdrop-blur-md border border-white/5 p-6 rounded-2xl text-center min-w-[200px] shadow-xl">
                  <p className="text-[11px] text-text-muted uppercase tracking-tighter mb-1">Estimation de Runway</p>
                  <div className="flex items-baseline justify-center gap-2">
                    <span className={`text-6xl font-black mono tracking-tighter ${isDead ? "text-neon-red" : "text-neon-cyan"}`}>
                      {months === Infinity ? "∞" : months}
                    </span>
                    <span className="text-lg text-text-muted font-medium">MOIS</span>
                  </div>
                  <div className="mt-4 pt-4 border-t border-white/5 flex flex-col items-center gap-1">
                    <span className="text-[10px] text-text-muted">Frais déduits (Vol + Extras)</span>
                    <span className="text-xs mono font-bold text-neon-violet">-{totalDeducted} €</span>
                  </div>
                </div>
              </div>
              
              {/* Runway Health Bar */}
              {!isDead && (
                <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/5">
                  <div 
                    className="h-full bg-gradient-to-r from-neon-cyan to-neon-violet transition-all duration-1000" 
                    style={{ width: `${Math.min(100, (months / 48) * 100)}%` }}
                  />
                </div>
              )}
            </div>
          );
        })()}

        {/* Compared countries filter + sort controls */}
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <button 
              onClick={() => setShowFilters(!showFilters)}
              className="flex items-center gap-1.5 text-xs text-text-muted hover:text-neon-cyan cursor-pointer transition-colors"
            >
              <Filter className="w-3.5 h-3.5" />
              <span>Sélectionner les pays à comparer ({checkedCountries.filter(n => n !== selectedCountryName).length})</span>
              {showFilters ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
            <div className="flex items-center gap-1.5">
              <ArrowUpDown className="w-3 h-3 text-text-muted" />
              <select
                value={sortMode}
                onChange={e => setSortMode(e.target.value)}
                className="input text-[10px] py-0.5 px-1.5 w-auto cursor-pointer bg-slate-900 border-border-subtle"
              >
                <option value="months_desc">Runway ↓ (le plus long)</option>
                <option value="months_asc">Runway ↑ (le plus court)</option>
                <option value="cost_asc">Coût ↑ (le moins cher)</option>
                <option value="cost_desc">Coût ↓ (le plus cher)</option>
                <option value="name_asc">Nom A→Z</option>
              </select>
            </div>
          </div>
          
          {showFilters && (
            <div className="flex gap-1.5 flex-wrap max-h-36 overflow-y-auto p-3 border border-border-subtle rounded-xl bg-[#030712]/40 anim-in">
              {allCountries
                .filter(loc => loc.name !== selectedCountryName)
                .map(loc => (
                  <label key={loc.name} className="flex items-center gap-1.5 text-[10px] px-2.5 py-1.5 rounded-lg bg-slate-900 border border-border-subtle cursor-pointer hover:bg-slate-800 transition-all select-none">
                    <input 
                      type="checkbox" 
                      checked={checkedCountries.includes(loc.name)} 
                      onChange={() => toggleCheckedCountry(loc.name)}
                      className="accent-neon-cyan w-3 h-3"
                    />
                    <span>{loc.flag} {loc.name}</span>
                  </label>
                ))
              }
            </div>
          )}
        </div>

        {/* Small compared country cards (sorted) */}
        {sortedCheckedCountries.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-2">
            {sortedCheckedCountries.map(loc => {
              const flight = getFlightCost(loc.name);
              const totalDeducted = flight + extras;
              const netCapital = Math.max(0, rawCapital - totalDeducted);
              const months = monthsOfRunway(netCapital, loc.monthly);
              const isDead = netCapital <= 0 || months === 0;

              return (
                <div key={loc.name} className={`p-3 rounded-xl border text-center relative overflow-hidden transition-all hover:bg-surface-hover ${isDead ? "bg-red-900/10 border-red-500/20" : "bg-surface-card border-border-subtle"}`}>
                  <div className="absolute top-1 right-1">
                    <span className="text-[7px] px-1 py-0.5 rounded bg-black/40 text-text-muted border border-white/5">✈️ -{totalDeducted}€</span>
                  </div>
                  <p className="text-xl mt-1 mb-0.5">{loc.flag}</p>
                  <p className="text-[10px] text-text-secondary truncate font-semibold">{loc.name}</p>
                  <p className={`text-xl font-bold mono mt-1 ${isDead ? "text-neon-red opacity-80" : "text-neon-cyan"}`}>{months === Infinity ? "∞" : months}</p>
                  <p className="text-[8px] text-text-muted uppercase tracking-wider">{fmtNum(loc.monthly)} €/m</p>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}



/* ── Universal Trip Estimator (fully editable) ───────────────── */
function TripEstimator() {
  const store = useStore();
  const allCountries = useMemo(() => {
    return [...COST_OF_LIVING, ...(store.customCountries || [])];
  }, [store.customCountries]);

  const [destCountryName, setDestCountryName] = useState("Japon");
  const [cfg, setCfg] = useState({ ...JAPAN_DEFAULTS });
  const set = (k, v) => setCfg(prev => ({ ...prev, [k]: v }));

  const destCountry = useMemo(() => {
    return allCountries.find(l => l.name === destCountryName) || allCountries[0];
  }, [destCountryName, allCountries]);

  // Recalculate realistic travel defaults whenever selected destination country changes
  useEffect(() => {
    if (destCountry) {
      setCfg(prev => ({
        ...prev,
        flightAdult: getFlightCost(destCountry.name),
        flightChild: Math.round(getFlightCost(destCountry.name) * 0.75),
        accomPerNight: Math.round(destCountry.housing / 7.5),
        foodAdult: Math.round(destCountry.food / 10),
        foodChild: Math.round(destCountry.food / 15),
        transportDaily: Math.round(destCountry.transport / 15),
        activitiesDaily: Math.round((destCountry.other || 150) / 10),
      }));
    }
  }, [destCountry]);

  const flights = cfg.adults * cfg.flightAdult + cfg.children * cfg.flightChild;
  const people = cfg.adults + cfg.children;
  const accom = Math.ceil(people / 2) * cfg.days * cfg.accomPerNight;
  const food = (cfg.adults * cfg.foodAdult + cfg.children * cfg.foodChild) * cfg.days;
  const transport = people * cfg.days * cfg.transportDaily;
  const activities = people * cfg.days * cfg.activitiesDaily;
  const shopping = cfg.shoppingTotal;
  const wifi = cfg.pocketWifi;
  const insurance = people * cfg.insurancePerPerson;
  const subtotal = flights + accom + food + transport + activities + shopping + wifi + insurance;
  const buffer = subtotal * (cfg.bufferPercent / 100);
  const total = subtotal + buffer;
  const perPerson = people > 0 ? total / people : 0;

  const accomTypes = { hostel: "Auberge", airbnb: "Airbnb", hotel: "Hôtel standard", premium: "Hôtel premium" };
  
  // Preset accommodation prices based dynamically on the selected country's baseline housing cost
  const accomBase = Math.round((destCountry?.housing || 700) / 7.5);
  const accomPrices = {
    hostel: Math.round(accomBase * 0.4),
    airbnb: accomBase,
    hotel: Math.round(accomBase * 1.5),
    premium: Math.round(accomBase * 2.8)
  };

  function changeAccom(type) {
    set("accomType", type);
    set("accomPerNight", accomPrices[type]);
  }

  return (
    <div className="glass p-4 space-y-4 anim-in">
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3 mb-1">
        <div className="flex items-center gap-2">
          <Plane className="w-4 h-4 text-neon-cyan" />
          <span className="text-xs uppercase tracking-widest text-text-muted">Estimateur Universel de Voyage</span>
        </div>

        {/* Destination Selector */}
        <div className="flex items-center gap-2">
          <span className="text-[10px] uppercase text-text-muted">Voyager vers :</span>
          <select 
            value={destCountryName} 
            onChange={e => setDestCountryName(e.target.value)} 
            className="input w-auto text-xs cursor-pointer py-1 px-2.5 bg-slate-900 border-border-subtle"
          >
            {allCountries.map(c => (
              <option key={c.name} value={c.name}>{c.flag} {c.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Config Travelers & Duration */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <Num label="Adultes" value={cfg.adults} onChange={v => set("adults", v)} />
        <Num label="Enfants" value={cfg.children} onChange={v => set("children", v)} />
        <Num label="Jours de voyage" value={cfg.days} onChange={v => set("days", v)} />
        <div>
          <label className="text-[10px] text-text-muted">Buffer d'imprévus %</label>
          <input type="number" value={cfg.bufferPercent} onChange={e => set("bufferPercent", parseInt(e.target.value) || 0)} className="input mono text-xs" />
        </div>
      </div>

      {/* Accommodation presets */}
      <div>
        <label className="text-[10px] text-text-muted block mb-1">Préréglages d'hébergement pour {destCountry?.name} :</label>
        <div className="flex gap-1.5 flex-wrap">
          {Object.entries(accomTypes).map(([k, label]) => (
            <button key={k} onClick={() => changeAccom(k)}
              className={`text-[10px] px-2.5 py-1 rounded-full border cursor-pointer transition-all ${
                cfg.accomType === k ? "border-neon-cyan text-neon-cyan bg-neon-cyan/10" : "border-border-subtle text-text-muted hover:text-text-secondary"
              }`}>{label} (~{accomPrices[k]}€/n)</button>
          ))}
        </div>
      </div>

      {/* Fully Editable detailed parameters */}
      <div className="space-y-1.5">
        <span className="text-[10px] uppercase tracking-wider text-text-muted block">Ajuster les tarifs de voyage (€) :</span>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 bg-[#030712]/30 p-3 rounded-xl border border-border-subtle">
          <Num label="Vol / Adulte" value={cfg.flightAdult} onChange={v => set("flightAdult", v)} />
          <Num label="Vol / Enfant" value={cfg.flightChild} onChange={v => set("flightChild", v)} />
          <Num label="Héberg. / Nuit" value={cfg.accomPerNight} onChange={v => set("accomPerNight", v)} />
          <Num label="Repas / Adulte / Jour" value={cfg.foodAdult} onChange={v => set("foodAdult", v)} />
          <Num label="Repas / Enfant / Jour" value={cfg.foodChild} onChange={v => set("foodChild", v)} />
          <Num label="Transport / Jour / Pers" value={cfg.transportDaily} onChange={v => set("transportDaily", v)} />
          <Num label="Activités / Jour / Pers" value={cfg.activitiesDaily} onChange={v => set("activitiesDaily", v)} />
          <Num label="Shopping Total" value={cfg.shoppingTotal} onChange={v => set("shoppingTotal", v)} />
          <Num label="Pocket Wifi / SIM" value={cfg.pocketWifi} onChange={v => set("pocketWifi", v)} />
          <Num label="Assurance / Pers" value={cfg.insurancePerPerson} onChange={v => set("insurancePerPerson", v)} />
        </div>
      </div>

      {/* Breakdown Row details */}
      <div className="space-y-1.5 pt-2 border-t border-border-subtle">
        <Row label={`✈️ Billets d'avion (${cfg.adults}A + ${cfg.children}E)`} value={flights} />
        <Row label={`🏨 Logement (${cfg.days} nuits)`} value={accom} />
        <Row label={`🍱 Nourriture (${cfg.days} jours)`} value={food} />
        <Row label={`🚇 Transports locaux`} value={transport} />
        <Row label={`🎌 Activités, Visites & Extras`} value={activities} />
        <Row label={`🛍️ Budget Shopping / Souvenirs`} value={shopping} />
        <Row label={`📶 Connexion Internet (SIM/Wifi)`} value={wifi} />
        <Row label={`🛡️ Assurance Voyage Obligatoire`} value={insurance} />
        <Row label={`⚡ Marge de sécurité (Buffer ${cfg.bufferPercent}%)`} value={buffer} />
        
        {/* Total Box */}
        <div className="border-t border-border-subtle pt-3 mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2 bg-gradient-to-r from-neon-cyan/5 to-neon-violet/5 p-3 rounded-xl border">
          <div>
            <p className="text-[10px] text-text-muted uppercase">Coût estimé total du voyage</p>
            <p className="text-2xl font-black mono text-neon-cyan">{fmtNum(total)} €</p>
          </div>
          <div className="sm:text-right">
            <p className="text-[10px] text-text-muted uppercase">Moyenne par personne</p>
            <p className="text-xl font-bold mono text-neon-violet">{fmtNum(perPerson)} €</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function Num({ label, value, onChange }) {
  return (
    <div>
      <label className="text-[10px] text-text-muted">{label}</label>
      <input type="number" min="0" value={value} onChange={e => onChange(parseInt(e.target.value) || 0)} className="input mono text-xs" />
    </div>
  );
}

function Row({ label, value, color = "text-text-secondary", bold }) {
  return (
    <div className="flex items-center justify-between">
      <span className={`text-xs ${bold ? "text-text-primary font-medium" : "text-text-muted"}`}>{label}</span>
      <span className={`text-sm mono ${color} ${bold ? "font-bold" : ""}`}>{fmtNum(value)} €</span>
    </div>
  );
}

/* ── Cost of Living (fully dynamic + custom countries) ────── */
function CostLiving() {
  const store = useStore();
  const allCountries = useMemo(() => {
    return [...COST_OF_LIVING, ...(store.customCountries || [])];
  }, [store.customCountries]);

  const [search, setSearch] = useState("");
  const [region, setRegion] = useState("all");
  const regions = [...new Set(allCountries.map(c => c.region))];

  // Custom country form state
  const [showAddForm, setShowAddForm] = useState(false);
  const [newCountryName, setNewCountryName] = useState("");
  const [newCountryFlag, setNewCountryFlag] = useState("🌍");
  const [newHousing, setNewHousing] = useState("");
  const [newFood, setNewFood] = useState("");
  const [newTransport, setNewTransport] = useState("");
  const [newOther, setNewOther] = useState("150");
  const [newRegion, setNewRegion] = useState("Europe de l'Ouest");

  const filtered = useMemo(() => {
    let list = allCountries;
    if (region !== "all") list = list.filter(c => c.region === region);
    if (search) { const s = search.toLowerCase(); list = list.filter(c => c.name.toLowerCase().includes(s)); }
    return list.sort((a, b) => a.monthly - b.monthly);
  }, [search, region, allCountries]);

  const handleAddCountry = (e) => {
    e.preventDefault();
    if (!newCountryName.trim()) return;

    const housing = parseFloat(newHousing) || 0;
    const food = parseFloat(newFood) || 0;
    const transport = parseFloat(newTransport) || 0;
    const other = parseFloat(newOther) || 0;
    const monthly = housing + food + transport + other;

    const newObj = {
      name: newCountryName.trim(),
      flag: newCountryFlag.trim(),
      monthly,
      food,
      housing,
      transport,
      other,
      region: newRegion
    };

    store.set("customCountries", prev => [...(prev || []), newObj]);
    
    // reset form
    setNewCountryName("");
    setNewCountryFlag("🌍");
    setNewHousing("");
    setNewFood("");
    setNewTransport("");
    setNewOther("150");
    setShowAddForm(false);
  };

  return (
    <div className="glass p-4 space-y-4 anim-in">
      <div className="flex justify-between items-center mb-1">
        <div className="flex items-center gap-2">
          <MapPin className="w-4 h-4 text-neon-violet" />
          <span className="text-xs uppercase tracking-widest text-text-muted">Comparateur coût de vie · {allCountries.length} pays</span>
        </div>

        {/* Add custom country button */}
        <button 
          onClick={() => setShowAddForm(!showAddForm)}
          className="btn btn-ghost border border-neon-cyan/20 text-neon-cyan text-[10px] px-3 py-1.5 cursor-pointer hover:bg-neon-cyan/10 flex items-center gap-1.5 transition-all"
        >
          <Plus className="w-3.5 h-3.5" /> Ajouter un pays
        </button>
      </div>

      {/* Expandable Add Custom Country Form */}
      {showAddForm && (
        <form onSubmit={handleAddCountry} className="bg-[#030712]/50 p-4 border border-dashed border-neon-cyan/30 rounded-xl space-y-3 anim-in">
          <div className="flex items-center justify-between border-b border-border-subtle pb-2">
            <span className="text-xs font-bold text-neon-cyan flex items-center gap-1.5 uppercase tracking-wider">
              <Plus className="w-4 h-4" /> Nouveau pays personnalisé
            </span>
            <button 
              type="button" 
              onClick={() => setShowAddForm(false)} 
              className="text-text-muted hover:text-white cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            <div>
              <label className="text-[10px] text-text-muted block mb-1">Nom du pays</label>
              <input 
                placeholder="Ex: Madagascar" 
                value={newCountryName} 
                onChange={e => setNewCountryName(e.target.value)} 
                className="input text-xs" 
                required 
              />
            </div>
            <div>
              <label className="text-[10px] text-text-muted block mb-1">Drapeau (Emoji)</label>
              <input 
                placeholder="Ex: 🇲🇬" 
                value={newCountryFlag} 
                onChange={e => setNewCountryFlag(e.target.value)} 
                className="input text-xs text-center mono" 
              />
            </div>
            <div>
              <label className="text-[10px] text-text-muted block mb-1">Région géographique</label>
              <select 
                value={newRegion} 
                onChange={e => setNewRegion(e.target.value)} 
                className="input text-xs cursor-pointer"
              >
                <option value="Europe de l'Ouest">Europe de l'Ouest</option>
                <option value="Amériques">Amériques</option>
                <option value="Asie du Sud-Est">Asie du Sud-Est</option>
                <option value="Asie de l'Est">Asie de l'Est</option>
                <option value="Asie du Sud">Asie du Sud</option>
                <option value="Moyen-Orient">Moyen-Orient</option>
                <option value="Afrique">Afrique</option>
                <option value="Océanie">Océanie</option>
              </select>
            </div>
            <div>
              <label className="text-[10px] text-text-muted block mb-1">Logement (€/mois)</label>
              <input 
                type="number" 
                placeholder="Ex: 350" 
                value={newHousing} 
                onChange={e => setNewHousing(e.target.value)} 
                className="input text-xs mono" 
                required 
              />
            </div>
            <div>
              <label className="text-[10px] text-text-muted block mb-1">Nourriture (€/mois)</label>
              <input 
                type="number" 
                placeholder="Ex: 180" 
                value={newFood} 
                onChange={e => setNewFood(e.target.value)} 
                className="input text-xs mono" 
                required 
              />
            </div>
            <div>
              <label className="text-[10px] text-text-muted block mb-1">Transport (€/mois)</label>
              <input 
                type="number" 
                placeholder="Ex: 80" 
                value={newTransport} 
                onChange={e => setNewTransport(e.target.value)} 
                className="input text-xs mono" 
                required 
              />
            </div>
            <div>
              <label className="text-[10px] text-text-muted block mb-1">Autres dépenses (€/mois)</label>
              <input 
                type="number" 
                placeholder="Ex: 150" 
                value={newOther} 
                onChange={e => setNewOther(e.target.value)} 
                className="input text-xs mono" 
                required 
              />
            </div>
            <div className="flex items-end">
              <button 
                type="submit" 
                className="btn btn-green w-full text-xs font-semibold cursor-pointer py-2.5"
              >
                <Check className="w-3.5 h-3.5" /> Enregistrer le pays
              </button>
            </div>
          </div>
        </form>
      )}

      {/* Search and Filters */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-text-muted" />
          <input placeholder="Rechercher un pays..." value={search} onChange={e => setSearch(e.target.value)} className="input pl-7 text-xs" />
        </div>
        <select value={region} onChange={e => setRegion(e.target.value)} className="input w-auto text-xs cursor-pointer">
          <option value="all">Toutes régions</option>
          {regions.map(r => <option key={r} value={r}>{r}</option>)}
        </select>
      </div>

      {/* Table */}
      <div className="overflow-x-auto border border-border-subtle rounded-xl bg-slate-950/20">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-text-muted border-b border-border-subtle bg-slate-900/40">
              <th className="text-left py-2.5 px-3">Pays</th>
              <th className="text-right py-2.5 px-2">Total/mois</th>
              <th className="text-right py-2.5 px-2">Logement</th>
              <th className="text-right py-2.5 px-2">Alim.</th>
              <th className="text-right py-2.5 px-2">Transport</th>
              <th className="text-right py-2.5 px-2">Autre</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(loc => (
              <tr key={loc.name} className="border-b border-border-subtle last:border-0 hover:bg-surface-hover transition-colors">
                <td className="py-2.5 px-3 text-text-primary whitespace-nowrap font-medium">{loc.flag} {loc.name}</td>
                <td className="text-right py-2.5 px-2 mono text-neon-cyan font-bold">{fmtNum(loc.monthly)} €</td>
                <td className="text-right py-2.5 px-2 mono text-text-secondary">{fmtNum(loc.housing)} €</td>
                <td className="text-right py-2.5 px-2 mono text-text-secondary">{fmtNum(loc.food)} €</td>
                <td className="text-right py-2.5 px-2 mono text-text-secondary">{fmtNum(loc.transport)} €</td>
                <td className="text-right py-2.5 px-2 mono text-text-secondary">{fmtNum(loc.other || 150)} €</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-[9px] text-text-muted text-center">{filtered.length} pays affichés · Données indicatives pour une personne</p>
    </div>
  );
}


