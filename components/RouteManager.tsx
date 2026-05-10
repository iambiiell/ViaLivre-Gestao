
import React, { useState, useMemo, useEffect } from 'react';
import { BusRoute, RouteStatus, Company, City, User, LedColor, RouteSection, TicketingConfig } from '../types';
import { Plus, Navigation, Trash2, X, Pencil, Save, Clock, ListChecks, Type, Search, LayoutGrid, Palette, Zap, Binary, Hash, ArrowRight } from 'lucide-react';

const DEFAULT_SIGN_ITEM = { text: 'VIALIVRE GESTÃO', modo: 'FIXO' };
const DEFAULT_SIGNS_ARRAY = [DEFAULT_SIGN_ITEM];

interface RouteManagerProps {
  routes: BusRoute[];
  companies: Company[];
  cities: City[];
  currentUser: User | null;
  ticketingConfig: TicketingConfig | null;
  onAddRoute: (route: BusRoute) => void;
  onUpdateRoute: (route: BusRoute) => void;
  onDeleteRoute: (id: string) => void;
  addToast: (message: string, type?: 'success' | 'error' | 'warning') => void;
}

type ModalTab = 'geral' | 'secoes' | 'horario' | 'letreiro';

const RouteManager: React.FC<RouteManagerProps> = ({ routes = [], companies = [], ticketingConfig, onAddRoute, onUpdateRoute, onDeleteRoute, addToast }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<ModalTab>('geral');
  const [searchTerm, setSearchTerm] = useState('');
  const [newTimes, setNewTimes] = useState<{ weekdays: string, saturday: string, sunday: string }>({ weekdays: '', saturday: '', sunday: '' });
  const [bulkInput, setBulkInput] = useState<{ weekdays: string, saturday: string, sunday: string }>({ weekdays: '', saturday: '', sunday: '' });
  const [showBulk, setShowBulk] = useState<{ weekdays: boolean, saturday: boolean, sunday: boolean }>({ weekdays: false, saturday: false, sunday: false });

  const initialForm: Partial<BusRoute> = {
    prefixo_linha: '', origin: '', destination: '', price: 0, boarding_fee: 0, status: RouteStatus.ACTIVE, company_id: '',
    route_type: 'URBANO', stops: [], sections: [], 
    schedule: { weekdays: [], saturday: [], sunday: [] },
    letreiro_principal: '', letreiro_principal_modo: 'FIXO', letreiro_principal_cor: 'AMBAR', letreiro_principal_velocidade: 5,
    via1: '', via1_modo: 'FIXO', via2: '', via2_modo: 'FIXO', via3: '', via3_modo: 'FIXO'
  };

  const [formData, setFormData] = useState<Partial<BusRoute>>(initialForm);

  useEffect(() => {
    // Only auto-fill if we are creating a new route and both origin/destination are set
    if (editingId || !formData.origin || !formData.destination) return;

    const oSearch = formData.origin.toUpperCase();
    const dSearch = formData.destination.toUpperCase();

    // Check if this fulfills a reverse route match
    const reverseRoute = routes.find(r => 
      (r.origin || '').toUpperCase() === dSearch && 
      (r.destination || '').toUpperCase() === oSearch
    );

    // If we found a reverse route and our current price is zero, suggest/apply the same pricing
    if (reverseRoute && (formData.price === 0 || !formData.price)) {
      setFormData(prev => ({
        ...prev,
        price: reverseRoute.price,
        toll: reverseRoute.toll,
        fees: reverseRoute.fees,
        boarding_fee: reverseRoute.boarding_fee,
        route_type: reverseRoute.route_type,
        service_class: reverseRoute.service_class,
        company_id: prev.company_id || reverseRoute.company_id,
        // Reverse the sections as well if any
        sections: reverseRoute.sections?.map(s => ({
          ...s,
          origin: s.destination,
          destination: s.origin,
          price: s.price,
          toll: s.toll,
          boarding_fee: s.boarding_fee
        })) || []
      }));
      addToast(`Tarifações copiadas da rota inversa: ${reverseRoute.prefixo_linha}`, "success");
    }
  }, [formData.origin, formData.destination, routes, editingId]);

  const [currentSignIdx, setCurrentSignIdx] = useState(0);
  const activeSigns = useMemo(() => {
      const items = [
          { text: formData.letreiro_principal, modo: formData.letreiro_principal_modo, cor: formData.letreiro_principal_cor || 'AMBAR' },
          { text: formData.via1, modo: formData.via1_modo, cor: formData.via1_cor || 'AMBAR' },
          { text: formData.via2, modo: formData.via2_modo, cor: formData.via2_cor || 'AMBAR' },
          { text: formData.via3, modo: formData.via3_modo, cor: formData.via3_cor || 'AMBAR' }
      ].filter(s => s.text && s.text.trim() !== "");
      return items.length > 0 ? items : [{ ...DEFAULT_SIGN_ITEM, cor: 'AMBAR' }];
  }, [formData.letreiro_principal, formData.letreiro_principal_modo, formData.letreiro_principal_cor, formData.via1, formData.via1_modo, formData.via1_cor, formData.via2, formData.via2_modo, formData.via2_cor, formData.via3, formData.via3_modo, formData.via3_cor]);

  useEffect(() => {
    if (activeTab !== 'letreiro') return;
    const current = activeSigns[currentSignIdx];
    const duration = current.modo === 'FIXO' ? 3000 : 8000;
    const timer = setTimeout(() => { setCurrentSignIdx(prev => (prev + 1) % activeSigns.length); }, duration);
    return () => clearTimeout(timer);
  }, [currentSignIdx, activeSigns, activeTab]);

  const filteredRoutes = useMemo(() => {
    const search = searchTerm.toLowerCase();
    return routes.filter(r => 
        r.prefixo_linha.toLowerCase().includes(search) ||
        r.destination.toLowerCase().includes(search) ||
        r.origin.toLowerCase().includes(search)
    ).sort((a, b) => a.prefixo_linha.localeCompare(b.prefixo_linha, undefined, { numeric: true }));
  }, [routes, searchTerm]);

  const allServiceClasses = useMemo(() => {
    const base = [
      'Convencional', 'Convencional DD', 'Executivo', 'Executivo DD', 
      'Leito', 'Leito DD', 'Semi-Leito', 'Semi-Leito DD', 'Urbano', 'Cama'
    ];
    if (ticketingConfig?.custom_vehicle_classes) {
      ticketingConfig.custom_vehicle_classes.forEach(cvc => {
        if (!base.includes(cvc.label)) {
          base.push(cvc.label);
        }
      });
    }
    return base.sort();
  }, [ticketingConfig?.custom_vehicle_classes]);

  const getLedColorClass = (color: LedColor) => {
      switch (color) {
          case 'AMBAR': return 'text-yellow-500';
          case 'BRANCO': return 'text-slate-100';
          case 'VERDE': return 'text-emerald-400';
          default: return 'text-yellow-500';
      }
  };

  // Funções para Seções
  const addSection = () => {
    const sections = [...(formData.sections || [])];
    sections.push({ name: '', price: formData.price || 0 });
    setFormData({ ...formData, sections });
  };

  const updateSection = (index: number, field: keyof RouteSection, value: any) => {
    const sections = [...(formData.sections || [])];
    sections[index] = { ...sections[index], [field]: value };
    setFormData({ ...formData, sections });
  };

  const removeSection = (index: number) => {
    const sections = (formData.sections || []).filter((_, i) => i !== index);
    setFormData({ ...formData, sections });
  };

  // Funções para Grade Horária
  const [selectedDirection, setSelectedDirection] = useState<'IDA' | 'VOLTA'>('IDA');

  const addTime = (dayType: 'weekdays' | 'saturday' | 'sunday') => {
    const time = newTimes[dayType];
    if (!time) return;

    // Auto-format H:MM to HH:MM
    const formattedTime = /^\d:\d{2}$/.test(time) ? `0${time}` : time;

    if (!/^([01]\d|2[0-3]):([0-5]\d)$/.test(formattedTime)) {
      addToast("Formato inválido. Use HH:MM (ex: 08:30 ou 14:00)", "error");
      return;
    }

    const currentSchedule = formData.schedule?.[dayType] || [];
    if (currentSchedule.some(t => t.time === formattedTime && t.direction === selectedDirection)) return;

    const newEntry = { time: formattedTime, direction: selectedDirection };
    const updatedDaySchedule = [...currentSchedule, newEntry];
    
    // Sort only if requested, but for registration order we don't sort at the end if IDA?
    // User requested: "ao selecionar Ida, ordene os horários de acordo com o cadastro"
    // For Volta, it doesn't specify registration order, but let's stick to registration for both if needed.
    // Actually, sorting usually helps, but I'll follow the request.
    if (selectedDirection === 'VOLTA') {
      updatedDaySchedule.sort((a, b) => (a?.time || '00:00').localeCompare(b?.time || '00:00'));
    }

    const newSchedule = { 
        ...(formData.schedule || { weekdays: [], saturday: [], sunday: [] }),
        [dayType]: updatedDaySchedule
    };

    setFormData(prev => ({ ...prev, schedule: newSchedule }));
    setNewTimes(prev => ({ ...prev, [dayType]: '' }));
  };

  const removeTime = (dayType: 'weekdays' | 'saturday' | 'sunday', time: string, direction: 'IDA' | 'VOLTA') => {
    const schedule = { ...(formData.schedule || { weekdays: [], saturday: [], sunday: [] }) };
    schedule[dayType] = (schedule[dayType] || []).filter(t => !(t.time === time && t.direction === direction));
    setFormData({ ...formData, schedule });
  };

  const handleBulkImport = (dayType: 'weekdays' | 'saturday' | 'sunday') => {
    const input = bulkInput[dayType];
    const lines = input.split(/[\n,;]/).map(l => l.trim()).filter(l => l);
    const validTimes: { time: string, direction: 'IDA' | 'VOLTA' }[] = [];

    lines.forEach(l => {
        const timeMatch = l.match(/([01]\d|2[0-3]):[0-5]\d/);
        if (timeMatch) {
            validTimes.push({ time: timeMatch[0], direction: selectedDirection });
        }
    });

    if (validTimes.length === 0) {
        addToast("Nenhum horário válido encontrado. Use o formato HH:MM.", "error");
        return;
    }

    const currentSchedule = formData.schedule?.[dayType] || [];
    const updatedDaySchedule = [...currentSchedule, ...validTimes];
    
    // Sort and unique
    const uniqueSchedule = Array.from(new Map(updatedDaySchedule.map(item => [`${item.time}-${item.direction}`, item])).values())
        .sort((a, b) => a.time.localeCompare(b.time));

    const newSchedule = { 
        ...(formData.schedule || { weekdays: [], saturday: [], sunday: [] }),
        [dayType]: uniqueSchedule
    };

    setFormData(prev => ({ ...prev, schedule: newSchedule }));
    setBulkInput(prev => ({ ...prev, [dayType]: '' }));
    setShowBulk(prev => ({ ...prev, [dayType]: false }));
    addToast(`${validTimes.length} horários importados com sucesso!`, "success");
  };

  const handleCopySchedule = (from: 'weekdays' | 'saturday' | 'sunday', to: 'weekdays' | 'saturday' | 'sunday') => {
    const source = formData.schedule?.[from] || [];
    if (source.length === 0) {
      addToast("O dia de origem não possui horários para copiar.", "warning");
      return;
    }

    const newSchedule = {
        ...(formData.schedule || { weekdays: [], saturday: [], sunday: [] }),
        [to]: [...source]
    };

    setFormData(prev => ({ ...prev, schedule: newSchedule }));
    addToast("Horários copiados com sucesso!", "success");
  };

  const handleCurrencyChange = (value: string, field: keyof BusRoute) => {
    const numericValue = value.replace(/\D/g, '');
    const floatValue = parseFloat(numericValue) / 100;
    setFormData({ ...formData, [field]: floatValue });
  };

  const handleSectionCurrencyChange = (index: number, value: string) => {
    const numericValue = value.replace(/\D/g, '');
    const floatValue = parseFloat(numericValue) / 100;
    updateSection(index, 'price', floatValue);
  };

  const formatCurrencyValue = (value: number | undefined) => {
    if (value === undefined || value === null) return 'R$ 0,00';
    return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  const handlePaymentTypeChange = (type: any) => {
    let nextMethods = formData.payment_methods_accepted || [];
    
    if (type === 'RODOVIARIO_APENAS') {
      nextMethods = ['DINHEIRO', 'PIX', 'CREDITO', 'DEBITO'];
    } else if (type === 'URBANO_APENAS') {
      nextMethods = ['DINHEIRO', 'VALE_TRANSPORTE'];
    } else if (type === 'QUALQUER_UM') {
      nextMethods = ['DINHEIRO', 'PIX', 'CREDITO', 'DEBITO', 'VALE_TRANSPORTE'];
    }
    
    setFormData({ ...formData, payment_type: type, payment_methods_accepted: nextMethods });
  };

  const handleDownloadItinerary = (route: BusRoute) => {
    const company = companies.find(c => c.id === route.company_id);
    const companyName = company?.nome_fantasia || company?.name || 'Não informada';
    
    const lines = [
      `QUADRO DE ITINERÁRIO - ${route.prefixo_linha}`,
      `Empresa: ${companyName}`,
      `Linha: ${route.prefixo_linha}`,
      `Origem: ${route.origin}`,
      `Destino: ${route.destination}`,
      `Tarifa Base: R$ ${route.price.toFixed(2)}`,
      `Taxas: R$ ${(route.fees || 0).toFixed(2)}`,
      `Pedágio: R$ ${(route.toll || 0).toFixed(2)}`,
      `Tarifa Final: R$ ${((route.price || 0) + (route.toll || 0) + (route.fees || 0)).toFixed(2)}`,
      `Tempo Estimado: ${route.estimated_travel_time_text || (route.duration_minutes ? `${route.duration_minutes} min` : 'N/A')}`,
      '',
      '--- GRADE HORÁRIA ---'
    ];

    const formatDay = (label: string, day: { time: string, direction: 'IDA' | 'VOLTA' }[]) => {
      lines.push(`${label}:`);
      const ida = day.filter(t => t.direction === 'IDA').map(t => t.time);
      const volta = day.filter(t => t.direction === 'VOLTA').map(t => t.time);
      lines.push(`  IDA: ${ida.length > 0 ? ida.join(', ') : 'Sem horários'}`);
      lines.push(`  VOLTA: ${volta.length > 0 ? volta.join(', ') : 'Sem horários'}`);
      lines.push('');
    };

    if (route.schedule.weekdays.length > 0) formatDay('DIAS ÚTEIS', route.schedule.weekdays);
    if (route.schedule.saturday.length > 0) formatDay('SÁBADOS', route.schedule.saturday);
    if (route.schedule.sunday.length > 0) formatDay('DOMINGOS E FERIADOS', route.schedule.sunday);

    const content = lines.join('\n');
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `itinerario_${route.prefixo_linha}_${route.origin}_${route.destination}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    addToast("Download do quadro de itinerário iniciado!", "success");
  };

  const handleDuplicate = (route: BusRoute) => {
    const { id, ...rest } = route;
    setFormData({
      ...rest,
      prefixo_linha: `${rest.prefixo_linha} (Cópia)`,
      schedule: rest.schedule || { weekdays: [], saturday: [], sunday: [] }
    });
    setEditingId(null);
    setIsModalOpen(true);
  };

  const handleSave = () => {
    if (!formData.prefixo_linha || !formData.company_id || !formData.origin || !formData.destination) {
      addToast("Por favor, preencha todos os campos obrigatórios na aba Cadastro.", "error");
      return;
    }
    const route = { ...formData } as BusRoute;
    if (editingId) {
      onUpdateRoute({ ...route, id: editingId });
    } else {
      onAddRoute(route);
    }
    setIsModalOpen(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-white dark:bg-zinc-900 p-8 rounded-[2.5rem] border-2 border-yellow-400 gap-4">
        <div className="flex-1 w-full">
            <h2 className="text-3xl font-black text-slate-800 dark:text-zinc-100 uppercase italic">Gestão de Itinerários</h2>
            <div className="mt-6 relative max-w-md">
              <Search className="absolute left-4 top-4 text-slate-400" size={18} />
              <input type="text" placeholder="Buscar por linha ou destino..." className="w-full pl-12 pr-4 py-4 rounded-2xl bg-slate-50 dark:bg-zinc-800 border-2 border-yellow-400 text-[10px] font-black outline-none dark:text-zinc-300 shadow-inner" value={searchTerm || ''} onChange={e => setSearchTerm(e.target.value)} />
            </div>
        </div>
        <button onClick={() => { setFormData(initialForm); setEditingId(null); setIsModalOpen(true); }} className="bg-yellow-400 text-slate-900 px-8 py-4 rounded-2xl font-black uppercase text-[10px] shadow-xl border-2 border-slate-900 active:scale-95 transition-all flex items-center gap-2"><Plus size={18}/> Novo Itinerário</button>
      </div>

      <div className="flex overflow-x-auto pb-6 gap-6 snap-x snap-mandatory md:grid md:grid-cols-2 lg:grid-cols-3 md:overflow-x-visible md:pb-0 md:snap-none custom-scrollbar">
        {filteredRoutes.map(route => (
          <div key={route.id} className="min-w-[280px] sm:min-w-[320px] md:min-w-0 snap-center flex-1">
            <div className="bg-white dark:bg-zinc-900 p-6 rounded-[2.5rem] border-2 border-yellow-400 shadow-sm hover:shadow-xl transition-all h-full flex flex-col">
              <div className="flex items-center gap-3 mb-6">
                  <div className="h-12 min-w-fit px-4 bg-slate-900 text-yellow-400 rounded-2xl flex items-center justify-center font-black text-xl border-2 border-slate-800 shrink-0">{route.prefixo_linha}</div>
                  <div className="min-w-0 flex-1">
                    <h3 className="text-sm font-black dark:text-white uppercase italic leading-tight break-words whitespace-normal">{route.origin} x {route.destination}</h3>
                    <p className="text-[8px] font-black text-slate-400 uppercase">{route.route_type}</p>
                  </div>
              </div>
              <div className="flex justify-between items-center pt-4 border-t dark:border-zinc-800 mt-auto">
                  <div className="flex flex-col">
                      <span className="text-[8px] font-black text-black uppercase">Tarifa Final</span>
                      <span className="text-emerald-600 font-black">R$ {((route.price || 0) + (route.toll || 0) + (route.fees || 0)).toFixed(2)}</span>
                  </div>
                  <div className="flex gap-1 items-center">
                      <button onClick={() => handleDownloadItinerary(route)} className="p-2 text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/10 rounded-xl transition-all" title="Baixar Quadro de Itinerário">
                          <Clock size={18} />
                      </button>
                      <button onClick={() => handleDuplicate(route)} className="p-2 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/10 rounded-xl transition-all" title="Duplicar Itinerário">
                          <Plus size={18} />
                      </button>
                      <button onClick={() => { 
                          setFormData({
                              ...route,
                              schedule: route.schedule || { weekdays: [], saturday: [], sunday: [] }
                          }); 
                          setEditingId(route.id); 
                          setIsModalOpen(true); 
                      }} className="p-2 text-blue-600"><Pencil size={18} /></button>
                      
                      {deletingId === route.id ? (
                        <div className="flex gap-2 animate-in fade-in slide-in-from-right-2">
                          <button 
                            onClick={() => { onDeleteRoute(route.id); setDeletingId(null); }} 
                            className="px-3 py-1.5 bg-red-600 text-white text-[8px] font-black uppercase rounded-lg shadow-lg active:scale-95 transition-all"
                          >
                            Confirmar
                          </button>
                          <button 
                            onClick={() => setDeletingId(null)} 
                            className="px-3 py-1.5 bg-slate-100 dark:bg-zinc-800 text-slate-500 dark:text-zinc-400 text-[8px] font-black uppercase rounded-lg hover:bg-slate-200 transition-all"
                          >
                            Não
                          </button>
                        </div>
                      ) : (
                        <button 
                          onClick={() => setDeletingId(route.id)} 
                          className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/10 rounded-xl transition-all"
                          title="Excluir Itinerário"
                        >
                          <Trash2 size={18} />
                        </button>
                      )}
                  </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 dark:bg-black/70 z-[120] flex items-center justify-center p-4 backdrop-blur-md">
          <div className="bg-white dark:bg-zinc-950 w-full max-w-4xl rounded-[3rem] shadow-2xl flex flex-col h-[85vh] border-4 border-yellow-400 overflow-hidden">
            <div className="p-8 border-b-2 border-yellow-400 bg-slate-50 dark:bg-zinc-900 flex justify-between items-center">
                <h3 className="text-xl font-black text-slate-900 dark:text-zinc-100 uppercase italic">Configuração de Linha</h3>
                <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:rotate-90 transition-transform"><X size={32}/></button>
            </div>

            <div className="flex bg-slate-50 dark:bg-zinc-900 px-4 border-b-2 border-yellow-400 overflow-x-auto no-scrollbar">
                {[
                    { id: 'geral', label: 'Cadastro', icon: Navigation },
                    { id: 'secoes', label: 'Seções', icon: ListChecks },
                    { id: 'horario', label: 'Grade Horária', icon: Clock },
                    { id: 'letreiro', label: 'Painel Digital', icon: Type }
                ].map(tab => (
                    <button key={tab.id} onClick={() => setActiveTab(tab.id as ModalTab)} className={`flex items-center gap-2 px-6 py-4 text-[10px] font-black uppercase transition-all border-b-4 ${activeTab === tab.id ? 'border-yellow-400 text-yellow-600' : 'border-transparent text-slate-400'}`}>
                        <tab.icon size={14} /> {tab.label}
                    </button>
                ))}
            </div>

            <div className="p-8 space-y-6 overflow-y-auto custom-scrollbar flex-1 bg-white dark:bg-zinc-950">
                {activeTab === 'geral' && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-in fade-in">
                        <div className="col-span-full">
                            <label className="block text-[10px] font-black text-black uppercase mb-1 ml-2">Empresa Operadora *</label>
                            <select className="w-full px-5 py-4 border-2 border-yellow-400 rounded-2xl font-bold bg-slate-50 dark:bg-zinc-900 dark:text-white" value={formData.company_id || ''} onChange={e => setFormData({...formData, company_id: e.target.value})}>
                                <option value="">Selecione a empresa...</option>
                                {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-[10px] font-black text-black uppercase mb-1 ml-2">Cód. Linha *</label>
                            <input className="w-full px-5 py-4 border-2 border-yellow-400 rounded-2xl font-bold bg-slate-50 dark:bg-zinc-900 dark:text-zinc-100" value={formData.prefixo_linha || ''} onChange={e => setFormData({...formData, prefixo_linha: e.target.value})} placeholder="501" />
                        </div>
                        <div>
                            <label className="block text-[10px] font-black text-black uppercase mb-1 ml-2">Ponto de Origem *</label>
                            <input className="w-full px-5 py-4 border-2 border-yellow-400 rounded-2xl font-bold bg-slate-50 dark:bg-zinc-900 dark:text-zinc-100" value={selectedDirection === 'VOLTA' ? (formData.destination || '') : (formData.origin || '')} onChange={e => {
                                if (selectedDirection === 'VOLTA') setFormData({...formData, destination: e.target.value});
                                else setFormData({...formData, origin: e.target.value});
                            }} placeholder="CIDADE DE ORIGEM" />
                        </div>
                        <div>
                            <label className="block text-[10px] font-black text-black uppercase mb-1 ml-2">Ponto de Destino *</label>
                            <input className="w-full px-5 py-4 border-2 border-yellow-400 rounded-2xl font-bold bg-slate-50 dark:bg-zinc-900 dark:text-zinc-100" value={selectedDirection === 'VOLTA' ? (formData.origin || '') : (formData.destination || '')} onChange={e => {
                                if (selectedDirection === 'VOLTA') setFormData({...formData, origin: e.target.value});
                                else setFormData({...formData, destination: e.target.value});
                            }} placeholder="CIDADE DE DESTINO" />
                        </div>
                        <div>
                            <label className="block text-[10px] font-black text-black uppercase mb-1 ml-2">Tarifa Base R$ *</label>
                            <input type="text" className="w-full px-5 py-4 border-2 border-yellow-400 rounded-2xl font-bold bg-slate-50 dark:bg-zinc-900 dark:text-zinc-100" value={formatCurrencyValue(formData.price)} onChange={e => handleCurrencyChange(e.target.value, 'price')} placeholder="R$ 0,00" />
                        </div>
                        <div>
                            <label className="block text-[10px] font-black text-black uppercase mb-1 ml-2">Pedágio R$</label>
                            <input type="text" className="w-full px-5 py-4 border-2 border-yellow-400 rounded-2xl font-bold bg-slate-50 dark:bg-zinc-900 dark:text-zinc-100" value={formatCurrencyValue(formData.toll)} onChange={e => handleCurrencyChange(e.target.value, 'toll')} placeholder="R$ 0,00" />
                        </div>
                        <div>
                            <label className="block text-[10px] font-black text-black uppercase mb-1 ml-2">Taxas R$</label>
                            <input type="text" className="w-full px-5 py-4 border-2 border-yellow-400 rounded-2xl font-bold bg-slate-50 dark:bg-zinc-900 dark:text-zinc-100" value={formatCurrencyValue(formData.fees)} onChange={e => handleCurrencyChange(e.target.value, 'fees')} placeholder="R$ 0,00" />
                        </div>
                        <div>
                            <label className="block text-[10px] font-black text-black uppercase mb-1 ml-2">Tarifa Final R$</label>
                            <div className="w-full px-5 py-4 border-2 border-slate-200 bg-slate-100 dark:bg-zinc-800 dark:border-zinc-700 rounded-2xl font-black text-slate-500 dark:text-zinc-400">
                                {((formData.price || 0) + (formData.toll || 0) + (formData.fees || 0)).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                            </div>
                        </div>
                        <div>
                            <label className="block text-[10px] font-black text-black uppercase mb-1 ml-2">Tempo de Viagem (min) *</label>
                            <input type="number" className="w-full px-5 py-4 border-2 border-yellow-400 rounded-2xl font-bold bg-slate-50 dark:bg-zinc-900 dark:text-zinc-100" value={formData.duration_minutes || ''} onChange={e => setFormData({...formData, duration_minutes: parseInt(e.target.value) || 0})} />
                        </div>
                        <div>
                            <label className="block text-[10px] font-black text-black uppercase mb-1 ml-2">Tempo Estimado (Texto)</label>
                            <input className="w-full px-5 py-4 border-2 border-yellow-400 rounded-2xl font-bold bg-slate-50 dark:bg-zinc-900 dark:text-zinc-100" value={formData.estimated_travel_time_text || ''} onChange={e => setFormData({...formData, estimated_travel_time_text: e.target.value})} placeholder="Ex: 1h 30min" />
                        </div>
                        <div>
                            <label className="block text-[10px] font-black text-black uppercase mb-1 ml-2">Classe de Serviço</label>
                            <select className="w-full px-5 py-4 border-2 border-yellow-400 rounded-2xl font-bold bg-slate-50 dark:bg-zinc-900 dark:text-white" value={formData.service_class || ''} onChange={e => setFormData({...formData, service_class: e.target.value})}>
                                <option value="">Selecione a classe...</option>
                                {allServiceClasses.map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-[10px] font-black text-black uppercase mb-1 ml-2">Tipo de Rota *</label>
                            <select className="w-full px-5 py-4 border-2 border-yellow-400 rounded-2xl font-bold bg-slate-50 dark:bg-zinc-900 dark:text-white" value={formData.route_type || ''} onChange={e => setFormData({...formData, route_type: e.target.value as 'URBANO' | 'RODOVIARIA' | 'INTERMUNICIPAL'})}>
                                <option value="URBANO">URBANO</option>
                                <option value="RODOVIARIA">RODOVIARIA</option>
                                <option value="INTERMUNICIPAL">INTERMUNICIPAL</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-[10px] font-black text-black uppercase mb-1 ml-2">Tipo de Pagamento</label>
                            <select className="w-full px-5 py-4 border-2 border-yellow-400 rounded-2xl font-bold bg-slate-50 dark:bg-zinc-900 dark:text-white" value={formData.payment_type || 'QUALQUER_UM'} onChange={e => handlePaymentTypeChange(e.target.value)}>
                                <option value="QUALQUER_UM">QUALQUER UM (EXCETO RODOVIÁRIO)</option>
                                <option value="RODOVIARIO_APENAS">APENAS RODOVIÁRIO</option>
                                <option value="URBANO_APENAS">APENAS URBANO</option>
                            </select>
                        </div>
                        <div className="col-span-full">
                            <label className="block text-[10px] font-black text-black uppercase mb-1 ml-2">Formas de Pagamento Aceitas</label>
                            <div className="flex flex-wrap gap-2 p-4 bg-slate-50 dark:bg-zinc-900 rounded-2xl border-2 border-yellow-400/20">
                                {['DINHEIRO', 'PIX', 'CREDITO', 'DEBITO', 'VALE_TRANSPORTE', 'PAGSEGURO', 'MERCADO_PAGO'].map(method => {
                                    const isSelected = formData.payment_methods_accepted?.includes(method);
                                    return (
                                        <button
                                            key={method}
                                            onClick={() => {
                                                const current = formData.payment_methods_accepted || [];
                                                const next = isSelected ? current.filter(m => m !== method) : [...current, method];
                                                setFormData({ ...formData, payment_methods_accepted: next });
                                            }}
                                            className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase transition-all ${isSelected ? 'bg-yellow-400 text-slate-900 border-2 border-slate-900' : 'bg-white dark:bg-zinc-800 text-slate-400 border-2 border-transparent hover:border-yellow-400/50'}`}
                                        >
                                            {method.replace('_', ' ')}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'secoes' && (
                    <div className="space-y-6 animate-in fade-in">
                        <div className="flex justify-between items-center">
                            <h4 className="text-[10px] font-black text-indigo-500 uppercase tracking-widest flex items-center gap-2"><ListChecks size={14}/> Gerenciamento de Seções da Rota</h4>
                            <button onClick={addSection} className="px-6 py-3 bg-indigo-600 text-white rounded-xl text-[9px] font-black uppercase flex items-center gap-2 hover:bg-indigo-700 active:scale-95 transition-all shadow-md"><Plus size={14}/> Nova Seção</button>
                        </div>
                        
                        <div className="grid gap-4">
                            {(formData.sections || []).length === 0 ? (
                                <div className="p-10 border-2 border-dashed border-slate-200 dark:border-zinc-800 rounded-[2rem] text-center">
                                    <p className="text-[10px] font-black text-black uppercase italic">Nenhuma seção cadastrada para este itinerário.</p>
                                </div>
                            ) : (
                                (formData.sections || []).map((sec, idx) => (
                                    <div key={idx} className="flex flex-col md:flex-row gap-4 p-6 bg-slate-50 dark:bg-zinc-900 rounded-[2rem] border border-slate-200 dark:border-zinc-800 transition-all hover:border-yellow-400 group">
                                        <div className="flex-1">
                                            <label className="block text-[8px] font-black text-black uppercase mb-1 ml-1">Origem</label>
                                            <input className="w-full bg-white dark:bg-zinc-800 p-3 rounded-xl border-2 border-indigo-400/10 font-bold dark:text-zinc-100 outline-none focus:border-indigo-500" value={selectedDirection === 'VOLTA' ? (sec.destination || '') : (sec.origin || '')} onChange={e => {
                                                if (selectedDirection === 'VOLTA') updateSection(idx, 'destination', e.target.value);
                                                else updateSection(idx, 'origin', e.target.value);
                                            }} />
                                        </div>
                                        <div className="flex-1">
                                            <label className="block text-[8px] font-black text-black uppercase mb-1 ml-1">Destino</label>
                                            <input className="w-full bg-white dark:bg-zinc-800 p-3 rounded-xl border-2 border-indigo-400/10 font-bold dark:text-zinc-100 outline-none focus:border-indigo-500" value={selectedDirection === 'VOLTA' ? (sec.origin || '') : (sec.destination || '')} onChange={e => {
                                                if (selectedDirection === 'VOLTA') updateSection(idx, 'origin', e.target.value);
                                                else updateSection(idx, 'destination', e.target.value);
                                            }} />
                                        </div>
                                        <div className="w-full md:w-32">
                                            <label className="block text-[8px] font-black text-slate-400 uppercase mb-1 ml-1">Tarifa R$</label>
                                            <input type="text" className="w-full bg-white dark:bg-zinc-800 p-3 rounded-xl border-2 border-emerald-400/10 font-bold dark:text-zinc-100 outline-none focus:border-emerald-500" value={formatCurrencyValue(sec.price)} onChange={e => handleSectionCurrencyChange(idx, e.target.value)} />
                                        </div>
                                        <button onClick={() => removeSection(idx)} className="self-end md:self-center p-3 text-red-500 hover:bg-red-50 dark:hover:bg-red-950 rounded-xl transition-all"><Trash2 size={20}/></button>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                )}

                {activeTab === 'horario' && (
                    <div className="space-y-8 animate-in fade-in">
                        {[
                            { id: 'weekdays', label: 'Dias Úteis', desc: 'Segunda a Sexta' },
                            { id: 'saturday', label: 'Sábados', desc: 'Meio de Semana' },
                            { id: 'sunday', label: 'Domingos e Feriados', desc: 'Plantão' }
                        ].map(day => (
                            <div key={day.id} className="bg-slate-50 dark:bg-zinc-900 rounded-[2.5rem] p-8 border-2 border-slate-200 dark:border-zinc-800">
                                <div className="flex justify-between items-center mb-6">
                                    <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
                                        <div>
                                            <h4 className="text-xl font-black text-indigo-500 uppercase tracking-widest leading-none">{day.label}</h4>
                                            <span className="text-[10px] font-bold text-slate-400 uppercase">{day.desc}</span>
                                        </div>
                                        <div className="flex gap-2">
                                            {day.id !== 'weekdays' && (
                                                <button onClick={() => handleCopySchedule('weekdays', day.id as any)} className="px-3 py-1.5 bg-slate-100 dark:bg-zinc-800 text-[8px] font-black uppercase rounded-lg hover:bg-yellow-400 hover:text-slate-900 transition-all">Copiar de Úteis</button>
                                            )}
                                            <button onClick={() => setShowBulk(prev => ({ ...prev, [day.id]: !prev[day.id as keyof typeof prev] }))} className="px-3 py-1.5 bg-slate-100 dark:bg-zinc-800 text-[8px] font-black uppercase rounded-lg hover:bg-slate-200 transition-all">Importação em Massa</button>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <select 
                                            className="px-3 py-4 bg-white dark:bg-zinc-800 border-2 border-slate-200 dark:border-zinc-700 rounded-2xl font-black text-[10px] outline-none focus:border-indigo-500 dark:text-white"
                                            value={selectedDirection}
                                            onChange={e => setSelectedDirection(e.target.value as 'IDA' | 'VOLTA')}
                                        >
                                            <option value="IDA">IDA</option>
                                            <option value="VOLTA">VOLTA</option>
                                        </select>
                                        <input 
                                            type="time" 
                                            className="px-6 py-4 bg-white dark:bg-zinc-800 border-2 border-slate-200 dark:border-zinc-700 rounded-2xl font-black text-xl outline-none focus:border-indigo-500 dark:text-white w-40"
                                            value={newTimes[day.id as keyof typeof newTimes] || ''}
                                            onChange={e => setNewTimes(prev => ({ ...prev, [day.id]: e.target.value }))}
                                        />
                                        <button type="button" onClick={() => addTime(day.id as any)} className="p-3 bg-indigo-600 text-white rounded-xl shadow-lg active:scale-90 transition-all hover:bg-indigo-700"><Plus size={16}/></button>
                                    </div>
                                </div>
                                
                                {showBulk[day.id as keyof typeof showBulk] && (
                                    <div className="mb-6 space-y-4 animate-in slide-in-from-top-4">
                                        <textarea 
                                            className="w-full h-32 p-4 bg-white dark:bg-zinc-800 border-2 border-dashed border-indigo-200 dark:border-zinc-700 rounded-2xl font-mono text-xs outline-none focus:border-indigo-500 dark:text-zinc-300"
                                            placeholder="Cole os horários separados por vírgula ou um por linha (Ex: 08:30, 09:00, 10:15)"
                                            value={bulkInput[day.id as keyof typeof bulkInput]}
                                            onChange={e => setBulkInput(prev => ({ ...prev, [day.id]: e.target.value }))}
                                        />
                                        <div className="flex justify-end gap-3">
                                            <button onClick={() => setShowBulk(prev => ({ ...prev, [day.id]: false }))} className="px-6 py-3 text-slate-400 text-[10px] font-black uppercase">Cancelar</button>
                                            <button onClick={() => handleBulkImport(day.id as any)} className="px-6 py-3 bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase shadow-lg">Processar Importação</button>
                                        </div>
                                    </div>
                                )}
                                
                                <div className="flex flex-wrap gap-3">
                                    {(formData.schedule?.[day.id as keyof typeof formData.schedule] || []).length === 0 ? (
                                        <div className="w-full py-10 flex flex-col items-center justify-center opacity-30 border-2 border-dashed border-slate-200 dark:border-zinc-800 rounded-3xl">
                                            <Clock size={32} className="text-black mb-2"/>
                                            <p className="text-[10px] font-black uppercase">Sem horários cadastrados</p>
                                        </div>
                                    ) : (
                                        (formData.schedule?.[day.id as keyof typeof formData.schedule] || [])
                                            .filter(t => t.direction === selectedDirection) // FILTERING AS REQUESTED
                                            .sort((a, b) => {
                                                if (selectedDirection === 'IDA') return 0; // Registration order for IDA
                                                const [h1, m1] = (a.time || '00:00').split(':').map(Number);
                                                const [h2, m2] = (b.time || '00:00').split(':').map(Number);
                                                return (h1 * 60 + m1) - (h2 * 60 + m2);
                                            })
                                            .map(item => (
                                                <div key={`${item.time}-${item.direction}`} className="group relative">
                                                    <div className={`px-5 py-3 bg-white dark:bg-zinc-800 rounded-xl border-2 shadow-sm flex items-center gap-3 transition-all hover:border-yellow-400 ${item.direction === 'IDA' ? 'border-emerald-100 dark:border-emerald-900/20' : 'border-blue-100 dark:border-blue-900/20'}`}>
                                                        <div className="flex flex-col">
                                                            <span className="text-xl font-black font-mono dark:text-zinc-100">{item.time}</span>
                                                        </div>
                                                        <button onClick={() => removeTime(day.id as any, item.time, item.direction)} className="text-red-400 hover:text-red-600 transition-colors"><Trash2 size={14}/></button>
                                                    </div>
                                                </div>
                                            ))
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {activeTab === 'letreiro' && (
                    <div className="flex flex-col gap-8 animate-in fade-in">
                        <div className="bg-slate-900 p-10 rounded-[3rem] border-4 border-yellow-400 flex flex-col items-center justify-center text-center shadow-2xl">
                            <Binary size={48} className="text-yellow-400 mb-6"/>
                            <h4 className="text-white font-black uppercase text-[10px] tracking-widest mb-6 italic">Painel Digital em Tempo Real</h4>
                            <div className="bg-zinc-950 w-full p-4 rounded-3xl border-4 border-zinc-800 font-led h-32 flex items-center overflow-hidden relative shadow-inner">
                                <div className="bg-zinc-900 h-full px-6 flex items-center border-r-4 border-zinc-800 text-3xl font-black text-yellow-500 z-10 uppercase shrink-0">{formData.prefixo_linha || '---'}</div>
                                <div className="flex-1 h-full overflow-hidden flex items-center justify-center relative">
                                    <span key={`${currentSignIdx}-${activeSigns[currentSignIdx].text}`} className={`${getLedColorClass((activeSigns[currentSignIdx] as any).cor || 'AMBAR')} text-3xl font-black uppercase whitespace-nowrap ${activeSigns[currentSignIdx].modo === 'ROLANTE' ? 'animate-marquee-led inline-block' : 'text-center'}`} style={activeSigns[currentSignIdx].modo === 'ROLANTE' ? { animationDuration: '8s' } : {}}>{activeSigns[currentSignIdx].text}</span>
                                </div>
                            </div>
                            <div className="mt-6 flex gap-8">
                                <div className="flex items-center gap-3"><div className="w-3 h-3 rounded-full bg-emerald-500 shadow-[0_0_8px_#10b981]"></div><span className="text-[9px] text-white font-black uppercase">Sequência Ativa: {currentSignIdx + 1}/{activeSigns.length}</span></div>
                                {/* Fix: replaced activeDisplay with activeSigns[currentSignIdx] */}
                                <div className="flex items-center gap-3"><div className={`w-3 h-3 rounded-full shadow-lg ${activeSigns[currentSignIdx].modo === 'ROLANTE' ? 'bg-blue-500 shadow-blue-500/50 animate-pulse' : 'bg-yellow-500 shadow-yellow-500/50'}`}></div><span className="text-[9px] text-white font-black uppercase">{activeSigns[currentSignIdx].modo}</span></div>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            <div className="space-y-6">
                                <div className="p-6 bg-slate-50 dark:bg-zinc-900 rounded-[2rem] border-2 border-yellow-400/30">
                                    <h4 className="text-[10px] font-black text-indigo-500 uppercase mb-4 flex items-center gap-2"><Hash size={14}/> Destino Principal</h4>
                                    <div className="space-y-4">
                                        <div>
                                            <label className="block text-[8px] font-black text-slate-400 uppercase mb-1 ml-2">Texto Principal</label>
                                            <input className="w-full bg-white dark:bg-zinc-800 p-4 rounded-xl border-2 border-yellow-400/20 font-bold dark:text-zinc-100 outline-none" value={formData.letreiro_principal || ''} onChange={e => setFormData({...formData, letreiro_principal: e.target.value})} />
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <label className="block text-[8px] font-black text-slate-400 uppercase mb-1 ml-2">Cor do LED</label>
                                                <select className="w-full p-4 bg-white dark:bg-zinc-800 border-2 border-slate-100 dark:border-zinc-700 rounded-xl text-[10px] font-black dark:text-zinc-100" value={formData.letreiro_principal_cor} onChange={e => setFormData({...formData, letreiro_principal_cor: e.target.value as LedColor})}><option value="AMBAR">ÂMBAR</option><option value="BRANCO">BRANCO</option><option value="VERDE">VERDE</option></select>
                                            </div>
                                            <div>
                                                <label className="block text-[8px] font-black text-slate-400 uppercase mb-1 ml-2">Modo de Exibição</label>
                                                <select className="w-full bg-slate-900 text-white p-4 rounded-xl font-black text-[9px]" value={formData.letreiro_principal_modo} onChange={e => setFormData({...formData, letreiro_principal_modo: e.target.value as any})}><option value="FIXO">FIXO</option><option value="ROLANTE">ROLANTE</option></select>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div className="space-y-6">
                                <h4 className="text-[10px] font-black text-indigo-500 uppercase flex items-center gap-2 mb-2"><Navigation size={14}/> Itinerário de Vias Sequenciais</h4>
                                <div className="space-y-4">
                                    {[1, 2, 3].map(i => {
                                        const key = `via${i}` as keyof BusRoute;
                                        const modeKey = `via${i}_modo` as keyof BusRoute;
                                        return (
                                            <div key={i} className="flex flex-col p-5 bg-slate-50 dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 transition-all hover:border-yellow-400 gap-3">
                                                <div className="flex items-center justify-between">
                                                    <span className="text-[9px] font-black text-indigo-600 uppercase tracking-[0.2em]">Via {i}</span>
                                                    <span className="text-[8px] font-bold text-slate-400">POSIÇÃO {i+1} DA SEQUÊNCIA</span>
                                                </div>
                                                <input className="flex-1 bg-white dark:bg-zinc-800 p-4 rounded-xl border-2 border-yellow-400/10 font-bold dark:text-zinc-100 outline-none focus:border-yellow-400" value={(formData[key] as string) || ''} onChange={e => setFormData({...formData, [key]: e.target.value})} placeholder={`NOME DA VIA ${i}`} />
                                                <div className="flex items-center gap-2">
                                                    <label className="text-[8px] font-black text-slate-400 uppercase">Cor:</label>
                                                    <select className="flex-1 bg-white dark:bg-zinc-800 p-2.5 rounded-xl font-black text-[9px] border-2 border-yellow-400/10 dark:text-zinc-100" value={(formData[`via${i}_cor` as keyof BusRoute] as string) || 'AMBAR'} onChange={e => setFormData({...formData, [`via${i}_cor` as keyof BusRoute]: e.target.value as LedColor})}>
                                                        <option value="AMBAR">ÂMBAR</option>
                                                        <option value="BRANCO">BRANCO</option>
                                                        <option value="VERDE">VERDE</option>
                                                    </select>
                                                    <label className="text-[8px] font-black text-slate-400 uppercase">Ação:</label>
                                                    <select className="flex-1 bg-slate-800 text-white p-2.5 rounded-xl font-black text-[9px] outline-none" value={(formData[modeKey] as string) || 'FIXO'} onChange={e => setFormData({...formData, [modeKey]: e.target.value as any})}><option value="FIXO">EXIBIÇÃO FIXA</option><option value="ROLANTE">EXIBIÇÃO ROLANTE</option></select>
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            <div className="p-8 border-t-2 border-yellow-400 bg-slate-50 dark:bg-zinc-900 flex gap-4">
                <button onClick={() => setIsModalOpen(false)} className="flex-1 py-4 text-slate-400 font-black uppercase text-[10px]">Cancelar</button>
                <button onClick={handleSave} className="flex-[2] py-4 bg-yellow-400 text-slate-900 rounded-[2rem] font-black uppercase text-xs shadow-xl active:scale-95 border-2 border-slate-900 flex items-center justify-center gap-2"><Save size={20}/> Gravar Itinerário</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RouteManager;
