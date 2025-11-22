import React, { useEffect, useState } from 'react';
import { Client } from '../types';
import { X, Sparkles, BrainCircuit, RefreshCw, FileText, CheckCircle2 } from 'lucide-react';
import { generatePortfolioAnalysis } from '../services/geminiService';

interface PortfolioAnalysisModalProps {
  clients: Client[];
  onClose: () => void;
}

export const PortfolioAnalysisModal: React.FC<PortfolioAnalysisModalProps> = ({ clients, onClose }) => {
  const [report, setReport] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const runAnalysis = async () => {
      setIsLoading(true);
      const result = await generatePortfolioAnalysis(clients);
      setReport(result);
      setIsLoading(false);
    };
    runAnalysis();
  }, [clients]);

  // Simple Markdown parser for display purposes (Headers, lists, bold)
  const renderMarkdown = (text: string) => {
    if (!text) return null;

    const lines = text.split('\n');
    return lines.map((line, index) => {
      // Headers
      if (line.startsWith('### ')) return <h3 key={index} className="text-lg font-bold text-sle-neutral-900 dark:text-white mt-6 mb-3">{line.replace('### ', '')}</h3>;
      if (line.startsWith('## ')) return <h2 key={index} className="text-xl font-bold text-indigo-600 dark:text-indigo-400 mt-8 mb-4 border-b border-indigo-100 dark:border-indigo-900 pb-2">{line.replace('## ', '')}</h2>;
      if (line.startsWith('# ')) return <h1 key={index} className="text-2xl font-extrabold text-sle-neutral-900 dark:text-white mb-6">{line.replace('# ', '')}</h1>;
      
      // List items
      if (line.trim().startsWith('- ')) {
          return (
            <li key={index} className="ml-4 list-disc text-sle-neutral-600 dark:text-sle-blue-200 mb-1 pl-1">
                {parseBold(line.replace('- ', ''))}
            </li>
          );
      }
      if (line.trim().match(/^\d+\. /)) {
           return (
            <div key={index} className="ml-4 flex gap-2 text-sle-neutral-600 dark:text-sle-blue-200 mb-1">
                <span className="font-bold min-w-[20px]">{line.split('.')[0]}.</span>
                <span>{parseBold(line.replace(/^\d+\. /, ''))}</span>
            </div>
          );
      }

      // Empty lines
      if (line.trim() === '') return <div key={index} className="h-2"></div>;

      // Tables (simple detection)
      if (line.includes('|')) {
          // Basic table row rendering could be complex, treating as code block for now or simple pre
          return <pre key={index} className="whitespace-pre-wrap font-mono text-xs bg-sle-neutral-50 dark:bg-sle-blue-950 p-1 rounded text-sle-neutral-700 dark:text-sle-blue-300 overflow-x-auto">{line}</pre>
      }

      // Paragraphs
      return <p key={index} className="text-sle-neutral-600 dark:text-sle-blue-200 mb-2 leading-relaxed">{parseBold(line)}</p>;
    });
  };

  const parseBold = (text: string) => {
    const parts = text.split(/(\*\*.*?\*\*)/);
    return parts.map((part, i) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={i} className="font-bold text-sle-neutral-800 dark:text-white">{part.slice(2, -2)}</strong>;
      }
      return part;
    });
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-0 sm:p-6 animate-in fade-in duration-300">
      <div 
        className="absolute inset-0 bg-sle-blue-950/70 backdrop-blur-sm transition-opacity" 
        onClick={onClose}
      ></div>
      
      <div className="relative bg-white dark:bg-sle-blue-900 w-full max-w-5xl h-full sm:h-[90vh] flex flex-col sm:rounded-3xl shadow-2xl border dark:border-sle-blue-800 overflow-hidden">
        
        {/* Header */}
        <div className="px-8 py-5 border-b border-sle-neutral-100 dark:border-sle-blue-800 bg-white dark:bg-sle-blue-900 flex justify-between items-center">
            <div className="flex items-center gap-3">
                <div className="p-2 bg-indigo-50 dark:bg-indigo-900/30 rounded-xl text-indigo-600 dark:text-indigo-400">
                    <BrainCircuit size={24} strokeWidth={2} />
                </div>
                <div>
                    <h2 className="text-xl font-bold text-sle-neutral-900 dark:text-white">Análise Avançada de Carteira</h2>
                    <p className="text-xs text-sle-neutral-500 dark:text-sle-blue-300 flex items-center gap-1">
                        <Sparkles size={12} /> Powered by Gemini 2.5 Flash Analyst
                    </p>
                </div>
            </div>
            <button 
                onClick={onClose} 
                className="p-2 rounded-full hover:bg-sle-neutral-100 dark:hover:bg-sle-blue-800 text-sle-neutral-400 dark:text-sle-blue-300 transition-colors"
            >
                <X size={24} />
            </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto custom-scrollbar bg-white dark:bg-sle-blue-900 p-8 sm:p-12">
            {isLoading ? (
                <div className="h-full flex flex-col items-center justify-center text-center space-y-6">
                    <div className="relative">
                        <div className="absolute inset-0 bg-indigo-500/20 rounded-full blur-xl animate-pulse"></div>
                        <RefreshCw size={48} className="text-indigo-600 dark:text-indigo-400 animate-spin relative z-10" />
                    </div>
                    <div>
                        <h3 className="text-xl font-bold text-sle-neutral-800 dark:text-white mb-2">Processando Base de Dados...</h3>
                        <p className="text-sle-neutral-500 dark:text-sle-blue-300 max-w-md mx-auto">
                            O analista IA está validando colunas, cruzando dados de receita e comportamento, e gerando clusters de segmentação. Isso pode levar alguns segundos.
                        </p>
                    </div>
                    <div className="flex gap-2 text-xs font-mono text-sle-neutral-400 dark:text-sle-blue-400 bg-sle-neutral-50 dark:bg-sle-blue-950 px-4 py-2 rounded-lg border border-sle-neutral-100 dark:border-sle-blue-800">
                        <span>Analysing {clients.length} records</span>
                        <span className="animate-pulse">...</span>
                    </div>
                </div>
            ) : (
                <div className="max-w-4xl mx-auto">
                    <div className="prose prose-indigo dark:prose-invert max-w-none">
                        {renderMarkdown(report)}
                    </div>
                    
                    <div className="mt-12 pt-8 border-t border-sle-neutral-100 dark:border-sle-blue-800 flex items-center justify-center text-sle-neutral-400 dark:text-sle-blue-400 text-sm">
                        <CheckCircle2 size={16} className="mr-2 text-emerald-500" />
                        Relatório gerado com sucesso com base em {clients.length} clientes.
                    </div>
                </div>
            )}
        </div>

      </div>
    </div>
  );
};