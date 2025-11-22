import React, { useMemo, useState, useEffect } from 'react';
import { Client, HealthScore, Segment } from '../types';
import { 
  ArrowLeft, Phone, Mail, TrendingUp, Package, DollarSign, 
  BrainCircuit, AlertTriangle, Clock, Loader2, MoreHorizontal, 
  ArrowUpRight, ArrowDownRight, Calendar, ShieldCheck, Zap, Sparkles, MapPin, Route
} from 'lucide-react';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { generateClientInsights, InsightResult } from '../services/geminiService';

interface ClientProfileProps {
  client: Client;
  onBack: () => void;
}

export const ClientProfile: React.FC<ClientProfileProps> = ({ client, onBack }) => {
  const [aiSuggestions, setAiSuggestions] = useState<InsightResult[]>([]);
  const [loadingAI, setLoadingAI] = useState(false);

  // Get Theme for Chart
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
  }, [client]);

  // Processar dados para o gráfico
  const chartData = useMemo(() => {
    const historyMap = new Map<string, number>();
    if (client.history.length > 0) {
        client.history.forEach(t => {
            const key = t.date.substring(0, 7); // YYYY-MM
            const current = historyMap.get(key) || 0;
            historyMap.set(key, current + t.value);
        });
    }
    const data = Array.from(historyMap.entries())
        .map(([date, value]) => ({
            date,
            name: format(parseISO(`${date}-01`), 'MMM', { locale: ptBR }),
            fullDate: format(parseISO(`${date}-01`), 'MMMM yyyy', { locale: ptBR }),
            value
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

  // Análise de Rotas (Top Origins e Routes)
  const { topOrigin, topDestination, topRoutes } = useMemo(() => {
    const originCounts: Record<string, number> = {};
    const destCounts: Record<string, number> = {};
    const routeStats: Record<string, { origin: string, dest: string, value: number, count: number }> = {};

    client.history.forEach(t => {
        // Origins
        originCounts[t.origin] = (originCounts[t.origin] || 0) + 1;
        // Destinations
        destCounts[t.destination] = (destCounts[t.destination] || 0) + 1;
        
        // Routes
        const routeKey = `${t.origin}|${t.destination}`;
        if (!routeStats[routeKey]) {
            routeStats[routeKey] = { origin: t.origin, dest: t.destination, value: 0, count: 0 };
        }
        routeStats[routeKey].value += t.value;
        routeStats[routeKey].count += 1;
    });

    // Sort Origins
    const sortedOrigins = Object.entries(originCounts).sort((a, b) => b[1] - a[1]);
    const topOrg = sortedOrigins.length > 0 ? sortedOrigins[0][0] : 'N/A';

    // Sort Destinations
    const sortedDest = Object.entries(destCounts).sort((a, b) => b[1] - a[1]);
    const topDst = sortedDest.length > 0 ? sortedDest[0][0] : 'N/A';

    // Sort Routes by Value (Revenue)
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
          label: 'Oportunidade' 
        };
      case 'risk':
        return { 
          icon: AlertTriangle, 
          color: 'text-rose-400', 
          bg: 'bg-rose-950/30', 
          border: 'border-rose-500/30',
          badgeBg: 'bg-rose-500/20', 
          label: 'Potencial de Reativação' 
        };
      case 'retention':
        return { 
          icon: ShieldCheck, 
          color: 'text-blue-400', 
          bg: 'bg-blue-950/30', 
          border: 'border-blue-500/30', 
          badgeBg: 'bg-blue-500/20',
          label: 'Retenção' 
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

  const chartGridColor = isDark ? '#1A1B62' : '#E5E5F1';
  const chartTextColor = isDark ? '#BFC0EF' : '#606084';

  return (
    <div className="flex flex-col h-full bg-[#F8F9FC] dark:bg-sle-blue-950 animate-in slide-in-from-right duration-300 font-sans selection:bg-indigo-100 selection:text-indigo-900 dark:selection:bg-indigo-900 dark:selection:text-indigo-100">
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
              <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase border tracking-wider ${
                  client.segment === Segment.LOST ? 'bg-rose-50 dark:bg-rose-900/20 text-rose-700 dark:text-rose-400 border-rose-200 dark:border-rose-800' :
                  client.segment === Segment.AT_RISK ? 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800' :
                  'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800'
              }`}>
                  {client.segment}
              </span>
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
        <div className="hidden sm:flex flex-col items-end">
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

      <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
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
                                            return (
                                                <div className="bg-sle-neutral-900 dark:bg-black text-white text-xs p-3 rounded-xl shadow-xl border border-sle-neutral-700/50 dark:border-sle-blue-800">
                                                    <p className="font-bold mb-1 opacity-60 uppercase tracking-wider">{payload[0].payload.fullDate}</p>
                                                    <p className="text-lg font-bold text-emerald-400">
                                                        {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(payload[0].value as number)}
                                                    </p>
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
                </div>
            </div>
        </div>
      </div>
    </div>
  );
};