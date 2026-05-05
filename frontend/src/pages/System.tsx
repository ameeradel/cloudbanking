import { useEffect, useState } from "react";
import { Activity, Database, BarChart3, Globe, GitBranch, Clock, TrendingUp, AlertCircle, Timer, ShieldCheck } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/StatusBadge";
import { getSystemStatus, getMetrics, API_BASE_URL } from "@/services/api";
import type { SystemStatus, ProductionSignals } from "@/types";

export default function System() {
  const [system, setSystem] = useState<SystemStatus | null>(null);
  const [signals, setSignals] = useState<ProductionSignals | null>(null);

  useEffect(() => {
    getSystemStatus().then(setSystem);
    getMetrics().then(setSignals);
  }, []);

  const platformCards = [
    { label: "API Health", value: system?.apiHealth, icon: Activity, hint: "GET /health" },
    { label: "Database Readiness", value: system?.dbReadiness, icon: Database, hint: "GET /ready" },
    { label: "Metrics Endpoint", value: system?.metricsEndpoint, icon: BarChart3, hint: "GET /metrics" },
    { label: "Environment", value: system?.environment, icon: Globe, hint: "Deployment target" },
    { label: "App Version", value: system?.appVersion, icon: GitBranch, hint: "Semantic version" },
    { label: "Last Deployment", value: system?.lastDeployment, icon: Clock, hint: "UTC timestamp" },
  ];

  const prodCards = [
    { label: "Request Rate", value: signals?.requestRate, icon: TrendingUp, accent: "text-primary bg-primary/10" },
    { label: "Error Rate", value: signals?.errorRate, icon: AlertCircle, accent: "text-warning bg-warning/10" },
    { label: "P95 Latency", value: signals?.p95Latency, icon: Timer, accent: "text-accent bg-accent/10" },
    { label: "Uptime", value: signals?.uptime, icon: ShieldCheck, accent: "text-success bg-success/10" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">System Status</h1>
          <p className="text-muted-foreground mt-1">Platform health, readiness probes, and production signals</p>
        </div>
        <Badge variant="outline" className="font-mono text-[11px]">
          API: {API_BASE_URL}
        </Badge>
      </div>

      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3">Platform Health</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {platformCards.map((c) => (
            <Card key={c.label} className="bg-gradient-card shadow-card">
              <CardContent className="p-5">
                <div className="flex items-start justify-between">
                  <div className="space-y-1.5">
                    <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{c.label}</p>
                    {["UP", "DOWN", "READY", "NOT_READY"].includes(c.value ?? "")
                      ? <StatusBadge status={c.value!} />
                      : <p className="text-xl font-bold font-mono tracking-tight">{c.value ?? "…"}</p>}
                    <p className="text-[11px] font-mono text-muted-foreground">{c.hint}</p>
                  </div>
                  <div className="rounded-lg p-2.5 bg-primary/10 text-primary">
                    <c.icon className="h-5 w-5" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3">Production Signals</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {prodCards.map((c) => (
            <Card key={c.label} className="bg-gradient-card shadow-card">
              <CardContent className="p-5">
                <div className={`inline-flex rounded-lg p-2.5 ${c.accent}`}><c.icon className="h-5 w-5" /></div>
                <p className="mt-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">{c.label}</p>
                <p className="mt-1 text-2xl font-bold tabular-nums">{c.value ?? "…"}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <Alert className="mt-4 border-primary/20 bg-primary/5">
          <AlertCircle className="h-4 w-4 text-primary" />
          <AlertTitle>Observability roadmap</AlertTitle>
          <AlertDescription>
            These values currently come from mock data. They will be sourced from the backend
            <code className="mx-1 rounded bg-muted px-1.5 py-0.5 text-xs font-mono">/metrics</code>
            endpoint and visualised through Prometheus &amp; Grafana dashboards in production.
          </AlertDescription>
        </Alert>
      </section>

      <Card className="shadow-card">
        <CardHeader>
          <CardTitle>Backend Endpoints</CardTitle>
          <CardDescription>Routes the UI is designed around</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-2 sm:grid-cols-2">
            {[
              ["GET", "/health"],
              ["GET", "/ready"],
              ["GET", "/metrics"],
              ["GET", "/api/accounts"],
              ["POST", "/api/accounts"],
              ["POST", "/api/transfers"],
              ["GET", "/api/accounts/:id/transactions"],
            ].map(([m, p]) => (
              <div key={p} className="flex items-center gap-2 rounded-md border border-border/60 px-3 py-2 font-mono text-xs">
                <Badge variant="outline" className="text-[10px]">{m}</Badge>
                <span>{p}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
