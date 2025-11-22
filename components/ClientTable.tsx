import React from 'react';
import { ClientData, Sentiment } from '../types';
import { MoreHorizontal, TrendingUp, TrendingDown, AlertCircle } from 'lucide-react';

interface ClientTableProps {
  clients: ClientData[];
  onSelectClient: (client: ClientData) => void;
}

export const ClientTable: React.FC<ClientTableProps> = ({ clients, onSelectClient }) => {
  
  const getSentimentColor = (sentiment: Sentiment) => {
    switch (sentiment) {
      case Sentiment.POSITIVE: return 'bg-emerald-100 text-emerald-700 border-emerald-200';
      case Sentiment.NEGATIVE: return 'bg-rose-100 text-rose-700 border-rose-200';
      default: return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-emerald-600';
    if (score >= 50) return 'text-amber-500';
    return 'text-rose-600';
  };

  const translateStatus = (status: string) => {
    if (status === 'Churn Risk') return 'Risco de Perda';
    if (status === 'Active') return 'Ativo';
    if (status === 'Inactive') return 'Inativo';
    return status;
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
      <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-white sticky top-0 z-10">
        <h3 className="font-semibold text-slate-800">Clientes Recentes</h3>
        <span className="text-xs font-medium bg-slate-100 text-slate-600 px-2.5 py-1 rounded-full">
          {clients.length} Total
        </span>
      </div>
      
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50/50 text-slate-500 text-xs uppercase tracking-wider font-semibold">
              <th className="px-6 py-3">Cliente</th>
              <th className="px-6 py-3">Status</th>
              <th className="px-6 py-3">Saúde (Score)</th>
              <th className="px-6 py-3">Receita</th>
              <th className="px-6 py-3">Sentimento</th>
              <th className="px-6 py-3 text-right">Ação</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {clients.map((client) => (
              <tr 
                key={client.id} 
                onClick={() => onSelectClient(client)}
                className="hover:bg-slate-50/80 cursor-pointer transition-colors group"
              >
                <td className="px-6 py-4">
                  <div className="flex items-center">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-white font-bold text-sm shadow-sm">
                      {client.name.charAt(0)}
                    </div>
                    <div className="ml-3">
                      <p className="text-sm font-semibold text-slate-900">{client.name}</p>
                      <p className="text-xs text-slate-400">{client.email}</p>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <span className={`px-2.5 py-1 rounded-full text-xs font-medium border ${
                    client.status === 'Active' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' :
                    client.status === 'Churn Risk' ? 'bg-rose-50 text-rose-700 border-rose-100' :
                    'bg-slate-50 text-slate-600 border-slate-100'
                  }`}>
                    {translateStatus(client.status)}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <div className="flex items-center">
                    <div className="w-full max-w-[80px] h-1.5 bg-slate-100 rounded-full overflow-hidden mr-3">
                      <div 
                        className={`h-full rounded-full ${
                          client.score >= 80 ? 'bg-emerald-500' : 
                          client.score >= 50 ? 'bg-amber-400' : 'bg-rose-500'
                        }`} 
                        style={{ width: `${client.score}%` }}
                      ></div>
                    </div>
                    <span className={`text-xs font-bold ${getScoreColor(client.score)}`}>
                      {client.score}
                    </span>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <span className="text-sm font-medium text-slate-700">
                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(client.revenue)}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <span className={`px-2.5 py-1 rounded-full text-xs font-medium border ${getSentimentColor(client.sentiment)}`}>
                    {client.sentiment}
                  </span>
                </td>
                <td className="px-6 py-4 text-right">
                  <button className="p-2 hover:bg-white rounded-full text-slate-400 hover:text-slate-600 transition-colors hover:shadow-sm">
                    <MoreHorizontal size={16} />
                  </button>
                </td>
              </tr>
            ))}
            {clients.length === 0 && (
              <tr>
                <td colSpan={6} className="px-6 py-12 text-center text-slate-400 text-sm">
                  Nenhum cliente encontrado. Faça upload de um arquivo para começar.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};