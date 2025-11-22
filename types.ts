

export enum Segment {
  CHAMPIONS = 'Cliente Fiel',      // Antigo Champions/Loyal
  LOYAL = 'Recorrente',               // Antigo Loyal
  POTENTIAL = 'Potencial',            // Antigo Potential
  AT_RISK = 'Risco de Perda',         // Antigo At Risk
  LOST = 'Inativo/Perdido',           // Antigo Lost
  NEW = 'Novo Cliente'             // Antigo New
}

export enum HealthScore {
  EXCELLENT = 'Excelente',
  GOOD = 'Bom',
  WARNING = 'Atenção',
  CRITICAL = 'Crítico'
}

export enum ABCCategory {
  A = 'Curva A',
  B = 'Curva B',
  C = 'Curva C'
}

export enum Sentiment {
  POSITIVE = 'Positivo',
  NEUTRAL = 'Neutro',
  NEGATIVE = 'Negativo'
}

// Opportunity Tags for Inactive Clients
export type OpportunityTag = 'Frete Premium' | 'Alto Volume' | 'Recuperável' | null;

export interface Transaction {
  date: string;
  value: number;
  origin: string;
  destination: string;
  // Campos otimizados para filtragem O(1)
  year: number; 
  month: number;
}

export interface Client {
  id: string;
  name: string; // Coluna F
  cnpj: string; // Coluna E
  
  // Histórico completo para cálculos dinâmicos
  history: Transaction[];

  // Totais (serão recalculados baseados nos filtros)
  totalRevenue: number; 
  totalShipments: number; 
  
  lastShipmentDate: string; // A data mais recente global (para cálculo de churn real)
  firstShipmentDate: string;
  origin: string[]; 
  destination: string[]; 
  
  // Calculated Fields
  recency: number; // Dias desde o último envio
  frequency: number; // Quantidade de envios
  monetary: number; // Valor total (no período filtrado)
  averageTicket: number;
  
  segment: Segment;
  abcCategory: ABCCategory;
  healthScore: HealthScore;
  healthValue: number; // 0-100
  opportunityTag?: OpportunityTag;
}

export interface ClientData {
  id: string;
  name: string;
  email: string;
  revenue: number;
  status: 'Active' | 'Churn Risk' | 'Inactive';
  sentiment: Sentiment;
  lastInteraction: string;
  summary: string;
  tags: string[];
  score: number;
}

export interface ClientAlert {
  id: string;
  clientId: string;
  clientName: string;
  type: 'ticket_drop' | 'frequency_drop' | 'anomaly';
  message: string;
  severity: 'high' | 'medium';
  metric: string; // ex: "-30%"
  client: Client; // Referência completa para abrir modal
}

export interface FilterState {
  years: number[];
  months: number[];
  clients: string[]; // IDs
  origins: string[];
  destinations: string[];
  segments: Segment[];
}

export interface ChartDataPoint {
  name: string;
  date: string;
  revenue: number | null;
  projectedRevenue: number | null;
  isProjection: boolean;
}

export interface ProcessResult {
  clients: Client[];
  referenceDate: Date;
  chartData: ChartDataPoint[];
  availableOrigins: string[];
  availableDestinations: string[];
}

export interface ComparisonData {
  key: string;
  revenue: number;
  shipments: number;
}

export interface UploadStatus {
  isUploading: boolean;
  fileName: string | null;
}