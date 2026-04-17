import { GoogleGenAI } from "@google/genai";

const getApiKey = () => {
  return import.meta.env.VITE_GEMINI_API_KEY || (process.env as any).GEMINI_API_KEY || "";
};

const ai = new GoogleGenAI({ apiKey: getApiKey() });

export const chatWithGemini = async (message: string, userName: string) => {
  const key = getApiKey();
  if (!key) {
    return "Gemini API key is not configured. Please ensure VITE_GEMINI_API_KEY is set in your deployment environment.";
  }
  
  const systemInstruction = `You are a helpful AI assistant talking to ${userName}. Keep responses concise and helpful.`;
  
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: message,
      config: {
        systemInstruction: systemInstruction
      }
    });

    return response.text || "I'm sorry, I'm having trouble thinking right now.";
  } catch (error) {
    console.error("Gemini Error:", error);
    return "I'm sorry, I encountered an error while processing your request.";
  }
};
