
import { Modality, FunctionDeclaration, GenerateContentResponse } from "@google/genai";
import { ChatMessage, ImageSize, AspectRatio } from '../types';
import { SYSTEM_PROMPT } from '../constants';

export const getApiKey = () => {
    let key = '';

    // 1. Check localStorage (User manual override) - HIGHEST PRIORITY
    if (typeof window !== 'undefined') {
        try {
            key = localStorage.getItem('user_api_key') || '';
        } catch {
            // ignore
        }
    }

    // 2. If no key, always return the intercept placeholder so the server uses its env var
    if (!key) {
        return 'AISTUDIO_INTERCEPT';
    }

    return key;
};

function fileToGenerativePart(data: string, mimeType: string) {
  return {
    inlineData: {
      data,
      mimeType,
    },
  };
}

export const callGemini = async (
    chatHistory: ChatMessage[], 
    systemPromptOverride?: string, 
    options: { 
        thinkingMode?: boolean; 
        useSearch?: boolean; 
        tools?: FunctionDeclaration[];
        responseMimeType?: string;
        responseSchema?: Record<string, unknown>;
    } = {},
    modelName: 'gemini-3.1-pro-preview' | 'gemini-3-pro-preview' | 'gemini-3-flash-preview' = 'gemini-3-flash-preview',
    retries = 2
): Promise<GenerateContentResponse> => {
  try {
    const contents = chatHistory.map(msg => ({
      role: msg.role,
      parts: msg.parts.map(part => {
        if (part.inlineData) {
          return fileToGenerativePart(part.inlineData.data, part.inlineData.mimeType);
        }
        if (part.functionResponse) {
            return { functionResponse: part.functionResponse as Record<string, unknown> };
        }
        return { text: part.text || '' };
      })
    }));
    
    const config: {
        systemInstruction: string;
        thinkingConfig?: { thinkingBudget: number };
        tools?: ({ googleSearch: Record<string, never> } | { functionDeclarations: FunctionDeclaration[] })[];
        responseMimeType?: string;
        responseSchema?: Record<string, unknown>;
    } = { systemInstruction: systemPromptOverride || SYSTEM_PROMPT };
    let finalModelName = modelName;

    if (options.thinkingMode) {
      config.thinkingConfig = { thinkingBudget: 32768 };
      finalModelName = 'gemini-3.1-pro-preview';
    }

    if (options.useSearch) {
        config.tools = [{googleSearch: {}}];
        finalModelName = 'gemini-3-flash-preview';
    }
    
    if (options.tools) {
        config.tools = [{functionDeclarations: options.tools}];
    }

    if (options.responseMimeType) {
        config.responseMimeType = options.responseMimeType;
    }

    if (options.responseSchema) {
        config.responseSchema = options.responseSchema;
    }

    const apiKey = getApiKey();
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (apiKey) {
        headers['x-api-key'] = apiKey;
    }

    const response = await fetch('/api/gemini', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: finalModelName,
        contents,
        config
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      let errorMessage = errorData.error || `HTTP error! status: ${response.status}`;
      
      // Try to parse the error message if it's a JSON string from Gemini
      try {
        const parsedError = JSON.parse(errorMessage);
        if (parsedError.error && parsedError.error.message) {
            errorMessage = parsedError.error.message;
        }
      } catch {
        // Not a JSON string, keep the original message
      }

      if (errorMessage.includes("API_KEY_INVALID") || errorMessage.includes("API key not valid") || errorMessage.includes("MISSING_API_KEY")) {
        throw new Error("ERROR_CLAVE_API: La clave de API de Gemini no es válida o no está configurada. Por favor, verifica tu configuración en AI Studio.");
      }
      
      if (errorMessage.includes("Unable to process input image") || errorMessage.includes("Base64 decoding failed") || response.status === 400) {
        throw new Error("Error al procesar la imagen o documento. Asegúrate de que el archivo es válido, no está dañado y no es demasiado grande.");
      }

      throw new Error(errorMessage);
    }

    const result = await response.json();
    
    // Add text property to match GenerateContentResponse interface
    if (result && !('text' in result)) {
        Object.defineProperty(result, 'text', {
            get() {
                if (!this.candidates || !this.candidates[0] || !this.candidates[0].content || !this.candidates[0].content.parts) {
                    return '';
                }
                return this.candidates[0].content.parts.map((p: { text?: string }) => p.text || '').join('');
            }
        });
    }

    if (result && !('functionCalls' in result)) {
        Object.defineProperty(result, 'functionCalls', {
            get() {
                if (!this.candidates || !this.candidates[0] || !this.candidates[0].content || !this.candidates[0].content.parts) {
                    return undefined;
                }
                const calls = this.candidates[0].content.parts.filter((p: { functionCall?: unknown }) => p.functionCall).map((p: { functionCall?: unknown }) => p.functionCall);
                return calls.length > 0 ? calls : undefined;
            }
        });
    }
    
    return result as GenerateContentResponse;
  } catch (error) {
    console.error("Error calling Gemini API:", error);
    
    // Retry on network errors or 500s
    if (retries > 0 && error instanceof Error && (error.message.includes('fetch') || error.message.includes('Network') || error.message.includes('500'))) {
        console.log(`Retrying API call... (${retries} left)`);
        await new Promise(resolve => setTimeout(resolve, 1000));
        return callGemini(chatHistory, systemPromptOverride, options, modelName, retries - 1);
    }

    if (error instanceof Error && (error.message.includes('API key not valid') || error.message.includes('403') || error.message.includes('PERMISSION_DENIED') || error.message.includes('API_KEY_INVALID') || error.message.includes('MISSING_API_KEY'))) {
       const cleanMessage = error.message.replace(/\[.*?\]\s*/g, ''); // Remove technical codes
       throw new Error(`ERROR_CLAVE_API: ${cleanMessage}. Verifica tu clave en AI Studio.`);
    }
    throw error;
  }
};

