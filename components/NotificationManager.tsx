
import React, { useState, useMemo, useEffect } from 'react';
import { Bell, Search, Filter, CheckCircle2, AlertTriangle, Info, Trash2, Clock, Settings, Plus, X, Save, Loader2 } from 'lucide-react';
import { AppNotification, User, Trip, Vehicle } from '../types';
import { db, supabase } from '../services/database';

interface NotificationManagerProps {
  notifications: AppNotification[];
  currentUser: User | null;
  addToast: (m: string, t?: any) => void;
  onRefresh: () => void;
  onNotificationClick?: (notif: AppNotification) => void;
}

const NotificationManager: React.FC<NotificationManagerProps> = ({ notifications, currentUser, addToast, onRefresh, onNotificationClick }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filter, setFilter] = useState<'all' | 'unread' | 'important'>('all');
  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [prefs, setPrefs] = useState(currentUser?.notification_preferences || {
    schedule: true,
    delay: true,
    maintenance: true,
    inspection: true,
    occurrence: true,
    ticketing: true
  });

  const [animatingOutIds, setAnimatingOutIds] = useState<Set<string>>(new Set());

  const [rulesConfig, setRulesConfig] = useState(() => {
    const saved = localStorage.getItem('maintenance_rules_thresholds');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {}
    }
    return {
      preventiveDays: 180,
      preventiveKm: 10000,
      enableDelayRule: true,
      enableMaintenanceRule: true
    };
  });

  const runAutomationRules = async () => {
    try {
      // 1. Fetch current data
      const [tripsList, vehiclesList, maintenanceLogs, configSettings] = await Promise.all([
        supabase.from('trips').select('*'),
        supabase.from('vehicles').select('*'),
        supabase.from('maintenance').select('*'),
        supabase.from('system_settings').select('*')
      ]);

      const trips = (tripsList.data || []) as Trip[];
      const vehicles = (vehiclesList.data || []) as Vehicle[];
      const logs = (maintenanceLogs.data || []) as any[];
      const sysSettings = configSettings.data?.[0] as any;

      // 2. Fetch routes so we can get route prefix and details
      const routesList = await supabase.from('routes').select('*');
      const routes = routesList.data || [];

      // 3. Current active notifications (matching our rules)
      const existingNotifs = notifications || [];

      const newNotificationsToInsert: any[] = [];
      const tripsToUpdateToAtrasada: Trip[] = [];

      // --- RULE 1: Trip delays (> 15 min) ---
      const now = new Date();
      if (rulesConfig.enableDelayRule) {
        // Current date in YYYY-MM-DD (aligned with timezone)
        const todayDateStr = now.toLocaleDateString('en-CA'); // Gets YYYY-MM-DD safely
        const currentHour = now.getHours();
        const currentMin = now.getMinutes();
        const currentMinutesSinceMidnight = currentHour * 60 + currentMin;

        // Filter today's trips that are still "Agendada"
        const pendingTodayTrips = trips.filter(t => 
          t.status === 'Agendada' && 
          t.trip_date === todayDateStr
        );

        pendingTodayTrips.forEach(trip => {
          if (!trip.departure_time) return;
          const [depHourStr, depMinStr] = trip.departure_time.split(':');
          const depHour = parseInt(depHourStr, 10);
          const depMin = parseInt(depMinStr, 10);
          const depMinutesSinceMidnight = depHour * 60 + depMin;

          // Check if current time is > 15 minutes past scheduled departure time
          if (currentMinutesSinceMidnight - depMinutesSinceMidnight > 15) {
            // Check if we ALREADY have a notification for this trip in existingNotifs
            const alertAlreadyExists = existingNotifs.some(n => 
              n.category === 'DELAY' && 
              n.metadata && 
              n.metadata.trip_id === trip.id
            );

            if (!alertAlreadyExists) {
              const route = routes.find((r: any) => r.id === trip.route_id);
              const routeLabel = route ? `Linha ${route.prefixo_linha || ''} (${route.origin} x ${route.destination})` : `ID ${trip.route_id}`;
              
              newNotificationsToInsert.push({
                system_id: currentUser?.system_id,
                user_id: null,
                title: `⚠️ Viagem com Atraso Crítico (>15 min)`,
                message: `A viagem com partida prevista para as ${trip.departure_time} na ${routeLabel}, motorista ${trip.driver_name || 'Não escalado'} está com atraso de mais de 15 minutos e não foi iniciada.`,
                type: 'WARNING',
                category: 'DELAY',
                target_role: 'ADMIN',
                is_read: false,
                created_at: new Date().toISOString(),
                metadata: { trip_id: trip.id, delay_rule: true, trip_date: trip.trip_date }
              });

              // Mark the trip as "Atrasada" automatically
              tripsToUpdateToAtrasada.push({
                ...trip,
                status: 'Atrasada' as any
              });
            }
          }
        });
      }

      // --- RULE 2: Maintenance Overdue (by configured days & km thresholds) ---
      if (rulesConfig.enableMaintenanceRule) {
        vehicles.forEach(v => {
          const vehicleLogs = logs.filter(l => l.vehicle_id === v.id);
          const lastPreventive = vehicleLogs
            .filter(l => l.service_type === 'PREVENTIVA')
            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];

          const limitDays = rulesConfig.preventiveDays || 180;
          const limitKm = rulesConfig.preventiveKm || 10000;
          
          let isOverdueByTime = false;
          let isOverdueByKm = false;
          let accumulatedKm = 0;
          let lastDateStr = 'Sem registro';

          if (lastPreventive) {
            lastDateStr = lastPreventive.date;
            const prevDateObj = new Date(lastPreventive.date);
            const diffDays = Math.ceil((now.getTime() - prevDateObj.getTime()) / (1000 * 60 * 60 * 24));
            
            if (diffDays > limitDays) {
              isOverdueByTime = true;
            }

            // Calculate KM accumulated since last preventive date
            const tripsSincePrev = trips.filter(t => 
              t.bus_number === v.prefix && 
              new Date(t.trip_date) >= prevDateObj
            );

            tripsSincePrev.forEach(trip => {
              if (trip.final_odometer && trip.initial_odometer) {
                accumulatedKm += (trip.final_odometer - trip.initial_odometer);
              } else {
                const r = routes.find((route: any) => route.id === trip.route_id);
                accumulatedKm += (r?.distance_km || 0);
              }
            });

            if (accumulatedKm > limitKm) {
              isOverdueByKm = true;
            }
          } else {
            // No preventive maintenance found, overdue by default!
            isOverdueByTime = true;
            isOverdueByKm = true;
          }

          if (isOverdueByTime || isOverdueByKm) {
            const reason = isOverdueByTime && isOverdueByKm 
              ? `limite de tempo (> ${limitDays} dias) e quilometragem (> ${limitKm} km) excedidos`
              : isOverdueByTime 
                ? `limite de tempo (> ${limitDays} dias) excedido` 
                : `quilometragem alcançada (${Math.round(accumulatedKm)} km / limite: ${limitKm} km)`;

            // Unique signature combining vehicle ID and alert limits state to avoid redundancy
            const signature = `${v.id}-${lastDateStr}-${limitDays}-${limitKm}`;

            const alertAlreadyExists = existingNotifs.some(n => 
              n.category === 'MAINTENANCE' && 
              n.metadata && 
              n.metadata.signature === signature
            );

            if (!alertAlreadyExists) {
              newNotificationsToInsert.push({
                system_id: currentUser?.system_id,
                user_id: null,
                title: `🔧 Preventiva Vencida: #${v.prefix}`,
                message: `O veículo de prefixo #${v.prefix} (${v.model || ''}) está com a manutenção preventiva vencida por ${reason}. Último registro: ${lastDateStr === 'Sem registro' ? 'Nunca realizado' : new Date(lastDateStr).toLocaleDateString('pt-BR')}.`,
                type: 'ERROR',
                category: 'MAINTENANCE',
                target_role: 'ADMIN',
                is_read: false,
                created_at: new Date().toISOString(),
                metadata: { 
                  vehicle_id: v.id, 
                  maintenance_rule: true, 
                  signature,
                  accumulated_km: accumulatedKm, 
                  limit_km: limitKm,
                  limit_days: limitDays,
                  last_preventive_date: lastDateStr 
                }
              });
            }
          }
        });
      }

      // 4. Perform insertions & updates if any
      let didTriggerChanges = false;

      if (newNotificationsToInsert.length > 0) {
        await supabase.from('notifications').insert(newNotificationsToInsert);
        didTriggerChanges = true;
      }

      if (tripsToUpdateToAtrasada.length > 0) {
        await Promise.all(tripsToUpdateToAtrasada.map(trip => 
          supabase.from('trips').update({ status: 'Atrasada' as any }).eq('id', trip.id)
        ));
        didTriggerChanges = true;
      }

      if (didTriggerChanges) {
        onRefresh();
        addToast(`Regras de Alertas: ${newNotificationsToInsert.length} novas notificações geradas!`, "warning");
      }

    } catch (err) {
      console.error("[AUTO_RULES_ERROR] Falha ao processar regras automáticas:", err);
    }
  };

  useEffect(() => {
    if (currentUser) {
      runAutomationRules();
    }
  }, [currentUser]);

  const handleSavePrefs = async () => {
    if (!currentUser) return;
    setIsLoading(true);
    try {
      await db.update('users', { 
        id: currentUser.id, 
        notification_preferences: prefs 
      });
      addToast("Preferências de notificação salvas!", "success");
      setIsConfigModalOpen(false);
      onRefresh();
    } catch (e) {
      addToast("Erro ao salvar preferências.", "error");
    } finally {
      setIsLoading(false);
    }
  };

  const filteredNotifications = useMemo(() => {
    return notifications
      .filter(n => {
        const title = (n.title || '').toLowerCase();
        const message = (n.message || '').toLowerCase();
        const search = searchTerm.toLowerCase();

        const matchesSearch = title.includes(search) || message.includes(search);
        
        const matchesFilter = filter === 'all' || 
                             (filter === 'unread' && !n.is_read) || 
                             (filter === 'important' && n.type === 'ERROR');
                             
        const matchesRole = currentUser?.role === 'ADMIN' || 
                           (n.user_id === currentUser?.id) || 
                           (!n.user_id && (!n.target_role || n.target_role === 'ALL' || n.target_role === currentUser?.role));
                           
        return matchesSearch && matchesFilter && matchesRole;
      })
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }, [notifications, searchTerm, filter, currentUser]);

  const handleMarkAsRead = async (id: string) => {
    setAnimatingOutIds(prev => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });

    setTimeout(async () => {
      try {
        await db.update('notifications', { id, is_read: true });
        onRefresh();
      } catch (e) {
        addToast("Erro ao marcar como lida.", "error");
      } finally {
        setAnimatingOutIds(prev => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
      }
    }, 500);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Excluir esta notificação?')) return;
    
    setAnimatingOutIds(prev => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });

    setTimeout(async () => {
      try {
        let query = supabase.from('notifications').delete().eq('id', id);
        
        if (currentUser?.system_id) {
          query = query.eq('system_id', currentUser.system_id);
        }

        const { error } = await query;
        if (error) throw error;
        onRefresh();
        addToast("Notificação excluída.", "success");
      } catch (e) {
        console.error('Erro ao excluir notificação:', e);
        addToast("Erro ao excluir.", "error");
      } finally {
        setAnimatingOutIds(prev => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
      }
    }, 500);
  };

  const handleMarkAllRead = async () => {
    setIsLoading(true);
    try {
      const unread = notifications.filter(n => !n.is_read);
      await Promise.all(unread.map(n => db.update('notifications', { id: n.id, is_read: true })));
      onRefresh();
      addToast("Todas marcadas como lidas.", "success");
    } catch (e) {
      addToast("Erro ao processar.", "error");
    } finally {
      setIsLoading(false);
    }
  };

  const getBadgeTooltip = (n: AppNotification) => {
    if (n.category === 'DELAY') {
      return `Atraso Crítico: Viagem com partida pendente por mais de 15 minutos do horário planejado.`;
    }
    if (n.category === 'MAINTENANCE') {
      const limitDays = n.metadata?.limit_days || rulesConfig.preventiveDays;
      const limitKm = n.metadata?.limit_km || rulesConfig.preventiveKm;
      const currentKm = n.metadata?.accumulated_km ? Math.round(n.metadata.accumulated_km) : null;
      let kmInfo = currentKm !== null ? `(${currentKm} km rodados)` : 'completou limite de rodagem';
      return `Manutenção Preventiva Vencida: Veículo ultrapassou o limiar de ${limitDays} dias ou ${limitKm} km recomendados ${kmInfo}.`;
    }
    if (n.type === 'ERROR') {
      return `Grave: Incidente crítico de prioridade máxima no sistema de frotas.`;
    }
    return `Informativo: Operador e despacho comunicados de evento em conformidade com o sistema.`;
  };

  return (
    <div id="notifications-view-container" className="space-y-6 animate-in fade-in transition-all pb-24">
      {/* HEADER */}
      <div className="bg-white dark:bg-zinc-900 p-8 rounded-[2.5rem] shadow-sm border border-slate-100 dark:border-zinc-800">
        <div className="flex flex-col md:flex-row justify-between items-center gap-6">
          <div>
            <h2 className="text-3xl font-black text-slate-800 dark:text-zinc-100 uppercase italic leading-none">Centro de Alertas</h2>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-2 border-l-2 border-yellow-400 pl-4">Monitoramento em tempo real de eventos do sistema</p>
          </div>
          
          <div className="flex gap-3">
            <button 
              onClick={handleMarkAllRead}
              disabled={isLoading || !notifications.some(n => !n.is_read)}
              className="px-6 py-3 bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-slate-400 rounded-xl font-black uppercase text-[10px] tracking-widest hover:bg-slate-200 transition-all disabled:opacity-50"
            >
              Marcar todas como lidas
            </button>
            <button 
              onClick={() => setIsConfigModalOpen(true)}
              className="p-3 bg-yellow-400 text-slate-900 rounded-xl shadow-lg border-2 border-slate-900 active:scale-95 transition-all"
            >
              <Settings size={20} />
            </button>
          </div>
        </div>
      </div>

      {/* CARD CONFIG REGRAS DE MANUTENÇÃO (EXCLUSIVO ADMIN) */}
      {currentUser?.role === 'ADMIN' && (
        <div className="bg-white dark:bg-zinc-900 p-8 rounded-[2.5rem] border dark:border-zinc-850 shadow-sm space-y-6">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-yellow-400 text-slate-900 rounded-2xl">
              <Settings size={20} />
            </div>
            <div>
              <h3 className="text-sm font-black uppercase italic text-slate-800 dark:text-zinc-100">Regras de Alertas Automáticos de Manutenção</h3>
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-0.5">Defina os limites de dias e quilometragem para vistorias preventivas</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="p-5 bg-slate-50 dark:bg-zinc-805 rounded-2xl border border-slate-100 dark:border-zinc-800/50 space-y-2">
              <label className="block text-[10px] font-black uppercase text-slate-500">Limiar de Tempo (Dias)</label>
              <input 
                type="number" 
                className="w-full p-4 bg-white dark:bg-zinc-950 border-2 border-slate-200 dark:border-zinc-800 rounded-xl font-bold text-xs"
                value={rulesConfig.preventiveDays}
                onChange={e => setRulesConfig({ ...rulesConfig, preventiveDays: parseInt(e.target.value) || 0 })}
                placeholder="Ex: 180"
              />
              <p className="text-[8px] font-bold text-slate-400 uppercase tracking-wide">Frequência recomendada de preventiva em dias.</p>
            </div>

            <div className="p-5 bg-slate-50 dark:bg-zinc-805 rounded-2xl border border-slate-100 dark:border-zinc-800/50 space-y-2">
              <label className="block text-[10px] font-black uppercase text-slate-500">Limiar de Quilometragem (KM)</label>
              <input 
                type="number" 
                className="w-full p-4 bg-white dark:bg-zinc-950 border-2 border-slate-200 dark:border-zinc-800 rounded-xl font-bold text-xs"
                value={rulesConfig.preventiveKm}
                onChange={e => setRulesConfig({ ...rulesConfig, preventiveKm: parseInt(e.target.value) || 0 })}
                placeholder="Ex: 10000"
              />
              <p className="text-[8px] font-bold text-slate-400 uppercase tracking-wide">Distância máxima percorrida recomendada em quilômetros.</p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-4 items-center justify-between pt-2">
            <div className="flex flex-wrap gap-6">
              <label className="flex items-center gap-2 cursor-pointer">
                <input 
                  type="checkbox" 
                  className="w-4 h-4 accent-yellow-400 rounded"
                  checked={rulesConfig.enableDelayRule}
                  onChange={e => setRulesConfig({ ...rulesConfig, enableDelayRule: e.target.checked })}
                />
                <span className="text-[9px] font-black uppercase text-slate-500 dark:text-zinc-400">Habilitar atrasos automáticos (&gt;15 min)</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input 
                  type="checkbox" 
                  className="w-4 h-4 accent-yellow-400 rounded"
                  checked={rulesConfig.enableMaintenanceRule}
                  onChange={e => setRulesConfig({ ...rulesConfig, enableMaintenanceRule: e.target.checked })}
                />
                <span className="text-[9px] font-black uppercase text-slate-500 dark:text-zinc-400">Habilitar revisão preventiva automática</span>
              </label>
            </div>

            <button 
              onClick={async () => {
                localStorage.setItem('maintenance_rules_thresholds', JSON.stringify(rulesConfig));
                addToast("Configurações de regras salvas! Reavaliando a frota...", "success");
                await runAutomationRules();
              }}
              className="px-6 py-3 bg-yellow-400 text-slate-900 border-2 border-slate-950 active:scale-95 shadow-md font-black uppercase text-[10px] tracking-widest hover:bg-yellow-500 rounded-xl transition-all h-fit"
            >
              Aplicar & Salvar Regras
            </button>
          </div>
        </div>
      )}

      {/* FILTERS */}
      <div className="flex flex-col sm:flex-row gap-4 items-center">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-4 top-4 text-slate-400" size={18} />
          <input 
            type="text" 
            placeholder="Buscar nos alertas..." 
            className="w-full pl-12 pr-4 py-4 rounded-2xl bg-white dark:bg-zinc-900 border-2 border-transparent focus:border-yellow-400 outline-none text-[10px] font-black uppercase shadow-sm transition-all"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="flex bg-white dark:bg-zinc-900 p-1 rounded-2xl shadow-sm border dark:border-zinc-800">
          {(['all', 'unread', 'important'] as const).map(f => (
            <button 
              key={f}
              onClick={() => setFilter(f)}
              className={`px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${filter === f ? 'bg-yellow-400 text-slate-900 shadow-md' : 'text-slate-400'}`}
            >
              {f === 'all' ? 'Todos' : f === 'unread' ? 'Não Lidos' : 'Importantes'}
            </button>
          ))}
        </div>
      </div>

      {/* LIST */}
      <div className="grid gap-4">
        {filteredNotifications.length === 0 ? (
          <div className="py-20 text-center bg-white dark:bg-zinc-900 rounded-[2.5rem] border-2 border-dashed border-slate-200 dark:border-zinc-800">
            <Bell className="mx-auto text-slate-200 mb-4" size={48}/>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Nenhum alerta encontrado.</p>
          </div>
        ) : (
          filteredNotifications.map((n) => {
            const isAnimatingOut = animatingOutIds.has(n.id);
            return (
              <div 
                key={n.id} 
                onClick={() => onNotificationClick?.(n)}
                className={`notification-item bg-white dark:bg-zinc-900 p-6 rounded-[2rem] border-2 flex items-start gap-6 group cursor-pointer transition-all duration-500 transform ${
                  isAnimatingOut 
                    ? 'opacity-0 -translate-x-12 scale-90 blur-lg max-h-0 py-0 my-0 border-transparent overflow-hidden pointer-events-none'
                    : n.is_read 
                      ? 'border-slate-100 dark:border-zinc-850 opacity-45 scale-[0.98] blur-[0.2px] hover:opacity-80 hover:scale-100 transition-all' 
                      : 'border-yellow-400 shadow-lg'
                } hover:border-yellow-500`}
              >
                {/* TOOLTIP ON HOVER SPECIFICATIONS */}
                <div className={`status-indicator-badge relative p-4 rounded-2xl shrink-0 transition-all group/badge ${
                  n.type === 'ERROR' ? 'bg-red-50 dark:bg-red-950/20 text-red-500 animate-pulse border border-red-200/50' : 
                  n.type === 'WARNING' || n.category === 'DELAY' ? 'bg-orange-50 dark:bg-orange-950/20 text-orange-500 animate-pulse border border-orange-200/50' : 
                  'bg-blue-50 dark:bg-blue-950/20 text-blue-500'
                }`}>
                  {n.type === 'ERROR' ? <AlertTriangle size={24}/> : 
                   n.type === 'WARNING' || n.category === 'DELAY' ? <Clock size={24}/> : 
                   <Info size={24}/>}

                  {/* PREMIUM HTML TOOLTIP */}
                  <div className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-3 w-56 bg-slate-905 dark:bg-zinc-800 text-slate-100 dark:text-zinc-100 text-[9px] font-black uppercase tracking-wider p-3 rounded-2xl border-2 border-yellow-400 opacity-0 group-hover/badge:opacity-100 transition-all duration-300 shadow-2xl z-50 text-center scale-95 group-hover/badge:scale-100 leading-normal">
                    {getBadgeTooltip(n)}
                    <div className="absolute top-full left-1/2 -translate-x-1/2 border-x-8 border-x-transparent border-t-8 border-t-yellow-400 w-0 h-0"></div>
                  </div>
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <h3 className="font-black text-slate-800 dark:text-zinc-100 uppercase text-sm leading-tight">{n.title}</h3>
                      <p className={`status-indicator-badge mt-1 inline-block px-2 py-0.5 rounded-md text-[8px] font-black uppercase tracking-widest ${
                        n.category === 'DELAY' || n.category === 'MAINTENANCE' || n.type === 'ERROR'
                          ? 'bg-rose-100 dark:bg-rose-950/40 text-rose-600 animate-pulse border border-rose-200 dark:border-rose-900/30 font-extrabold shadow-sm'
                          : 'bg-slate-100 dark:bg-zinc-800 text-slate-400'
                      }`}>
                        {new Date(n.created_at).toLocaleString('pt-BR')} • {n.category}
                      </p>
                    </div>
                    <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      {!n.is_read && (
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            handleMarkAsRead(n.id);
                          }} 
                          className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-all" 
                          title="Marcar como lida"
                        >
                          <CheckCircle2 size={18}/>
                        </button>
                      )}
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(n.id);
                        }} 
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-all" 
                        title="Excluir"
                      >
                        <Trash2 size={18}/>
                      </button>
                    </div>
                  </div>
                  <p className="text-xs text-slate-600 dark:text-zinc-400 leading-relaxed">{n.message}</p>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* CONFIG MODAL */}
      {isConfigModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 dark:bg-black/70 z-[200] flex items-center justify-center p-4 backdrop-blur-md animate-in zoom-in duration-300">
          <div className="bg-white dark:bg-zinc-950 w-full max-w-lg rounded-[3rem] shadow-2xl border-4 border-yellow-400 overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-8 border-b dark:border-zinc-800 bg-slate-900 flex justify-between items-center text-white shrink-0">
              <div>
                <h3 className="text-xl font-black uppercase italic tracking-tighter">Configurar Alertas</h3>
                <p className="text-[9px] font-black text-yellow-400 uppercase mt-1">Personalização de Notificações</p>
              </div>
              <button onClick={() => setIsConfigModalOpen(false)} className="p-3 bg-white/10 rounded-2xl hover:bg-red-500 transition-colors"><X size={24}/></button>
            </div>
            
            <div className="p-8 space-y-6 overflow-y-auto custom-scrollbar">
              <div className="space-y-4">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Ativar Alertas Para:</p>
                {[
                  { id: 'schedule', label: 'Alterações de Horário' },
                  { id: 'delay', label: 'Atrasos de Viagem' },
                  { id: 'maintenance', label: 'Manutenções Vencendo' },
                  { id: 'inspection', label: 'Vistorias Pendentes' },
                  { id: 'occurrence', label: 'Novas Ocorrências' },
                  { id: 'ticketing', label: 'Vendas e Bilhetagem' }
                ].map(item => (
                  <label key={item.id} className="flex items-center justify-between p-4 bg-slate-50 dark:bg-zinc-900 rounded-2xl border border-slate-100 dark:border-zinc-800 cursor-pointer hover:border-yellow-400 transition-all">
                    <span className="text-[10px] font-black text-slate-700 dark:text-zinc-300 uppercase">{item.label}</span>
                    <input 
                      type="checkbox" 
                      checked={(prefs as any)[item.id] !== false} 
                      onChange={e => setPrefs({ ...prefs, [item.id]: e.target.checked })}
                      className="w-5 h-5 accent-yellow-400" 
                    />
                  </label>
                ))}
              </div>

              <button 
                onClick={handleSavePrefs}
                disabled={isLoading}
                className="w-full py-4 bg-yellow-400 text-slate-900 rounded-2xl font-black uppercase text-xs shadow-xl active:scale-95 border-2 border-slate-900 transition-all flex items-center justify-center gap-2"
              >
                {isLoading ? <Loader2 className="animate-spin" size={18}/> : 'Salvar Preferências'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationManager;
