const express = require("express");
const cors = require("cors");

const app = express();

const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.get("/health", (req, res) => {
  res.status(200).json({
    status: "ok",
    service: "cloudbanking-backend",
  });
});

app.get("/ready", (req, res) => {
  res.status(200).json({
    status: "ready",
    service: "cloudbanking-backend",
  });
});

app.get("/api", (req, res) => {
  res.status(200).json({
    message: "CloudBanking backend API is running",
  });
});

app.listen(PORT, () => {
  console.log(`CloudBanking backend is running on port ${PORT}`);
});