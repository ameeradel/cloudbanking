require("dotenv").config();

const cors = require("cors");
const express = require("express");
const { Pool } = require("pg");

const app = express();

app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;

const pool = new Pool(
  process.env.DATABASE_URL
    ? {
        connectionString: process.env.DATABASE_URL,
      }
    : {
        host: process.env.DB_HOST,
        port: Number(process.env.DB_PORT || 5432),
        database: process.env.DB_NAME,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        ssl: process.env.DB_SSL === "true" ? { rejectUnauthorized: false } : false,
      }
);

function generateId(prefix) {
  return `${prefix}-${Math.floor(Math.random() * 900000 + 100000)}`;
}

function mapAccount(row) {
  return {
    id: row.id,
    holder: row.holder,
    currency: row.currency,
    balance: Number(row.balance),
    status: row.status,
    createdAt: row.created_at,
  };
}

function mapTransaction(row) {
  return {
    id: row.id,
    sourceAccount: row.source_account,
    destinationAccount: row.destination_account,
    amount: Number(row.amount),
    currency: row.currency,
    note: row.note,
    status: row.status,
    createdAt: row.created_at,
  };
}

async function initDb() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS accounts (
      id TEXT PRIMARY KEY,
      holder TEXT NOT NULL,
      currency TEXT NOT NULL CHECK (currency IN ('USD', 'EUR', 'GBP', 'EGP')),
      balance NUMERIC(14, 2) NOT NULL DEFAULT 0 CHECK (balance >= 0),
      status TEXT NOT NULL DEFAULT 'active',
      created_at DATE NOT NULL DEFAULT CURRENT_DATE
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS transactions (
      id TEXT PRIMARY KEY,
      source_account TEXT NOT NULL REFERENCES accounts(id),
      destination_account TEXT NOT NULL REFERENCES accounts(id),
      amount NUMERIC(14, 2) NOT NULL CHECK (amount > 0),
      currency TEXT NOT NULL CHECK (currency IN ('USD', 'EUR', 'GBP', 'EGP')),
      note TEXT,
      status TEXT NOT NULL DEFAULT 'completed',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
}

// Health check: checks if the application process is alive
app.get("/health", (req, res) => {
  res.status(200).json({
    status: "ok",
    service: "cloudbanking-backend",
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

// Readiness check: checks if the application can connect to the database
app.get("/ready", async (req, res) => {
  try {
    await pool.query("SELECT 1");

    res.status(200).json({
      status: "ready",
      service: "cloudbanking-backend",
      database: "connected",
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(503).json({
      status: "not_ready",
      service: "cloudbanking-backend",
      database: "disconnected",
      error: error.message,
      timestamp: new Date().toISOString(),
    });
  }
});

// Simple metrics endpoint for now
app.get("/metrics", async (req, res) => {
  res.status(200).json({
    service: "cloudbanking-backend",
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    database: "postgresql",
  });
});

// GET /api/accounts
app.get("/api/accounts", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT id, holder, currency, balance, status, created_at
      FROM accounts
      ORDER BY created_at DESC, id DESC;
    `);

    res.status(200).json(result.rows.map(mapAccount));
  } catch (error) {
    res.status(500).json({
      message: "Failed to fetch accounts",
      error: error.message,
    });
  }
});

// POST /api/accounts
app.post("/api/accounts", async (req, res) => {
  try {
    const { holder, currency, initialBalance } = req.body;

    if (!holder || typeof holder !== "string") {
      return res.status(400).json({ message: "holder is required" });
    }

    if (!currency || !["USD", "EUR", "GBP", "EGP"].includes(currency)) {
      return res.status(400).json({
        message: "currency must be one of USD, EUR, GBP, EGP",
      });
    }

    const balance = Number(initialBalance || 0);

    if (Number.isNaN(balance) || balance < 0) {
      return res.status(400).json({
        message: "initialBalance must be a positive number",
      });
    }

    const id = generateId("ACC");

    const result = await pool.query(
      `
      INSERT INTO accounts (id, holder, currency, balance)
      VALUES ($1, $2, $3, $4)
      RETURNING id, holder, currency, balance, status, created_at;
      `,
      [id, holder.trim(), currency, balance]
    );

    res.status(201).json(mapAccount(result.rows[0]));
  } catch (error) {
    res.status(500).json({
      message: "Failed to create account",
      error: error.message,
    });
  }
});

// GET /api/transactions
app.get("/api/transactions", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT id, source_account, destination_account, amount, currency, note, status, created_at
      FROM transactions
      ORDER BY created_at DESC;
    `);

    res.status(200).json(result.rows.map(mapTransaction));
  } catch (error) {
    res.status(500).json({
      message: "Failed to fetch transactions",
      error: error.message,
    });
  }
});

// GET /api/accounts/:id/transactions
app.get("/api/accounts/:id/transactions", async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `
      SELECT id, source_account, destination_account, amount, currency, note, status, created_at
      FROM transactions
      WHERE source_account = $1 OR destination_account = $1
      ORDER BY created_at DESC;
      `,
      [id]
    );

    res.status(200).json(result.rows.map(mapTransaction));
  } catch (error) {
    res.status(500).json({
      message: "Failed to fetch account transactions",
      error: error.message,
    });
  }
});

// POST /api/transfers
app.post("/api/transfers", async (req, res) => {
  const client = await pool.connect();

  try {
    const { fromAccount, toAccount, amount, currency, note } = req.body;

    if (!fromAccount || !toAccount) {
      return res.status(400).json({
        message: "fromAccount and toAccount are required",
      });
    }

    if (fromAccount === toAccount) {
      return res.status(400).json({
        message: "Source and destination accounts cannot be the same",
      });
    }

    const transferAmount = Number(amount);

    if (Number.isNaN(transferAmount) || transferAmount <= 0) {
      return res.status(400).json({
        message: "Amount must be greater than zero",
      });
    }

    if (!currency || !["USD", "EUR", "GBP", "EGP"].includes(currency)) {
      return res.status(400).json({
        message: "currency must be one of USD, EUR, GBP, EGP",
      });
    }

    await client.query("BEGIN");

    const accountsResult = await client.query(
      `
      SELECT id, currency, balance
      FROM accounts
      WHERE id IN ($1, $2)
      FOR UPDATE;
      `,
      [fromAccount, toAccount]
    );

    const accounts = accountsResult.rows;
    const source = accounts.find((account) => account.id === fromAccount);
    const destination = accounts.find((account) => account.id === toAccount);

    if (!source || !destination) {
      await client.query("ROLLBACK");
      return res.status(404).json({
        message: "Source or destination account not found",
      });
    }

    if (source.currency !== currency || destination.currency !== currency) {
      await client.query("ROLLBACK");
      return res.status(400).json({
        message: "Transfer currency must match both accounts currency",
      });
    }

    if (Number(source.balance) < transferAmount) {
      await client.query("ROLLBACK");
      return res.status(400).json({
        message: "Insufficient balance",
      });
    }

    await client.query(
      `
      UPDATE accounts
      SET balance = balance - $1
      WHERE id = $2;
      `,
      [transferAmount, fromAccount]
    );

    await client.query(
      `
      UPDATE accounts
      SET balance = balance + $1
      WHERE id = $2;
      `,
      [transferAmount, toAccount]
    );

    const transactionId = generateId("TXN");

    await client.query(
      `
      INSERT INTO transactions (
        id,
        source_account,
        destination_account,
        amount,
        currency,
        note,
        status
      )
      VALUES ($1, $2, $3, $4, $5, $6, 'completed');
      `,
      [
        transactionId,
        fromAccount,
        toAccount,
        transferAmount,
        currency,
        note || null,
      ]
    );

    await client.query("COMMIT");

    res.status(201).json({
      success: true,
      transactionId,
    });
  } catch (error) {
    await client.query("ROLLBACK");

    res.status(500).json({
      message: "Failed to create transfer",
      error: error.message,
    });
  } finally {
    client.release();
  }
});

initDb()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Backend running on port ${PORT}`);
    });
  })
  .catch((error) => {
    console.error("Failed to initialize database", error);
    process.exit(1);
  });