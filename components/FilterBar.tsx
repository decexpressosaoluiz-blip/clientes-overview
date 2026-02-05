import React, { useState, useMemo, memo, useEffect } from 'react';
import { FilterState, Client, Segment } from '../types';
import { Search, X, Check, Building2, MapPin, Navigation, Users, CheckSquare, Square, Trash2, CheckCircle2, CalendarRange, CalendarDays, ChevronDown, Fingerprint, Filter, Loader2, AlertCircle } from 'lucide-react';

interface FilterBarProps {
  clients: Client[];
  filters: FilterState;
  onFilterChange: (newFilters: FilterState) => void;
  availableOrigins?: string[];
  availableDestinations?: string[];
}

export const FilterBar: React.FC<FilterBarProps> = memo(({ 
  clients, 
  filters, 
  onFilterChange,
  availableOrigins = [],
  availableDestinations = []
}) => {
  const [clientSearch, setClientSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [openDropdown, setOpenDropdown] = useState<'origin' | 'dest' | 'status' | null>(null);
  
  const [originSearch, setOriginSearch] = useState('');
  const [destSearch, setDestSearch] = useState('');

  // Debounce effect for search with loading state management
  useEffect(() => {
    if (clientSearch !== debouncedSearch) {
        setIsSearching(true);
        const handler = setTimeout(() => {
            setDebouncedSearch(clientSearch);
            setIsSearching(false);
        }, 400); // 400ms debounce
        return () => clearTimeout(handler);
    }
  }, [clientSearch, debouncedSearch]);

  // Geração dinâmica dos anos baseada nos dados carregados
  const availableYears = useMemo(() => {
    const yearsSet = new Set<number>();
    
    // Adiciona anos padrão para garantir UI estável caso não haja dados ainda
    const currentYear = new Date().getFullYear();
    yearsSet.add(currentYear);
    
    // Varre o histórico de todos os clientes para encontrar anos disponíveis
    clients.forEach(client => {
        client.history.forEach(transaction => {
            if (transaction.year) {
                yearsSet.add(transaction.year);
            }
        });
    });

    return Array.from(yearsSet).sort((a, b) => a - b);
  }, [clients]);

  const months = [
    { num: 1, name: 'Jan' }, { num: 2, name: 'Fev' }, { num: 3, name: 'Mar' }, 
    { num: 4, name: 'Abr' }, { num: 5, name: 'Mai' }, { num: 6, name: 'Jun' },
    { num: 7, name: 'Jul' }, { num: 8, name: 'Ago' }, { num: 9, name: 'Set' }, 
    { num: 10, name: 'Out' }, { num: 11, name: 'Nov' }, { num: 12, name: 'Dez' }
  ];

  const clientSuggestions = useMemo(() => {
    const term = debouncedSearch.trim();
    if (term.length < 2) return [];
    
    const searchLower = term.toLowerCase();
    const searchDigits = searchLower.replace(/\D/g, ''); 

    return clients
      .filter(c => {
        const nameMatch = c.name.toLowerCase().includes(searchLower);
        const cnpjRaw = c.cnpj.replace(/\D/g, '');
        const cnpjRawMatch = searchDigits.length > 2 && cnpjRaw.includes(searchDigits);
        const cnpjFormattedMatch = c.cnpj.includes(term);
        return nameMatch || cnpjRawMatch || cnpjFormattedMatch;
      })
      .slice(0, 10); 
  }, [clients, debouncedSearch]);

  const filteredOrigins = useMemo(() => 
    availableOrigins.filter(o => o.toLowerCase().includes(originSearch.toLowerCase())),
  [availableOrigins, originSearch]);

  const filteredDestinations = useMemo(() => 
    availableDestinations.filter(d => d.toLowerCase().includes(destSearch.toLowerCase())),
  [availableDestinations, destSearch]);

  const toggleYear = (year: number) => {
    const newYears = filters.years.includes(year)
      ? filters.years.filter(y => y !== year)
      : [...filters.years, year];
    onFilterChange({ ...filters, years: newYears });
  };
  
  const toggleMonth = (month: number) => {
    const newMonths = filters.months.includes(month)
        ? filters.months.filter(m => m !== month)
        : [...filters.months, month];
    onFilterChange({ ...filters, months: newMonths });
  }

  const toggleAllMonths = () => {
      if (filters.months.length === 12) {
          onFilterChange({ ...filters, months: [] });
      } else {
          onFilterChange({ ...filters, months: [1,2,3,4,5,6,7,8,9,10,11,12] });
      }
  }

  const addClient = (clientId: string) => {
    if (filters.clients.includes(clientId)) {
        onFilterChange({ ...filters, clients: filters.clients.filter(id => id !== clientId) });
    } else {
        onFilterChange({ ...filters, clients: [...filters.clients, clientId] });
    }
    // Keep focus and search text to allow multiple selections easily
    // setClientSearch(''); 
    // setIsSearchFocused(false);
  };

  const removeClient = (clientId: string) => {
      onFilterChange({ ...filters, clients: filters.clients.filter(id => id !== clientId) });
  };

  const toggleFilterItem = (type: 'origin' | 'dest', value: string) => {
    const list = type === 'origin' ? filters.origins : filters.destinations;
    const newList = list.includes(value) ? list.filter(i => i !== value) : [...list, value];
    
    onFilterChange({
        ...filters,
        origins: type === 'origin' ? newList : filters.origins,
        destinations: type === 'dest' ? newList : filters.destinations
    });
  };

  const selectAllItems = (type: 'origin' | 'dest') => {
     const items = type === 'origin' ? filteredOrigins : filteredDestinations;
     const currentList = type === 'origin' ? filters.origins : filters.destinations;
     const newList = Array.from(new Set([...currentList, ...items]));
     
     onFilterChange({
        ...filters,
        origins: type === 'origin' ? newList : filters.origins,
        destinations: type === 'dest' ? newList : filters.destinations
    });
  };

  const clearItems = (type: 'origin' | 'dest') => {
      onFilterChange({
        ...filters,
        origins: type === 'origin' ? [] : filters.origins,
        destinations: type === 'dest' ? [] : filters.destinations
    });
  };

  const toggleSegment = (segment: Segment) => {
    const newSegments = filters.segments.includes(segment) 
      ? filters.segments.filter(s => s !== segment)
      : [...filters.segments, segment];
    onFilterChange({ ...filters, segments: newSegments });
  };

  const toggleStatusGroup = (group: 'active' | 'risk' | 'inactive') => {
    let targetSegments: Segment[] = [];
    if (group === 'active') {
        targetSegments = [Segment.CHAMPIONS, Segment.LOYAL, Segment.POTENTIAL, Segment.NEW];
    } else if (group === 'risk') {
        targetSegments = [Segment.AT_RISK];
    } else if (group === 'inactive') {
        targetSegments = [Segment.LOST];
    }

    const allSelected = targetSegments.every(s => filters.segments.includes(s));

    let newSegments = [...filters.segments];
    if (allSelected) {
        newSegments = newSegments.filter(s => !targetSegments.includes(s));
    } else {
        targetSegments.forEach(s => {
            if (!newSegments.includes(s)) newSegments.push(s);
        });
    }
    onFilterChange({ ...filters, segments: newSegments });
  };

  return (
    <div className="bg-white/70 backdrop-blur-lg rounded-3xl shadow-soft border border-white/50 p-4 sm:p-6 mb-8 relative z-50 flex flex-col gap-6 transition-all duration-300 hover:shadow-elevated select-none">
      
      {/* --- TOP SECTION: Search & Dropdowns --- */}
      <div className="flex flex-col lg:flex-row gap-4">
        
        {/* Busca de Cliente */}
        <div className="w-full lg:w-1/3 relative z-20 flex flex-col">
            <div className={`relative group transition-all duration-200 ${isSearchFocused ? 'scale-[1.01]' : ''}`}>
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    {isSearching ? (
                        <Loader2 size={18} className="text-indigo-500 animate-spin" />
                    ) : (
                        <Search size={18} className={`transition-colors duration-300 ${isSearchFocused ? 'text-indigo-500' : 'text-sle-neutral-400'}`} />
                    )}
                </div>
                <input
                    type="text"
                    className="block w-full h-12 pl-11 pr-10 bg-white border border-sle-neutral-200 hover:border-sle-neutral-300 focus:border-indigo-500 rounded-2xl text-sle-neutral-800 placeholder:text-sle-neutral-400 focus:ring-4 focus:ring-indigo-500/10 transition-all font-semibold text-sm shadow-sm"
                    placeholder="Buscar Cliente (Nome ou CNPJ)..."
                    value={clientSearch}
                    onChange={(e) => setClientSearch(e.target.value)}
                    onFocus={() => setIsSearchFocused(true)}
                    onBlur={() => setTimeout(() => setIsSearchFocused(false), 200)}
                />
                
                {/* Clear Input Button */}
                {clientSearch && (
                    <button
                        onClick={() => { setClientSearch(''); setDebouncedSearch(''); }}
                        className="absolute inset-y-0 right-2 flex items-center px-2 text-sle-neutral-400 hover:text-rose-500 transition-colors cursor-pointer"
                    >
                        <X size={16} />
                    </button>
                )}

                {filters.clients.length > 0 && !clientSearch && (
                    <div className="absolute inset-y-0 right-0 pr-2 flex items-center pointer-events-none">
                        <span className="bg-indigo-100 text-indigo-700 text-[10px] font-extrabold px-2 py-1 rounded-full">
                            {filters.clients.length}
                        </span>
                    </div>
                )}
            </div>

            {/* Selected Client Tags Area */}
            {filters.clients.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-3 animate-in slide-in-from-top-2 duration-200 p-2 bg-sle-neutral-50/50 rounded-xl border border-sle-neutral-100/50">
                    <div className="flex items-center justify-between w-full mb-1">
                        <span className="text-[10px] font-bold text-sle-neutral-400 uppercase tracking-wide ml-1">Selecionados ({filters.clients.length})</span>
                        <button 
                            onClick={() => onFilterChange({ ...filters, clients: [] })}
                            className="text-[10px] font-bold text-rose-500 hover:text-rose-700 hover:bg-rose-50 px-2 py-0.5 rounded-md transition-colors"
                        >
                            Limpar Todos
                        </button>
                    </div>
                    {filters.clients.map(id => {
                        const client = clients.find(c => c.id === id);
                        if (!client) return null;
                        return (
                            <span key={id} className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-white text-indigo-700 border border-indigo-100 shadow-sm group hover:border-indigo-300 transition-all">
                                <span className="truncate max-w-[120px]">{client.name}</span>
                                <button
                                    onClick={() => removeClient(id)}
                                    className="ml-2 p-0.5 hover:bg-rose-50 rounded-full text-indigo-300 hover:text-rose-500 transition-colors cursor-pointer"
                                >
                                    <X size={12} strokeWidth={3} />
                                </button>
                            </span>
                        );
                    })}
                </div>
            )}

            {/* Search Dropdown Results */}
            {isSearchFocused && clientSearch.length >= 2 && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-2xl shadow-2xl border border-sle-neutral-100 overflow-hidden z-[1000] max-h-80 overflow-y-auto custom-scrollbar animate-in fade-in slide-in-from-top-2 duration-200 p-2">
                        {clientSuggestions.length > 0 ? (
                            clientSuggestions.map(client => {
                                const isSelected = filters.clients.includes(client.id);
                                return (
                                    <button
                                        key={client.id}
                                        onMouseDown={(e) => { e.preventDefault(); addClient(client.id); }}
                                        className={`w-full text-left px-4 py-3 rounded-xl flex items-center transition-all mb-1 group cursor-pointer active:scale-[0.98] ${
                                            isSelected 
                                            ? 'bg-emerald-50 border border-emerald-100' 
                                            : 'hover:bg-sle-neutral-50 border border-transparent'
                                        }`}
                                    >
                                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center mr-3 transition-all shadow-sm ${
                                            isSelected 
                                            ? 'bg-emerald-500 text-white' 
                                            : 'bg-sle-neutral-100 text-sle-neutral-400 group-hover:bg-white group-hover:text-indigo-600'
                                        }`}>
                                            {isSelected ? <Check size={20} strokeWidth={3} /> : <Building2 size={18} strokeWidth={2} />}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-bold truncate transition-colors text-sle-neutral-700 group-hover:text-indigo-800">
                                                {client.name}
                                            </p>
                                            <div className="flex items-center gap-1.5 mt-0.5">
                                                <Fingerprint size={12} className={isSelected ? 'text-emerald-500' : 'text-sle-neutral-300 group-hover:text-indigo-400'} />
                                                <p className={`text-[11px] font-mono truncate ${isSelected ? 'text-emerald-600' : 'text-sle-neutral-400'}`}>
                                                    {client.cnpj}
                                                </p>
                                            </div>
                                        </div>
                                        {isSelected && <span className="text-[10px] font-bold text-emerald-600 bg-emerald-100 px-2 py-0.5 rounded ml-2">ADD</span>}
                                    </button>
                                );
                            })
                        ) : (
                            <div className="p-8 text-center flex flex-col items-center">
                                <AlertCircle size={24} className="mb-2 text-sle-neutral-300" />
                                <span className="text-sm font-semibold text-sle-neutral-500">Nenhum cliente encontrado</span>
                            </div>
                        )}
                </div>
            )}
        </div>

        {/* Dropdowns Container */}
        <div className="w-full lg:w-2/3 grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Origem */}
            <div className="relative">
                <button 
                    onClick={() => setOpenDropdown(openDropdown === 'origin' ? null : 'origin')}
                    className={`w-full h-12 flex items-center justify-between px-4 rounded-2xl text-sm font-bold transition-all duration-200 active:scale-[0.98] border cursor-pointer ${
                        filters.origins.length > 0 
                        ? 'bg-indigo-50 text-indigo-700 border-indigo-100 shadow-sm' 
                        : 'bg-white text-sle-neutral-600 border-sle-neutral-200 hover:border-sle-neutral-300 hover:bg-sle-neutral-50'
                    }`}
                >
                    <div className="flex items-center truncate">
                        <MapPin size={16} className="mr-2 shrink-0 opacity-70" strokeWidth={2.5} />
                        <span className="truncate">Origem {filters.origins.length > 0 && `(${filters.origins.length})`}</span>
                    </div>
                    <ChevronDown size={16} className={`transition-transform duration-300 ${openDropdown === 'origin' ? 'rotate-180 text-indigo-500' : 'text-sle-neutral-400'}`} />
                </button>
                {openDropdown === 'origin' && (
                    <>
                        <div className="fixed inset-0 z-[90]" onClick={() => setOpenDropdown(null)}></div>
                        <div className="absolute top-full left-0 w-full sm:w-72 mt-2 bg-white rounded-2xl shadow-2xl border border-sle-neutral-100 z-[100] overflow-hidden animate-in fade-in zoom-in-95 duration-200 flex flex-col">
                            <div className="p-3 border-b border-sle-neutral-100 bg-sle-neutral-50/50">
                                <div className="relative mb-2">
                                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-sle-neutral-400" />
                                    <input 
                                        type="text" 
                                        className="w-full pl-9 pr-3 py-2 bg-white border border-sle-neutral-200 rounded-lg text-xs font-bold focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-50 transition-all"
                                        placeholder="Filtrar..."
                                        value={originSearch}
                                        onChange={(e) => setOriginSearch(e.target.value)}
                                        autoFocus
                                    />
                                </div>
                                <div className="flex gap-2">
                                    <button onClick={() => selectAllItems('origin')} className="flex-1 py-1.5 text-[10px] font-bold bg-white border border-sle-neutral-200 rounded hover:bg-sle-neutral-50 text-sle-neutral-600 hover:text-indigo-600 transition-all">Todos</button>
                                    <button onClick={() => clearItems('origin')} className="flex-1 py-1.5 text-[10px] font-bold bg-white border border-sle-neutral-200 rounded hover:bg-sle-neutral-50 text-sle-neutral-600 hover:text-rose-600 transition-all">Limpar</button>
                                </div>
                            </div>
                            <div className="max-h-64 overflow-y-auto custom-scrollbar p-2">
                                {filteredOrigins.map(o => (
                                    <button key={o} onClick={() => toggleFilterItem('origin', o)} className={`w-full text-left px-3 py-2.5 rounded-lg text-xs font-bold flex items-center transition-all cursor-pointer mb-0.5 active:scale-[0.98] ${filters.origins.includes(o) ? 'bg-indigo-50 text-indigo-700' : 'text-sle-neutral-600 hover:bg-sle-neutral-50'}`}>
                                        {filters.origins.includes(o) ? <CheckSquare size={16} className="mr-2 text-indigo-600 shrink-0" /> : <Square size={16} className="mr-2 text-sle-neutral-300 shrink-0" />}
                                        <span className="truncate">{o}</span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    </>
                )}
            </div>

            {/* Destino */}
            <div className="relative">
                <button 
                    onClick={() => setOpenDropdown(openDropdown === 'dest' ? null : 'dest')}
                    className={`w-full h-12 flex items-center justify-between px-4 rounded-2xl text-sm font-bold transition-all duration-200 active:scale-[0.98] border cursor-pointer ${
                        filters.destinations.length > 0 
                        ? 'bg-indigo-50 text-indigo-700 border-indigo-100 shadow-sm' 
                        : 'bg-white text-sle-neutral-600 border-sle-neutral-200 hover:border-sle-neutral-300 hover:bg-sle-neutral-50'
                    }`}
                >
                    <div className="flex items-center truncate">
                        <Navigation size={16} className="mr-2 shrink-0 opacity-70" strokeWidth={2.5} />
                        <span className="truncate">Destino {filters.destinations.length > 0 && `(${filters.destinations.length})`}</span>
                    </div>
                    <ChevronDown size={16} className={`transition-transform duration-300 ${openDropdown === 'dest' ? 'rotate-180 text-indigo-500' : 'text-sle-neutral-400'}`} />
                </button>
                {openDropdown === 'dest' && (
                    <>
                        <div className="fixed inset-0 z-[90]" onClick={() => setOpenDropdown(null)}></div>
                        <div className="absolute top-full left-0 w-full sm:w-72 mt-2 bg-white rounded-2xl shadow-2xl border border-sle-neutral-100 z-[100] overflow-hidden animate-in fade-in zoom-in-95 duration-200 flex flex-col">
                             <div className="p-3 border-b border-sle-neutral-100 bg-sle-neutral-50/50">
                                <div className="relative mb-2">
                                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-sle-neutral-400" />
                                    <input 
                                        type="text" 
                                        className="w-full pl-9 pr-3 py-2 bg-white border border-sle-neutral-200 rounded-lg text-xs font-bold focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-50 transition-all"
                                        placeholder="Filtrar..."
                                        value={destSearch}
                                        onChange={(e) => setDestSearch(e.target.value)}
                                        autoFocus
                                    />
                                </div>
                                <div className="flex gap-2">
                                    <button onClick={() => selectAllItems('dest')} className="flex-1 py-1.5 text-[10px] font-bold bg-white border border-sle-neutral-200 rounded hover:bg-sle-neutral-50 text-sle-neutral-600 hover:text-indigo-600 transition-all">Todos</button>
                                    <button onClick={() => clearItems('dest')} className="flex-1 py-1.5 text-[10px] font-bold bg-white border border-sle-neutral-200 rounded hover:bg-sle-neutral-50 text-sle-neutral-600 hover:text-rose-600 transition-all">Limpar</button>
                                </div>
                            </div>
                            <div className="max-h-64 overflow-y-auto custom-scrollbar p-2">
                                {filteredDestinations.map(d => (
                                    <button key={d} onClick={() => toggleFilterItem('dest', d)} className={`w-full text-left px-3 py-2.5 rounded-lg text-xs font-bold flex items-center transition-all cursor-pointer mb-0.5 active:scale-[0.98] ${filters.destinations.includes(d) ? 'bg-indigo-50 text-indigo-700' : 'text-sle-neutral-600 hover:bg-sle-neutral-50'}`}>
                                        {filters.destinations.includes(d) ? <CheckSquare size={16} className="mr-2 text-indigo-600 shrink-0" /> : <Square size={16} className="mr-2 text-sle-neutral-300 shrink-0" />}
                                        <span className="truncate">{d}</span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    </>
                )}
            </div>

            {/* Status (Com Grupo Macro) */}
            <div className="relative">
                <button 
                    onClick={() => setOpenDropdown(openDropdown === 'status' ? null : 'status')}
                    className={`w-full h-12 flex items-center justify-between px-4 rounded-2xl text-sm font-bold transition-all duration-200 active:scale-[0.98] border cursor-pointer ${
                        filters.segments.length > 0 
                        ? 'bg-indigo-50 text-indigo-700 border-indigo-100 shadow-sm' 
                        : 'bg-white text-sle-neutral-600 border-sle-neutral-200 hover:border-sle-neutral-300 hover:bg-sle-neutral-50'
                    }`}
                >
                    <div className="flex items-center truncate">
                        <Users size={16} className="mr-2 shrink-0 opacity-70" strokeWidth={2.5} />
                        <span className="truncate">Status {filters.segments.length > 0 && `(${filters.segments.length})`}</span>
                    </div>
                    <ChevronDown size={16} className={`transition-transform duration-300 ${openDropdown === 'status' ? 'rotate-180 text-indigo-500' : 'text-sle-neutral-400'}`} />
                </button>
                {openDropdown === 'status' && (
                     <>
                        <div className="fixed inset-0 z-[90]" onClick={() => setOpenDropdown(null)}></div>
                        <div className="absolute top-full right-0 mt-2 w-64 bg-white rounded-2xl shadow-2xl border border-sle-neutral-100 z-[100] p-3 animate-in fade-in zoom-in-95 duration-200">
                            
                            {/* Atalhos de Grupo */}
                            <div className="grid grid-cols-3 gap-2 mb-3 pb-3 border-b border-sle-neutral-100">
                                <button onClick={() => toggleStatusGroup('active')} className="flex flex-col items-center p-2 rounded-lg hover:bg-emerald-50 text-emerald-600 transition-colors">
                                    <CheckCircle2 size={16} />
                                    <span className="text-[9px] font-bold uppercase mt-1">Ativos</span>
                                </button>
                                <button onClick={() => toggleStatusGroup('risk')} className="flex flex-col items-center p-2 rounded-lg hover:bg-amber-50 text-amber-600 transition-colors">
                                    <Filter size={16} />
                                    <span className="text-[9px] font-bold uppercase mt-1">Risco</span>
                                </button>
                                <button onClick={() => toggleStatusGroup('inactive')} className="flex flex-col items-center p-2 rounded-lg hover:bg-rose-50 text-rose-600 transition-colors">
                                    <Trash2 size={16} />
                                    <span className="text-[9px] font-bold uppercase mt-1">Inativos</span>
                                </button>
                            </div>

                            <div className="space-y-0.5 max-h-64 overflow-y-auto custom-scrollbar">
                                {Object.values(Segment).map(s => (
                                    <button key={s} onClick={() => toggleSegment(s)} className={`w-full text-left px-3 py-2 rounded-lg text-xs font-bold flex justify-between items-center transition-all cursor-pointer active:scale-[0.98] ${filters.segments.includes(s) ? 'bg-indigo-50 text-indigo-700' : 'text-sle-neutral-600 hover:bg-sle-neutral-50'}`}>
                                        <div className="flex items-center">
                                            {filters.segments.includes(s) ? <CheckSquare size={16} className="mr-2 text-indigo-600"/> : <Square size={16} className="mr-2 text-sle-neutral-300"/>}
                                            {s}
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </div>
                    </>
                )}
            </div>
        </div>
      </div>

      {/* --- MIDDLE SECTION: Time Filters --- */}
      <div className="bg-sle-neutral-50/60 rounded-2xl p-4 sm:p-5 border border-sle-neutral-100">
          <div className="flex flex-col lg:flex-row gap-6 lg:items-start">
              {/* Years - Dynamic List */}
              <div className="w-full lg:w-auto flex-shrink-0">
                  <div className="flex items-center gap-2 mb-3 text-sle-neutral-400">
                      <CalendarRange size={14} strokeWidth={2.5} />
                      <span className="text-[10px] font-extrabold uppercase tracking-wider opacity-80">Ano de Referência</span>
                  </div>
                  <div className="flex flex-row lg:flex-wrap gap-2 overflow-x-auto pb-2 lg:pb-0 scrollbar-hide">
                     {availableYears.map(year => (
                         <button 
                            key={year} 
                            onClick={() => toggleYear(year)} 
                            className={`flex-shrink-0 px-4 py-2.5 rounded-xl text-xs font-bold transition-all shadow-sm active:scale-95 cursor-pointer border whitespace-nowrap ${
                                filters.years.includes(year) 
                                ? 'bg-sle-red-500 text-white border-sle-red-500 shadow-sle-red-200/50' 
                                : 'bg-white text-sle-neutral-500 border-sle-neutral-200 hover:border-sle-red-200 hover:text-sle-red-500 hover:shadow-md'
                            }`}
                         >
                             {year}
                         </button>
                     ))}
                  </div>
              </div>
              
              <div className="hidden lg:block w-px bg-sle-neutral-200 self-stretch mx-2"></div>

              {/* Months */}
              <div className="w-full lg:flex-1">
                  <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2 text-sle-neutral-400">
                          <CalendarDays size={14} strokeWidth={2.5} />
                          <span className="text-[10px] font-extrabold uppercase tracking-wider opacity-80">Período (Mês)</span>
                      </div>
                      <button 
                        onClick={toggleAllMonths} 
                        className="text-[10px] font-bold text-indigo-600 hover:bg-indigo-50 px-2 py-1 rounded transition-colors"
                      >
                        {filters.months.length === 12 ? 'Desmarcar Todos' : 'Ano Completo'}
                      </button>
                  </div>
                  {/* Scroll horizontal em mobile, grid em desktop */}
                  <div className="flex overflow-x-auto pb-2 lg:pb-0 gap-2 lg:grid lg:grid-cols-12 lg:gap-2 scrollbar-hide">
                    {months.map(m => (
                        <button 
                            key={m.num} 
                            onClick={() => toggleMonth(m.num)} 
                            className={`flex-shrink-0 w-16 lg:w-full py-2.5 rounded-xl text-xs font-bold transition-all shadow-sm flex items-center justify-center active:scale-95 cursor-pointer border ${
                                filters.months.includes(m.num) 
                                ? 'bg-indigo-500 text-white border-indigo-500 shadow-indigo-200/50' 
                                : 'bg-white text-sle-neutral-500 border-sle-neutral-200 hover:border-indigo-200 hover:text-indigo-500 hover:shadow-md'
                            }`}
                        >
                            {m.name}
                        </button>
                    ))}
                  </div>
              </div>
          </div>
      </div>

      {/* --- BOTTOM SECTION: Tags --- */}
      {(filters.origins.length > 0 || filters.destinations.length > 0 || filters.segments.length > 0) && (
          <div className="flex flex-wrap gap-2 animate-in fade-in slide-in-from-bottom-2 duration-300 pt-2 border-t border-sle-neutral-100">
               {[...filters.origins.map(o => ({t:'origin', v:o, i:MapPin})), ...filters.destinations.map(d => ({t:'dest', v:d, i:Navigation})), ...filters.segments.map(s => ({t:'seg', v:s, i:Users}))].map((item, idx) => (
                   <span key={idx} className="inline-flex items-center pl-3 pr-1 py-1 bg-white border border-sle-neutral-200 rounded-full text-[11px] font-bold text-sle-neutral-700 shadow-sm max-w-full">
                      <item.i size={12} className="mr-1.5 text-sle-neutral-400 shrink-0" strokeWidth={2}/> 
                      <span className="truncate max-w-[150px]">{item.v}</span>
                      <button 
                        onClick={() => item.t === 'seg' ? toggleSegment(item.v as Segment) : toggleFilterItem(item.t as any, item.v as string)} 
                        className="ml-2 p-1 hover:bg-rose-50 rounded-full transition-colors text-sle-neutral-400 hover:text-rose-500 cursor-pointer shrink-0"
                      >
                         <X size={12} strokeWidth={3} />
                      </button>
                   </span>
               ))}
               <button 
                    onClick={() => onFilterChange({...filters, clients:[], origins:[], destinations:[], segments:[]})} 
                    className="px-4 py-1 text-[11px] font-bold text-rose-500 hover:text-rose-600 hover:bg-rose-50 rounded-full transition-colors cursor-pointer active:scale-95"
               >
                    Limpar Filtros
               </button>
          </div>
      )}
    </div>
  );
});