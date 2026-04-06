import { useEffect, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../components/ui/alert-dialog.js";
import { Button } from "../components/ui/button.js";
import { Input } from "../components/ui/input.js";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card.js";
import { Popover, PopoverContent, PopoverTrigger } from "../components/ui/popover.js";
import { Command, CommandGroup, CommandItem, CommandList } from "../components/ui/command.js";
import api from "../lib/api.js";

type Owner = "Alex" | "Casey" | "Joint";

interface Category {
  id: string;
  name: string;
  color: string;
}

type BankSource = "Monzo" | "Amex" | "Barclays" | "Santander" | "Manual";

interface Transaction {
  id: string;
  description: string;
  note: string | null;
  amount: string;
  type: "Income" | "Expense";
  date: string;
  category: Category;
  categoryId: string;
  owner: Owner;
  externalId: string | null;
}

function bankSource(externalId: string | null): BankSource {
  if (!externalId) return "Manual";
  if (externalId.startsWith("monzo:")) return "Monzo";
  if (externalId.startsWith("amex:")) return "Amex";
  if (externalId.startsWith("barclays:")) return "Barclays";
  if (externalId.startsWith("santander:")) return "Santander";
  return "Manual";
}

const SOURCE_STYLES: Record<BankSource, string> = {
  Monzo:     "text-orange-500 border-orange-500",
  Amex:      "text-blue-500 border-blue-500",
  Barclays:  "text-sky-500 border-sky-500",
  Santander: "text-red-500 border-red-500",
  Manual:    "text-muted-foreground border-muted-foreground/40",
};

interface Summary {
  caseyIn: number;
  jointExpenses: number;
  settlement: number;
  spendingByCategory: { name: string; color: string; value: number }[];
}

// Inline note editor — click to edit, Enter/blur to save, Escape to cancel
function NoteCell({ tx, onSave }: { tx: Transaction; onSave: (note: string | null) => void }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(tx.note ?? "");
  const inputRef = useRef<HTMLInputElement>(null);

  function commit() {
    setEditing(false);
    const trimmed = value.trim();
    const next = trimmed === "" ? null : trimmed;
    if (next !== tx.note) onSave(next);
  }

  function start() {
    setValue(tx.note ?? "");
    setEditing(true);
    setTimeout(() => inputRef.current?.focus(), 0);
  }

  if (editing) {
    return (
      <input
        ref={inputRef}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit();
          if (e.key === "Escape") { setValue(tx.note ?? ""); setEditing(false); }
        }}
        className="w-full bg-transparent border-b border-primary outline-none text-sm py-0.5"
      />
    );
  }

  return (
    <span
      onClick={start}
      className="cursor-pointer text-sm group"
      title="Click to add note"
    >
      {tx.note
        ? <span>{tx.note}</span>
        : <span className="text-muted-foreground/40 group-hover:text-muted-foreground italic">Add note…</span>
      }
    </span>
  );
}

function categoryLabel(name: string) {
  return name;
}

