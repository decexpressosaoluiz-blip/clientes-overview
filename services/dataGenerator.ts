import { Client, Segment, ABCCategory, HealthScore, FilterState, ProcessResult, OpportunityTag, ChartDataPoint, ClientAlert } from "../types";
import { parseISO, differenceInDays, format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

// URL da Planilha Pública (Exportação CSV)
const SHEET_ID = '1tT6SxM22Cf4yTfbAWM3S3CNLf5btfspQElczKVBm_uw';
const GID = '2053409294';
const GOOGLE_SHEET_CSV_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${GID}`;

// --- HELPERS ---

const parseCurrency = (value: string): number => {
  if (!value) return 0;
  const cleanStr = value.replace(/["'R$\s.]/g, '').replace(',', '.');
  return parseFloat(cleanStr) || 0;
};

const parseDateToString = (dateStr: string): string | null => {
  if (!dateStr) return null;
  let clean = dateStr.trim().replace(/"/g, '');
  
  if (clean.includes(' ')) {
      clean = clean.split(' ')[0];
  }
  
  if (clean.includes('/')) {
    const parts = clean.split('/');
    if (parts.length === 3) {
      const day = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10);
      let year = parseInt(parts[2], 10);
      
      if (year < 100) year += 2000;

      if (day > 0 && day <= 31 && month > 0 && month <= 12 && year > 1990 && year < 2100) {
          return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      }
    }
  } 
  else if (clean.includes('-')) {
    const parts = clean.split('-');
    if (parts.length === 3 && parts[0].length === 4) {
        return clean;
    }
  }
  return null;
};

const splitCSVLine = (line: string): string[] => {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    const separator = line.includes(';') ? ';' : ',';

    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
            inQuotes = !inQuotes;
        } else if (char === separator && !inQuotes) {
            result.push(current.trim().replace(/^"|"$/g, ''));
            current = '';
        } else {
            current += char;
        }
    }
    result.push(current.trim().replace(/^"|"$/g, ''));
    return result;
};

// --- FETCH ---
export const fetchGoogleSheetData = async (): Promise<Client[]> => {
  try {
    console.log("Fetching data from Google Sheets...");
    const response = await fetch(GOOGLE_SHEET_CSV_URL);
    
    if (!response.ok) {
      throw new Error(`Erro ao acessar planilha: ${response.statusText}`);
    }
    
    const csvText = await response.text();
    return parseCSVText(csvText);

  } catch (error) {
    console.error("Falha no carregamento automático:", error);
    return []; 
  }
};

export const parseCSVData = async (file: File): Promise<Client[]> => {
  const text = await file.text();
  return parseCSVText(text);
};

const parseCSVText = (text: string): Client[] => {
  const lines = text.split(/\r\n|\n/);
  const clientsMap = new Map<string, Partial<Client>>();

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;

    const cols = splitCSVLine(line);
    if (cols.length < 5) continue;

    const dateStr = cols[0];
    const origin = cols[1] || 'N/A';
    const destination = cols[2] || 'N/A';
    const value = parseCurrency(cols[3]);
    const cnpj = cols[4];
    const name = cols[5] || cnpj;

    if (!cnpj || cnpj === 'N/I') continue;

    const cleanCnpj = cnpj.replace(/\D/g, '');
    const clientKey = cleanCnpj || cnpj;

    if (!clientsMap.has(clientKey)) {
      clientsMap.set(clientKey, {
        id: clientKey,
        name: name,
        cnpj: cnpj,
        history: [], 
        origin: [],
        destination: [],
        firstShipmentDate: undefined, 
        lastShipmentDate: undefined
      });
    }

    const client = clientsMap.get(clientKey)!;
    const dateIsoString = parseDateToString(dateStr); // YYYY-MM-DD
    
    if (dateIsoString) {
        const [yStr, mStr] = dateIsoString.split('-');
        const year = parseInt(yStr, 10);
        const month = parseInt(mStr, 10);

        client.history?.push({
            date: dateIsoString,
            value: value,
            origin: origin,
            destination: destination,
            year: year,
            month: month
        });

        if (!client.lastShipmentDate || dateIsoString > client.lastShipmentDate) {
            client.lastShipmentDate = dateIsoString;
        }
        if (!client.firstShipmentDate || dateIsoString < client.firstShipmentDate) {
            client.firstShipmentDate = dateIsoString;
        }
    }

    if (origin && origin !== 'N/A' && !client.origin?.includes(origin)) client.origin?.push(origin);
    if (destination && destination !== 'N/A' && !client.destination?.includes(destination)) client.destination?.push(destination);
  }

  const clients: Client[] = Array.from(clientsMap.values()).map(c => {
      const cl = c as Client;
      const nowStr = new Date().toISOString().split('T')[0];
      if (!cl.lastShipmentDate) cl.lastShipmentDate = nowStr;
      if (!cl.firstShipmentDate) cl.firstShipmentDate = nowStr;
      
      return {
          ...cl,
          totalRevenue: 0, 
          totalShipments: 0,
          recency: 0,
          frequency: 0,
          monetary: 0,
          averageTicket: 0,
          segment: Segment.NEW,
          abcCategory: ABCCategory.C,
          healthScore: HealthScore.WARNING,
          healthValue: 50
      };
  });

  return clients;
};

export const generateMockData = async (): Promise<Client[]> => {
  const realData = await fetchGoogleSheetData();
  if (realData.length > 0) return realData;
  return [];
};

// --- OTIMIZAÇÃO DO PROCESSAMENTO ---

const calculateProjections = (
  historicalData: {date: string, value: number}[], 
  maxDateStr: string
): ChartDataPoint[] => {
  if (historicalData.length < 1) return [];

  // Ordenar para o gráfico linear
  const sorted = historicalData.sort((a, b) => a.date.localeCompare(b.date));
  const chartPoints: ChartDataPoint[] = [];

  const monthlyReal = new Map<string, number>();
  sorted.forEach(d => {
      const key = d.date.substring(0, 7); // YYYY-MM
      const val = monthlyReal.get(key) || 0;
      monthlyReal.set(key, val + d.value);
  });

  const sortedKeys = Array.from(monthlyReal.keys()).sort();
  
  // Construir pontos históricos
  sortedKeys.forEach(key => {
      const [y, m] = key.split('-').map(Number);
      const dateObj = new Date(y, m - 1, 1);
      chartPoints.push({
          name: format(dateObj, 'MMM/yy', { locale: ptBR }),
          date: key,
          revenue: monthlyReal.get(key) || 0,
          projectedRevenue: null,
          isProjection: false
      });
  });

  // --- LÓGICA DE PROJEÇÃO CONSERVADORA ---
  // Baseada em média ponderada dos últimos 6 meses para maior estabilidade
  const historyLen = chartPoints.length;
  const monthsToConsider = Math.min(6, historyLen);
  let weightedSum = 0;
  let weightTotal = 0;

  for (let i = 0; i < monthsToConsider; i++) {
      const point = chartPoints[historyLen - 1 - i];
      const weight = monthsToConsider - i; // Meses mais recentes têm mais peso
      weightedSum += (point.revenue || 0) * weight;
      weightTotal += weight;
  }

  const weightedAvg = weightTotal > 0 ? weightedSum / weightTotal : 0;

  // Safety Margin: Reduz a base de previsão em 15% para garantir conservadorismo
  const SAFETY_MARGIN = 0.85; 
  let baseValue = weightedAvg * SAFETY_MARGIN;

  // Data Inicial para Projeção
  const lastRealKey = sortedKeys[sortedKeys.length - 1];
  let [py, pm] = lastRealKey ? lastRealKey.split('-').map(Number) : [new Date().getFullYear(), new Date().getMonth() + 1];

  // Link visual: O último ponto real conecta com a projeção
  if (chartPoints.length > 0) {
      chartPoints[chartPoints.length - 1].projectedRevenue = chartPoints[chartPoints.length - 1].revenue;
  }

  // Gerar 12 meses de projeção
  for (let i = 1; i <= 12; i++) {
      pm++;
      if (pm > 12) { pm = 1; py++; }
      const mIndex = pm - 1; // 0 = Jan, 11 = Dez
      
      // Sazonalidade Detalhada (Perfil Logístico Conservador)
      let seasonFactor = 1.0;

      // Q1: Baixa tradicional (Jan/Fev)
      if (mIndex === 0) seasonFactor = 0.85; // Jan
      else if (mIndex === 1) seasonFactor = 0.88; // Fev (Curto)
      else if (mIndex === 2) seasonFactor = 1.00; // Mar

      // Q2: Recuperação
      else if (mIndex === 3) seasonFactor = 1.02; // Abr
      else if (mIndex === 4) seasonFactor = 1.03; // Mai
      else if (mIndex === 5) seasonFactor = 1.00; // Jun

      // Q3: Estabilidade
      else if (mIndex === 6) seasonFactor = 1.02; // Jul
      else if (mIndex === 7) seasonFactor = 1.04; // Ago
      else if (mIndex === 8) seasonFactor = 1.03; // Set

      // Q4: Alta (Black Friday/Natal), mas suavizada para conservadorismo
      else if (mIndex === 9) seasonFactor = 1.08; // Out (Pre-season)
      else if (mIndex === 10) seasonFactor = 1.12; // Nov (Peak)
      else if (mIndex === 11) seasonFactor = 1.06; // Dez (Começo forte, fim fraco)
      
      // Aplicação da Sazonalidade
      const val = baseValue * seasonFactor;

      const pDate = new Date(py, pm - 1, 1);
      chartPoints.push({
          name: format(pDate, 'MMM/yy', { locale: ptBR }),
          date: `${py}-${String(pm).padStart(2, '0')}`,
          revenue: null,
          projectedRevenue: val,
          isProjection: true
      });
  }

  return chartPoints;
};

// --- DETECÇÃO DE ANOMALIAS (Curva A Ativa) ---
export const generateClientAlerts = (clients: Client[]): ClientAlert[] => {
    const alerts: ClientAlert[] = [];

    // Focar APENAS em Curva A que possui Fluxo Ativo (Recência <= 30 dias)
    const topActiveClients = clients.filter(c => 
        c.abcCategory === ABCCategory.A && 
        c.recency <= 30
    );

    topActiveClients.forEach(client => {
        const sortedHistory = [...client.history].sort((a, b) => a.date.localeCompare(b.date));
        
        // 1. Anomalia de Ticket (Média dos últimos 3 envios vs Média Global)
        const last3Shipments = sortedHistory.slice(-3);
        
        if (last3Shipments.length > 0 && client.averageTicket > 0) {
            const last3Avg = last3Shipments.reduce((sum, item) => sum + item.value, 0) / last3Shipments.length;
            
            // Se a média recente for < 70% da média global (queda significativa)
            if (last3Avg < (client.averageTicket * 0.7)) {
                 const percentDrop = ((client.averageTicket - last3Avg) / client.averageTicket) * 100;
                 alerts.push({
                    id: `alert-${client.id}-ticket`,
                    clientId: client.id,
                    clientName: client.name,
                    type: 'ticket_drop',
                    severity: 'high',
                    metric: `-${percentDrop.toFixed(0)}%`,
                    message: `Queda abrupta no ticket médio (últimos 3 envios).`,
                    client: client
                 });
            }
        }

        // 2. Anomalia de Frequência (Quebra de Padrão)
        if (sortedHistory.length > 5) {
            const firstDate = parseISO(sortedHistory[0].date);
            const lastDate = parseISO(sortedHistory[sortedHistory.length - 1].date);
            const daysSpan = differenceInDays(lastDate, firstDate);
            const avgInterval = Math.max(1, daysSpan / (sortedHistory.length - 1));
            
            // Tolerância: 3x o intervalo normal ou mínimo de 10 dias para Curva A
            const threshold = Math.max(10, avgInterval * 3);

            if (client.recency > threshold) {
                alerts.push({
                    id: `alert-${client.id}-freq`,
                    clientId: client.id,
                    clientName: client.name,
                    type: 'frequency_drop',
                    severity: 'medium',
                    metric: `${client.recency}d`,
                    message: `Interrupção no fluxo (esperado a cada ~${avgInterval.toFixed(0)}d).`,
                    client: client
                 });
            }
        }
    });

    return alerts;
};

export const processClients = (allClients: Client[], filters: FilterState): ProcessResult => {
  if (allClients.length === 0) {
      return {
          referenceDate: new Date(),
          clients: [],
          chartData: [],
          availableOrigins: [],
          availableDestinations: []
      };
  }

  // Sets para lookup rápido
  const filterYearsSet = new Set(filters.years);
  const filterMonthsSet = new Set(filters.months);
  const filterClientsSet = new Set(filters.clients);
  const filterOriginsSet = new Set(filters.origins);
  const filterDestinationsSet = new Set(filters.destinations);
  const filterSegmentsSet = new Set(filters.segments);

  const hasYearFilter = filterYearsSet.size > 0;
  const hasMonthFilter = filterMonthsSet.size > 0;
  const hasClientFilter = filterClientsSet.size > 0;
  const hasOriginFilter = filterOriginsSet.size > 0;
  const hasDestFilter = filterDestinationsSet.size > 0;
  const hasSegmentFilter = filterSegmentsSet.size > 0;

  // Determinar Data Referência Global
  let maxDateStr = "2000-01-01";
  const allOrigins = new Set<string>();
  const allDestinations = new Set<string>();

  allClients.forEach(c => {
      if (c.lastShipmentDate > maxDateStr) maxDateStr = c.lastShipmentDate;
      c.origin.forEach(o => allOrigins.add(o));
      c.destination.forEach(d => allDestinations.add(d));
  });

  const referenceDate = parseISO(maxDateStr);
  const processedClients: Client[] = [];
  const globalFilteredHistory: {date: string, value: number}[] = [];

  // Loop Principal
  for (let i = 0; i < allClients.length; i++) {
      const client = allClients[i];

      if (hasClientFilter && !filterClientsSet.has(client.id)) continue;

      let filteredRevenue = 0;
      let filteredShipments = 0;
      const currentClientHistory: {date: string, value: number}[] = [];

      const history = client.history;
      for (let j = 0; j < history.length; j++) {
          const t = history[j];
          
          if (hasYearFilter && !filterYearsSet.has(t.year)) continue;
          if (hasMonthFilter && !filterMonthsSet.has(t.month)) continue;
          if (hasOriginFilter && !filterOriginsSet.has(t.origin)) continue;
          if (hasDestFilter && !filterDestinationsSet.has(t.destination)) continue;

          filteredRevenue += t.value;
          filteredShipments++;
          currentClientHistory.push({ date: t.date, value: t.value });
      }

      // Se aplicou filtros temporais e não tem resultado, pula (mas mantém se for só filtro de cliente)
      if (filteredRevenue === 0 && (hasYearFilter || hasMonthFilter)) {
           continue;
      }

      for(let k=0; k<currentClientHistory.length; k++) {
          globalFilteredHistory.push(currentClientHistory[k]);
      }

      // Métricas Globais (independente do filtro temporal para segmentação correta)
      const daysSinceLastGlobal = differenceInDays(referenceDate, parseISO(client.lastShipmentDate));
      const daysSinceFirstGlobal = differenceInDays(referenceDate, parseISO(client.firstShipmentDate));
      
      // Score de Saúde
      let score = 50;
      if (daysSinceLastGlobal <= 30) score += 40;
      else if (daysSinceLastGlobal <= 60) score += 20;
      else if (daysSinceLastGlobal > 90) score -= 30;

      const globalTotal = client.history.reduce((acc,t) => acc + t.value, 0);
      const globalCount = client.history.length;
      const globalTicket = globalCount > 0 ? globalTotal/globalCount : 0;
      
      if (globalTicket > 5000) score += 10;
      score = Math.max(0, Math.min(100, score));

      let health = HealthScore.WARNING;
      if (score >= 80) health = HealthScore.EXCELLENT;
      else if (score >= 60) health = HealthScore.GOOD;
      else if (score <= 30) health = HealthScore.CRITICAL;

      // --- LÓGICA DE SEGMENTAÇÃO CORRIGIDA ---
      // Prioridade: Inatividade > Tempo de Cadastro
      let segment = Segment.POTENTIAL;

      if (daysSinceLastGlobal > 180) {
        segment = Segment.LOST;
      } else if (daysSinceLastGlobal > 90) {
        segment = Segment.AT_RISK;
      } else {
        // Cliente está ATIVO (Recência <= 90 dias)
        // Só agora verificamos se é novo
        if (daysSinceFirstGlobal <= 90) { 
            segment = Segment.NEW;
        } else {
            // Ativo e antigo
            segment = Segment.LOYAL;
        }
      }

      if (hasSegmentFilter && !filterSegmentsSet.has(segment)) {
          continue;
      }

      let opportunityTag: OpportunityTag = null;
      if (daysSinceLastGlobal > 90) {
          if (globalTicket > 10000) opportunityTag = 'Frete Premium';
          else if (globalTotal > 50000) opportunityTag = 'Alto Volume';
          else if (globalCount > 20) opportunityTag = 'Recuperável';
      }

      processedClients.push({
          ...client,
          totalRevenue: filteredRevenue,
          totalShipments: filteredShipments,
          recency: daysSinceLastGlobal,
          monetary: filteredRevenue,
          frequency: filteredShipments,
          averageTicket: filteredShipments > 0 ? filteredRevenue / filteredShipments : 0,
          segment,
          abcCategory: ABCCategory.C, 
          healthScore: health,
          healthValue: Math.floor(score),
          opportunityTag
      });
  }

  processedClients.sort((a, b) => b.totalRevenue - a.totalRevenue);
  
  // Cálculo Curva ABC
  const totalRev = processedClients.reduce((acc, c) => acc + c.totalRevenue, 0);
  let accum = 0;
  for(let i=0; i<processedClients.length; i++) {
      const c = processedClients[i];
      accum += c.totalRevenue;
      const p = totalRev > 0 ? accum / totalRev : 1;
      if (p <= 0.8) c.abcCategory = ABCCategory.A;
      else if (p <= 0.95) c.abcCategory = ABCCategory.B;
      else c.abcCategory = ABCCategory.C;
  }

  const chartData = calculateProjections(globalFilteredHistory, maxDateStr);

  return {
    referenceDate,
    clients: processedClients,
    chartData,
    availableOrigins: Array.from(allOrigins).sort(),
    availableDestinations: Array.from(allDestinations).sort()
  };
};