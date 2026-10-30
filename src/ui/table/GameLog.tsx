"use client";

import { useEffect, useRef } from "react";
import type { LogEntry } from "../store/gameStore";

const TONE: Record<LogEntry["tone"], string> = {
  turn: "mt-2 font-bold text-amber-300",
  attack: "text-orange-300",
  damage: "text-red-400",
  heal: "text-emerald-400",
  death: "font-bold text-red-500",
  info: "text-stone-300",
  end: "mt-2 font-bold text-amber-400",
};

export function GameLog({ log, className = "" }: { log: LogEntry[]; className?: string }) {
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => {
    end.current?.scrollIntoView({ block: "end" });
  }, [log.length]);
  return (
    <div className={`overflow-y-auto rounded border border-stone-700 bg-stone-900/90 p-2 text-xs leading-relaxed ${className}`} data-testid="game-log">
      {log.map((entry) => (
        <div key={entry.id} className={TONE[entry.tone]}>
          {entry.text}
        </div>
      ))}
      <div ref={end} />
    </div>
  );
}
