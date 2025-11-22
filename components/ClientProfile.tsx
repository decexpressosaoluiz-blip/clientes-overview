import React, { useMemo, useState, useEffect } from 'react';
import { Client, HealthScore, Segment, ClientAction, InactivityReason, ClientJustification } from '../types';
import { 
  ArrowLeft, TrendingUp, Package, DollarSign, 
  BrainCircuit, AlertTriangle, Clock, Loader2, MoreHorizontal, 
  ArrowUpRight, ArrowDownRight, Calendar, ShieldCheck, Zap, Sparkles, MapPin, Route,
  FileText, Plus, Check, X, Ban, History
} from 'lucide-react';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { generateClientInsights, InsightResult } from '../services/geminiService';

interface ClientProfileProps {
  client: Client;
  onBack: () => void;
  onJustify?: (clientId: string, justification: ClientJustification) => void;
  onLogAction?: (clientId: string, action: ClientAction) => void;
}

export const ClientProfile: React.FC<ClientProfileProps> = ({ client, onBack, onJustify, onLogAction }) => {
  const [aiSuggestions, setAiSuggestions] = useState<InsightResult[]>([]);
  const [loadingAI, setLoadingAI] = useState(false);
  
  // UI States
  const [showActionForm, setShowActionForm] = useState(false);
  const [showJustifyForm, setShowJustifyForm] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'actions'>('overview');

  // Justification Form
  const [justificationReason, setJustificationReason] = useState<InactivityReason>('Empresa Fechada');
  const [newCnpj, setNewCnpj] = useState('');

  // Action Log Form
  const [actionDate, setActionDate] = useState(new Date().toISOString().split('T')[0]);
  const [actionUser, setActionUser] = useState('');
  const [actionContact, setActionContact] = useState('');
  const [actionNote, setActionNote] = useState('');

  // Get Theme
  const [isDark, setIsDark] = useState(false);
  useEffect(() => {
    const checkTheme = () => setIsDark(document.documentElement.classList.contains('dark'));
    checkTheme();
  }, []);

  useEffect(() => {
      let isMounted = true;
      const fetchInsights = async () => {
          setLoadingAI(true);
          setAiSuggestions([]); 
          try {
              const suggestions = await generateClientInsights(client);
              if (isMounted) setAiSuggestions(suggestions);
          } catch (e) {
              console.error(e);
          } finally {
              if (isMounted) setLoadingAI(false);
          }
      };
      
      fetchInsights();
      
      return () => { isMounted = false; };
  }, [client.id]);

  // Processar dados para o gráfico com contagem e ticket médio
  const chartData = useMemo(() => {
    const historyMap = new Map<string, { value: number, count: number }>();
    if (client.history.length > 0) {
        client.history.forEach(t => {
            const key = t.date.substring(0, 7); // YYYY-MM
            const current = historyMap.get(key) || { value: 0, count: 0 };
            historyMap.set(key, { value: current.value + t.value, count: current.count + 1 });
        });
    }
    const data = Array.from(historyMap.entries())
        .map(([date, data]) => ({
            date,
            name: format(parseISO(`${date}-01`), 'MMM', { locale: ptBR }),
            fullDate: format(parseISO(`${date}-01`), 'MMMM yyyy', { locale: ptBR }),
            value: data.value,
            count: data.count,
            avgTicket: data.count > 0 ? data.value / data.count : 0
        }))
        .sort((a, b) => a.date.localeCompare(b.date));

    return data.slice(-12);
  }, [client]);

  // Cálculo de Tendência
  const trend = useMemo(() => {
      if (chartData.length < 2) return { value: 0, direction: 'neutral' };
      const last = chartData[chartData.length - 1].value;
      const prev = chartData[chartData.length - 2].value;
      if (prev === 0) return { value: 100, direction: 'up' };
      const diff = ((last - prev) / prev) * 100;
      return { 
          value: Math.abs(diff).toFixed(1), 
          direction: diff >= 0 ? 'up' : 'down' 
      };
  }, [chartData]);

  // Análise de Rotas
  const { topOrigin, topDestination, topRoutes } = useMemo(() => {
    const originCounts: Record<string, number> = {};
    const destCounts: Record<string, number> = {};
    const routeStats: Record<string, { origin: string, dest: string, value: number, count: number }> = {};

    client.history.forEach(t => {
        originCounts[t.origin] = (originCounts[t.origin] || 0) + 1;
        destCounts[t.destination] = (destCounts[t.destination] || 0) + 1;
        const routeKey = `${t.origin}|${t.destination}`;
        if (!routeStats[routeKey]) {
            routeStats[routeKey] = { origin: t.origin, dest: t.destination, value: 0, count: 0 };
        }
        routeStats[routeKey].value += t.value;
        routeStats[routeKey].count += 1;
    });

    const sortedOrigins = Object.entries(originCounts).sort((a, b) => b[1] - a[1]);
    const topOrg = sortedOrigins.length > 0 ? sortedOrigins[0][0] : 'N/A';

    const sortedDest = Object.entries(destCounts).sort((a, b) => b[1] - a[1]);
    const topDst = sortedDest.length > 0 ? sortedDest[0][0] : 'N/A';

    const sortedRoutes = Object.values(routeStats).sort((a, b) => b.value - a.value).slice(0, 5);

    return { topOrigin: topOrg, topDestination: topDst, topRoutes: sortedRoutes };
  }, [client]);


  const getInsightStyle = (category: string) => {
    switch (category) {
      case 'opportunity':
        return { 
          icon: Zap, 
          color: 'text-emerald-400', 
          bg: 'bg-emerald-950/30', 
          border: 'border-emerald-500/30', 
          badgeBg: 'bg-emerald-500/20',
          label: 'Expansão' 
        };
      case 'risk':
        return { 
          icon: AlertTriangle, 
          color: 'text-rose-400', 
          bg: 'bg-rose-950/30', 
          border: 'border-rose-500/30',
          badgeBg: 'bg-rose-500/20', 
          label: 'Risco' 
        };
      case 'retention':
        return { 
          icon: ShieldCheck, 
          color: 'text-blue-400', 
          bg: 'bg-blue-950/30', 
          border: 'border-blue-500/30', 
          badgeBg: 'bg-blue-500/20',
          label: 'Fidelização' 
        };
      default:
        return { 
          icon: Sparkles, 
          color: 'text-amber-400', 
          bg: 'bg-amber-950/30', 
          border: 'border-amber-500/30', 
          badgeBg: 'bg-amber-500/20',
          label: 'Atenção' 
        };
    }
  };

  const handleSubmitJustification = () => {
    if (onJustify) {
        onJustify(client.id, {
            reason: justificationReason,
            newCnpj: justificationReason === 'Mudança de CNPJ' ? newCnpj : undefined,
            date: new Date().toISOString(),
            user: 'Usuário'
        });
        setShowJustifyForm(false);
    }
  };

  const handleSubmitAction = () => {
    if (onLogAction && actionNote && actionContact) {
        onLogAction(client.id, {
            id: Date.now().toString(),
            date: actionDate,
            user: actionUser || 'Agente',
            contactName: actionContact,
            type: 'Call',
            note: actionNote
        });
        setShowActionForm(false);
        setActionNote('');
        setActionContact('');
    }
  };

  const chartGridColor = isDark ? '#1A1B62' : '#E5E5F1';
  const chartTextColor = isDark ? '#BFC0EF' : '#606084';

  return (
    <div className="flex flex-col h-full bg-[#F8F9FC] dark:bg-sle-blue-950 animate-in slide-in-from-right duration-300 font-sans relative">
      
      {/* Header Compacto */}
      <div className="bg-white/80 dark:bg-sle-blue-900/80 backdrop-blur-xl border-b border-sle-neutral-200 dark:border-sle-blue-800 px-6 py-4 flex items-center justify-between sticky top-0 z-30 shadow-sm">
        <div className="flex items-center gap-4">
          <button 
            onClick={onBack}
            className="p-2 -ml-2 rounded-full hover:bg-sle-neutral-100 dark:hover:bg-sle-blue-800 text-sle-neutral-400 dark:text-sle-blue-300 hover:text-sle-neutral-700 dark:hover:text-white transition-all group active:scale-90 cursor-pointer"
          >
            <ArrowLeft size={20} strokeWidth={2.5} className="group-hover:-translate-x-1 transition-transform" />
          </button>
          <div>
            <h2 className="text-lg font-bold text-sle-neutral-900 dark:text-white flex items-center gap-2">
              {client.name}
              {client.justification ? (
                 <span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase border tracking-wider bg-purple-50 text-purple-700 border-purple-200 flex items-center gap-1">
                    <Ban size={10} /> Inativo Justificado
                 </span>
              ) : (
                <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase border tracking-wider ${
                    client.segment === Segment.LOST ? 'bg-rose-50 dark:bg-rose-900/20 text-rose-700 dark:text-rose-400 border-rose-200 dark:border-rose-800' :
                    client.segment === Segment.AT_RISK ? 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800' :
                    'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800'
                }`}>
                    {client.segment}
                </span>
              )}
            </h2>
            <div className="flex items-center gap-4 text-xs text-sle-neutral-500 dark:text-sle-blue-300 mt-0.5 font-medium">
               <span className="font-mono">{client.cnpj}</span>
               <span className="w-1 h-1 rounded-full bg-sle-neutral-300 dark:bg-sle-blue-600"></span>
               <span className="flex items-center gap-1" title="Rota mais frequente">
                 <MapPin size={10} />
                 {topOrigin} 
                 <span className="text-sle-neutral-300 dark:text-sle-blue-600">→</span> 
                 {topDestination}
               </span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
            {!client.justification && (client.segment === Segment.AT_RISK || client.segment === Segment.LOST) && (
                <button 
                    onClick={() => setShowJustifyForm(true)}
                    className="hidden sm:flex px-3 py-1.5 rounded-lg border border-rose-200 text-rose-600 hover:bg-rose-50 text-xs font-bold uppercase tracking-wide transition-colors cursor-pointer"
                >
                    Justificar Inatividade
                </button>
            )}
             <div className="hidden sm:flex flex-col items-end ml-4 border-l border-sle-neutral-200 dark:border-sle-blue-800 pl-4">
                <span className="text-[10px] text-sle-neutral-400 dark:text-sle-blue-400 font-bold uppercase tracking-widest mb-1">Score de Saúde</span>
                <div className="flex items-center gap-2">
                    <div className="relative w-24 h-1.5 bg-sle-neutral-100 dark:bg-sle-blue-800 rounded-full overflow-hidden">
                        <div 
                            className={`absolute left-0 top-0 h-full rounded-full transition-all duration-500 ${
                                client.healthValue >= 80 ? 'bg-emerald-500' : 
                                client.healthValue >= 50 ? 'bg-amber-500' : 'bg-rose-500'
                            }`} 
                            style={{ width: `${client.healthValue}%` }}
                        />
                    </div>
                    <span className={`text-sm font-extrabold ${
                        client.healthValue >= 80 ? 'text-emerald-600 dark:text-emerald-400' : 
                        client.healthValue >= 50 ? 'text-amber-600 dark:text-amber-400' : 'text-rose-600 dark:text-rose-400'
                    }`}>{client.healthValue}</span>
                </div>
             </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center px-6 border-b border-sle-neutral-100 dark:border-sle-blue-800 bg-white dark:bg-sle-blue-900 sticky top-[72px] z-20 gap-6">
          <button 
            onClick={() => setActiveTab('overview')}
            className={`py-3 text-xs font-bold uppercase tracking-widest border-b-2 transition-colors cursor-pointer ${activeTab === 'overview' ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400' : 'border-transparent text-sle-neutral-400 hover:text-sle-neutral-600 dark:text-sle-blue-400 dark:hover:text-white'}`}
          >
            Visão Geral
          </button>
          <button 
            onClick={() => setActiveTab('actions')}
            className={`py-3 text-xs font-bold uppercase tracking-widest border-b-2 transition-colors flex items-center gap-2 cursor-pointer ${activeTab === 'actions' ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400' : 'border-transparent text-sle-neutral-400 hover:text-sle-neutral-600 dark:text-sle-blue-400 dark:hover:text-white'}`}
          >
            Diário de Bordo
            <span className="bg-sle-neutral-100 dark:bg-sle-blue-800 text-sle-neutral-500 dark:text-sle-blue-200 px-1.5 rounded text-[9px]">{(client.actions?.length || 0)}</span>
          </button>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
        
        {/* CONTEÚDO DA ABA VISÃO GERAL */}
        {activeTab === 'overview' && (
        <div className="max-w-7xl mx-auto space-y-6">
            
            {/* KPI Cards - Estilo Minimalista */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                    { label: 'Faturamento Total', value: client.totalRevenue, icon: DollarSign, color: 'blue', format: true },
                    { label: 'Total Envios', value: client.totalShipments, icon: Package, color: 'indigo', format: false },
                    { label: 'Ticket Médio', value: client.averageTicket, icon: TrendingUp, color: 'emerald', format: true },
                    { label: 'Recência', value: `${client.recency} dias`, icon: Clock, color: 'amber', format: false }
                ].map((kpi, i) => (
                    <div key={i} className="bg-white dark:bg-sle-blue-900 p-5 rounded-3xl border border-sle-neutral-100 dark:border-sle-blue-800 shadow-sm dark:shadow-dark-card hover:shadow-md transition-all hover:-translate-y-0.5 cursor-default select-none">
                        <div className="flex items-center gap-3 mb-3">
                            <div className={`p-2.5 rounded-xl bg-${kpi.color}-50 dark:bg-${kpi.color}-900/20 text-${kpi.color}-600 dark:text-${kpi.color}-400`}>
                                <kpi.icon size={18} strokeWidth={2} />
                            </div>
                            <span className="text-[10px] font-bold text-sle-neutral-400 dark:text-sle-blue-300 uppercase tracking-wider">{kpi.label}</span>
                        </div>
                        <div className="text-xl font-extrabold text-sle-neutral-900 dark:text-white tracking-tight">
                            {kpi.format && typeof kpi.value === 'number'
                                ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', notation: 'compact' }).format(kpi.value) 
                                : kpi.value}
                        </div>
                    </div>
                ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                {/* SEÇÃO 1: GRÁFICO DE HISTÓRICO */}
                <div className="lg:col-span-2 bg-white dark:bg-sle-blue-900 p-8 rounded-3xl border border-sle-neutral-100 dark:border-sle-blue-800 shadow-sm dark:shadow-dark-card flex flex-col h-[480px] hover:shadow-soft dark:hover:shadow-dark-soft transition-all">
                    <div className="flex justify-between items-start mb-6">
                        <div>
                            <h3 className="text-lg font-bold text-sle-neutral-900 dark:text-white">Performance Financeira</h3>
                            <p className="text-sm text-sle-neutral-400 dark:text-sle-blue-300 font-medium mt-1">Evolução de receita (Últimos 12 meses)</p>
                        </div>
                        <div className={`flex items-center px-3 py-1.5 rounded-full text-xs font-bold ${
                            trend.direction === 'up' ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400' : 
                            trend.direction === 'down' ? 'bg-rose-50 dark:bg-rose-900/20 text-rose-700 dark:text-rose-400' : 'bg-sle-neutral-50 dark:bg-sle-blue-800 text-sle-neutral-600 dark:text-sle-blue-300'
                        }`}>
                            {trend.direction === 'up' ? <ArrowUpRight size={14} className="mr-1" strokeWidth={2.5}/> : 
                             trend.direction === 'down' ? <ArrowDownRight size={14} className="mr-1" strokeWidth={2.5}/> : null}
                            {trend.value}% vs. mês anterior
                        </div>
                    </div>
                    
                    <div className="flex-1 w-full min-h-0">
                         <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={chartData} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
                                <defs>
                                    <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#24268c" stopOpacity={0.2}/>
                                        <stop offset="95%" stopColor="#24268c" stopOpacity={0}/>
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={chartGridColor} />
                                <XAxis 
                                    dataKey="name" 
                                    axisLine={false} 
                                    tickLine={false} 
                                    tick={{fill: chartTextColor, fontSize: 10, fontWeight: 600}} 
                                    dy={10}
                                />
                                <YAxis 
                                    axisLine={false} 
                                    tickLine={false} 
                                    tickFormatter={(v) => `${(v/1000).toFixed(0)}k`} 
                                    tick={{fill: chartTextColor, fontSize: 10, fontWeight: 600}} 
                                />
                                <Tooltip 
                                    cursor={{ stroke: chartGridColor, strokeWidth: 1 }}
                                    content={({ active, payload }) => {
                                        if (active && payload && payload.length) {
                                            const data = payload[0].payload;
                                            return (
                                                <div className="bg-sle-neutral-900 dark:bg-black text-white text-xs p-3 rounded-xl shadow-xl border border-sle-neutral-700/50 dark:border-sle-blue-800">
                                                    <p className="font-bold mb-2 opacity-60 uppercase tracking-wider border-b border-white/10 pb-1">{data.fullDate}</p>
                                                    <div className="space-y-1.5">
                                                        <div className="flex justify-between gap-4">
                                                            <span className="text-sle-neutral-400">Receita:</span>
                                                            <span className="font-bold text-emerald-400">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(data.value)}</span>
                                                        </div>
                                                        <div className="flex justify-between gap-4">
                                                            <span className="text-sle-neutral-400">Envios:</span>
                                                            <span className="font-bold text-white">{data.count}</span>
                                                        </div>
                                                        <div className="flex justify-between gap-4">
                                                            <span className="text-sle-neutral-400">Ticket Médio:</span>
                                                            <span className="font-bold text-indigo-300">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(data.avgTicket)}</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        }
                                        return null;
                                    }}
                                />
                                <Area 
                                    type="monotone" 
                                    dataKey="value" 
                                    stroke="#24268c" 
                                    strokeWidth={3} 
                                    fill="url(#colorRevenue)" 
                                    activeDot={{ r: 6, strokeWidth: 0, fill: '#24268c' }}
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* SEÇÃO 2: AI INTELLIGENCE */}
                <div className="lg:col-span-1 flex flex-col">
                    
                    {/* AI Card */}
                    <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-sle-blue-900 to-indigo-950 text-white shadow-xl shadow-indigo-900/20 border border-white/10 p-6 flex-1 flex flex-col group transition-transform">
                        {/* Decorative Elements */}
                        <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 bg-indigo-500 rounded-full blur-3xl opacity-20 pointer-events-none group-hover:opacity-30 transition-opacity"></div>
                        <div className="absolute bottom-0 left-0 -ml-16 -mb-16 w-64 h-64 bg-sle-red-500 rounded-full blur-3xl opacity-10 pointer-events-none group-hover:opacity-20 transition-opacity"></div>
                        
                        <div className="relative z-10 flex items-center justify-between mb-6 flex-shrink-0">
                            <div className="flex items-center gap-2.5">
                                <div className="p-2 bg-white/10 rounded-xl backdrop-blur-md border border-white/10 shadow-inner">
                                    <BrainCircuit size={18} className="text-indigo-300" strokeWidth={2} />
                                </div>
                                <div>
                                    <h3 className="font-bold text-base">SLE Intelligence</h3>
                                    <p className="text-[10px] text-indigo-200 font-medium uppercase tracking-wider">Gemini Powered</p>
                                </div>
                            </div>
                            {loadingAI && <Loader2 size={18} className="text-indigo-300 animate-spin" />}
                        </div>

                        <div className="relative z-10 flex-1 overflow-y-auto custom-scrollbar pr-1">
                            <div className="space-y-4">
                                {loadingAI ? (
                                    <div className="h-full flex flex-col items-center justify-center text-center min-h-[200px]">
                                        <Loader2 size={32} className="text-indigo-500/50 animate-spin mb-2" />
                                        <p className="text-xs text-indigo-300/50 italic">Analisando padrões comportamentais...</p>
                                    </div>
                                ) : aiSuggestions.length > 0 ? (
                                    aiSuggestions.map((sug, i) => {
                                        const style = getInsightStyle(sug.category);
                                        const Icon = style.icon;
                                        return (
                                            <div 
                                                key={i} 
                                                className={`group/card relative p-4 rounded-2xl border backdrop-blur-md transition-all duration-300 hover:-translate-y-1 hover:shadow-lg cursor-default ${style.bg} ${style.border} hover:bg-opacity-40`}
                                            >
                                                <div className="flex items-start justify-between mb-3">
                                                    <div className={`inline-flex items-center gap-2 px-2.5 py-1 rounded-lg ${style.badgeBg} border ${style.border}`}>
                                                        <Icon size={12} className={style.color} strokeWidth={2.5} />
                                                        <span className={`text-[10px] font-extrabold uppercase tracking-wider ${style.color}`}>{style.label}</span>
                                                    </div>
                                                </div>
                                                
                                                <h4 className="text-sm font-bold text-white leading-snug mb-2 group-hover/card:text-indigo-100 transition-colors">
                                                    {sug.title}
                                                </h4>
                                                
                                                <p className="text-xs text-slate-300 font-medium leading-relaxed opacity-90">
                                                    {sug.description}
                                                </p>
                                            </div>
                                        );
                                    })
                                ) : (
                                    <div className="p-4 rounded-xl bg-white/5 border border-white/10 text-center">
                                        <p className="text-xs text-indigo-300">Nenhuma sugestão disponível no momento.</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Tabela de Análise de Rotas e Cadastro */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 bg-white dark:bg-sle-blue-900 rounded-3xl border border-sle-neutral-100 dark:border-sle-blue-800 shadow-sm dark:shadow-dark-card overflow-hidden hover:shadow-soft dark:hover:shadow-dark-soft transition-all">
                    <div className="px-8 py-6 border-b border-sle-neutral-50 dark:border-sle-blue-800 bg-white dark:bg-sle-blue-900 flex justify-between items-center">
                        <div>
                            <h3 className="font-bold text-sle-neutral-900 dark:text-white flex items-center gap-2">
                                <Route size={18} className="text-indigo-500" />
                                Principais Rotas
                            </h3>
                            <p className="text-xs text-sle-neutral-500 dark:text-sle-blue-300 mt-1">Análise de origem e destino por maior volume financeiro</p>
                        </div>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                            <thead>
                                <tr className="bg-sle-neutral-50/50 dark:bg-sle-blue-950/30 text-sle-neutral-400 dark:text-sle-blue-400 text-xs uppercase tracking-wider font-bold">
                                    <th className="px-8 py-4">Rota</th>
                                    <th className="px-8 py-4 text-center">Qtd. Envios</th>
                                    <th className="px-8 py-4 text-right">Volume Financeiro</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-sle-neutral-50 dark:divide-sle-blue-800">
                                {topRoutes.map((route, idx) => (
                                    <tr key={idx} className="hover:bg-sle-neutral-50 dark:hover:bg-sle-blue-800 transition-colors group">
                                        <td className="px-8 py-4 text-sle-neutral-600 dark:text-sle-blue-300">
                                            <div className="flex items-center gap-2">
                                                <div className="w-6 h-6 rounded bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 flex items-center justify-center text-xs font-bold">
                                                    {idx + 1}
                                                </div>
                                                <span className="font-bold text-sle-neutral-800 dark:text-white">{route.origin}</span>
                                                <span className="text-sle-neutral-300 dark:text-sle-blue-600">→</span>
                                                <span className="font-bold text-sle-neutral-800 dark:text-white">{route.dest}</span>
                                            </div>
                                        </td>
                                        <td className="px-8 py-4 text-center text-sle-neutral-600 dark:text-sle-blue-300 font-medium">
                                            {route.count}
                                        </td>
                                        <td className="px-8 py-4 text-right font-bold text-sle-neutral-900 dark:text-white tabular-nums">
                                            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(route.value)}
                                        </td>
                                    </tr>
                                ))}
                                {topRoutes.length === 0 && (
                                    <tr>
                                        <td colSpan={3} className="px-8 py-6 text-center text-sle-neutral-400">Nenhuma rota registrada.</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Cadastro Card Compacto */}
                <div className="lg:col-span-1 bg-white dark:bg-sle-blue-900 p-6 rounded-3xl border border-sle-neutral-100 dark:border-sle-blue-800 shadow-sm dark:shadow-dark-card h-full hover:shadow-soft dark:hover:shadow-dark-soft transition-all">
                    <div className="flex justify-between items-center mb-5">
                        <h4 className="font-bold text-sle-neutral-900 dark:text-white text-sm">Ficha Cadastral</h4>
                        <button className="text-sle-neutral-400 dark:text-sle-blue-400 hover:text-sle-blue-600 dark:hover:text-white transition-colors cursor-pointer p-1 rounded-full hover:bg-sle-neutral-50 dark:hover:bg-sle-blue-800"><MoreHorizontal size={18}/></button>
                    </div>
                    
                    <div className="space-y-4">
                            {[
                            { label: 'Primeiro Envio', value: client.firstShipmentDate ? format(parseISO(client.firstShipmentDate), 'dd/MM/yyyy') : 'N/D', icon: Calendar },
                            { label: 'Último Envio', value: client.lastShipmentDate ? format(parseISO(client.lastShipmentDate), 'dd/MM/yyyy') : 'N/D', icon: Clock },
                            { label: 'Classificação', value: client.abcCategory, icon: TrendingUp, highlight: client.abcCategory === 'Curva A' },
                            ].map((item, idx) => (
                                <div key={idx} className="flex items-center justify-between text-sm group select-none">
                                    <div className="flex items-center gap-3 text-sle-neutral-500 dark:text-sle-blue-300">
                                        <div className="w-8 h-8 rounded-lg bg-sle-neutral-50 dark:bg-sle-blue-800 text-sle-neutral-400 dark:text-sle-blue-300 flex items-center justify-center group-hover:bg-indigo-50 dark:group-hover:bg-sle-blue-700 group-hover:text-indigo-500 dark:group-hover:text-white transition-colors">
                                        <item.icon size={14} strokeWidth={2}/>
                                        </div>
                                        <span className="font-medium text-xs uppercase tracking-wide">{item.label}</span>
                                    </div>
                                    <span className={`font-bold ${item.highlight ? 'text-purple-600 dark:text-purple-300 bg-purple-50 dark:bg-purple-900/30 px-2 py-0.5 rounded-md' : 'text-sle-neutral-800 dark:text-white'}`}>
                                    {item.value}
                                    </span>
                                </div>
                            ))}
                    </div>

                    {client.justification && (
                        <div className="mt-6 pt-4 border-t border-sle-neutral-100 dark:border-sle-blue-800">
                            <h5 className="text-xs font-bold text-sle-neutral-900 dark:text-white mb-2">Justificativa de Inatividade</h5>
                            <div className="p-3 bg-slate-50 dark:bg-sle-blue-950 rounded-xl border border-slate-100 dark:border-sle-blue-800">
                                <p className="text-xs font-semibold text-slate-700 dark:text-sle-blue-200">{client.justification.reason}</p>
                                {client.justification.newCnpj && (
                                    <p className="text-[10px] text-slate-500 dark:text-sle-blue-400 mt-1 font-mono">Novo CNPJ: {client.justification.newCnpj}</p>
                                )}
                                <p className="text-[10px] text-slate-400 dark:text-sle-blue-500 mt-2 flex items-center gap-1">
                                    <Clock size={10} /> {format(parseISO(client.justification.date), 'dd/MM/yy')} por {client.justification.user}
                                </p>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
        )}

        {/* CONTEÚDO DA ABA DIÁRIO DE BORDO */}
        {activeTab === 'actions' && (
            <div className="max-w-4xl mx-auto">
                 <div className="flex justify-between items-center mb-6">
                    <div>
                        <h3 className="text-lg font-bold text-sle-neutral-900 dark:text-white">Histórico de Ações</h3>
                        <p className="text-sm text-sle-neutral-500 dark:text-sle-blue-300">Registro de contatos e ações para clientes em Atenção Imediata.</p>
                    </div>
                    <button 
                        onClick={() => setShowActionForm(true)}
                        className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 text-white rounded-xl text-xs font-bold uppercase tracking-wide hover:bg-indigo-700 shadow-md hover:shadow-lg transition-all active:scale-95"
                    >
                        <Plus size={16} /> Nova Ação
                    </button>
                 </div>

                 <div className="space-y-4">
                     {(client.actions || []).length === 0 ? (
                         <div className="text-center py-12 bg-white dark:bg-sle-blue-900 rounded-3xl border border-sle-neutral-100 dark:border-sle-blue-800 border-dashed">
                             <History size={32} className="mx-auto text-sle-neutral-300 dark:text-sle-blue-500 mb-2" />
                             <p className="text-sle-neutral-400 dark:text-sle-blue-400 font-medium text-sm">Nenhuma ação registrada ainda.</p>
                         </div>
                     ) : (
                         (client.actions || []).map((action) => (
                             <div key={action.id} className="bg-white dark:bg-sle-blue-900 p-5 rounded-2xl border border-sle-neutral-100 dark:border-sle-blue-800 shadow-sm flex gap-4 hover:shadow-md transition-all">
                                 <div className="flex flex-col items-center text-sle-neutral-400 dark:text-sle-blue-400 w-16 flex-shrink-0 border-r border-sle-neutral-100 dark:border-sle-blue-800 pr-4">
                                     <span className="text-xl font-bold text-sle-neutral-800 dark:text-white">{format(parseISO(action.date), 'dd')}</span>
                                     <span className="text-xs font-bold uppercase">{format(parseISO(action.date), 'MMM')}</span>
                                     <span className="text-[10px] mt-1 text-sle-neutral-300 dark:text-sle-blue-600">{format(parseISO(action.date), 'yyyy')}</span>
                                 </div>
                                 <div className="flex-1">
                                     <div className="flex justify-between items-start mb-1">
                                         <h4 className="font-bold text-sle-neutral-800 dark:text-white">{action.contactName}</h4>
                                         <span className="text-[10px] px-2 py-0.5 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-md font-bold uppercase">{action.type}</span>
                                     </div>
                                     <p className="text-sm text-sle-neutral-600 dark:text-sle-blue-200 leading-relaxed mb-2">{action.note}</p>
                                     <div className="flex items-center gap-2 text-[10px] text-sle-neutral-400 dark:text-sle-blue-500 font-medium">
                                         <span className="flex items-center gap-1"><FileText size={10} /> Registrado por: <span className="text-sle-neutral-600 dark:text-sle-blue-300">{action.user}</span></span>
                                     </div>
                                 </div>
                             </div>
                         ))
                     )}
                 </div>
            </div>
        )}

      </div>

      {/* Modal Justificar */}
      {showJustifyForm && (
          <div className="absolute inset-0 z-50 bg-sle-neutral-900/40 backdrop-blur-sm flex items-center justify-center p-4">
              <div className="bg-white dark:bg-sle-blue-900 w-full max-w-md rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                  <div className="px-6 py-4 border-b border-sle-neutral-100 dark:border-sle-blue-800 flex justify-between items-center bg-slate-50 dark:bg-sle-blue-950">
                      <h3 className="font-bold text-sle-neutral-900 dark:text-white">Justificar Inatividade</h3>
                      <button onClick={() => setShowJustifyForm(false)} className="text-sle-neutral-400 dark:text-sle-blue-400 hover:text-rose-500"><X size={20}/></button>
                  </div>
                  <div className="p-6 space-y-4">
                      <div>
                          <label className="block text-xs font-bold text-sle-neutral-500 dark:text-sle-blue-300 uppercase mb-1.5">Motivo</label>
                          <select 
                            className="w-full p-3 bg-white dark:bg-sle-blue-950 border border-sle-neutral-200 dark:border-sle-blue-800 rounded-xl text-sm font-medium focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 dark:text-white"
                            value={justificationReason || ''}
                            onChange={(e) => setJustificationReason(e.target.value as InactivityReason)}
                          >
                              <option value="Empresa Fechada">Empresa Fechada</option>
                              <option value="Avaria/Extravio">Avaria/Extravio</option>
                              <option value="Mudança de CNPJ">Mudança de CNPJ</option>
                              <option value="Rota não Atendida">Rota não atendida pela empresa</option>
                          </select>
                      </div>
                      
                      {justificationReason === 'Mudança de CNPJ' && (
                          <div className="animate-in fade-in slide-in-from-top-2">
                              <label className="block text-xs font-bold text-sle-neutral-500 dark:text-sle-blue-300 uppercase mb-1.5">Novo CNPJ</label>
                              <input 
                                type="text" 
                                placeholder="00.000.000/0000-00"
                                className="w-full p-3 bg-white dark:bg-sle-blue-950 border border-sle-neutral-200 dark:border-sle-blue-800 rounded-xl text-sm font-medium dark:text-white"
                                value={newCnpj}
                                onChange={(e) => setNewCnpj(e.target.value)}
                              />
                          </div>
                      )}

                      <div className="pt-2">
                          <button 
                            onClick={handleSubmitJustification}
                            className="w-full py-3 bg-rose-600 text-white rounded-xl font-bold shadow-lg shadow-rose-200 dark:shadow-none hover:bg-rose-700 transition-all active:scale-95"
                          >
                              Confirmar Justificativa
                          </button>
                          <p className="text-center text-[10px] text-sle-neutral-400 dark:text-sle-blue-500 mt-3">
                              Este cliente será movido para a lista de Justificados.
                          </p>
                      </div>
                  </div>
              </div>
          </div>
      )}

      {/* Modal Nova Ação */}
      {showActionForm && (
          <div className="absolute inset-0 z-50 bg-sle-neutral-900/40 backdrop-blur-sm flex items-center justify-center p-4">
              <div className="bg-white dark:bg-sle-blue-900 w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                  <div className="px-6 py-4 border-b border-sle-neutral-100 dark:border-sle-blue-800 flex justify-between items-center bg-indigo-50 dark:bg-indigo-900/30">
                      <h3 className="font-bold text-indigo-900 dark:text-indigo-200">Registrar Ação</h3>
                      <button onClick={() => setShowActionForm(false)} className="text-indigo-400 hover:text-indigo-700 dark:hover:text-white"><X size={20}/></button>
                  </div>
                  <div className="p-6 space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                          <div>
                              <label className="block text-xs font-bold text-sle-neutral-500 dark:text-sle-blue-300 uppercase mb-1.5">Data</label>
                              <input 
                                type="date" 
                                className="w-full p-2.5 bg-white dark:bg-sle-blue-950 border border-sle-neutral-200 dark:border-sle-blue-800 rounded-xl text-sm dark:text-white"
                                value={actionDate}
                                onChange={(e) => setActionDate(e.target.value)}
                              />
                          </div>
                          <div>
                              <label className="block text-xs font-bold text-sle-neutral-500 dark:text-sle-blue-300 uppercase mb-1.5">Quem fez a ação?</label>
                              <input 
                                type="text" 
                                placeholder="Seu nome"
                                className="w-full p-2.5 bg-white dark:bg-sle-blue-950 border border-sle-neutral-200 dark:border-sle-blue-800 rounded-xl text-sm dark:text-white"
                                value={actionUser}
                                onChange={(e) => setActionUser(e.target.value)}
                              />
                          </div>
                      </div>
                      
                      <div>
                          <label className="block text-xs font-bold text-sle-neutral-500 dark:text-sle-blue-300 uppercase mb-1.5">Responsável na Empresa</label>
                          <input 
                            type="text" 
                            placeholder="Nome do contato"
                            className="w-full p-2.5 bg-white dark:bg-sle-blue-950 border border-sle-neutral-200 dark:border-sle-blue-800 rounded-xl text-sm dark:text-white"
                            value={actionContact}
                            onChange={(e) => setActionContact(e.target.value)}
                          />
                      </div>

                      <div>
                          <label className="block text-xs font-bold text-sle-neutral-500 dark:text-sle-blue-300 uppercase mb-1.5">Observação / Resultado</label>
                          <textarea 
                            rows={4}
                            placeholder="Descreva o que foi conversado ou acordado..."
                            className="w-full p-3 bg-white dark:bg-sle-blue-950 border border-sle-neutral-200 dark:border-sle-blue-800 rounded-xl text-sm resize-none dark:text-white"
                            value={actionNote}
                            onChange={(e) => setActionNote(e.target.value)}
                          />
                      </div>

                      <div className="pt-2 flex gap-3">
                          <button 
                             onClick={() => setShowActionForm(false)}
                             className="flex-1 py-3 bg-white dark:bg-transparent border border-sle-neutral-200 dark:border-sle-blue-600 text-sle-neutral-600 dark:text-sle-blue-200 rounded-xl font-bold hover:bg-sle-neutral-50 dark:hover:bg-sle-blue-800"
                          >
                              Cancelar
                          </button>
                          <button 
                            onClick={handleSubmitAction}
                            disabled={!actionNote || !actionContact}
                            className="flex-1 py-3 bg-indigo-600 text-white rounded-xl font-bold shadow-lg shadow-indigo-200 dark:shadow-none hover:bg-indigo-700 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                              Salvar Registro
                          </button>
                      </div>
                  </div>
              </div>
          </div>
      )}

    </div>
  );
};