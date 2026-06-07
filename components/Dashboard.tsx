
import React, { useState, useMemo, useEffect } from 'react';
import { Building2, PlayCircle, Users, DollarSign, Bus, TrendingUp, Clock, Calendar, ArrowRight, Search, AlertTriangle, ExternalLink, Download } from 'lucide-react';
import { Trip, BusRoute, Company, IssueReport, City, PassengerDetails, Subscription } from '../types';
import { motion, AnimatePresence } from 'framer-motion';
import { ResponsiveContainer, AreaChart, Area, BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';

interface DashboardProps {
  allTrips: Trip[];
  routes: BusRoute[];
  companies: Company[];
  cities: City[];
  reports: IssueReport[];
  subscription?: Subscription | null;
  onForceBackup?: () => void;
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-slate-900 text-white p-4 rounded-2xl border border-slate-800 shadow-xl text-[10px] font-black uppercase">
        <p className="text-yellow-400 font-black mb-1">{`Horário: ${label}`}</p>
        {payload.map((item: any, idx: number) => {
          const isRev = item.name === 'Faturamento Líquido';
          const isOcc = item.name === 'Ocupação Média';
          return (
            <p key={idx} style={{ color: item.color }} className="font-bold">
              {item.name}: {isRev ? `R$ ${item.value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : isOcc ? `${item.value} pax/viagem` : item.value}
            </p>
          );
        })}
      </div>
    );
  }
  return null;
};

const formatDateBr = (dateStr: string) => {
    if (!dateStr) return '---';
    const [y, m, d] = dateStr.split('-');
    return `${d}.${m}.${y}`;
};

const StatCard: React.FC<{ title: string; value: string; icon: React.ReactNode; color: string; textColor: string; delay?: number }> = ({ title, value, icon, color, textColor, delay = 0 }) => (
  <motion.div 
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.5, delay }}
    className="bg-white dark:bg-zinc-900 p-6 rounded-[2.5rem] shadow-sm border border-slate-100 dark:border-zinc-800 flex items-center justify-between group transition-colors"
  >
    <div>
      <p className="text-[9px] font-black text-black dark:text-zinc-500 uppercase tracking-[0.2em] mb-1">{title}</p>
      <h3 className="text-2xl font-black text-slate-800 dark:text-white leading-none tracking-tighter">{value}</h3>
    </div>
    <div className={`w-14 h-14 rounded-2xl ${color} ${textColor} shadow-lg flex items-center justify-center transition-transform group-hover:rotate-12 border-2 border-slate-900 dark:border-zinc-800`}>
      {icon}
    </div>
  </motion.div>
);

const Dashboard: React.FC<DashboardProps> = ({ allTrips = [], routes = [], companies = [], subscription, onForceBackup }) => {
  const [filterCompanyId, setFilterCompanyId] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState('');

  const [backupStatus, setBackupStatus] = useState<'UP_TO_DATE' | 'DELAYED'>('DELAYED');
  const [lastBackupDate, setLastBackupDate] = useState<string>('Nenhum');

  useEffect(() => {
    const updateBackupStatus = () => {
      const stored = localStorage.getItem('vialivre_last_weekly_backup_timestamp');
      if (stored) {
        const ts = parseInt(stored, 10);
        if (!isNaN(ts)) {
          const diffDays = (Date.now() - ts) / (1000 * 60 * 60 * 24);
          setBackupStatus(diffDays <= 7 ? 'UP_TO_DATE' : 'DELAYED');
          setLastBackupDate(new Date(ts).toLocaleDateString('pt-BR'));
          return;
        }
      }
      setBackupStatus('DELAYED');
      setLastBackupDate('Nenhum');
    };

    updateBackupStatus();
    const interval = setInterval(updateBackupStatus, 5000);
    return () => clearInterval(interval);
  }, []);

  const daysUntilExpiration = useMemo(() => {
    if (!subscription || subscription.plan_type === 'LIFETIME') return null;
    const now = new Date();
    const expiresAt = new Date(subscription.expires_at);
    const diffTime = expiresAt.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  }, [subscription]);

  const summary = useMemo(() => {
    let totalPax = 0; let revenue = 0; let tripCount = 0;
    const today = new Date().toISOString().split('T')[0];
    
    allTrips.filter(t => t.trip_date.split('T')[0] === today && (!filterCompanyId || routes.find(r => r.id === t.route_id)?.company_id === filterCompanyId)).forEach(trip => {
      if (trip.status === 'Concluída' || trip.status === 'Em Rota') {
        tripCount++;
        const route = routes.find(r => r.id === trip.route_id);
        Object.values(trip.passengers || {}).forEach((p: any) => {
          totalPax += (p.pagantes + p.vale_transporte + p.imp_card + p.gratuitos);
          if (route) {
              revenue += (p.pagantes + p.vale_transporte) * route.price;
              revenue += p.imp_card * (route.price * 0.7); 
          }
        });
      }
    });
    return { totalPax, revenue, tripCount };
  }, [allTrips, routes, filterCompanyId]);

  const hourlyData = useMemo(() => {
    const hoursMap: Record<string, { hour: string; passengers: number; revenue: number }> = {};
    
    // Initialize standard operating hours (05:00 to 23:00)
    for (let h = 5; h <= 23; h++) {
      const hStr = h.toString().padStart(2, '0');
      hoursMap[hStr] = {
        hour: `${hStr}:00`,
        passengers: 0,
        revenue: 0
      };
    }

    const today = new Date().toISOString().split('T')[0];
    let filteredTrips = allTrips.filter(t => 
      t.trip_date.split('T')[0] === today && 
      (!filterCompanyId || routes.find(r => r.id === t.route_id)?.company_id === filterCompanyId)
    );

    // Fallback: If today's trips are empty or have zero passenger entries, 
    // fall back to grouping all loaded trips to ensure the chart is populated!
    if (filteredTrips.length === 0 || filteredTrips.every(t => !t.passengers || Object.keys(t.passengers).length === 0)) {
      filteredTrips = allTrips.filter(t => 
        !filterCompanyId || routes.find(r => r.id === t.route_id)?.company_id === filterCompanyId
      );
    }

    filteredTrips.forEach(trip => {
      const hourPart = trip.departure_time ? trip.departure_time.split(':')[0] : '00';
      if (!hoursMap[hourPart]) {
        hoursMap[hourPart] = {
          hour: `${hourPart}:00`,
          passengers: 0,
          revenue: 0
        };
      }

      const route = routes.find(r => r.id === trip.route_id);
      Object.values(trip.passengers || {}).forEach((p: any) => {
        const paxInTrip = (p.pagantes || 0) + (p.vale_transporte || 0) + (p.imp_card || 0) + (p.gratuitos || 0);
        hoursMap[hourPart].passengers += paxInTrip;
        
        if (route) {
          let tripRevenue = ((p.pagantes || 0) + (p.vale_transporte || 0)) * (route.price || 0);
          tripRevenue += (p.imp_card || 0) * ((route.price || 0) * 0.7);
          hoursMap[hourPart].revenue += tripRevenue;
        }
      });
    });

    return Object.keys(hoursMap)
      .sort((a, b) => parseInt(a) - parseInt(b))
      .map(key => hoursMap[key]);
  }, [allTrips, routes, filterCompanyId]);

  const averageOccupancyData = useMemo(() => {
    const hoursMap: Record<string, { hour: string; totalPassengers: number; tripCount: number }> = {};
    
    // Initialize standard operating hours (05:00 to 23:00)
    for (let h = 5; h <= 23; h++) {
      const hStr = h.toString().padStart(2, '0');
      hoursMap[hStr] = {
        hour: `${hStr}:00`,
        totalPassengers: 0,
        tripCount: 0
      };
    }

    const today = new Date().toISOString().split('T')[0];
    let filteredTrips = allTrips.filter(t => 
      t.trip_date.split('T')[0] === today && 
      (!filterCompanyId || routes.find(r => r.id === t.route_id)?.company_id === filterCompanyId)
    );

    // Fallback: If today's trips are empty or have zero passenger entries, 
    // fall back to grouping all loaded trips to ensure the chart is populated!
    if (filteredTrips.length === 0 || filteredTrips.every(t => !t.passengers || Object.keys(t.passengers).length === 0)) {
      filteredTrips = allTrips.filter(t => 
        !filterCompanyId || routes.find(r => r.id === t.route_id)?.company_id === filterCompanyId
      );
    }

    filteredTrips.forEach(trip => {
      const hourPart = trip.departure_time ? trip.departure_time.split(':')[0] : '00';
      if (!hoursMap[hourPart]) {
        hoursMap[hourPart] = {
          hour: `${hourPart}:00`,
          totalPassengers: 0,
          tripCount: 0
        };
      }

      let paxInTrip = 0;
      Object.values(trip.passengers || {}).forEach((p: any) => {
        paxInTrip += (p.pagantes || 0) + (p.vale_transporte || 0) + (p.imp_card || 0) + (p.gratuitos || 0);
      });

      hoursMap[hourPart].totalPassengers += paxInTrip;
      hoursMap[hourPart].tripCount += 1;
    });

    return Object.keys(hoursMap)
      .sort((a, b) => parseInt(a) - parseInt(b))
      .map(key => {
        const item = hoursMap[key];
        const avg = item.tripCount > 0 ? parseFloat((item.totalPassengers / item.tripCount).toFixed(1)) : 0;
        return {
          hour: item.hour,
          occupancy: avg,
          tripCount: item.tripCount
        };
      });
  }, [allTrips, routes, filterCompanyId]);

  const activeTodayTrips = useMemo(() => {
      const today = new Date().toISOString().split('T')[0];
      return allTrips.filter(t => {
          const matchesDate = t.trip_date.split('T')[0] === today;
          const r = routes.find(ro => ro.id === t.route_id);
          const matchesCompany = !filterCompanyId || r?.company_id === filterCompanyId;
          const matchesSearch = !searchTerm || 
            t.driver_name?.toLowerCase().includes(searchTerm.toLowerCase()) || 
            t.bus_number.includes(searchTerm) ||
            r?.destination.toLowerCase().includes(searchTerm.toLowerCase());
          return matchesDate && matchesSearch && matchesCompany;
      }).sort((a,b) => a.departure_time.localeCompare(b.departure_time));
  }, [allTrips, searchTerm, routes, filterCompanyId]);

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      {daysUntilExpiration !== null && daysUntilExpiration <= 7 && daysUntilExpiration > 0 && (
        <div className="bg-red-50 dark:bg-red-900/20 border-2 border-red-200 dark:border-red-800/50 rounded-[2rem] p-6 flex flex-col md:flex-row items-center justify-between gap-4 shadow-lg shadow-red-500/5">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-red-600 rounded-2xl flex items-center justify-center text-white shadow-lg shrink-0">
              <AlertTriangle size={24} />
            </div>
            <div>
              <h4 className="text-sm font-black text-red-600 uppercase tracking-tight">Atenção! Assinatura Expirando</h4>
              <p className="text-xs font-bold text-red-700/70 dark:text-red-400/70 leading-tight">
                Sua assinatura do <span className="font-black">ViaLivre Gestão</span> expira em {daysUntilExpiration} {daysUntilExpiration === 1 ? 'dia' : 'dias'}. 
                Reative seu plano agora para evitar o bloqueio de acesso para você e sua equipe. Faça backup dos seus dados para segurança.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {onForceBackup && (
              <button 
                onClick={onForceBackup}
                className="px-6 py-3 bg-yellow-400 text-slate-900 rounded-xl font-black uppercase text-[10px] tracking-widest hover:bg-yellow-500 transition-all flex items-center gap-2 shadow-md active:scale-95 shrink-0 border-2 border-slate-900"
              >
                Cópia de Segurança (JSON) <Download size={14} />
              </button>
            )}
            <button 
              onClick={() => window.dispatchEvent(new CustomEvent('change-view', { detail: 'my-subscription' }))}
              className="px-6 py-3 bg-red-600 text-white rounded-xl font-black uppercase text-[10px] tracking-widest hover:bg-red-700 transition-all flex items-center gap-2 shadow-md active:scale-95 shrink-0"
            >
              Reativar Plano <ExternalLink size={14} />
            </button>
          </div>
        </div>
      )}

      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
          <div>
              <h2 className="text-2xl md:text-3xl font-black text-slate-800 dark:text-white uppercase italic leading-none">Visão Operacional</h2>
              <p className="text-[10px] text-yellow-600 font-black uppercase tracking-[0.3em] mt-2 border-l-2 border-yellow-400 pl-3">Dashboard em Tempo Real • {formatDateBr(new Date().toISOString().split('T')[0])}</p>
          </div>
          <div className="flex flex-row items-center gap-3">
              {/* Status de Backup em Tempo Real */}
              <div 
                className={`px-4 py-3 rounded-2xl border flex items-center gap-2.5 h-12 shadow-sm font-black text-[9px] uppercase tracking-widest transition-all ${
                  backupStatus === 'UP_TO_DATE' 
                    ? 'bg-emerald-50 dark:bg-emerald-950/25 border-emerald-200 dark:border-emerald-800 text-emerald-600 dark:text-emerald-400' 
                    : 'bg-red-50 dark:bg-red-950/25 border-red-200 dark:border-red-800 text-red-600 dark:text-red-400'
                }`}
                title={backupStatus === 'UP_TO_DATE' ? `Backup realizado em: ${lastBackupDate}` : 'Nenhum backup recente registrado nos últimos 7 dias'}
              >
                <div className="relative flex items-center justify-center w-2 h-2">
                  <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${backupStatus === 'UP_TO_DATE' ? 'bg-emerald-400' : 'bg-red-400'}`}></span>
                  <span className={`relative inline-flex rounded-full h-2 w-2 ${backupStatus === 'UP_TO_DATE' ? 'bg-emerald-500' : 'bg-red-500'}`}></span>
                </div>
                <span>Backup {backupStatus === 'UP_TO_DATE' ? 'Em dia' : 'Atrasado'}</span>
              </div>

              {onForceBackup && (
                <button 
                  onClick={onForceBackup}
                  className="px-4 py-3 bg-slate-950 dark:bg-zinc-800 text-white rounded-2xl font-black uppercase text-[9px] tracking-widest hover:bg-black dark:hover:bg-zinc-700 transition-all flex items-center gap-2 shadow-md border-2 border-slate-800 h-12"
                  title="Exportar todos os dados do banco para um arquivo JSON local"
                >
                  Backup de Segurança <Download size={12} className="text-yellow-400" />
                </button>
              )}
              <div className="bg-white dark:bg-zinc-900 p-2 rounded-2xl border border-slate-100 dark:border-zinc-800 flex items-center gap-2 h-12 shadow-sm">
                  <Building2 size={16} className="text-yellow-600 ml-2" />
                  <select className="bg-transparent text-[10px] font-black uppercase outline-none dark:text-zinc-300 pr-2" value={filterCompanyId} onChange={e => setFilterCompanyId(e.target.value)}>
                    <option value="">Todo o Grupo</option>
                    {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
              </div>
          </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div>
          <StatCard title="Operação do Dia" value={summary.tripCount.toString()} icon={<PlayCircle size={24} />} color="bg-slate-900" textColor="text-white" delay={0.1} />
        </div>
        <div>
          <StatCard title="Pax Projetado" value={summary.totalPax.toLocaleString()} icon={<Users size={24} />} color="bg-yellow-400" textColor="text-slate-900" delay={0.2} />
        </div>
        <div>
          <StatCard title="Receita Líquida Estimada" value={summary.revenue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} icon={<DollarSign size={24} />} color="bg-emerald-500" textColor="text-white" delay={0.3} />
        </div>
      </div>

      {/* Painel Gráfico de Demanda e Receita */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-8">
        {/* Gráfico 1: Passageiros por Hora (Ocupação) */}
        <div className="bg-white dark:bg-zinc-900 rounded-[2.5rem] p-8 border border-slate-100 dark:border-zinc-800 shadow-sm flex flex-col h-[400px]">
          <div className="flex justify-between items-center mb-6">
            <div>
              <p className="text-[9px] font-black text-slate-400 dark:text-zinc-500 uppercase tracking-widest leading-none mb-1">Ocupação Horária</p>
              <h4 className="text-sm font-black text-slate-800 dark:text-zinc-100 uppercase italic">Passageiros por Horário (Pax/Hora)</h4>
            </div>
            <span className="p-3 bg-yellow-50 dark:bg-yellow-950/20 text-yellow-600 rounded-2xl border border-yellow-250 dark:border-yellow-900/30">
              <Users size={20} />
            </span>
          </div>
          
          <div className="flex-1 w-full min-h-0">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={hourlyData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorPax" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#EAB308" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#EAB308" stopOpacity={0.0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" className="dark:stroke-zinc-800/50" />
                <XAxis dataKey="hour" fontSize={8} fontWeight="bold" stroke="#94A3B8" />
                <YAxis fontSize={8} fontWeight="bold" stroke="#94A3B8" />
                <Tooltip content={<CustomTooltip />} />
                <Area type="monotone" dataKey="passengers" name="Passageiros Transportados" stroke="#EAB308" strokeWidth={3} fillOpacity={1} fill="url(#colorPax)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Gráfico 2: Receita Distribuída por Horário */}
        <div className="bg-white dark:bg-zinc-900 rounded-[2.5rem] p-8 border border-slate-100 dark:border-zinc-800 shadow-sm flex flex-col h-[400px]">
          <div className="flex justify-between items-center mb-6">
            <div>
              <p className="text-[9px] font-black text-slate-400 dark:text-zinc-500 uppercase tracking-widest leading-none mb-1">Receita Distribuída</p>
              <h4 className="text-sm font-black text-slate-800 dark:text-zinc-100 uppercase italic">Receita por Horário de Partida (R$/Hora)</h4>
            </div>
            <span className="p-3 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 rounded-2xl border border-emerald-200 dark:border-emerald-900/30">
              <DollarSign size={20} />
            </span>
          </div>

          <div className="flex-1 w-full min-h-0">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={hourlyData} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" className="dark:stroke-zinc-800/50" />
                <XAxis dataKey="hour" fontSize={8} fontWeight="bold" stroke="#94A3B8" />
                <YAxis fontSize={8} fontWeight="bold" stroke="#94A3B8" tickFormatter={(v) => `R$${v}`} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="revenue" name="Faturamento Líquido" fill="#10B981" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Gráfico 3: Ocupação Média por Horário */}
        <div className="bg-white dark:bg-zinc-900 rounded-[2.5rem] p-8 border border-slate-100 dark:border-zinc-800 shadow-sm flex flex-col h-[400px] lg:col-span-2 xl:col-span-1">
          <div className="flex justify-between items-center mb-6">
            <div>
              <p className="text-[9px] font-black text-slate-400 dark:text-zinc-500 uppercase tracking-widest leading-none mb-1">Média por Horário</p>
              <h4 className="text-sm font-black text-slate-800 dark:text-zinc-100 uppercase italic">Ocupação Média da Frota (Pax/Partida)</h4>
            </div>
            <span className="p-3 bg-indigo-50 dark:bg-indigo-950/20 text-indigo-600 rounded-2xl border border-indigo-200 dark:border-indigo-900/30">
              <TrendingUp size={20} />
            </span>
          </div>

          <div className="flex-1 w-full min-h-0">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={averageOccupancyData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" className="dark:stroke-zinc-800/50" />
                <XAxis dataKey="hour" fontSize={8} fontWeight="bold" stroke="#94A3B8" />
                <YAxis fontSize={8} fontWeight="bold" stroke="#94A3B8" />
                <Tooltip content={<CustomTooltip />} />
                <Line type="monotone" dataKey="occupancy" name="Ocupação Média" stroke="#6366F1" strokeWidth={3} dot={{ stroke: '#6366F1', strokeWidth: 2, r: 3 }} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-zinc-900 rounded-[2.5rem] p-8 border border-slate-100 dark:border-zinc-800 shadow-sm">
         <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
            <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 dark:text-zinc-500 flex items-center gap-2"><Bus size={18} className="text-yellow-600"/> Monitoramento Diário</h3>
            <div className="flex-1 w-full sm:max-w-xs relative">
                <Search className="absolute left-3 top-3 text-slate-400" size={16} />
                <input 
                    type="text" 
                    placeholder="Buscar viagem..." 
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-50 dark:bg-zinc-800 border-none text-[9px] font-black uppercase outline-none shadow-inner dark:text-zinc-300"
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                />
            </div>
            <div className="flex items-center gap-2 bg-slate-50 dark:bg-zinc-800 px-3 py-1 rounded-full text-[8px] font-black uppercase text-slate-400">
                <Clock size={12}/> AGORA: {new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
            </div>
         </div>
         <div className="space-y-4">
             {activeTodayTrips.length === 0 ? (
                 <div className="py-12 text-center text-[10px] font-black text-slate-300 uppercase italic tracking-widest">Nenhuma programação localizada.</div>
             ) : (
                activeTodayTrips.map(trip => {
                    const r = routes.find(ro => ro.id === trip.route_id);
                    return (
                        <div key={trip.id} className={`flex flex-col md:flex-row md:items-center justify-between p-6 rounded-3xl border transition-all ${trip.status === 'Em Rota' ? 'bg-yellow-50 dark:bg-yellow-900/10 border-yellow-200 dark:border-yellow-900/30 shadow-md' : 'bg-slate-50 dark:bg-zinc-800/50 border-slate-100 dark:border-zinc-800'}`}>
                            <div className="flex items-center gap-4">
                                <span className="bg-slate-900 text-yellow-400 font-mono font-black px-4 py-2 rounded-2xl text-lg border-2 border-slate-800">{trip.departure_time}</span>
                                <div>
                                    <p className="text-xs font-black text-slate-800 dark:text-zinc-100 uppercase italic leading-none mb-1">{r?.origin} <ArrowRight size={12} className="inline"/> {r?.destination}</p>
                                    <p className="text-[9px] text-slate-400 dark:text-zinc-500 font-bold uppercase">Veículo #{trip.bus_number} • {trip.driver_name}</p>
                                </div>
                            </div>
                            <div className="flex gap-4 items-center">
                                {trip.status === 'Em Rota' && (
                                    <div className="text-right">
                                        <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Rec. Acumulada</p>
                                        <p className="text-sm font-black text-emerald-600">R$ {(Object.values(trip.passengers || {}).reduce((acc: number, p: any) => acc + (p.pagantes + p.vale_transporte + (p.imp_card*0.7)) * (r?.price||0), 0) as number).toFixed(2)}</p>
                                    </div>
                                )}
                                <span className={`px-4 py-2 rounded-xl text-[8px] font-black uppercase ${trip.status === 'Em Rota' ? 'bg-yellow-400 text-slate-900 animate-pulse' : trip.status === 'Concluída' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 dark:bg-zinc-700 text-slate-500'}`}>{trip.status}</span>
                            </div>
                        </div>
                    )
                })
             )}
         </div>
      </div>
    </div>
  );
};

export default Dashboard;
