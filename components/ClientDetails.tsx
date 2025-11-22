import React from 'react';
import { ClientData, Sentiment } from '../types';
import { X, MessageSquare, TrendingUp, AlertTriangle, CheckCircle2, BrainCircuit } from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, Tooltip, Cell } from 'recharts';

interface ClientDetailsProps {
  client: ClientData | null;
  onClose: () => void;
}

export const ClientDetails: React.FC<ClientDetailsProps> = ({ client, onClose }) => {
  if (!client) return null;

  // Mock historical data for the chart based on current score
  const data = [
    { month: 'Jan', score: Math.max(10, client.score - 15) },
    { month: 'Fev', score: Math.max(10, client.score - 5) },
    { month: 'Mar', score: Math.max(10, client.score + 5) },
    { month: 'Abr', score: client.score },
  ];

  const translateStatus = (status: string) => {
    if (status === 'Churn Risk') return 'Risco de Perda';
    if (status === 'Active') return 'Ativo';
    if (status === 'Inactive') return 'Inativo';
    return status;
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div 
        className="absolute inset-0 bg-slate-900/20 backdrop-blur-sm transition-opacity" 
        onClick={onClose}
      ></div>
      
      <div className="relative w-full max-w-md md:max-w-lg bg-white h-full shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
        {/* Header */}
        <div className="p-6 border-b border-slate-100 flex justify-between items-start bg-slate-50/50">
          <div>
            <div className="flex items-center space-x-3 mb-2">
              <h2 className="text-2xl font-bold text-slate-900">{client.name}</h2>
              <span className={`px-2 py-0.5 rounded-full text-xs font-bold border ${
                client.status === 'Active' ? 'bg-emerald-100 text-emerald-700 border-emerald-200' : 
                'bg-rose-100 text-rose-700 border-rose-200'
              }`}>
                {translateStatus(client.status)}
              </span>
            </div>
            <p className="text-slate-500 text-sm flex items-center">
              <MessageSquare size={14} className="mr-1.5" /> {client.email}
            </p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white rounded-full text-slate-400 hover:text-slate-700 transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-8">
          
          {/* AI Summary Section */}
          <div className="bg-indigo-50/50 rounded-xl p-5 border border-indigo-100">
            <div className="flex items-center mb-3 text-indigo-700">
              <BrainCircuit size={18} className="mr-2" />
              <h4 className="font-semibold text-sm uppercase tracking-wide">Análise IA Gemini</h4>
            </div>
            <p className="text-slate-700 text-sm leading-relaxed">
              {client.summary}
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {client.tags.map(tag => (
                <span key={tag} className="px-2.5 py-1 bg-white border border-indigo-100 text-indigo-600 text-xs rounded-md font-medium shadow-sm">
                  #{tag}
                </span>
              ))}
            </div>
          </div>

          {/* Metrics Grid */}
          <div className="grid grid-cols-2 gap-4">
             <div className="p-4 rounded-xl border border-slate-100 bg-white shadow-sm">
                <p className="text-slate-500 text-xs font-medium mb-1 uppercase">Saúde do Cliente</p>
                <div className="flex items-end justify-between">
                    <span className="text-2xl font-bold text-slate-800">{client.score}/100</span>
                    {client.score > 70 ? <TrendingUp size={20} className="text-emerald-500 mb-1" /> : <AlertTriangle size={20} className="text-amber-500 mb-1" />}
                </div>
             </div>
             <div className="p-4 rounded-xl border border-slate-100 bg-white shadow-sm">
                <p className="text-slate-500 text-xs font-medium mb-1 uppercase">Receita Mensal</p>
                <div className="flex items-end justify-between">
                    <span className="text-2xl font-bold text-slate-800">
                        {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', notation: 'compact' }).format(client.revenue)}
                    </span>
                </div>
             </div>
          </div>

          {/* Chart */}
          <div>
            <h4 className="font-semibold text-slate-800 mb-4 text-sm">Histórico de Engajamento</h4>
            <div className="h-48 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data}>
                  <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{fontSize: 12, fill: '#94a3b8'}} />
                  <Tooltip 
                    cursor={{fill: '#f1f5f9'}}
                    contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}}
                  />
                  <Bar dataKey="score" radius={[4, 4, 0, 0]}>
                    {data.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={index === 3 ? '#6366f1' : '#cbd5e1'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Actions */}
          <div>
            <h4 className="font-semibold text-slate-800 mb-3 text-sm">Ações Recomendadas</h4>
            <ul className="space-y-2">
                {client.sentiment === Sentiment.NEGATIVE ? (
                     <li className="flex items-start p-3 bg-rose-50 rounded-lg border border-rose-100 text-sm text-rose-800">
                        <AlertTriangle size={16} className="mr-2 mt-0.5 flex-shrink-0" />
                        Agendar reunião de alinhamento urgente para discutir insatisfação recente.
                     </li>
                ) : (
                    <li className="flex items-start p-3 bg-emerald-50 rounded-lg border border-emerald-100 text-sm text-emerald-800">
                        <CheckCircle2 size={16} className="mr-2 mt-0.5 flex-shrink-0" />
                        Oferecer upgrade de plano baseado no alto engajamento.
                    </li>
                )}
            </ul>
          </div>
        </div>
        
        {/* Footer */}
        <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end space-x-3">
            <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-200 rounded-lg transition-colors">
                Fechar
            </button>
            <button className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm shadow-indigo-200 transition-colors">
                Entrar em Contato
            </button>
        </div>
      </div>
    </div>
  );
};