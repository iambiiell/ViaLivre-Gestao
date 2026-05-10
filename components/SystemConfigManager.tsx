
import React, { useState, useEffect } from 'react';
import { ShieldCheck, Save, Loader2, CheckCircle2, AlertTriangle, Settings2, Users, Key, Calendar, CreditCard, RefreshCw } from 'lucide-react';
import { RoleConfig, Subscription } from '../types';
import { db } from '../services/database';

interface SystemConfigManagerProps {
  addToast: (msg: string, type?: 'success' | 'error' | 'warning') => void;
}

const SystemConfigManager: React.FC<SystemConfigManagerProps> = ({ addToast }) => {
  const [roles, setRoles] = useState<RoleConfig[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [activationKey, setActivationKey] = useState('');
  const [isActivating, setIsActivating] = useState(false);

  useEffect(() => {
    loadRoles();
    loadSubscription();
  }, []);

  const loadSubscription = async () => {
    try {
      const subs = await db.getSubscriptions();
      if (subs && subs.length > 0) {
        setSubscription(subs[0]);
      }
    } catch (error) {
      console.error('Error loading subscription:', error);
    }
  };

  const handleActivateKey = async () => {
    if (!activationKey) return;
    setIsActivating(true);
    try {
      const keys = await db.getActivationKeys();
      const key = keys.find(k => k.key_code === activationKey && !k.is_used);
      
      if (!key) {
        addToast('Chave inválida ou já utilizada.', 'error');
        return;
      }

      await db.update('activation_keys', {
        ...key,
        is_used: true,
        activated_at: new Date().toISOString(),
        activated_by_system_id: db.getSystemId()
      });

      const durationMap: Record<string, number> = {
        'MONTHLY': 30,
        'QUARTERLY': 90,
        'SEMI_ANNUAL': 180,
        'ANNUAL': 365,
        'LIFETIME': 36500
      };
      
      const duration = durationMap[key.plan_type] || 30;
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + duration);

      const newSub: Partial<Subscription> = {
        system_id: db.getSystemId()!,
        plan_type: key.plan_type,
        activated_at: new Date().toISOString(),
        expires_at: expiresAt.toISOString(),
        status: 'ACTIVE',
        created_at: new Date().toISOString()
      };

      if (subscription) {
        await db.update('subscriptions', { ...subscription, ...newSub });
      } else {
        await db.create('subscriptions', newSub);
      }

      addToast('Sistema ativado com sucesso!', 'success');
      setActivationKey('');
      loadSubscription();
    } catch (error) {
      console.error('Error activating key:', error);
      addToast('Erro ao ativar sistema.', 'error');
    } finally {
      setIsActivating(false);
    }
  };

  const loadRoles = async () => {
    setIsLoading(true);
    try {
      const data = await db.getRoleConfigs();
      setRoles((data || []).sort((a, b) => a.name.localeCompare(b.name)));
    } catch (error) {
      addToast("Erro ao carregar configurações de cargos.", "error");
    } finally {
      setIsLoading(false);
    }
  };

  const handleTogglePermission = (roleId: string, field: keyof RoleConfig) => {
    setRoles(prev => prev.map(role => {
      if (role.id === roleId) {
        return { ...role, [field]: !role[field] };
      }
      return role;
    }));
  };

  const handleSaveAll = async () => {
    setIsSaving(true);
    try {
      await Promise.all(roles.map(role => db.update('role_configs', role)));
      addToast("Configurações de acesso atualizadas com sucesso!", "success");
    } catch (error) {
      addToast("Erro ao salvar configurações.", "error");
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <Loader2 className="animate-spin text-yellow-500 mb-4" size={48} />
        <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Carregando permissões...</p>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 animate-in fade-in duration-500">
      <div className="max-w-5xl mx-auto">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-10 gap-6">
          <div className="flex items-center gap-4">
            <div className="p-4 bg-slate-900 rounded-[2rem] shadow-xl border-2 border-yellow-400">
              <ShieldCheck size={32} className="text-yellow-400" />
            </div>
            <div>
              <h2 className="text-2xl font-black uppercase italic tracking-tighter dark:text-white leading-none">Gestão de Acessos</h2>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-2">Configure as abas visíveis para cada cargo do sistema</p>
            </div>
          </div>
          <button 
            onClick={handleSaveAll}
            disabled={isSaving}
            className="w-full md:w-auto px-10 py-5 bg-slate-900 dark:bg-yellow-400 text-white dark:text-slate-900 rounded-3xl font-black uppercase text-xs shadow-xl flex items-center justify-center gap-3 border-2 border-yellow-400 hover:scale-105 transition-all disabled:opacity-50"
          >
            {isSaving ? <Loader2 className="animate-spin" size={20} /> : <Save size={20} />}
            Salvar Alterações
          </button>
        </div>

        <div className="bg-white dark:bg-zinc-900 rounded-[3rem] border-2 border-slate-100 dark:border-zinc-800 shadow-sm overflow-hidden transition-colors mb-8">
          <div className="p-8 border-b dark:border-zinc-800 bg-slate-50 dark:bg-zinc-900">
            <div className="flex items-center gap-3">
              <CreditCard className="text-blue-500" size={24} />
              <h3 className="text-lg font-black uppercase italic tracking-tighter">Assinatura do Sistema</h3>
            </div>
          </div>
          <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-zinc-800 rounded-2xl border border-slate-100 dark:border-zinc-700">
                <div>
                  <p className="text-[10px] font-black uppercase text-black">Plano Atual</p>
                  <p className="text-lg font-black uppercase italic text-blue-600">
                    {subscription ? (
                      subscription.plan_type === 'MONTHLY' ? 'Mensal' :
                      subscription.plan_type === 'QUARTERLY' ? 'Trimestral' :
                      subscription.plan_type === 'SEMI_ANNUAL' ? 'Semestral' : 'Anual'
                    ) : 'Nenhum Plano Ativo'}
                  </p>
                </div>
                <div className={`px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest ${subscription?.status === 'ACTIVE' ? 'bg-emerald-100 text-emerald-600' : 'bg-red-100 text-red-600'}`}>
                  {subscription?.status === 'ACTIVE' ? 'Ativo' : 'Inativo'}
                </div>
              </div>
              {subscription && (
                <div className="flex items-center gap-4 text-slate-500">
                  <div className="flex items-center gap-2">
                    <Calendar size={14} />
                    <span className="text-[10px] font-bold uppercase">Expira em: {new Date(subscription.expires_at).toLocaleDateString('pt-BR')}</span>
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-4">
              <p className="text-[10px] font-black uppercase text-black">Ativar Nova Chave</p>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Key className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input 
                    type="text" 
                    placeholder="VL-XXXX-XXXX" 
                    className="w-full pl-12 pr-4 py-4 bg-slate-50 dark:bg-zinc-800 border-2 border-slate-100 dark:border-zinc-700 rounded-2xl text-xs font-black uppercase outline-none focus:ring-2 ring-blue-400 transition-all dark:text-white"
                    value={activationKey}
                    onChange={e => setActivationKey(e.target.value)}
                  />
                </div>
                <button 
                  onClick={handleActivateKey}
                  disabled={isActivating || !activationKey}
                  className="px-6 py-4 bg-blue-600 text-white rounded-2xl font-black uppercase text-[10px] shadow-lg active:scale-95 transition-all disabled:opacity-50 flex items-center gap-2"
                >
                  {isActivating ? <RefreshCw className="animate-spin" size={16} /> : 'Ativar'}
                </button>
              </div>
              <p className="text-[9px] font-bold text-slate-400 uppercase italic">Insira a chave fornecida pelo administrador para renovar ou alterar seu plano.</p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-zinc-900 rounded-[3rem] border-2 border-slate-100 dark:border-zinc-800 shadow-sm overflow-hidden transition-colors">
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-slate-50 dark:bg-zinc-800/50 transition-colors">
                  <th className="px-8 py-6 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest border-b dark:border-zinc-800">Cargo / Função</th>
                  <th className="px-8 py-6 text-center text-[10px] font-black text-slate-400 uppercase tracking-widest border-b dark:border-zinc-800">Vendas</th>
                  <th className="px-8 py-6 text-center text-[10px] font-black text-slate-400 uppercase tracking-widest border-b dark:border-zinc-800">Guia Motorista</th>
                  <th className="px-8 py-6 text-center text-[10px] font-black text-slate-400 uppercase tracking-widest border-b dark:border-zinc-800">Gestão Global</th>
                </tr>
              </thead>
              <tbody className="divide-y dark:divide-zinc-800">
                {roles.map((role) => (
                  <tr key={role.id} className="hover:bg-slate-50 dark:hover:bg-zinc-800/30 transition-all group">
                    <td className="px-8 py-6">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-zinc-800 flex items-center justify-center text-slate-400 group-hover:bg-yellow-400 group-hover:text-slate-900 transition-all">
                          <Users size={20} />
                        </div>
                        <div>
                          <p className="text-sm font-black uppercase italic dark:text-white">{role.name}</p>
                          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1">ID: {role.id.slice(0, 8)}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-8 py-6 text-center">
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input 
                          type="checkbox" 
                          className="sr-only peer" 
                          checked={!!role.access_sales}
                          onChange={() => handleTogglePermission(role.id, 'access_sales')}
                        />
                        <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-zinc-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-yellow-400"></div>
                      </label>
                    </td>
                    <td className="px-8 py-6 text-center">
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input 
                          type="checkbox" 
                          className="sr-only peer" 
                          checked={!!role.access_driver_guide}
                          onChange={() => handleTogglePermission(role.id, 'access_driver_guide')}
                        />
                        <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-zinc-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-yellow-400"></div>
                      </label>
                    </td>
                    <td className="px-8 py-6 text-center">
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input 
                          type="checkbox" 
                          className="sr-only peer" 
                          checked={!!role.access_global_management}
                          onChange={() => handleTogglePermission(role.id, 'access_global_management')}
                        />
                        <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-zinc-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-yellow-400"></div>
                      </label>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="mt-10 p-8 bg-blue-50 dark:bg-blue-900/20 border-2 border-dashed border-blue-200 dark:border-blue-800 rounded-[2.5rem] flex items-start gap-4">
          <div className="p-3 bg-blue-100 dark:bg-blue-900/40 rounded-2xl text-blue-600 dark:text-blue-400">
            <AlertTriangle size={24} />
          </div>
          <div>
            <h4 className="text-sm font-black uppercase italic text-blue-800 dark:text-blue-300">Atenção Admin</h4>
            <p className="text-[10px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-widest mt-2 leading-relaxed">
              As alterações feitas aqui impactam diretamente o que cada colaborador verá em seu menu lateral. 
              Certifique-se de salvar as alterações para que entrem em vigor no próximo carregamento do sistema.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SystemConfigManager;
