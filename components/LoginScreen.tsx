
import React, { useState } from 'react';
import { addMonths } from 'date-fns';
import { User, ThemeMode, UserRole, SystemSettings } from '../types';
import { BusFront, KeyRound, UserCircle, LogIn, AlertCircle, X, Loader2, Eye, EyeOff, Globe, UserPlus, ArrowLeft, ShieldCheck, Building2, Mail, Briefcase, Moon, Sun } from 'lucide-react';
import { db } from '../services/database';
import { cpfMask } from '../utils/masks';

interface LoginScreenProps {
  onLogin: (user: User) => void;
  onRegister: (user: User) => void;
  onPassengerAccess: () => void;
  themeMode: ThemeMode;
  setThemeMode: (mode: ThemeMode) => void;
  resolvedTheme: 'light' | 'dark';
  systemSettings?: SystemSettings | null;
}

const ROLES: { id: UserRole; label: string }[] = [
  { id: 'ADMIN', label: 'Administrador (Full)' },
  { id: 'DRIVER', label: 'Motorista (Operacional)' },
  { id: 'MECHANIC', label: 'Mecânico (Pátio)' },
  { id: 'FISCAL', label: 'Fiscal (Controle)' },
  { id: 'RH', label: 'RH (Colaboradores)' },
  { id: 'TICKET_AGENT', label: 'Agente de Guichê' },
];

