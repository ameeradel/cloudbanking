import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Cloud, ShieldCheck, Activity, Database, ArrowRight } from "lucide-react";

export default function Landing() {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen bg-gradient-hero text-primary-foreground relative overflow-hidden">
      <div className="absolute inset-0 opacity-20" style={{
        backgroundImage: "radial-gradient(circle at 20% 30%, hsl(217 91% 65% / 0.4), transparent 40%), radial-gradient(circle at 80% 70%, hsl(199 89% 48% / 0.4), transparent 40%)"
      }} />
      <div className="relative z-10 mx-auto max-w-6xl px-6 py-8">
        <nav className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-foreground/10 backdrop-blur border border-primary-foreground/20">
              <Cloud className="h-5 w-5" />
            </div>
            <div>
              <p className="font-bold">CloudBank</p>
              <p className="text-[10px] uppercase tracking-widest text-primary-foreground/60">v1.0.0 · staging</p>
            </div>
          </div>
          <div className="hidden md:flex items-center gap-2 text-xs font-mono text-primary-foreground/60">
            <span className="h-2 w-2 rounded-full bg-success animate-pulse-glow" />
            ALL SYSTEMS OPERATIONAL
          </div>
        </nav>

        <section className="mt-24 md:mt-32 max-w-3xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary-foreground/20 bg-primary-foreground/5 px-3 py-1 text-xs font-medium backdrop-blur">
            <span className="h-1.5 w-1.5 rounded-full bg-accent" />
            DevOps Portfolio Demo
          </div>
          <h1 className="mt-6 text-5xl md:text-7xl font-bold tracking-tight leading-[1.05]">
            Cloud-Native<br />
            <span className="bg-gradient-to-r from-primary-glow to-accent bg-clip-text text-transparent">
              Banking Platform
            </span>
          </h1>
          <p className="mt-6 max-w-xl text-lg text-primary-foreground/70 leading-relaxed">
            CloudBank is a demo banking dashboard built to showcase production-ready
            architecture: observability, health probes, atomic transactions, and
            container-native deployments.
          </p>

          <div className="mt-10 flex flex-wrap items-center gap-4">
            <Button
              size="lg"
              onClick={() => navigate("/dashboard")}
              className="bg-primary-foreground text-primary hover:bg-primary-foreground/90 shadow-elegant h-12 px-8 text-base font-semibold gap-2"
            >
              Continue as Demo User
              <ArrowRight className="h-4 w-4" />
            </Button>
            <p className="text-xs text-primary-foreground/50 font-mono">No authentication · mock data only</p>
          </div>
        </section>

        <section className="mt-32 grid gap-4 md:grid-cols-3">
          {[
            { icon: Activity, title: "Production Signals", desc: "Live request rate, error rate, P95 latency, and uptime designed for Prometheus & Grafana." },
            { icon: Database, title: "Atomic Transfers", desc: "Money movement executed through backend database transactions to guarantee consistency." },
            { icon: ShieldCheck, title: "Health & Readiness", desc: "Kubernetes-style /health and /ready probes for safe rolling deployments." },
          ].map((f) => (
            <div key={f.title} className="rounded-2xl border border-primary-foreground/10 bg-primary-foreground/5 p-6 backdrop-blur">
              <f.icon className="h-6 w-6 text-accent" />
              <h3 className="mt-4 font-semibold">{f.title}</h3>
              <p className="mt-2 text-sm text-primary-foreground/60 leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </section>
      </div>
    </div>
  );
}
