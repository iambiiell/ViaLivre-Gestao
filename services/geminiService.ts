import { GoogleGenAI, Type } from "@google/genai";

const handleGenAIError = (e: any) => {
  console.error("GenAI Error:", e);
  if (e?.status === 403 || e?.message?.includes('403') || e?.message?.includes('Permission Denied')) {
    return "Erro 403: Acesso negado. Por favor, renove sua API Key no painel do Google AI.";
  }
  return null;
};

// Fix: Added missing generateRoutePlan function to resolve export error in RoutePlanner.tsx
export const generateRoutePlan = async (origin: string, destination: string): Promise<any> => {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Planeje uma rota de ônibus entre "${origin}" e "${destination}". Calcule a distância aproximada em KM e o tempo de viagem estimado em minutos. Retorne em JSON com os campos origin, destination, distance_km (número) e duration_minutes (número).`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            origin: { type: Type.STRING },
            destination: { type: Type.STRING },
            distance_km: { type: Type.NUMBER },
            duration_minutes: { type: Type.NUMBER }
          },
          required: ["origin", "destination", "distance_km", "duration_minutes"]
        }
      }
    });

    return response.text ? JSON.parse(response.text) : null;
  } catch (e: any) {
    const customMsg = handleGenAIError(e);
    if (customMsg) throw new Error(customMsg);
    return null;
  }
};

export const estimateMaintenanceCost = async (serviceDescription: string): Promise<{ cost: number, partDetails: string }> => {
    try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        const response = await ai.models.generateContent({
            model: 'gemini-3-pro-preview',
            contents: `Analise o seguinte serviço de manutenção de ônibus: "${serviceDescription}". 
            Identifique: Preço médio estimado total em reais e nome técnico da peça.
            Retorne em JSON com campos 'cost' (number) e 'details' (string).`,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        cost: { type: Type.NUMBER },
                        details: { type: Type.STRING }
                    },
                    required: ["cost", "details"]
                }
            }
        });
        
        if (response.text) {
          const data = JSON.parse(response.text);
          return { cost: data.cost, partDetails: data.details };
        }
        return { cost: 0, partDetails: '' };
    } catch (e: any) { 
        const customMsg = handleGenAIError(e);
        if (customMsg) throw new Error(customMsg);
        return { cost: 0, partDetails: '' }; 
    }
};

export const analyzeIssue = async (description: string): Promise<{ category: string, severity: string, action: string }> => {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview', 
      contents: `Analise a ocorrência: "${description}". Classifique categoria, severidade e ação sugerida.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            category: { type: Type.STRING },
            severity: { type: Type.STRING },
            action: { type: Type.STRING }
          },
          required: ["category", "severity", "action"]
        }
      }
    });
    return response.text ? JSON.parse(response.text) : { category: 'OUTROS', severity: 'BAIXA', action: '' };
  } catch (e: any) { 
    const customMsg = handleGenAIError(e);
    if (customMsg) throw new Error(customMsg);
    return { category: 'OUTROS', severity: 'BAIXA', action: '' }; 
  }
};
