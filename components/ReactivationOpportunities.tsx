import React, { useMemo } from 'react';
import { Client } from '../types';
import { AlertCircle, Calendar, ChevronRight, Download, Sparkles, TrendingUp } from 'lucide-react';

interface ReactivationOpportunitiesProps {
  clients: Client[];
  onDrillDown: (title: string, clients: Client[]) => void;
  onOpenProfile: (client: Client) => void;
}

export const ReactivationOpportunities: React.FC<ReactivationOpportunitiesProps> = ({ clients, onDrillDown, onOpenProfile }) => {
  
  const opportunities = useMemo(() => {
    return clients
      .filter(c => c.recency > 90)
      .sort((a, b) => {
          const getTagWeight = (tag: string | undefined | null) => {
              if (tag === 'Frete Premium') return 4;
              if (tag === 'Alto Volume') return 3;
              if (tag === 'Recuperável') return 2;
              return 1;
          };
          const weightA = getTagWeight(a.opportunityTag);
          const weightB = getTagWeight(b.opportunityTag);
          if (weightA !== weightB) return weightB - weightA;
          return b.averageTicket - a.averageTicket;
      });
  }, [clients]);

  const topOpportunities = opportunities.slice(0, 5);

  const handleExport = () => {
      if (opportunities.length === 0) return;
      const headers = ['Nome do Cliente', 'CNPJ/CPF', 'Ultimo Envio', 'Dias Inativo', 'Ticket Medio', 'Total Historico', 'Classificacao IA'];
      const csvContent = [
          headers.join(';'),
          ...opportunities.map(c => [
              `"${c.name}"`,
              `"${c.cnpj}"`,
              c.lastShipmentDate,
              c.recency,
              c.averageTicket.toFixed(2).replace('.', ','),
              c.monetary.toFixed(2).replace('.', ','),
              c.opportunityTag || 'Baixo Potencial'
          ].join(';'))
      ].join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `oportunidades_reativacao_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
  };

  const formatDate = (dateString: string) => {
      if (!dateString) return 'N/D';
      const [y, m, d] = dateString.split('-');
      return `${d}/${m}/${y}`;
  };

  const getPotentialLabel = (client: Client) => {
      if (client.opportunityTag === 'Frete Premium') return { label: 'Potencial Extremo', color: 'text-purple-600 bg-purple-50 border-purple-100 ring-purple-50' };
      if (client.opportunityTag === 'Alto Volume') return { label: 'Alta Rentabilidade', color: 'text-emerald-600 bg-emerald-50 border-emerald-100 ring-emerald-50' };
      if (client.averageTicket > 1000) return { label: 'Bom Ticket', color: 'text-indigo-600 bg-indigo-50 border-indigo-100 ring-indigo-50' };
      return { label: 'Padrão', color: 'text-sle-neutral-500 bg-sle-neutral-100 border-sle-neutral-200' };
  };

  return (
    <div className="bg-white p-8 rounded-[2rem] shadow-soft border border-sle-neutral-100 h-full flex flex-col select-none transition-all hover:shadow-elevated">
      <div className="flex items-start justify-between mb-6">
        <div>
            <h3 className="text-lg font-extrabold text-sle-neutral-900 flex items-center gap-2">
              <div className="p-2 bg-amber-50 text-amber-500 rounded-xl">
                <Sparkles size={20} strokeWidth={2.5} fill="currentColor" fillOpacity={0.2} />
              </div>
              Reativação Inteligente
            </h3>
        </div>
        <button 
            onClick={handleExport}
            disabled={opportunities.length === 0}
            className="p-2.5 rounded-xl bg-sle-neutral-50 text-sle-neutral-400 hover:bg-indigo-50 hover:text-indigo-600 transition-all active:scale-90 disabled:opacity-50 disabled:cursor-not-allowed border border-transparent hover:border-indigo-100"
            title="Exportar (CSV)"
        >
            <Download size={20} strokeWidth={2} />
        </button>
      </div>

      <div className="flex-1 space-y-3 relative">
        <div className="absolute left-[22px] top-6 bottom-6 w-0.5 bg-sle-neutral-100 -z-10 hidden sm:block"></div>

        {topOpportunities.length > 0 ? (
          topOpportunities.map((client, index) => {
             const potential = getPotentialLabel(client);

             return (
                <button
                    key={client.id} 
                    onClick={() => onOpenProfile(client)}
                    className="w-full flex items-center justify-between p-3 rounded-2xl bg-white border border-transparent hover:border-indigo-100 hover:bg-indigo-50/30 hover:shadow-lg transition-all duration-300 group cursor-pointer active:scale-[0.98] text-left z-10 gap-4"
                >
                  <div className="flex items-center gap-4 flex-1 min-w-0">
                      <div className={`
                        w-10 h-10 rounded-xl flex items-center justify-center text-xs font-bold shadow-sm flex-shrink-0 transition-transform group-hover:scale-110
                        ${index === 0 ? 'bg-gradient-to-br from-amber-400 to-orange-500 text-white ring-4 ring-white' : 'bg-white border border-sle-neutral-200 text-sle-neutral-500 group-hover:border-indigo-200 group-hover:text-indigo-600'}
                      `}>
                        {index + 1}º
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-sle-neutral-800 truncate group-hover:text-indigo-700 transition-colors">
                            {client.name}
                        </p>
                        <div className="flex flex-wrap items-center gap-2 mt-1">
                            <span className={`text-[9px] font-extrabold uppercase tracking-wide px-2 py-0.5 rounded border ${potential.color}`}>
                                {potential.label}
                            </span>
                        </div>
                      </div>
                  </div>
                  
                  <div className="text-right hidden sm:block">
                     <div className="flex items-center justify-end gap-1 text-[10px] font-bold text-sle-neutral-400 uppercase tracking-wide">
                        Ticket Médio <TrendingUp size={12} className="text-emerald-500" />
                     </div>
                     <div className="text-sm font-extrabold text-sle-neutral-900 group-hover:text-indigo-700 tabular-nums">
                        {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', notation: 'compact' }).format(client.averageTicket)}
                     </div>
                  </div>
                </button>
             );
          })
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-sle-neutral-400 text-center p-4">
             <AlertCircle size={32} className="mb-2 opacity-20" strokeWidth={1.5} />
             <p className="text-sm">Nenhuma oportunidade encontrada.</p>
          </div>
        )}
      </div>

      <button 
        onClick={() => onDrillDown('Prioridade de Reativação (Ranking IA)', opportunities)}
        className="mt-6 w-full py-3.5 rounded-xl bg-sle-neutral-50 hover:bg-indigo-50 border border-sle-neutral-100 hover:border-indigo-200 text-sle-neutral-600 hover:text-indigo-600 font-bold text-xs uppercase tracking-wide transition-all flex items-center justify-center group active:scale-95 cursor-pointer shadow-sm hover:shadow-md"
      >
        Ver Lista Completa ({opportunities.length})
        <ChevronRight size={16} className="ml-1 opacity-50 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
      </button>
    </div>
  );
};