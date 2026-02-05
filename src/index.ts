import express from "express";
import { chatRouter, safetyConfigRouter, modelsRouter } from "./routes";

const app = express();
const PORT = parseInt(process.env.PORT ?? "3000", 10);

app.use(express.json({ limit: "10mb" }));

// --- Routes ---
app.use("/api/chat", chatRouter);
app.use("/api/safety-config", safetyConfigRouter);
app.use("/api/models", modelsRouter);

// --- Health check ---
app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.listen(PORT, () => {
  console.log(`Chatbot API listening on port ${PORT}`);
});

export default app;
