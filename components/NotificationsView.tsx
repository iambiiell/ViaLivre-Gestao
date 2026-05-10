
import React, { useState, useEffect } from 'react';
import { Bell, Info, AlertTriangle, CheckCircle2, Calendar, Trash2, Loader2, Inbox } from 'lucide-react';
import { supabase } from '../services/database';
import { Notice, User } from '../types';

interface NotificationsViewProps {
  currentUser: User | null;
}

const NotificationsView: React.FC<NotificationsViewProps> = ({ currentUser }) => {
  const [notices, setNotices] = useState<Notice[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchUserNotices();
  }, [currentUser]);

  const fetchUserNotices = async () => {
    try {
      setIsLoading(true);
      const userRole = currentUser?.role || 'PASSENGER';
      
      let query = supabase
        .from('notices')
        .select('*');
      
      if (currentUser?.role !== 'ADMIN') {
        query = query.or(`target_role.eq.ALL,target_role.eq.${userRole}`);
      }
      
      if (currentUser?.system_id) {
        query = query.eq('system_id', currentUser.system_id);
      }

      const { data, error } = await query.order('created_at', { ascending: false });

      if (error) throw error;
      setNotices(data || []);
    } catch (error) {
      console.error('Erro ao buscar notificações:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getIcon = (category: string) => {
    switch (category?.toUpperCase()) {
      case 'URGENTE': return <AlertTriangle className="text-red-500" size={24} />;
      case 'SISTEMA': return <Info className="text-blue-500" size={24} />;
      case 'RH': return <CheckCircle2 className="text-emerald-500" size={24} />;
      default: return <Bell className="text-yellow-500" size={24} />;
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in duration-500 pb-20">
      <div className="bg-white dark:bg-zinc-900 p-8 rounded-[2.5rem] shadow-sm border border-slate-100 dark:border-zinc-800">
        <h2 className="text-3xl font-black text-slate-800 dark:text-zinc-100 uppercase italic leading-none">Minhas Notificações</h2>
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-2">Avisos e alertas importantes para você</p>
      </div>

      <div className="space-y-4">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20 bg-white dark:bg-zinc-900 rounded-[2.5rem] border border-slate-100 dark:border-zinc-800 shadow-sm">
            <Loader2 className="animate-spin text-yellow-500 mb-4" size={48} />
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Buscando seus avisos...</p>
          </div>
        ) : notices.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 bg-white dark:bg-zinc-900 rounded-[2.5rem] border border-slate-100 dark:border-zinc-800 shadow-sm">
            <Inbox className="text-slate-200 dark:text-zinc-800 mb-4" size={64} />
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Você não tem notificações no momento</p>
          </div>
        ) : (
          notices.map((notice) => (
            <div key={notice.id} className="bg-white dark:bg-zinc-900 p-6 rounded-3xl border border-slate-100 dark:border-zinc-800 shadow-sm hover:shadow-md transition-all flex gap-6 items-start">
              <div className="p-4 bg-slate-50 dark:bg-zinc-800 rounded-2xl shrink-0">
                {getIcon(notice.category)}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1">
                    <Calendar size={12} />
                    {new Date(notice.created_at || '').toLocaleString('pt-BR')}
                  </span>
                  {notice.target_role === 'ALL' && (
                    <span className="px-2 py-0.5 bg-blue-50 text-blue-600 rounded text-[7px] font-black uppercase tracking-widest">Público</span>
                  )}
                </div>
                <h3 className="text-lg font-black text-slate-900 dark:text-white uppercase italic leading-tight mb-2">{notice.title}</h3>
                <p className="text-sm text-slate-600 dark:text-zinc-400 leading-relaxed">{notice.content}</p>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default NotificationsView;
