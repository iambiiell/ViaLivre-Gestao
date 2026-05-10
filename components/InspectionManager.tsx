
import React, { useState, useMemo, useEffect } from 'react';
import { Inspection, Vehicle, User, DriverLog } from '../types';
import { ClipboardCheck, Plus, X, Bus, CheckCircle, AlertTriangle, Search, Save, Calendar, MapPin, Building2, FileText, User as UserIcon, Clock, ArrowRight } from 'lucide-react';
import { db } from '../services/database';

interface InspectionManagerProps {
  inspections: Inspection[];
  vehicles: Vehicle[];
  currentUser: User | null;
  onAddInspection: (inspection: Inspection) => void;
  onDeleteInspection: (id: string) => void;
  addToast: (message: string, type?: 'success' | 'error' | 'warning') => void;
}

const InspectionManager: React.FC<InspectionManagerProps> = ({ inspections = [], vehicles = [], currentUser, onAddInspection, onDeleteInspection, addToast }) => {
  const [activeTab, setActiveTab] = useState<'inspections' | 'guides'>('inspections');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [driverGuides, setDriverGuides] = useState<DriverLog[]>([]);
  const [isLoadingGuides, setIsLoadingGuides] = useState(false);
  
  const [formData, setFormData] = useState<Partial<Inspection>>({
    status: 'APROVADO',
    location: '',
    agency: '',
    checklist: { pneus: true, freios: true, luzes: true, limpeza: true, documentos: true, ar_condicionado: true },
    date: new Date().toISOString().split('T')[0]
  });

  useEffect(() => {
    if (activeTab === 'guides') {
      setIsLoadingGuides(true);
      db.getDriverLogs().then(guides => {
        setDriverGuides(guides || []);
        setIsLoadingGuides(false);
      });
    }
  }, [activeTab]);

  const filteredInspections = useMemo(() => {
    return inspections.filter(i => {
        const v = vehicles.find(veh => veh.id === i.vehicle_id);
        return v?.prefix.toLowerCase().includes(searchTerm.toLowerCase());
    }).sort((a, b) => {
        const vA = vehicles.find(v => v.id === a.vehicle_id)?.prefix || '';
        const vB = vehicles.find(v => v.id === b.vehicle_id)?.prefix || '';
        return vA.localeCompare(vB, undefined, { numeric: true });
    });
  }, [inspections, vehicles, searchTerm]);

  const filteredGuides = useMemo(() => {
    return driverGuides.filter(g => 
        (g as any).driver_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (g as any).vehicle_number?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [driverGuides, searchTerm]);

  const handleSave = () => {
    if (!formData.vehicle_id || !formData.location || !formData.agency) {
      addToast("Preencha todos os campos obrigatórios.", "error");
      return;
    }

    // Mapping Inspection to DriverLog format for the driver_logs table
    const inspectionPayload = {
      ...formData,
      id: `insp-${Date.now()}`,
      driver_id: currentUser?.id || 'sys', // Using driver_id as the inspector
      created_at: new Date().toISOString(),
      damage_reported: formData.status === 'REPROVADO',
      notes: `${formData.notes || ''} [Vistoria: ${formData.agency} em ${formData.location}]`.trim(),
      tire_condition_ok: formData.checklist?.pneus,
      lights_condition_ok: formData.checklist?.luzes,
      internal_cleaning_ok: formData.checklist?.limpeza,
      documents_ok: formData.checklist?.documentos,
      // Add other fields if necessary
    };

    onAddInspection(inspectionPayload as any);
    setIsModalOpen(false);
  };

  return (
    <div className="space-y-6 animate-in fade-in">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-white dark:bg-zinc-900 p-8 rounded-[2.5rem] shadow-sm border dark:border-zinc-800 gap-4 transition-colors">
        <div className="flex-1 w-full">
            <div className="flex items-center gap-4 mb-6">
                <button onClick={() => setActiveTab('inspections')} className={`px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'inspections' ? 'bg-slate-900 text-white dark:bg-yellow-400 dark:text-slate-900' : 'text-slate-400 hover:bg-slate-100 dark:hover:bg-zinc-800'}`}>Vistorias</button>
                <button onClick={() => setActiveTab('guides')} className={`px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'guides' ? 'bg-slate-900 text-white dark:bg-yellow-400 dark:text-slate-900' : 'text-slate-400 hover:bg-slate-100 dark:hover:bg-zinc-800'}`}>Guias do Motorista</button>
            </div>
            <h2 className="text-3xl font-black text-slate-800 dark:text-zinc-100 uppercase italic tracking-tighter">
                {activeTab === 'inspections' ? 'Vistorias Técnicas' : 'Guias de Viagem'}
            </h2>
            <div className="mt-6 relative max-w-md">
                <Search className="absolute left-4 top-4 text-slate-400" size={18} />
                <input type="text" placeholder={activeTab === 'inspections' ? "Filtrar por prefixo..." : "Filtrar por motorista ou carro..."} className="w-full pl-12 pr-4 py-4 rounded-2xl bg-slate-50 dark:bg-zinc-800 border-none text-[10px] font-black outline-none dark:text-zinc-300 shadow-inner" value={searchTerm || ''} onChange={e => setSearchTerm(e.target.value)} />
            </div>
        </div>
        {activeTab === 'inspections' && (
            <button onClick={() => setIsModalOpen(true)} className="bg-slate-900 text-white dark:bg-yellow-400 dark:text-slate-900 px-8 py-4 rounded-2xl font-black uppercase text-[10px] tracking-widest flex items-center gap-2 shadow-xl hover:scale-105 transition-all"><Plus size={18} /> Nova Vistoria</button>
        )}
      </div>

      {activeTab === 'inspections' ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filteredInspections.map(insp => {
                const v = vehicles.find(veh => veh.id === insp.vehicle_id);
                return (
                    <div key={insp.id} className="bg-white dark:bg-zinc-900 p-6 rounded-3xl border dark:border-zinc-800 shadow-sm transition-all hover:shadow-lg">
                        <div className="flex justify-between items-start mb-4">
                            <div className="flex items-center gap-3">
                                <div className="p-3 bg-slate-100 dark:bg-zinc-800 rounded-xl text-slate-400"><Bus size={24}/></div>
                                <div>
                                    <h3 className="font-black text-slate-800 dark:text-white">#{v?.prefix || 'N/A'}</h3>
                                    <p className="text-[8px] font-black uppercase text-slate-400">{insp.date} • {insp.location}</p>
                                </div>
                            </div>
                            <span className={`px-3 py-1 rounded-lg text-[8px] font-black uppercase ${insp.status === 'APROVADO' ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'}`}>{insp.status}</span>
                        </div>
                        <div className="grid grid-cols-2 gap-2 mb-4">
                            {Object.entries(insp.checklist).map(([key, val]) => (
                                <div key={key} className="flex items-center gap-2 text-[9px] font-bold uppercase text-slate-500">
                                    {val ? <CheckCircle size={10} className="text-emerald-500"/> : <AlertTriangle size={10} className="text-red-500"/>}
                                    {key.replace('_', ' ')}
                                </div>
                            ))}
                        </div>
                        <div className="text-[8px] font-black uppercase text-slate-400 mb-4 border-t dark:border-zinc-800 pt-2">Órgão: {insp.agency}</div>
                        
                        {deletingId === insp.id ? (
                          <div className="flex gap-2 animate-in fade-in slide-in-from-bottom-2 border-t dark:border-zinc-800 mt-2 pt-2 justify-center">
                            <button 
                              onClick={() => { onDeleteInspection(insp.id); setDeletingId(null); }} 
                              className="px-4 py-1.5 bg-red-600 text-white text-[9px] font-black uppercase rounded-lg shadow-lg active:scale-95 transition-all"
                            >
                              Confirmar Exclusão
                            </button>
                            <button 
                              onClick={() => setDeletingId(null)} 
                              className="px-4 py-1.5 bg-slate-100 dark:bg-zinc-800 text-slate-500 dark:text-zinc-400 text-[9px] font-black uppercase rounded-lg hover:bg-slate-200 transition-all"
                            >
                              Não
                            </button>
                          </div>
                        ) : (
                          <button 
                            onClick={() => setDeletingId(insp.id)} 
                            className="w-full py-2 text-red-400 hover:text-red-600 text-[10px] font-black uppercase border-t dark:border-zinc-800 mt-2 transition-colors"
                          >
                            Remover Registro
                          </button>
                        )}
                    </div>
                )
            })}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filteredGuides.map(guide => (
                <div key={guide.id} className="bg-white dark:bg-zinc-900 p-6 rounded-3xl border dark:border-zinc-800 shadow-sm transition-all hover:shadow-lg">
                    <div className="flex justify-between items-start mb-4">
                        <div className="flex items-center gap-3">
                            <div className="p-3 bg-indigo-50 dark:bg-indigo-900/20 rounded-xl text-indigo-500"><FileText size={24}/></div>
                            <div>
                                <h3 className="font-black text-slate-800 dark:text-white">Carro {guide.vehicle_number}</h3>
                                <p className="text-[8px] font-black uppercase text-slate-400">{guide.date} • {guide.departure_time}</p>
                            </div>
                        </div>
                        {guide.has_damage && <span className="px-3 py-1 bg-red-50 text-red-600 rounded-lg text-[8px] font-black uppercase flex items-center gap-1"><AlertTriangle size={10}/> AVARIA</span>}
                    </div>
                    
                    <div className="space-y-3 mb-4">
                        <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-zinc-800 rounded-xl">
                            <div className="flex items-center gap-2">
                                <UserIcon size={14} className="text-slate-400"/>
                                <span className="text-[9px] font-black uppercase text-slate-500">Motorista</span>
                            </div>
                            <span className="text-[10px] font-black dark:text-white">{guide.driver_name}</span>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                            <div className="p-3 bg-slate-50 dark:bg-zinc-800 rounded-xl text-center">
                                <p className="text-[8px] font-black text-slate-400 uppercase mb-1">Pagantes</p>
                                <p className="text-lg font-black text-emerald-600">{guide.paying_passengers}</p>
                            </div>
                            <div className="p-3 bg-slate-50 dark:bg-zinc-800 rounded-xl text-center">
                                <p className="text-[8px] font-black text-slate-400 uppercase mb-1">Gratuidade</p>
                                <p className="text-lg font-black text-blue-600">{guide.free_passengers}</p>
                            </div>
                        </div>
                    </div>

                    {guide.observations && (
                        <div className="p-4 bg-yellow-50 dark:bg-yellow-900/10 rounded-2xl border border-yellow-100 dark:border-yellow-900/30 mb-4">
                            <p className="text-[8px] font-black text-yellow-600 uppercase mb-1">Observações:</p>
                            <p className="text-[10px] font-bold text-slate-600 dark:text-zinc-300 italic">"{guide.observations}"</p>
                        </div>
                    )}

                    {guide.has_damage && (
                        <div className="p-4 bg-red-50 dark:bg-red-900/10 rounded-2xl border border-red-100 dark:border-red-900/30">
                            <p className="text-[8px] font-black text-red-600 uppercase mb-1">Avaria Identificada:</p>
                            <p className="text-[10px] font-black text-red-700 dark:text-red-400 uppercase">{guide.damage_type}</p>
                        </div>
                    )}
                </div>
            ))}
        </div>
      )}

      {isModalOpen && (
          <div className="fixed inset-0 bg-slate-900/60 dark:bg-black/70 z-[120] flex items-center justify-center p-4 backdrop-blur-md">
            <div className="bg-white dark:bg-zinc-950 w-full max-w-xl rounded-[3rem] shadow-2xl flex flex-col max-h-[92vh] border dark:border-zinc-800 overflow-hidden">
                <div className="p-8 border-b dark:border-zinc-800 bg-slate-50 dark:bg-zinc-900 flex justify-between items-center transition-colors">
                    <h3 className="text-xl font-black text-slate-900 dark:text-zinc-100 uppercase italic">Formulário de Vistoria</h3>
                    <button onClick={() => setIsModalOpen(false)} className="text-slate-400"><X size={32} /></button>
                </div>
                <div className="p-8 space-y-6 overflow-y-auto">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-2">Veículo</label>
                            <select className="w-full px-5 py-4 bg-slate-50 dark:bg-zinc-900 dark:text-zinc-100 rounded-2xl font-bold" value={formData.vehicle_id || ''} onChange={e => setFormData({...formData, vehicle_id: e.target.value})}>
                                <option value="">Selecione...</option>
                                {vehicles.map(v => <option key={v.id} value={v.id}>#{v.prefix} - {v.plate}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-2">Data da Vistoria</label>
                            <input type="date" className="w-full px-5 py-4 bg-slate-50 dark:bg-zinc-900 dark:text-zinc-100 rounded-2xl font-bold" value={formData.date || ''} onChange={e => setFormData({...formData, date: e.target.value})} />
                        </div>
                        <div>
                            <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-2">Local / Unidade</label>
                            <input className="w-full px-5 py-4 bg-slate-50 dark:bg-zinc-900 dark:text-zinc-100 rounded-2xl font-bold" placeholder="Ex: Pátio Central" value={formData.location || ''} onChange={e => setFormData({...formData, location: e.target.value})} />
                        </div>
                        <div>
                            <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-2">Órgão Vistoriador</label>
                            <input className="w-full px-5 py-4 bg-slate-50 dark:bg-zinc-900 dark:text-zinc-100 rounded-2xl font-bold" placeholder="Ex: ANTT / Interno" value={formData.agency || ''} onChange={e => setFormData({...formData, agency: e.target.value})} />
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        {Object.keys(formData.checklist!).map(key => (
                            <button key={key} onClick={() => setFormData({...formData, checklist: {...formData.checklist!, [key]: !formData.checklist![key as keyof typeof formData.checklist]}})} className={`p-4 rounded-2xl border-2 flex items-center justify-between transition-all ${formData.checklist![key as keyof typeof formData.checklist] ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/10 text-emerald-700' : 'border-slate-100 dark:border-zinc-800 text-slate-400'}`}>
                                <span className="text-[10px] font-black uppercase">{key.replace('_', ' ')}</span>
                                {formData.checklist![key as keyof typeof formData.checklist] ? <CheckCircle size={18}/> : <AlertTriangle size={18}/>}
                            </button>
                        ))}
                    </div>
                    <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-2">Parecer Técnico</label>
                        <select className="w-full px-5 py-4 bg-slate-50 dark:bg-zinc-900 dark:text-zinc-100 rounded-2xl font-bold" value={formData.status || ''} onChange={e => setFormData({...formData, status: e.target.value as any})}>
                            <option value="APROVADO">APROVADO (LIBERADO)</option>
                            <option value="RESTRICAO">APROVADO COM RESTRIÇÃO</option>
                            <option value="REPROVADO">REPROVADO (BLOQUEADO)</option>
                        </select>
                    </div>
                    <div className="flex gap-4 pt-4">
                        <button onClick={() => setIsModalOpen(false)} className="flex-1 py-4 text-slate-400 font-black uppercase text-[10px] tracking-widest border-none">Cancelar</button>
                        <button onClick={handleSave} className="flex-[2] py-4 bg-yellow-400 text-slate-900 rounded-2xl font-black uppercase text-xs shadow-xl active:scale-95 flex items-center justify-center gap-2"><Save size={20}/> Gravar Vistoria</button>
                    </div>
                </div>
            </div>
          </div>
      )}
    </div>
  );
};

export default InspectionManager;
