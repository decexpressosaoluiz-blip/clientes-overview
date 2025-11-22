import { Client, Segment, ABCCategory, HealthScore, FilterState, ProcessResult, OpportunityTag, ChartDataPoint, ClientAlert } from "../types";
import { parseISO, differenceInDays, format, subMonths, addMonths, isAfter, isBefore, isValid } from 'date-fns';
import { ptBR } from 'date-fns/locale';

// URL da Planilha Pública (Exportação CSV)
const SHEET_ID = '1tT6SxM22Cf4yTfbAWM3S3CNLf5btfspQElczKVBm_uw';
const GID = '2053409294';
const GOOGLE_SHEET_CSV_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${GID}`;

// --- HELPERS ---

const parseCurrency = (value: string): number => {
  if (!value) return 0;
  // Remove R$, espaços e converte vírgula decimal para ponto
  const cleanStr = value.replace(/["'R$\s]/g, '').replace(/\./g, '').replace(',', '.');
  const floatVal = parseFloat(cleanStr);
  return isNaN(floatVal) ? 0 : floatVal;
};

const parseDateToString = (dateStr: string): string | null => {
  if (!dateStr) return null;
  let clean = dateStr.trim().replace(/["']/g, '');
  
  if (clean.includes(' ')) {
      clean = clean.split(' ')[0];
  }

  // Tentar formatos comuns
  // DD/MM/YYYY ou DD/MM/YY
  if (clean.includes('/')) {
    const parts = clean.split('/');
    if (parts.length === 3) {
      const day = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10);
      let year = parseInt(parts[2], 10);
      
      // Ajuste ano 2 dígitos
      if (year < 100) year += 2000;

      if (day > 0 && day <= 31 && month > 0 && month <= 12 && year > 1990 && year < 2100) {
          return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      }
    }
  } 
  // YYYY-MM-DD
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
    const response = await fetch(GOOGLE_SHEET_CSV_URL);
    if (!response.ok) throw new Error(`Erro HTTP: ${response.status}`);
    const csvText = await response.text();
    return parseCSVText(csvText);
  } catch (error) {
    console.error("Falha ao carregar planilha:", error);
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
  const nowStr = new Date().toISOString().split('T')[0];

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

    if (!cnpj || cnpj === 'N/I' || cnpj.length < 5) continue;

    // Chave única sanitizada
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
        // Inicializa com datas extremas para serem sobrescritas
        firstShipmentDate: '2099-12-31', 
        lastShipmentDate: '2000-01-01'
      });
    }

    const client = clientsMap.get(clientKey)!;
    const dateIsoString = parseDateToString(dateStr); 
    
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

        if (client.lastShipmentDate && dateIsoString > client.lastShipmentDate) {
            client.lastShipmentDate = dateIsoString;
        }
        if (client.firstShipmentDate && dateIsoString < client.firstShipmentDate) {
            client.firstShipmentDate = dateIsoString;
        }
    }

    if (origin && origin !== 'N/A' && !client.origin?.includes(origin)) client.origin?.push(origin);
    if (destination && destination !== 'N/A' && !client.destination?.includes(destination)) client.destination?.push(destination);
  }

  // Pós-processamento para garantir integridade
  const clients: Client[] = Array.from(clientsMap.values()).map(c => {
      const cl = c as Client;
      
      // Fallback se não encontrou datas válidas
      if (cl.firstShipmentDate === '2099-12-31') cl.firstShipmentDate = nowStr;
      if (cl.lastShipmentDate === '2000-01-01') cl.lastShipmentDate = nowStr;

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

// --- CÁLCULO DE PROJEÇÕES (12 MESES HIST + 12 PROJ) ---

const calculateProjections = (
  historicalData: {date: string, value: number}[], 
  maxDateStr: string
): ChartDataPoint[] => {
  if (historicalData.length < 1) return [];

  // 1. Agrupar por Mês
  const monthlyReal = new Map<string, number>();
  historicalData.forEach(d => {
      const key = d.date.substring(0, 7); // YYYY-MM
      const val = monthlyReal.get(key) || 0;
      monthlyReal.set(key, val + d.value);
  });

  const sortedKeys = Array.from(monthlyReal.keys()).sort();
  const maxDate = parseISO(maxDateStr);
  
  // 2. Definir janela de 12 meses atrás a partir da Data de Referência
  const twelveMonthsAgo = subMonths(maxDate, 12);
  const chartPoints: ChartDataPoint[] = [];

  // Filtrar apenas os últimos 12 meses para o gráfico
  sortedKeys.forEach(key => {
      const [y, m] = key.split('-').map(Number);
      const dateObj = new Date(y, m - 1, 1);
      
      if (isAfter(dateObj, twelveMonthsAgo) || key === maxDateStr.substring(0, 7)) {
          chartPoints.push({
              name: format(dateObj, 'MMM/yy', { locale: ptBR }),
              date: key,
              revenue: monthlyReal.get(key) || 0,
              projectedRevenue: null,
              isProjection: false
          });
      }
  });

  // --- LÓGICA DE PROJEÇÃO CONSERVADORA ---
  // Base: Média ponderada dos últimos 6 meses disponíveis
  const historyLen = sortedKeys.length;
  const monthsToConsider = Math.min(6, historyLen);
  let weightedSum = 0;
  let weightTotal = 0;

  // Pegar os ultimos X meses reais (independente se entraram no gráfico ou não)
  for (let i = 0; i < monthsToConsider; i++) {
      const key = sortedKeys[historyLen - 1 - i];
      const val = monthlyReal.get(key) || 0;
      const weight = monthsToConsider - i; 
      weightedSum += val * weight;
      weightTotal += weight;
  }

  const weightedAvg = weightTotal > 0 ? weightedSum / weightTotal : 0;
  const SAFETY_MARGIN = 0.85; // Margem de segurança de 15%
  let baseValue = weightedAvg * SAFETY_MARGIN;

  // Data Inicial para Projeção
  const lastRealKey = sortedKeys[sortedKeys.length - 1];
  let [py, pm] = lastRealKey ? lastRealKey.split('-').map(Number) : [new Date().getFullYear(), new Date().getMonth() + 1];

  // Link visual
  if (chartPoints.length > 0) {
      chartPoints[chartPoints.length - 1].projectedRevenue = chartPoints[chartPoints.length - 1].revenue;
  }

  // Gerar 12 meses futuros
  for (let i = 1; i <= 12; i++) {
      pm++;
      if (pm > 12) { pm = 1; py++; }
      const mIndex = pm - 1; 
      
      // Sazonalidade Típica (Conservadora)
      let seasonFactor = 1.0;
      if (mIndex === 0) seasonFactor = 0.85; // Jan
      else if (mIndex === 1) seasonFactor = 0.88; // Fev
      else if (mIndex === 2) seasonFactor = 1.00; // Mar
      else if (mIndex === 9) seasonFactor = 1.05; // Out
      else if (mIndex === 10) seasonFactor = 1.10; // Nov
      else if (mIndex === 11) seasonFactor = 1.05; // Dez
      
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

// --- ALERTAS ---
export const generateClientAlerts = (clients: Client[]): ClientAlert[] => {
    const alerts: ClientAlert[] = [];
    
    // Filtrar clientes ativos e relevantes
    const activeRelevant = clients.filter(c => c.recency <= 45 && c.totalRevenue > 0);

    activeRelevant.forEach(client => {
        // Alerta de Queda de Ticket (Curva A ou B)
        if (client.abcCategory === ABCCategory.A || client.abcCategory === ABCCategory.B) {
            const history = client.history.sort((a,b) => a.date.localeCompare(b.date));
            const last3 = history.slice(-3);
            if (last3.length === 3) {
                const recentAvg = last3.reduce((acc, h) => acc + h.value, 0) / 3;
                if (recentAvg < (client.averageTicket * 0.7)) {
                    alerts.push({
                        id: `tk-${client.id}`,
                        clientId: client.id,
                        clientName: client.name,
                        client: client,
                        type: 'ticket_drop',
                        severity: 'high',
                        metric: `-${Math.round((1 - recentAvg/client.averageTicket)*100)}%`,
                        message: 'Ticket médio caiu drasticamente nos últimos 3 envios.'
                    });
                }
            }
        }
        
        // Alerta de Interrupção de Fluxo (Baseado na frequência média)
        if (client.frequency > 5) {
             // Estimativa simples de intervalo médio
             const estimatedInterval = 365 / Math.max(1, client.frequency * (365/Math.max(1, differenceInDays(parseISO(client.lastShipmentDate), parseISO(client.firstShipmentDate)))));
             // Se recência > 3x o intervalo normal
             if (client.recency > Math.max(15, estimatedInterval * 3)) {
                 alerts.push({
                    id: `fq-${client.id}`,
                    clientId: client.id,
                    clientName: client.name,
                    client: client,
                    type: 'frequency_drop',
                    severity: 'medium',
                    metric: `${client.recency}d`,
                    message: `Cliente fora do padrão habitual de envio (~${Math.round(estimatedInterval)}d).`
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

  // --- FILTRAGEM EFICIENTE (Memoization manual) ---
  // Apenas recalcular se necessário. Aqui fazemos direto pois a função é chamada via useMemo no App.tsx
  const hasYearFilter = filters.years.length > 0;
  const hasMonthFilter = filters.months.length > 0;
  const hasClientFilter = filters.clients.length > 0;
  const hasOriginFilter = filters.origins.length > 0;
  const hasDestFilter = filters.destinations.length > 0;
  const hasSegmentFilter = filters.segments.length > 0;

  const yearsSet = new Set(filters.years);
  const monthsSet = new Set(filters.months);
  const clientsSet = new Set(filters.clients);
  const originsSet = new Set(filters.origins);
  const destSet = new Set(filters.destinations);
  const segmentsSet = new Set(filters.segments);

  // Determinar Data de Referência (A mais recente de TODA a base)
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

  for (const client of allClients) {
      // 1. Filtro de Cliente (Rápido)
      if (hasClientFilter && !clientsSet.has(client.id)) continue;

      let filteredRevenue = 0;
      let filteredShipments = 0;
      const historyFiltered: typeof client.history = [];

      // 2. Filtros de Transação (Ano, Mês, Rota)
      for (const t of client.history) {
          if (hasYearFilter && !yearsSet.has(t.year)) continue;
          if (hasMonthFilter && !monthsSet.has(t.month)) continue;
          if (hasOriginFilter && !originsSet.has(t.origin)) continue;
          if (hasDestFilter && !destSet.has(t.destination)) continue;

          filteredRevenue += t.value;
          filteredShipments++;
          historyFiltered.push(t);
          globalFilteredHistory.push({ date: t.date, value: t.value });
      }

      // Se aplicou filtros e não sobrou nada, ignora (exceto se for apenas filtro de cliente, onde queremos ver o cadastro)
      if (filteredShipments === 0 && (hasYearFilter || hasMonthFilter || hasOriginFilter || hasDestFilter)) {
          continue;
      }

      // --- CÁLCULO DE SEGMENTAÇÃO (CORRIGIDO) ---
      // Usamos os dados GLOBAIS do cliente (não filtrados) para definir quem ele é
      // A segmentação reflete o STATUS ATUAL DO CLIENTE, independente do filtro de mês visualizado
      const daysSinceLastGlobal = differenceInDays(referenceDate, parseISO(client.lastShipmentDate));
      const daysSinceFirstGlobal = differenceInDays(referenceDate, parseISO(client.firstShipmentDate));

      let segment = Segment.POTENTIAL;

      // HIERARQUIA DE STATUS (Prioridade para Inatividade)
      if (daysSinceLastGlobal > 180) {
          segment = Segment.LOST; // Inativo > 6 meses
      } else if (daysSinceLastGlobal > 90) {
          segment = Segment.AT_RISK; // Inativo > 3 meses (Risco)
      } else {
          // Cliente ATIVO (Comprou nos últimos 90 dias)
          // Só aqui verificamos se é novo
          if (daysSinceFirstGlobal <= 90) {
              segment = Segment.NEW; // Começou a comprar agora
          } else {
              // Ativo e antigo
              segment = Segment.LOYAL; 
              // Regra de Campeão (Simplificada)
              const globalRevenue = client.history.reduce((acc, h) => acc + h.value, 0);
              if (globalRevenue > 100000) segment = Segment.CHAMPIONS;
          }
      }

      // 3. Filtro de Segmento (Aplica após calcular)
      if (hasSegmentFilter && !segmentsSet.has(segment)) continue;

      // Score de Saúde
      let score = 50;
      if (segment === Segment.LOST) score = 10;
      else if (segment === Segment.AT_RISK) score = 30;
      else {
          score = 70;
          if (daysSinceLastGlobal < 15) score += 10;
          if (segment === Segment.CHAMPIONS) score += 15;
          if (segment === Segment.NEW) score += 5;
      }
      let health = HealthScore.WARNING;
      if (score >= 80) health = HealthScore.EXCELLENT;
      else if (score >= 60) health = HealthScore.GOOD;
      else if (score <= 30) health = HealthScore.CRITICAL;

      // Tags de Oportunidade
      let opportunityTag: OpportunityTag = null;
      if (segment === Segment.AT_RISK || segment === Segment.LOST) {
           const globalRev = client.history.reduce((acc, h) => acc + h.value, 0);
           const avgTicket = client.history.length > 0 ? globalRev / client.history.length : 0;
           
           if (avgTicket > 5000) opportunityTag = 'Frete Premium';
           else if (globalRev > 50000) opportunityTag = 'Alto Volume';
           else if (client.history.length > 10) opportunityTag = 'Recuperável';
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
          abcCategory: ABCCategory.C, // Será recalculado
          healthScore: health,
          healthValue: score,
          opportunityTag
      });
  }

  // Ordenar e Recalcular Curva ABC na lista filtrada
  processedClients.sort((a, b) => b.totalRevenue - a.totalRevenue);
  const totalRev = processedClients.reduce((acc, c) => acc + c.totalRevenue, 0);
  let accum = 0;
  
  processedClients.forEach(c => {
      accum += c.totalRevenue;
      const p = totalRev > 0 ? accum / totalRev : 1;
      if (p <= 0.80) c.abcCategory = ABCCategory.A;
      else if (p <= 0.95) c.abcCategory = ABCCategory.B;
      else c.abcCategory = ABCCategory.C;
  });

  const chartData = calculateProjections(globalFilteredHistory, maxDateStr);

  return {
      clients: processedClients,
      chartData,
      referenceDate,
      availableOrigins: Array.from(allOrigins).sort(),
      availableDestinations: Array.from(allDestinations).sort()
  };
};