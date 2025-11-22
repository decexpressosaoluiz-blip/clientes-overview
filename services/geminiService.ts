import { GoogleGenAI, Type } from "@google/genai";
import { ClientData, Sentiment, Client } from "../types";

// Initialize Gemini Client
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const analyzeClientFile = async (fileContent: string, fileName: string): Promise<ClientData[]> => {
  if (!process.env.API_KEY) {
    console.warn("API Key not found. AI features will be disabled.");
    return [];
  }
  const model = "gemini-2.5-flash";

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
  
  const model = "gemini-2.5-flash";

  const historySummary = client.history.slice(-5).map(h =>
    `${h.date}: R$${h.value} (${h.origin} -> ${h.destination})`
  ).join('\n');

  const prompt = `
    Você é um estrategista sênior de Customer Success.
    Analise os dados deste cliente B2B e gere 3 insights ou ações estratégicas.
    
    Dados do Cliente:
    - Nome: ${client.name}
    - Segmento: ${client.segment}
    - Saúde: ${client.healthScore} (${client.healthValue}/100)
    - Receita Total: R$ ${client.totalRevenue}
    - Recência: ${client.recency} dias sem comprar
    - Ticket Médio: R$ ${client.averageTicket}
    
    Histórico recente:
    ${historySummary}

    Gere EXATAMENTE 3 sugestões estruturadas JSON.
    
    Categorias permitidas e seus significados:
    - 'opportunity': Use para "Expansão de Conta" ou "Oferta Complementar" (PROIBIDO usar Upsell/Cross-sell).
    - 'risk': Para risco de perda de cliente ou queda drástica de volume.
    - 'attention': Pontos de atenção operacionais ou mudanças de comportamento.
    - 'retention': Ações de fidelização e relacionamento.

    Regras de Texto:
    1. Use linguagem simples, comercial e direta (Português BR).
    2. PROIBIDO usar termos técnicos em inglês como "Churn", "Upsell", "Cross-sell".
    3. Substitua por "Risco de Saída", "Expansão", "Oferta Complementar".
    
    Seja direto e acionável.
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
  
  const model = "gemini-2.5-flash";

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
    Quero que você atue como um analista avançado de carteira de clientes para melhorar as análises que já existem e adicionar novas.
    
    CONTEXTO DOS DADOS (JSON):
    ${JSON.stringify(contextData)}

    Sua primeira tarefa é validar quais análises são possíveis com os dados disponíveis (veja 'columns_available' no JSON), e só então gerar um relatório completo.

    ETAPA 1 — Validação da Base
    Antes de gerar qualquer análise, faça:
    Liste todas as colunas existentes na base (baseado no JSON acima).
    Verifique quais análises abaixo são possíveis com os dados fornecidos.
    Em cada item, escreva “✓ possível” ou “✗ não possível (falta X dado)”.
    Só avance para a etapa 2 nas análises marcadas como “✓ possível”.

    ETAPA 2 — Realizar as análises possíveis abaixo
    1. Profundidade da Receita (Receita + Margem + Mix)
    Se houver dados de receita e/ou margem:
    Calcule a concentração de receita: quanto % do total representam os TOP clientes.
    Analise o ticket médio.
    (Nota: Margem e Mix de Produtos podem não estar disponíveis, verifique).

    2. Análise de Comportamento e Tendência
    Se existirem dados mensais ou datas de faturamento (temos 'recency' e totais):
    Identifique padrões de frequência.
    Calcule o ticket médio global.
    Destaque clientes com manutenção da recorrência, porém queda no ticket médio (se dedutível).

    3. Risco e Churn – Análise Inteligente
    Caso existam dados de períodos, volumes e histórico:
    Estime a probabilidade de churn baseada na Recência (dias sem comprar).
    Identifique clientes em pré-churn com alertas claros.
    Cruze tempo desde o último faturamento x curva ABC para destacar grandes clientes sumindo.

    4. Reativação – Análise Avançada
    Se houver dados de reativação ou datas de última compra:
    Calcule o potencial de reativação baseado em Último faturamento e Histórico.
    Classifique clientes inativos por potencial de retorno.

    5. Segmentação Inteligente (Clusters)
    Se houver dados suficientes:
    Execute uma análise mental de clusterização baseada em Valor (Revenue) x Frequência (Shipments).
    Nomeie clusters como: 'Campeões', 'Baleias (Alto Valor/Baixa Freq)', 'Formigas (Baixo Valor/Alta Freq)', 'Em Risco'.
    Gere insights práticos para cada cluster.

    ETAPA 3 — Entrega Final
    Organize a resposta nos seguintes blocos (Use Markdown para formatar):
    1. Validação dos dados da base.
    2. Resumo executivo da carteira (insights principais).
    3. Tabelas/Listas das análises possíveis (Use tabelas Markdown).
    4. Alertas importantes (clientes em pré-churn, anomalias).
    5. Sugestões de ação comercial por Cluster.

    REGRAS IMPORTANTES
    Nunca gere erro caso algum dado não exista. Apenas indique que a análise não é possível.
    Só execute análises marcadas como “✓ possível”.
    Mantenha clareza, precisão e visão analítica de alto nível.
    Substitua termos técnicos como Upsell e Cross-sell por termos mais naturais em português (ex: Expansão, Oferta Complementar).
  `;

  try {
    const response = await ai.models.generateContent({
      model: model,
      contents: prompt,
    });

    return response.text || "Não foi possível gerar a análise.";
  } catch (error) {
    console.error("Erro na análise de portfólio:", error);
    return "Erro ao conectar com o analista IA. Verifique a chave de API.";
  }
};