export enum Segment {
  CHAMPIONS = 'Cliente Fiel',
  LOYAL = 'Recorrente',
  POTENTIAL = 'Potencial',
  AT_RISK = 'Risco de Perda',
  LOST = 'Inativo/Perdido',
  NEW = 'Novo Cliente'
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

export type OpportunityTag = 'Frete Premium' | 'Alto Volume' | 'Recuperável' | null;

export type InactivityReason = 'Empresa Fechada' | 'Avaria/Extravio' | 'Mudança de CNPJ' | 'Rota não Atendida' | null;

export interface Transaction {
  date: string;
  value: number;
  origin: string;
  destination: string;
  year: number; 
  month: number;
}

export interface ClientJustification {
  reason: InactivityReason;
  newCnpj?: string;
  date: string;
  user: string;
}

export interface ClientAction {
  id: string;
  date: string; // ISO Date
  user: string; // Quem fez a ação
  contactName: string; // Responsável na empresa
  type: 'Call' | 'Email' | 'Meeting' | 'Whatsapp';
  note: string;
}

export interface Client {
  id: string;
  name: string;
  cnpj: string;
  
  history: Transaction[];

  totalRevenue: number; 
  totalShipments: number; 
  
  lastShipmentDate: string;
  firstShipmentDate: string;
  origin: string[]; 
  destination: string[]; 
  
  recency: number;
  frequency: number;
  monetary: number;
  averageTicket: number;
  
  segment: Segment;
  abcCategory: ABCCategory;
  healthScore: HealthScore;
  healthValue: number;
  opportunityTag?: OpportunityTag;

  justification?: ClientJustification;
  actions?: ClientAction[];
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
  metric: string;
  client: Client;
}

export interface FilterState {
  years: number[];
  months: number[];
  clients: string[];
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