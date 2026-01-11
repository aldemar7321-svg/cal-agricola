
import { GoogleGenAI, Type } from "@google/genai";
import { CalculationInput, AIAdvice, VisionReport } from "../types.ts";

export const getAgriculturalAdvice = async (input: CalculationInput): Promise<AIAdvice | null> => {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    const productList = input.selectedProducts.map(p => {
      const unit = input.selectedUnits[p] || 'unidad';
      const price = input.productPrices[p] || 0;
      return `- ${p}: $${price} por ${unit}`;
    }).join("\n");
    
    const isGrass = input.treeType === 'Césped';
    const speciesName = isGrass ? `Grama ${input.grassVariety}` : input.treeType;
    const unitMeasure = isGrass ? input.grassMode : 'plantas';
    
    const textPrompt = `Actúa como un experto en agronomía orgánica de precisión en Colombia.
    
    DATOS DEL CULTIVO:
    - Especie: ${speciesName}
    - Objetivo: ${input.applicationMode}
    - Cantidad: ${input.numTrees} ${unitMeasure}
    - Suelo: ${input.soilType}
    - Clima: ${input.climate}
    - Insumos: ${productList}
    
    TAREA:
    Genera un protocolo de dosificación EXACTO. Debes indicar cuántos gramos/cc de cada producto usar por cada ${isGrass ? 'metro' : 'árbol'} y en total para el lote.
    
    INSTRUCCIONES JSON:
    1. radicularPlan: Dosis recomendadas por insumo sólido.
    2. foliarPlan: Dosis recomendadas por insumo líquido.
    3. waterRequirement: Plan de riego.
    4. tips: Recomendaciones prácticas.
    
    Responde solo en JSON.`;

    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: { parts: [{ text: textPrompt }] },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            tips: { type: Type.ARRAY, items: { type: Type.STRING } },
            seasonalAdvice: { type: Type.STRING },
            sustainabilityScore: { type: Type.NUMBER },
            soilAnalysis: { type: Type.STRING },
            waterRequirement: {
              type: Type.OBJECT,
              properties: {
                volume: { type: Type.STRING },
                frequency: { type: Type.STRING },
                technique: { type: Type.STRING }
              },
              required: ["volume", "frequency", "technique"]
            },
            radicularPlan: { 
              type: Type.ARRAY, 
              items: { 
                type: Type.OBJECT,
                properties: {
                  item: { type: Type.STRING },
                  dosage: { type: Type.STRING },
                  purpose: { type: Type.STRING }
                }
              } 
            },
            foliarPlan: { 
              type: Type.ARRAY, 
              items: { 
                type: Type.OBJECT,
                properties: {
                  item: { type: Type.STRING },
                  dosage: { type: Type.STRING },
                  purpose: { type: Type.STRING }
                }
              } 
            },
            elementalFormulation: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  element: { type: Type.STRING },
                  relevance: { type: Type.STRING },
                  priority: { type: Type.STRING },
                  requirementLevel: { type: Type.NUMBER }
                }
              }
            }
          },
          required: ["tips", "seasonalAdvice", "sustainabilityScore", "soilAnalysis", "radicularPlan", "foliarPlan", "waterRequirement", "elementalFormulation"],
        },
      },
    });

    return JSON.parse(response.text.trim());
  } catch (error) {
    return null;
  }
};

export const getIndependentVisionDiagnosis = async (imageBase64: string, targetType: string): Promise<VisionReport | null> => {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const prompt = `Analiza esta imagen de ${targetType}. Identifica plagas o deficiencias. Responde en JSON.`;
    
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: {
        parts: [
          { text: prompt },
          { inlineData: { mimeType: 'image/jpeg', data: imageBase64.split(',')[1] } }
        ]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            plantReading: { type: Type.STRING },
            pestAnalysis: {
              type: Type.OBJECT,
              properties: {
                identifiedPest: { type: Type.STRING },
                scientificName: { type: Type.STRING },
                symptoms: { type: Type.STRING },
                severity: { type: Type.STRING }
              }
            },
            biologicalRemedy: {
              type: Type.OBJECT,
              properties: {
                ingredients: { type: Type.ARRAY, items: { type: Type.STRING } },
                preparation: { type: Type.STRING },
                application: { type: Type.STRING }
              }
            },
            recommendations: { type: Type.ARRAY, items: { type: Type.STRING } }
          }
        }
      }
    });

    return JSON.parse(response.text.trim());
  } catch (error) {
    return null;
  }
};
