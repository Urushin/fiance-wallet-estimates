"use client";
import { useState, useRef, useEffect } from "react";
import { useStore } from "@/lib/store";
import { ArrowLeft, ArrowRight, Check, GripHorizontal } from "lucide-react";

export default function DraggableTabs({
  tabs = [], // [{ id, label, Icon }]
  activeId,
  onChange,
  onOrderChange,
  settingsKey, // e.g. "transactionsTabOrder"
}) {
  const store = useStore();
  const [isReorderMode, setIsReorderMode] = useState(false);
  const [draggedIdx, setDraggedIdx] = useState(null);
  const [dragOverIdx, setDragOverIdx] = useState(null);
  const longPressTimer = useRef(null);
  const isPressing = useRef(false);

  // 1. Get ordered tabs based on settings or original tabs
  const tabOrder = store?.settings?.[settingsKey] || [];
  
  // Sort original tabs according to tabOrder
  const orderedTabs = [...tabs].sort((a, b) => {
    let idxA = tabOrder.indexOf(a.id);
    let idxB = tabOrder.indexOf(b.id);
    if (idxA === -1) idxA = tabs.findIndex(t => t.id === a.id);
    if (idxB === -1) idxB = tabs.findIndex(t => t.id === b.id);
    return idxA - idxB;
  });

  // Helper to update the order
  function updateOrder(newOrder) {
    if (settingsKey && store?.setNested) {
      store.setNested("settings", settingsKey, newOrder);
    }
    if (onOrderChange) {
      onOrderChange(newOrder);
    }
  }

  // 2. HTML5 Drag & Drop handlers (PC)
  function onDragStart(e, idx) {
    if (isReorderMode) return;
    setDraggedIdx(idx);
    e.dataTransfer.effectAllowed = "move";
  }

  function onDragOver(e, idx) {
    e.preventDefault();
    if (draggedIdx === null || draggedIdx === idx) return;
    setDragOverIdx(idx);
  }

  function onDrop(e, targetIdx) {
    e.preventDefault();
    if (draggedIdx === null || draggedIdx === targetIdx) return;

    const newOrder = orderedTabs.map(t => t.id);
    const [movedId] = newOrder.splice(draggedIdx, 1);
    newOrder.splice(targetIdx, 0, movedId);

    updateOrder(newOrder);
    setDraggedIdx(null);
    setDragOverIdx(null);
  }

  function onDragEnd() {
    setDraggedIdx(null);
    setDragOverIdx(null);
  }

  // 3. Long press handlers (Mobile)
  function handlePressStart(e, id) {
    isPressing.current = true;
    longPressTimer.current = setTimeout(() => {
      if (isPressing.current) {
        setIsReorderMode(true);
        if (navigator.vibrate) {
          navigator.vibrate(60);
        }
      }
    }, 750); // 750ms for long-press
  }

  function handlePressEnd() {
    isPressing.current = false;
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
    }
  }

  // 4. Shift tabs left or right in Reorder Mode
  function shiftTab(idx, direction) {
    const targetIdx = idx + direction;
    if (targetIdx < 0 || targetIdx >= orderedTabs.length) return;

    const newOrder = orderedTabs.map(t => t.id);
    const [movedId] = newOrder.splice(idx, 1);
    newOrder.splice(targetIdx, 0, movedId);

    updateOrder(newOrder);
    
    // Pulse vibration if available
    if (navigator.vibrate) {
      navigator.vibrate(30);
    }
  }

  return (
    <div className="space-y-2">
      {/* Visual Reorder Banner Indicator */}
      {isReorderMode && (
        <div className="flex items-center justify-between px-3 py-1.5 bg-neon-cyan/10 border border-neon-cyan/20 rounded-lg anim-pulse-subtle">
          <p className="text-[10px] text-neon-cyan font-semibold flex items-center gap-1.5 uppercase tracking-wider">
            <GripHorizontal className="w-3.5 h-3.5 animate-bounce" />
            Mode Réorganisation — Clique sur les flèches
          </p>
          <button 
            onClick={() => setIsReorderMode(false)}
            className="flex items-center gap-1 text-[9px] font-bold text-neon-green bg-neon-green/10 border border-neon-green/20 px-2 py-0.5 rounded cursor-pointer hover:bg-neon-green/20"
          >
            <Check className="w-3 h-3" /> Terminer
          </button>
        </div>
      )}

      {/* Tabs container */}
      <div 
        className={`flex gap-1.5 overflow-x-auto pb-1.5 scrollbar-none transition-all duration-300 ${
          isReorderMode ? "border-b border-dashed border-neon-cyan/30 py-1" : ""
        }`}
      >
        {orderedTabs.map((t, idx) => {
          const Icon = t.Icon;
          const isActive = activeId === t.id;
          const isOver = dragOverIdx === idx;
          const isDragging = draggedIdx === idx;

          return (
            <div
              key={t.id}
              draggable={!isReorderMode}
              onDragStart={(e) => onDragStart(e, idx)}
              onDragOver={(e) => onDragOver(e, idx)}
              onDrop={(e) => onDrop(e, idx)}
              onDragEnd={onDragEnd}
              onMouseDown={(e) => handlePressStart(e, t.id)}
              onMouseUp={handlePressEnd}
              onMouseLeave={handlePressEnd}
              onTouchStart={(e) => handlePressStart(e, t.id)}
              onTouchEnd={handlePressEnd}
              className={`relative flex items-center transition-all duration-200 select-none ${
                isDragging ? "opacity-30 scale-95" : ""
              } ${isOver ? "border-2 border-dashed border-neon-cyan scale-105 rounded-xl px-1" : ""}`}
            >
              {/* Tab Button */}
              <button
                onClick={() => {
                  if (!isReorderMode && onChange) onChange(t.id);
                }}
                className={`btn text-xs whitespace-nowrap flex items-center gap-1.5 transition-all duration-250 cursor-pointer ${
                  isReorderMode
                    ? isActive
                      ? "btn-cyan border-neon-cyan/50 shadow-[0_0_12px_rgba(0,212,255,0.25)]"
                      : "btn-ghost opacity-60 border border-dashed border-slate-700"
                    : isActive
                      ? "btn-cyan shadow-[0_0_15px_-3px_rgba(0,212,255,0.4)]"
                      : "btn-ghost hover:bg-surface-hover"
                }`}
              >
                {!isReorderMode && Icon && <Icon className="w-3.5 h-3.5 text-inherit shrink-0" />}
                <span>{t.label}</span>

                {/* Show ordering arrows in reorder mode */}
                {isReorderMode && (
                  <div className="flex items-center gap-1 ml-1 border-l border-border-subtle pl-1.5">
                    {idx > 0 && (
                      <span
                        onClick={(e) => {
                          e.stopPropagation();
                          shiftTab(idx, -1);
                        }}
                        className="p-0.5 rounded bg-surface hover:bg-surface-hover text-text-muted hover:text-neon-cyan cursor-pointer transition-colors"
                      >
                        <ArrowLeft className="w-3 h-3" />
                      </span>
                    )}
                    {idx < orderedTabs.length - 1 && (
                      <span
                        onClick={(e) => {
                          e.stopPropagation();
                          shiftTab(idx, 1);
                        }}
                        className="p-0.5 rounded bg-surface hover:bg-surface-hover text-text-muted hover:text-neon-cyan cursor-pointer transition-colors"
                      >
                        <ArrowRight className="w-3 h-3" />
                      </span>
                    )}
                  </div>
                )}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
