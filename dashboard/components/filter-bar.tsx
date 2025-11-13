"use client";

import { ChangeEvent } from "react";
import { Button } from "./ui/button";
import { FilterState } from "@/lib/types";
import { cn } from "@/lib/utils";

interface FilterBarProps {
  filters: FilterState;
  sources: string[];
  onFilterChange: (next: Partial<FilterState>) => void;
  onRefresh: () => void;
}

export default function FilterBar({ filters, sources, onFilterChange, onRefresh }: FilterBarProps) {
  const handleSelect =
    (field: keyof FilterState) =>
    (event: ChangeEvent<HTMLSelectElement>) =>
      onFilterChange({ [field]: event.target.value });

  const handleInput =
    (field: keyof FilterState) =>
    (event: ChangeEvent<HTMLInputElement>) =>
      onFilterChange({ [field]: event.target.value });

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-white/10 bg-somnia-card/80 p-4 text-slate-200 shadow-soft backdrop-blur-xl md:flex-row md:items-end md:justify-between">
      <div className="grid w-full grid-cols-1 gap-3 md:grid-cols-3">
        <label className="flex flex-col text-xs font-medium text-slate-300">
          Search
          <input
            value={filters.search}
            onChange={handleInput("search")}
            placeholder="Pair or token"
            className={cn(
              "mt-1 w-full rounded-lg border border-white/10 bg-somnia-surface/60 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 shadow-sm focus:border-somnia-primary focus:outline-none focus:ring-2 focus:ring-somnia-primary/40"
            )}
          />
        </label>

        <label className="flex flex-col text-xs font-medium text-slate-300">
          Source
          <select
            value={filters.source}
            onChange={handleSelect("source")}
            className="mt-1 w-full rounded-lg border border-white/10 bg-somnia-surface/60 px-3 py-2 text-sm text-slate-100 shadow-sm focus:border-somnia-primary focus:outline-none focus:ring-2 focus:ring-somnia-primary/40"
          >
            <option value="">All sources</option>
            {sources.map((source) => (
              <option key={source} value={source}>
                {source}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col text-xs font-medium text-slate-300">
          Minimum change (%)
          <input
            type="number"
            min={0}
            max={500}
            value={filters.minChangePercent}
            onChange={(event) => onFilterChange({ minChangePercent: Number(event.target.value) })}
            className="mt-1 w-full rounded-lg border border-white/10 bg-somnia-surface/60 px-3 py-2 text-sm text-slate-100 shadow-sm focus:border-somnia-primary focus:outline-none focus:ring-2 focus:ring-somnia-primary/40"
          />
        </label>
      </div>
      <Button className="w-full md:w-auto" onClick={onRefresh}>
        Refresh Data
      </Button>
    </div>
  );
}
