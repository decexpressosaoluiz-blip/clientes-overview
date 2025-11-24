import { GoogleGenAI, Type } from "@google/genai";
import { ClientData, Sentiment, Client } from "../types";

// Initialize Gemini Client
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const analyzeClientFile = async (fileContent: string, fileName: string): Promise<ClientData[]> => {
  if (!process.env.API_KEY) {
    console.warn("API Key not found. AI features will be disabled.");
    return [];
  }
  // Uso do modelo Lite para respostas rápidas e baixo custo em tarefas simples de extração
  const model = "gemini-2.5-flash-lite";

  const prompt = `
    Você é um analista de dados sênior especializado em Customer Success.
    Analise o seguinte conteúdo de arquivo (extraído de ${fileName}).
    O arquivo contém informações sobre clientes, interações ou vendas.
    
    Seu objetivo é extrair ou inferir uma lista estruturada de clientes.
    Para cada cliente, deduza o sentimento, o risco de churn, uma pontuação de saúde (0-100) e um resumo executivo.
    Se os dados de receita não estiverem explícitos, estime com base no contexto (ou use 0).
    
    Conteúdo do arquivo:
    ${fileContent.substring(0, 20000)} // Limit input to avoid token limits in this demo
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
    
    // Sanitization and mapping to ensure type safety
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
  
  // Uso do modelo PRO com Thinking Mode para insights profundos e não genéricos
  const model = "gemini-3-pro-preview";

  const historySummary = client.history.slice(-5).map(h =>
    `${h.date}: R$${h.value} (${h.origin} -> ${h.destination})`
  ).join('\n');

  const prompt = `
    Você é um estrategista sênior de Customer Success focado em logística e transporte B2B.
    Analise os dados deste cliente especificamente para evitar respostas genéricas como "Mantenha contato".
    Quero ações táticas, baseadas nos números apresentados.

    Dados do Cliente:
    - Nome: ${client.name}
    - Segmento Atual: ${client.segment}
    - Curva ABC: ${client.abcCategory}
    - Saúde: ${client.healthScore} (${client.healthValue}/100)
    - Receita Total (Período): R$ ${client.totalRevenue}
    - Recência: ${client.recency} dias sem comprar
    - Frequência: ${client.totalShipments} envios
    - Ticket Médio: R$ ${client.averageTicket}
    
    Histórico recente de transações:
    ${historySummary}

    Gere EXATAMENTE 3 sugestões estruturadas JSON.
    
    Categorias permitidas:
    - 'opportunity': Para aumento de share-of-wallet ou rotas complementares.
    - 'risk': Se houver queda de frequência ou ticket.
    - 'attention': Mudanças operacionais (ex: troca de origem/destino frequente).
    - 'retention': Ações de blindagem para Curva A.

    Diretrizes de Qualidade:
    1. SEJA ESPECÍFICO: Mencione rotas, valores ou prazos.
    2. EVITE O ÓBVIO: Não diga "ligue para o cliente". Diga "Agende QBR para discutir a queda de 15% no volume da rota X".
    3. Use terminologia de logística se apropriado (frete, rotas, sinistralidade, lead time).
    4. NÃO use termos em inglês (Churn, Cross-sell).
  `;

  try {
    const response = await ai.models.generateContent({
      model: model,
      contents: prompt,
      config: {
        thinkingConfig: { thinkingBudget: 32768 }, // Orçamento alto para raciocínio profundo
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
    return [{
        category: 'attention',
        title: 'Erro na Análise',
        description: 'Não foi possível conectar à IA no momento.'
    }];
  }
};

export const generatePortfolioAnalysis = async (clients: Client[]): Promise<string> => {
  if (!process.env.API_KEY) return "Erro: API Key não configurada no ambiente.";
  
  // Modelo potente para análise massiva de dados
  const model = "gemini-3-pro-preview";

  // 1. Preparar Resumo dos Dados (Contexto)
  const totalRevenue = clients.reduce((acc, c) => acc + c.totalRevenue, 0);
  const activeClients = clients.filter(c => c.recency <= 90).length;
  const churnRiskClients = clients.filter(c => c.recency > 90 && c.recency <= 180).length;
  const lostClients = clients.filter(c => c.recency > 180).length;
  
  // Amostra dos principais clientes para análise detalhada
  const topClients = clients
    .sort((a, b) => b.totalRevenue - a.totalRevenue)
    .slice(0, 100)
    .map(c => ({
      name: c.name,
      revenue: c.totalRevenue,
      shipments: c.totalShipments,
      recency: c.recency, // Dias desde ultima compra
      ticket: c.averageTicket,
      health: c.healthValue,
      origin_sample: c.origin.slice(0, 2),
      destination_sample: c.destination.slice(0, 2)
    }));

  const contextData = {
    columns_available: ["Data", "Origem", "Destino", "Valor (Receita)", "CNPJ", "Nome"],
    portfolio_stats: {
      total_revenue: totalRevenue,
      total_clients: clients.length,
      active_clients: activeClients,
      risk_clients: churnRiskClients,
      lost_clients: lostClients
    },
    top_clients_sample: topClients
  };

  const prompt = `
    Atue como um Diretor de Planejamento Comercial de uma transportadora/logística.
    Sua tarefa é analisar a carteira de clientes abaixo e gerar um relatório executivo de alto nível.
    
    CONTEXTO DOS DADOS (JSON):
    ${JSON.stringify(contextData)}

    Use seu "Thinking Mode" para conectar pontos não óbvios.
    Por exemplo: se a receita está concentrada em poucos clientes (Curva A), alerte sobre risco de dependência.
    Se há muitos clientes com recência > 90 dias, critique a eficiência da equipe de retenção.

    ETAPA 1 — Validação da Base
    Verifique a integridade dos dados (Receita total, volumetria) e aponte inconsistências se houver.

    ETAPA 2 — Análise Profunda
    1. Concentração de Carteira (Pareto): Qual o risco atual de dependência dos Top 10 clientes?
    2. Saúde da Base: A proporção de ativos vs risco vs perdidos é saudável para o setor?
    3. Oportunidades Ocultas: Identifique padrões nos clientes de 'ticket médio alto' que estão entrando em risco.

    ETAPA 3 — Plano de Ação (Report)
    Gere um relatório em Markdown com:
    - **Diagnóstico Executivo**: 2 parágrafos com a situação real da empresa.
    - **Pontos de Alerta Crítico**: Onde estamos perdendo dinheiro?
    - **Recomendações Táticas**: Ações práticas para a equipe comercial (ex: "Campanha de reativação para clientes inativos há 90-120 dias com oferta X").

    REGRAS:
    - Seja direto, duro se necessário, e profissional.
    - Use formatação Markdown (Negrito, Listas, Títulos).
    - Não invente dados que não estão no JSON.
  `;

  try {
    const response = await ai.models.generateContent({
      model: model,
      contents: prompt,
      config: {
        thinkingConfig: { thinkingBudget: 32768 },
      }
    });

    return response.text || "Não foi possível gerar a análise.";
  } catch (error) {
    console.error("Erro na análise de portfólio:", error);
    return "Erro ao conectar com o analista IA. Verifique a chave de API.";
  }
};