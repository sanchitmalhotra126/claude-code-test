import express from "express";
import { Chatbot } from "./chatbot";
import { createRouter } from "./api";
import { ClaudeProvider, GptProvider, GeminiProvider } from "./providers";

const app = express();

app.use(express.json({ limit: "10mb" }));

const providers = [
  new ClaudeProvider(),
  new GptProvider(),
  new GeminiProvider(),
];

const chatbot = new Chatbot(providers);
const router = createRouter(chatbot);

app.use("/api", router);

const port = process.env.PORT ?? 3000;

app.listen(port, () => {
  console.log(`Chatbot API listening on port ${port}`);
});

export { app, Chatbot };
