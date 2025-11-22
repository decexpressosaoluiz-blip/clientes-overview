import React from 'react';
import { ArrowUpRight, ArrowDownRight, Activity } from 'lucide-react';

interface StatsCardProps {
  title: string;
  value: string;
  trend?: string;
  trendDirection?: 'up' | 'down' | 'neutral';
  icon: React.ReactNode;
  colorClass: string;
}

export const StatsCard: React.FC<StatsCardProps> = ({ title, value, trend, trendDirection, icon, colorClass }) => {
  return (
    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 hover:shadow-md transition-all duration-300">
      <div className="flex justify-between items-start">
        <div>
          <p className="text-sm font-medium text-slate-500 mb-1">{title}</p>
          <h3 className="text-2xl font-bold text-slate-900">{value}</h3>
        </div>
        <div className={`p-3 rounded-xl ${colorClass}`}>
          {icon}
        </div>
      </div>
      {trend && (
        <div className="mt-4 flex items-center text-sm">
          <span className={`flex items-center font-medium ${
            trendDirection === 'up' ? 'text-emerald-600' : 
            trendDirection === 'down' ? 'text-rose-600' : 'text-slate-600'
          }`}>
            {trendDirection === 'up' ? <ArrowUpRight size={16} className="mr-1" /> : 
             trendDirection === 'down' ? <ArrowDownRight size={16} className="mr-1" /> : 
             <Activity size={16} className="mr-1" />}
            {trend}
          </span>
          <span className="text-slate-400 ml-2">vs. mês passado</span>
        </div>
      )}
    </div>
  );
};