// Inline category selector — custom dropdown with coloured pill labels
function CategoryCell({
  tx,
  categories,
  onSave,
}: {
  tx: Transaction;
  categories: Category[];
  onSave: (categoryId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  return (
    <div ref={ref} className="relative inline-block">
      <span
        onClick={() => setOpen((o) => !o)}
        className="cursor-pointer px-2 py-0.5 rounded-full text-xs font-medium border hover:opacity-80"
        style={{ color: tx.category.color, borderColor: tx.category.color }}
        title="Click to change category"
      >
        {tx.category.name}
      </span>
      {open && (
        <div className="absolute z-50 top-full mt-1 left-0 bg-popover border border-border rounded-md shadow-lg py-1 min-w-[150px]">
          {categories.map((c) => (
            <div
              key={c.id}
              onClick={() => { onSave(c.id); setOpen(false); }}
              className="px-2 py-1 cursor-pointer hover:bg-accent"
            >
              <span
                className="px-2 py-0.5 rounded-full text-xs font-medium border"
                style={{ color: c.color, borderColor: c.color }}
              >
                {c.name}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const OWNER_STYLES: Record<Owner, string> = {
  Alex:  "text-blue-500 border-blue-500",
  Casey: "text-pink-500 border-pink-500",
  Joint: "text-muted-foreground border-muted-foreground/40",
};

// Inline owner selector
function OwnerCell({ tx, onSave }: { tx: Transaction; onSave: (owner: Owner) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  return (
    <div ref={ref} className="relative inline-block">
      <span
        onClick={() => setOpen((o) => !o)}
        className={`cursor-pointer px-2 py-0.5 rounded-full text-xs font-medium border hover:opacity-80 ${OWNER_STYLES[tx.owner]}`}
        title="Click to change owner"
      >
        {tx.owner}
      </span>
      {open && (
        <div className="absolute z-50 top-full mt-1 left-0 bg-popover border border-border rounded-md shadow-lg py-1 min-w-[100px]">
          {(["Alex", "Casey", "Joint"] as Owner[]).map((o) => (
            <div
              key={o}
              onClick={() => { onSave(o); setOpen(false); }}
              className="px-2 py-1 cursor-pointer hover:bg-accent"
            >
              <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${OWNER_STYLES[o]}`}>
                {o}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Typeahead filter — keyboard nav via arrow keys; only commits on click or Enter
function TypeaheadFilter({
  value,
  suggestions,
  onChange,
}: {
  value: string;
  suggestions: string[];
  onChange: (v: string) => void;
}) {
  const [pending, setPending] = useState(value);
  const [open, setOpen] = useState(false);
  const [cursor, setCursor] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => { if (!value) setPending(""); }, [value]);

  const matches = pending
    ? suggestions.filter((s) => s.toLowerCase().includes(pending.toLowerCase())).slice(0, 8)
    : [];

  useEffect(() => {
    if (!open) return;
    function handle(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [open]);

  function commit(v: string) {
    setPending(v);
    onChange(v);
    setOpen(false);
    setCursor(-1);
  }

  return (
    <div ref={containerRef} className="relative">
      <Input
        value={pending}
        placeholder="Filter…"
        onChange={(e) => { setPending(e.target.value); setOpen(true); setCursor(-1); }}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") { e.preventDefault(); setCursor((c) => Math.min(c + 1, matches.length - 1)); }
          if (e.key === "ArrowUp") { e.preventDefault(); setCursor((c) => Math.max(c - 1, -1)); }
          if (e.key === "Enter") { e.preventDefault(); cursor >= 0 ? commit(matches[cursor]) : commit(pending); }
          if (e.key === "Escape") { setPending(""); onChange(""); setOpen(false); setCursor(-1); }
        }}
        onFocus={() => { if (pending) setOpen(true); }}
        className="h-7 text-xs px-2"
      />
      {open && matches.length > 0 && (
        <div className="absolute z-50 top-full mt-0.5 left-0 right-0 bg-popover border border-border rounded-md shadow-md">
          <Command shouldFilter={false}>
            <CommandList>
              <CommandGroup>
                {matches.map((m, i) => (
                  <CommandItem
                    key={m}
                    value={m}
                    data-selected={i === cursor ? "true" : undefined}
                    onSelect={() => commit(m)}
                    onMouseEnter={() => setCursor(i)}
                    className="text-xs truncate"
                  >
                    {m}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </div>
      )}
    </div>
  );
}

// Pill dropdown built on Popover — reused by Category and Owner filters
function PillDropdownFilter<T extends string>({
  value,
  options,
  allLabel = "All",
  getLabel,
  getStyle,
  onChange,
}: {
  value: T | "";
  options: T[];
  allLabel?: string;
  getLabel: (v: T) => string;
  getStyle: (v: T) => string;
  onChange: (v: T | "") => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <div className="flex items-center gap-1 w-full text-xs bg-muted/40 border border-border/50 rounded px-2 py-1 cursor-pointer hover:border-primary/50 min-h-[28px]">
          {value ? (
            <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${getStyle(value as T)}`}>
              {getLabel(value as T)}
            </span>
          ) : (
            <span className="text-muted-foreground/50">{allLabel}</span>
          )}
          <span className="ml-auto text-muted-foreground/40 text-[10px]">▾</span>
        </div>
      </PopoverTrigger>
      <PopoverContent className="p-0 w-[--radix-popover-trigger-width]" align="start">
        <Command>
          <CommandList>
            <CommandGroup>
              <CommandItem value="" onSelect={() => { onChange(""); setOpen(false); }} className="text-xs text-muted-foreground/60">
                {allLabel}
              </CommandItem>
              {options.map((o) => (
                <CommandItem key={o} value={o} onSelect={() => { onChange(o); setOpen(false); }} className="text-xs">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${getStyle(o)}`}>
                    {getLabel(o)}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

// Category filter — colored pills via inline style
function CategoryFilter({ value, categories, onChange }: { value: string; categories: Category[]; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  const selected = categories.find((c) => c.id === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <div className="flex items-center gap-1 w-full text-xs bg-muted/40 border border-border/50 rounded px-2 py-1 cursor-pointer hover:border-primary/50 min-h-[28px]">
          {selected ? (
            <span className="px-2 py-0.5 rounded-full text-xs font-medium border" style={{ color: selected.color, borderColor: selected.color }}>
              {selected.name}
            </span>
          ) : (
            <span className="text-muted-foreground/50">All</span>
          )}
          <span className="ml-auto text-muted-foreground/40 text-[10px]">▾</span>
        </div>
      </PopoverTrigger>
      <PopoverContent className="p-0 w-[--radix-popover-trigger-width]" align="start">
        <Command shouldFilter={false}>
          <CommandList>
            <CommandGroup>
              <CommandItem value="" onSelect={() => { onChange(""); setOpen(false); }} className="text-xs text-muted-foreground/60">All</CommandItem>
              {categories.map((c) => (
                <CommandItem key={c.id} value={c.id} onSelect={() => { onChange(c.id); setOpen(false); }} className="text-xs">
                  <span className="px-2 py-0.5 rounded-full text-xs font-medium border" style={{ color: c.color, borderColor: c.color }}>
                    {c.name}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

// Owner filter — colored pills using OWNER_STYLES
function OwnerFilter({ value, onChange }: { value: "" | Owner; onChange: (v: "" | Owner) => void }) {
  return (
    <PillDropdownFilter<Owner>
      value={value}
      options={["Alex", "Casey", "Joint"]}
      getLabel={(o) => o}
      getStyle={(o) => OWNER_STYLES[o]}
      onChange={onChange}
    />
  );
}

export function DashboardPage() {
  const queryClient = useQueryClient();
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [categoryFilter, setCategoryFilter] = useState("");
  const [ownerFilter, setOwnerFilter] = useState<"" | Owner>("");
  const [sourceFilter, setSourceFilter] = useState<"" | BankSource>("");
  const [colFilters, setColFilters] = useState({ date: "", description: "", note: "", amount: "" });
  const [form, setForm] = useState({
    description: "",
    amount: "",
    type: "Expense" as "Income" | "Expense",
    categoryId: "",
  });

  const { data: summary } = useQuery<Summary>({
    queryKey: ["summary"],
    queryFn: () => api.get("/api/dashboard/summary").then((r) => r.data),
  });

  const { data: categories = [] } = useQuery<Category[]>({
    queryKey: ["categories"],
    queryFn: () => api.get("/api/categories").then((r) => r.data),
  });

  const { data: transactions = [] } = useQuery<Transaction[]>({
    queryKey: ["transactions", categoryFilter, ownerFilter],
    queryFn: () => {
      const params = new URLSearchParams();
      if (categoryFilter) params.set("categoryId", categoryFilter);
      if (ownerFilter) params.set("owner", ownerFilter);
      return api.get(`/api/transactions?${params}`).then((r) => r.data);
    },
  });

  useEffect(() => {
    if (categories.length > 0 && !form.categoryId) {
      setForm((f) => ({ ...f, categoryId: categories[0].id }));
    }
  }, [categories, form.categoryId]);

  const addMutation = useMutation({
    mutationFn: (data: { description: string; amount: number; type: string; categoryId: string }) =>
      api.post("/api/transactions", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["summary"] });
      setForm((f) => ({ ...f, description: "", amount: "" }));
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, ...data }: { id: string; note?: string | null; categoryId?: string; owner?: Owner }) =>
      api.patch(`/api/transactions/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["summary"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/api/transactions/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["summary"] });
    },
  });

  function handleAdd() {
    if (!form.description || !form.amount || !form.categoryId) return;
    addMutation.mutate({
      description: form.description,
      amount: parseFloat(form.amount),
      type: form.type,
      categoryId: form.categoryId,
    });
  }

  const fmt = (n: number) =>
    new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(n);

  const descSuggestions = [...new Set(transactions.map((t) => t.description))].sort();
  const noteSuggestions = [...new Set(transactions.flatMap((t) => t.note ? [t.note] : []))].sort();

  const filteredTransactions = transactions.filter((t) => {
    const dateStr = new Date(t.date).toISOString().slice(0, 10);
    if (colFilters.date && !dateStr.includes(colFilters.date)) return false;
    if (colFilters.description && !t.description.toLowerCase().includes(colFilters.description.toLowerCase())) return false;
    if (colFilters.note && !(t.note ?? "").toLowerCase().includes(colFilters.note.toLowerCase())) return false;
    if (colFilters.amount && !Math.abs(parseFloat(t.amount)).toFixed(2).includes(colFilters.amount)) return false;
    if (sourceFilter && bankSource(t.externalId) !== sourceFilter) return false;
    return true;
  });

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Clam Finance Tracker</h1>
        <p className="text-sm text-muted-foreground uppercase tracking-wide mt-1">
          Track your income and expenses
        </p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="border-green-200 dark:border-green-900">
          <CardHeader className="pb-1">
            <CardTitle className="text-xs uppercase tracking-wide text-muted-foreground">Casey Monzo Sauce</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-green-500">{summary ? fmt(summary.caseyIn) : "—"}</p>
          </CardContent>
        </Card>
        <Card className="border-red-200 dark:border-red-900">
          <CardHeader className="pb-1">
            <CardTitle className="text-xs uppercase tracking-wide text-muted-foreground">Joint Expenses</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-red-500">{summary ? fmt(summary.jointExpenses) : "—"}</p>
          </CardContent>
        </Card>
        <Card className="border-violet-300 dark:border-violet-800">
          <CardHeader className="pb-1">
            <CardTitle className="text-xs uppercase tracking-wide text-muted-foreground">Settlement</CardTitle>
          </CardHeader>
          <CardContent>
            {summary ? (
              summary.settlement < -0.005 ? (
                <>
                  <p className="text-3xl font-bold text-violet-400">{fmt(Math.abs(summary.settlement))}</p>
                  <p className="text-xs text-muted-foreground mt-1">Casey owes pot</p>
                </>
              ) : summary.settlement > 0.005 ? (
                <>
                  <p className="text-3xl font-bold text-violet-400">{fmt(summary.settlement)}</p>
                  <p className="text-xs text-muted-foreground mt-1">Alex owes Casey</p>
                </>
              ) : (
                <>
                  <p className="text-3xl font-bold text-violet-400">All square</p>
                  <p className="text-xs text-muted-foreground mt-1">&nbsp;</p>
                </>
              )
            ) : "—"}
          </CardContent>
        </Card>
      </div>

      {/* Add transaction */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-xs uppercase tracking-wide text-muted-foreground">
            Add Transaction
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Input
              placeholder="Description"
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              className="flex-2"
            />
            <Input
              placeholder="Amount"
              type="number"
              min="0"
              step="0.01"
              value={form.amount}
              onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
              className="w-32"
            />
            <select
              value={form.type}
              onChange={(e) => setForm((f) => ({ ...f, type: e.target.value as "Income" | "Expense" }))}
              className="border border-input bg-background text-foreground rounded-md px-3 py-2 text-sm"
            >
              <option value="Expense">Expense</option>
              <option value="Income">Income</option>
            </select>
            <select
              value={form.categoryId}
              onChange={(e) => setForm((f) => ({ ...f, categoryId: e.target.value }))}
              className="border border-input bg-background text-foreground rounded-md px-3 py-2 text-sm"
            >
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            <Button onClick={handleAdd} disabled={addMutation.isPending} className="bg-blue-500 hover:bg-blue-600 text-white">
              Add
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Transactions list */}
      <Card>
        <CardHeader className="pb-2 flex flex-row items-center justify-between">
          <CardTitle className="text-xs uppercase tracking-wide text-muted-foreground">
            Transactions
          </CardTitle>
          <Button
            variant="outline"
            size="sm"
            className="text-xs text-muted-foreground hover:text-foreground"
            disabled={!categoryFilter && !ownerFilter && !sourceFilter && !colFilters.date && !colFilters.description && !colFilters.note && !colFilters.amount}
            onClick={() => {
              setCategoryFilter("");
              setOwnerFilter("");
              setSourceFilter("");
              setColFilters({ date: "", description: "", note: "", amount: "" });
            }}
          >
            Clear filters
          </Button>
        </CardHeader>
        <CardContent>
          <div className="min-h-[500px]">
          <table className="w-full text-sm table-fixed">
            <thead>
              <tr className="text-muted-foreground uppercase text-xs border-b border-border/60">
                <th className="text-left py-2 pr-4 w-[9%]">Date</th>
                <th className="text-left py-2 pr-4 w-[19%]">Description</th>
                <th className="text-left py-2 pr-4 w-[16%]">Note</th>
                <th className="text-left py-2 pr-4 w-[15%]">Category</th>
                <th className="text-left py-2 pr-4 w-[9%]">Owner</th>
                <th className="text-left py-2 pr-4 w-[9%]">Source</th>
                <th className="text-left py-2 w-[11%]">Amount</th>
                <th className="w-[12%]" />
              </tr>
              <tr className="border-b border-border">
                <td className="pr-2 pb-1.5 pt-1">
                  <input
                    type="text"
                    placeholder="Filter…"
                    value={colFilters.date}
                    onChange={(e) => setColFilters((f) => ({ ...f, date: e.target.value }))}
                    className="w-full text-xs bg-muted/40 border border-border/50 rounded px-2 py-1 outline-none focus:border-primary/50 placeholder:text-muted-foreground/40"
                  />
                </td>
                <td className="pr-2 pb-1.5 pt-1">
                  <TypeaheadFilter
                    value={colFilters.description}
                    suggestions={descSuggestions}
                    onChange={(v) => setColFilters((f) => ({ ...f, description: v }))}
                  />
                </td>
                <td className="pr-2 pb-1.5 pt-1">
                  <TypeaheadFilter
                    value={colFilters.note}
                    suggestions={noteSuggestions}
                    onChange={(v) => setColFilters((f) => ({ ...f, note: v }))}
                  />
                </td>
                <td className="pr-2 pb-1.5 pt-1">
                  <CategoryFilter
                    value={categoryFilter}
                    categories={categories}
                    onChange={setCategoryFilter}
                  />
                </td>
                <td className="pr-2 pb-1.5 pt-1">
                  <OwnerFilter value={ownerFilter} onChange={setOwnerFilter} />
                </td>
                <td className="pr-2 pb-1.5 pt-1">
                  <PillDropdownFilter<BankSource>
                    value={sourceFilter}
                    options={["Monzo", "Amex", "Barclays", "Santander", "Manual"]}
                    allLabel="All"
                    getLabel={(s) => s}
                    getStyle={(s) => SOURCE_STYLES[s]}
                    onChange={setSourceFilter}
                  />
                </td>
                <td className="pb-1.5 pt-1 pr-2">
                  <input
                    type="text"
                    placeholder="Filter…"
                    value={colFilters.amount}
                    onChange={(e) => setColFilters((f) => ({ ...f, amount: e.target.value }))}
                    className="w-full text-xs bg-muted/40 border border-border/50 rounded px-2 py-1 outline-none focus:border-primary/50 placeholder:text-muted-foreground/40"
                  />
                </td>
              </tr>
            </thead>
            <tbody>
              {filteredTransactions.map((t) => (
                <tr key={t.id} className="border-b last:border-0">
                  <td className="py-3 pr-4 text-muted-foreground whitespace-nowrap">
                    {new Date(t.date).toISOString().slice(0, 10)}
                  </td>
                  <td className="py-3 pr-4 max-w-[180px] truncate" title={t.description}>
                    {t.description}
                  </td>
                  <td className="py-3 pr-4 min-w-[140px]">
                    <NoteCell tx={t} onSave={(note) => updateMutation.mutate({ id: t.id, note })} />
                  </td>
                  <td className="py-3 pr-4">
                    <CategoryCell tx={t} categories={categories} onSave={(categoryId) => updateMutation.mutate({ id: t.id, categoryId })} />
                  </td>
                  <td className="py-3 pr-4">
                    <OwnerCell tx={t} onSave={(owner) => updateMutation.mutate({ id: t.id, owner })} />
                  </td>
                  <td className="py-3 pr-4">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${SOURCE_STYLES[bankSource(t.externalId)]}`}>
                      {bankSource(t.externalId)}
                    </span>
                  </td>
                  <td className={`py-3 font-semibold whitespace-nowrap ${t.type === "Income" ? "text-green-500" : "text-red-500"}`}>
                    {t.type === "Income" ? "+" : "-"}{fmt(Math.abs(parseFloat(t.amount)))}
                  </td>
                  <td className="py-3 text-right">
                    <Button variant="outline" size="sm" disabled={deleteMutation.isPending} onClick={() => setPendingDeleteId(t.id)}>
                      Delete
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </CardContent>
      </Card>

      <AlertDialog open={!!pendingDeleteId} onOpenChange={(open) => !open && setPendingDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete transaction?</AlertDialogTitle>
            <AlertDialogDescription>This action cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-500 hover:bg-red-600 text-white focus:ring-red-500"
              onClick={() => {
                if (pendingDeleteId) deleteMutation.mutate(pendingDeleteId);
                setPendingDeleteId(null);
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
