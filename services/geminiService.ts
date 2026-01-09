
import { GoogleGenAI, Type } from "@google/genai";
import { CalculationInput, AIAdvice, PlantingFormulaRecommendation, OrganicProduct } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || "" });

export const getAgriculturalAdvice = async (input: CalculationInput): Promise<AIAdvice | null> => {
  try {
    const productList = input.selectedProducts.join(", ");
    const prompt = `
      Actúa como un agrónomo experto en agricultura orgánica regenerativa. 
      Analiza una mezcla de los siguientes productos: [${productList}] para ser aplicados en un cultivo de ${input.treeType}.
      Datos del cultivo y terreno:
      - Tipo de Suelo: ${input.soilType}.
      - Edad del Cultivo: ${input.treeAge} años.
      - Estado actual de salud: ${input.healthStatus}.
      - Objetivo: Nutrición balanceada y recuperación del suelo.
      
      IMPORTANTE: Considera cómo la textura del suelo (${input.soilType}) afecta la retención de estos insumos orgánicos.
      
      Proporciona:
      1. 3 consejos de aplicación técnica específicos para esta combinación de productos y este tipo de suelo.
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

export const getPlantingFormula = async (treeType: string, soilType: string, numPlants: number): Promise<PlantingFormulaRecommendation | null> => {
  try {
    const productsEnumValues = Object.values(OrganicProduct).join(", ");
    const prompt = `
      Eres un agrónomo experto. Recomienda la mejor fórmula orgánica para la etapa de SIEMBRA (establecimiento inicial) de: ${treeType} en un suelo de tipo ${soilType}.
      Hay un total de ${numPlants} plantas a sembrar.
      Debes seleccionar exactamente los productos más beneficiosos de esta lista permitida: [${productsEnumValues}].
      
      Para cada producto seleccionado, indica:
      1. La dosis ideal POR PLANTA (suggestedAmount).
      2. La cantidad TOTAL requerida para las ${numPlants} plantas (totalAmount).
      3. La unidad de medida (g, kg, cc, ml, L).
      4. Razón biológica del insumo.
      
      IMPORTANTE: Solo usa nombres de productos de la lista proporcionada.
    `;

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            explanation: {
              type: Type.STRING,
              description: "Explicación técnica de la mezcla ideal para la siembra y establecimiento."
            },
            items: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  product: {
                    type: Type.STRING,
                    description: "Nombre del producto de la lista."
                  },
                  suggestedAmount: {
                    type: Type.NUMBER,
                    description: "Dosis por planta."
                  },
                  totalAmount: {
                    type: Type.NUMBER,
                    description: "Total para todo el lote de siembra."
                  },
                  unit: {
                    type: Type.STRING,
                    description: "Unidad (g, kg, cc, ml, L)."
                  },
                  reason: {
                    type: Type.STRING,
                    description: "Razón biológica."
                  }
                },
                required: ["product", "suggestedAmount", "totalAmount", "unit", "reason"]
              }
            }
          },
          required: ["explanation", "items"]
        }
      }
    });

    if (response.text) {
      return JSON.parse(response.text.trim());
    }
    return null;
  } catch (error) {
    console.error("Gemini Formula Error:", error);
    return null;
  }
};
