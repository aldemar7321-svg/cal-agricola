
import { GoogleGenAI, Type } from "@google/genai";
import { CalculationInput, AIAdvice, VisionReport, GroundingSource, OrganicProduct, EntomologyReport } from "../types.ts";

const extractJson = (text: string) => {
  try {
    // Intentar limpiar posibles prefijos de markdown
    const cleanedText = text.replace(/```json/g, "").replace(/```/g, "").trim();
    const match = cleanedText.match(/\{[\s\S]*\}/);
    if (match) {
      return JSON.parse(match[0]);
    }
    return JSON.parse(cleanedText);
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

    const customProductList = input.selectedCustomProductIds.map(id => {
      const custom = input.customProducts.find(cp => cp.id === id);
      if (!custom) return "";
      return `- ${custom.name}: $${input.manualUnitPrices[id] || custom.defaultPrice} por ${input.manualUnits[id] || custom.defaultUnit}. REFERENCIA/FICHA: ${custom.url || 'No URL'} | DATA TÉCNICA: ${custom.technicalData || 'No data'}`;
    }).filter(Boolean).join("\n");
    
    const isGrass = input.treeType === 'Césped';
    const speciesName = isGrass ? `Césped Variety: ${input.grassVariety}` : input.treeType;
    const unitMeasure = isGrass ? `(Medido en ${input.grassMode})` : 'plantas';
    const frequencyInfo = `${input.cycleFrequencyValue} ${input.cycleFrequencyUnit}`;

    const soilAnalysisText = input.soilProfile ? `
    ANÁLISIS DE LABORATORIO (PERFIL):
    - pH: ${input.soilProfile.ph}
    - Materia Orgánica: ${input.soilProfile.organicMatter}%
    - Conductividad Eléctrica: ${input.soilProfile.ec} dS/m
    - N-P-K (si aplica): N:${input.soilProfile.nitrogen || 'N/A'}, P:${input.soilProfile.phosphorus || 'N/A'}, K:${input.soilProfile.potassium || 'N/A'}
    ` : 'Análisis químico de laboratorio no disponible.';
    
    const textPrompt = `Actúa como un experto en agronomía orgánica de precisión en Colombia.
    
    UBICACIÓN GEOGRÁFICA:
    - Departamento: ${input.department}
    
    DATOS DEL CULTIVO:
    - Especie: ${speciesName}
    - Objetivo: ${input.applicationMode}
    - Cantidad: ${input.numTrees} ${unitMeasure}
    - Suelo (Textura): ${input.soilType}
    ${soilAnalysisText}
    - Clima reportado: ${input.climate}
    - Estado de salud: ${input.healthStatus}
    - Insumos Base Disponibles: 
    ${productList}
    
    - INSUMOS PERSONALIZADOS DISPONIBLES (Analiza los links y ficha técnica para integrarlos):
    ${customProductList}
    
    - FRECUENCIA DE APLICACIÓN PLANIFICADA: Cada ${frequencyInfo}
    
    TAREA:
    Consulta fuentes técnicas colombianas recientes (ICA, AGROSAVIA) e investiga los insumos personalizados (si se proveyeron links) para generar un protocolo de dosificación EXACTO.
    
    REGLA CRÍTICA DE DOSIFICACIÓN Y FRECUENCIA:
    Para cada producto en 'radicularPlan' y 'foliarPlan', el campo 'dosage' DEBE indicar la cantidad para UNA SOLA PLANTA (o m2 si es césped) POR APLICACIÓN.
    DEBES AJUSTAR LA DOSIS según la frecuencia reportada (${frequencyInfo}). 
    
    NUEVOS REQUERIMIENTOS:
    1. 'mixCompatibility': Analiza la compatibilidad química y física de los insumos seleccionados. Advierte sobre mezclas prohibidas (ej. Cobre + Microorganismos, Azufre + Jabón en sol, etc).
    2. 'technicalObservations': Observaciones técnicas detalladas sobre el manejo del cultivo.
    3. 'longTermImpact': Impacto esperado a largo plazo en el suelo y la planta bajo este régimen orgánico.

    IMPORTANTE: Responde estrictamente en formato JSON.`;

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
            mixCompatibility: { type: Type.STRING },
            technicalObservations: { type: Type.STRING },
            longTermImpact: { type: Type.STRING },
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
                },
                required: ["item", "dosage", "purpose"]
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
                },
                required: ["item", "dosage", "purpose"]
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
          required: ["tips", "seasonalAdvice", "sustainabilityScore", "soilAnalysis", "radicularPlan", "foliarPlan", "waterRequirement", "elementalFormulation", "mixCompatibility", "technicalObservations", "longTermImpact"],
        },
      },
    });

    const text = response.text;
    if (!text) throw new Error("Respuesta vacía de la IA");
    
    const advice = extractJson(text) as AIAdvice;

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

