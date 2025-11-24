import { GoogleGenAI, Type } from "@google/genai";
import { ClientData, Sentiment, Client } from "../types";

// Initialize Gemini Client
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const analyzeClientFile = async (fileContent: string, fileName: string): Promise<ClientData[]> => {
  if (!process.env.API_KEY) {
    console.warn("API Key not found. AI features will be disabled.");
    return [];
  }
  // Uso do modelo Lite para respostas rápidas
  const model = "gemini-2.5-flash-lite";

  const prompt = `
    Você é um analista de dados sênior especializado em Customer Success.
    Analise o seguinte conteúdo de arquivo (extraído de ${fileName}).
    
    Seu objetivo é extrair ou inferir uma lista estruturada de clientes.
    Para cada cliente, deduza o sentimento, o risco de churn, uma pontuação de saúde (0-100) e um resumo executivo.
    Se os dados de receita não estiverem explícitos, estime com base no contexto (ou use 0).
    
    Conteúdo do arquivo (Amostra):
    ${fileContent.substring(0, 15000)}
  `;

  try {
    const response = await ai.models.generateContent({
      model: model,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              id: { type: Type.STRING },
              name: { type: Type.STRING },
              email: { type: Type.STRING },
              revenue: { type: Type.NUMBER },
              status: { type: Type.STRING, enum: ['Active', 'Churn Risk', 'Inactive'] },
              sentiment: { type: Type.STRING, enum: ['Positivo', 'Neutro', 'Negativo'] },
              lastInteraction: { type: Type.STRING },
              summary: { type: Type.STRING },
              tags: { type: Type.ARRAY, items: { type: Type.STRING } },
              score: { type: Type.NUMBER },
            },
            required: ['name', 'status', 'sentiment', 'score', 'summary'],
          },
        },
      },
    });

    const rawText = response.text;
    if (!rawText) return [];
    
    const parsedData = JSON.parse(rawText) as any[];
    
    return parsedData.map((item, index) => ({
        id: item.id || `gen-${Date.now()}-${index}`,
        name: item.name || "Cliente Desconhecido",
        email: item.email || "nao-informado@exemplo.com",
        revenue: item.revenue || 0,
        status: (item.status as any) || 'Active',
        sentiment: (item.sentiment as Sentiment) || Sentiment.NEUTRAL,
        lastInteraction: item.lastInteraction || new Date().toISOString().split('T')[0],
        summary: item.summary || "Sem resumo disponível.",
        tags: item.tags || [],
        score: item.score || 50
    }));

  } catch (error) {
    console.error("Erro na análise Gemini:", error);
    throw new Error("Falha ao analisar o arquivo com IA.");
  }
};

export interface InsightResult {
  category: 'opportunity' | 'risk' | 'attention' | 'retention';
  title: string;
  description: string;
}

export const generateClientInsights = async (client: Client): Promise<InsightResult[]> => {
  if (!process.env.API_KEY) return [{ category: 'attention', title: 'API Key Missing', description: 'Configure a chave de API no Vercel.' }];
  
  // Modelo avançado com Thinking para insights não genéricos
  const model = "gemini-3-pro-preview";

  const historySummary = client.history.slice(-10).map(h =>
    `${h.date}: R$${h.value} (${h.origin} -> ${h.destination})`
  ).join('\n');

  const prompt = `
    Analise este cliente de logística B2B.
    Evite obviedades. Quero insights táticos e numéricos.

    Cliente: ${client.name}
    Segmento: ${client.segment} (Score: ${client.healthValue})
    Receita Total: R$ ${client.totalRevenue}
    Recência: ${client.recency} dias
    Ticket Médio: R$ ${client.averageTicket}
    
    Transações Recentes:
    ${historySummary}

    Gere 3 sugestões JSON.
    Category: 'opportunity' | 'risk' | 'attention' | 'retention'.
  `;

  try {
    const response = await ai.models.generateContent({
      model: model,
      contents: prompt,
      config: {
        thinkingConfig: { thinkingBudget: 32768 },
        responseMimeType: "application/json",
        responseSchema: {
            type: Type.ARRAY,
            items: { 
                type: Type.OBJECT,
                properties: {
                    category: { type: Type.STRING, enum: ['opportunity', 'risk', 'attention', 'retention'] },
                    title: { type: Type.STRING },
                    description: { type: Type.STRING }
                },
                required: ['category', 'title', 'description']
            }
        }
      }
    });

    const rawText = response.text;
    if (!rawText) return [];
    
    return JSON.parse(rawText) as InsightResult[];

  } catch (error) {
    console.error("Erro ao gerar insights do cliente:", error);
    return [];
  }
};

export const generatePortfolioAnalysis = async (clients: Client[]): Promise<string> => {
  if (!process.env.API_KEY) return "Erro: API Key não configurada.";
  
  const model = "gemini-3-pro-preview";

  const totalRevenue = clients.reduce((acc, c) => acc + c.totalRevenue, 0);
  const activeClients = clients.filter(c => c.recency <= 90).length;
  
  const topClients = clients
    .sort((a, b) => b.totalRevenue - a.totalRevenue)
    .slice(0, 50)
    .map(c => ({
      name: c.name,
      revenue: c.totalRevenue,
      shipments: c.totalShipments,
      recency: c.recency,
      health: c.healthValue
    }));

  const contextData = {
    portfolio_stats: {
      total_revenue: totalRevenue,
      total_clients: clients.length,
      active_clients: activeClients,
    },
    top_clients_sample: topClients
  };

  const prompt = `
    Analise esta carteira de clientes de logística.
    Gere um relatório executivo em Markdown.
    Seja crítico e direto. Foque em riscos de concentração e oportunidades perdidas.
    
    DADOS JSON:
    ${JSON.stringify(contextData)}
  `;

  try {
    const response = await ai.models.generateContent({
      model: model,
      contents: prompt,
      config: {
        thinkingConfig: { thinkingBudget: 32768 },
      }
    });

    return response.text || "Análise indisponível.";
  } catch (error) {
    console.error("Erro na análise de portfólio:", error);
    return "Erro de conexão com IA.";
  }
};