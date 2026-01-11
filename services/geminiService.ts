
import { GoogleGenAI, Type } from "@google/genai";
import { CalculationInput, AIAdvice, VisionReport } from "../types.ts";

export const getAgriculturalAdvice = async (input: CalculationInput): Promise<AIAdvice | null> => {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    // Construcción de la lista de insumos con sus precios y unidades para que la IA los analice
    const productList = input.selectedProducts.map(p => {
      const unit = input.selectedUnits[p] || 'unidad';
      const price = input.productPrices[p] || 0;
      return `- ${p}: $${price} por ${unit}`;
    }).join("\n");
    
    const isGrass = input.treeType === 'Césped';
    const speciesName = isGrass ? `Grama ${input.grassVariety}` : input.treeType;
    const unitMeasure = isGrass ? input.grassMode : 'plantas';
    
    const textPrompt = `Actúa como un Ph.D. en Agronomía Tropical especializado en suelos de Colombia.
    
    SOLICITUD: Generar un PROTOCOLO TÉCNICO DE FERTILIZACIÓN Y RIEGO.
    
    DETALLES TÉCNICOS DEL LOTE:
    - Objetivo: ${input.applicationMode}
    - Especie: ${speciesName}
    - Magnitud: ${input.numTrees} ${unitMeasure}
    - Tipo de Suelo: ${input.soilType}
    - Clima Actual: ${input.climate}
    - Insumos Seleccionados por el Usuario (Analizar costo/beneficio):
    ${productList}
    
    INSTRUCCIONES PARA EL JSON:
    1. radicularPlan: Pasos de aplicación al suelo usando los insumos sólidos seleccionados.
    2. foliarPlan: Pasos de aplicación foliar usando los insumos líquidos seleccionados.
    3. waterRequirement: Volumen exacto de agua, frecuencia (ej: cada 2 días) y técnica (ej: aspersión manual).
    4. seasonalAdvice: Advertencia climática para la región.
    5. tips: Consejos para la comunidad agrícola.
    
    IMPORTANTE: Las dosis deben ser realistas para agricultura orgánica. Responde ÚNICAMENTE en JSON.`;

    let parts: any[] = [{ text: textPrompt }];
    if (input.healthPhoto) {
      parts.push({ inlineData: { mimeType: 'image/jpeg', data: input.healthPhoto.split(',')[1] } });
    }

    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: { parts },
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
    console.error("Error en Generación IA:", error);
    return null;
  }
};

export const getIndependentVisionDiagnosis = async (imageBase64: string, targetType: string): Promise<VisionReport | null> => {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const prompt = `Analiza visualmente esta muestra de ${targetType}. Identifica enfermedades, plagas o carencias minerales. Sugiere un tratamiento orgánico. Responde en JSON.`;
    
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
