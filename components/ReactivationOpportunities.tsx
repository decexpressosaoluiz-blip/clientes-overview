import React, { useMemo, useState } from 'react';
import { Client } from '../types';
import { AlertCircle, Calendar, ChevronRight, Download, Sparkles, TrendingUp, Filter, Ban, DollarSign, Package } from 'lucide-react';

interface ReactivationOpportunitiesProps {
  clients: Client[];
  onDrillDown: (title: string, clients: Client[]) => void;
  onOpenProfile: (client: Client) => void;
}

export const ReactivationOpportunities: React.FC<ReactivationOpportunitiesProps> = ({ clients, onDrillDown, onOpenProfile }) => {
  const [showJustified, setShowJustified] = useState(false);

  const { activeOpportunities, justifiedOpportunities } = useMemo(() => {
    const allOpp = clients.filter(c => c.recency > 90);
    const justified = allOpp.filter(c => !!c.justification);
    
    // ORDENAÇÃO INTELIGENTE PARA REATIVAÇÃO
    // Prioridade: LTV (Faturamento Total) > Recorrência > Ticket
    // Penalidade: Clientes com menos de 3 envios caem drasticamente no ranking
    const active = allOpp.filter(c => !c.justification).sort((a, b) => {
          // Penalidade forte para clientes "One-Off" (1 ou 2 envios)
          if (a.totalShipments <= 2 && b.totalShipments > 2) return 1;
          if (b.totalShipments <= 2 && a.totalShipments > 2) return -1;
          
          // Se ambos tem bom volume, ordena pelo dinheiro deixado na mesa (LTV Total)
          // Isso resolve o problema de Ticket alto em 1 envio vs Volume massivo de envios
          return b.totalRevenue - a.totalRevenue;
      });
      return { activeOpportunities: active, justifiedOpportunities: justified };
  }, [clients]);

  const displayedList = showJustified ? justifiedOpportunities : activeOpportunities;
  const topOpportunities = displayedList.slice(0, 5);

  const handleExport = () => {
      if (displayedList.length === 0) return;
      const headers = ['Nome do Cliente', 'CNPJ/CPF', 'Ultimo Envio', 'Dias Inativo', 'Ticket Medio', 'Total Historico', 'Total Envios', 'Justificativa'];
      const csvContent = [
          headers.join(';'),
          ...displayedList.map(c => [
              `"${c.name}"`,
              `"${c.cnpj}"`,
              c.lastShipmentDate,
              c.recency,
              c.averageTicket.toFixed(2).replace('.', ','),
              c.totalRevenue.toFixed(2).replace('.', ','), // Mudado para monetary (totalRevenue do filtro) ou monetary (geral) se necessário, aqui usa o do objeto
              c.totalShipments,
              c.justification ? c.justification.reason : (c.opportunityTag || 'Baixo Potencial')
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

  const getPotentialLabel = (client: Client) => {
      if (client.justification) return { label: client.justification.reason || 'Justificado', color: 'text-sle-neutral-500 bg-sle-neutral-100 border-sle-neutral-200' };
      
      // Labels baseados nas tags geradas ou lógica visual
      if (client.opportunityTag === 'Frete Premium') return { label: 'Ticket Recorrente', color: 'text-purple-600 bg-purple-50 border-purple-100 ring-purple-50' };
      if (client.opportunityTag === 'Alto Volume') return { label: 'Alto LTV', color: 'text-emerald-600 bg-emerald-50 border-emerald-100 ring-emerald-50' };
      if (client.totalShipments > 10) return { label: 'Alta Frequência', color: 'text-indigo-600 bg-indigo-50 border-indigo-100 ring-indigo-50' };
      
      return { label: 'Recuperável', color: 'text-sle-neutral-500 bg-sle-neutral-100 border-sle-neutral-200' };
  };

  return (
    <div className="bg-white p-6 sm:p-8 rounded-[2rem] shadow-soft border border-sle-neutral-100 h-full flex flex-col select-none transition-all hover:shadow-elevated relative overflow-hidden group">
      
      {/* Header */}
      <div className="flex items-start justify-between mb-4 z-10 relative">
        <div>
            <h3 className="text-lg font-extrabold text-sle-neutral-900 flex items-center gap-2">
              <div className={`p-2 rounded-xl transition-colors ${showJustified ? 'bg-sle-neutral-100 text-sle-neutral-500' : 'bg-amber-50 text-amber-500'}`}>
                {showJustified ? <Ban size={20} strokeWidth={2.5} /> : <Sparkles size={20} strokeWidth={2.5} fill="currentColor" fillOpacity={0.2} />}
              </div>
              <span className="truncate">{showJustified ? 'Justificados' : 'Reativação Inteligente'}</span>
            </h3>
        </div>
        <div className="flex gap-2">
            <button 
                onClick={() => setShowJustified(!showJustified)}
                className={`p-2.5 rounded-xl transition-all active:scale-90 border ${showJustified ? 'bg-amber-50 text-amber-600 border-amber-200' : 'bg-sle-neutral-50 text-sle-neutral-400 border-transparent hover:border-indigo-100 hover:text-indigo-600'}`}
                title={showJustified ? "Ver Oportunidades" : "Ver Justificados"}
            >
                <Filter size={20} strokeWidth={2} />
            </button>
            <button 
                onClick={handleExport}
                disabled={displayedList.length === 0}
                className="p-2.5 rounded-xl bg-sle-neutral-50 text-sle-neutral-400 hover:bg-indigo-50 hover:text-indigo-600 transition-all active:scale-90 disabled:opacity-50 disabled:cursor-not-allowed border border-transparent hover:border-indigo-100"
                title="Exportar (CSV)"
            >
                <Download size={20} strokeWidth={2} />
            </button>
        </div>
      </div>
      
      {showJustified && (
          <div className="mb-4 px-4 py-2 bg-sle-neutral-50 rounded-lg text-[10px] text-sle-neutral-500 text-center border border-sle-neutral-100">
              Exibindo clientes removidos.
          </div>
      )}

      <div className="flex-1 space-y-3 relative z-10">
        <div className="absolute left-[22px] top-6 bottom-6 w-0.5 bg-sle-neutral-100 -z-10 hidden sm:block"></div>

        {topOpportunities.length > 0 ? (
          topOpportunities.map((client, index) => {
             const potential = getPotentialLabel(client);

             return (
                <button
                    key={client.id} 
                    onClick={() => onOpenProfile(client)}
                    className={`w-full flex items-center justify-between p-3 rounded-2xl bg-white border border-transparent hover:shadow-lg transition-all duration-300 group cursor-pointer active:scale-[0.98] text-left z-10 gap-3 sm:gap-4 ${showJustified ? 'opacity-75 hover:opacity-100' : 'hover:border-indigo-100 hover:bg-indigo-50/30'}`}
                >
                  <div className="flex items-center gap-3 sm:gap-4 flex-1 min-w-0">
                      <div className={`
                        w-8 h-8 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center text-xs font-bold shadow-sm flex-shrink-0 transition-transform group-hover:scale-110
                        ${showJustified 
                            ? 'bg-sle-neutral-100 text-sle-neutral-400'
                            : (index === 0 ? 'bg-gradient-to-br from-amber-400 to-orange-500 text-white ring-4 ring-white' : 'bg-white border border-sle-neutral-200 text-sle-neutral-500 group-hover:border-indigo-200 group-hover:text-indigo-600')
                        }
                      `}>
                        {index + 1}º
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <p className="text-xs sm:text-sm font-bold text-sle-neutral-800 truncate group-hover:text-indigo-700 transition-colors">
                            {client.name}
                        </p>
                        <div className="flex flex-wrap items-center gap-2 mt-1">
                            <span className={`text-[9px] font-extrabold uppercase tracking-wide px-2 py-0.5 rounded border truncate ${potential.color}`}>
                                {potential.label}
                            </span>
                            <span className="text-[9px] font-bold text-sle-neutral-400 flex items-center gap-1 bg-sle-neutral-50 px-1.5 py-0.5 rounded">
                                <Package size={10} strokeWidth={2.5}/> {client.totalShipments} envios
                            </span>
                        </div>
                      </div>
                  </div>
                  
                  <div className="text-right hidden sm:block">
                     <div className="flex items-center justify-end gap-1 text-[10px] font-bold text-sle-neutral-400 uppercase tracking-wide">
                        Total Histórico <DollarSign size={10} className="text-emerald-500" />
                     </div>
                     <div className="text-sm font-extrabold text-sle-neutral-900 group-hover:text-indigo-700 tabular-nums">
                        {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', notation: 'compact' }).format(client.totalRevenue)}
                     </div>
                  </div>
                </button>
             );
          })
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-sle-neutral-400 text-center p-4">
             <AlertCircle size={32} className="mb-2 opacity-20" strokeWidth={1.5} />
             <p className="text-sm">{showJustified ? 'Nenhum cliente justificado.' : 'Nenhuma oportunidade encontrada.'}</p>
          </div>
        )}
      </div>

      <button 
        onClick={() => onDrillDown(showJustified ? 'Clientes Justificados' : 'Prioridade de Reativação (LTV & Recorrência)', displayedList)}
        className="mt-6 w-full py-3.5 rounded-xl bg-sle-neutral-50 hover:bg-indigo-50 border border-sle-neutral-100 hover:border-indigo-200 text-sle-neutral-600 hover:text-indigo-600 font-bold text-xs uppercase tracking-wide transition-all flex items-center justify-center group active:scale-95 cursor-pointer shadow-sm hover:shadow-md"
      >
        Ver Lista Completa ({displayedList.length})
        <ChevronRight size={16} className="ml-1 opacity-50 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
      </button>
    </div>
  );
};