import { useQuery } from "@tanstack/react-query";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card.js";
import { Skeleton } from "../components/ui/skeleton.js";
import api from "../lib/api.js";

const fmt = (n: number) =>
  new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", maximumFractionDigits: 0 }).format(n);

const TICK = "#888";
const GRID = "rgba(128,128,128,0.15)";

const OWNER_COLORS: Record<string, string> = {
  Alex:  "#8b5cf6",
  Casey: "#ec4899",
  Joint: "#0ea5e9",
};

interface AnalyticsData {
  fixedVsVariable:    { month: string; fixed: number; variable: number }[];
  monthlyFlow:        { month: string; income: number; expense: number }[];
  spendingByCategory: { name: string; color: string; value: number }[];
  ownerBreakdown:     { owner: string; amount: number }[];
  topMerchants:       { name: string; amount: number }[];
}

function ChartSkeleton() {
  return <Skeleton className="w-full h-[280px] rounded-md" />;
}

export function AnalyticsPage() {
  const { data, isPending } = useQuery<AnalyticsData>({
    queryKey: ["analytics"],
    queryFn: () => api.get("/api/dashboard/analytics").then((r) => r.data),
  });

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Analytics</h1>
        <p className="text-sm text-muted-foreground uppercase tracking-wide mt-1">Year to date</p>
      </div>

      {/* Fixed vs Variable — full width */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-xs uppercase tracking-wide text-muted-foreground">Fixed vs Variable Spending</CardTitle>
        </CardHeader>
        <CardContent>
          {isPending ? <ChartSkeleton /> : (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={data!.fixedVsVariable} margin={{ top: 4, right: 16, left: 8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={GRID} />
                <XAxis dataKey="month" tick={{ fill: TICK, fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis tickFormatter={(v) => `£${v}`} tick={{ fill: TICK, fontSize: 11 }} axisLine={false} tickLine={false} width={56} />
                <Tooltip formatter={(v) => fmt(v as number)} contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8 }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="fixed" name="Fixed" stackId="a" fill="#3b82f6" />
                <Bar dataKey="variable" name="Variable" stackId="a" fill="#f97316" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Monthly flow */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs uppercase tracking-wide text-muted-foreground">Monthly Income vs Expense</CardTitle>
          </CardHeader>
          <CardContent>
            {isPending ? <ChartSkeleton /> : (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={data!.monthlyFlow} margin={{ top: 4, right: 16, left: 8, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={GRID} />
                  <XAxis dataKey="month" tick={{ fill: TICK, fontSize: 12 }} axisLine={false} tickLine={false} />
                  <YAxis tickFormatter={(v) => `£${v}`} tick={{ fill: TICK, fontSize: 11 }} axisLine={false} tickLine={false} width={56} />
                  <Tooltip formatter={(v) => fmt(v as number)} contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8 }} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="income" name="Income" fill="#22c55e" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="expense" name="Expense" fill="#ef4444" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Spending by category */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs uppercase tracking-wide text-muted-foreground">Spending by Category</CardTitle>
          </CardHeader>
          <CardContent>
            {isPending ? <ChartSkeleton /> : (
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie
                    data={data!.spendingByCategory}
                    dataKey="value"
                    nameKey="name"
                    cx="40%"
                    innerRadius={70}
                    outerRadius={110}
                    paddingAngle={2}
                  >
                    {data!.spendingByCategory.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v) => fmt(v as number)} contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8 }} />
                  <Legend layout="vertical" align="right" verticalAlign="middle" wrapperStyle={{ fontSize: 12, paddingLeft: 16 }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Row 3 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Owner breakdown */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs uppercase tracking-wide text-muted-foreground">Spending by Owner</CardTitle>
          </CardHeader>
          <CardContent>
            {isPending ? <ChartSkeleton /> : (
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie
                    data={data!.ownerBreakdown}
                    dataKey="amount"
                    nameKey="owner"
                    cx="40%"
                    innerRadius={70}
                    outerRadius={110}
                    paddingAngle={2}
                  >
                    {data!.ownerBreakdown.map((entry, i) => (
                      <Cell key={i} fill={OWNER_COLORS[entry.owner] ?? "#888"} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v) => fmt(v as number)} contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8 }} />
                  <Legend layout="vertical" align="right" verticalAlign="middle" wrapperStyle={{ fontSize: 12, paddingLeft: 16 }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Top merchants */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs uppercase tracking-wide text-muted-foreground">Top Merchants</CardTitle>
          </CardHeader>
          <CardContent>
            {isPending ? (
              <div className="space-y-3">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <Skeleton className="h-4 w-4 rounded-full" />
                    <Skeleton className="h-4 flex-1" />
                    <Skeleton className="h-4 w-16" />
                  </div>
                ))}
              </div>
            ) : (
              <ol className="space-y-2">
                {data!.topMerchants.map((m, i) => {
                  const max = data!.topMerchants[0].amount;
                  return (
                    <li key={i} className="flex items-center gap-3 text-sm">
                      <span className="text-muted-foreground/50 w-4 text-right shrink-0">{i + 1}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-0.5">
                          <span className="truncate text-foreground">{m.name}</span>
                          <span className="text-muted-foreground ml-2 shrink-0">{fmt(m.amount)}</span>
                        </div>
                        <div className="h-1 rounded-full bg-muted overflow-hidden">
                          <div className="h-full rounded-full bg-primary" style={{ width: `${(m.amount / max) * 100}%` }} />
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ol>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
