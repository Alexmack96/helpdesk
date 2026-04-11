import { Router } from "express";
import { db } from "../db/client.js";
import { env } from "../config/env.js";
import { requireAuth, requireAdmin } from "../middleware/auth.js";
import type { Prisma } from "../generated/prisma/index.js";

export const monzoRouter = Router();

// ─── GET /api/admin/monzo/status ─────────────────────────────────────────────

monzoRouter.get("/status", requireAuth, requireAdmin, async (_req, res) => {
  const configured = !!env.MONZO_ACCESS_TOKEN;
  const latest = await db.monzoApiTransaction.findFirst({
    orderBy: { created: "desc" },
    select: { created: true, monzoId: true },
  });
  const total = await db.monzoApiTransaction.count();
  res.json({ configured, lastSyncedAt: latest?.created ?? null, totalStaged: total });
});

// ─── POST /api/admin/monzo/sync ───────────────────────────────────────────────

type MonzoTx = {
  id: string;
  created: string;
  settled: string;
  amount: number;
  currency: string;
  local_amount: number;
  local_currency: string;
  description: string;
  notes: string;
  category: string;
  decline_reason?: string | null;
  scheme?: string;
  include_in_spending: boolean;
  account_id: string;
  merchant?: {
    name?: string;
    emoji?: string;
    address?: { short_formatted?: string };
  } | null;
};

monzoRouter.post("/sync", requireAuth, requireAdmin, async (_req, res) => {
  if (!env.MONZO_ACCESS_TOKEN) {
    res.status(503).json({ error: "MONZO_ACCESS_TOKEN not configured in .env" });
    return;
  }

  const token = env.MONZO_ACCESS_TOKEN;

  // Fetch account ID
  const accountsResp = await fetch("https://api.monzo.com/accounts?account_type=uk_retail", {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!accountsResp.ok) {
    const body = await accountsResp.text();
    res.status(502).json({ error: `Monzo /accounts failed: ${body}` });
    return;
  }
  const accountsData = (await accountsResp.json()) as { accounts: { id: string; closed: boolean }[] };
  const account = accountsData.accounts.find((a) => !a.closed);
  if (!account) {
    res.status(400).json({ error: "No open Monzo account found" });
    return;
  }

  // Use latest monzoId as cursor; fall back to 90 days ago for first sync
  const latest = await db.monzoApiTransaction.findFirst({
    orderBy: { created: "desc" },
    select: { monzoId: true },
  });
  const since = latest?.monzoId ?? "2025-12-31T23:59:59.000Z";

  // Paginate until we have everything
  const allTxs: MonzoTx[] = [];
  let cursor = since;
  const PAGE_CAP = 50;

  for (let page = 0; page < PAGE_CAP; page++) {
    const url = new URL("https://api.monzo.com/transactions");
    url.searchParams.set("account_id", account.id);
    url.searchParams.set("since", cursor);
    url.searchParams.set("limit", "100");
    url.searchParams.set("expand[]", "merchant");

    const txResp = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!txResp.ok) {
      const body = await txResp.text();
      res.status(502).json({ error: `Monzo /transactions failed: ${body}` });
      return;
    }

    const data = (await txResp.json()) as { transactions: MonzoTx[] };
    // Only settled, non-declined transactions
    const settled = data.transactions.filter((tx) => tx.settled && !tx.decline_reason);
    allTxs.push(...settled);

    if (data.transactions.length < 100) break;
    cursor = data.transactions[data.transactions.length - 1].id;
  }

  if (allTxs.length === 0) {
    res.json({ imported: 0, duplicates: 0 });
    return;
  }

  // Dedup against existing rows
  const ids = allTxs.map((tx) => tx.id);
  const existing = await db.monzoApiTransaction.findMany({
    where: { monzoId: { in: ids } },
    select: { monzoId: true },
  });
  const existingSet = new Set(existing.map((r) => r.monzoId));

  const toInsert: Prisma.MonzoApiTransactionCreateManyInput[] = allTxs
    .filter((tx) => !existingSet.has(tx.id))
    .map((tx) => ({
      monzoId: tx.id,
      created: new Date(tx.created),
      settled: tx.settled ? new Date(tx.settled) : null,
      amountPence: tx.amount,
      currency: tx.currency,
      localAmountPence: tx.local_amount,
      localCurrency: tx.local_currency,
      description: tx.description,
      notes: tx.notes || null,
      monzoCategory: tx.category,
      merchantName: tx.merchant?.name ?? null,
      merchantEmoji: tx.merchant?.emoji ?? null,
      merchantAddress: tx.merchant?.address?.short_formatted ?? null,
      scheme: tx.scheme ?? null,
      includeInSpending: tx.include_in_spending,
      accountId: account.id,
    }));

  if (toInsert.length > 0) await db.monzoApiTransaction.createMany({ data: toInsert });

  res.json({ imported: toInsert.length, duplicates: allTxs.length - toInsert.length });
});