const LoginScreen: React.FC<LoginScreenProps> = ({ onLogin, onRegister, onPassengerAccess, themeMode, setThemeMode, systemSettings }) => {
  const [isRegisterMode, setIsRegisterMode] = useState(false);
  const [loginInput, setLoginInput] = useState('');
  const [password, setPassword] = useState('');
  
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regUnidade, setRegUnidade] = useState(''); 
  const [regLogin, setRegLogin] = useState('');
  const [regPass, setRegPass] = useState('');
  const [regActivationKey, setRegActivationKey] = useState('');

  const [showPassword, setShowPassword] = useState(false);
  const [showRegPassword, setShowRegPassword] = useState(false);
  const [errorModal, setErrorModal] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanInput = loginInput.trim();
    if (!cleanInput || !password.trim()) { 
        setErrorModal("Identifique-se para continuar."); 
        return; 
    }
    
    setIsLoading(true);
    try {
        const users = await db.getAllUsers();
        const userProfile = users.find(u => 
            (u.login_acesso === cleanInput || u.cpf?.replace(/\D/g, '') === cleanInput.replace(/\D/g, '') || u.email === cleanInput) && 
            u.senha_acesso === password
        );

        if (!userProfile) { 
            setIsLoading(false); 
            setErrorModal("Credenciais incorretas ou usuário não localizado."); 
            return; 
        }

        // Ensure master admin or lifetime key users have is_full_admin
        const masterEmails = ['consorcio.imperial.ltda@gmail.com', 'suporte@vialivre.com.br'];
        const isMaster = masterEmails.includes(userProfile.email) || userProfile.login_acesso === 'master';
        
        const updatedUser = {
            ...userProfile,
            is_full_admin: isMaster || userProfile.is_full_admin || userProfile.activation_key?.includes('VITALICIO') || false
        };

        onLogin(updatedUser as User);
    } catch (e) {
        console.error(e);
        setErrorModal("Erro ao acessar servidor.");
    } finally {
        setIsLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!regName || !regEmail || !regLogin || !regPass || !regUnidade || !regActivationKey) {
          setErrorModal("Preencha todos os campos obrigatórios.");
          return;
      }

      if (regActivationKey.length !== 20) {
          setErrorModal("Chave de ativação deve ter exatamente 20 caracteres.");
          return;
      }

      setIsLoading(true);
      try {
          const keyCode = regActivationKey.trim().toUpperCase();
          console.log('Chave buscada:', keyCode);

          // Validate Activation Key
          const keys = await db.getAllActivationKeys();
          const validKey = keys.find(k => k.key_code === keyCode && !k.is_used);

          if (!validKey) {
              setErrorModal("Chave de ativação inválida ou já utilizada.");
              setIsLoading(false);
              return;
          }

          const systemId = validKey.system_id || crypto.randomUUID();
          const newUser: Partial<User> = {
              full_name: regName,
              name: regName.split(' ')[0],
              email: regEmail,
              unidade: regUnidade,
              login_acesso: regLogin.trim(),
              senha_acesso: regPass,
              role: 'ADMIN',
              is_full_admin: validKey.plan_type === 'LIFETIME' || regEmail === 'consorcio.imperial.ltda@gmail.com',
              system_id: systemId,
              job_title: 'Administrador',
              activation_key: regActivationKey
          };

          const data = await db.create('users', newUser);
          if (data) {
            // Initialize System Settings
            await db.create('system_settings', {
                system_id: systemId,
                system_name: regUnidade,
                company_name: regUnidade,
                registration_pattern: 'FLX-000'
            });

            // Initialize Main Company
            await db.create('companies', {
                system_id: systemId,
                name: regUnidade,
                active: true,
                contact_email: regEmail
            });

            // Initialize Subscription
            const durationMonths = validKey.duration_months || 1;
            let expiresAt = new Date();
            
            if (durationMonths === 999) {
                expiresAt = new Date(2099, 11, 31, 23, 59, 59);
            } else {
                expiresAt = addMonths(expiresAt, durationMonths);
            }

            const expiresAtISO = expiresAt.toISOString();

            await db.create('subscriptions', {
                system_id: systemId,
                plan_type: validKey.plan_type,
                activated_at: new Date().toISOString(),
                expires_at: expiresAtISO,
                status: 'ACTIVE',
                created_at: new Date().toISOString()
            });

            // Update Activation Key
            await db.update('activation_keys', {
                ...validKey,
                is_used: true,
                activated_at: new Date().toISOString(),
                expires_at: expiresAtISO,
                owner_email: regEmail,
                company_name: regUnidade,
                activated_by_system_id: systemId,
                activated_by_user_id: data.id,
                activated_by_name: regName
            });

            db.setSystemId(systemId);
            onRegister(data as User);
          }
          else throw new Error("Erro ao criar conta.");
      } catch (e: any) {
          console.error(e);
          setErrorModal(e.message || "Erro ao criar conta.");
      } finally {
          setIsLoading(false);
      }
  };

  return (
    <div className="min-h-[100dvh] bg-slate-50 dark:bg-zinc-950 flex items-center justify-center p-0 md:p-8 relative overflow-hidden transition-colors duration-500 login-screen-vialivre">
      <div className="bg-white dark:bg-zinc-900 w-full h-full md:h-auto md:max-w-5xl md:rounded-[3.5rem] shadow-2xl overflow-hidden flex flex-col md:flex-row border border-slate-100 dark:border-zinc-800 relative z-10 transition-colors">
        <div className="bg-yellow-400 w-full md:w-[45%] p-8 sm:p-12 text-slate-900 relative flex flex-col justify-between shrink-0 border-r-4 border-slate-900 transition-colors">
          <div className="relative z-10">
            <div className="flex items-center gap-4 mb-8">
                <div className="logo-sistema p-2.5 bg-white rounded-2xl shadow-xl border-2 border-slate-900 flex items-center justify-center overflow-hidden transition-all">
                  <img 
                    src="https://kkvmtqthahbcobsqmugl.supabase.co/storage/v1/object/public/assets/Logo_ViaLivre.png" 
                    className="h-10 w-auto object-contain" 
                    alt="ViaLivre Gestão" 
                    referrerPolicy="no-referrer" 
                  />
                </div>
                <h1 className="text-2xl font-black uppercase italic tracking-tighter transition-colors">
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
            <h2 className="text-2xl lg:text-3xl font-black leading-tight tracking-tight uppercase italic transition-colors">
              {systemSettings?.system_name 
                ? `Gestão simplificada e automatizada para ${
                    (systemSettings.system_name.includes('Viação Nicolau S/A') || 
                     systemSettings.system_name.includes('Grupo D\'Rio') || 
                     systemSettings.system_name.toLowerCase().includes('vialivre')) 
                    ? 'ViaLivre Gestão' 
                    : systemSettings.system_name
                  }` 
                : 'Gestão simplificada e automatizada para sua empresa'}
            </h2>
          </div>
          <p className="text-[8px] font-black uppercase tracking-[0.4em] opacity-40 transition-colors">Infraestrutura {(systemSettings?.system_name?.includes('Viação Nicolau S/A') || systemSettings?.system_name?.includes('Grupo D\'Rio') || systemSettings?.system_name?.includes('ViaLivre')) ? 'ViaLivre Gestão' : (systemSettings?.system_name || 'ViaLivre Gestão')} Transportes 2026</p>
        </div>

        <div className="flex-1 p-8 sm:p-20 bg-white dark:bg-zinc-950 flex flex-col justify-center transition-colors">
          <div className="flex justify-between items-center mb-10">
            <h3 className="text-xl font-black text-slate-900 dark:text-white tracking-tighter uppercase italic transition-colors">{isRegisterMode ? 'Novo Acesso' : 'Entrar'}</h3>
            <button 
              onClick={() => setThemeMode(themeMode === 'light' ? 'dark' : 'light')} 
              className="p-3 text-slate-400 dark:text-zinc-500 hover:bg-slate-50 dark:hover:bg-zinc-900 rounded-2xl transition-all"
              title="Alternar Tema"
            >
              {themeMode === 'light' ? <Moon size={22} /> : <Sun size={22} className="text-yellow-400" />}
            </button>
          </div>

          {!isRegisterMode ? (
            <form id="login-form-main" onSubmit={handleLogin} className="space-y-6">
                <div className="relative">
                    <UserCircle className="absolute left-5 top-5 text-slate-300 dark:text-zinc-700 transition-colors" size={20} />
                    <input 
                      type="text" 
                      value={loginInput || ''} 
                      onChange={(e) => {
                        const val = e.target.value;
                        if (/^\d+$/.test(val.replace(/\D/g, '')) && val.replace(/\D/g, '').length <= 11) {
                          setLoginInput(cpfMask(val));
                        } else {
                          setLoginInput(val);
                        }
                      }} 
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          const passInput = e.currentTarget.closest('form')?.querySelector('input[type="password"]') as HTMLInputElement;
                          if (passInput) passInput.focus();
                        }
                      }}
                      placeholder="E-mail, Usuário ou CPF" 
                      className="w-full pl-14 pr-4 py-4 border-2 border-slate-50 dark:border-zinc-800 rounded-2xl focus:border-yellow-400 bg-slate-50 dark:bg-zinc-900 text-slate-900 dark:text-zinc-100 outline-none transition-all font-bold text-base" 
                    />
                </div>
                <div className="relative">
                    <KeyRound className="absolute left-5 top-5 text-slate-300 dark:text-zinc-700 transition-colors" size={20} />
                    <input 
                      type={showPassword ? "text" : "password"} 
                      value={password || ''} 
                      onChange={(e) => setPassword(e.target.value)} 
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && password && loginInput) {
                          handleLogin(e);
                        }
                      }}
                      placeholder="Senha" 
                      className="w-full pl-14 pr-14 py-4 border-2 border-slate-50 dark:border-zinc-800 rounded-2xl focus:border-yellow-400 bg-slate-50 dark:bg-zinc-900 text-slate-900 dark:text-zinc-100 outline-none transition-all font-mono text-base" 
                    />
                    <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-5 top-4 text-slate-300 dark:text-zinc-600 hover:text-yellow-600 transition-colors">
                    {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                    </button>
                </div>
                <button disabled={isLoading} type="submit" className="w-full py-5 bg-yellow-400 hover:bg-yellow-500 text-slate-900 rounded-2xl font-black uppercase text-[10px] tracking-[0.2em] transition-all shadow-xl border-2 border-slate-900 flex items-center justify-center gap-3 active:scale-95 leading-none transition-colors">
                    {isLoading ? <Loader2 className="animate-spin" size={18}/> : <LogIn size={18}/>}
                    {isLoading ? 'ACESSANDO...' : 'ENTRAR NO SISTEMA'}
                </button>
            </form>
          ) : (
            <form onSubmit={handleRegister} className="space-y-4 max-h-[60vh] overflow-y-auto no-scrollbar pr-1">
                <div className="relative">
                    <KeyRound className="absolute left-5 top-5 text-slate-300 dark:text-zinc-700" size={20} />
                    <input 
                      required 
                      placeholder="CHAVE DE ATIVAÇÃO" 
                      value={regActivationKey || ''} 
                      onChange={e => setRegActivationKey(e.target.value.toUpperCase().substring(0, 20))} 
                      className="w-full pl-14 pr-4 py-4 border-2 border-slate-50 dark:border-zinc-800 rounded-2xl bg-slate-50 dark:bg-zinc-900 text-slate-900 dark:text-zinc-100 font-bold outline-none focus:border-yellow-400 transition-all text-[1.2rem]" 
                    />
                </div>
                <input required placeholder="Nome Completo" value={regName || ''} onChange={e => setRegName(e.target.value)} className="w-full px-5 py-4 border-2 border-slate-50 dark:border-zinc-800 rounded-2xl bg-slate-50 dark:bg-zinc-900 text-slate-900 dark:text-zinc-100 font-bold outline-none focus:border-yellow-400 transition-all transition-colors" />
                <input required type="email" placeholder="E-mail" value={regEmail || ''} onChange={e => setRegEmail(e.target.value)} className="w-full px-5 py-4 border-2 border-slate-50 dark:border-zinc-800 rounded-2xl bg-slate-50 dark:bg-zinc-900 text-slate-900 dark:text-zinc-100 font-bold outline-none focus:border-yellow-400 transition-all transition-colors" />
                
                <input required placeholder="Unidade / Empresa" value={regUnidade || ''} onChange={e => setRegUnidade(e.target.value)} className="w-full px-5 py-4 border-2 border-slate-50 dark:border-zinc-800 rounded-2xl bg-slate-50 dark:bg-zinc-900 text-slate-900 dark:text-zinc-100 font-bold outline-none focus:border-yellow-400 transition-all transition-colors" />
                <div className="grid grid-cols-2 gap-3">
                    <input required placeholder="Login" value={regLogin || ''} onChange={e => setRegLogin(e.target.value)} className="w-full px-5 py-4 border-2 border-slate-50 dark:border-zinc-800 rounded-2xl bg-slate-50 dark:bg-zinc-900 text-slate-900 dark:text-zinc-100 font-bold outline-none transition-colors" />
                    <div className="relative">
                        <input required type={showRegPassword ? "text" : "password"} placeholder="Senha" value={regPass || ''} onChange={e => setRegPass(e.target.value)} className="w-full px-5 pr-12 py-4 border-2 border-slate-50 dark:border-zinc-800 rounded-2xl bg-slate-50 dark:bg-zinc-900 text-slate-900 dark:text-zinc-100 font-bold outline-none transition-colors" />
                        <button type="button" onClick={() => setShowRegPassword(!showRegPassword)} className="absolute right-4 top-4 text-slate-300 dark:text-zinc-600 hover:text-yellow-600 transition-colors">
                            {showRegPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                        </button>
                    </div>
                </div>
                <button disabled={isLoading || regActivationKey.length !== 20} type="submit" className="w-full py-5 bg-slate-900 text-white rounded-2xl font-black uppercase text-[10px] tracking-[0.2em] shadow-xl flex items-center justify-center gap-3 active:scale-95 transition-all transition-colors disabled:opacity-50">
                    {isLoading ? <Loader2 className="animate-spin" size={18}/> : <UserPlus size={18}/>}
                    CRIAR ACESSO
                </button>
                <button onClick={() => setIsRegisterMode(false)} className="w-full py-3 text-slate-400 font-black uppercase text-[10px] tracking-widest transition-colors">Voltar para Login</button>
            </form>
          )}

          {errorModal && (
              <div className="mt-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-900/30 rounded-2xl flex items-center gap-3 animate-in slide-in-from-top-2 transition-colors">
                  <AlertCircle className="text-red-500 shrink-0" size={20} />
                  <p className="text-xs font-bold text-red-600 dark:text-red-400 transition-colors">{errorModal}</p>
                  <button onClick={() => setErrorModal(null)} className="ml-auto text-red-400"><X size={16}/></button>
              </div>
          )}

          <div className="mt-12 grid grid-cols-2 gap-4 transition-colors">
            <button onClick={onPassengerAccess} className="bg-slate-50 dark:bg-zinc-900 text-slate-500 dark:text-zinc-400 py-4 rounded-2xl font-black uppercase text-[10px] tracking-[0.2em] border border-slate-100 dark:border-zinc-800 flex items-center justify-center gap-2 hover:bg-yellow-50 dark:hover:bg-yellow-900/10 hover:text-yellow-600 transition-colors"><Globe size={14}/> Passageiro</button>
            {!isRegisterMode && (
                <button onClick={() => setIsRegisterMode(true)} className="bg-slate-50 dark:bg-zinc-900 text-slate-500 dark:text-zinc-400 py-4 rounded-2xl font-black uppercase text-[10px] tracking-widest border border-slate-100 dark:border-zinc-800 flex items-center justify-center gap-2 hover:text-blue-600 transition-all transition-colors"><ShieldCheck size={14}/> Criar Conta</button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginScreen;
