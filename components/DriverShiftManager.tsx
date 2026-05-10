import React, { useState, useMemo } from 'react';
import { User, Shift, BusRoute } from '../types';
import { Calendar, User as UserIcon, Plus, Clock, MapPin, Save, Trash2, AlertCircle, X } from 'lucide-react';

interface DriverShiftManagerProps {
  shifts: Shift[];
  drivers: User[];
  routes: BusRoute[];
  onAddShift: (shift: Shift) => void;
  onUpdateShift: (shift: Shift) => void;
  onDeleteShift: (id: string) => void;
  addToast: (message: string, type?: 'success' | 'error' | 'warning') => void;
}

const DriverShiftManager: React.FC<DriverShiftManagerProps> = ({ 
  shifts = [], 
  drivers = [], 
  routes = [],
  onAddShift,
  onUpdateShift,
  onDeleteShift,
  addToast
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingShift, setEditingShift] = useState<Partial<Shift> | null>(null);
  const [filterDate, setFilterDate] = useState(new Date().toISOString().split('T')[0]);

  const filteredShifts = useMemo(() => {
    return shifts.filter(s => s.date === filterDate);
  }, [shifts, filterDate]);

  const availableDrivers = useMemo(() => drivers.filter(d => d.role === 'DRIVER'), [drivers]);

  const handleSave = () => {
    if (!editingShift?.driver_id || !editingShift?.route_id || !editingShift?.start_time || !editingShift?.end_time || !editingShift?.date) {
      addToast("Preencha todos os campos obrigatórios.", "error");
      return;
    }

    // Basic Rest Period Check (11 hours)
    const currentStart = new Date(`${editingShift.date}T${editingShift.start_time}`);
    const currentEnd = new Date(`${editingShift.date}T${editingShift.end_time}`);

    if (currentEnd <= currentStart) {
      addToast("O horário de término deve ser após o horário de início.", "error");
      return;
    }

    const driverShifts = shifts.filter(s => s.driver_id === editingShift.driver_id && s.id !== editingShift.id && s.date === editingShift.date);
    
    // Exact Overlap Check
    const hasOverlap = driverShifts.some(s => {
      const sStart = new Date(`${s.date}T${s.start_time}`);
      const sEnd = new Date(`${s.date}T${s.end_time}`);
      
      // Overlap logic: (StartA < EndB) and (EndA > StartB)
      return (currentStart < sEnd) && (currentEnd > sStart);
    });

    if (hasOverlap) {
      addToast("Conflito de Horário: Este motorista já possui um turno que se sobrepõe a este horário.", "error");
      return;
    }

    // Rest Period Check (11 hours)
    const allDriverShifts = shifts.filter(s => s.driver_id === editingShift.driver_id && s.id !== editingShift.id);
    const hasRestConflict = allDriverShifts.some(s => {
      const sEnd = new Date(`${s.date}T${s.end_time}`);
      const diff = Math.abs(currentStart.getTime() - sEnd.getTime()) / (1000 * 60 * 60);
      return diff < 11;
    });

    if (hasRestConflict && !confirm("Aviso: Este motorista pode não ter o descanso mínimo de 11 horas entre turnos. Deseja continuar?")) {
      return;
    }

    if (editingShift.id) {
      onUpdateShift(editingShift as Shift);
    } else {
      onAddShift({
        ...editingShift,
        id: `shift-${Date.now()}`
      } as Shift);
    }
    setIsModalOpen(false);
  };

  return (
    <div className="space-y-6 animate-in fade-in transition-all pb-24">
      {/* HEADER */}
      <div className="bg-white dark:bg-zinc-900 p-8 rounded-[2.5rem] shadow-sm border border-slate-100 dark:border-zinc-800">
        <div className="flex flex-col md:flex-row justify-between items-center gap-6">
          <div>
            <h2 className="text-3xl font-black text-slate-800 dark:text-zinc-100 uppercase italic leading-none">Gestão de Turnos</h2>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-2 border-l-2 border-yellow-400 pl-4">Escalabilidade e conformidade de jornada</p>
          </div>
          
          <div className="flex gap-3">
            <input 
              type="date" 
              value={filterDate || ''}
              onChange={e => setFilterDate(e.target.value)}
              className="px-6 py-3 bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-slate-400 rounded-xl font-black uppercase text-[10px] tracking-widest outline-none border-2 border-transparent focus:border-yellow-400 transition-all"
            />
            <button 
              onClick={() => { setEditingShift({ date: filterDate }); setIsModalOpen(true); }}
              className="px-6 py-3 bg-yellow-400 text-slate-900 rounded-xl font-black uppercase text-[10px] tracking-widest shadow-lg border-2 border-slate-900 active:scale-95 transition-all flex items-center gap-2"
            >
              <Plus size={18} /> Novo Turno
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* MAIN LIST */}
        <div className="lg:col-span-2 space-y-4">
          {filteredShifts.length === 0 ? (
            <div className="py-20 text-center bg-white dark:bg-zinc-900 rounded-[2.5rem] border-2 border-dashed border-slate-200 dark:border-zinc-800">
              <Calendar className="mx-auto text-slate-200 mb-4" size={48}/>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Nenhum turno escalado para esta data.</p>
            </div>
          ) : (
            filteredShifts.map(shift => {
              const driver = drivers.find(d => d.id === shift.driver_id);
              const route = routes.find(r => r.id === shift.route_id);
              return (
                <div key={shift.id} className="bg-white dark:bg-zinc-900 p-6 rounded-[2rem] border border-slate-100 dark:border-zinc-800 shadow-sm flex items-center justify-between group hover:shadow-md transition-all">
                  <div className="flex items-center gap-6">
                    <div className="w-14 h-14 bg-slate-100 dark:bg-zinc-800 rounded-2xl flex items-center justify-center text-slate-400">
                      {driver?.photo_url ? <img src={driver.photo_url} className="w-full h-full object-cover rounded-2xl" /> : <UserIcon size={24}/>}
                    </div>
                    <div>
                      <h3 className="font-black text-slate-800 dark:text-zinc-100 uppercase text-sm leading-tight">{driver?.full_name || driver?.name || 'Motorista não encontrado'}</h3>
                      <div className="flex items-center gap-4 mt-1">
                        <p className="text-[9px] font-black text-indigo-500 uppercase tracking-widest flex items-center gap-1">
                          <MapPin size={12}/> {route?.origin} → {route?.destination}
                        </p>
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1">
                          <Clock size={12}/> {shift.start_time} - {shift.end_time}
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => { setEditingShift(shift); setIsModalOpen(true); }} className="p-3 text-blue-600 hover:bg-blue-50 rounded-xl transition-all"><Clock size={20}/></button>
                    <button onClick={() => onDeleteShift(shift.id)} className="p-3 text-red-600 hover:bg-red-50 rounded-xl transition-all"><Trash2 size={20}/></button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* SIDEBAR INFO */}
        <div className="space-y-6">
          <div className="bg-slate-900 p-8 rounded-[2.5rem] text-white border-4 border-yellow-400 shadow-xl">
            <h3 className="text-xl font-black uppercase italic mb-6 flex items-center gap-3">
              <AlertCircle className="text-yellow-400"/> Status da Frota
            </h3>
            <div className="space-y-4">
              <div className="flex justify-between items-center border-b border-white/10 pb-3">
                <span className="text-[10px] font-black uppercase text-slate-400">Motoristas Ativos</span>
                <span className="text-xl font-black">{availableDrivers.length}</span>
              </div>
              <div className="flex justify-between items-center border-b border-white/10 pb-3">
                <span className="text-[10px] font-black uppercase text-slate-400">Turnos Hoje</span>
                <span className="text-xl font-black">{shifts.filter(s => s.date === new Date().toISOString().split('T')[0]).length}</span>
              </div>
              <p className="text-[9px] text-slate-500 uppercase leading-relaxed mt-4">
                O sistema monitora automaticamente o intervalo interjornada de 11 horas conforme a CLT.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 dark:bg-black/70 z-[200] flex items-center justify-center p-4 backdrop-blur-md animate-in zoom-in duration-300">
          <div className="bg-white dark:bg-zinc-950 w-full max-w-lg rounded-[3rem] shadow-2xl border-4 border-yellow-400 overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-8 border-b dark:border-zinc-800 bg-slate-900 flex justify-between items-center text-white">
              <div>
                <h3 className="text-xl font-black uppercase italic tracking-tighter">{editingShift?.id ? 'Editar Turno' : 'Novo Turno'}</h3>
                <p className="text-[9px] font-black text-yellow-400 uppercase mt-1">Escala de Trabalho</p>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="p-3 bg-white/10 rounded-2xl hover:bg-red-500 transition-colors"><X size={24}/></button>
            </div>
            
            <div className="p-8 space-y-6 overflow-y-auto custom-scrollbar">
              <div className="grid grid-cols-1 gap-4">
                <div>
                  <label className="text-[9px] font-black text-slate-400 uppercase ml-2 mb-1 block">Motorista *</label>
                  <select 
                    className="w-full px-5 py-4 bg-slate-50 dark:bg-zinc-900 border-2 border-slate-100 dark:border-zinc-800 rounded-2xl font-bold outline-none focus:border-yellow-400 dark:text-white transition-all"
                    value={editingShift?.driver_id || ''}
                    onChange={e => setEditingShift({...editingShift, driver_id: e.target.value})}
                  >
                    <option value="">Selecione o motorista</option>
                    {availableDrivers.map(d => <option key={d.id} value={d.id}>{d.full_name || d.name}</option>)}
                  </select>
                </div>

                <div>
                  <label className="text-[9px] font-black text-slate-400 uppercase ml-2 mb-1 block">Itinerário *</label>
                  <select 
                    className="w-full px-5 py-4 bg-slate-50 dark:bg-zinc-900 border-2 border-slate-100 dark:border-zinc-800 rounded-2xl font-bold outline-none focus:border-yellow-400 dark:text-white transition-all"
                    value={editingShift?.route_id || ''}
                    onChange={e => setEditingShift({...editingShift, route_id: e.target.value})}
                  >
                    <option value="">Selecione a rota</option>
                    {routes.map(r => <option key={r.id} value={r.id}>{r.prefixo_linha} - {r.origin} / {r.destination}</option>)}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[9px] font-black text-slate-400 uppercase ml-2 mb-1 block">Início *</label>
                    <input 
                      type="time" 
                      className="w-full px-5 py-4 bg-slate-50 dark:bg-zinc-900 border-2 border-slate-100 dark:border-zinc-800 rounded-2xl font-bold outline-none focus:border-yellow-400 dark:text-white transition-all"
                      value={editingShift?.start_time || ''}
                      onChange={e => setEditingShift({...editingShift, start_time: e.target.value})}
                    />
                  </div>
                  <div>
                    <label className="text-[9px] font-black text-slate-400 uppercase ml-2 mb-1 block">Fim *</label>
                    <input 
                      type="time" 
                      className="w-full px-5 py-4 bg-slate-50 dark:bg-zinc-900 border-2 border-slate-100 dark:border-zinc-800 rounded-2xl font-bold outline-none focus:border-yellow-400 dark:text-white transition-all"
                      value={editingShift?.end_time || ''}
                      onChange={e => setEditingShift({...editingShift, end_time: e.target.value})}
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[9px] font-black text-slate-400 uppercase ml-2 mb-1 block">Data *</label>
                  <input 
                    type="date" 
                    className="w-full px-5 py-4 bg-slate-50 dark:bg-zinc-900 border-2 border-slate-100 dark:border-zinc-800 rounded-2xl font-bold outline-none focus:border-yellow-400 dark:text-white transition-all"
                    value={editingShift?.date || ''}
                    onChange={e => setEditingShift({...editingShift, date: e.target.value})}
                  />
                </div>
              </div>

              <button 
                onClick={handleSave}
                className="w-full py-4 bg-yellow-400 text-slate-900 rounded-2xl font-black uppercase text-xs shadow-xl active:scale-95 border-2 border-slate-900 transition-all flex items-center justify-center gap-2"
              >
                <Save size={20}/> Salvar Turno
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DriverShiftManager;
