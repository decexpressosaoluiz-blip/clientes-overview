import { ClientData, Sentiment } from "./types";

export const MOCK_CLIENTS: ClientData[] = [
  {
    id: '1',
    name: 'TechSolutions Ltda',
    email: 'contato@techsolutions.com.br',
    revenue: 12500,
    status: 'Active',
    sentiment: Sentiment.POSITIVE,
    lastInteraction: '2023-10-25',
    summary: 'Cliente em expansão, aumentou o uso da plataforma em 20% este mês. Interessado em novos módulos.',
    tags: ['Expansão', 'SaaS', 'Prioridade'],
    score: 92
  },
  {
    id: '2',
    name: 'Varejo Express',
    email: 'adm@varejoexpress.com',
    revenue: 4200,
    status: 'Churn Risk',
    sentiment: Sentiment.NEGATIVE,
    lastInteraction: '2023-10-20',
    summary: 'Relatou problemas recorrentes de integração. O ticket de suporte está aberto há 3 dias sem resolução.',
    tags: ['Risco', 'Suporte', 'Varejo'],
    score: 35
  },
  {
    id: '3',
    name: 'Consultoria Silva',
    email: 'joao@silvaconsult.com',
    revenue: 8900,
    status: 'Active',
    sentiment: Sentiment.NEUTRAL,
    lastInteraction: '2023-10-22',
    summary: 'Uso estável, sem grandes oscilações. Renovação de contrato prevista para o próximo mês.',
    tags: ['Renovação', 'Serviços'],
    score: 68
  },
    {
    id: '4',
    name: 'Logística Rápida',
    email: 'ops@lograpida.com.br',
    revenue: 15600,
    status: 'Active',
    sentiment: Sentiment.POSITIVE,
    lastInteraction: '2023-10-26',
    summary: 'Feedback extremamente positivo sobre a nova feature de rastreamento.',
    tags: ['Logística', 'Case de Sucesso'],
    score: 88
  }
];