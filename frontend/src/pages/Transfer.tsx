import { useEffect, useState } from "react";
import { Info, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { getAccounts, createTransfer } from "@/services/api";
import type { Account, Currency } from "@/types";
import { toast } from "sonner";

export default function Transfer() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    fromAccount: "",
    toAccount: "",
    amount: "",
    currency: "USD" as Currency,
    note: "",
  });

  useEffect(() => { getAccounts().then(setAccounts); }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await createTransfer({
        fromAccount: form.fromAccount,
        toAccount: form.toAccount,
        amount: parseFloat(form.amount),
        currency: form.currency,
        note: form.note,
      });
      toast.success("Transfer completed", { description: `Transaction ID: ${res.transactionId}` });
      setForm({ fromAccount: "", toAccount: "", amount: "", currency: "USD", note: "" });
    } catch (err) {
      toast.error("Transfer failed", { description: err instanceof Error ? err.message : "Unknown error" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Transfer Money</h1>
        <p className="text-muted-foreground mt-1">Move funds between CloudBank accounts</p>
      </div>

      <Alert className="border-accent/30 bg-accent/5">
        <Info className="h-4 w-4 text-accent" />
        <AlertTitle>Atomic transactions</AlertTitle>
        <AlertDescription>
          Transfers are executed through a backend database transaction to ensure atomicity. If any
          step fails, the entire operation is rolled back.
        </AlertDescription>
      </Alert>

      <Card className="shadow-card">
        <CardHeader>
          <CardTitle>New transfer</CardTitle>
          <CardDescription>POST /api/transfers</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-5" onSubmit={handleSubmit}>
            <div className="grid gap-5 md:grid-cols-2">
              <div className="space-y-2">
                <Label>From account</Label>
                <Select value={form.fromAccount} onValueChange={(v) => setForm({ ...form, fromAccount: v })}>
                  <SelectTrigger><SelectValue placeholder="Select source" /></SelectTrigger>
                  <SelectContent>
                    {accounts.map((a) => (
                      <SelectItem key={a.id} value={a.id}>{a.id} · {a.holder}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>To account</Label>
                <Select value={form.toAccount} onValueChange={(v) => setForm({ ...form, toAccount: v })}>
                  <SelectTrigger><SelectValue placeholder="Select destination" /></SelectTrigger>
                  <SelectContent>
                    {accounts.map((a) => (
                      <SelectItem key={a.id} value={a.id}>{a.id} · {a.holder}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-5 md:grid-cols-3">
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="amount">Amount</Label>
                <Input id="amount" type="number" step="0.01" placeholder="0.00" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} required />
              </div>
              <div className="space-y-2">
                <Label>Currency</Label>
                <Select value={form.currency} onValueChange={(v) => setForm({ ...form, currency: v as Currency })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="USD">USD</SelectItem>
                    <SelectItem value="EUR">EUR</SelectItem>
                    <SelectItem value="GBP">GBP</SelectItem>
                    <SelectItem value="JPY">JPY</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="note">Transfer note</Label>
              <Textarea id="note" rows={3} placeholder="Optional reference for this transfer" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
            </div>

            <Button type="submit" disabled={submitting} className="gap-2 shadow-elegant">
              <Send className="h-4 w-4" />
              {submitting ? "Sending…" : "Send Transfer"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
