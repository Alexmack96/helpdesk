import { useEffect, useState } from "react";
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
  const queryClient = useQueryClient();
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState<"" | "Income" | "Expense">("");
  const [categoryFilter, setCategoryFilter] = useState("");
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
    queryKey: ["transactions", typeFilter, categoryFilter],
    queryFn: () => {
      const params = new URLSearchParams();
      if (typeFilter) params.set("type", typeFilter);
      if (categoryFilter) params.set("categoryId", categoryFilter);
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
            <Button
              onClick={handleAdd}
              disabled={addMutation.isPending}
              className="bg-blue-500 hover:bg-blue-600 text-white"
            >
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
                <Tooltip formatter={(v) => fmt(v as number)} />
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
                      disabled={deleteMutation.isPending}
                      onClick={() => setPendingDeleteId(t.id)}
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
      <AlertDialog open={!!pendingDeleteId} onOpenChange={(open) => !open && setPendingDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete transaction?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone.
            </AlertDialogDescription>
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
