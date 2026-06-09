
import React from 'react';
import { LayoutDashboard, Map, Calendar, LogOut, UsersRound, Building2, ShieldCheck, Bus, ClipboardList, MapPin, UserCircle, X, Menu, Bell, Sun, Moon, BusFront, BarChart, Wrench, Ticket, ClipboardCheck, Settings2, Timer, Banknote, Briefcase, HelpCircle, Headphones, Sparkles, ShieldAlert, Key, CreditCard, PlayCircle, DollarSign, Activity, Palette } from 'lucide-react';
import { ViewState, User, ThemeMode, RoleConfig, SystemSettings } from '../types';

interface SidebarProps {
  currentView: ViewState;
  onChangeView: (view: ViewState) => void;
  onLogout: () => void;
  isOpen: boolean;
  onClose: () => void;
  onToggle: () => void;
  currentUser: User | null;
  userRoleConfig?: RoleConfig | null;
  onUpdateUser?: (user: User) => void;
  themeMode?: ThemeMode;
  onToggleTheme?: () => void;
  unreadNotificationsCount?: number;
  systemSettings?: SystemSettings | null;
  onUpdateSettings?: (settings: any) => void;
  onChangeThemeMode?: (theme: ThemeMode) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ currentView, onChangeView, onLogout, isOpen, onClose, onToggle, currentUser, userRoleConfig, themeMode, onToggleTheme, unreadNotificationsCount = 0, systemSettings, onUpdateSettings, onChangeThemeMode }) => {
  const [showThemePopup, setShowThemePopup] = React.useState(false);
  const allMenuItems = [
    { id: 'operation-center', label: 'CENTRO OPERACIONAL', icon: PlayCircle },
    { id: 'monitoring', label: 'MONITORAMENTO', icon: Activity },
    { id: 'dashboard', label: 'PAINEL GERAL', icon: LayoutDashboard, accessKey: 'access_dashboard' },
    { id: 'management', label: 'GESTÃO GLOBAL', icon: Briefcase, accessKey: 'access_global_management' },
    { id: 'skins', label: 'REPOSITÓRIO DE SKINS', icon: Bus, accessKey: 'access_skins' },
    { id: 'reports-view', label: 'RELATÓRIOS', icon: BarChart },
    { id: 'time-tracking', label: 'PONTO ELETRÔNICO', icon: Timer },
    { id: 'payroll', label: 'HOLERITES (RH)', icon: Banknote },
    { id: 'ticketing', label: 'GUICHÊ DE VENDAS', icon: Ticket, accessKey: 'access_sales' },
    { id: 'ticketing-config', label: 'GESTÃO GUICHÊ', icon: Settings2 },
    { id: 'notices', label: 'MURAL DE AVISOS', icon: Bell },
    { id: 'observations', label: 'OCORRÊNCIAS', icon: ClipboardList },
    { id: 'inspections', label: 'VISTORIAS', icon: ClipboardCheck },
    { id: 'maintenance', label: 'MANUTENÇÃO', icon: Wrench },
    { id: 'companies', label: 'EMPRESAS', icon: Building2 },
    { id: 'cities', label: 'MUNICÍPIOS', icon: MapPin },
    { id: 'bus-stations', label: 'RODOVIÁRIAS', icon: Building2 },
    { id: 'routes', label: 'ITINERÁRIOS', icon: Map },
    { id: 'schedule', label: 'ESCALA DE VIAGENS', icon: Calendar },
    { id: 'dispatcher', label: 'DESPACHANTE', icon: ShieldCheck, accessKey: 'access_dispatcher' },
    { id: 'sac', label: 'Vale Transporte', icon: Headphones },
    { id: 'work-with-us', label: 'TRABALHE CONOSCO', icon: Briefcase },
    { id: 'vehicles', label: 'FROTA DE ÔNIBUS', icon: Bus },
    { id: 'drivers', label: 'COLABORADORES', icon: UsersRound },
    { id: 'recruitment', label: 'RECRUTAMENTO (RH)', icon: Briefcase },
    { id: 'users', label: 'CONTROLE DE ACESSOS', icon: ShieldCheck },
    { id: 'subscriptions', label: 'ASSINATURAS (MASTER)', icon: ShieldAlert },
    { id: 'my-subscription', label: 'MINHA ASSINATURA', icon: CreditCard },
    { id: 'notifications', label: 'ALERTAS E AVISOS', icon: Bell },
    { id: 'about', label: 'SOBRE O SISTEMA', icon: HelpCircle },
  ];

  const filteredItems = allMenuItems.filter(item => {
    const isMasterEmail = currentUser?.email === 'suporte@vialivre.com.br' || currentUser?.email === 'consorcio.imperial.ltda@gmail.com';

    // Case-insensitive role and job title check
    const userRole = (currentUser?.role || '').toUpperCase();
    const userJob = (currentUser?.job_title || '').toUpperCase();
    const isOperationEligible = 
      userRole === 'ADMIN' || 
      userJob.includes('ADMINISTRADOR') ||
      userRole === 'DRIVER' || 
      userRole === 'CONDUCTOR' ||
      userJob.includes('MOTORISTA URBANO') || 
      userJob.includes('MOTORISTA RODOVIÁRIO') || 
      userJob.includes('MOTORISTA RODOVIARIO') ||
      userJob.includes('COBRADOR');

    if (item.id === 'operation-center') {
      return isOperationEligible;
    }

    if (item.id === 'subscriptions') {
      return currentUser?.email === 'via.nicolau.sa@gmail.com';
    }

    if (item.id === 'my-subscription') {
      return userRole === 'ADMIN';
    }

    if (userRole === 'ADMIN') return true;
    
    // Check role-based access booleans
    if (userRoleConfig && (item as any).accessKey) {
      const key = (item as any).accessKey;
      if (!(userRoleConfig as any)[key]) return false;
    }

    if (currentUser?.permissions && currentUser.permissions.length > 0) {
      return currentUser.permissions.includes(item.id as ViewState);
    }
    // Fallback to old role-based logic if no specific permissions
    const legacyRoles: Record<string, string[]> = {
      'operation-center': ['ADMIN', 'DRIVER', 'CONDUCTOR', 'FISCAL', 'Motorista Urbano', 'Motorista Rodoviário', 'Cobrador', 'URBANO', 'RODOVIARIO', 'COBRADOR'],
      'dashboard': ['ADMIN'],
      'management': ['ADMIN', 'RH'],
      'reports-view': ['ADMIN', 'FISCAL'],
      'time-tracking': ['ADMIN', 'DRIVER', 'CONDUCTOR', 'MECHANIC', 'FISCAL', 'TICKET_AGENT', 'RH', 'Motorista Urbano', 'Motorista Rodoviário', 'Cobrador', 'URBANO', 'RODOVIARIO', 'COBRADOR'],
      'payroll': ['ADMIN', 'RH'],
      'ticketing': ['ADMIN', 'TICKET_AGENT', 'CONDUCTOR', 'Cobrador', 'COBRADOR'],
      'ticketing-config': ['ADMIN'],
      'notices': ['ADMIN', 'RH', 'Motorista Urbano', 'Motorista Rodoviário', 'Cobrador', 'URBANO', 'RODOVIARIO', 'COBRADOR'],
      'observations': ['ADMIN', 'MECHANIC', 'Motorista Urbano', 'Motorista Rodoviário', 'Cobrador', 'URBANO', 'RODOVIARIO', 'COBRADOR'],
      'inspections': ['ADMIN', 'MECHANIC', 'FISCAL', 'Motorista Urbano', 'Motorista Rodoviário', 'Cobrador', 'URBANO', 'RODOVIARIO', 'COBRADOR'],
      'maintenance': ['ADMIN', 'MECHANIC'],
      'companies': ['ADMIN'],
      'cities': ['ADMIN'],
      'bus-stations': ['ADMIN'],
      'routes': ['ADMIN'],
      'schedule': ['ADMIN', 'FISCAL', 'DRIVER', 'CONDUCTOR', 'Motorista Urbano', 'Motorista Rodoviário', 'Cobrador', 'URBANO', 'RODOVIARIO', 'COBRADOR'],
      'shifts': ['ADMIN', 'RH'],
      'vehicles': ['ADMIN', 'MECHANIC'],
      'drivers': ['ADMIN', 'RH'],
      'recruitment': ['ADMIN', 'RH'],
      'skins': ['ADMIN', 'FISCAL', 'DRIVER', 'CONDUCTOR', 'Motorista Urbano', 'Motorista Rodoviário', 'Cobrador', 'URBANO', 'RODOVIARIO', 'COBRADOR'],
      'users': ['ADMIN'],
      'sac': ['ADMIN', 'FISCAL', 'TICKET_AGENT', 'RH', 'DRIVER', 'CONDUCTOR', 'MECHANIC', 'Motorista Urbano', 'Motorista Rodoviário', 'Cobrador', 'URBANO', 'RODOVIARIO', 'COBRADOR'],
      'work-with-us': ['ADMIN', 'RH', 'FISCAL', 'TICKET_AGENT', 'DRIVER', 'CONDUCTOR', 'MECHANIC', 'Motorista Urbano', 'Motorista Rodoviário', 'Cobrador', 'URBANO', 'RODOVIARIO', 'COBRADOR'],
      'notifications': ['ADMIN', 'RH', 'FISCAL', 'MECHANIC', 'TICKET_AGENT', 'DRIVER', 'CONDUCTOR', 'Motorista Urbano', 'Motorista Rodoviário', 'Cobrador', 'URBANO', 'RODOVIARIO', 'COBRADOR']
    };
    return legacyRoles[item.id]?.includes(userRole) || false;
  }).sort((a, b) => {
    // Custom sort: dashboard first, then operation-center, about last, others alphabetical
    if (a.id === 'dashboard') return -1;
    if (b.id === 'dashboard') return 1;
    if (a.id === 'operation-center') return -1;
    if (b.id === 'operation-center') return 1;
    if (a.id === 'about') return 1;
    if (b.id === 'about') return -1;
    return a.label.localeCompare(b.label);
  });

  return (
    <>
    <div className="fixed top-0 left-0 w-full h-12 sm:h-14 shadow-sm z-40 flex items-center justify-between px-2 sm:px-10 border-b bg-white/95 dark:bg-zinc-950/95 backdrop-blur-md border-slate-100 dark:border-zinc-800 transition-colors">
      <div className="flex items-center gap-1 sm:gap-8">
        <button onClick={onToggle} className="p-1.5 sm:p-2 rounded-2xl text-slate-600 dark:text-zinc-400 hover:bg-slate-50 dark:hover:bg-zinc-900 transition-all flex"><Menu size={18} className="sm:w-5 sm:h-5" /></button>
        <div className="flex items-center gap-1.5 sm:gap-3">
            <div className="logo-sistema h-7 sm:h-9 flex items-center justify-center transition-all">
                <img 
                  src="https://kkvmtqthahbcobsqmugl.supabase.co/storage/v1/object/public/assets/Logo_ViaLivre.png" 
                  className="h-full w-auto object-contain" 
                  alt="ViaLivre Gestão" 
                  referrerPolicy="no-referrer" 
                />
            </div>
            <h1 className="text-lg sm:text-xl font-black tracking-tighter text-slate-900 dark:text-white uppercase italic leading-none transition-colors">
              {systemSettings?.system_name ? (
                (systemSettings.system_name.includes('Viação Nicolau S/A') || 
                 systemSettings.system_name.includes('Grupo D\'Rio') || 
                 systemSettings.system_name.toLowerCase().includes('vialivre')) ? (
                  <>Via<span className="text-yellow-500">Livre</span> Gestão</>
                ) : (
                  systemSettings.system_name
                )
              ) : (
                <>Via<span className="text-yellow-500">Livre</span> Gestão</>
              )}
            </h1>
        </div>
      </div>
      
      <div className="flex items-center gap-2 sm:gap-6">
        <button onClick={() => onChangeView('notifications')} className="p-2 sm:p-2 text-slate-400 dark:text-zinc-500 hover:bg-slate-50 dark:hover:bg-zinc-900 rounded-2xl transition-all relative" title="Notificações">
          <Bell size={20} className="sm:w-5 sm:h-5" />
          {unreadNotificationsCount > 0 && (
            <span className="absolute top-1 right-1 sm:top-2 sm:right-2 w-4 h-4 sm:w-5 sm:h-5 bg-red-500 text-white text-[8px] sm:text-[10px] font-black flex items-center justify-center rounded-full border-2 border-white dark:border-zinc-950 animate-bounce">
              {unreadNotificationsCount > 9 ? '9+' : unreadNotificationsCount}
            </span>
          )}
        </button>
        <button onClick={() => setShowThemePopup(true)} className="p-2 sm:p-2 text-slate-400 dark:text-zinc-500 hover:bg-slate-50 dark:hover:bg-zinc-900 rounded-2xl transition-all" title="Preferências de Design e Cores">
          {themeMode === 'light' ? <Moon size={20} className="sm:w-5 sm:h-5" /> : <Sun size={20} className="text-yellow-400 sm:w-5 sm:h-5" />}
        </button>
        {currentUser && (
            <div className="flex items-center gap-2 sm:gap-3 pr-1 sm:pr-2 py-1 rounded-2xl hover:bg-slate-50 dark:hover:bg-zinc-900 transition-all cursor-pointer">
                <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl sm:rounded-2xl bg-yellow-400 flex items-center justify-center border-2 border-white dark:border-zinc-800 overflow-hidden shadow-sm transition-colors">
                    {currentUser.photo_url ? <img src={currentUser.photo_url} className="w-full h-full object-cover" alt="Perfil"/> : <UserCircle size={20} className="text-white sm:w-5 sm:h-5"/>}
                </div>
                <div className="hidden md:block text-left">
                    <p className="text-[10px] font-black uppercase text-slate-800 dark:text-zinc-100 leading-none">{currentUser.full_name?.split(' ')[0]}</p>
                    <p className="text-[8px] font-black text-yellow-600 uppercase tracking-widest mt-1">
                      {currentUser.role === 'RH' ? 'REC. HUMANOS' : 
                       (currentUser.role === 'ADMIN' || currentUser.is_full_admin || currentUser.job_title?.toUpperCase().includes('ADMINISTRADOR')) ? 'ADMINISTRADOR' : 
                       currentUser.role}
                    </p>
                </div>
            </div>
        )}
        <div className="w-px h-6 sm:h-6 bg-slate-100 dark:bg-zinc-800 mx-1 sm:mx-2 hidden sm:block"></div>
        <button onClick={onLogout} className="p-2 sm:p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-2xl transition-all" title="Sair do Sistema"><LogOut size={20} className="sm:w-5 sm:h-5" /></button>
      </div>
    </div>

    {isOpen && <div className="fixed inset-0 bg-slate-900/40 dark:bg-black/60 backdrop-blur-sm z-50 animate-in fade-in" onClick={onClose} />}

    <div className={`fixed inset-y-0 left-0 w-[85%] max-w-[320px] shadow-2xl z-[60] transform transition-transform duration-500 ease-out border-r flex flex-col ${isOpen ? 'translate-x-0' : '-translate-x-full'} bg-white dark:bg-zinc-950 border-slate-100 dark:border-zinc-800 transition-colors`}>
        <div className="h-14 flex items-center justify-between px-8 border-b bg-slate-50/50 dark:bg-zinc-900/30 transition-colors">
            <div className="flex items-center gap-3">
                <div className="logo-sistema w-8 h-8 flex items-center justify-center overflow-hidden">
                  {systemSettings?.system_logo ? (
                    <img 
                      src={systemSettings.system_logo} 
                      className="h-full w-auto object-contain" 
                      alt="Logo" 
                      referrerPolicy="no-referrer" 
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none';
                        const parent = (e.target as HTMLImageElement).parentElement;
                        if (parent) {
                          const span = document.createElement('span');
                          span.className = 'text-[8px] font-black uppercase italic text-slate-900 dark:text-white';
                          span.innerText = systemSettings?.system_name?.[0] || 'V';
                          parent.appendChild(span);
                        }
                      }}
                    />
                  ) : (
                    <BusFront size={24} className="text-yellow-500" />
                  )}
                </div>
                <span className="font-black text-[11px] tracking-[0.2em] uppercase text-slate-900 dark:text-white italic">
                  Menu {(systemSettings?.system_name?.includes('Viação Nicolau S/A') || systemSettings?.system_name?.includes('Grupo D\'Rio') || systemSettings?.system_name?.includes('ViaLivre')) ? 'ViaLivre Gestão' : (systemSettings?.system_name || 'ViaLivre Gestão')}
                </span>
            </div>
            <button onClick={onClose} className="p-2 text-slate-400 hover:text-yellow-600 transition-colors"><X size={24} /></button>
        </div>
        <div className="flex-1 overflow-y-auto py-6 px-4 space-y-1 custom-scrollbar">
            {filteredItems.map((item) => {
                const Icon = item.icon;
                const isActive = currentView === item.id;
                return (
                <button key={item.id} onClick={() => { onChangeView(item.id as any); onClose(); }} className={`w-full flex items-center gap-4 px-5 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all group ${isActive ? 'bg-yellow-400 text-slate-900 shadow-xl' : 'text-slate-400 dark:text-zinc-500 hover:bg-slate-50 dark:hover:bg-zinc-900'}`}>
                    <Icon size={18} className={isActive ? 'text-slate-900' : 'group-hover:text-yellow-500'} />
                    <span>{item.label}</span>
                </button>
                );
            })}
        </div>
        <div className="p-6 border-t dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-900/30 transition-colors">
            <button 
                onClick={() => {
                    const phone = systemSettings?.support_phone?.replace(/\D/g, '') || '5524978358199';
                    const name = (systemSettings?.system_name?.includes('Viação Nicolau S/A') || systemSettings?.system_name?.includes('Grupo D\'Rio') || systemSettings?.system_name?.includes('ViaLivre')) ? 'Viação Nicolau S/A' : (systemSettings?.system_name || 'Viação Nicolau S/A');
                    window.open(`https://wa.me/${phone}?text=Olá,%20preciso%20de%20suporte%20no%20sistema%20${encodeURIComponent(name)}`, '_blank');
                }}
                className="w-full flex items-center justify-center gap-3 py-4 bg-slate-900 dark:bg-zinc-800 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl hover:bg-black transition-all"
            >
                <HelpCircle size={18} className="text-yellow-400" />
                Acionar Suporte
            </button>
        </div>
    </div>

    {showThemePopup && (
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-200">
        <div className="bg-white dark:bg-zinc-900 w-full max-w-md rounded-[2.5rem] shadow-2xl border-4 border-yellow-400 p-8 relative overflow-hidden transition-all animate-in zoom-in-95">
          {/* Header */}
          <div className="flex justify-between items-center pb-6 border-b border-slate-100 dark:border-zinc-800">
            <div className="flex items-center gap-2.5">
              <Palette className="text-yellow-400 animate-pulse" size={24} />
              <h2 className="text-xl font-black uppercase italic tracking-tighter text-slate-950 dark:text-white">Design e Cores</h2>
            </div>
            <button onClick={() => setShowThemePopup(false)} className="p-1.5 bg-slate-50 dark:bg-zinc-800 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/20 text-slate-400 hover:text-red-500 transition-all">
              <X size={20} />
            </button>
          </div>

          {/* Content */}
          <div className="mt-6 space-y-6">
            {/* Theme Preset Toggles */}
            <div>
              <label className="block text-[10px] font-black uppercase text-slate-400 mb-3 tracking-widest leading-none">Aparência do Painel</label>
              <div className="grid grid-cols-2 gap-3">
                <button 
                  type="button" 
                  onClick={() => onChangeThemeMode?.('light')}
                  className={`p-4 rounded-xl border-2 font-black uppercase text-[10px] tracking-wider transition-all flex items-center justify-center gap-2 ${themeMode === 'light' ? 'border-yellow-400 bg-yellow-50/20 text-slate-900' : 'border-slate-100 dark:border-zinc-800 text-slate-400 hover:border-slate-200'}`}
                >
                  <Sun size={16} className={themeMode === 'light' ? 'text-yellow-500' : ''} />
                  Modo Claro
                </button>
                <button 
                  type="button" 
                  onClick={() => onChangeThemeMode?.('dark')}
                  className={`p-4 rounded-xl border-2 font-black uppercase text-[10px] tracking-wider transition-all flex items-center justify-center gap-2 ${themeMode === 'dark' ? 'border-yellow-400 bg-yellow-400/10 text-white animate-pulse' : 'border-slate-100 dark:border-zinc-800 text-slate-400 hover:border-slate-800'}`}
                >
                  <Moon size={16} className={themeMode === 'dark' ? 'text-yellow-400' : ''} />
                  Modo Escuro
                </button>
              </div>
            </div>

            {/* Accessibility Options */}
            <div>
              <label className="block text-[10px] font-black uppercase text-slate-400 mb-3 tracking-widest leading-none">Acessibilidade</label>
              <button 
                type="button" 
                onClick={() => {
                  if (systemSettings && onUpdateSettings) {
                    onUpdateSettings({ ...systemSettings, high_contrast: !systemSettings.high_contrast });
                  }
                }}
                className={`p-4 rounded-xl border-2 font-black uppercase text-[10px] tracking-wider transition-all flex items-center justify-between w-full ${systemSettings?.high_contrast ? 'border-yellow-400 bg-yellow-400/10 text-slate-950 dark:text-yellow-400 font-black' : 'border-slate-100 dark:border-zinc-800 text-slate-400 hover:border-slate-200 bg-transparent'}`}
              >
                <span className="flex items-center gap-2 font-black">
                  <span className="w-4 h-4 rounded-full border-2 border-current bg-transparent flex items-center justify-center text-[8px] font-black">A</span>
                  Alto Contraste
                </span>
                <span className={`text-[8px] font-black px-2 py-1 rounded-lg uppercase ${systemSettings?.high_contrast ? 'bg-yellow-400 text-slate-950 border border-slate-950' : 'bg-slate-100 dark:bg-zinc-800 text-slate-400'}`}>
                  {systemSettings?.high_contrast ? 'Ativado' : 'Desativado'}
                </span>
              </button>
              <p className="mt-2 text-[8px] font-bold text-slate-400 uppercase italic leading-tight ml-2">Melhora a legibilidade do sistema para motoristas em ambientes externos sob luz solar direta.</p>
            </div>

            {/* Accent Color Palette Selector */}
            <div>
              <label className="block text-[10px] font-black uppercase text-slate-400 mb-3 tracking-widest leading-none block">Paleta de Cores Primária</label>
              <div className="grid grid-cols-1 gap-2 max-h-[220px] overflow-y-auto pr-1">
                {[
                  { id: 'yellow', name: 'Amarelo Padrão (Nicolau)', bg: 'bg-[#facc15]' },
                  { id: 'blue', name: 'Azul Corporativo', bg: 'bg-[#3b82f6]' },
                  { id: 'indigo', name: 'Índigo Moderno', bg: 'bg-[#6366f1]' },
                  { id: 'emerald', name: 'Verde Esmeralda', bg: 'bg-[#10b981]' },
                  { id: 'rose', name: 'Rosa Elegante', bg: 'bg-[#ec4899]' }
                ].map(palette => {
                  const isSelected = (systemSettings?.theme_color || 'yellow') === palette.id;
                  return (
                    <button
                      type="button"
                      key={palette.id}
                      onClick={() => {
                        if (systemSettings && onUpdateSettings) {
                          onUpdateSettings({ ...systemSettings, theme_color: palette.id });
                        }
                      }}
                      className={`p-3 rounded-xl border-2 transition-all flex items-center justify-between w-full ${
                        isSelected 
                          ? 'border-yellow-400 bg-slate-50 dark:bg-zinc-800/30' 
                          : 'border-slate-100 dark:border-zinc-800/60 hover:border-slate-300 dark:hover:border-zinc-700 bg-transparent'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-5 h-5 rounded-full ${palette.bg} shadow-md`} />
                        <span className="text-[10px] font-black uppercase tracking-wider text-slate-800 dark:text-zinc-200">{palette.name}</span>
                      </div>
                      {isSelected && (
                        <span className="text-[8px] font-black uppercase tracking-widest text-[#eab308] dark:text-yellow-400 px-2.5 py-1 bg-yellow-400/10 rounded-lg">Selecionado</span>
                      )}
                    </button>
                  );
                })}
              </div>
              <p className="text-[8px] font-bold text-slate-400 uppercase italic mt-3 leading-tight text-center">Muda as cores de realce globalmente de forma instantânea para toda a interface do sistema.</p>
            </div>
          </div>
        </div>
      </div>
    )}
    </>
  );
};

export default Sidebar;
