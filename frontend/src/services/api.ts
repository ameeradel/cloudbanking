/**
 * API Service Layer
 * Currently returns mock data. Will later be replaced with axios/fetch calls
 * to the Node.js/Express backend at VITE_API_BASE_URL.
 */
import {
  mockAccounts,
  mockTransactions,
  mockSystemStatus,
  mockProductionSignals,
} from "@/data/mockData";
import type { Account, Transaction, Currency } from "@/types";

export const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8080";

const delay = (ms = 300) => new Promise((r) => setTimeout(r, ms));

// GET /health
export const getHealth = async () => {
  await delay(150);
  return { status: mockSystemStatus.apiHealth };
};

// GET /ready
export const getReadiness = async () => {
  await delay(150);
  return { status: mockSystemStatus.dbReadiness };
};

// GET /metrics
export const getMetrics = async () => {
  await delay(150);
  return mockProductionSignals;
};

// GET /api/accounts
export const getAccounts = async (): Promise<Account[]> => {
  await delay();
  return mockAccounts;
};

// POST /api/accounts
export const createAccount = async (input: {
  holder: string;
  currency: Currency;
  initialBalance: number;
}): Promise<Account> => {
  await delay();
  return {
    id: `ACC-${Math.floor(Math.random() * 9000 + 1000)}`,
    holder: input.holder,
    currency: input.currency,
    balance: input.initialBalance,
    status: "active",
    createdAt: new Date().toISOString().slice(0, 10),
  };
};

// POST /api/transfers
export const createTransfer = async (input: {
  fromAccount: string;
  toAccount: string;
  amount: number;
  currency: Currency;
  note?: string;
}): Promise<{ success: boolean; transactionId: string }> => {
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
};

// GET /api/accounts/:id/transactions
export const getTransactions = async (
  accountId?: string
): Promise<Transaction[]> => {
  await delay();
  if (!accountId) return mockTransactions;
  return mockTransactions.filter(
    (t) => t.sourceAccount === accountId || t.destinationAccount === accountId
  );
};

export const getSystemStatus = async () => {
  await delay(150);
  return mockSystemStatus;
};
