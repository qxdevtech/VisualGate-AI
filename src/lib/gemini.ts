import { GoogleGenAI } from "@google/genai";

const API_KEY = process.env.GEMINI_API_KEY || "";

const ai = new GoogleGenAI({ apiKey: API_KEY });

export const chatWithGemini = async (message: string, userName: string) => {
  if (!API_KEY) {
    return "Gemini API key is not configured. Please add GEMINI_API_KEY to your environment.";
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
