
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { User, TimeEntry } from '../types';
import { Timer, Clock, Play, Coffee, LogOut, CheckCircle2, Calendar, Search, Loader2, AlertTriangle, TrendingUp } from 'lucide-react';
import { db } from '../services/database';

interface TimeTrackingManagerProps {
  currentUser: User | null;
  addToast: (msg: string, type?: 'success' | 'error' | 'warning') => void;
}

const TimeTrackingManager: React.FC<TimeTrackingManagerProps> = ({ currentUser, addToast }) => {
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [filterMonth, setFilterMonth] = useState(new Date().getMonth() + 1);
  const [filterYear, setFilterYear] = useState(new Date().getFullYear());

  const today = new Date().toISOString().split('T')[0];
  
  const currentEntry = useMemo(() => entries.find(e => e.date === today && e.user_id === currentUser?.id), [entries, today, currentUser]);

  const checkAutoFinalize = useCallback(async (userEntries: TimeEntry[]) => {
    if (!currentUser) return userEntries;
    
    let needsUpdate = false;
    const now = new Date();
    // Um turno é noturno se a saída padrão for menor que a entrada (ex: 22:00 -> 06:00)
    const isNightShift = currentUser.standard_clock_out && currentUser.standard_clock_in 
                         ? currentUser.standard_clock_out < currentUser.standard_clock_in 
                         : false;

    const updatedEntries = await Promise.all(userEntries.map(async (entry) => {
        const entryDate = new Date(entry.date + 'T23:59:59');
        // Se a data do registro já passou e o ponto ainda está aberto (sem clock_out)
        if (entryDate < now && !entry.clock_out && entry.date !== today) {
            // Se NÃO for turno noturno, o sistema fecha às 23:59 automaticamente
            if (!isNightShift) {
                needsUpdate = true;
                const finalized = { 
                    ...entry, 
                    clock_out: '23:59',
                    total_daily_hours: 0 // Será recalculado na visualização
                };
                await db.update('time_tracking' as any, finalized);
                return finalized;
            }
        }
        return entry;
    }));

    if (needsUpdate) {
        addToast("Sistema: Pontos de dias anteriores foram finalizados às 23:59 automaticamente.", "warning");
    }
    return updatedEntries;
  }, [currentUser, today, addToast]);

  const loadEntries = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await db.fetchAll<TimeEntry>('time_tracking' as any);
      const userEntries = data.filter(e => e.user_id === currentUser?.id);
      const checkedData = await checkAutoFinalize(userEntries);
      setEntries(checkedData);
    } catch (e) {
      addToast("Erro ao carregar histórico de ponto.", "error");
    } finally {
      setIsLoading(false);
    }
  }, [currentUser, checkAutoFinalize, addToast]);

  useEffect(() => { loadEntries(); }, [currentUser, loadEntries]);

  const handleClockAction = async (action: 'clock_in' | 'break_start' | 'break_end' | 'clock_out') => {
    if (!currentUser) return;
    setIsProcessing(true);
    const nowTime = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    
    try {
      if (action === 'clock_in' && !currentEntry) {
        await db.create<TimeEntry>('time_tracking' as any, {
          user_id: currentUser.id,
          date: today,
          clock_in: nowTime
        });
      } else if (currentEntry) {
        const { total_daily_hours, ...entryData } = currentEntry;
        await db.update('time_tracking' as any, {
          ...entryData,
          [action]: nowTime
        });
      }
      addToast("Registro de ponto efetuado!", "success");
      await loadEntries();
    } catch (e) {
      addToast("Falha técnica ao registrar ponto.", "error");
    } finally {
      setIsProcessing(false);
    }
  };

  const stats = useMemo(() => {
    const monthEntries = entries.filter(e => {
        const d = new Date(e.date);
        return (d.getMonth() + 1) === filterMonth && d.getFullYear() === filterYear;
    });
    
    const totalHours = monthEntries.reduce((acc, e) => {
        if (!e.clock_in || !e.clock_out) return acc;
        
        const parseTime = (t: string) => {
            const [h, m] = t.split(':').map(Number);
            return h + m / 60;
        };

        let dayHours = parseTime(e.clock_out) - parseTime(e.clock_in);
        if (e.break_start && e.break_end) {
            dayHours -= (parseTime(e.break_end) - parseTime(e.break_start));
        }

        // Correção para turnos que viram a noite
        if (dayHours < 0) dayHours += 24;

        return acc + Math.max(0, dayHours);
    }, 0);

    const expectedHours = monthEntries.length * 8;
    return { 
        totalHours, 
        extraHours: Math.max(0, totalHours - expectedHours), 
        count: monthEntries.length 
    };
  }, [entries, filterMonth, filterYear]);

  return (
    <div className="space-y-6 animate-in fade-in transition-all pb-24">
      <div className="bg-white dark:bg-zinc-900 p-8 rounded-[3rem] border-2 border-yellow-400 shadow-sm transition-colors">
        <div className="flex flex-col md:flex-row justify-between items-center gap-6">
            <div className="flex items-center gap-4">
                <div className="p-4 bg-yellow-400 rounded-3xl text-slate-900 shadow-lg"><Timer size={32}/></div>
                <div>
                    <h2 className="text-2xl font-black uppercase italic dark:text-white leading-none">Jornada em Tempo Real</h2>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-2">Logado como: {currentUser?.full_name}</p>
                </div>
            </div>
            <div className="flex items-center gap-3 px-6 py-3 bg-slate-50 dark:bg-zinc-800 rounded-2xl border-2 border-yellow-400/20">
                <Clock size={20} className="text-yellow-500" />
                <span className="text-xl font-black font-mono dark:text-white">{new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
            </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-10">
            <button 
                disabled={isProcessing || !!currentEntry?.clock_in}
                onClick={() => handleClockAction('clock_in')}
                className={`flex flex-col items-center gap-3 p-6 rounded-[2rem] border-2 transition-all ${!currentEntry?.clock_in ? 'bg-emerald-600 text-white border-emerald-400 shadow-xl active:scale-95' : 'bg-slate-100 dark:bg-zinc-800 text-slate-300 border-transparent cursor-not-allowed'}`}
            >
                <Play size={24}/> <span className="text-[9px] font-black uppercase tracking-widest">Entrada</span>
            </button>
            <button 
                disabled={isProcessing || !currentEntry?.clock_in || !!currentEntry?.break_start}
                onClick={() => handleClockAction('break_start')}
                className={`flex flex-col items-center gap-3 p-6 rounded-[2rem] border-2 transition-all ${currentEntry?.clock_in && !currentEntry?.break_start ? 'bg-indigo-600 text-white border-indigo-400 shadow-xl active:scale-95' : 'bg-slate-100 dark:bg-zinc-800 text-slate-300 border-transparent cursor-not-allowed'}`}
            >
                <Coffee size={24}/> <span className="text-[9px] font-black uppercase tracking-widest">Intervalo</span>
            </button>
            <button 
                disabled={isProcessing || !currentEntry?.break_start || !!currentEntry?.break_end}
                onClick={() => handleClockAction('break_end')}
                className={`flex flex-col items-center gap-3 p-6 rounded-[2rem] border-2 transition-all ${currentEntry?.break_start && !currentEntry?.break_end ? 'bg-amber-600 text-white border-amber-400 shadow-xl active:scale-95' : 'bg-slate-100 dark:bg-zinc-800 text-slate-300 border-transparent cursor-not-allowed'}`}
            >
                <Timer size={24}/> <span className="text-[9px] font-black uppercase tracking-widest">Retorno</span>
            </button>
            <button 
                disabled={isProcessing || !currentEntry?.clock_in || !!currentEntry?.clock_out}
                onClick={() => handleClockAction('clock_out')}
                className={`flex flex-col items-center gap-3 p-6 rounded-[2rem] border-2 transition-all ${currentEntry?.clock_in && !currentEntry?.clock_out ? 'bg-red-600 text-white border-red-400 shadow-xl active:scale-95' : 'bg-slate-100 dark:bg-zinc-800 text-slate-300 border-transparent cursor-not-allowed'}`}
            >
                <LogOut size={24}/> <span className="text-[9px] font-black uppercase tracking-widest">Saída</span>
            </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white dark:bg-zinc-900 p-6 rounded-3xl border-2 border-yellow-400/20 shadow-sm flex items-center justify-between">
              <div><p className="text-[9px] font-black text-slate-400 uppercase mb-1">Horas Mensais</p><h4 className="text-2xl font-black dark:text-white">{stats.totalHours.toFixed(1)}h</h4></div>
              <Calendar className="text-yellow-500 opacity-20" size={32}/>
          </div>
          <div className="bg-white dark:bg-zinc-900 p-6 rounded-3xl border-2 border-yellow-400/20 shadow-sm flex items-center justify-between">
              <div><p className="text-[9px] font-black text-slate-400 uppercase mb-1">Dias Úteis</p><h4 className="text-2xl font-black dark:text-white">{stats.count}</h4></div>
              <CheckCircle2 className="text-emerald-500 opacity-20" size={32}/>
          </div>
          <div className="bg-white dark:bg-zinc-900 p-6 rounded-3xl border-2 border-yellow-400/20 shadow-sm flex items-center justify-between">
              <div><p className="text-[9px] font-black text-slate-400 uppercase mb-1">Extras Estimadas</p><h4 className="text-2xl font-black text-indigo-600">{stats.extraHours.toFixed(1)}h</h4></div>
              <TrendingUp className="text-indigo-500 opacity-20" size={32}/>
          </div>
      </div>

      <div className="bg-white dark:bg-zinc-900 rounded-[2.5rem] border border-slate-100 dark:border-zinc-800 overflow-hidden shadow-sm transition-colors">
          <div className="p-6 border-b dark:border-zinc-800 flex justify-between items-center">
              <h3 className="text-xs font-black uppercase italic dark:text-white">Extrato Consolidado</h3>
              <div className="flex gap-2">
                  <select className="bg-slate-50 dark:bg-zinc-800 p-2 rounded-xl text-[9px] font-black uppercase border-none outline-none dark:text-white" value={filterMonth} onChange={e => setFilterMonth(Number(e.target.value))}>
                      {Array.from({length: 12}).map((_, i) => <option key={i+1} value={i+1}>{new Date(2000, i).toLocaleString('pt-BR', {month: 'long'}).toUpperCase()}</option>)}
                  </select>
                  <select className="bg-slate-50 dark:bg-zinc-800 p-2 rounded-xl text-[9px] font-black uppercase border-none outline-none dark:text-white" value={filterYear} onChange={e => setFilterYear(Number(e.target.value))}>
                      {[2024, 2025].map(y => <option key={y} value={y}>{y}</option>)}
                  </select>
              </div>
          </div>
          <table className="w-full text-left text-[10px]">
              <thead className="bg-slate-50 dark:bg-zinc-800/50 text-slate-400 font-black uppercase">
                  <tr>
                      <th className="px-6 py-4">Data</th>
                      <th className="px-6 py-4">Entrada</th>
                      <th className="px-6 py-4">Intervalo</th>
                      <th className="px-6 py-4">Retorno</th>
                      <th className="px-6 py-4">Saída</th>
                      <th className="px-6 py-4 text-right">Jornada</th>
                  </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 dark:divide-zinc-800 transition-colors">
                  {isLoading ? (
                      <tr><td colSpan={6} className="p-10 text-center text-slate-300 font-black uppercase animate-pulse">Consultando registros no servidor...</td></tr>
                  ) : entries.filter(e => {
                      const d = new Date(e.date);
                      return (d.getMonth() + 1) === filterMonth && d.getFullYear() === filterYear;
                  }).sort((a,b) => b.date.localeCompare(a.date)).map(e => (
                      <tr key={e.id} className="hover:bg-slate-50 dark:hover:bg-zinc-800/30 transition-colors">
                          <td className="px-6 py-4 font-bold dark:text-zinc-300">{e.date.split('-').reverse().join('/')}</td>
                          <td className="px-6 py-4 dark:text-zinc-100 font-black">{e.clock_in}</td>
                          <td className="px-6 py-4 dark:text-zinc-400 italic">{e.break_start || '--:--'}</td>
                          <td className="px-6 py-4 dark:text-zinc-400 italic">{e.break_end || '--:--'}</td>
                          <td className="px-6 py-4 dark:text-zinc-100 font-black">{e.clock_out || '--:--'}</td>
                          <td className="px-6 py-4 text-right font-black text-indigo-500">
                            {(() => {
                                if (!e.clock_in || !e.clock_out) return '0.0h';
                                const parseTime = (t: string) => {
                                    const [h, m] = t.split(':').map(Number);
                                    return h + m / 60;
                                };
                                let dayHours = parseTime(e.clock_out) - parseTime(e.clock_in);
                                if (e.break_start && e.break_end) {
                                    dayHours -= (parseTime(e.break_end) - parseTime(e.break_start));
                                }
                                if (dayHours < 0) dayHours += 24;
                                return Math.max(0, dayHours).toFixed(1) + 'h';
                            })()}
                          </td>
                      </tr>
                  ))}
              </tbody>
          </table>
      </div>
    </div>
  );
};

export default TimeTrackingManager;