export const generateImage = async (prompt: string, imageSize: ImageSize, aspectRatio: AspectRatio): Promise<string> => {
    try {
      const apiKey = getApiKey();
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (apiKey) {
          headers['x-api-key'] = apiKey;
      }

      const response = await fetch('/api/gemini', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          model: 'gemini-3-pro-image-preview',
          contents: { parts: [{ text: prompt }] },
          config: {
            imageConfig: {
              aspectRatio: aspectRatio,
              imageSize: imageSize
            },
          }
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        let errorMessage = errorData.error || `HTTP error! status: ${response.status}`;
        try {
          const parsedError = JSON.parse(errorMessage);
          if (parsedError.error && parsedError.error.message) {
              errorMessage = parsedError.error.message;
          }
        } catch {}
        
        if (errorMessage.includes("API_KEY_INVALID") || errorMessage.includes("API key not valid") || errorMessage.includes("MISSING_API_KEY")) {
            throw new Error("ERROR_CLAVE_API: La clave de API de Gemini no es válida o no está configurada. Por favor, verifica tu configuración en AI Studio.");
        }
        throw new Error(errorMessage);
      }

      const result = await response.json();

      if (result?.candidates?.[0]?.content?.parts) {
          for (const part of result.candidates[0].content.parts) {
            if (part.inlineData) {
              return part.inlineData.data;
            }
          }
      }
      
      throw new Error("No image data found in the API response.");
    } catch (error) {
        console.error("Error generating image:", error);
        throw error;
    }
};

export const generateSpeech = async (text: string): Promise<string> => {
    try {
        const apiKey = getApiKey();
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        if (apiKey) {
            headers['x-api-key'] = apiKey;
        }

        const response = await fetch('/api/gemini', {
          method: 'POST',
          headers,
          body: JSON.stringify({
            model: "gemini-2.5-flash-preview-tts",
            contents: [{ parts: [{ text: `Di: ${text}` }] }],
            config: {
                responseModalities: [Modality.AUDIO],
                speechConfig: {
                    voiceConfig: {
                        prebuiltVoiceConfig: { voiceName: 'Kore' },
                    },
                },
            }
          })
        });

        if (!response.ok) {
          const errorData = await response.json();
          let errorMessage = errorData.error || `HTTP error! status: ${response.status}`;
          try {
            const parsedError = JSON.parse(errorMessage);
            if (parsedError.error && parsedError.error.message) {
                errorMessage = parsedError.error.message;
            }
          } catch {}
          
          if (errorMessage.includes("API_KEY_INVALID") || errorMessage.includes("API key not valid") || errorMessage.includes("MISSING_API_KEY")) {
              throw new Error("ERROR_CLAVE_API: La clave de API de Gemini no es válida o no está configurada. Por favor, verifica tu configuración en AI Studio.");
          }
          throw new Error(errorMessage);
        }

        const result = await response.json();
        const base64Audio = result.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
        if (!base64Audio) {
            throw new Error("No audio data received from API.");
        }
        return base64Audio;
    } catch(error) {
        console.error("Error generating speech:", error);
        throw error;
    }
}

export const testConnection = async (): Promise<boolean> => {
    try {
        const response = await callGemini([{ role: 'user', parts: [{ text: 'hola' }] }], 'Responde con la palabra "OK" únicamente.', { thinkingMode: false });
        return response.text?.trim().toUpperCase().includes('OK') || false;
    } catch (error) {
        console.error("Connection test failed:", error);
        return false;
    }
};
