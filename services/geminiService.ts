
import { GoogleGenAI, Type } from "@google/genai";
import { CalculationInput, AIAdvice } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || "" });

export const getAgriculturalAdvice = async (input: CalculationInput): Promise<AIAdvice | null> => {
  try {
    const productList = input.selectedProducts.join(", ");
    const prompt = `
      Actúa como un agrónomo experto en agricultura orgánica regenerativa. 
      Analiza una mezcla de los siguientes productos: [${productList}] para ser aplicados en un cultivo de ${input.treeType}.
      Datos del cultivo:
      - Edad: ${input.treeAge} años.
      - Estado actual de salud: ${input.healthStatus}.
      - Objetivo: Nutrición balanceada y recuperación del suelo.
      
      Proporciona:
      1. 3 consejos de aplicación técnica específicos para esta combinación de productos.
      2. Una recomendación sobre el momento ideal de aplicación (fenología).
      3. Una puntuación de sostenibilidad del 1 al 10.
    `;

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            tips: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: "3 consejos prácticos.",
            },
            seasonalAdvice: {
              type: Type.STRING,
              description: "Recomendación basada en el ciclo del cultivo.",
            },
            sustainabilityScore: {
              type: Type.NUMBER,
              description: "Puntuación de 1 a 10.",
            },
          },
          required: ["tips", "seasonalAdvice", "sustainabilityScore"],
        },
      },
    });

    if (response.text) {
      return JSON.parse(response.text.trim());
    }
    return null;
  } catch (error) {
    console.error("Gemini API Error:", error);
    return null;
  }
};
