import type { Account, Transaction, SystemStatus, ProductionSignals } from "@/types";

export const mockAccounts: Account[] = [
  { id: "ACC-1001", holder: "Alex Johnson", currency: "USD", balance: 25430.55, status: "active", createdAt: "2024-03-12" },
  { id: "ACC-1002", holder: "Maria Garcia", currency: "EUR", balance: 18250.00, status: "active", createdAt: "2024-04-02" },
  { id: "ACC-1003", holder: "Yuki Tanaka", currency: "JPY", balance: 1420000, status: "active", createdAt: "2024-05-21" },
  { id: "ACC-1004", holder: "Liam O'Connor", currency: "GBP", balance: 9870.30, status: "frozen", createdAt: "2024-06-10" },
  { id: "ACC-1005", holder: "Priya Patel", currency: "USD", balance: 56210.75, status: "active", createdAt: "2024-07-04" },
  { id: "ACC-1006", holder: "Noah Schmidt", currency: "EUR", balance: 3120.10, status: "closed", createdAt: "2024-08-18" },
  { id: "ACC-1007", holder: "Sofia Rossi", currency: "EUR", balance: 42300.00, status: "active", createdAt: "2024-09-29" },
  { id: "ACC-1008", holder: "Daniel Kim", currency: "USD", balance: 12750.40, status: "active", createdAt: "2024-10-15" },
];

export const mockTransactions: Transaction[] = [
  { id: "TXN-90021", type: "transfer", sourceAccount: "ACC-1001", destinationAccount: "ACC-1002", amount: 1200, currency: "USD", status: "completed", date: "2026-05-04 09:14" },
  { id: "TXN-90022", type: "deposit", sourceAccount: "EXTERNAL", destinationAccount: "ACC-1005", amount: 5000, currency: "USD", status: "completed", date: "2026-05-04 08:42" },
  { id: "TXN-90023", type: "transfer", sourceAccount: "ACC-1003", destinationAccount: "ACC-1007", amount: 80000, currency: "JPY", status: "pending", date: "2026-05-04 08:11" },
  { id: "TXN-90024", type: "withdrawal", sourceAccount: "ACC-1008", destinationAccount: "EXTERNAL", amount: 250, currency: "USD", status: "completed", date: "2026-05-03 22:55" },
  { id: "TXN-90025", type: "transfer", sourceAccount: "ACC-1004", destinationAccount: "ACC-1002", amount: 700, currency: "GBP", status: "failed", date: "2026-05-03 19:32" },
  { id: "TXN-90026", type: "fee", sourceAccount: "ACC-1001", destinationAccount: "BANK", amount: 12, currency: "USD", status: "completed", date: "2026-05-03 12:00" },
  { id: "TXN-90027", type: "transfer", sourceAccount: "ACC-1007", destinationAccount: "ACC-1006", amount: 450, currency: "EUR", status: "completed", date: "2026-05-02 17:09" },
  { id: "TXN-90028", type: "deposit", sourceAccount: "EXTERNAL", destinationAccount: "ACC-1002", amount: 2200, currency: "EUR", status: "completed", date: "2026-05-02 11:18" },
  { id: "TXN-90029", type: "transfer", sourceAccount: "ACC-1005", destinationAccount: "ACC-1008", amount: 980, currency: "USD", status: "failed", date: "2026-05-01 16:24" },
  { id: "TXN-90030", type: "transfer", sourceAccount: "ACC-1002", destinationAccount: "ACC-1007", amount: 320, currency: "EUR", status: "completed", date: "2026-05-01 10:01" },
];

export const mockSystemStatus: SystemStatus = {
  apiHealth: "UP",
  dbReadiness: "READY",
  metricsEndpoint: "Available",
  environment: "staging",
  appVersion: "v1.0.0",
  lastDeployment: "2026-05-04 06:32 UTC",
};

export const mockProductionSignals: ProductionSignals = {
  requestRate: "428 req/s",
  errorRate: "0.42%",
  p95Latency: "187 ms",
  uptime: "99.982%",
};

export const mockTransactionVolume = [
  { day: "Mon", volume: 12400, transfers: 84 },
  { day: "Tue", volume: 18200, transfers: 102 },
  { day: "Wed", volume: 15600, transfers: 91 },
  { day: "Thu", volume: 21800, transfers: 124 },
  { day: "Fri", volume: 28400, transfers: 156 },
  { day: "Sat", volume: 17200, transfers: 88 },
  { day: "Sun", volume: 19500, transfers: 97 },
];
