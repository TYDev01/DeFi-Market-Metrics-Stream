"use client";

import { ChangeEvent } from "react";
import { Button } from "./ui/button";
import { FilterState } from "@/lib/types";
import { cn } from "@/lib/utils";

interface FilterBarProps {
  filters: FilterState;
  protocols: string[];
  networks: string[];
  onFilterChange: (next: Partial<FilterState>) => void;
  onRefresh: () => void;
}

export default function FilterBar({ filters, protocols, networks, onFilterChange, onRefresh }: FilterBarProps) {
  const handleSelect =
    (field: keyof FilterState) =>
    (event: ChangeEvent<HTMLSelectElement>) =>
      onFilterChange({ [field]: event.target.value });

  const handleInput =
    (field: keyof FilterState) =>
    (event: ChangeEvent<HTMLInputElement>) =>
      onFilterChange({ [field]: event.target.value });

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-soft md:flex-row md:items-end md:justify-between">
      <div className="grid w-full grid-cols-1 gap-3 md:grid-cols-4">
        <label className="flex flex-col text-xs font-medium text-slate-600">
          Search
          <input
            value={filters.search}
            onChange={handleInput("search")}
            placeholder="Pool or token"
            className={cn(
              "mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm focus:border-somnia-primary focus:outline-none focus:ring-2 focus:ring-somnia-primary/40"
            )}
          />
        </label>

        <label className="flex flex-col text-xs font-medium text-slate-600">
          Protocol
          <select
            value={filters.protocol}
            onChange={handleSelect("protocol")}
            className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm focus:border-somnia-primary focus:outline-none focus:ring-2 focus:ring-somnia-primary/40"
          >
            <option value="">All</option>
            {protocols.map((protocol) => (
              <option key={protocol} value={protocol}>
                {protocol}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col text-xs font-medium text-slate-600">
          Network
          <select
            value={filters.network}
            onChange={handleSelect("network")}
            className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm focus:border-somnia-primary focus:outline-none focus:ring-2 focus:ring-somnia-primary/40"
          >
            <option value="">All</option>
            {networks.map((network) => (
              <option key={network} value={network}>
                {network}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col text-xs font-medium text-slate-600">
          Minimum APR (%)
          <input
            type="number"
            min={0}
            max={200}
            value={filters.minAprPercent}
            onChange={(event) => onFilterChange({ minAprPercent: Number(event.target.value) })}
            className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm focus:border-somnia-primary focus:outline-none focus:ring-2 focus:ring-somnia-primary/40"
          />
        </label>
      </div>
      <Button className="w-full md:w-auto" onClick={onRefresh}>
        Refresh Data
      </Button>
    </div>
  );
}
