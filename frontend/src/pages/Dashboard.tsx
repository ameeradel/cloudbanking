import { useEffect, useState } from "react";
import { Wallet, Users, Send, AlertTriangle, Activity, Database } from "lucide-react";
import { StatCard } from "@/components/StatCard";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { StatusBadge } from "@/components/StatusBadge";
import { formatCurrency } from "@/lib/format";
import { getAccounts, getTransactions, getSystemStatus } from "@/services/api";
import { mockTransactionVolume } from "@/data/mockData";
import type { Account, Transaction, SystemStatus } from "@/types";
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid,
} from "recharts";

export default function Dashboard() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [txns, setTxns] = useState<Transaction[]>([]);
  const [system, setSystem] = useState<SystemStatus | null>(null);

  useEffect(() => {
    getAccounts().then(setAccounts);
    getTransactions().then(setTxns);
    getSystemStatus().then(setSystem);
  }, []);

  const totalBalanceUSD = accounts.reduce((s, a) => s + (a.currency === "JPY" ? a.balance / 150 : a.balance), 0);
  const totalTransfers = txns.filter((t) => t.type === "transfer").length;
  const failed = txns.filter((t) => t.status === "failed").length;
  const recent = txns.slice(0, 5);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground mt-1">Overview of your CloudBank platform</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <StatCard label="Total Balance" value={formatCurrency(totalBalanceUSD, "USD")} icon={Wallet} accent="primary" trend="across all accounts" />
        <StatCard label="Accounts" value={accounts.length} icon={Users} accent="accent" trend={`${accounts.filter(a => a.status === "active").length} active`} />
        <StatCard label="Transfers" value={totalTransfers} icon={Send} accent="primary" trend="last 7 days" />
        <StatCard label="Failed Txns" value={failed} icon={AlertTriangle} accent="destructive" trend="requires review" />
        <StatCard label="API Status" value={system?.apiHealth ?? "—"} icon={Activity} accent="success" trend="/health · 200 OK" />
        <StatCard label="Database" value={system?.dbReadiness ?? "—"} icon={Database} accent="success" trend="/ready · primary" />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2 shadow-card">
          <CardHeader>
            <CardTitle>Transaction Volume</CardTitle>
            <CardDescription>Last 7 days · USD equivalent</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={mockTransactionVolume}>
                <defs>
                  <linearGradient id="vol" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="day" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <Tooltip
                  contentStyle={{
                    background: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: 8,
                  }}
                />
                <Area type="monotone" dataKey="volume" stroke="hsl(var(--primary))" strokeWidth={2} fill="url(#vol)" />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="shadow-card">
          <CardHeader>
            <CardTitle>System Status</CardTitle>
            <CardDescription>Live platform health</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {[
              { k: "API Health", v: system?.apiHealth },
              { k: "DB Readiness", v: system?.dbReadiness },
              { k: "Metrics", v: system?.metricsEndpoint },
              { k: "Environment", v: system?.environment },
              { k: "Version", v: system?.appVersion },
            ].map((r) => (
              <div key={r.k} className="flex items-center justify-between border-b border-border/50 pb-2 last:border-0">
                <span className="text-sm text-muted-foreground">{r.k}</span>
                <span className="text-sm font-mono font-medium">{r.v ?? "…"}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2 shadow-card">
          <CardHeader>
            <CardTitle>Recent Transactions</CardTitle>
            <CardDescription>Latest activity across all accounts</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {recent.map((t) => (
                <div key={t.id} className="flex items-center justify-between rounded-lg border border-border/50 p-3 hover:bg-muted/30 transition-colors">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="rounded-md bg-primary/10 p-2 text-primary"><Send className="h-4 w-4" /></div>
                    <div className="min-w-0">
                      <p className="font-mono text-xs text-muted-foreground">{t.id}</p>
                      <p className="text-sm font-medium truncate">{t.sourceAccount} → {t.destinationAccount}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="font-semibold tabular-nums">{formatCurrency(t.amount, t.currency)}</span>
                    <StatusBadge status={t.status} />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-card">
          <CardHeader>
            <CardTitle>Account Balances</CardTitle>
            <CardDescription>Top funded accounts</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {[...accounts].sort((a, b) => b.balance - a.balance).slice(0, 5).map((a) => (
              <div key={a.id} className="flex items-center justify-between border-b border-border/50 pb-2 last:border-0">
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{a.holder}</p>
                  <p className="text-[11px] font-mono text-muted-foreground">{a.id}</p>
                </div>
                <span className="text-sm font-semibold tabular-nums">{formatCurrency(a.balance, a.currency)}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
