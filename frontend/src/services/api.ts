/**
 * API Service Layer
 * Uses real backend API when VITE_USE_MOCKS is not true.
 * Mock data can still be used for local UI development.
 */

import {
  mockAccounts,
  mockTransactions,
  mockSystemStatus,
  mockProductionSignals,
} from "@/data/mockData";
import type { Account, Transaction, Currency } from "@/types";

export const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3000";

const USE_MOCKS = import.meta.env.VITE_USE_MOCKS === "true";

const delay = (ms = 300) => new Promise((r) => setTimeout(r, ms));

async function apiRequest<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
    ...options,
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    throw new Error(
      `API request failed: ${response.status} ${response.statusText} ${errorText}`
    );
  }

  return response.json() as Promise<T>;
}

// GET /health
export const getHealth = async () => {
  if (USE_MOCKS) {
    await delay(150);
    return { status: mockSystemStatus.apiHealth };
  }

  return apiRequest<{ status: string }>("/health");
};

// GET /ready
export const getReadiness = async () => {
  if (USE_MOCKS) {
    await delay(150);
    return { status: mockSystemStatus.dbReadiness };
  }

  return apiRequest<{ status: string }>("/ready");
};

// GET /metrics
export const getMetrics = async () => {
  if (USE_MOCKS) {
    await delay(150);
    return mockProductionSignals;
  }

  return apiRequest<typeof mockProductionSignals>("/metrics");
};

// GET /api/accounts
export const getAccounts = async (): Promise<Account[]> => {
  if (USE_MOCKS) {
    await delay();
    return mockAccounts;
  }

  return apiRequest<Account[]>("/api/accounts");
};

// POST /api/accounts
export const createAccount = async (input: {
  holder: string;
  currency: Currency;
  initialBalance: number;
}): Promise<Account> => {
  if (USE_MOCKS) {
    await delay();
    return {
      id: `ACC-${Math.floor(Math.random() * 9000 + 1000)}`,
      holder: input.holder,
      currency: input.currency,
      balance: input.initialBalance,
      status: "active",
      createdAt: new Date().toISOString().slice(0, 10),
    };
  }

  return apiRequest<Account>("/api/accounts", {
    method: "POST",
    body: JSON.stringify(input),
  });
};

// POST /api/transfers
export const createTransfer = async (input: {
  fromAccount: string;
  toAccount: string;
  amount: number;
  currency: Currency;
  note?: string;
}): Promise<{ success: boolean; transactionId: string }> => {
  if (USE_MOCKS) {
    await delay(600);

    if (input.fromAccount === input.toAccount) {
      throw new Error("Source and destination accounts cannot be the same");
    }

    if (!input.amount || input.amount <= 0) {
      throw new Error("Amount must be greater than zero");
    }

    return {
      success: true,
      transactionId: `TXN-${Math.floor(Math.random() * 90000 + 10000)}`,
    };
  }

  return apiRequest<{ success: boolean; transactionId: string }>("/api/transfers", {
    method: "POST",
    body: JSON.stringify(input),
  });
};

// GET /api/accounts/:id/transactions
export const getTransactions = async (
  accountId?: string
): Promise<Transaction[]> => {
  if (USE_MOCKS) {
    await delay();

    if (!accountId) return mockTransactions;

    return mockTransactions.filter(
      (t) =>
        t.sourceAccount === accountId ||
        t.destinationAccount === accountId
    );
  }

  const path = accountId
    ? `/api/accounts/${accountId}/transactions`
    : "/api/transactions";

  return apiRequest<Transaction[]>(path);
};

export const getSystemStatus = async () => {
  if (USE_MOCKS) {
    await delay(150);
    return mockSystemStatus;
  }

  const [health, readiness] = await Promise.all([
    getHealth(),
    getReadiness(),
  ]);

  return {
    apiHealth: health.status,
    dbReadiness: readiness.status,
  };
};