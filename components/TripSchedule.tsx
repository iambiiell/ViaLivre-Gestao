
import React, { useState, useMemo, useEffect } from 'react';
import { Trip, BusRoute, User, Vehicle, TripStatus, TicketSale, UserFine } from '../types';
import { Clock, User as UserIcon, Bus, ArrowRight, Pencil, Plus, X, Save, Trash2, Calendar, Search, CheckCircle2, DollarSign, Users, Loader2, ShieldCheck, Copy, AlertTriangle, List, ShieldAlert, UserCheck, PlayCircle, Ticket, Hash, Printer, Ban } from 'lucide-react';
import { db } from '../services/database';

interface TripScheduleProps {
  trips: Trip[];
  routes: BusRoute[];
  drivers: User[];
  vehicles: Vehicle[];
  currentUser: User | null;
  onAddTrip: (trip: Trip) => void;
  onUpdateTrip: (trip: Trip) => void;
  onDeleteTrip: (id: string) => void;
  onSendSMS: (driverId: string, message: string) => void;
  addToast: (message: string, type?: 'success' | 'error' | 'warning') => void;
  userFines?: UserFine[];
}

const TripSchedule: React.FC<TripScheduleProps> = ({ 
  trips = [], 
  routes = [], 
  drivers = [], 
  vehicles = [], 
  companies = [],
  currentUser, 
  onAddTrip, 
  onUpdateTrip, 
  onDeleteTrip,
  onSendSMS,
  addToast,
  userFines = []
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [smsModal, setSmsModal] = useState<Trip | null>(null);
  const [smsMessage, setSmsMessage] = useState('');
  
  const getLocalDate = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };

  const [filterDate, setFilterDate] = useState<string>(getLocalDate());
  const [searchTerm, setSearchTerm] = useState('');
  const [filterRouteId, setFilterRouteId] = useState('');
  const [filterDirection, setFilterDirection] = useState<'IDA' | 'VOLTA' | ''>('');
  const [filterCompanyId, setFilterCompanyId] = useState<string>('');
  const [ignoreCompanyFilter, setIgnoreCompanyFilter] = useState(false);
  const [formData, setFormData] = useState<any>({
    selectedTimes: [] as { time: string; direction: 'IDA' | 'VOLTA' }[]
  });
  const [duplicateModal, setDuplicateModal] = useState<Trip | null>(null);
  const [turnstileModal, setTurnstileModal] = useState<{ trip: Trip; mode: 'start' | 'end' } | null>(null);
  const [turnstileValue, setTurnstileValue] = useState<number | ''>('');
  const [closureModal, setClosureModal] = useState<{ trip: Trip; paxCount: number; revenue: number } | null>(null);

  useEffect(() => {
    const handleCloseAll = () => {
      setIsModalOpen(false);
      setSmsModal(null);
      setDuplicateModal(null);
      setTurnstileModal(null);
      setClosureModal(null);
      setDeletingId(null);
    };
    window.addEventListener('close-all-modals', handleCloseAll);
    return () => window.removeEventListener('close-all-modals', handleCloseAll);
  }, []);

  const isOperationalRole = currentUser?.role === 'DRIVER' || currentUser?.role === 'CONDUCTOR' || currentUser?.role === 'FISCAL';

  // Improved sync with collaborators by checking multiple role indicators
  const availableFiscals = useMemo(() => drivers.filter(d => 
    d.role === 'FISCAL' || 
    d.role === 'ADMIN' || 
    (d.job_title || '').toLowerCase().includes('fiscal')
  ), [drivers]);

  const availableDrivers = useMemo(() => drivers.filter(d => 
    d.role === 'DRIVER' || 
    d.role === 'ADMIN' || 
    (d.job_title || '').toLowerCase().includes('motorista')
  ), [drivers]);

  const availableConductors = useMemo(() => drivers.filter(d => 
    d.role === 'CONDUCTOR' || 
    d.role === 'ADMIN' || 
    (d.job_title || '').toLowerCase().includes('cobrador')
  ), [drivers]);

  // Filtering data for the modal based on selected company
  const modalRoutes = useMemo(() => {
    const targetCompanyId = formData.company_id || filterCompanyId;
    const shouldIgnore = formData.ignore_company_filter ?? ignoreCompanyFilter;
    if (!targetCompanyId || shouldIgnore) return routes;
    return routes.filter(r => r.company_id === targetCompanyId);
  }, [routes, filterCompanyId, ignoreCompanyFilter, formData.company_id, formData.ignore_company_filter]);

  const modalVehicles = useMemo(() => {
    const targetCompanyId = formData.company_id || filterCompanyId;
    const shouldIgnore = formData.ignore_company_filter ?? ignoreCompanyFilter;
    if (!targetCompanyId || shouldIgnore) return vehicles;
    
    const targetCompany = companies.find(c => c.id === targetCompanyId);
    return vehicles.filter(v => 
      v.company_id === targetCompanyId || 
      (v.company_name && targetCompany && v.company_name === targetCompany.name)
    );
  }, [vehicles, filterCompanyId, ignoreCompanyFilter, formData.company_id, formData.ignore_company_filter, companies]);

  const modalDrivers = useMemo(() => {
    const targetCompanyId = formData.company_id || filterCompanyId;
    const shouldIgnore = formData.ignore_company_filter ?? ignoreCompanyFilter;
    if (!targetCompanyId || shouldIgnore) return availableDrivers;
    return availableDrivers.filter(d => d.company_id === targetCompanyId);
  }, [availableDrivers, filterCompanyId, ignoreCompanyFilter, formData.company_id, formData.ignore_company_filter]);

  const modalFiscals = useMemo(() => {
    const targetCompanyId = formData.company_id || filterCompanyId;
    const shouldIgnore = formData.ignore_company_filter ?? ignoreCompanyFilter;
    if (!targetCompanyId || shouldIgnore) return availableFiscals;
    return availableFiscals.filter(f => f.company_id === targetCompanyId);
  }, [availableFiscals, filterCompanyId, ignoreCompanyFilter, formData.company_id, formData.ignore_company_filter]);

  const modalConductors = useMemo(() => {
    const targetCompanyId = formData.company_id || filterCompanyId;
    const shouldIgnore = formData.ignore_company_filter ?? ignoreCompanyFilter;
    if (!targetCompanyId || shouldIgnore) return availableConductors;
    return availableConductors.filter(c => c.company_id === targetCompanyId);
  }, [availableConductors, filterCompanyId, ignoreCompanyFilter, formData.company_id, formData.ignore_company_filter]);

  const selectedRoute = useMemo(() => routes.find(r => r.id === formData.route_id), [formData.route_id, routes]);

  const availableScheduledTimes = useMemo(() => {
    if (!selectedRoute || !formData.trip_date || !selectedRoute.schedule) return [];
    const dateObj = new Date(formData.trip_date + 'T12:00:00');
    const day = dateObj.getDay();
    let times: { time: string; direction: 'IDA' | 'VOLTA' }[] = [];
    
    if (day === 0) times = [...(selectedRoute.schedule.sunday || [])];
    else if (day === 6) times = [...(selectedRoute.schedule.saturday || [])];
    else times = [...(selectedRoute.schedule.weekdays || [])];

    if (formData.direction) {
        times = times.filter(t => !t.direction || t.direction.toUpperCase() === formData.direction.toUpperCase());
    }

    // Sort times
    return times.sort((a,b) => (a.time || '00:00').localeCompare(b.time || '00:00'));
  }, [selectedRoute, formData.trip_date, formData.direction]);

  const handleToggleTime = (time: string, direction: 'IDA' | 'VOLTA') => {
      const currentSelected = formData.selectedTimes || [];
      const index = currentSelected.findIndex((t: any) => t.time === time && t.direction === direction);
      
      if (index > -1) {
          setFormData({ 
              ...formData, 
              selectedTimes: currentSelected.filter((_: any, i: number) => i !== index)
          });
      } else {
          setFormData({ 
              ...formData, 
              selectedTimes: [...currentSelected, { time, direction }]
          });
      }
  };

  const handleSave = async () => {
      const selectedTimes = formData.selectedTimes || [];
      const hasManualTime = formData.departure_time && formData.departure_time.trim().length > 0;
      
      const timesToRegister = [...selectedTimes];
      if (hasManualTime) {
          timesToRegister.push({ time: formData.departure_time, direction: formData.direction || 'IDA' });
      }

      if (!formData.route_id || !formData.driver_id || !formData.bus_number || timesToRegister.length === 0 || !formData.fiscal_id || !formData.trip_date) {
          addToast("Erro: Preencha Data, Itinerário, Motorista, Fiscal, Veículo e selecione ao menos um Horário.", "error"); 
          return;
      }
      
      const driver = availableDrivers.find(d => d.id === formData.driver_id);
      
      // Safety Check: 11h Rest Period
      if (driver && !editingId) {
          const lastTrip = trips
            .filter(t => t.driver_id === driver.id && t.finished)
            .sort((a,b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];
          
          if (lastTrip && lastTrip.actual_end_time) {
              const lastEnd = new Date(lastTrip.actual_end_time).getTime();
              const currentStart = new Date(formData.trip_date + 'T' + timesToRegister[0].time).getTime();
              const restHours = (currentStart - lastEnd) / (1000 * 60 * 60);
              
              if (restHours < 11) {
                  addToast(`SEGURANÇA: Motorista ${driver.full_name} ainda está em período de descanso (${restHours.toFixed(1)}h/11h).`, "error");
                  return;
              }
          }
      }

      // Safety Check: CNH Points
      if (driver) {
          const points = userFines
            .filter(f => f.user_id === driver.id && f.status !== 'RECURSO')
            .reduce((acc, f) => acc + (f.points || 0), 0);
          
          if (driver.cnh_limit && points >= driver.cnh_limit) {
              addToast(`MOTORISTA BLOQUEADO: Limite de pontos na CNH atingido (${points}/${driver.cnh_limit} pts).`, "error");
              return;
          }
      }

      const fiscal = availableFiscals.find(f => f.id === formData.fiscal_id);
      const conductor = availableConductors.find(c => c.id === formData.conductor_id);
      const route = routes.find(r => r.id === formData.route_id);
      
      const { selectedTimes: _st, departure_time: _dt, ...cleanFormData } = formData;
      const basePayload = { 
          ...cleanFormData, 
          driver_name: driver?.full_name || driver?.name || 'Desconhecido',
          fiscal_name: fiscal?.full_name || fiscal?.name || 'Não atribuído',
          conductor_name: conductor?.full_name || conductor?.name || 'Não atribuído'
      };

      if (editingId) {
          const time = timesToRegister[0];
          onUpdateTrip({ ...basePayload, id: editingId, departure_time: time.time, direction: time.direction });
          const msg = `ALTERAÇÃO URGENTE: Sua viagem de ${formData.trip_date} às ${time.time} (${route?.origin} x ${route?.destination}) foi alterada. Verifique o sistema.`;
          onSendSMS(formData.driver_id, msg);
      } else {
          for (let i = 0; i < timesToRegister.length; i++) {
            const slot = timesToRegister[i];
            const newId = `trip-${Date.now()}-${i}-${Math.random().toString(36).substr(2, 5)}`;
            await (onAddTrip as any)({ 
              ...basePayload, 
              trip_date: formData.trip_date, 
              departure_time: slot.time,
              direction: slot.direction,
              id: newId
            });

            // Reconciliation logic for presale tickets
            try {
              const allSales = await db.getSales();
              const presaleTickets = allSales.filter(s => 
                s.is_presale && 
                s.route_id === formData.route_id && 
                s.trip_date === formData.trip_date && 
                s.departure_time === slot.time &&
                s.direction === (slot.direction || 'IDA')
              );

              if (presaleTickets.length > 0) {
                const vehicle = vehicles.find(v => v.bus_number === formData.bus_number);
                for (const ticket of presaleTickets) {
                  await db.update('ticket_sales', {
                    ...ticket,
                    trip_id: newId,
                    is_presale: false,
                    vehicle_model: vehicle?.model || '',
                    vehicle_prefix: vehicle?.prefix || ''
                  } as any);
                }
              }
            } catch (error) {
              console.error("Erro na reconciliação de pré-vendas:", error);
            }

            const msg = `NOVA PROGRAMAÇÃO: Você foi escalado para a viagem de ${formData.trip_date} às ${slot.time} (${route?.origin} x ${route?.destination}).`;
            onSendSMS(formData.driver_id, msg);
          }
          addToast(`${timesToRegister.length} viagens criadas com sucesso!`, 'success');
      }
      setIsModalOpen(false);
  };

  const handleDuplicateConfirm = (trip: Trip, mode: 'manual' | 'auto' | 'week') => {
    if (mode === 'manual') {
      setEditingId(null);
      setFormData({ 
        ...trip, 
        id: undefined, 
        status: 'Agendada', 
        departure_time: trip.departure_time,
        passengers: { default: { pagantes: 0, vale_transporte: 0, imp_card: 0, gratuitos: 0 } }
      });
      setDuplicateModal(null);
      setIsModalOpen(true);
    } else if (mode === 'auto') {
      const newTrip = { 
        ...trip, 
        id: `trip-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
        status: 'Agendada' as TripStatus,
        passengers: { default: { pagantes: 0, vale_transporte: 0, imp_card: 0, gratuitos: 0 } },
        actual_start_time: undefined,
        actual_end_time: undefined,
        finished: false
      };
      onAddTrip(newTrip);
      setDuplicateModal(null);
    } else if (mode === 'week') {
      // Duplicate for next 7 days
      const baseDate = new Date(trip.trip_date + 'T12:00:00');
      for (let i = 1; i <= 7; i++) {
        const nextDate = new Date(baseDate);
        nextDate.setDate(baseDate.getDate() + i);
        const dateStr = nextDate.toISOString().split('T')[0];
        
        const newTrip = { 
          ...trip, 
          id: `trip-${Date.now()}-${i}-${Math.random().toString(36).substr(2, 5)}`,
          trip_date: dateStr,
          status: 'Agendada' as TripStatus,
          passengers: { default: { pagantes: 0, vale_transporte: 0, imp_card: 0, gratuitos: 0 } },
          actual_start_time: undefined,
          actual_end_time: undefined,
          finished: false
        };
        onAddTrip(newTrip);
      }
      setDuplicateModal(null);
    }
  };

  const handleTurnstileConfirm = () => {
    if (!turnstileModal || turnstileValue === '') return;
    
    const { trip, mode } = turnstileModal;
    const value = Number(turnstileValue);
    
    if (mode === 'start') {
      onUpdateTrip({ 
        ...trip, 
        status: 'Em Rota', 
        actual_start_time: new Date().toISOString(),
        initial_turnstile: value
      });
      addToast(`Viagem iniciada! Catraca inicial: ${value}`);
    } else {
      const paxCount = value - (trip.initial_turnstile || 0);
      const route = routes.find(r => r.id === trip.route_id);
      const revenue = (paxCount >= 0 ? paxCount : 0) * (route?.price || 0);

      onUpdateTrip({ 
        ...trip, 
        status: 'Concluída', 
        actual_end_time: new Date().toISOString(),
        final_turnstile: value,
        finished: true
      });
      
      if (currentUser?.role === 'CONDUCTOR') {
          setClosureModal({ trip, paxCount: paxCount >= 0 ? paxCount : 0, revenue });
      } else {
          addToast(`Viagem concluída! Passageiros transportados: ${paxCount >= 0 ? paxCount : 0}`);
      }
    }
    setTurnstileModal(null);
    setTurnstileValue('');
  };

  const filteredTrips = useMemo(() => {
    return (trips || []).filter(t => {
      if (!t.trip_date) return false;
      const tDateOnly = t.trip_date.split('T')[0];
      const matchesDate = tDateOnly === filterDate;
      const matchesSearch = !searchTerm || (t.driver_name || '').toLowerCase().includes(searchTerm.toLowerCase());
      const matchesRoute = !filterRouteId || t.route_id === filterRouteId;
      const matchesDirection = !filterDirection || t.direction === filterDirection;
      return matchesDate && matchesSearch && matchesRoute && matchesDirection;
    }).sort((a,b) => {
      // Sort by direction first (IDA before VOLTA)
      const dirA = a.direction || 'IDA';
      const dirB = b.direction || 'IDA';
      if (dirA !== dirB) return dirA.localeCompare(dirB);
      
      // Then by time
      return (a.departure_time || '').localeCompare(b.departure_time || '');
    });
  }, [trips, filterDate, searchTerm, filterRouteId, filterDirection]);

  const displayItems = useMemo(() => {
    if (!filterRouteId) return filteredTrips.map(t => ({ type: 'trip', data: t }));

    const route = routes.find(r => r.id === filterRouteId);
    if (!route) return filteredTrips.map(t => ({ type: 'trip', data: t }));

    const dateObj = new Date(filterDate + 'T12:00:00');
    const day = dateObj.getDay();
    let scheduleTimes: { time: string; direction: 'IDA' | 'VOLTA' }[] = [];
    
    if (day === 0) scheduleTimes = route.schedule.sunday || [];
    else if (day === 6) scheduleTimes = route.schedule.saturday || [];
    else scheduleTimes = route.schedule.weekdays || [];

    if (filterDirection) {
        scheduleTimes = scheduleTimes.filter(t => !t.direction || t.direction.toUpperCase() === filterDirection.toUpperCase());
    }

    // Merge with existing trips
    const items: any[] = [];
    const usedTrips = new Set<string>();

    scheduleTimes.forEach(slot => {
        const existingTrip = filteredTrips.find(t => 
            t.departure_time === slot.time && 
            t.direction === slot.direction &&
            !usedTrips.has(t.id)
        );

        if (existingTrip) {
            items.push({ type: 'trip', data: existingTrip });
            usedTrips.add(existingTrip.id);
        } else {
            items.push({ type: 'slot', data: slot });
        }
    });

    // Add remaining trips that didn't match a slot (extra trips)
    filteredTrips.forEach(t => {
        if (!usedTrips.has(t.id)) {
            items.push({ type: 'trip', data: t });
        }
    });

    // Sort items
    return items.sort((a, b) => {
        // Sort by direction first
        const dirA = a.type === 'trip' ? (a.data.direction || 'IDA') : (a.data.direction || 'IDA');
        const dirB = b.type === 'trip' ? (b.data.direction || 'IDA') : (b.data.direction || 'IDA');
        if (dirA !== dirB) return dirA.localeCompare(dirB);

        const timeA = a.type === 'trip' ? a.data.departure_time : a.data.time;
        const timeB = b.type === 'trip' ? b.data.departure_time : b.data.time;
        return timeA.localeCompare(timeB);
    });

  }, [filteredTrips, filterRouteId, filterDirection, filterDate, routes]);

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-32 transition-colors">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 bg-white dark:bg-zinc-900 p-8 rounded-[2.5rem] shadow-sm border border-slate-100 dark:border-zinc-800 transition-colors">
          <div className="flex-1 w-full">
              <h2 className="text-3xl font-black text-slate-900 dark:text-zinc-100 uppercase italic tracking-tighter transition-colors">Escala Diária</h2>
              <div className="mt-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 transition-colors">
                  <div className="col-span-full bg-slate-50 dark:bg-zinc-800/50 p-4 rounded-3xl border border-slate-100 dark:border-zinc-800 flex flex-col sm:flex-row gap-4 items-center">
                    <div className="flex-1 w-full">
                      <label className="block text-[8px] font-black text-slate-400 uppercase mb-1 ml-2">Filtrar por Empresa</label>
                      <select 
                        value={filterCompanyId || ''} 
                        onChange={e => setFilterCompanyId(e.target.value)}
                        className="w-full pl-4 pr-8 py-3 bg-white dark:bg-zinc-900 rounded-2xl text-xs font-black dark:text-zinc-100 border-none shadow-sm outline-none"
                      >
                        <option value="">Todas as Empresas</option>
                        {companies.map(c => <option key={c.id} value={c.id}>{c.nome_fantasia || c.name}</option>)}
                      </select>
                    </div>
                    <div className="flex items-center gap-3 px-4 py-3 bg-white dark:bg-zinc-900 rounded-2xl shadow-sm self-stretch sm:self-end">
                      <input 
                        type="checkbox" 
                        id="ignore-company"
                        checked={ignoreCompanyFilter}
                        onChange={e => setIgnoreCompanyFilter(e.target.checked)}
                        className="w-4 h-4 rounded border-slate-300 text-yellow-400 focus:ring-yellow-400"
                      />
                      <label htmlFor="ignore-company" className="text-[9px] font-black uppercase text-slate-500 cursor-pointer">Liberar Filtros (Ignorar Empresa)</label>
                    </div>
                  </div>
                  <div className="relative">
                      <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                      <input type="text" placeholder="Buscar motorista..." value={searchTerm || ''} onChange={e => setSearchTerm(e.target.value)} className="w-full pl-12 pr-4 py-4 bg-slate-50 dark:bg-zinc-800 rounded-2xl text-sm font-bold outline-none dark:text-zinc-100 border-none shadow-inner" />
                  </div>
                  <select 
                    value={filterRouteId || ''} 
                    onChange={e => setFilterRouteId(e.target.value)}
                    className="pl-4 pr-8 py-4 bg-slate-50 dark:bg-zinc-800 rounded-2xl text-sm font-bold dark:text-zinc-100 border-none shadow-inner outline-none"
                  >
                    <option value="">Todas as Rotas</option>
                    {(filterCompanyId && !ignoreCompanyFilter ? routes.filter(r => r.company_id === filterCompanyId) : routes).map(r => <option key={r.id} value={r.id}>{r.prefixo_linha} - {r.origin} x {r.destination}</option>)}
                  </select>
                  <select 
                    value={filterDirection || ''} 
                    onChange={e => setFilterDirection(e.target.value as any)}
                    className="pl-4 pr-8 py-4 bg-slate-50 dark:bg-zinc-800 rounded-2xl text-sm font-bold dark:text-zinc-100 border-none shadow-inner outline-none"
                  >
                    <option value="">Todos Sentidos</option>
                    <option value="IDA">IDA</option>
                    <option value="VOLTA">VOLTA</option>
                  </select>
                  <input type="date" className="pl-6 pr-4 py-4 bg-slate-50 dark:bg-zinc-900 rounded-2xl text-sm font-bold dark:text-zinc-100 border-none shadow-inner" value={filterDate || ''} onChange={(e) => setFilterDate(e.target.value)} />
              </div>
          </div>
          <button onClick={() => { setEditingId(null); setFormData({ trip_date: filterDate, status: 'Agendada', departure_time: '00:00', company_id: filterCompanyId, ignore_company_filter: ignoreCompanyFilter, passengers: { default: { pagantes: 0, vale_transporte: 0, imp_card: 0, gratuitos: 0 } } }); setIsModalOpen(true); }} className="w-full md:w-auto px-10 py-5 bg-yellow-400 text-slate-900 rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl flex items-center justify-center gap-2 active:scale-95 transition-all border-2 border-slate-900"><Plus size={20} /> Adicionar Programação</button>
      </div>

      <div className="flex overflow-x-auto pb-6 gap-6 snap-x snap-mandatory md:grid md:grid-cols-1 xl:grid-cols-2 md:overflow-x-visible md:pb-0 md:snap-none custom-scrollbar">
          {displayItems.map((item, idx) => {
            if (item.type === 'slot') {
                const slot = item.data;
                return (
                    <div key={`slot-${idx}`} className="min-w-[280px] sm:min-w-[320px] md:min-w-0 snap-center flex-1">
                        <div className="bg-slate-50 dark:bg-zinc-900/50 rounded-[2.5rem] border-2 border-dashed border-slate-200 dark:border-zinc-800 p-6 flex items-center justify-between opacity-70 hover:opacity-100 transition-all h-full">
                            <div className="flex items-center gap-4">
                                <span className="bg-slate-200 dark:bg-zinc-800 text-slate-400 font-mono font-black text-xl px-5 py-3 rounded-2xl">{slot.time}</span>
                                <div>
                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Horário Disponível</span>
                                    <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded ${slot.direction === 'IDA' ? 'bg-emerald-100 text-emerald-600' : 'bg-blue-100 text-blue-600'}`}>{slot.direction}</span>
                                </div>
                            </div>
                            <button 
                                onClick={() => { 
                                    setEditingId(null); 
                                    setFormData({ 
                                        trip_date: filterDate, 
                                        status: 'Agendada', 
                                        departure_time: slot.time, 
                                        direction: slot.direction,
                                        route_id: filterRouteId,
                                        passengers: { default: { pagantes: 0, vale_transporte: 0, imp_card: 0, gratuitos: 0 } } 
                                    }); 
                                    setIsModalOpen(true); 
                                }} 
                                className="p-3 bg-yellow-400 text-slate-900 rounded-xl shadow-lg active:scale-95 transition-all"
                            >
                                <Plus size={20}/>
                            </button>
                        </div>
                    </div>
                );
            }

            const trip = item.data;
            const route = routes.find(r => r.id === trip.route_id);
            return (
              <div key={trip.id} className="min-w-[280px] sm:min-w-[320px] md:min-w-0 snap-center flex-1">
                <div className="bg-white dark:bg-zinc-900 rounded-[2.5rem] border border-slate-100 dark:border-zinc-800 shadow-sm overflow-hidden hover:shadow-lg transition-all group h-full flex flex-col">
                  <div className="p-6 transition-colors flex-1 flex flex-col">
                    <div className="flex justify-between items-center mb-6">
                      <div className="flex items-center gap-4">
                        <span className="bg-slate-900 dark:bg-zinc-950 text-yellow-400 font-mono font-black text-2xl px-5 py-3 rounded-2xl border-2 border-slate-800 transition-colors shrink-0">{trip.departure_time}</span>
                        <div className="min-w-0">
                          <span className="text-[10px] font-black text-slate-400 dark:text-zinc-500 uppercase tracking-widest block mb-1 break-words whitespace-normal">Linha {route?.prefixo_linha} - {route?.origin} x {route?.destination}</span>
                          <div className={`text-[10px] font-black uppercase px-3 py-1 rounded-full inline-block transition-colors ${trip.status === 'Agendada' ? 'bg-slate-50 dark:bg-zinc-800 text-slate-500' : 'bg-yellow-50 text-yellow-600 animate-pulse'}`}>{trip.status}</div>
                        </div>
                      </div>
                      <div className="flex gap-2 items-center">
                           {isOperationalRole && (
                             <>
                               {trip.status === 'Agendada' && (
                                 <button 
                                   onClick={() => {
                                     const route = routes.find(r => r.id === trip.route_id);
                                     if (route?.route_type === 'URBANO') {
                                       setTurnstileModal({ trip, mode: 'start' });
                                       setTurnstileValue(trip.initial_turnstile || '');
                                     } else {
                                       onUpdateTrip({ ...trip, status: 'Em Rota', actual_start_time: new Date().toISOString() });
                                       addToast("Viagem iniciada!");
                                     }
                                   }}
                                   className="px-4 py-2 bg-emerald-500 text-white text-[9px] font-black uppercase rounded-xl shadow-lg active:scale-95 flex items-center gap-2"
                                 >
                                   <PlayCircle size={14}/> Iniciar
                                 </button>
                               )}

                               {trip.status === 'Em Rota' && (
                                 <>
                                   <button 
                                     onClick={() => {
                                       const route = routes.find(r => r.id === trip.route_id);
                                       if (route?.route_type === 'URBANO') {
                                         setTurnstileModal({ trip, mode: 'end' });
                                         setTurnstileValue(trip.final_turnstile || '');
                                       } else {
                                         onUpdateTrip({ ...trip, status: 'Concluída', actual_end_time: new Date().toISOString() });
                                         addToast("Viagem concluída!");
                                       }
                                     }}
                                     className="px-4 py-2 bg-indigo-600 text-white text-[9px] font-black uppercase rounded-xl shadow-lg active:scale-95 flex items-center gap-2"
                                   >
                                     <CheckCircle2 size={14}/> Finalizar
                                   </button>
                                   <button 
                                      onClick={() => {
                                          const ev = new CustomEvent('change-view', { detail: 'ticketing' }) as any;
                                          ev.metadata = { trip_id: trip.id };
                                          window.dispatchEvent(ev);
                                      }}
                                      className="px-4 py-2 bg-yellow-400 text-slate-900 text-[9px] font-black uppercase rounded-xl shadow-lg active:scale-95 flex items-center gap-2 border border-slate-900"
                                   >
                                      <Ticket size={14}/> Vender
                                   </button>
                                 </>
                               )}
                             </>
                           )}

                           {(currentUser?.role === 'ADMIN' || currentUser?.role === 'FISCAL' || isOperationalRole) && (
                             <>
                               <button 
                                 onClick={() => {
                                   const msg = `ALERTA DE VIAGEM: Sua viagem de ${trip.trip_date} às ${trip.departure_time} (${route?.origin} x ${route?.destination}) está confirmada.`;
                                   setSmsMessage(msg);
                                   setSmsModal(trip);
                                 }} 
                                 title="Enviar Alerta SMS" 
                                 className="p-3 text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/10 rounded-xl transition-all"
                               >
                                 <ShieldAlert size={20}/>
                               </button>
                               <button onClick={() => setDuplicateModal(trip)} title="Duplicar Programação" className="p-3 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/10 rounded-xl transition-all"><Copy size={20}/></button>
                               <button onClick={() => { setEditingId(trip.id); setFormData({ ...trip, selectedTimes: [{ time: trip.departure_time, direction: trip.direction || 'IDA' }] }); setIsModalOpen(true); }} className="p-3 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/10 rounded-xl transition-all"><Pencil size={20}/></button>
                               
                               {deletingId === trip.id ? (
                                 <div className="flex gap-1 animate-in fade-in slide-in-from-right-2">
                                   <button 
                                     onClick={() => { onDeleteTrip(trip.id); setDeletingId(null); }} 
                                     className="px-2 py-2 bg-red-600 text-white text-[8px] font-black uppercase rounded-lg shadow-lg active:scale-95 transition-all"
                                   >
                                     Sim
                                   </button>
                                   <button 
                                     onClick={() => setDeletingId(null)} 
                                     className="px-2 py-2 bg-slate-100 dark:bg-zinc-800 text-slate-500 dark:text-zinc-400 text-[8px] font-black uppercase rounded-lg hover:bg-slate-200 transition-all"
                                   >
                                     Não
                                   </button>
                                 </div>
                               ) : (
                                 <button 
                                   onClick={() => setDeletingId(trip.id)} 
                                   className="p-3 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/10 rounded-xl transition-all"
                                   title="Excluir Programação"
                                 >
                                   <Trash2 size={20}/>
                                 </button>
                               )}
                             </>
                           )}
                      </div>
                    </div>
                    <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2 text-[10px] font-black text-slate-400 border-t dark:border-zinc-800 pt-4 transition-colors mt-auto">
                        <div className="flex items-center gap-2 font-bold dark:text-zinc-300">
                          <span className={`px-2 py-0.5 rounded text-[8px] ${trip.direction === 'IDA' ? 'bg-emerald-100 text-emerald-600' : 'bg-blue-100 text-blue-600'}`}>
                            {trip.direction || 'IDA'}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 font-bold dark:text-zinc-300"><UserIcon size={14} className="text-indigo-500"/> <span className="text-slate-400 uppercase mr-1">Motorista:</span> {trip.driver_name}</div>
                        {trip.conductor_name && trip.conductor_name !== 'Não atribuído' && (
                          <div className="flex items-center gap-2 font-bold dark:text-zinc-300"><Users size={14} className="text-amber-500"/> <span className="text-slate-400 uppercase mr-1">Cobrador:</span> {trip.conductor_name}</div>
                        )}
                        <div className="flex items-center gap-2 font-bold dark:text-zinc-300"><UserCheck size={14} className="text-emerald-500"/> <span className="text-slate-400 uppercase mr-1">Fiscal:</span> {trip.fiscal_name}</div>
                        <div className="text-indigo-500 font-black bg-indigo-50 dark:bg-indigo-900/20 px-3 py-1 rounded-lg">Veículo {trip.bus_number}</div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
      </div>

      {smsModal && (
          <div className="fixed inset-0 bg-slate-900/60 dark:bg-black/70 z-[150] flex items-center justify-center p-4 backdrop-blur-md">
              <div className="bg-white dark:bg-zinc-900 w-full max-w-md rounded-[3rem] p-8 border-4 border-amber-400 shadow-2xl max-h-[90vh] overflow-y-auto custom-scrollbar">
                  <div className="w-16 h-16 bg-amber-400 rounded-3xl mx-auto mb-6 flex items-center justify-center shadow-lg border-2 border-slate-900">
                      <ShieldAlert size={32} className="text-slate-900" />
                  </div>
                  <h3 className="text-xl font-black uppercase italic dark:text-white mb-2 text-center">Enviar Alerta SMS</h3>
                  <p className="text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-6 text-center">Notificar motorista {smsModal.driver_name}</p>
                  
                  <textarea 
                    className="w-full p-4 bg-slate-50 dark:bg-zinc-800 rounded-2xl border-none text-xs font-bold dark:text-white outline-none focus:ring-2 ring-amber-400 mb-6 resize-none"
                    rows={4}
                    value={smsMessage || ''}
                    onChange={e => setSmsMessage(e.target.value)}
                  />

                  <div className="flex flex-col gap-3">
                      <button 
                        onClick={() => {
                          onSendSMS(smsModal.driver_id, smsMessage);
                          setSmsModal(null);
                        }} 
                        className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl active:scale-95 transition-all"
                      >
                        Enviar Agora
                      </button>
                      <button onClick={() => setSmsModal(null)} className="w-full py-2 text-slate-400 font-black uppercase text-[10px]">Cancelar</button>
                  </div>
              </div>
          </div>
      )}

      {duplicateModal && (
          <div className="fixed inset-0 bg-slate-900/60 dark:bg-black/70 z-[150] flex items-center justify-center p-4 backdrop-blur-md">
              <div className="bg-white dark:bg-zinc-900 w-full max-w-sm rounded-[3rem] p-8 border-4 border-yellow-400 shadow-2xl text-center max-h-[90vh] overflow-y-auto custom-scrollbar">
                  <div className="w-16 h-16 bg-yellow-400 rounded-3xl mx-auto mb-6 flex items-center justify-center shadow-lg border-2 border-slate-900">
                      <Copy size={32} className="text-slate-900" />
                  </div>
                  <h3 className="text-xl font-black uppercase italic dark:text-white mb-2">Duplicar Escala</h3>
                  <p className="text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-8">Deseja manter os mesmos dados ou realizar alterações?</p>
                  <div className="flex flex-col gap-3">
                      <button onClick={() => handleDuplicateConfirm(duplicateModal, 'auto')} className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl active:scale-95 transition-all">Manter Todos os Dados</button>
                      <button onClick={() => handleDuplicateConfirm(duplicateModal, 'manual')} className="w-full py-4 bg-yellow-400 text-slate-900 rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl border-2 border-slate-900 active:scale-95 transition-all">Alterar Dados Manuais</button>
                      <button onClick={() => handleDuplicateConfirm(duplicateModal, 'week')} className="w-full py-4 bg-emerald-500 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl active:scale-95 transition-all flex items-center justify-center gap-2"><Calendar size={16}/> Replicar para Próximos 7 Dias</button>
                      <button onClick={() => setDuplicateModal(null)} className="w-full py-2 text-slate-400 font-black uppercase text-[10px]">Cancelar</button>
                  </div>
              </div>
          </div>
      )}

      {turnstileModal && (
          <div className="fixed inset-0 bg-slate-900/60 dark:bg-black/70 z-[200] flex items-center justify-center p-4 backdrop-blur-md">
              <div className="bg-white dark:bg-zinc-900 w-full max-w-sm rounded-[3rem] p-8 border-4 border-indigo-400 shadow-2xl text-center">
                  <div className="w-16 h-16 bg-indigo-400 rounded-3xl mx-auto mb-6 flex items-center justify-center shadow-lg border-2 border-slate-900 text-slate-900">
                      <Hash size={32} />
                  </div>
                  <h3 className="text-xl font-black uppercase italic dark:text-white mb-2">Controle de Catraca</h3>
                  <p className="text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-8">
                    {turnstileModal.mode === 'start' ? 'Informe a contagem inicial da catraca' : 'Informe a contagem final da catraca'}
                  </p>
                  
                  <input 
                    type="number" 
                    className="w-full px-6 py-4 bg-slate-50 dark:bg-zinc-800 rounded-2xl border-2 border-slate-100 dark:border-zinc-700 font-black text-center text-2xl mb-6 dark:text-white"
                    placeholder="000000"
                    value={turnstileValue}
                    onChange={e => setTurnstileValue(e.target.value)}
                  />

                  <div className="flex flex-col gap-3">
                      <button 
                        onClick={handleTurnstileConfirm} 
                        disabled={turnstileValue === ''}
                        className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl active:scale-95 transition-all disabled:opacity-50"
                      >
                        {turnstileModal.mode === 'start' ? 'Confirmar Início' : 'Confirmar Encerramento'}
                      </button>
                      <button onClick={() => setTurnstileModal(null)} className="w-full py-2 text-slate-400 font-black uppercase text-[10px]">Cancelar</button>
                  </div>
              </div>
          </div>
      )}

      {closureModal && (
          <div className="fixed inset-0 bg-slate-900/60 dark:bg-black/70 z-[250] flex items-center justify-center p-4 backdrop-blur-md">
              <div className="bg-white dark:bg-zinc-900 w-full max-w-md rounded-[3rem] p-10 border-4 border-emerald-400 shadow-2xl text-center">
                  <div className="w-20 h-20 bg-emerald-400 rounded-3xl mx-auto mb-8 flex items-center justify-center shadow-lg border-2 border-slate-900 text-slate-900">
                      <DollarSign size={40} />
                  </div>
                  <h3 className="text-2xl font-black uppercase italic dark:text-white mb-2">Fechamento de Viagem</h3>
                  <p className="text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-10">Resumo operacional da jornada</p>
                  
                  <div className="grid grid-cols-2 gap-4 mb-10">
                      <div className="bg-slate-50 dark:bg-zinc-800 p-6 rounded-3xl border-2 border-slate-100 dark:border-zinc-700">
                          <p className="text-[9px] font-black text-slate-400 uppercase mb-2">Passageiros</p>
                          <p className="text-2xl font-black dark:text-white">{closureModal.paxCount}</p>
                      </div>
                      <div className="bg-slate-50 dark:bg-zinc-800 p-6 rounded-3xl border-2 border-slate-100 dark:border-zinc-700">
                          <p className="text-[9px] font-black text-slate-400 uppercase mb-2">Receita Est.</p>
                          <p className="text-2xl font-black dark:text-white">R$ {closureModal.revenue.toFixed(2)}</p>
                      </div>
                      <div className="col-span-full bg-slate-900 dark:bg-zinc-950 p-6 rounded-3xl text-emerald-400 border-2 border-slate-800">
                          <p className="text-[9px] font-black uppercase mb-2 opacity-50">Diferença de Catraca</p>
                          <p className="text-sm font-black">{closureModal.trip.initial_turnstile} <ArrowRight size={14} className="inline mx-2"/> {closureModal.trip.final_turnstile}</p>
                      </div>
                  </div>

                  <div className="flex flex-col gap-3">
                      <button 
                        onClick={() => setClosureModal(null)} 
                        className="w-full py-5 bg-slate-900 text-white rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl active:scale-95 transition-all"
                      >
                        Confirmar e Sincronizar
                      </button>
                      <button onClick={() => window.print()} className="w-full py-2 text-slate-400 font-black uppercase text-[10px] flex items-center justify-center gap-2">
                          <Printer size={16}/> Imprimir Comprovante
                      </button>
                  </div>
              </div>
          </div>
      )}

      {isModalOpen && (
          <div className="fixed inset-0 bg-slate-900/60 dark:bg-black/70 z-[120] flex items-center justify-center p-4 backdrop-blur-md transition-colors">
              <div className="bg-white dark:bg-zinc-950 w-full max-w-xl rounded-[3rem] shadow-2xl flex flex-col max-h-[92vh] border dark:border-zinc-800 overflow-hidden transition-colors">
                  <div className="p-8 border-b dark:border-zinc-800 bg-slate-50 dark:bg-zinc-900 flex justify-between items-center transition-colors">
                      <h3 className="text-xl font-black text-slate-900 dark:text-zinc-100 uppercase italic transition-colors">Configurar Escala</h3>
                      <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:rotate-90 transition-transform"><X size={32}/></button>
                  </div>
                  <div className="p-8 space-y-6 overflow-y-auto custom-scrollbar flex-1 bg-white dark:bg-zinc-950 transition-colors">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 transition-colors">
                          <div className="col-span-full bg-slate-50 dark:bg-zinc-900 p-6 rounded-3xl border border-slate-100 dark:border-zinc-800 space-y-4">
                              <div>
                                  <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-2 transition-colors">Empresa para Consulta *</label>
                                  <select 
                                      className="w-full px-5 py-4 border-2 border-slate-100 dark:border-zinc-800 rounded-2xl font-bold bg-white dark:bg-zinc-950 dark:text-zinc-100 shadow-sm outline-none"
                                      value={formData.company_id || ''}
                                      onChange={e => {
                                          const newCompanyId = e.target.value;
                                          setFormData({
                                              ...formData,
                                              company_id: newCompanyId,
                                              route_id: '',
                                              route_search: '',
                                              bus_number: '',
                                              bus_search: '',
                                              fiscal_id: '',
                                              fiscal_search: '',
                                              driver_id: '',
                                              driver_search: '',
                                              conductor_id: '',
                                              conductor_search: '',
                                              departure_time: '00:00',
                                              direction: ''
                                          });
                                      }}
                                  >
                                      <option value="">Todas as Empresas</option>
                                      {companies.map(c => <option key={c.id} value={c.id}>{c.nome_fantasia || c.name}</option>)}
                                  </select>
                              </div>
                              <div className="flex items-center gap-3 px-4 py-2">
                                  <input 
                                      type="checkbox" 
                                      id="modal-ignore-company"
                                      checked={formData.ignore_company_filter || false}
                                      onChange={e => setFormData({...formData, ignore_company_filter: e.target.checked})}
                                      className="w-4 h-4 rounded border-slate-300 text-yellow-400 focus:ring-yellow-400"
                                  />
                                  <label htmlFor="modal-ignore-company" className="text-[10px] font-black uppercase text-slate-500 cursor-pointer">Consultar todos os cadastros (Ignorar Empresa)</label>
                              </div>
                          </div>

                          <div className="col-span-full">
                              <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-2 transition-colors">Data da Operação *</label>
                              <input type="date" className="w-full px-5 py-4 border-2 border-slate-100 dark:border-zinc-800 rounded-2xl font-bold bg-slate-50 dark:bg-zinc-900 dark:text-zinc-100 shadow-inner" value={formData.trip_date || ''} onChange={e => setFormData({...formData, trip_date: e.target.value})} />
                          </div>

                          <div className="col-span-full">
                              <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-2 transition-colors">Itinerário (Linha) *</label>
                              <div className="relative">
                                  <input 
                                      type="text"
                                      className="w-full px-5 py-4 border-2 border-slate-100 dark:border-zinc-800 rounded-2xl font-bold bg-slate-50 dark:bg-zinc-900 dark:text-zinc-100 transition-colors shadow-inner uppercase"
                                      placeholder="Busque por linha ou destino..."
                                      value={routes.find(r => r.id === formData.route_id)?.prefixo_linha ? `${routes.find(r => r.id === formData.route_id)?.prefixo_linha} - ${routes.find(r => r.id === formData.route_id)?.origin} x ${routes.find(r => r.id === formData.route_id)?.destination}` : (formData.route_search || '') || ''}
                                      onChange={e => {
                                          const val = e.target.value.toUpperCase();
                                          setFormData({...formData, route_search: val, route_id: ''});
                                      }}
                                  />
                                  {modalRoutes && formData.route_search && !formData.route_id && (
                                      <div className="absolute z-[200] w-full mt-2 bg-white dark:bg-zinc-900 border-2 border-slate-100 dark:border-zinc-800 rounded-2xl shadow-2xl max-h-48 overflow-y-auto custom-scrollbar">
                                          {modalRoutes.filter(r => 
                                              r.prefixo_linha.includes(formData.route_search) || 
                                              r.origin.toUpperCase().includes(formData.route_search) || 
                                              r.destination.toUpperCase().includes(formData.route_search)
                                          ).map(r => (
                                              <button key={r.id} onClick={() => setFormData({...formData, route_id: r.id, route_search: ''})} className="w-full px-6 py-4 text-left hover:bg-yellow-50 dark:hover:bg-yellow-900/10 border-b dark:border-zinc-800 last:border-0 transition-colors">
                                                  <p className="text-xs font-black dark:text-white uppercase">{r.prefixo_linha} - {r.origin} x {r.destination}</p>
                                              </button>
                                          ))}
                                      </div>
                                  )}
                              </div>

                              <div className="grid grid-cols-3 gap-2 mt-4">
                                  <button 
                                      type="button" 
                                      onClick={() => setFormData({...formData, direction: ''})}
                                      className={`py-3 rounded-2xl font-black text-[10px] uppercase border-2 transition-all ${!formData.direction ? 'bg-slate-900 border-slate-950 text-white shadow-lg' : 'bg-white dark:bg-zinc-800 border-slate-100 dark:border-zinc-700 text-slate-400'}`}
                                  >
                                      TODOS
                                  </button>
                                  <button 
                                      type="button" 
                                      onClick={() => setFormData({...formData, direction: 'IDA'})}
                                      className={`py-3 rounded-2xl font-black text-[10px] uppercase border-2 transition-all ${formData.direction === 'IDA' ? 'bg-emerald-500 border-emerald-600 text-white shadow-lg' : 'bg-white dark:bg-zinc-800 border-slate-100 dark:border-zinc-700 text-slate-400'}`}
                                  >
                                      IDA
                                  </button>
                                  <button 
                                      type="button" 
                                      onClick={() => setFormData({...formData, direction: 'VOLTA'})}
                                      className={`py-3 rounded-2xl font-black text-[10px] uppercase border-2 transition-all ${formData.direction === 'VOLTA' ? 'bg-blue-500 border-blue-600 text-white shadow-lg' : 'bg-white dark:bg-zinc-800 border-slate-100 dark:border-zinc-700 text-slate-400'}`}
                                  >
                                      VOLTA
                                  </button>
                              </div>
                          </div>
                          
                          <div className="col-span-full transition-colors">
                              <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-2 transition-colors">Horário da Partida (Selecione um ou mais) *</label>
                              <div className="flex flex-wrap gap-2 mb-4">
                                  {availableScheduledTimes.map(item => {
                                      const isSelected = (formData.selectedTimes || []).some((t: any) => t.time === item.time && t.direction === item.direction);
                                      
                                      return (
                                          <button 
                                              key={`${item.time}-${item.direction}`} 
                                              type="button" 
                                              onClick={() => handleToggleTime(item.time, item.direction)} 
                                              className={`px-4 py-2 rounded-xl font-mono font-black text-xs border-2 transition-all relative flex flex-col items-center ${
                                                  isSelected ? 'bg-yellow-400 border-slate-900 text-slate-900 shadow-md scale-105' : 'bg-slate-50 dark:bg-zinc-800 border-slate-100 dark:border-zinc-700 dark:text-zinc-100 hover:bg-yellow-50'
                                              }`}
                                          >
                                              <span>{item.time}</span>
                                              <span className={`text-[7px] font-black uppercase ${isSelected ? 'text-slate-900/60' : (item.direction === 'IDA' ? 'text-emerald-500' : 'text-blue-500')}`}>{item.direction}</span>
                                          </button>
                                      );
                                  })}
                              </div>
                              <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-2 transition-colors">Ou digite um horário manual</label>
                              <input 
                                type="text" 
                                className="w-full px-5 py-4 border-2 border-slate-100 dark:border-zinc-800 rounded-2xl font-bold bg-slate-50 dark:bg-zinc-900 dark:text-zinc-100 shadow-inner" 
                                value={formData.departure_time || ''} 
                                placeholder="00:00"
                                onChange={e => setFormData({...formData, departure_time: e.target.value})}
                              />
                          </div>

                          <div className="transition-colors">
                              <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-2 transition-colors">Veículo *</label>
                              <div className="relative">
                                  <input 
                                      type="text"
                                      className="w-full px-5 py-4 border-2 border-slate-100 dark:border-zinc-800 rounded-2xl font-bold bg-slate-50 dark:bg-zinc-900 dark:text-zinc-100 transition-colors shadow-inner uppercase"
                                      placeholder="Busque por prefixo ou placa..."
                                      value={vehicles.find(v => v.prefix === formData.bus_number)?.prefix ? `#${vehicles.find(v => v.prefix === formData.bus_number)?.prefix} - ${vehicles.find(v => v.prefix === formData.bus_number)?.plate}` : (formData.bus_search || '')}
                                      onFocus={() => setFormData({...formData, bus_search: formData.bus_search || ' ', bus_number: ''})}
                                      onChange={e => {
                                          const val = e.target.value.toUpperCase();
                                          setFormData({...formData, bus_search: val, bus_number: ''});
                                      }}
                                  />
                                  {modalVehicles && formData.bus_search && !formData.bus_number && (
                                      <div className="absolute z-[200] w-full mt-2 bg-white dark:bg-zinc-900 border-2 border-slate-100 dark:border-zinc-800 rounded-2xl shadow-2xl max-h-48 overflow-y-auto custom-scrollbar">
                                          {modalVehicles.filter(v => 
                                              !formData.bus_search.trim() ||
                                              v.prefix.includes(formData.bus_search.trim()) || 
                                              v.plate.toUpperCase().includes(formData.bus_search.trim())
                                          ).map(v => (
                                              <button key={v.id} onClick={() => setFormData({...formData, bus_number: v.prefix, bus_search: ''})} className="w-full px-6 py-4 text-left hover:bg-yellow-50 dark:hover:bg-yellow-900/10 border-b dark:border-zinc-800 last:border-0 transition-colors">
                                                  <p className="text-xs font-black dark:text-white uppercase">#{v.prefix} - {v.plate}</p>
                                              </button>
                                          ))}
                                      </div>
                                  )}
                              </div>
                          </div>

                          <div className="transition-colors">
                              <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-2 transition-colors">Fiscal Responsável *</label>
                              <div className="relative">
                                  <input 
                                      type="text"
                                      className="w-full px-5 py-4 border-2 border-slate-100 dark:border-zinc-800 rounded-2xl font-bold bg-slate-50 dark:bg-zinc-900 dark:text-zinc-100 transition-colors shadow-inner uppercase"
                                      placeholder="Busque por nome..."
                                      value={availableFiscals.find(f => f.id === formData.fiscal_id)?.full_name ? availableFiscals.find(f => f.id === formData.fiscal_id)?.full_name : (formData.fiscal_search || '')}
                                      onFocus={() => setFormData({...formData, fiscal_search: formData.fiscal_search || ' ', fiscal_id: ''})}
                                      onChange={e => {
                                          const val = e.target.value.toUpperCase();
                                          setFormData({...formData, fiscal_search: val, fiscal_id: ''});
                                      }}
                                  />
                                  {modalFiscals && formData.fiscal_search && !formData.fiscal_id && (
                                      <div className="absolute z-[200] w-full mt-2 bg-white dark:bg-zinc-900 border-2 border-slate-100 dark:border-zinc-800 rounded-2xl shadow-2xl max-h-48 overflow-y-auto custom-scrollbar">
                                          {modalFiscals.filter(f => 
                                              !formData.fiscal_search.trim() ||
                                              (f.full_name || f.name || '').toUpperCase().includes(formData.fiscal_search.trim())
                                          ).map(f => (
                                              <button key={f.id} onClick={() => setFormData({...formData, fiscal_id: f.id, fiscal_search: ''})} className="w-full px-6 py-4 text-left hover:bg-yellow-50 dark:hover:bg-yellow-900/10 border-b dark:border-zinc-800 last:border-0 transition-colors">
                                                  <p className="text-xs font-black dark:text-white uppercase">{f.full_name || f.name}</p>
                                              </button>
                                          ))}
                                      </div>
                                  )}
                              </div>
                          </div>

                          <div className="col-span-full transition-colors">
                              <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-2 transition-colors">Motorista *</label>
                              <div className="relative">
                                  <input 
                                      type="text"
                                      className="w-full px-5 py-4 border-2 border-slate-100 dark:border-zinc-800 rounded-2xl font-bold bg-slate-50 dark:bg-zinc-900 dark:text-zinc-100 transition-colors shadow-inner uppercase"
                                      placeholder="Busque por nome..."
                                      value={availableDrivers.find(d => d.id === formData.driver_id)?.full_name ? availableDrivers.find(d => d.id === formData.driver_id)?.full_name : (formData.driver_search || '')}
                                      onFocus={() => setFormData({...formData, driver_search: formData.driver_search || ' ', driver_id: ''})}
                                      onChange={e => {
                                          const val = e.target.value.toUpperCase();
                                          setFormData({...formData, driver_search: val, driver_id: ''});
                                      }}
                                  />
                                  {modalDrivers && formData.driver_search && !formData.driver_id && (
                                      <div className="absolute z-[200] w-full mt-2 bg-white dark:bg-zinc-900 border-2 border-slate-100 dark:border-zinc-800 rounded-2xl shadow-2xl max-h-48 overflow-y-auto custom-scrollbar">
                                          {modalDrivers.filter(d => 
                                              !formData.driver_search.trim() ||
                                              (d.full_name || d.name || '').toUpperCase().includes(formData.driver_search.trim())
                                          ).map(d => {
                                              const points = userFines
                                                  .filter(f => f.user_id === d.id && f.status !== 'RECURSO')
                                                  .reduce((acc, f) => acc + (f.points || 0), 0);
                                              const isBlocked = d.cnh_limit && points >= d.cnh_limit;

                                              return (
                                                  <button 
                                                      key={d.id} 
                                                      onClick={() => {
                                                          if (isBlocked) {
                                                              addToast("MOTORISTA BLOQUEADO: Alerta de segurança CNH.", "warning");
                                                          }
                                                          setFormData({...formData, driver_id: d.id, driver_search: ''});
                                                      }} 
                                                      className={`w-full px-6 py-4 text-left border-b dark:border-zinc-800 last:border-0 transition-colors flex items-center justify-between ${isBlocked ? 'bg-red-50 hover:bg-red-100' : 'hover:bg-yellow-50 dark:hover:bg-yellow-900/10'}`}
                                                  >
                                                      <div className="flex items-center gap-3">
                                                          {isBlocked && <Ban size={14} className="text-red-500" />}
                                                          <p className={`text-xs font-black uppercase ${isBlocked ? 'text-red-600' : 'dark:text-white'}`}>{d.full_name || d.name}</p>
                                                      </div>
                                                      {isBlocked ? (
                                                          <span className="text-[8px] font-black bg-red-600 text-white px-2 py-0.5 rounded uppercase tracking-tighter shadow-sm animate-pulse">Bloqueado ({points} pts)</span>
                                                      ) : points > 0 ? (
                                                          <span className="text-[8px] font-black text-slate-400 uppercase tracking-tighter">{points} PTS</span>
                                                      ) : null}
                                                  </button>
                                              );
                                          })}
                                      </div>
                                  )}
                              </div>
                          </div>

                          <div className="col-span-full transition-colors">
                              <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-2 transition-colors">Cobrador (Opcional)</label>
                              <div className="relative">
                                  <input 
                                      type="text"
                                      className="w-full px-5 py-4 border-2 border-slate-100 dark:border-zinc-800 rounded-2xl font-bold bg-slate-50 dark:bg-zinc-900 dark:text-zinc-100 transition-colors shadow-inner uppercase"
                                      placeholder="Busque por nome..."
                                      value={availableConductors.find(c => c.id === formData.conductor_id)?.full_name ? availableConductors.find(c => c.id === formData.conductor_id)?.full_name : (formData.conductor_search || '')}
                                      onFocus={() => setFormData({...formData, conductor_search: formData.conductor_search || ' ', conductor_id: ''})}
                                      onChange={e => {
                                          const val = e.target.value.toUpperCase();
                                          setFormData({...formData, conductor_search: val, conductor_id: ''});
                                      }}
                                  />
                                  {modalConductors && formData.conductor_search && !formData.conductor_id && (
                                      <div className="absolute z-[200] w-full mt-2 bg-white dark:bg-zinc-900 border-2 border-slate-100 dark:border-zinc-800 rounded-2xl shadow-2xl max-h-48 overflow-y-auto custom-scrollbar">
                                          {modalConductors.filter(c => 
                                              !formData.conductor_search.trim() ||
                                              (c.full_name || c.name || '').toUpperCase().includes(formData.conductor_search.trim())
                                          ).map(c => (
                                              <button key={c.id} onClick={() => setFormData({...formData, conductor_id: c.id, conductor_search: ''})} className="w-full px-6 py-4 text-left hover:bg-yellow-50 dark:hover:bg-yellow-900/10 border-b dark:border-zinc-800 last:border-0 transition-colors">
                                                  <p className="text-xs font-black dark:text-white uppercase">{c.full_name || c.name}</p>
                                              </button>
                                          ))}
                                      </div>
                                  )}
                              </div>
                          </div>
                      </div>
                      <button onClick={handleSave} className="w-full py-5 bg-yellow-400 text-slate-900 rounded-[2rem] font-black uppercase text-xs shadow-xl active:scale-95 flex items-center justify-center gap-2 border-2 border-slate-900 transition-all"><Save size={20}/> Gravar Programação</button>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};

export default TripSchedule;
