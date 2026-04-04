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
import {
  PieChart,
  Pie,
  Cell,
  Legend,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { Button } from "../components/ui/button.js";
import { Input } from "../components/ui/input.js";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card.js";
import api from "../lib/api.js";

type Owner = "Alex" | "Casey" | "Joint";

interface Category {
  id: string;
  name: string;
  color: string;
}

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
}

interface Summary {
  alexIn: number;
  caseyIn: number;
  jointExpenses: number;
  alexPersonal: number;
  potBalance: number;
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
  if (name === "Alex Ignore") return "ALEX IGNORE";
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

  const isIgnored = tx.category.name === "Alex Ignore";

  return (
    <div ref={ref} className="relative inline-block">
      <span
        onClick={() => setOpen((o) => !o)}
        className={`cursor-pointer px-2 py-0.5 rounded-full text-xs font-medium border hover:opacity-80 ${
          isIgnored ? "text-red-500 border-red-500" : ""
        }`}
        style={isIgnored ? undefined : { color: tx.category.color, borderColor: tx.category.color }}
        title="Click to change category"
      >
        {categoryLabel(tx.category.name)}
      </span>
      {open && (
        <div className="absolute z-50 top-full mt-1 left-0 bg-popover border border-border rounded-md shadow-lg py-1 min-w-[150px]">
          {categories.map((c) => {
            const isOpt = c.name === "Alex Ignore";
            return (
              <div
                key={c.id}
                onClick={() => { onSave(c.id); setOpen(false); }}
                className="px-2 py-1 cursor-pointer hover:bg-accent"
              >
                <span
                  className={`px-2 py-0.5 rounded-full text-xs font-medium border ${
                    isOpt ? "text-red-500 border-red-500" : ""
                  }`}
                  style={isOpt ? undefined : { color: c.color, borderColor: c.color }}
                >
                  {categoryLabel(c.name)}
                </span>
              </div>
            );
          })}
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

export function DashboardPage() {
  const queryClient = useQueryClient();
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState<"" | "Income" | "Expense">("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [ownerFilter, setOwnerFilter] = useState<"" | Owner>("");
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
    queryKey: ["transactions", typeFilter, categoryFilter, ownerFilter],
    queryFn: () => {
      const params = new URLSearchParams();
      if (typeFilter) params.set("type", typeFilter);
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

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Clam Finance Tracker</h1>
        <p className="text-sm text-muted-foreground uppercase tracking-wide mt-1">
          Track your income and expenses
        </p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-4">
        <Card className="border-blue-200 dark:border-blue-900">
          <CardHeader className="pb-1">
            <CardTitle className="text-xs uppercase tracking-wide text-muted-foreground">Alex Bank Sauce</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-blue-500">{summary ? fmt(summary.alexIn) : "—"}</p>
            {summary && summary.alexPersonal > 0 && (
              <p className="text-xs text-muted-foreground mt-1">
                {fmt(summary.alexPersonal)} personal · net {fmt(summary.alexIn - summary.alexPersonal)}
              </p>
            )}
          </CardContent>
        </Card>
        <Card className="border-pink-200 dark:border-pink-900">
          <CardHeader className="pb-1">
            <CardTitle className="text-xs uppercase tracking-wide text-muted-foreground">Casey Bank Sauce</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-pink-500">{summary ? fmt(summary.caseyIn) : "—"}</p>
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
        <Card className="border-purple-200 dark:border-purple-900">
          <CardHeader className="pb-1">
            <CardTitle className="text-xs uppercase tracking-wide text-muted-foreground">Pot Balance</CardTitle>
          </CardHeader>
          <CardContent>
            <p className={`text-3xl font-bold ${summary && summary.potBalance >= 0 ? "text-purple-500" : "text-red-500"}`}>
              {summary ? fmt(summary.potBalance) : "—"}
            </p>
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

      {/* Pie chart — joint expenses only */}
      {summary && summary.spendingByCategory.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs uppercase tracking-wide text-muted-foreground">
              Joint Spending by Category
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={summary.spendingByCategory}
                  dataKey="value"
                  nameKey="name"
                  cx="38%"
                  innerRadius={75}
                  outerRadius={125}
                  paddingAngle={2}
                >
                  {summary.spendingByCategory.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip formatter={(v) => fmt(v as number)} />
                <Legend
                  layout="vertical"
                  align="right"
                  verticalAlign="middle"
                  wrapperStyle={{ paddingLeft: "24px", lineHeight: "1.8" }}
                />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Transactions list */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-xs uppercase tracking-wide text-muted-foreground">
            Transactions
          </CardTitle>
        </CardHeader>
        <CardContent>
          {/* Filters */}
          <div className="flex flex-wrap gap-2 mb-4">
            <Button variant={typeFilter === "" ? "default" : "outline"} size="sm" onClick={() => setTypeFilter("")}>All Types</Button>
            <Button variant={typeFilter === "Income" ? "default" : "outline"} size="sm" onClick={() => setTypeFilter("Income")}>Income</Button>
            <Button variant={typeFilter === "Expense" ? "default" : "outline"} size="sm" onClick={() => setTypeFilter("Expense")}>Expense</Button>
            <span className="border-l border-border mx-1" />
            <Button variant={ownerFilter === "" ? "default" : "outline"} size="sm" onClick={() => setOwnerFilter("")}>All</Button>
            <Button variant={ownerFilter === "Joint" ? "default" : "outline"} size="sm" onClick={() => setOwnerFilter(ownerFilter === "Joint" ? "" : "Joint")}>Joint</Button>
            <Button variant={ownerFilter === "Alex" ? "default" : "outline"} size="sm" onClick={() => setOwnerFilter(ownerFilter === "Alex" ? "" : "Alex")}>Alex</Button>
            <Button variant={ownerFilter === "Casey" ? "default" : "outline"} size="sm" onClick={() => setOwnerFilter(ownerFilter === "Casey" ? "" : "Casey")}>Casey</Button>
            <span className="border-l border-border mx-1" />
            <Button variant={categoryFilter === "" ? "default" : "outline"} size="sm" onClick={() => setCategoryFilter("")}>All Categories</Button>
            {categories.map((c) => (
              <Button
                key={c.id}
                variant={categoryFilter === c.id ? "default" : "outline"}
                size="sm"
                onClick={() => setCategoryFilter(categoryFilter === c.id ? "" : c.id)}
              >
                {categoryLabel(c.name)}
              </Button>
            ))}
          </div>

          <table className="w-full text-sm">
            <thead>
              <tr className="text-muted-foreground uppercase text-xs border-b">
                <th className="text-left py-2 pr-4">Date</th>
                <th className="text-left py-2 pr-4">Description</th>
                <th className="text-left py-2 pr-4">Note</th>
                <th className="text-left py-2 pr-4">Category</th>
                <th className="text-left py-2 pr-4">Owner</th>
                <th className="text-left py-2">Amount</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {transactions.map((t) => (
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
