import { GoogleGenAI, Type } from "@google/genai";
import { Keyframe, EffectType } from "../types";

// Helper to get a random ID
const uid = () => Math.random().toString(36).substr(2, 9);

// Safe Environment Accessor to avoid "process is not defined" crashes
const getApiKey = () => {
    try {
        if (typeof process !== 'undefined' && process.env && process.env.API_KEY) {
            return process.env.API_KEY;
        }
        // Fallback for polyfilled window.process
        if (typeof window !== 'undefined' && (window as any).process && (window as any).process.env) {
             return (window as any).process.env.API_KEY;
        }
    } catch (e) {
        console.warn("Error accessing process.env:", e);
    }
    return "";
};

export const generateTideCurveWithAI = async (location: string): Promise<Keyframe[]> => {
  const apiKey = getApiKey();
  if (!apiKey) {
    console.warn("API_KEY not found in environment");
    // Return a mock response if no API key for safety in this demo
    return []; 
  }

  const ai = new GoogleGenAI({ apiKey });
  
  // Default to Moreré if empty
  const loc = location || "Moreré - Ilha de Boipeba - Cairu - BA - Brasil";

  const prompt = `
    Gere uma configuração de tábua de maré para ${loc}.
    Eu preciso de exatamente 5 keyframes espalhados por 24 horas (0 a 24) representando o nível da maré (0-100%).
    Inclua cores hexadecimais apropriadas para o oceano (azuis, verdes água) e efeitos (STATIC, WAVE, PULSE, GLOW).
    Retorne um array JSON.
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              timeOffset: { type: Type.NUMBER, description: "Hora (0-24)" },
              height: { type: Type.NUMBER, description: "Altura Maré 0-100" },
              color: { type: Type.STRING, description: "Cor Hex ex: #00AABB" },
              intensity: { type: Type.NUMBER, description: "Brilho 0-255" },
              effect: { type: Type.STRING, description: "Um de: STATIC, WAVE, PULSE, GLOW" },
            },
            required: ["timeOffset", "height", "color", "intensity", "effect"],
          },
        },
      },
    });

    const rawData = JSON.parse(response.text || "[]");
    
    // Map response to our internal Keyframe type
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const keyframes: Keyframe[] = rawData.map((k: any) => ({
      id: uid(),
      timeOffset: k.timeOffset,
      height: k.height,
      color: k.color,
      intensity: k.intensity,
      effect: (Object.values(EffectType).includes(k.effect) ? k.effect : EffectType.WAVE) as EffectType,
    }));

    // Ensure sorted
    return keyframes.sort((a, b) => a.timeOffset - b.timeOffset);

  } catch (error) {
    console.error("Gemini API Error:", error);
    throw new Error("Falha ao gerar preset com IA");
  }
};

export const generateDisplayImage = async (prompt: string): Promise<string> => {
    const apiKey = getApiKey();
    if (!apiKey) throw new Error("API Key not found");
    
    const ai = new GoogleGenAI({ apiKey });
    
    // Using Nano Banana (gemini-2.5-flash-image) as requested
    // Note: aspect ratio support depends on model, defaults to 1:1 if unspecified
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: {
            parts: [{ text: `Create a circular icon style image, high contrast, flat design, suitable for small embedded display: ${prompt}` }]
        },
        config: {
            imageConfig: {
                aspectRatio: "1:1"
            }
        }
    });
    
    // Extract image from response parts
    for (const part of response.candidates?.[0]?.content?.parts || []) {
        if (part.inlineData) {
            return `data:image/png;base64,${part.inlineData.data}`;
        }
    }
    
    throw new Error("No image generated in response. Please try again.");
};