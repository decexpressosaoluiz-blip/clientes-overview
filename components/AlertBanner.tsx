import React from 'react';
import { AlertTriangle, X, ArrowRight, Zap, TrendingDown, Clock, DollarSign, Package } from 'lucide-react';
import { ClientAlert, Client } from '../types';

interface AlertBannerProps {
  alerts: ClientAlert[];
  onDismiss: (id: string) => void;
  onViewClient: (client: Client) => void;
}

export const AlertBanner: React.FC<AlertBannerProps> = ({ alerts, onDismiss, onViewClient }) => {
  if (alerts.length === 0) return null;

  const getAlertIcon = (type: string) => {
    switch (type) {
        case 'ticket_drop': return <TrendingDown size={18} strokeWidth={2.5} />;
        case 'frequency_drop': return <Clock size={18} strokeWidth={2.5} />;
        default: return <AlertTriangle size={18} strokeWidth={2.5} />;
    }
  };

  const getStyles = (type: string) => {
    switch (type) {
        case 'ticket_drop': return { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-900', iconColor: 'text-amber-600', metricBg: 'bg-amber-100' };
        case 'frequency_drop': return { bg: 'bg-rose-50', border: 'border-rose-200', text: 'text-rose-900', iconColor: 'text-rose-600', metricBg: 'bg-rose-100' };
        default: return { bg: 'bg-sle-red-50', border: 'border-sle-red-200', text: 'text-sle-red-900', iconColor: 'text-sle-red-600', metricBg: 'bg-sle-red-100' };
    }
  };

  return (
    <div className="mb-8 animate-in slide-in-from-top-4 duration-500">
      <div className="bg-white border border-rose-100 rounded-3xl p-6 shadow-elevated relative overflow-hidden">
        <div className="absolute top-0 left-0 w-1 h-full bg-rose-500"></div>
        
        <div className="flex items-center gap-3 mb-6">
           <div className="bg-rose-100 p-2 rounded-xl text-rose-600 animate-pulse">
              <Zap size={20} strokeWidth={2.5} fill="currentColor" fillOpacity={0.2} />
           </div>
           <div>
              <h3 className="text-sm font-extrabold text-sle-neutral-900 uppercase tracking-wide">Atenção Imediata</h3>
              <p className="text-xs text-sle-neutral-500 font-medium">
                Detectamos <strong className="text-rose-600">{alerts.length} anomalias</strong> em clientes da Curva A.
              </p>
           </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {alerts.slice(0, 6).map((alert) => {
            const s = getStyles(alert.type);
            return (
                <div 
                    key={alert.id}
                    onClick={() => onViewClient(alert.client)}
                    className={`relative p-4 rounded-2xl border transition-all cursor-pointer group active:scale-[0.98] hover:shadow-md bg-white border-sle-neutral-200 hover:border-rose-300 flex flex-col justify-between`}
                >
                    <div className="flex justify-between items-start mb-2">
                        <div className={`p-1.5 rounded-lg ${s.bg} ${s.iconColor}`}>
                            {getAlertIcon(alert.type)}
                        </div>
                        <span className={`px-2 py-1 rounded-lg text-[10px] font-extrabold uppercase tracking-wider ${s.metricBg} ${s.text}`}>
                            {alert.metric}
                        </span>
                    </div>
                    
                    <div className="mb-3">
                        <h4 className="font-bold text-sm text-sle-neutral-900 truncate mb-1 pr-6" title={alert.clientName}>{alert.clientName}</h4>
                        <p className="text-xs text-sle-neutral-500 leading-relaxed line-clamp-2 min-h-[2.5em]">{alert.message}</p>
                    </div>

                    <div className="pt-3 border-t border-sle-neutral-50 flex items-center justify-between mt-auto">
                         <div className="flex items-center gap-3">
                             <div className="flex items-center gap-1.5 text-[10px] font-bold text-sle-neutral-600" title={`Receita Total: ${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(alert.client.totalRevenue)}`}>
                                <div className="p-0.5 bg-emerald-50 rounded-md text-emerald-600">
                                    <DollarSign size={10} strokeWidth={3} />
                                </div>
                                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', notation: 'compact' }).format(alert.client.totalRevenue)}
                             </div>
                             <div className="flex items-center gap-1.5 text-[10px] font-bold text-sle-neutral-600" title={`Envios Totais: ${alert.client.totalShipments}`}>
                                <div className="p-0.5 bg-indigo-50 rounded-md text-indigo-600">
                                    <Package size={10} strokeWidth={3} />
                                </div>
                                {alert.client.totalShipments}
                             </div>
                         </div>
                         <ArrowRight size={14} className="text-rose-400 opacity-0 group-hover:opacity-100 -translate-x-2 group-hover:translate-x-0 transition-all" strokeWidth={2.5} />
                    </div>

                    <button 
                        onClick={(e) => { e.stopPropagation(); onDismiss(alert.id); }}
                        className="absolute top-2 right-2 p-1.5 rounded-full text-sle-neutral-300 hover:text-rose-500 hover:bg-rose-50 transition-colors z-10"
                    >
                        <X size={14} strokeWidth={2.5} />
                    </button>
                </div>
            );
          })}
        </div>
        
        {alerts.length > 6 && (
             <div className="mt-4 text-center border-t border-sle-neutral-100 pt-4">
                <button className="text-xs font-bold text-rose-600 uppercase tracking-wide hover:bg-rose-50 px-4 py-2 rounded-full transition-colors">
                    Ver mais {alerts.length - 6} alertas
                </button>
             </div>
        )}
      </div>
    </div>
  );
};