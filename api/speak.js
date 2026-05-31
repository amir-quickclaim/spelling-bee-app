import fs from "node:fs";
import OpenAI from "openai";

function getOpenAIApiKey() {
  if (process.env.OPENAI_API_KEY) {
    return process.env.OPENAI_API_KEY;
  }

  if (!fs.existsSync(".env.local")) {
    return "";
  }

  const envFile = fs.readFileSync(".env.local", "utf8");
  const keyLine = envFile
    .split(/\r?\n/)
    .find((line) => line.trim().startsWith("OPENAI_API_KEY="));

  return keyLine?.split("=").slice(1).join("=").trim() || "";
}

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    const { text } = req.body;

    if (!text) {
      return res.status(400).json({ error: "Missing text" });
    }

    const apiKey = getOpenAIApiKey();

    if (!apiKey) {
      return res.status(500).json({
        error:
          "Missing OPENAI_API_KEY. Add it to .env.local, then restart vercel dev."
      });
    }

    const openai = new OpenAI({ apiKey });

    const audio = await openai.audio.speech.create({
      model: "gpt-4o-mini-tts",
      voice: "marin",
      input: text,
      instructions:
        "Speak like a warm, friendly spelling bee teacher helping a child. Use a clear Australian accent. Speak slowly and naturally. When spelling letters, pause clearly between each letter."
    });

    const buffer = Buffer.from(await audio.arrayBuffer());

    res.setHeader("Content-Type", "audio/mpeg");
    res.send(buffer);
  } catch (error) {
    console.error(error);
    const status = error.status || 500;
    const message =
      error.error?.message ||
      error.message ||
      "Could not generate speech";

    res.status(status).json({ error: message });
  }
}