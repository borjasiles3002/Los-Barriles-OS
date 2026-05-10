import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { GoogleGenAI } from "@google/genai";
import fs from "fs";
import dotenv from "dotenv";

// Force load .env and override existing env vars (like if user set MY_GEMINI_API_KEY in settings)
try {
  if (fs.existsSync('.env')) {
    const envConfig = dotenv.parse(fs.readFileSync('.env'));
    for (const k in envConfig) {
      process.env[k] = envConfig[k];
    }
  }
} catch (e) {
  console.error("Failed to load .env", e);
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '50mb' }));

  // API routes FIRST
  app.post("/api/gemini", async (req, res) => {
    try {
      let apiKey = req.headers['x-api-key'] as string;
      
      // If the client sends the intercept placeholder, no key, or an invalid key (doesn't start with AIza), use the server's environment variable
      if (!apiKey || apiKey === 'AISTUDIO_INTERCEPT' || !apiKey.startsWith('AIza')) {
          apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY || '';
      }

      if (!apiKey) {
        return res.status(500).json({ error: "MISSING_API_KEY" });
      }

      const ai = new GoogleGenAI({ apiKey });
      const { model, contents, config } = req.body;

      const result = await ai.models.generateContent({
        model: model || 'gemini-3-flash-preview',
        contents,
        config
      });

      res.json(result);
    } catch (error) {
      console.error("Error calling Gemini API from server:", error);
      res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*all', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
