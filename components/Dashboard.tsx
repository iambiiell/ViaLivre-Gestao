
import React, { useState, useMemo } from 'react';
import { Building2, PlayCircle, Users, DollarSign, Bus, TrendingUp, Clock, Calendar, ArrowRight, Search, AlertTriangle, ExternalLink } from 'lucide-react';
import { Trip, BusRoute, Company, IssueReport, City, PassengerDetails, Subscription } from '../types';

interface DashboardProps {
  allTrips: Trip[];
  routes: BusRoute[];
  companies: Company[];
  cities: City[];
  reports: IssueReport[];
  subscription?: Subscription | null;
}

const formatDateBr = (dateStr: string) => {
    if (!dateStr) return '---';
    const [y, m, d] = dateStr.split('-');
    return `${d}.${m}.${y}`;
};

const StatCard: React.FC<{ title: string; value: string; icon: React.ReactNode; color: string; textColor: string }> = ({ title, value, icon, color, textColor }) => (
  <div className="bg-white dark:bg-zinc-900 p-6 rounded-[2.5rem] shadow-sm border border-slate-100 dark:border-zinc-800 flex items-center justify-between group transition-colors">
    <div>
      <p className="text-[9px] font-black text-black dark:text-zinc-500 uppercase tracking-[0.2em] mb-1">{title}</p>
      <h3 className="text-2xl font-black text-slate-800 dark:text-white leading-none tracking-tighter">{value}</h3>
    </div>
    <div className={`w-14 h-14 rounded-2xl ${color} ${textColor} shadow-lg flex items-center justify-center transition-transform group-hover:rotate-12 border-2 border-slate-900 dark:border-zinc-800`}>
      {icon}
    </div>
  </div>
);

const Dashboard: React.FC<DashboardProps> = ({ allTrips = [], routes = [], companies = [], subscription }) => {
  const [filterCompanyId, setFilterCompanyId] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState('');

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
                Reative seu plano agora para evitar o bloqueio de acesso para você e sua equipe.
              </p>
            </div>
          </div>
          <button 
            onClick={() => window.dispatchEvent(new CustomEvent('change-view', { detail: 'my-subscription' }))}
            className="px-6 py-3 bg-red-600 text-white rounded-xl font-black uppercase text-[10px] tracking-widest hover:bg-red-700 transition-all flex items-center gap-2 shadow-md active:scale-95 shrink-0"
          >
            Reativar Plano <ExternalLink size={14} />
          </button>
        </div>
      )}

      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
          <div>
              <h2 className="text-2xl md:text-3xl font-black text-slate-800 dark:text-white uppercase italic leading-none">Visão Operacional</h2>
              <p className="text-[10px] text-yellow-600 font-black uppercase tracking-[0.3em] mt-2 border-l-2 border-yellow-400 pl-3">Dashboard em Tempo Real • {formatDateBr(new Date().toISOString().split('T')[0])}</p>
          </div>
          <div className="bg-white dark:bg-zinc-900 p-2 rounded-2xl border dark:border-zinc-800 flex items-center gap-2">
              <Building2 size={16} className="text-yellow-600 ml-2" />
              <select className="bg-transparent text-[10px] font-black uppercase outline-none dark:text-zinc-300" value={filterCompanyId} onChange={e => setFilterCompanyId(e.target.value)}>
                <option value="">Todo o Grupo</option>
                {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
          </div>
      </div>

      <div className="flex overflow-x-auto pb-6 gap-6 snap-x snap-mandatory md:grid md:grid-cols-2 lg:grid-cols-3 md:overflow-x-visible md:pb-0 md:snap-none custom-scrollbar">
        <div className="min-w-[280px] sm:min-w-[320px] md:min-w-0 snap-center flex-1">
          <StatCard title="Operação do Dia" value={summary.tripCount.toString()} icon={<PlayCircle size={24} />} color="bg-slate-900" textColor="text-white" />
        </div>
        <div className="min-w-[280px] sm:min-w-[320px] md:min-w-0 snap-center flex-1">
          <StatCard title="Pax Projetado" value={summary.totalPax.toLocaleString()} icon={<Users size={24} />} color="bg-yellow-400" textColor="text-slate-900" />
        </div>
        <div className="min-w-[280px] sm:min-w-[320px] md:min-w-0 snap-center flex-1">
          <StatCard title="Receita Líquida Estimada" value={summary.revenue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} icon={<DollarSign size={24} />} color="bg-emerald-500" textColor="text-white" />
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
