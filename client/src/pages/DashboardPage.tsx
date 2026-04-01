import { useCallback, useEffect, useState } from "react";
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

interface Category {
  id: string;
  name: string;
  color: string;
}

interface Transaction {
  id: string;
  description: string;
  amount: string;
  type: "Income" | "Expense";
  date: string;
  category: Category;
  categoryId: string;
}

interface Summary {
  income: number;
  expenses: number;
  balance: number;
  spendingByCategory: { name: string; color: string; value: number }[];
}

export function DashboardPage() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [typeFilter, setTypeFilter] = useState<"" | "Income" | "Expense">("");
  const [categoryFilter, setCategoryFilter] = useState("");

  const [form, setForm] = useState({
    description: "",
    amount: "",
    type: "Expense" as "Income" | "Expense",
    categoryId: "",
  });

  const fetchSummary = useCallback(async () => {
    const res = await fetch("/api/dashboard/summary");
    if (res.ok) setSummary(await res.json());
  }, []);

  const fetchTransactions = useCallback(async () => {
    const params = new URLSearchParams();
    if (typeFilter) params.set("type", typeFilter);
    if (categoryFilter) params.set("categoryId", categoryFilter);
    const res = await fetch(`/api/transactions?${params}`);
    if (res.ok) setTransactions(await res.json());
  }, [typeFilter, categoryFilter]);

  useEffect(() => {
    fetch("/api/categories")
      .then((r) => r.json())
      .then((data: Category[]) => {
        setCategories(data);
        if (data.length > 0) {
          setForm((f) => ({ ...f, categoryId: data[0].id }));
        }
      });
    fetchSummary();
  }, [fetchSummary]);

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  async function handleAdd() {
    if (!form.description || !form.amount || !form.categoryId) return;
    const res = await fetch("/api/transactions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        description: form.description,
        amount: parseFloat(form.amount),
        type: form.type,
        categoryId: form.categoryId,
      }),
    });
    if (res.ok) {
      setForm((f) => ({ ...f, description: "", amount: "" }));
      await fetchTransactions();
      await fetchSummary();
    }
  }

  async function handleDelete(id: string) {
    const res = await fetch(`/api/transactions/${id}`, { method: "DELETE" });
    if (res.ok) {
      await fetchTransactions();
      await fetchSummary();
    }
  }

  const fmt = (n: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);

  return (
    <div className="max-w-4xl mx-auto space-y-6">
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
            <CardTitle className="text-xs uppercase tracking-wide text-muted-foreground">
              Income
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-green-500">
              {summary ? fmt(summary.income) : "—"}
            </p>
          </CardContent>
        </Card>
        <Card className="border-red-200 dark:border-red-900">
          <CardHeader className="pb-1">
            <CardTitle className="text-xs uppercase tracking-wide text-muted-foreground">
              Expenses
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-red-500">
              {summary ? fmt(summary.expenses) : "—"}
            </p>
          </CardContent>
        </Card>
        <Card className="border-purple-200 dark:border-purple-900">
          <CardHeader className="pb-1">
            <CardTitle className="text-xs uppercase tracking-wide text-muted-foreground">
              Balance
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-purple-500">
              {summary ? fmt(summary.balance) : "—"}
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
              onChange={(e) =>
                setForm((f) => ({ ...f, type: e.target.value as "Income" | "Expense" }))
              }
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
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <Button onClick={handleAdd} className="bg-blue-500 hover:bg-blue-600 text-white">
              Add
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Pie chart */}
      {summary && summary.spendingByCategory.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs uppercase tracking-wide text-muted-foreground">
              Spending by Category
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={summary.spendingByCategory}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={80}
                  outerRadius={130}
                  paddingAngle={2}
                >
                  {summary.spendingByCategory.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip formatter={(v: number) => fmt(v)} />
                <Legend />
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
          <div className="flex gap-2 mb-4">
            <Button
              variant={typeFilter === "" ? "default" : "outline"}
              size="sm"
              onClick={() => setTypeFilter("")}
            >
              All Types
            </Button>
            <Button
              variant={typeFilter === "Income" ? "default" : "outline"}
              size="sm"
              onClick={() => setTypeFilter("Income")}
            >
              Income
            </Button>
            <Button
              variant={typeFilter === "Expense" ? "default" : "outline"}
              size="sm"
              onClick={() => setTypeFilter("Expense")}
            >
              Expense
            </Button>
            <Button
              variant={categoryFilter === "" ? "default" : "outline"}
              size="sm"
              onClick={() => setCategoryFilter("")}
            >
              All Categories
            </Button>
            {categories.map((c) => (
              <Button
                key={c.id}
                variant={categoryFilter === c.id ? "default" : "outline"}
                size="sm"
                onClick={() => setCategoryFilter(categoryFilter === c.id ? "" : c.id)}
              >
                {c.name}
              </Button>
            ))}
          </div>

          <table className="w-full text-sm">
            <thead>
              <tr className="text-muted-foreground uppercase text-xs border-b">
                <th className="text-left py-2">Date</th>
                <th className="text-left py-2">Description</th>
                <th className="text-left py-2">Category</th>
                <th className="text-left py-2">Amount</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {transactions.map((t) => (
                <tr key={t.id} className="border-b last:border-0">
                  <td className="py-3 text-muted-foreground">
                    {new Date(t.date).toISOString().slice(0, 10)}
                  </td>
                  <td className="py-3">{t.description}</td>
                  <td className="py-3">
                    <span
                      className="px-2 py-0.5 rounded-full text-xs font-medium border"
                      style={{ color: t.category.color, borderColor: t.category.color }}
                    >
                      {t.category.name}
                    </span>
                  </td>
                  <td
                    className={`py-3 font-semibold ${
                      t.type === "Income" ? "text-green-500" : "text-red-500"
                    }`}
                  >
                    {t.type === "Income" ? "+" : "-"}
                    {fmt(Math.abs(parseFloat(t.amount)))}
                  </td>
                  <td className="py-3 text-right">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDelete(t.id)}
                    >
                      Delete
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