export const suggestProductMix = async (input: CalculationInput): Promise<OrganicProduct[] | null> => {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const availableProducts = Object.values(OrganicProduct).join(", ");
    
    const isGrass = input.treeType === 'Césped';
    const speciesName = isGrass ? `Césped Variety: ${input.grassVariety}` : input.treeType;

    const prompt = `Actúa como un agrónomo experto en Bio-Tecnología. 
    Basado en el siguiente contexto, selecciona la MEJOR MEZCLA INTELIGENTE de productos orgánicos del listado disponible.
    
    CONTEXTO:
    - Cultivo: ${speciesName} (${isGrass ? 'Medición: ' + input.grassMode : ''})
    - Departamento: ${input.department}
    - Suelo: ${input.soilType}
    - Clima: ${input.climate}
    - Salud: ${input.healthStatus}
    - Objetivo: ${input.applicationMode}
    
    PRODUCTOS DISPONIBLES:
    ${availableProducts}
    
    TAREA:
    Retorna solo un array JSON con los nombres exactos de los productos seleccionados (máximo 5-6 productos) que generen la mejor sinergia para este cultivo.
    Evita mezclas incompatibles.
    
    RETORNA SOLO EL JSON: ["Producto 1", "Producto 2", ...]`;

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: { parts: [{ text: prompt }] },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: { type: Type.STRING }
        }
      }
    });

    const text = response.text;
    if (!text) return null;
    return extractJson(text) as OrganicProduct[];
  } catch (error) {
    console.error("Error en suggestProductMix:", error);
    return null;
  }
};

export const getIndependentVisionDiagnosis = async (imageBase64: string, targetType: string): Promise<VisionReport | null> => {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    const prompt = `Actúa como un Fisiólogo Vegetal experto en nutrición y vigor. Analiza el ESTADO DE SALUD de este ${targetType}.
    CONCÉNTRATE EXCLUSIVAMENTE EN LA PLANTA:
    1. VIGOR FISIOLÓGICO: Turgencia, coloración (clorosis/necrosis), venación.
    2. BALANCE NUTRICIONAL: Deficiencias de N, P, K o microelementos.
    3. ESTRÉS ABIÓTICO: Signos de estrés hídrico o calórico.
    
    PROHIBIDO HABLAR DE INSECTOS O PLAGAS INVERTEBRADAS. Si detectas una enfermedad fúngica o bacteriana, analízala como una patología vegetal pero no como una plaga de insectos.
    
    Responde estrictamente en formato JSON válido según el esquema VisionReport.`;
    
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
            metabolicState: { type: Type.STRING },
            laboratoryCorrelation: { type: Type.STRING },
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
          required: ["plantReading", "metabolicState", "laboratoryCorrelation", "biologicalRemedy", "recommendations"]
        }
      }
    });

    const text = response.text;
    return extractJson(text);
  } catch (error) {
    console.error("Error en Bio-Vision IA:", error);
    return null;
  }
};

export const getInsectIdentification = async (imageBase64: string, targetType: string): Promise<EntomologyReport | null> => {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    const prompt = `Actúa como un Entomólogo Especialista en Manejo Integrado de Plagas (MIP). Identifica el INSECTO o PLAGA en esta muestra de ${targetType}.
    CONCÉNTRATE EXCLUSIVAMENTE EN EL INSECTO/PLAGA:
    1. TAXONOMÍA: Nombre común, científico, Orden y Familia.
    2. ETOLOGÍA: Ciclo de vida y mecanismo de daño (succionador, masticador, etc).
    3. NIVEL DE AMENAZA: Basado en la población visible.
    4. CONTROL BIOLÓGICO: Uso de predadores, parasitoides o microorganismos.
    
    PROHIBIDO ANALIZAR LA NUTRICIÓN O FISIOLOGÍA DE LA PLANTA más allá del daño mecánico causado por el insecto.
    
    Responde estrictamente en formato JSON válido según el esquema EntomologyReport.`;
    
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
            insectDescription: { type: Type.STRING },
            taxonomy: {
              type: Type.OBJECT,
              properties: {
                commonName: { type: Type.STRING },
                scientificName: { type: Type.STRING },
                family: { type: Type.STRING },
                order: { type: Type.STRING }
              },
              required: ["commonName", "scientificName"]
            },
            threatLevel: { type: Type.STRING, enum: ["Leve", "Moderado", "Crítico"] },
            lifeCycle: { type: Type.STRING },
            damageMechanism: { type: Type.STRING },
            hostCompatibility: { type: Type.STRING },
            biologicalControl: {
              type: Type.OBJECT,
              properties: {
                agent: { type: Type.STRING },
                ingredients: { type: Type.ARRAY, items: { type: Type.STRING } },
                preparation: { type: Type.STRING },
                application: { type: Type.STRING }
              },
              required: ["agent", "ingredients", "preparation", "application"]
            },
            integratedManagement: { type: Type.ARRAY, items: { type: Type.STRING } }
          },
          required: ["insectDescription", "taxonomy", "threatLevel", "lifeCycle", "damageMechanism", "hostCompatibility", "biologicalControl", "integratedManagement"]
        }
      }
    });

    const text = response.text;
    return extractJson(text);
  } catch (error) {
    console.error("Error en Entomología IA:", error);
    return null;
  }
};
