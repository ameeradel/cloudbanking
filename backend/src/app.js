require("dotenv").config();

const express = require("express");
const { Pool } = require("pg");

const app = express();

app.use(express.json());

const PORT = process.env.PORT || 3000;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

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
      timestamp: new Date().toISOString(),
    });
  }
});

// Application routes will be added here

app.listen(PORT, () => {
  console.log(`Backend running on port ${PORT}`);
});