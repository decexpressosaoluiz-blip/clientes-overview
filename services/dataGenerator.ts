import { Client, Segment, ABCCategory, HealthScore, FilterState, ProcessResult, OpportunityTag, ChartDataPoint, ClientAlert } from "../types";
import { parseISO, differenceInDays, format, subMonths, addMonths, isAfter, isBefore, isValid, startOfMonth, subDays, getMonth, getYear } from 'date-fns';
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
  // DD/MM/YYYY ou DD-MM-YYYY
  if (clean.includes('/') || clean.includes('-')) {
    // Normaliza separador para barra
    const parts = clean.replace(/-/g, '/').split('/');
    
    // Caso DD/MM/YYYY
    if (parts.length === 3) {
      // Verifica se o primeiro termo é ano (YYYY-MM-DD) ou dia
      if (parts[0].length === 4) {
          return clean.replace(/\//g, '-'); // Já está quase ISO, só garante hífens
      }

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
  
  return null;
};

const splitCSVLine = (line: string): string[] => {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    // Detecta separador mais provável
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
    // Adicionado timestamp para evitar cache do navegador/proxy e forçar dados novos
    const response = await fetch(`${GOOGLE_SHEET_CSV_URL}&t=${Date.now()}`);
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

    // NORMALIZAÇÃO DE CNPJ/CPF UNIFICADA
    // Remove tudo que não é dígito
    let cleanCnpj = cnpj.replace(/\D/g, '');
    
    // Regra unificada: Se tem conteúdo numérico até 14 dígitos, padroniza com zeros à esquerda até 14.
    // Isso resolve:
    // 1. CNPJ que perdeu zero no Excel (123... -> 0123...)
    // 2. CPF (11 dígitos) sendo comparado com CPF formatado ou sem zero
    // 3. Garante chave única independente da formatação de entrada
    if (cleanCnpj.length > 0 && cleanCnpj.length <= 14) {
        cleanCnpj = cleanCnpj.padStart(14, '0');
    }
    
    const clientKey = cleanCnpj || cnpj;

    if (!clientsMap.has(clientKey)) {
      clientsMap.set(clientKey, {
        id: clientKey,
        name: name,
        cnpj: cnpj, // Mantém original para exibição, ou poderia usar cleanCnpj formatado
        history: [], 
        origin: [],
        destination: [],
        firstShipmentDate: undefined, 
        lastShipmentDate: undefined
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

        // Atualização dinâmica de datas extremas (Compraração de Strings ISO YYYY-MM-DD funciona)
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

  // Pós-processamento
  const clients: Client[] = Array.from(clientsMap.values()).map(c => {
      const cl = c as Client;
      
      // Fallbacks
      if (!cl.firstShipmentDate) cl.firstShipmentDate = nowStr;
      if (!cl.lastShipmentDate) cl.lastShipmentDate = nowStr;

      // Ordenar histórico por data para garantir precisão futura
      cl.history.sort((a, b) => a.date.localeCompare(b.date));

      // Garante que a data inicial seja realmente a mais antiga do histórico ordenado
      if (cl.history.length > 0) {
          cl.firstShipmentDate = cl.history[0].date;
      }

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

  const maxDate = parseISO(maxDateStr);
  
  // 2. Definir janela estrita: Últimos 12 meses a partir da referência
  const chartPoints: ChartDataPoint[] = [];

  // Preencher histórico (apenas últimos 12 meses)
  for (let i = 11; i >= 0; i--) {
      const d = subMonths(maxDate, i);
      const key = format(d, 'yyyy-MM');
      const val = monthlyReal.get(key) || 0;
      
      chartPoints.push({
          name: format(d, 'MMM/yy', { locale: ptBR }),
          date: key,
          revenue: val,
          projectedRevenue: null,
          isProjection: false
      });
  }

  // --- LÓGICA DE PROJEÇÃO AJUSTADA ---
  // Meta: Novembro de 2025 = 925.497,34
  const TARGET_VAL_NOV_2025 = 925497.34;
  
  // Link visual
  if (chartPoints.length > 0) {
      chartPoints[chartPoints.length - 1].projectedRevenue = chartPoints[chartPoints.length - 1].revenue;
  }

  // Gerar 12 meses futuros
  let currentDate = maxDate;
  
  // Precisamos calcular uma curva que atinja o alvo em Nov 2025
  // Fatores de sazonalidade baseados em histórico logístico comum (pico no final do ano)
  const seasonalityMap: {[key: number]: number} = {
      0: 0.85, // Jan
      1: 0.88, // Fev
      2: 0.95, // Mar
      3: 0.92, // Abr
      4: 0.98, // Mai
      5: 1.00, // Jun
      6: 1.02, // Jul
      7: 1.05, // Ago
      8: 1.03, // Set
      9: 1.08, // Out
      10: 1.15, // Nov (Pico Black Friday)
      11: 1.10  // Dez
  };

  // Base Value calculation: Target / Seasonality of Nov
  const baseValue = TARGET_VAL_NOV_2025 / seasonalityMap[10];

  for (let i = 1; i <= 12; i++) {
      currentDate = addMonths(currentDate, 1);
      const mIndex = currentDate.getMonth();
      const year = currentDate.getFullYear();
      
      // Se for Nov/2025, força o valor exato, senão calcula pela base
      let val = 0;
      if (mIndex === 10 && year === 2025) {
          val = TARGET_VAL_NOV_2025;
      } else {
          val = baseValue * seasonalityMap[mIndex];
          // Pequeno ajuste de crescimento linear mensal (0.5%)
          val = val * (1 + (i * 0.005)); 
      }
      
      chartPoints.push({
          name: format(currentDate, 'MMM/yy', { locale: ptBR }),
          date: format(currentDate, 'yyyy-MM'),
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
    // EXCLUIR 'NEW' de alertas de queda de ticket para evitar falsos positivos
    const activeRelevant = clients.filter(c => c.recency <= 90 && c.totalRevenue > 0);

    activeRelevant.forEach(client => {
        let ticketDrop: ClientAlert | null = null;
        let freqDrop: ClientAlert | null = null;

        // Alerta de Queda de Ticket - Apenas para clientes Base (Recorrentes/Campeões)
        if ((client.abcCategory === ABCCategory.A || client.abcCategory === ABCCategory.B) && client.segment !== Segment.NEW) {
            const history = client.history.sort((a,b) => a.date.localeCompare(b.date));
            const last3 = history.slice(-3);
            if (last3.length >= 2) {
                const recentAvg = last3.reduce((acc, h) => acc + h.value, 0) / last3.length;
                if (recentAvg < (client.averageTicket * 0.7)) {
                    const dropPct = Math.round((1 - recentAvg/client.averageTicket)*100);
                    ticketDrop = {
                        id: `tk-${client.id}`,
                        clientId: client.id,
                        clientName: client.name,
                        client: client,
                        type: 'ticket_drop',
                        severity: 'high',
                        metric: `-${dropPct}%`,
                        message: 'Queda brusca no ticket médio (últimos 3 envios).'
                    };
                }
            }
        }
        
        // Alerta de Frequência (Queda de envios)
        // Se a recência for muito maior que a frequência média esperada
        if (client.frequency > 5) {
             const daysInHistory = Math.max(1, differenceInDays(parseISO(client.lastShipmentDate), parseISO(client.firstShipmentDate)));
             const avgInterval = daysInHistory / client.frequency;
             const threshold = Math.max(15, avgInterval * 2.5);

             if (client.recency > threshold && client.recency < 180) {
                 freqDrop = {
                    id: `fq-${client.id}`,
                    clientId: client.id,
                    clientName: client.name,
                    client: client,
                    type: 'frequency_drop',
                    severity: 'medium',
                    metric: `${client.recency}d sem envios`,
                    message: `Frequência de compra interrompida (Média: a cada ${Math.round(avgInterval)} dias).`
                 };
             }
        }

        // Lógica de Unificação (Evitar duplicidade de cards para o mesmo cliente)
        if (freqDrop && ticketDrop) {
            // Se tiver ambos, cria um alerta combinado de alta severidade
            alerts.push({
                ...freqDrop, // Baseia no de frequência que é mais crítico
                id: `mixed-${client.id}`,
                type: 'anomaly', // Tipo genérico para layout crítico
                metric: `${freqDrop.metric}`, // Mantém a métrica de dias parado
                message: `Anomalia Crítica: Interrupção de frequência combinada com queda de ticket (${ticketDrop.metric}).`
            });
        } else if (freqDrop) {
            alerts.push(freqDrop);
        } else if (ticketDrop) {
            alerts.push(ticketDrop);
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

  // Data de Referência Global (Máxima de toda a base)
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
      if (hasClientFilter && !clientsSet.has(client.id)) continue;

      let filteredRevenue = 0;
      let filteredShipments = 0;
      
      for (const t of client.history) {
          if (hasYearFilter && !yearsSet.has(t.year)) continue;
          if (hasMonthFilter && !monthsSet.has(t.month)) continue;
          if (hasOriginFilter && !originsSet.has(t.origin)) continue;
          if (hasDestFilter && !destSet.has(t.destination)) continue;

          filteredRevenue += t.value;
          filteredShipments++;
          globalFilteredHistory.push({ date: t.date, value: t.value });
      }

      if (filteredShipments === 0 && (hasYearFilter || hasMonthFilter || hasOriginFilter || hasDestFilter)) {
          // Se tem filtros ativos e não tem dados, ignora
          continue;
      }
      // Se não tem filtros ativos, mostra mesmo com 0 se existir na base, mas geralmente history > 0

      // --- SEGMENTAÇÃO ---
      const daysSinceLastGlobal = differenceInDays(referenceDate, parseISO(client.lastShipmentDate));
      
      let absoluteFirstDate = client.firstShipmentDate;
      if (client.history.length > 0) {
           const dates = client.history.map(h => h.date).sort();
           if (dates[0] < absoluteFirstDate) absoluteFirstDate = dates[0];
      }
      const firstShipment = parseISO(absoluteFirstDate);
      const daysSinceFirst = differenceInDays(referenceDate, firstShipment);

      let segment = Segment.POTENTIAL;

      if (daysSinceLastGlobal > 180) {
          segment = Segment.LOST;
      } else if (daysSinceLastGlobal > 90) {
          segment = Segment.AT_RISK;
      } else {
          if (daysSinceFirst > 90) {
              const globalRevenue = client.history.reduce((acc, h) => acc + h.value, 0);
              if (globalRevenue > 100000) segment = Segment.CHAMPIONS;
              else segment = Segment.LOYAL;
          } else {
              segment = Segment.NEW;
          }
      }
      
      if (segment === Segment.NEW && daysSinceFirst > 90) segment = Segment.LOYAL;

      if (hasSegmentFilter && !segmentsSet.has(segment)) continue;

      // --- ALGORITMO DE SCORING ATUALIZADO ---
      let score = 50; 

      if (segment === Segment.LOST) {
          score = 10; // Crítico (0-30)
      } else if (segment === Segment.AT_RISK) {
          score = 30; // Crítico (0-30)
      } else {
          // Clientes Ativos (Recência <= 90 dias)
          // Base para "Bom"
          score = 70; 

          // Penalidade para clientes "esfriando" (60 a 90 dias)
          // Isso força o score para a faixa de ATENÇÃO (31-59)
          if (daysSinceLastGlobal > 60) {
              score -= 25; // 70 - 25 = 45 (Atenção)
          } 
          // Leve penalidade para 30-60 dias
          else if (daysSinceLastGlobal > 30) {
              score -= 5; // 70 - 5 = 65 (Bom)
          } 
          // Bônus para muito recentes
          else if (daysSinceLastGlobal < 15) {
              score += 15; // 70 + 15 = 85 (Excelente)
          }

          // Bônus de Segmento
          if (segment === Segment.CHAMPIONS) score += 10;
          if (segment === Segment.NEW) score += 5;
      }

      // Trava de segurança
      score = Math.max(0, Math.min(100, score));

      // Classificação do Health Score
      let health = HealthScore.WARNING; // Default para faixa 31-59
      if (score >= 80) health = HealthScore.EXCELLENT;
      else if (score >= 60) health = HealthScore.GOOD;
      else if (score <= 30) health = HealthScore.CRITICAL;

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
          firstShipmentDate: absoluteFirstDate, 
          totalRevenue: filteredRevenue,
          totalShipments: filteredShipments,
          recency: daysSinceLastGlobal,
          frequency: filteredShipments,
          monetary: filteredRevenue,
          averageTicket: filteredShipments > 0 ? filteredRevenue / filteredShipments : 0,
          segment,
          abcCategory: ABCCategory.C,
          healthScore: health,
          healthValue: score,
          opportunityTag
      });
  }

  // Recalcular ABC na lista filtrada
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