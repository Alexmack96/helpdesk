import { useQuery } from "@tanstack/react-query";
import { Home, Droplets, Wifi, Zap, Landmark, CheckCircle2, XCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card.js";
import { Badge } from "../components/ui/badge.js";
import api from "../lib/api.js";

interface Payment {
  amount: string;
  date: string;
  description: string;
}

interface Utility {
  id: string;
  name: string;
  color: string;
  isDirectDebit: boolean;
  payments: {
    Alex: Payment[];
    Casey: Payment[];
    Joint: Payment[];
  };
  totalThisMonth: number;
}

interface UtilitiesResponse {
  month: string;
  utilities: Utility[];
}

const UTILITY_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  Rent: Home,
  Water: Droplets,
  Wifi: Wifi,
  Electricity: Zap,
  "Council Tax": Landmark,
};

const GBP = new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" });

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

function OwnerPayments({ name, payments }: { name: "Alex" | "Casey"; payments: Payment[] }) {
  const ownerColor = name === "Alex" ? "text-blue-500" : "text-pink-500";

  if (payments.length === 0) {
    return (
      <div className="flex items-center gap-2 py-1">
        <XCircle className="h-4 w-4 text-destructive shrink-0" />
        <span className={`text-sm font-medium ${ownerColor}`}>{name}</span>
        <span className="text-sm text-destructive ml-auto">Not paid</span>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {payments.map((p, i) => (
        <div key={i} className="flex items-center gap-2 py-1">
          <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
          <span className={`text-sm font-medium ${ownerColor}`}>{name}</span>
          <span className="text-sm text-muted-foreground ml-auto">
            {GBP.format(Number(p.amount))} · {formatDate(p.date)}
          </span>
        </div>
      ))}
    </div>
  );
}

function UtilityCard({ utility }: { utility: Utility }) {
  const Icon = UTILITY_ICONS[utility.name] ?? Landmark;

  return (
    <Card className="flex flex-col">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-3">
            <div
              className="p-2 rounded-lg"
              style={{ backgroundColor: `${utility.color}22`, color: utility.color }}
            >
              <Icon className="h-5 w-5" />
            </div>
            <CardTitle className="text-base">{utility.name}</CardTitle>
          </div>
          {utility.isDirectDebit ? (
            <Badge className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 shrink-0">
              Direct Debit
            </Badge>
          ) : (
            <Badge className="bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/20 shrink-0">
              Manual
            </Badge>
          )}
        </div>
        <p className={`text-2xl font-bold mt-2 ${utility.totalThisMonth === 0 ? "text-muted-foreground" : ""}`}>
          {GBP.format(utility.totalThisMonth)}
        </p>
        {utility.totalThisMonth === 0 && (
          <p className="text-xs text-muted-foreground -mt-1">No payments recorded this month</p>
        )}
      </CardHeader>
      <CardContent className="flex-1">
        <div className="divide-y divide-border">
          <div className="pb-2">
            <OwnerPayments name="Alex" payments={utility.payments.Alex} />
          </div>
          <div className="pt-2">
            <OwnerPayments name="Casey" payments={utility.payments.Casey} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function UtilitiesPage() {
  const { data, isPending, isError } = useQuery<UtilitiesResponse>({
    queryKey: ["utilities"],
    queryFn: () => api.get("/api/utilities").then((r) => r.data),
  });

  const grandTotal = data?.utilities.reduce((sum, u) => sum + u.totalThisMonth, 0) ?? 0;

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold">Utilities</h1>
          {data?.month && (
            <p className="text-muted-foreground text-sm mt-1">{data.month}</p>
          )}
        </div>
        {data && (
          <div className="text-right">
            <p className="text-sm text-muted-foreground">Total this month</p>
            <p className="text-2xl font-bold">{GBP.format(grandTotal)}</p>
          </div>
        )}
      </div>

      {isPending && (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <Card key={i} className="h-48 animate-pulse bg-muted" />
          ))}
        </div>
      )}

      {isError && (
        <p className="text-destructive text-sm">Failed to load utilities.</p>
      )}

      {data && (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {data.utilities.map((utility) => (
            <UtilityCard key={utility.id} utility={utility} />
          ))}
        </div>
      )}
    </div>
  );
}
