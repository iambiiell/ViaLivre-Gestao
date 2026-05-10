
import React, { useState, useMemo } from 'react';
import { Bell, Search, Filter, CheckCircle2, AlertTriangle, Info, Trash2, Clock, Settings, Plus, X, Save, Loader2 } from 'lucide-react';
import { AppNotification, User } from '../types';
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
    try {
      await db.update('notifications', { id, is_read: true });
      onRefresh();
    } catch (e) {
      addToast("Erro ao marcar como lida.", "error");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Excluir esta notificação?')) return;
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
    }
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

  return (
    <div className="space-y-6 animate-in fade-in transition-all pb-24">
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
          filteredNotifications.map((n) => (
            <div 
              key={n.id} 
              onClick={() => onNotificationClick?.(n)}
              className={`bg-white dark:bg-zinc-900 p-6 rounded-[2rem] border-2 transition-all flex items-start gap-6 group cursor-pointer ${
                n.is_read ? 'border-slate-100 dark:border-zinc-800 opacity-75' : 'border-yellow-400 shadow-lg'
              } hover:border-yellow-500`}
            >
              <div className={`p-4 rounded-2xl shrink-0 ${
                n.type === 'ERROR' ? 'bg-red-50 text-red-500' : 
                n.type === 'WARNING' ? 'bg-orange-50 text-orange-500' : 
                'bg-blue-50 text-blue-500'
              }`}>
                {n.type === 'ERROR' ? <AlertTriangle size={24}/> : 
                 n.type === 'WARNING' ? <Clock size={24}/> : 
                 <Info size={24}/>}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <h3 className="font-black text-slate-800 dark:text-zinc-100 uppercase text-sm leading-tight">{n.title}</h3>
                    <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mt-1">
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
          ))
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
                  { id: 'occurrence', label: 'Novas Ocorrências' }
                ].map(item => (
                  <label key={item.id} className="flex items-center justify-between p-4 bg-slate-50 dark:bg-zinc-900 rounded-2xl border border-slate-100 dark:border-zinc-800 cursor-pointer hover:border-yellow-400 transition-all">
                    <span className="text-[10px] font-black text-slate-700 dark:text-zinc-300 uppercase">{item.label}</span>
                    <input type="checkbox" defaultChecked className="w-5 h-5 accent-yellow-400" />
                  </label>
                ))}
              </div>

              <button 
                onClick={() => { addToast("Configurações de alerta salvas!", "success"); setIsConfigModalOpen(false); }}
                className="w-full py-4 bg-yellow-400 text-slate-900 rounded-2xl font-black uppercase text-xs shadow-xl active:scale-95 border-2 border-slate-900 transition-all"
              >
                Salvar Preferências
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationManager;
