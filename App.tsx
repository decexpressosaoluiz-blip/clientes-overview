import React, { useState, useEffect, useMemo } from 'react';
import { 
  TrendingUp, Users, DollarSign, Package, 
  BarChart3, Download, Activity, 
  Calendar, BrainCircuit
} from 'lucide-react';
import { generateMockData, processClients, generateClientAlerts } from './services/dataGenerator';
import { Client, FilterState, ABCCategory, ClientAlert, ClientAction, ClientJustification } from './types';
import { KPICard } from './components/KPICard';
import { FilterBar } from './components/FilterBar';
import { DrillDownTable } from './components/DrillDownTable';
import { ClientSegmentation } from './components/ClientSegmentation';
import { ReactivationOpportunities } from './components/ReactivationOpportunities';
import { ClientProfile } from './components/ClientProfile';
import { PortfolioAnalysisModal } from './components/PortfolioAnalysisModal';
import { AlertBanner } from './components/AlertBanner';
import { ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid, Cell, Area, ComposedChart, Line, BarChart, Bar } from 'recharts';

// Estado local para "persistência" durante a sessão
type ClientOverrides = Record<string, { justification?: ClientJustification, actions: ClientAction[] }>;

const STORAGE_KEY = 'sle_dashboard_data_v1';

const App: React.FC = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [loadingText, setLoadingText] = useState('Carregando Dashboard...');
  const [allClients, setAllClients] = useState<Client[]>([]);
  
  // "Banco de Dados" local de edições do usuário com persistência no LocalStorage
  const [clientOverrides, setClientOverrides] = useState<ClientOverrides>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? JSON.parse(saved) : {};
    } catch (e) {
      console.error("Erro ao carregar dados locais", e);
      return {};
    }
  });

  // Salvar no LocalStorage sempre que houver mudança
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(clientOverrides));
    } catch (e) {
      console.error("Erro ao salvar dados locais", e);
    }
  }, [clientOverrides]);
  
  const [isPortfolioAnalysisOpen, setIsPortfolioAnalysisOpen] = useState(false);
  
  const [filters, setFilters] = useState<FilterState>({
    years: [],
    months: [],
    clients: [],
    origins: [],
    destinations: [],
    segments: []
  });

  const [drillDownTitle, setDrillDownTitle] = useState<string | null>(null);
  const [drillDownList, setDrillDownList] = useState<Client[] | null>(null);
  const [selectedClientProfile, setSelectedClientProfile] = useState<Client | null>(null);

  const [activeAlerts, setActiveAlerts] = useState<ClientAlert[]>([]);
  const [dismissedAlertIds, setDismissedAlertIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    const loadData = async () => {
      setLoadingText('Conectando à Base de Dados...');
      try {
          const data = await generateMockData();
          if (data.length === 0) {
              setLoadingText('Não foi possível carregar dados automáticos.');
          } else {
              setLoadingText('Processando registros...');
              setAllClients(data);
          }
      } catch (e) {
          console.error(e);
          setLoadingText('Erro de conexão.');
      } finally {
          setIsLoading(false);
      }
    };
    loadData();
  }, []);

  // Merge raw data with local overrides (Justifications/Actions)
  const mergedClients = useMemo(() => {
    return allClients.map(c => ({
        ...c,
        justification: clientOverrides[c.id]?.justification,
        actions: clientOverrides[c.id]?.actions || []
    }));
  }, [allClients, clientOverrides]);

  const processedData = useMemo(() => {
      // We pass mergedClients instead of allClients to ensure overrides are respected in processing if needed
      // though current processing logic doesn't depend on logs, it might depend on active status later.
      return processClients(mergedClients, filters);
  }, [mergedClients, filters]);

  const { 
      clients: filteredClients, 
      chartData, 
      referenceDate, 
      availableOrigins, 
      availableDestinations 
  } = processedData;

  // Filter out justified clients from the main list if needed, 
  // but usually we want them in charts, just not in "Reactivation" lists.
  // ReactivationOpportunities component will handle the filtering.

  useEffect(() => {
      if (filteredClients.length > 0) {
         const generatedAlerts = generateClientAlerts(filteredClients);
         setActiveAlerts(generatedAlerts);
      }
  }, [filteredClients]);

  const visibleAlerts = useMemo(() => {
      return activeAlerts.filter(alert => !dismissedAlertIds.has(alert.id));
  }, [activeAlerts, dismissedAlertIds]);

  const handleDismissAlert = (id: string) => {
      const newSet = new Set(dismissedAlertIds);
      newSet.add(id);
      setDismissedAlertIds(newSet);
  };

  // Handlers for Client Profile modifications
  const handleJustifyClient = (clientId: string, justification: ClientJustification) => {
     setClientOverrides(prev => ({
         ...prev,
         [clientId]: {
             ...prev[clientId],
             justification
         }
     }));
  };

  const handleLogAction = (clientId: string, action: ClientAction) => {
    setClientOverrides(prev => ({
        ...prev,
        [clientId]: {
            ...prev[clientId],
            actions: [action, ...(prev[clientId]?.actions || [])]
        }
    }));
  };

  // Stats Calculation
  const stats = useMemo(() => {
    const totalRevenue = filteredClients.reduce((acc, c) => acc + c.totalRevenue, 0);
    const totalShipments = filteredClients.reduce((acc, c) => acc + c.totalShipments, 0);
    const activeClientsCount = filteredClients.filter(c => c.recency <= 90).length;
    const averageTicket = totalShipments > 0 ? totalRevenue / totalShipments : 0;

    return {
        revenue: totalRevenue,
        shipments: totalShipments,
        clientsCount: filteredClients.length,
        ticket: averageTicket,
        activePercent: filteredClients.length > 0 
            ? (activeClientsCount / filteredClients.length) * 100 
            : 0
    };
  }, [filteredClients]);

  const topClientsData = useMemo(() => {
      return [...filteredClients]
        .sort((a,b) => b.totalRevenue - a.totalRevenue)
        .slice(0, 50)
        .map(c => ({
            id: c.id,
            name: c.name,
            cnpj: c.cnpj,
            value: c.totalRevenue,
            fullClient: c 
        }));
  }, [filteredClients]);

  const abcData = useMemo(() => {
    const a = filteredClients.filter(c => c.abcCategory === ABCCategory.A);
    const b = filteredClients.filter(c => c.abcCategory === ABCCategory.B);
    const c = filteredClients.filter(c => c.abcCategory === ABCCategory.C);
    return [
        { name: 'Curva A', count: a.length, revenue: a.reduce((acc, i) => acc + i.totalRevenue, 0), clients: a, color: '#EC1B23', desc: 'Alto Volume (80%)' },
        { name: 'Curva B', count: b.length, revenue: b.reduce((acc, i) => acc + i.totalRevenue, 0), clients: b, color: '#24268B', desc: 'Médio Volume (15%)' },
        { name: 'Curva C', count: c.length, revenue: c.reduce((acc, i) => acc + i.totalRevenue, 0), clients: c, color: '#F4797E', desc: 'Baixo Volume (5%)' },
    ];
  }, [filteredClients]);

  const openDrillDown = (title: string, list: Client[]) => {
      setDrillDownTitle(title);
      setDrillDownList(list);
  };

  const handleOpenProfile = (client: Client) => {
    // Busca o cliente bruto (com histórico completo)
    const rawClient = mergedClients.find(c => c.id === client.id);
    
    if (rawClient) {
        // Combina o cliente bruto com os dados processados (Segmento correto, Scores, etc)
        // Isso corrige o bug onde o cliente aparecia como "Novo" pois mergedClients ainda tem o estado inicial
        const profileClient = {
            ...rawClient,
            segment: client.segment,
            healthScore: client.healthScore,
            healthValue: client.healthValue,
            abcCategory: client.abcCategory,
            recency: client.recency,
            opportunityTag: client.opportunityTag,
            // Mantemos firstShipmentDate recalculado se disponível no cliente processado
            firstShipmentDate: client.firstShipmentDate || rawClient.firstShipmentDate
        };
        setSelectedClientProfile(profileClient);
    } else {
        setSelectedClientProfile(client);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center text-sle-neutral-900">
        <div className="relative w-16 h-16 mb-6">
           <div className="absolute inset-0 border-t-2 border-sle-red-500 rounded-full animate-spin"></div>
           <div className="absolute inset-0 flex items-center justify-center">
             <BarChart3 size={20} className="text-sle-neutral-400" />
           </div>
        </div>
        <h2 className="text-xl font-bold mb-2 tracking-tight text-sle-neutral-800">Dashboard de Clientes</h2>
        <p className="text-sle-neutral-500 font-medium text-sm animate-pulse">{loadingText}</p>
      </div>
    );
  }

  const chartTextColor = '#94A3B8';
  const chartGridColor = '#F1F5F9';
  const chartTooltipBg = '#FFFFFF';
  const chartTooltipText = '#0F172A';
  const chartTooltipBorder = '#E2E8F0';

  return (
    <div className="min-h-screen bg-sle-blue-50 font-sans text-sle-neutral-600 pb-20 selection:bg-indigo-100 selection:text-indigo-700">
        
        <header className="bg-white/80 backdrop-blur-md border-b border-sle-neutral-200 sticky top-0 z-40 shadow-sm">
            <div className="max-w-[1600px] mx-auto px-4 sm:px-6 py-4 flex justify-between items-center">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-sle-blue-800 to-sle-blue-600 flex items-center justify-center shadow-lg shadow-sle-blue-500/20 text-white">
                        <BarChart3 size={20} strokeWidth={2.5} />
                    </div>
                    <div>
                        <h1 className="text-lg font-extrabold text-sle-neutral-900 leading-none tracking-tight">Dashboard de Clientes</h1>
                        <p className="text-xs font-medium text-sle-neutral-500 mt-0.5">Análise estratégica e previsão de vendas</p>
                    </div>
                </div>
                
                <div className="flex items-center gap-3">
                  <button 
                    onClick={() => setIsPortfolioAnalysisOpen(true)}
                    className="hidden md:flex items-center text-xs font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 px-4 py-2.5 rounded-full border border-indigo-100 transition-all active:scale-95 cursor-pointer shadow-sm hover:shadow-md"
                  >
                    <BrainCircuit size={16} className="mr-2" strokeWidth={2.5} />
                    Análise Avançada
                  </button>

                  <a href="https://docs.google.com/spreadsheets/d/1tT6SxM22Cf4yTfbAWM3S3CNLf5btfspQElczKVBm_uw/edit?gid=2053409294#gid=2053409294" target="_blank" rel="noreferrer" className="hidden md:flex items-center text-xs font-bold text-sle-neutral-600 hover:text-sle-blue-600 bg-white hover:bg-sle-neutral-50 px-4 py-2.5 rounded-full border border-sle-neutral-200 transition-all shadow-sm hover:shadow-md active:scale-95 cursor-pointer">
                     <Download size={16} className="mr-2" strokeWidth={2.5} /> Base
                  </a>
                </div>
            </div>
        </header>

        <main className="max-w-[1600px] mx-auto px-4 sm:px-6 py-8 space-y-8">
            
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white/50 backdrop-blur-sm rounded-2xl p-2 border border-sle-neutral-200/60">
               <div className="flex items-center gap-3 px-2">
                 <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.4)]"></div>
                 <p className="text-xs font-medium text-sle-neutral-500">Sincronizado em <span className="font-bold text-sle-neutral-700">{referenceDate.toLocaleDateString('pt-BR')}</span></p>
               </div>
               <button 
                  onClick={() => setIsPortfolioAnalysisOpen(true)}
                  className="md:hidden w-full flex items-center justify-center text-xs font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 px-4 py-2.5 rounded-xl border border-indigo-100 transition-all active:scale-95 cursor-pointer"
                >
                  <BrainCircuit size={14} className="mr-2" strokeWidth={2.5} />
                  Análise IA
                </button>
            </div>

            <div className="relative z-50">
                <AlertBanner 
                    alerts={visibleAlerts} 
                    onDismiss={handleDismissAlert} 
                    onViewClient={handleOpenProfile} 
                />
            </div>

            <div className="relative z-40">
              <FilterBar 
                  clients={allClients}
                  filters={filters} 
                  onFilterChange={setFilters} 
                  availableOrigins={availableOrigins}
                  availableDestinations={availableDestinations}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                <KPICard 
                  title="Faturamento" 
                  value={new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', notation: 'compact' }).format(stats.revenue)} 
                  icon={<DollarSign />} 
                  colorIndex={0} 
                  explanation="Soma do valor total de todas as transações comerciais filtradas no período selecionado." 
                />
                <KPICard 
                  title="Envios" 
                  value={new Intl.NumberFormat('pt-BR').format(stats.shipments)} 
                  icon={<Package />} 
                  colorIndex={1} 
                  explanation="Contagem total de volumes, cargas ou conhecimentos de transporte registrados no período." 
                />
                <KPICard 
                  title="Ticket Médio" 
                  value={new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(stats.ticket)} 
                  icon={<TrendingUp />} 
                  colorIndex={2} 
                  explanation="Valor médio por envio. Calculado dividindo o Faturamento Total pela quantidade de Envios." 
                />
                <KPICard 
                  title="Clientes" 
                  value={stats.clientsCount.toString()} 
                  subValue={`${stats.activePercent.toFixed(0)}% Ativos`} 
                  icon={<Users />} 
                  colorIndex={3} 
                  explanation="Quantidade de CNPJs únicos que realizaram pelo menos uma operação no período filtrado." 
                  onClick={() => openDrillDown('Listagem Geral', filteredClients)} 
                />
                <KPICard 
                  title="Referência" 
                  value={referenceDate.getFullYear().toString()} 
                  subValue={referenceDate.toLocaleDateString('pt-BR', {month: 'short'}).toUpperCase()} 
                  icon={<Calendar />} 
                  colorIndex={4} 
                  explanation="Data da última movimentação registrada na base de dados importada para o sistema." 
                />
            </div>

            {/* EVOLUÇÃO CHART */}
            <div className="bg-white p-8 rounded-[2rem] shadow-soft border border-sle-neutral-100 hover:shadow-elevated transition-all duration-300 group">
                <div className="flex flex-col sm:flex-row justify-between mb-8">
                    <div>
                        <h3 className="text-xl font-extrabold text-sle-neutral-900 tracking-tight">Evolução de Receita</h3>
                        <p className="text-sm text-sle-neutral-500 font-medium mt-1">
                            Histórico filtrado + projeção inteligente de 12 meses.
                        </p>
                    </div>
                    <div className="flex items-center gap-4 mt-4 sm:mt-0">
                        <div className="flex items-center gap-2 text-xs font-bold text-sle-neutral-600 uppercase tracking-wide"><div className="w-2.5 h-2.5 bg-sle-blue-600 rounded-full"></div> Realizado</div>
                        <div className="flex items-center gap-2 text-xs font-bold text-sle-neutral-400 uppercase tracking-wide"><div className="w-2.5 h-2.5 border-2 border-dashed border-indigo-300 rounded-full bg-transparent"></div> Projeção</div>
                    </div>
                </div>
                <div className="h-[380px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart data={chartData} margin={{top: 20, right: 30, left: 0, bottom: 0}}>
                            <defs>
                                <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#4F46E5" stopOpacity={0.1}/>
                                    <stop offset="95%" stopColor="#4F46E5" stopOpacity={0}/>
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={chartGridColor} />
                            <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: chartTextColor, fontSize: 11, fontWeight: 600}} dy={10} />
                            <YAxis axisLine={false} tickLine={false} tickFormatter={(v) => `R$${(v/1000).toFixed(0)}k`} tick={{fill: chartTextColor, fontSize: 11, fontWeight: 600}} />
                            <Tooltip 
                                cursor={{ stroke: '#6366F1', strokeWidth: 1, strokeDasharray: '4 4' }}
                                contentStyle={{
                                    borderRadius: '16px', 
                                    border: `1px solid ${chartTooltipBorder}`, 
                                    boxShadow: '0 10px 40px -10px rgba(0,0,0,0.1)', 
                                    padding: '16px', 
                                    backgroundColor: chartTooltipBg, 
                                    color: chartTooltipText
                                }}
                                formatter={(value: number, name: string) => [
                                    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value),
                                    name === 'revenue' ? 'Receita Real' : 'Projeção Estimada'
                                ]}
                                labelStyle={{ color: chartTextColor, fontSize: '11px', fontWeight: 'bold', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}
                                itemStyle={{ fontSize: '14px', fontWeight: '700', padding: '2px 0', color: '#1E293B' }}
                            />
                            <Area type="monotone" dataKey="revenue" stroke="#4F46E5" strokeWidth={3} fill="url(#colorRev)" activeDot={{r: 6, fill: '#4F46E5', stroke: '#fff', strokeWidth: 2}} />
                            <Line type="monotone" dataKey="projectedRevenue" stroke="#A5B4FC" strokeWidth={3} strokeDasharray="6 6" dot={false} activeDot={{r: 6, strokeWidth: 0, fill: '#A5B4FC'}} />
                        </ComposedChart>
                    </ResponsiveContainer>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-1">
                    <ClientSegmentation clients={filteredClients} onDrillDown={openDrillDown} />
                </div>
                
                <div className="lg:col-span-1">
                     <ReactivationOpportunities 
                        clients={filteredClients} 
                        onDrillDown={openDrillDown} 
                        onOpenProfile={handleOpenProfile} 
                    />
                </div>

                {/* ABC CURVE - Minimalist */}
                <div className="lg:col-span-1 bg-white p-8 rounded-[2rem] shadow-soft border border-sle-neutral-100 flex flex-col hover:shadow-elevated transition-all duration-300">
                    <h3 className="text-xl font-extrabold text-sle-neutral-900 mb-6">Curva ABC</h3>
                    <div className="flex-1 flex flex-col gap-3">
                         {abcData.map((item, i) => (
                            <button key={i} onClick={() => openDrillDown(item.name, item.clients)} className="flex items-center p-3 rounded-2xl border border-transparent hover:border-sle-neutral-100 bg-sle-neutral-50 hover:bg-white transition-all hover:shadow-lg group active:scale-[0.98] cursor-pointer relative overflow-hidden">
                                <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-transparent via-current to-transparent opacity-50" style={{color: item.color}}></div>
                                <div className="w-12 h-12 rounded-xl flex items-center justify-center text-white font-extrabold text-lg shadow-sm transition-transform group-hover:scale-105 mr-4" style={{backgroundColor: item.color}}>
                                    {item.name.charAt(6)}
                                </div>
                                <div className="flex-1 text-left">
                                    <div className="text-sm font-bold text-sle-neutral-800 group-hover:text-indigo-600 transition-colors">{item.count} Clientes</div>
                                    <div className="text-xs text-sle-neutral-400 font-medium">{item.desc}</div>
                                </div>
                                <div className="text-xs font-bold text-sle-neutral-600 bg-white px-3 py-1.5 rounded-lg shadow-sm">
                                    {((item.count / filteredClients.length) * 100).toFixed(0)}%
                                </div>
                            </button>
                         ))}
                    </div>
                    <div className="h-32 mt-6">
                        <ResponsiveContainer width="100%" height="100%">
                             <BarChart data={abcData} margin={{top: 10, right: 0, left: 0, bottom: 0}}>
                                <XAxis dataKey="name" hide />
                                <YAxis hide />
                                <Tooltip 
                                    cursor={{fill: '#F8FAFC'}} 
                                    contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 10px 30px -5px rgba(0,0,0,0.1)', padding: '12px'}}
                                    formatter={(value: number) => [new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value), 'Receita']}
                                    labelStyle={{ color: chartTextColor, fontSize: '11px', fontWeight: 'bold', marginBottom: '4px' }}
                                    itemStyle={{ fontWeight: 'bold', fontSize: '13px', color: '#1E293B' }}
                                />
                                <Bar dataKey="revenue" radius={[8, 8, 8, 8]} barSize={40}>
                                    {abcData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}
                                </Bar>
                             </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>

            <div className="bg-white p-8 rounded-[2rem] shadow-soft border border-sle-neutral-100 hover:shadow-elevated transition-all duration-300">
                <div className="flex justify-between items-end mb-8">
                    <div>
                        <h3 className="text-xl font-extrabold text-sle-neutral-900">Ranking de Clientes</h3>
                        <p className="text-sm text-sle-neutral-500 font-medium mt-1">Top 25 por volume financeiro no período.</p>
                    </div>
                    <button 
                        onClick={() => openDrillDown('Ranking Completo', filteredClients.sort((a,b) => b.totalRevenue - a.totalRevenue))}
                        className="text-xs font-bold text-indigo-600 bg-indigo-50 px-5 py-2.5 rounded-full hover:bg-indigo-100 transition-all active:scale-95 cursor-pointer shadow-sm hover:shadow-md"
                    >
                        Ver Todos
                    </button>
                </div>
                <div className="h-[500px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart 
                          layout="vertical" 
                          data={topClientsData.slice(0, 25)} 
                          margin={{top: 0, right: 20, left: 0, bottom: 0}}
                          barGap={4}
                          barCategoryGap={4}
                        >
                            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke={chartGridColor} />
                            <XAxis type="number" axisLine={false} tickLine={false} tickFormatter={(val) => `R$${(val/1000).toFixed(0)}k`} tick={{fill: chartTextColor, fontSize: 10, fontWeight: 600}} />
                            <YAxis type="category" dataKey="name" width={10} tick={false} axisLine={false} tickLine={false} />
                            <Tooltip 
                                cursor={{fill: '#F8FAFC'}}
                                content={({ active, payload }) => {
                                    if (active && payload && payload.length) {
                                        const data = payload[0].payload;
                                        return (
                                            <div className="bg-white p-4 rounded-xl shadow-xl border border-sle-neutral-100">
                                                <p className="font-bold text-sm text-sle-neutral-900 mb-1">{data.name}</p>
                                                <p className="text-xs text-sle-neutral-500 mb-3 font-mono">{data.cnpj}</p>
                                                <div className="text-emerald-600 font-extrabold text-lg">
                                                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(data.value)}
                                                </div>
                                            </div>
                                        );
                                    }
                                    return null;
                                }}
                            />
                            <Bar 
                                dataKey="value" 
                                radius={[0, 6, 6, 0]} 
                                barSize={12}
                                onClick={(data) => handleOpenProfile(data.fullClient)}
                                cursor="pointer"
                            >
                                {topClientsData.slice(0, 25).map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={index % 2 === 0 ? '#EC1B23' : '#24268B'} className="hover:opacity-80 transition-opacity" />
                                ))}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {drillDownList && drillDownTitle && (
                <DrillDownTable title={drillDownTitle} clients={drillDownList} onClose={() => { setDrillDownTitle(null); setDrillDownList(null); }} />
            )}

            {selectedClientProfile && (
                 <div className="fixed inset-0 z-[110] flex items-center justify-center p-0 sm:p-6 animate-in fade-in duration-300">
                    <div 
                        className="absolute inset-0 bg-sle-blue-950/40 backdrop-blur-sm transition-opacity" 
                        onClick={() => setSelectedClientProfile(null)}
                    ></div>
                    <div className="relative bg-white w-full max-w-6xl h-full sm:h-[90vh] flex flex-col overflow-hidden sm:rounded-[2rem] shadow-2xl border border-white/20">
                        <ClientProfile 
                            client={selectedClientProfile} 
                            onBack={() => setSelectedClientProfile(null)}
                            onJustify={handleJustifyClient}
                            onLogAction={handleLogAction}
                        />
                    </div>
                 </div>
            )}
            
            {isPortfolioAnalysisOpen && (
                <PortfolioAnalysisModal clients={filteredClients} onClose={() => setIsPortfolioAnalysisOpen(false)} />
            )}

        </main>
    </div>
  );
};

export default App;