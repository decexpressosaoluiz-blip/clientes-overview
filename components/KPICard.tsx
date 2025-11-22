import React, { useState, memo } from 'react';
import { HelpCircle, ArrowRight } from 'lucide-react';

interface KPICardProps {
  title: string;
  value: string;
  subValue?: string;
  icon: React.ReactNode;
  colorIndex: number; // 0 = red, 1 = blue
  explanation: string;
  onClick?: () => void;
  isActive?: boolean;
}

export const KPICard: React.FC<KPICardProps> = memo(({ 
  title, 
  value, 
  subValue, 
  icon, 
  colorIndex, 
  explanation,
  onClick,
  isActive = false
}) => {
  const [showTooltip, setShowTooltip] = useState(false);
  const isRed = colorIndex % 2 === 0;
  
  return (
    <div 
      onClick={onClick}
      className={`
        relative p-4 sm:p-5 rounded-3xl transition-all duration-300 flex flex-col justify-between h-full group select-none bg-white border min-h-[140px]
        ${isActive 
            ? 'shadow-xl ring-2 ring-offset-2 ' + (isRed ? 'ring-rose-500 border-rose-100' : 'ring-indigo-500 border-indigo-100')
            : 'shadow-card border-transparent hover:border-sle-neutral-100 hover:shadow-elevated hover:-translate-y-1'
        }
        ${onClick ? 'cursor-pointer active:scale-[0.98]' : 'cursor-default'}
      `}
      onMouseLeave={() => setShowTooltip(false)}
    >
      <div className="flex items-start justify-between mb-4">
        <div className={`
          p-2.5 sm:p-3 rounded-2xl transition-all duration-300 shadow-sm group-hover:scale-110 group-hover:rotate-3
          ${isRed 
            ? 'bg-rose-50 text-rose-500 group-hover:bg-rose-500 group-hover:text-white' 
            : 'bg-indigo-50 text-indigo-500 group-hover:bg-indigo-500 group-hover:text-white'}
        `}>
          {React.cloneElement(icon as React.ReactElement, { 
            size: 18, 
            strokeWidth: 2.5
          })}
        </div>
        
        <div className="relative">
             <button 
                type="button"
                onMouseEnter={() => setShowTooltip(true)}
                onClick={(e) => { e.stopPropagation(); setShowTooltip(!showTooltip); }}
                className="p-2 rounded-full hover:bg-sle-neutral-50 text-sle-neutral-300 hover:text-sle-blue-600 transition-colors focus:outline-none cursor-help active:scale-90"
             >
                <HelpCircle size={16} strokeWidth={2} />
             </button>
             
             {showTooltip && (
               <div className="absolute right-0 w-64 p-4 bg-sle-neutral-900 text-white text-xs leading-relaxed rounded-2xl shadow-2xl animate-in fade-in zoom-in-95 duration-200 z-50 top-10 pointer-events-none">
                 <div className="absolute -top-1.5 right-3 w-3 h-3 bg-sle-neutral-900 rotate-45"></div>
                 <p className="font-medium opacity-90">{explanation}</p>
               </div>
             )}
        </div>
      </div>

      <div className="flex-1 flex flex-col justify-end">
        <h3 className="text-sle-neutral-400 text-[9px] sm:text-[10px] font-extrabold uppercase tracking-widest mb-1 truncate">{title}</h3>
        <div className="text-[20px] sm:text-[24px] lg:text-[26px] font-extrabold text-sle-neutral-900 tracking-tight leading-none truncate">
          {value}
        </div>
        {subValue && (
          <div className={`text-[10px] sm:text-[11px] font-bold mt-2 sm:mt-3 inline-flex items-center px-2 py-0.5 sm:py-1 rounded-lg transition-colors w-fit ${
            isRed 
            ? 'bg-rose-50 text-rose-700 group-hover:bg-rose-100' 
            : 'bg-indigo-50 text-indigo-700 group-hover:bg-indigo-100'
          }`}>
            {subValue}
          </div>
        )}
      </div>

      {onClick && (
        <div className="mt-3 sm:mt-4 pt-3 sm:pt-4 border-t border-sle-neutral-50 flex items-center text-[9px] sm:text-[10px] font-bold text-sle-neutral-400 group-hover:text-indigo-600 transition-colors uppercase tracking-widest">
           Explorar <ArrowRight size={14} className="ml-auto transform group-hover:translate-x-1 transition-transform duration-300" />
        </div>
      )}
    </div>
  );
});