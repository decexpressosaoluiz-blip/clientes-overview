import React, { useMemo } from 'react';
import { HelpCircle, AlertTriangle, XCircle, ArrowRight, HeartPulse } from 'lucide-react';
import { Client, HealthScore, Segment } from '../types';

interface ClientSegmentationProps {
  clients: Client[];
  onDrillDown: (title: string, clients: Client[]) => void;
}

export const ClientSegmentation: React.FC<ClientSegmentationProps> = ({ clients, onDrillDown }) => {
  
  const healthData = useMemo(() => {
      const excellent = clients.filter(c => c.healthScore === HealthScore.EXCELLENT);
      const good = clients.filter(c => c.healthScore === HealthScore.GOOD);
      const warning = clients.filter(c => c.healthScore === HealthScore.WARNING);
      const critical = clients.filter(c => c.healthScore === HealthScore.CRITICAL);
      return [
          { name: 'Excelente', count: excellent.length, color: 'bg-emerald-500', bg: 'bg-emerald-50', text: 'text-emerald-700', clients: excellent, desc: 'Alta frequência e valor' },
          { name: 'Bom', count: good.length, color: 'bg-blue-500', bg: 'bg-blue-50', text: 'text-blue-700', clients: good, desc: 'Engajamento estável' },
          { name: 'Atenção', count: warning.length, color: 'bg-amber-500', bg: 'bg-amber-50', text: 'text-amber-700', clients: warning, desc: 'Queda na frequência' },
          { name: 'Crítico', count: critical.length, color: 'bg-rose-500', bg: 'bg-rose-50', text: 'text-rose-700', clients: critical, desc: 'Ausência prolongada' },
      ];
  }, [clients]);

  const atRiskClients = useMemo(() => clients.filter(c => c.segment === Segment.AT_RISK), [clients]);
  const lostClients = useMemo(() => clients.filter(c => c.segment === Segment.LOST), [clients]);
  const premiumLostCount = useMemo(() => lostClients.filter(c => c.opportunityTag === 'Frete Premium').length, [lostClients]);

  return (
    <div className="bg-white p-8 rounded-[2rem] shadow-soft border border-sle-neutral-100 h-full flex flex-col select-none transition-all hover:shadow-elevated group">
        <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-pink-50 text-pink-500">
                    <HeartPulse size={20} strokeWidth={2.5} />
                </div>
                <div>
                    <h3 className="text-lg font-extrabold text-sle-neutral-900">Saúde da Carteira</h3>
                    <p className="text-xs font-medium text-sle-neutral-500 mt-0.5">Segmentação por Score</p>
                </div>
            </div>
        </div>
        
        <div className="grid grid-cols-2 gap-4 mb-8">
            {healthData.map((item) => (
                <button 
                    key={item.name}
                    onClick={() => {
                        const sortedList = [...item.clients].sort((a, b) => b.totalRevenue - a.totalRevenue);
                        onDrillDown(`Saúde: ${item.name} (${item.desc})`, sortedList);
                    }}
                    className="flex flex-col items-start p-4 rounded-2xl bg-white border border-sle-neutral-100 hover:border-sle-neutral-200 hover:shadow-lg transition-all duration-200 group/card text-left relative overflow-hidden cursor-pointer active:scale-[0.97]"
                >
                    <div className={`absolute top-0 left-0 w-1 h-full ${item.color}`}></div>
                    <span className={`text-[10px] font-extrabold uppercase tracking-wider mb-2 ${item.text}`}>{item.name}</span>
                    <span className="text-3xl font-extrabold text-sle-neutral-900">{item.count}</span>
                    <p className="text-[10px] text-sle-neutral-400 mt-1 leading-tight opacity-0 group-hover/card:opacity-100 transition-opacity absolute bottom-3 right-3 max-w-[80px] text-right">
                        {item.desc}
                    </p>
                </button>
            ))}
        </div>

        <div className="mt-auto space-y-4">
             <button 
                onClick={() => onDrillDown('Clientes em Risco de Perda', [...atRiskClients].sort((a, b) => b.totalRevenue - a.totalRevenue))}
                className="w-full p-4 bg-amber-50 border border-amber-100 hover:bg-amber-100 hover:border-amber-200 rounded-2xl flex items-center transition-all duration-300 group cursor-pointer active:scale-[0.98]"
            >
                <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center shadow-sm mr-4 text-amber-500 group-hover:scale-110 transition-transform">
                    <AlertTriangle size={20} strokeWidth={2.5} />
                </div>
                <div className="text-left flex-1">
                    <div className="text-sm font-bold text-sle-neutral-900 group-hover:text-amber-900 transition-colors">Risco de Perda</div>
                    <div className="text-xs text-sle-neutral-500 font-medium">Inativo 90+ dias</div>
                </div>
                <div className="text-xl font-extrabold text-amber-600 mr-2">{atRiskClients.length}</div>
                <ArrowRight size={16} className="text-amber-400 opacity-0 group-hover:opacity-100 -translate-x-2 group-hover:translate-x-0 transition-all" strokeWidth={2.5} />
            </button>

            <button 
                onClick={() => onDrillDown('Clientes Inativos', [...lostClients].sort((a, b) => b.totalRevenue - a.totalRevenue))}
                className="w-full p-4 bg-rose-50 border border-rose-100 hover:bg-rose-100 hover:border-rose-200 rounded-2xl flex items-center transition-all duration-300 group cursor-pointer active:scale-[0.98]"
            >
                <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center shadow-sm mr-4 text-rose-500 group-hover:scale-110 transition-transform">
                    <XCircle size={20} strokeWidth={2.5} />
                </div>
                <div className="text-left flex-1">
                    <div className="text-sm font-bold text-sle-neutral-900 group-hover:text-rose-900 transition-colors">Inativos</div>
                    <div className="text-xs text-sle-neutral-500 font-medium flex items-center gap-2">
                        Inativo 180+ dias
                        {premiumLostCount > 0 && (
                            <span className="px-1.5 py-0.5 bg-white border border-rose-100 text-rose-600 rounded text-[9px] font-extrabold uppercase shadow-sm">
                                {premiumLostCount} VIPs
                            </span>
                        )}
                    </div>
                </div>
                <div className="text-xl font-extrabold text-rose-600 mr-2">{lostClients.length}</div>
                <ArrowRight size={16} className="text-rose-400 opacity-0 group-hover:opacity-100 -translate-x-2 group-hover:translate-x-0 transition-all" strokeWidth={2.5} />
            </button>
        </div>
    </div>
  );
};