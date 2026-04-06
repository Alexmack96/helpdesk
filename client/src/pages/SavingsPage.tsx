import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card.js";

const INCOME = 5500;

const fmt = (n: number) =>
  new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", maximumFractionDigits: 0 }).format(n);

const pct = (n: number) => `${Math.round((n / INCOME) * 100)}%`;

const NEEDS  = INCOME * 0.50;
const WANTS  = INCOME * 0.30;
const SAVING = INCOME * 0.20;

const categories = [
  {
    label: "Needs",
    description: "Housing, bills, groceries, transport",
    amount: NEEDS,
    percent: "50%",
    bar: "bg-blue-500",
    text: "text-blue-500",
  },
  {
    label: "Wants",
    description: "Dining, entertainment, shopping",
    amount: WANTS,
    percent: "30%",
    bar: "bg-amber-500",
    text: "text-amber-500",
  },
  {
    label: "Savings & Investments",
    description: "Emergency fund, ISA, pension top-up",
    amount: SAVING,
    percent: "20%",
    bar: "bg-emerald-500",
    text: "text-emerald-500",
    highlight: true,
  },
];

export function SavingsPage() {
  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Savings &amp; Investments</h1>
        <p className="text-sm text-muted-foreground uppercase tracking-wide mt-1">50 / 30 / 20 budget plan</p>
      </div>

      {/* Income hero */}
      <Card className="border-2 border-primary/30 bg-primary/5">
        <CardContent className="pt-6">
          <p className="text-xs uppercase tracking-widest text-muted-foreground mb-1">Monthly take-home income</p>
          <p className="text-5xl font-extrabold text-foreground">{fmt(INCOME)}</p>
          <p className="text-xs text-muted-foreground mt-2">Hardcoded — will pull from Santander statement once connected.</p>
        </CardContent>
      </Card>

      {/* 50/30/20 breakdown */}
      <div className="space-y-4">
        {categories.map((cat) => (
          <Card key={cat.label} className={cat.highlight ? "border-emerald-500/40 ring-1 ring-emerald-500/20" : ""}>
            <CardHeader className="pb-2">
              <div className="flex items-baseline justify-between">
                <CardTitle className={`text-sm uppercase tracking-wide ${cat.text}`}>{cat.label}</CardTitle>
                <span className={`text-2xl font-bold ${cat.text}`}>{fmt(cat.amount)}</span>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              <p className="text-xs text-muted-foreground">{cat.description}</p>
              <div className="flex items-center gap-3">
                <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                  <div
                    className={`h-full rounded-full ${cat.bar}`}
                    style={{ width: cat.percent }}
                  />
                </div>
                <span className="text-xs font-medium text-muted-foreground w-8 text-right">{cat.percent}</span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Savings target callout */}
      <Card className="bg-emerald-500/10 border-emerald-500/30">
        <CardContent className="pt-6 space-y-3">
          <p className="text-xs uppercase tracking-widest text-muted-foreground">Your 20% savings target</p>
          <p className="text-4xl font-extrabold text-emerald-500">{fmt(SAVING)} <span className="text-base font-normal text-muted-foreground">/ month</span></p>
          <p className="text-sm text-muted-foreground">
            That's <strong className="text-foreground">{fmt(SAVING * 12)}</strong> per year, or{" "}
            <strong className="text-foreground">{fmt(SAVING * 3)}</strong> every quarter.
          </p>
          <div className="grid grid-cols-3 gap-4 pt-2">
            {[3, 6, 12].map((m) => (
              <div key={m} className="text-center">
                <p className="text-lg font-bold text-emerald-500">{fmt(SAVING * m)}</p>
                <p className="text-xs text-muted-foreground">{m} month{m > 1 ? "s" : ""}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
