import { GoogleGenAI } from "@google/genai";
export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

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

    res.status(200).json(result);
  } catch (error) {
    console.error("Error calling Gemini API from server:", error);
    res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
  }
}
