
import { GoogleGenAI, Type } from "@google/genai";
import { CalculationInput, AIAdvice, VisionReport, GroundingSource } from "../types.ts";

const extractJson = (text: string) => {
  try {
    const match = text.match(/\{[\s\S]*\}/);
    if (match) {
      return JSON.parse(match[0]);
    }
    return JSON.parse(text);
  } catch (e) {
    console.error("Error al extraer JSON:", e, "Texto original:", text);
    return null;
  }
};

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
    
    UBICACIÓN GEOGRÁFICA:
    - Departamento: ${input.department}
    
    DATOS DEL CULTIVO:
    - Especie: ${speciesName}
    - Objetivo: ${input.applicationMode}
    - Cantidad: ${input.numTrees} ${unitMeasure}
    - Suelo: ${input.soilType}
    - Clima reportado: ${input.climate}
    - Estado de salud: ${input.healthStatus}
    - Insumos disponibles: ${productList}
    
    TAREA:
    Consulta fuentes técnicas colombianas recientes y genera un protocolo de dosificación EXACTO adaptado a ${input.department}. 
    Indica dosis por unidad (${isGrass ? 'metro' : 'árbol'}) y total.
    
    IMPORTANTE: Responde estrictamente en formato JSON siguiendo el esquema proporcionado.`;

    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: { parts: [{ text: textPrompt }] },
      config: {
        tools: [{ googleSearch: {} }],
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

    const text = response.text;
    if (!text) throw new Error("Respuesta vacía de la IA");
    
    const advice = extractJson(text) as AIAdvice;

    // Extraer fuentes de groundingChunks si existen
    const sources: GroundingSource[] = [];
    const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
    if (chunks) {
      chunks.forEach((chunk: any) => {
        if (chunk.web && chunk.web.uri) {
          sources.push({
            title: chunk.web.title || "Fuente técnica",
            uri: chunk.web.uri
          });
        }
      });
    }

    if (advice) {
      advice.sources = sources.length > 0 ? sources : undefined;
    }

    return advice;
  } catch (error) {
    console.error("Error en getAgriculturalAdvice:", error);
    return null;
  }
};

export const getIndependentVisionDiagnosis = async (imageBase64: string, targetType: string): Promise<VisionReport | null> => {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    const prompt = `Actúa como un Patólogo Vegetal experto en cultivos colombianos. Analiza esta imagen de una muestra de ${targetType}.
    Identifica:
    1. Lectura general de la planta (color, turgencia).
    2. Identificación exacta de la plaga o deficiencia nutricional (incluyendo nombre científico si es posible).
    3. Síntomas observados y nivel de severidad.
    4. Un remedio biológico/orgánico detallado para el control inmediato.
    5. Recomendaciones de manejo cultural preventivo.
    
    Responde estrictamente en formato JSON.`;
    
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
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
              },
              required: ["identifiedPest", "symptoms", "severity"]
            },
            biologicalRemedy: {
              type: Type.OBJECT,
              properties: {
                ingredients: { type: Type.ARRAY, items: { type: Type.STRING } },
                preparation: { type: Type.STRING },
                application: { type: Type.STRING }
              },
              required: ["ingredients", "preparation", "application"]
            },
            recommendations: { type: Type.ARRAY, items: { type: Type.STRING } }
          },
          required: ["plantReading", "pestAnalysis", "biologicalRemedy", "recommendations"]
        }
      }
    });

    const text = response.text;
    if (!text) throw new Error("Respuesta vacía de IA Vision");
    return extractJson(text);
  } catch (error) {
    console.error("Error en IA Vision:", error);
    return null;
  }
};
