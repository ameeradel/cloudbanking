import { useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusBadge } from "@/components/StatusBadge";
import { formatCurrency } from "@/lib/format";
import { getTransactions } from "@/services/api";
import type { Transaction } from "@/types";

export default function Transactions() {
  const [txns, setTxns] = useState<Transaction[]>([]);
  const [status, setStatus] = useState("all");
  const [type, setType] = useState("all");
  const [q, setQ] = useState("");

  useEffect(() => { getTransactions().then(setTxns); }, []);

  const filtered = useMemo(() => txns.filter((t) =>
    (status === "all" || t.status === status) &&
    (type === "all" || t.type === type) &&
    (!q || [t.id, t.sourceAccount, t.destinationAccount].some((s) => s.toLowerCase().includes(q.toLowerCase())))
  ), [txns, status, type, q]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Transactions</h1>
        <p className="text-muted-foreground mt-1">All ledger activity across CloudBank</p>
      </div>

      <Card className="shadow-card">
        <CardHeader>
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <CardTitle>Ledger</CardTitle>
              <CardDescription>{filtered.length} of {txns.length} transactions</CardDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Search account or txn ID" value={q} onChange={(e) => setQ(e.target.value)} className="pl-8 w-64" />
              </div>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger className="w-36"><SelectValue placeholder="Status" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="failed">Failed</SelectItem>
                </SelectContent>
              </Select>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger className="w-36"><SelectValue placeholder="Type" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All types</SelectItem>
                  <SelectItem value="transfer">Transfer</SelectItem>
                  <SelectItem value="deposit">Deposit</SelectItem>
                  <SelectItem value="withdrawal">Withdrawal</SelectItem>
                  <SelectItem value="fee">Fee</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Transaction ID</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Destination</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell className="font-mono text-xs">{t.id}</TableCell>
                    <TableCell className="capitalize">{t.type}</TableCell>
                    <TableCell className="font-mono text-xs">{t.sourceAccount}</TableCell>
                    <TableCell className="font-mono text-xs">{t.destinationAccount}</TableCell>
                    <TableCell className="text-right font-semibold tabular-nums">{formatCurrency(t.amount, t.currency)}</TableCell>
                    <TableCell><StatusBadge status={t.status} /></TableCell>
                    <TableCell className="text-sm text-muted-foreground font-mono">{t.date}</TableCell>
                  </TableRow>
                ))}
                {filtered.length === 0 && (
                  <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">No transactions match filters</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
