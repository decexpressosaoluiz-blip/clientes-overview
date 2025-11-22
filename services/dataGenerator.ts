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
        // OTIMIZAÇÃO: Calcular ano e mês no parse inicial
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

  // Ordenar é necessário para o gráfico linear
  const sorted = historicalData.sort((a, b) => a.date.localeCompare(b.date));
  const chartPoints: ChartDataPoint[] = [];

  const monthlyReal = new Map<string, number>();
  sorted.forEach(d => {
      const key = d.date.substring(0, 7); // YYYY-MM
      const val = monthlyReal.get(key) || 0;
      monthlyReal.set(key, val + d.value);
  });

  const sortedKeys = Array.from(monthlyReal.keys()).sort();
  
  // Converter Map para Array final
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

  // Projeção Simples (Média Móvel + Sazonalidade Básica)
  const lastRealKey = sortedKeys[sortedKeys.length - 1];
  let [py, pm] = lastRealKey ? lastRealKey.split('-').map(Number) : [new Date().getFullYear(), new Date().getMonth() + 1];
  
  const last3 = chartPoints.slice(-3);
  const avg = last3.reduce((acc, p) => acc + (p.revenue || 0), 0) / Math.max(1, last3.length);
  let baseValue = avg || 0;

  // Link visual
  if (chartPoints.length > 0) {
      chartPoints[chartPoints.length - 1].projectedRevenue = chartPoints[chartPoints.length - 1].revenue;
  }

  for (let i = 1; i <= 12; i++) {
      pm++;
      if (pm > 12) { pm = 1; py++; }
      const mIndex = pm - 1;
      
      // Fatores de Sazonalidade Típicos de Transporte
      let seasonFactor = 1.0;
      if (mIndex === 9 || mIndex === 10) seasonFactor = 1.15; // Black Friday / Estoque Natal
      if (mIndex === 11) seasonFactor = 1.10; 
      if (mIndex === 0) seasonFactor = 0.85; 
      
      baseValue = baseValue * 1.005; 
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
        // Usar últimos 3 evita alertas falsos por um envio pequeno isolado.
        const last3Shipments = sortedHistory.slice(-3);
        
        if (last3Shipments.length > 0 && client.averageTicket > 0) {
            const last3Avg = last3Shipments.reduce((sum, item) => sum + item.value, 0) / last3Shipments.length;
            
            // Se a média recente for < 70% da média global (queda de 30%)
            if (last3Avg < (client.averageTicket * 0.7)) {
                 const percentDrop = ((client.averageTicket - last3Avg) / client.averageTicket) * 100;
                 alerts.push({
                    id: `alert-${client.id}-ticket`,
                    clientId: client.id,
                    clientName: client.name,
                    type: 'ticket_drop',
                    severity: 'high',
                    metric: `-${percentDrop.toFixed(0)}%`,
                    message: `Queda no ticket médio (últimos 3 envios).`,
                    client: client
                 });
            }
        }

        // 2. Anomalia de Frequência (Quebra de Padrão Individual)
        // Se o cliente tem histórico, calculamos seu "Intervalo Médio" entre compras
        if (sortedHistory.length > 5) {
            const firstDate = parseISO(sortedHistory[0].date);
            const lastDate = parseISO(sortedHistory[sortedHistory.length - 1].date);
            const daysSpan = differenceInDays(lastDate, firstDate);
            const avgInterval = Math.max(1, daysSpan / (sortedHistory.length - 1));
            
            // Se a recência atual for > 3x o intervalo normal dele (e maior que 3 dias absolutos)
            // Ex: Compra a cada 2 dias, está há 7 dias sem comprar -> Alerta
            if (client.recency > 3 && client.recency > (avgInterval * 3)) {
                alerts.push({
                    id: `alert-${client.id}-freq`,
                    clientId: client.id,
                    clientName: client.name,
                    type: 'frequency_drop',
                    severity: 'medium',
                    metric: `${client.recency}d`,
                    message: `Quebra de recorrência (cliente usualmente envia a cada ${avgInterval.toFixed(0)}d).`,
                    client: client
                 });
            } else if (client.recency > 10) {
                 // Fallback: Clientes Curva A parados há mais de 10 dias sempre merecem atenção
                 alerts.push({
                    id: `alert-${client.id}-flow`,
                    clientId: client.id,
                    clientName: client.name,
                    type: 'anomaly',
                    severity: 'medium',
                    metric: `${client.recency}d`,
                    message: `Pausa prolongada no fluxo de envios VIP.`,
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

  // 1. Sets para lookup O(1)
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

  // Determinar Data Referência
  let maxDateStr = "2000-01-01";
  const allOrigins = new Set<string>();
  const allDestinations = new Set<string>();

  // Pré-loop para pegar metadata global (origins/destinations) e MaxDate
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

      // Filtro Rápido de Cliente ID
      if (hasClientFilter && !filterClientsSet.has(client.id)) continue;

      let filteredRevenue = 0;
      let filteredShipments = 0;
      const currentClientHistory: {date: string, value: number}[] = [];

      // Loop Histórico Otimizado
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

      if (filteredRevenue === 0 && (hasYearFilter || hasMonthFilter)) {
           continue;
      }

      for(let k=0; k<currentClientHistory.length; k++) {
          globalFilteredHistory.push(currentClientHistory[k]);
      }

      // Cálculos de Segmentação e Score
      const daysSinceLastGlobal = differenceInDays(referenceDate, parseISO(client.lastShipmentDate));
      const daysSinceFirstGlobal = differenceInDays(referenceDate, parseISO(client.firstShipmentDate));
      
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

      // Segmentação (New logic: based on start date)
      let segment = Segment.POTENTIAL;

      if (daysSinceLastGlobal > 180) {
        segment = Segment.LOST;
      } else if (daysSinceLastGlobal > 90) {
        segment = Segment.AT_RISK;
      } else if (daysSinceFirstGlobal <= 90) { 
        segment = Segment.NEW;
      } else {
        segment = Segment.LOYAL;
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