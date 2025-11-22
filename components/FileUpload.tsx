import React, { useState, useRef } from 'react';
import { UploadCloud, FileText, X, CheckCircle, Loader2 } from 'lucide-react';
import { UploadStatus } from '../types';

interface FileUploadProps {
  onFileUpload: (file: File) => void;
  status: UploadStatus;
}

export const FileUpload: React.FC<FileUploadProps> = ({ onFileUpload, status }) => {
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      onFileUpload(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onFileUpload(e.target.files[0]);
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto mb-8">
      <div
        className={`relative group overflow-hidden rounded-2xl border-2 border-dashed transition-all duration-300 
          ${isDragging 
            ? 'border-indigo-500 bg-indigo-50/50 scale-[1.01]' 
            : 'border-slate-200 bg-white hover:border-indigo-300 hover:bg-slate-50'
          }
          ${status.isUploading ? 'pointer-events-none opacity-80' : ''}
        `}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <input
          ref={inputRef}
          type="file"
          className="hidden"
          accept=".csv,.json,.txt,.md"
          onChange={handleFileChange}
        />
        
        <div className="p-8 flex flex-col items-center justify-center text-center min-h-[200px]">
          
          {status.isUploading ? (
             <div className="flex flex-col items-center animate-in fade-in duration-300">
                <div className="relative">
                  <div className="absolute inset-0 bg-indigo-200 rounded-full blur-lg animate-pulse"></div>
                  <Loader2 className="relative w-12 h-12 text-indigo-600 animate-spin" />
                </div>
                <h3 className="mt-4 text-lg font-semibold text-slate-800">Analisando com IA...</h3>
                <p className="text-slate-500 text-sm mt-1 max-w-xs">O Gemini está processando seus dados para gerar insights estratégicos.</p>
             </div>
          ) : (
            <>
              <div className={`w-16 h-16 mb-4 rounded-2xl flex items-center justify-center transition-colors duration-300 ${isDragging ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-100 text-slate-400 group-hover:bg-indigo-50 group-hover:text-indigo-500'}`}>
                <UploadCloud className="w-8 h-8" />
              </div>
              
              <h3 className="text-lg font-semibold text-slate-800 mb-1">
                Arraste e solte ou clique para enviar
              </h3>
              <p className="text-slate-500 text-sm max-w-sm mb-6">
                Suportamos CSV, JSON ou arquivos de texto. A IA estruturará os dados automaticamente.
              </p>

              <button 
                onClick={() => inputRef.current?.click()}
                className="px-6 py-2.5 bg-slate-900 text-white rounded-lg font-medium text-sm hover:bg-slate-800 transition-all shadow-sm hover:shadow-md active:scale-95"
              >
                Selecionar Arquivo
              </button>
            </>
          )}
        </div>

        {/* Status Overlay for Success/Error - ephemeral */}
        {status.fileName && !status.isUploading && (
          <div className="absolute bottom-0 left-0 right-0 bg-emerald-50 border-t border-emerald-100 p-3 flex items-center justify-between animate-in slide-in-from-bottom-2">
             <div className="flex items-center text-emerald-700 text-sm font-medium">
                <CheckCircle className="w-4 h-4 mr-2" />
                Processado com sucesso: {status.fileName}
             </div>
          </div>
        )}
      </div>
    </div>
  );
};