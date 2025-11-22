import React, { useState } from 'react';
import { Client } from '../types';
import { X, Calendar, Star } from 'lucide-react';
import { ClientProfile } from './ClientProfile';

interface DrillDownTableProps {
  title: string;
  clients: Client[];
  onClose: () => void;
}

export const DrillDownTable: React.FC<DrillDownTableProps> = ({ title, clients, onClose }) => {
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);

  if (selectedClient) {
      return (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-0 sm:p-6">
            <div 
                className="absolute inset-0 bg-sle-blue-950/40 backdrop-blur-sm transition-opacity" 
                onClick={onClose}
            ></div>
            <div className="relative bg-white rounded-none sm:rounded-[2rem] shadow-2xl w-full max-w-6xl h-full sm:h-[90vh] flex flex-col overflow-hidden border border-white/20">
                <ClientProfile client={selectedClient} onBack={() => setSelectedClient(null)} />
            </div>
          </div>
      )
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
      <div 
        className="absolute inset-0 bg-sle-blue-950/40 backdrop-blur-md transition-opacity" 
        onClick={onClose}
      ></div>

      <div className="relative bg-white rounded-[2rem] shadow-2xl w-full max-w-6xl h-[85vh] flex flex-col animate-in fade-in zoom-in-95 duration-300 border border-white/20 ring-1 ring-black/5 overflow-hidden select-none">
        
        <div className="px-8 py-6 border-b border-sle-neutral-100 flex justify-between items-center bg-white sticky top-0 z-20">
          <div>
            <h2 className="text-2xl font-extrabold text-sle-neutral-900 tracking-tight">{title}</h2>
            <div className="flex items-center mt-1 space-x-2">
                <span className="bg-indigo-50 text-indigo-700 px-3 py-1 rounded-lg text-[11px] font-extrabold uppercase tracking-wide border border-indigo-100">
                    {clients.length} clientes
                </span>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="p-3 rounded-full bg-sle-neutral-50 hover:bg-rose-50 text-sle-neutral-400 hover:text-rose-500 transition-all hover:rotate-90 active:scale-90 cursor-pointer"
          >
            <X size={20} strokeWidth={2.5} />
          </button>
        </div>

        <div className="flex-1 overflow-auto custom-scrollbar bg-white">
          <table className="w-full text-left border-collapse">
            <thead className="sticky top-0 z-10 bg-white/95 backdrop-blur border-b border-sle-neutral-100 shadow-sm">
              <tr>
                <th className="px-8 py-5 text-[10px] font-extrabold text-sle-neutral-400 uppercase tracking-widest">Cliente</th>
                <th className="px-8 py-5 text-[10px] font-extrabold text-sle-neutral-400 uppercase tracking-widest text-right">Faturamento</th>
                <th className="px-8 py-5 text-[10px] font-extrabold text-sle-neutral-400 uppercase tracking-widest text-center">Envios</th>
                <th className="px-8 py-5 text-[10px] font-extrabold text-sle-neutral-400 uppercase tracking-widest">Última Atividade</th>
                <th className="px-8 py-5 text-[10px] font-extrabold text-sle-neutral-400 uppercase tracking-widest text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-sle-neutral-50">
              {clients.map((client, idx) => (
                <tr 
                    key={client.id} 
                    onClick={() => setSelectedClient(client)}
                    className="group hover:bg-indigo-50/40 transition-colors cursor-pointer active:scale-[0.995] duration-100"
                >
                  <td className="px-8 py-5">
                    <div className="flex items-center">
                        <span className={`
                            mr-4 w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold shadow-sm
                            ${idx < 3 ? 'bg-amber-100 text-amber-700' : 'bg-sle-neutral-100 text-sle-neutral-400'}
                        `}>
                            {idx + 1}
                        </span>
                        <div>
                            <p className="text-sm font-bold text-sle-neutral-900 group-hover:text-indigo-600 transition-colors">{client.name}</p>
                            <p className="text-[11px] text-sle-neutral-400 font-mono mt-0.5">{client.cnpj}</p>
                        </div>
                    </div>
                  </td>
                  <td className="px-8 py-5 text-right">
                    <span className="text-sm font-bold text-sle-neutral-700 font-mono group-hover:text-sle-neutral-900">
                         {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(client.totalRevenue)}
                    </span>
                  </td>
                   <td className="px-8 py-5 text-center">
                    <span className="px-3 py-1 rounded-lg text-xs font-bold bg-sle-neutral-50 text-sle-neutral-600 group-hover:bg-white group-hover:shadow-sm transition-all border border-transparent group-hover:border-sle-neutral-100">
                         {client.totalShipments}
                    </span>
                  </td>
                  <td className="px-8 py-5">
                     <div className="flex items-center text-xs font-medium text-sle-neutral-500">
                        <Calendar size={12} className="mr-1.5 text-sle-neutral-400" strokeWidth={2} />
                        {new Date(client.lastShipmentDate).toLocaleDateString('pt-BR')}
                     </div>
                    <span className={`block text-[10px] font-bold mt-1 uppercase tracking-wide ${client.recency > 90 ? 'text-rose-500' : 'text-emerald-500'}`}>
                        {client.recency} dias atrás
                    </span>
                  </td>
                   <td className="px-8 py-5 text-center">
                    {client.opportunityTag ? (
                        <span className={`inline-flex items-center px-3 py-1 rounded-full text-[10px] font-bold border shadow-sm uppercase tracking-wide ${
                            client.opportunityTag === 'Frete Premium' 
                                ? 'bg-purple-50 text-purple-600 border-purple-100' 
                                : 'bg-emerald-50 text-emerald-600 border-emerald-100'
                        }`}>
                            <Star size={10} className="mr-1 fill-current" /> {client.opportunityTag}
                        </span>
                    ) : (
                        <div className="w-full bg-sle-neutral-100 rounded-full h-1.5 overflow-hidden max-w-[80px] mx-auto">
                            <div 
                                className={`h-full rounded-full ${
                                    client.healthValue >= 80 ? 'bg-emerald-500' :
                                    client.healthValue >= 50 ? 'bg-amber-500' : 'bg-rose-500'
                                }`} 
                                style={{width: `${client.healthValue}%`}}
                            />
                        </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        <div className="p-4 bg-white border-t border-sle-neutral-100 flex justify-end sticky bottom-0">
            <button onClick={onClose} className="px-6 py-3 bg-sle-neutral-900 text-white rounded-xl hover:bg-sle-neutral-800 transition-all text-xs font-bold shadow-lg hover:shadow-xl active:scale-95 cursor-pointer uppercase tracking-wider">
                Fechar Visualização
            </button>
        </div>
      </div>
    </div>
  );
};