export type AccountStatus = "active" | "frozen" | "closed";
export type Currency = "USD" | "EUR" | "GBP" | "JPY";

export interface Account {
  id: string;
  holder: string;
  currency: Currency;
  balance: number;
  status: AccountStatus;
  createdAt: string;
}

export type TransactionStatus = "completed" | "pending" | "failed";
export type TransactionType = "transfer" | "deposit" | "withdrawal" | "fee";

export interface Transaction {
  id: string;
  type: TransactionType;
  sourceAccount: string;
  destinationAccount: string;
  amount: number;
  currency: Currency;
  status: TransactionStatus;
  date: string;
  note?: string;
}

export interface SystemStatus {
  apiHealth: "UP" | "DOWN";
  dbReadiness: "READY" | "NOT_READY";
  metricsEndpoint: "Available" | "Unavailable";
  environment: string;
  appVersion: string;
  lastDeployment: string;
}

export interface ProductionSignals {
  requestRate: string;
  errorRate: string;
  p95Latency: string;
  uptime: string;
}
