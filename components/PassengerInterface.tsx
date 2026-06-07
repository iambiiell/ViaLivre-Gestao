
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { BusRoute, Trip, Company, Notice, Vehicle, ImpCard, ImpCardPaymentMethod, ImpCardRecharge, PushSubscription, City, SystemSettings } from '../types';
import { Clock, Search, X, Bus, MapPin, Bell, ShoppingCart, Loader2, Megaphone, SmartphoneNfc, Moon, Sun, Users, Ticket, Share2, ArrowRight, CreditCard, DollarSign, Briefcase, Palette } from 'lucide-react';
import { cpfMask, cepMask, phoneMask } from '../utils/masks';
import { fetchAddress } from '../services/cep';
import TicketAgentInterface from './TicketAgentInterface';
import JobApplicationForm from './JobApplicationForm';
import { db } from '../services/database';
import { motion, AnimatePresence } from 'framer-motion';
import TransportCard from './TransportCard';

interface PassengerInterfaceProps {
  routes: BusRoute[];
  trips: Trip[];
  companies: Company[];
  cities: City[];
  notices?: Notice[];
  vehicles?: Vehicle[];
  addToast: (message: string, type?: 'success' | 'error' | 'warning') => void;
  onExit: () => void;
  onOpenTicketing: (tripId?: string, passengerData?: any, routeId?: string) => void;
  systemSettings?: SystemSettings | null;
  onUpdateSettings?: (settings: any) => void;
  themeMode?: string;
  onChangeThemeMode?: (theme: any) => void;
}

const PassengerInterface: React.FC<PassengerInterfaceProps> = ({ 
  routes, 
  trips, 
  companies, 
  cities = [], 
  notices = [], 
  vehicles = [], 
  addToast, 
  onExit, 
  onOpenTicketing,
  systemSettings,
  onUpdateSettings,
  themeMode,
  onChangeThemeMode
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<'routes' | 'notices' | 'recharge' | 'work-with-us'>('routes');
  const [isDarkMode, setIsDarkMode] = useState(() => document.documentElement.classList.contains('dark'));
  const [notificationsEnabled, setNotificationsEnabled] = useState(() => localStorage.getItem('passenger_push_optin') === 'true');
  const [pushAlert, setPushAlert] = useState<Notice | null>(null);
  const [showThemePopup, setShowThemePopup] = useState(false);

  // Recharge state
  const [rechargeQuery, setRechargeQuery] = useState('');
  const [rechargeCard, setRechargeCard] = useState<ImpCard | null>(null);
  const [rechargeAmount, setRechargeAmount] = useState<string>('0,00');
  const [rechargePaymentMethod, setRechargePaymentMethod] = useState<ImpCardPaymentMethod>('PIX');
  const [isRecharging, setIsRecharging] = useState(false);

  // Card Login state
  const [showCardLogin, setShowCardLogin] = useState(false);
  const [isCardLoggedIn, setIsCardLoggedIn] = useState(false);
  const [isGuest, setIsGuest] = useState(false);
  const [loggedInCard, setLoggedInCard] = useState<ImpCard | null>(null);
  const [loginIdentifier, setLoginIdentifier] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);
  const [isRegisteringPassword, setIsRegisteringPassword] = useState(false);
  const [loginContext, setLoginContext] = useState<'GENERAL' | 'PURCHASE'>('GENERAL');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [selectedLoginTab, setSelectedLoginTab] = useState<'PASSENGER' | 'CARD'>('PASSENGER');
  
  const [registrationForm, setRegistrationForm] = useState<Partial<ImpCard>>({
    name: '',
    surname: '',
    cpf: '',
    rg: '',
    birth_date: '',
    cep: '',
    address_street: '',
    address_number: '',
    address_complement: '',
    address_neighborhood: '',
    address_city: '',
    address_state: '',
    phone: '',
    email: '',
    type: 'Vale Transporte',
    password: '',
    balance: 0,
    responsible_name: '',
    responsible_birth_date: '',
    relationship: '',
    seat_number: 0
  });

  const handleRegisterPassenger = async () => {
    if (!registrationForm.cpf || !registrationForm.name || !registrationForm.password) {
        addToast("CPF, Nome e Senha são obrigatórios.", "warning");
        return;
    }
    
    setIsRecharging(true);
    try {
        const cards = await db.getImpCards();
        const cleanRegCpf = (registrationForm.cpf || '').replace(/\D/g, '');
        
        // Find if this CPF is already registered in the selected scope (PASSENGER vs CARD)
        const exists = cards.some(c => 
          (c.cpf || '').replace(/\D/g, '') === cleanRegCpf && 
          (selectedLoginTab === 'PASSENGER' ? c.is_passenger_buyer : !c.is_passenger_buyer)
        );

        if (exists) {
            addToast(`Este CPF já possui cadastro de ${selectedLoginTab === 'PASSENGER' ? 'passageiro' : 'cartão de transporte'}.`, "error");
            return;
        }

        if (selectedLoginTab === 'PASSENGER') {
            // Register a permanent purchase/passenger buyer
            const newPassenger = await db.create<ImpCard>('imp_cards', {
                ...registrationForm,
                card_number: 'PASS-' + Math.floor(100000 + Math.random() * 900000).toString(),
                type: 'Especial',
                is_passenger_buyer: true,
                balance: 0,
                created_at: new Date().toISOString()
            } as any);

            addToast("Cadastro de Passageiro realizado! Prossiga com sua compra.", "success");
            setLoggedInCard(newPassenger);
            setIsCardLoggedIn(true);
            setIsGuest(true); // IsGuest=true is used to display passenger profile card (no balance/recharges)
            setIsRegistering(false);
            setShowCardLogin(false);
            
            // If we are purchasing, pass it to selected route details
            onOpenTicketing(undefined, newPassenger, selectedRouteDetails?.id);
            return;
        } else {
            // Register a traditional transport card account
            const cardNumber = Math.floor(10000000 + Math.random() * 90000000).toString();
            const newCard = await db.create<ImpCard>('imp_cards', {
                ...registrationForm,
                card_number: cardNumber,
                is_passenger_buyer: false,
                created_at: new Date().toISOString()
            } as ImpCard);

            addToast(`Cadastro de Cartão registrado! Número: ${cardNumber}`, "success");
            setLoggedInCard(newCard);
            setIsCardLoggedIn(true);
            setIsGuest(false);
            setIsRegistering(false);
            setShowCardLogin(false);
            return;
        }
    } catch (error) {
        addToast("Erro ao realizar cadastro.", "error");
    } finally {
        setIsRecharging(false);
    }
  };

  const [hiddenNotices, setHiddenNotices] = useState<Set<string>>(() => {
      const saved = localStorage.getItem('passenger_hidden_notices');
      return saved ? new Set(JSON.parse(saved)) : new Set();
  });

  const [readNotices, setReadNotices] = useState<Set<string>>(() => {
      const saved = localStorage.getItem('passenger_read_notices');
      return saved ? new Set(JSON.parse(saved)) : new Set();
  });

  const [selectedRouteDetails, setSelectedRouteDetails] = useState<BusRoute | null>(null);
  const [detailDirection, setDetailDirection] = useState<'IDA' | 'VOLTA'>('IDA');
  const [scheduleDate, setScheduleDate] = useState<string>(() => new Date().toISOString().split('T')[0]);

  // New Filters for Passenger
  const [filterCompany, setFilterCompany] = useState<string>('');
  const [filterCity, setFilterCity] = useState<string>('');
  const [cepSearch, setCepSearch] = useState<string>('');
  const [isCepLoading, setIsCepLoading] = useState(false);
  const [cepCity, setCepCity] = useState<string>('');

  const handleCepSearch = async () => {
    if (cepSearch.replace(/\D/g, '').length !== 8) {
      addToast("CEP inválido. Digite 8 números.", "warning");
      return;
    }

    setIsCepLoading(true);
    try {
      const response = await fetch(`https://viacep.com.br/ws/${cepSearch.replace(/\D/g, '')}/json/`);
      const data = await response.json();
      if (data.erro) {
        addToast("CEP não encontrado.", "error");
        setCepCity('');
      } else {
        setCepCity(data.localidade);
        addToast(`Buscando rotas em ${data.localidade} e região (raio 10km)...`, "success");
      }
    } catch (error) {
      addToast("Erro ao consultar CEP.", "error");
    } finally {
      setIsCepLoading(false);
    }
  };

  const handleRegistrationCepSearch = async (cep: string) => {
    const maskedCep = cepMask(cep);
    setRegistrationForm(prev => ({ ...prev, cep: maskedCep }));
    const cleanCep = maskedCep.replace(/\D/g, '');
    if (cleanCep.length === 8) {
      setIsCepLoading(true);
      try {
        const data = await fetchAddress(cleanCep);
        if (data) {
          setRegistrationForm(prev => ({
            ...prev,
            address_street: (data.addressStreet || '').toUpperCase(),
            address_neighborhood: (data.addressNeighborhood || '').toUpperCase(),
            address_city: (data.addressCity || '').toUpperCase(),
            address_state: (data.addressState || '').toUpperCase()
          }));
        }
      } finally {
        setIsCepLoading(false);
      }
    }
  };

  const markAsRead = (id: string) => {
      const newRead = new Set(readNotices);
      newRead.add(id);
      setReadNotices(newRead);
      localStorage.setItem('passenger_read_notices', JSON.stringify(Array.from(newRead)));
  };

  const lastNoticesCount = useRef(notices.length);

  useEffect(() => {
    const handleTabChange = (e: any) => {
        if (e.detail) setActiveTab(e.detail);
    };
    window.addEventListener('change-tab', handleTabChange);
    return () => window.removeEventListener('change-tab', handleTabChange);
  }, []);

  useEffect(() => {
      if (notificationsEnabled && notices.length > lastNoticesCount.current) {
          const newNotice = notices[notices.length - 1];
          if (!hiddenNotices.has(newNotice.id)) {
            setTimeout(() => setPushAlert(newNotice), 0);
            const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
            audio.play().catch(() => {});
            setTimeout(() => setPushAlert(null), 8000);
          }
      }
      lastNoticesCount.current = notices.length;
  }, [notices, notificationsEnabled, hiddenNotices]);

  const toggleNotifications = async () => {
      const newVal = !notificationsEnabled;
      setNotificationsEnabled(newVal);
      localStorage.setItem('passenger_push_optin', String(newVal));

      if (newVal) {
        try {
          const permission = await Notification.requestPermission();
          if (permission === 'granted') {
            await db.create<PushSubscription>('push_subscriptions', {
              endpoint: 'https://fcm.googleapis.com/demo-endpoint',
              p256dh: 'demo-p256dh',
              auth: 'demo-auth',
              role: 'PASSENGER',
              created_at: new Date().toISOString()
            });
            addToast("Notificações nativas ativadas!", "success");
          }
        } catch (error) {
          console.error("Error requesting notification permission:", error);
        }
      }
  };

  const toggleTheme = () => {
      const isDark = document.documentElement.classList.toggle('dark');
      setIsDarkMode(isDark);
      localStorage.setItem('fluxo_theme', isDark ? 'dark' : 'light');
  };

  const handleRechargeSearch = async () => {
    if (!rechargeQuery) return;
    const cleanQuery = rechargeQuery.replace(/\D/g, '');
    const isNumeric = /^\d+$/.test(cleanQuery);
    if (isNumeric && cleanQuery.length > 0 && cleanQuery.length < 11) {
      addToast("CPF deve ter 11 dígitos para consulta.", "warning");
      return;
    }
    try {
      const cards = await db.getImpCards();
      const found = cards.find(c => {
        const cleanCpf = (c.cpf || '').replace(/\D/g, '');
        const cleanCard = (c.card_number || '').replace(/\D/g, '');
        if (cleanQuery && (cleanCpf === cleanQuery || cleanCard === cleanQuery)) {
          return true;
        }
        return `${c.name} ${c.surname}`.toLowerCase().includes(rechargeQuery.toLowerCase());
      });
      if (found) {
        setRechargeCard(found);
      } else {
        addToast("Cartão não encontrado.", "error");
        setRechargeCard(null);
      }
    } catch (error) {
      addToast("Erro ao buscar cartão.", "error");
    }
  };

  const handleRecharge = async () => {
    const amount = parseFloat(rechargeAmount.replace(/\./g, '').replace(',', '.'));
    if (!rechargeCard || amount <= 0) return;
    setIsRecharging(true);
    try {
      const newBalance = rechargeCard.balance + amount;
      await db.update('imp_cards', { ...rechargeCard, balance: newBalance });
      await db.create<ImpCardRecharge>('imp_card_recharges', {
        card_id: rechargeCard.id,
        amount: amount,
        payment_method: rechargePaymentMethod,
        created_at: new Date().toISOString()
      });
      addToast(`Recarga de R$ ${amount.toFixed(2)} via ${rechargePaymentMethod} realizada com sucesso!`);
      setRechargeCard(null);
      setRechargeAmount('0,00');
      setRechargeQuery('');
    } catch (error) {
      addToast("Erro ao realizar recarga.", "error");
    } finally {
      setIsRecharging(false);
    }
  };

  const handleCardLogin = async () => {
    if (!loginIdentifier) return;
    const cleanIdentifier = loginIdentifier.replace(/\D/g, '');
    if (/^\d+$/.test(cleanIdentifier) && cleanIdentifier.length > 0 && cleanIdentifier.length < 11) {
      addToast("CPF deve ter 11 dígitos.", "warning");
      return;
    }
    try {
      const cards = await db.getImpCards();
      const found = cards.find(c => {
        const cleanCpf = (c.cpf || '').replace(/\D/g, '');
        const cleanCard = (c.card_number || '').replace(/\D/g, '');
        
        // Scope search depending on selectedLoginTab
        const isTargetType = selectedLoginTab === 'PASSENGER' ? c.is_passenger_buyer === true : !c.is_passenger_buyer;
        if (!isTargetType) return false;

        const matchesInput = (cleanIdentifier && (cleanCpf === cleanIdentifier || cleanCard === cleanIdentifier)) ||
                             c.cpf === loginIdentifier || c.card_number === loginIdentifier ||
                             (cleanIdentifier && c.email && c.email.toLowerCase() === loginIdentifier.toLowerCase());
        
        return matchesInput;
      });

      if (!found) {
        addToast(`Nenhum cadastro de ${selectedLoginTab === 'PASSENGER' ? 'passageiro' : 'cartão'} encontrado.`, "error");
        return;
      }

      if (!found.password) {
        setIsRegisteringPassword(true);
        setLoggedInCard(found);
      } else {
        if (found.password === loginPassword) {
          setLoggedInCard(found);
          setIsCardLoggedIn(true);
          setIsGuest(selectedLoginTab === 'PASSENGER');
          setShowCardLogin(false);
          addToast("Login realizado com sucesso!", "success");
          if (loginContext === 'PURCHASE') {
            onOpenTicketing(undefined, found, selectedRouteDetails?.id);
          }
        } else {
          addToast("Senha incorreta.", "error");
        }
      }
    } catch (error) {
      addToast("Erro no login.", "error");
    }
  };

  const handleRegisterPassword = async () => {
    if (!newPassword || newPassword !== confirmPassword) {
      addToast("As senhas não coincidem.", "error");
      return;
    }
    if (!loggedInCard) return;
    try {
      const updatedCard = { ...loggedInCard, password: newPassword };
      await db.update('imp_cards', updatedCard);
      setIsCardLoggedIn(true);
      setIsRegisteringPassword(false);
      setShowCardLogin(false);
      addToast("Senha cadastrada com sucesso!");
      if (loginContext === 'PURCHASE') {
        onOpenTicketing(undefined, updatedCard, selectedRouteDetails?.id);
      }
    } catch (error) {
      addToast("Erro ao cadastrar senha.", "error");
    }
  };

  const formatCurrencyRTL = (value: string) => {
    const cleanValue = value.replace(/\D/g, '');
    const numberValue = parseInt(cleanValue || '0') / 100;
    return numberValue.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const handleBuyClick = (tripId: string, routeId: string) => {
    if (!isCardLoggedIn || !isGuest) {
        setLoginContext('PURCHASE');
        setSelectedLoginTab('PASSENGER');
        setShowCardLogin(true);
        addToast("Para comprar passagens, faça login com sua conta de Passageiro (o login do Cartão não é válido para compras).", "info");
    } else {
        onOpenTicketing(tripId, loggedInCard || undefined, routeId);
    }
  };

  const currentSchedules = useMemo(() => {
    if (!selectedRouteDetails) return [];
    try {
      const dateParts = scheduleDate.split('-');
      const dateObj = new Date(Number(dateParts[0]), Number(dateParts[1]) - 1, Number(dateParts[2]), 12, 0, 0);
      const day = dateObj.getDay();
      let list: { time: string; direction: 'IDA' | 'VOLTA' }[] = [];
      if (selectedRouteDetails.schedule) {
        if (day === 0) list = selectedRouteDetails.schedule.sunday || [];
        else if (day === 6) list = selectedRouteDetails.schedule.saturday || [];
        else list = selectedRouteDetails.schedule.weekdays || [];
      }
      return [...list].filter(item => item.direction === detailDirection).sort((a, b) => a.time.localeCompare(b.time));
    } catch (e) {
      return [];
    }
  }, [selectedRouteDetails, scheduleDate, detailDirection]);

  const scrollRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);

  const handleMouseDown = (e: React.MouseEvent) => {
      if (!scrollRef.current) return;
      setIsDragging(true);
      setStartX(e.pageX - scrollRef.current.offsetLeft);
      setScrollLeft(scrollRef.current.scrollLeft);
  };
  const handleMouseLeave = () => setIsDragging(false);
  const handleMouseUp = () => setIsDragging(false);
  const handleMouseMove = (e: React.MouseEvent) => {
      if (!isDragging || !scrollRef.current) return;
      e.preventDefault();
      const x = e.pageX - scrollRef.current.offsetLeft;
      const walk = (x - startX) * 2;
      scrollRef.current.scrollLeft = scrollLeft - walk;
  };

  const normalize = (str: string) => str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();

  const filteredRoutes = useMemo(() => {
      if (!routes) return [];
      let result = [...routes];
      if (searchTerm) {
        const nSearch = normalize(searchTerm);
        result = result.filter(r => 
          normalize(r.prefixo_linha).includes(nSearch) || 
          normalize(r.destination).includes(nSearch) ||
          normalize(r.origin).includes(nSearch)
        );
      }
      if (filterCompany) {
        result = result.filter(r => r.company_id === filterCompany);
      }
      const targetCity = cepCity || filterCity;
      if (targetCity) {
        const nCity = normalize(targetCity);
        result = result.filter(r => 
          normalize(r.origin).includes(nCity) || 
          normalize(r.destination).includes(nCity) ||
          (r.city && normalize(r.city).includes(nCity))
        );
      }
      return result.sort((a, b) => a.prefixo_linha.localeCompare(b.prefixo_linha, undefined, { numeric: true }));
  }, [routes, searchTerm, filterCompany, filterCity, cepCity]);

  const activeNotices = useMemo(() => {
      return (notices || []).filter(n => {
        const matchesRole = !n.target_role || n.target_role === 'PASSENGER' || n.target_role === 'ALL';
        return matchesRole && !hiddenNotices.has(n.id);
      });
  }, [notices, hiddenNotices]);

  const now = new Date();
  const currentTimeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-zinc-950 text-slate-900 dark:text-zinc-100 flex flex-col font-sans relative overflow-x-hidden md:max-w-3xl md:mx-auto shadow-2xl">
      
      {showCardLogin && (
          <div className="fixed inset-0 z-[800] bg-black/60 backdrop-blur-md flex items-center justify-center p-4">
              <div className="bg-white dark:bg-zinc-900 w-full max-w-md rounded-[3rem] border-4 shadow-2xl overflow-hidden flex flex-col max-h-[90vh] transition-all duration-500 border-yellow-400">
                  <div className="p-8 border-b dark:border-zinc-800 flex justify-between items-center text-slate-900 bg-yellow-400">
                      <div className="flex items-center gap-4">
                          <div className="w-10 h-10 rounded-xl flex items-center justify-center shadow-lg bg-slate-900 text-white">
                              <SmartphoneNfc size={24}/>
                          </div>
                        <h3 className="text-xl font-black uppercase italic">{isRegistering ? (selectedLoginTab === 'PASSENGER' ? 'Cadastro de Passageiro' : 'Cadastro de Cartão') : selectedLoginTab === 'PASSENGER' ? 'Login Passageiro' : 'Acesso ao Cartão'}</h3>
                      </div>
                      <button onClick={() => { setShowCardLogin(false); setIsRegistering(false); }} className="p-2 bg-slate-900 text-white rounded-xl"><X size={20}/></button>
                  </div>
                  {!isRegisteringPassword && (
                      <div className="flex border-b dark:border-zinc-800 shrink-0 bg-slate-50 dark:bg-zinc-950">
                          <button 
                              type="button"
                              onClick={() => { setSelectedLoginTab('PASSENGER'); setIsRegistering(false); }}
                              className={`flex-1 py-4 text-[10px] uppercase font-black tracking-wider flex items-center justify-center gap-2 border-b-4 transition-all ${selectedLoginTab === 'PASSENGER' ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 bg-indigo-50/10' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
                          >
                              <Ticket size={14} />
                              Comprar Passagens
                          </button>
                          <button 
                              type="button"
                              onClick={() => { setSelectedLoginTab('CARD'); setIsRegistering(false); }}
                              className={`flex-1 py-4 text-[10px] uppercase font-black tracking-wider flex items-center justify-center gap-2 border-b-4 transition-all ${selectedLoginTab === 'CARD' ? 'border-yellow-400 text-yellow-600 dark:text-yellow-400 bg-yellow-50/10' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
                          >
                              <CreditCard size={14} />
                              Cartão Transporte
                          </button>
                      </div>
                  )}
                  <div className="p-8 space-y-6 overflow-y-auto">
                      {selectedLoginTab === 'PASSENGER' && (
                        <p className="bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 p-4 rounded-xl text-[10px] font-black uppercase leading-tight text-center border-2 border-indigo-100 dark:border-indigo-800">Para prosseguir com a compra é necessário realizar o cadastro de Passageiro ou fazer login.</p>
                      )}
                      {selectedLoginTab === 'CARD' && (
                        <p className="bg-yellow-50 dark:bg-yellow-900/15 text-yellow-600 dark:text-yellow-400 p-4 rounded-xl text-[10px] font-black uppercase leading-tight text-center border-2 border-yellow-100 dark:border-yellow-900/20">Identifique-se com seu cartão ImpCard para ver saldos, histórico e recarregar.</p>
                      )}
                      {isRegistering ? (
                          <div className="space-y-4">
                              <div className="grid grid-cols-2 gap-4">
                                  <div>
                                      <label className="text-[10px] font-black uppercase text-slate-400 ml-2">Nome</label>
                                      <input type="text" className="w-full px-4 py-3 bg-slate-50 dark:bg-zinc-800 rounded-xl text-[10px] font-black outline-none" value={registrationForm.name} onChange={e => setRegistrationForm({...registrationForm, name: e.target.value.toUpperCase()})} />
                                  </div>
                                  <div>
                                      <label className="text-[10px] font-black uppercase text-slate-400 ml-2">Sobrenome</label>
                                      <input type="text" className="w-full px-4 py-3 bg-slate-50 dark:bg-zinc-800 rounded-xl text-[10px] font-black outline-none" value={registrationForm.surname} onChange={e => setRegistrationForm({...registrationForm, surname: e.target.value.toUpperCase()})} />
                                  </div>
                              </div>
                              <div className="grid grid-cols-2 gap-4">
                                  <div>
                                      <label className="text-[10px] font-black uppercase text-slate-400 ml-2">CPF</label>
                                      <input type="text" className="w-full px-4 py-3 bg-slate-50 dark:bg-zinc-800 rounded-xl text-[10px] font-black outline-none" value={registrationForm.cpf} onChange={e => setRegistrationForm({...registrationForm, cpf: cpfMask(e.target.value)})} />
                                  </div>
                                  <div>
                                      <label className="text-[10px] font-black uppercase text-slate-400 ml-2">Data de Nasc.</label>
                                      <input type="date" className="w-full px-4 py-3 bg-slate-50 dark:bg-zinc-800 rounded-xl text-[10px] font-black outline-none" value={registrationForm.birth_date} onChange={e => setRegistrationForm({...registrationForm, birth_date: e.target.value})} />
                                  </div>
                              </div>
                              <div className="grid grid-cols-2 gap-4">
                                  <div>
                                      <label className="text-[10px] font-black uppercase text-slate-400 ml-2">Telefone</label>
                                      <input type="text" className="w-full px-4 py-3 bg-slate-50 dark:bg-zinc-800 rounded-xl text-[10px] font-black outline-none" value={registrationForm.phone} onChange={e => setRegistrationForm({...registrationForm, phone: phoneMask(e.target.value)})} />
                                  </div>
                                  <div>
                                      <label className="text-[10px] font-black uppercase text-slate-400 ml-2">E-mail</label>
                                      <input type="email" className="w-full px-4 py-3 bg-slate-50 dark:bg-zinc-800 rounded-xl text-[10px] font-black outline-none" value={registrationForm.email} onChange={e => setRegistrationForm({...registrationForm, email: e.target.value})} />
                                  </div>
                              </div>
                              <hr className="dark:border-zinc-800" />
                              <div className="grid grid-cols-3 gap-4">
                                  <div className="col-span-1">
                                      <label className="text-[10px] font-black uppercase text-slate-400 ml-2">CEP</label>
                                      <input type="text" className="w-full px-4 py-3 bg-slate-50 dark:bg-zinc-800 rounded-xl text-[10px] font-black outline-none" value={registrationForm.cep} onChange={e => handleRegistrationCepSearch(e.target.value)} />
                                  </div>
                                  <div className="col-span-2">
                                      <label className="text-[10px] font-black uppercase text-slate-400 ml-2">Rua/Logradouro</label>
                                      <input type="text" className="w-full px-4 py-3 bg-slate-50 dark:bg-zinc-800 rounded-xl text-[10px] font-black outline-none" value={registrationForm.address_street} onChange={e => setRegistrationForm({...registrationForm, address_street: e.target.value.toUpperCase()})} />
                                  </div>
                              </div>
                              <div className="grid grid-cols-3 gap-4">
                                  <div>
                                      <label className="text-[10px] font-black uppercase text-slate-400 ml-2">Número</label>
                                      <input type="text" className="w-full px-4 py-3 bg-slate-50 dark:bg-zinc-800 rounded-xl text-[10px] font-black outline-none" value={registrationForm.address_number} onChange={e => setRegistrationForm({...registrationForm, address_number: e.target.value.toUpperCase()})} />
                                  </div>
                                  <div className="col-span-2">
                                      <label className="text-[10px] font-black uppercase text-slate-400 ml-2">Bairro</label>
                                      <input type="text" className="w-full px-4 py-3 bg-slate-50 dark:bg-zinc-800 rounded-xl text-[10px] font-black outline-none" value={registrationForm.address_neighborhood} onChange={e => setRegistrationForm({...registrationForm, address_neighborhood: e.target.value.toUpperCase()})} />
                                  </div>
                              </div>
                              <div className="grid grid-cols-2 gap-4">
                                  <div>
                                      <label className="text-[10px] font-black uppercase text-slate-400 ml-2">Cidade</label>
                                      <input type="text" className="w-full px-4 py-3 bg-slate-50 dark:bg-zinc-800 rounded-xl text-[10px] font-black outline-none" value={registrationForm.address_city} onChange={e => setRegistrationForm({...registrationForm, address_city: e.target.value.toUpperCase()})} />
                                  </div>
                                  <div>
                                      <label className="text-[10px] font-black uppercase text-slate-400 ml-2">Estado</label>
                                      <input type="text" className="w-full px-4 py-3 bg-slate-50 dark:bg-zinc-800 rounded-xl text-[10px] font-black outline-none" value={registrationForm.address_state} onChange={e => setRegistrationForm({...registrationForm, address_state: e.target.value.toUpperCase()})} />
                                  </div>
                              </div>
                              <div>
                                  <label className="text-[10px] font-black uppercase text-slate-400 ml-2">Complemento</label>
                                  <input type="text" className="w-full px-4 py-3 bg-slate-50 dark:bg-zinc-800 rounded-xl text-[10px] font-black outline-none" value={registrationForm.address_complement} onChange={e => setRegistrationForm({...registrationForm, address_complement: e.target.value.toUpperCase()})} />
                              </div>

                              {registrationForm.birth_date && (new Date().getFullYear() - new Date(registrationForm.birth_date).getFullYear() < 18) && (
                                <div className="space-y-4 p-4 bg-blue-50 dark:bg-blue-900/10 rounded-2xl border-2 border-blue-100 dark:border-blue-900/20">
                                    <h4 className="text-[9px] font-black uppercase text-blue-600 flex items-center gap-2"><Users size={12}/> Dados do Responsável (Menores)</h4>
                                    <input type="text" placeholder="NOME DO RESPONSÁVEL" className="w-full px-4 py-3 bg-white dark:bg-zinc-800 rounded-xl text-[10px] font-black outline-none border border-blue-100" value={registrationForm.responsible_name} onChange={e => setRegistrationForm({...registrationForm, responsible_name: e.target.value.toUpperCase()})} />
                                    <div className="grid grid-cols-2 gap-4">
                                        <input type="date" placeholder="DATA NASC. RESPONSÁVEL" className="w-full px-4 py-3 bg-white dark:bg-zinc-800 rounded-xl text-[10px] font-black outline-none border border-blue-100" value={registrationForm.responsible_birth_date} onChange={e => setRegistrationForm({...registrationForm, responsible_birth_date: e.target.value})} />
                                        <input type="text" placeholder="PARENTESCO" className="w-full px-4 py-3 bg-white dark:bg-zinc-800 rounded-xl text-[10px] font-black outline-none border border-blue-100" value={registrationForm.relationship} onChange={e => setRegistrationForm({...registrationForm, relationship: e.target.value.toUpperCase()})} />
                                    </div>
                                </div>
                              )}

                              <div className="pt-2">
                                  <label className="text-[10px] font-black uppercase text-slate-400 ml-2">Senha de Acesso</label>
                                  <input type="password" placeholder={loginContext === 'PURCHASE' ? "OPCIONAL" : "MÍNIMO 4 DÍGITOS"} className="w-full px-4 py-3 bg-slate-50 dark:bg-zinc-800 rounded-xl text-sm font-black outline-none border-2 border-indigo-400" value={registrationForm.password} onChange={e => setRegistrationForm({...registrationForm, password: e.target.value})} />
                              </div>
                              <button 
                                onClick={handleRegisterPassenger} 
                                className={`w-full py-4 ${loginContext === 'PURCHASE' ? 'bg-indigo-600' : 'bg-slate-900'} text-white rounded-2xl font-black uppercase text-xs shadow-xl active:scale-95 disabled:opacity-50`}
                                disabled={isRecharging}
                              >
                                {isRecharging ? <Loader2 className="animate-spin mx-auto"/> : loginContext === 'PURCHASE' ? 'Próximo: Escolher Poltrona' : 'Concluir Cadastro'}
                              </button>
                              <button onClick={() => setIsRegistering(false)} className="w-full text-[9px] font-black text-slate-400 uppercase">Já tenho cadastro</button>
                          </div>
                      ) : isRegisteringPassword ? (
                          <div className="space-y-6">
                              <p className="text-[10px] font-black uppercase text-slate-400 text-center">Cadastre uma senha</p>
                              <div className="space-y-4">
                                  <input type="password" placeholder="NOVA SENHA" className="w-full px-6 py-4 bg-slate-50 dark:bg-zinc-800 rounded-2xl text-xs font-black" value={newPassword} onChange={e => setNewPassword(e.target.value)} />
                                  <input type="password" placeholder="CONFIRMAR SENHA" className="w-full px-6 py-4 bg-slate-50 dark:bg-zinc-800 rounded-2xl text-xs font-black" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} />
                              </div>
                              <button onClick={handleRegisterPassword} className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black uppercase text-xs">Cadastrar</button>
                          </div>
                      ) : (
                          <div className="space-y-6">
                              <div className="space-y-4">
                                  <input type="text" placeholder="CPF OU CARTÃO" className="w-full px-6 py-4 bg-slate-50 dark:bg-zinc-800 rounded-2xl text-xs font-black" value={loginIdentifier} onChange={e => setLoginIdentifier(cpfMask(e.target.value))} />
                                  <input type="password" placeholder="SENHA" className="w-full px-6 py-4 bg-slate-50 dark:bg-zinc-800 rounded-2xl text-xs font-black" value={loginPassword} onChange={e => setLoginPassword(e.target.value)} />
                              </div>
                              <button onClick={handleCardLogin} className={`w-full py-4 ${loginContext === 'PURCHASE' ? 'bg-indigo-600' : 'bg-slate-900'} text-white rounded-2xl font-black uppercase text-xs shadow-xl`}>Entrar</button>
                              {loginContext === 'PURCHASE' ? (
                                  <button onClick={() => setIsRegistering(true)} className="w-full text-[9px] font-black text-slate-400 uppercase border-t dark:border-zinc-800 pt-4">Não tem cadastro? Clique para cadastrar e comprar</button>
                              ) : (
                                  <div className="pt-4 border-t dark:border-zinc-800 text-center">
                                      <p className="text-[10px] font-black text-slate-400 uppercase italic">Cadastro disponível apenas em ATMs ou SAC Presencial</p>
                                  </div>
                              )}
                          </div>
                      )}
                  </div>
              </div>
          </div>
      )}

      {isCardLoggedIn && loggedInCard && (
          <div className="fixed inset-0 z-[800] bg-black/80 backdrop-blur-lg flex items-center justify-center p-4">
               <div className="bg-white dark:bg-zinc-900 w-full max-w-2xl rounded-[3rem] border-4 border-yellow-400 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
                  <div className="p-8 border-b dark:border-zinc-800 flex justify-between items-center bg-yellow-400 text-slate-900">
                      <h3 className="text-2xl font-black uppercase italic">Meu ImpCard</h3>
                      <button onClick={() => setIsCardLoggedIn(false)} className="p-2 bg-slate-900 text-white rounded-xl"><X size={24}/></button>
                  </div>
                  <div className="flex-1 overflow-y-auto p-8 space-y-8 flex flex-col items-center">
                      <TransportCard name={`${loggedInCard.name} ${loggedInCard.surname}`} cardNumber={loggedInCard.card_number} photoUrl={loggedInCard.photo_url} category={loggedInCard.type.toUpperCase()} />
                      <div className="w-full">
                          {isGuest ? (
                              <div className="p-6 bg-indigo-50 dark:bg-indigo-900/10 rounded-[2rem] border-2 border-indigo-100 dark:border-indigo-900/20 text-center space-y-4">
                                  <p className="text-[10px] font-black text-indigo-500 uppercase">Acesso de Passageiro</p>
                                  <p className="text-sm font-black mt-2">Você está identificado no sistema!</p>
                                  <p className="text-[10px] text-slate-400 mt-2 uppercase italic text-center text-xs leading-relaxed">Seus dados cadastrados preencherão a identificação civil no checkout de compra automaticamente.</p>
                                  <button 
                                    onClick={() => {
                                        setLoggedInCard(null);
                                        setIsCardLoggedIn(false);
                                        setIsGuest(false);
                                        addToast("Você saiu da conta de passageiro com sucesso.", "success");
                                    }}
                                    className="px-6 py-2.5 bg-red-600 text-white rounded-xl text-[10px] font-black uppercase tracking-wider shrink-0 transition-all hover:bg-red-700 active:scale-95"
                                  >
                                    Desconectar Conta
                                  </button>
                              </div>
                          ) : (
                              <div className="p-6 bg-slate-50 dark:bg-zinc-800 rounded-[2rem] border-2 border-slate-100 dark:border-zinc-700 text-center space-y-4">
                                  <div>
                                      <p className="text-[10px] font-black text-slate-400 uppercase">Saldo do Cartão</p>
                                      <p className="text-3xl font-black text-emerald-600 dark:text-emerald-400">R$ {loggedInCard.balance?.toFixed(2) || '0.00'}</p>
                                  </div>
                                  <button 
                                    onClick={() => {
                                        setLoggedInCard(null);
                                        setIsCardLoggedIn(false);
                                        setIsGuest(false);
                                        addToast("Você saiu da conta do cartão com sucesso.", "success");
                                    }}
                                    className="px-6 py-2.5 bg-red-600 text-white rounded-xl text-[10px] font-black uppercase tracking-wider shrink-0 transition-all hover:bg-red-700 active:scale-95 mx-auto block"
                                  >
                                    Desconectar Cartão
                                  </button>
                              </div>
                          )}
                      </div>
                  </div>
               </div>
          </div>
      )}

      {pushAlert && (
          <div className="fixed top-24 left-4 right-4 z-[1000]">
              <div className="bg-slate-900 text-white p-6 rounded-[2rem] border-4 border-yellow-400 shadow-2xl flex items-start gap-4">
                  <div className="p-3 bg-yellow-400 rounded-2xl text-slate-900"><Bell size={24} className="animate-ring"/></div>
                  <div className="flex-1">
                      <p className="font-black uppercase text-xs">{pushAlert.title}</p>
                      <p className="text-[10px] text-slate-400 italic">"{pushAlert.content}"</p>
                  </div>
                  <button onClick={() => setPushAlert(null)}><X size={20}/></button>
              </div>
          </div>
      )}


      <div className="bg-yellow-400 text-slate-900 p-6 sticky top-0 z-30 shadow-md transition-colors">
        <div className="flex justify-between items-center mb-4">
           <div className="flex items-center gap-3">
               <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-sm">
                   <Bus className="text-yellow-500" size={24}/>
               </div>
               <h1 className="font-black text-xl uppercase italic">Passageiro ViaLivre</h1>
           </div>
           <div className="flex gap-2">
                <button onClick={toggleNotifications} className={`p-2 rounded-xl transition-all ${notificationsEnabled ? 'bg-slate-900 text-yellow-400 font-extrabold border-2 border-yellow-400' : 'bg-slate-900/10 hover:bg-slate-900/20'}`} title={notificationsEnabled ? "Notificações Ativas" : "Permitir Acesso às Notificações"}><SmartphoneNfc size={18}/></button>
                <button onClick={() => setShowThemePopup(true)} className="p-2 bg-slate-900/10 hover:bg-slate-900/20 rounded-xl transition-all text-slate-800" title="Design e Cores"><Palette size={18}/></button>
                <button onClick={() => { setShowCardLogin(true); setLoginContext('GENERAL'); }} className={`p-2 rounded-xl ${isCardLoggedIn ? 'bg-emerald-500 text-white' : 'bg-slate-900/10'}`}><CreditCard size={18}/></button>
                <button onClick={onExit} className="px-3 py-1 bg-slate-900/10 rounded-xl text-[10px] font-black uppercase">Sair</button>
           </div>
        </div>
        
        <div className="flex bg-slate-900/10 rounded-2xl p-1">
            <button onClick={() => setActiveTab('routes')} className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase transition-all ${activeTab === 'routes' ? 'bg-white shadow-sm' : ''}`}>Itinerários</button>
            <button onClick={() => setActiveTab('recharge')} className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase transition-all ${activeTab === 'recharge' ? 'bg-white shadow-sm' : ''}`}>Recarga</button>
            <button onClick={() => setActiveTab('notices')} className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase transition-all ${activeTab === 'notices' ? 'bg-white shadow-sm' : ''}`}>Mural</button>
            <button onClick={() => setActiveTab('work-with-us')} className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase transition-all ${activeTab === 'work-with-us' ? 'bg-white shadow-sm' : ''}`}>Vagas</button>
        </div>
      </div>

      {selectedRouteDetails && (
          <div className="fixed inset-0 z-[700] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
              <div className="bg-white dark:bg-zinc-900 w-full max-w-lg rounded-[3rem] border-4 border-yellow-400 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
                  <div className="p-8 bg-yellow-400 text-slate-900 flex justify-between items-center shrink-0">
                      <div>
                        <h3 className="text-xl font-black uppercase italic">Itinerário Detalhado</h3>
                        <p className="text-[10px] font-bold opacity-70 uppercase tracking-widest">{selectedRouteDetails.prefixo_linha}</p>
                      </div>
                      <button onClick={() => setSelectedRouteDetails(null)} className="p-2 bg-slate-900 text-white rounded-xl"><X size={20}/></button>
                  </div>
                  <div className="p-8 space-y-6 overflow-y-auto flex-1 custom-scrollbar">
                      <div className="space-y-4">
                        <div className="flex items-center gap-4 text-center">
                            <div className="flex-1 p-4 bg-slate-50 dark:bg-zinc-800 rounded-2xl border border-slate-100 dark:border-zinc-700">
                                <p className="text-[10px] uppercase font-black text-slate-400">Origem</p>
                                <p className="font-black text-sm">{selectedRouteDetails.origin}</p>
                            </div>
                            <ArrowRight className="text-yellow-400 shrink-0" />
                            <div className="flex-1 p-4 bg-slate-50 dark:bg-zinc-800 rounded-2xl border border-slate-100 dark:border-zinc-700">
                                <p className="text-[10px] uppercase font-black text-slate-400">Destino</p>
                                <p className="font-black text-sm">{selectedRouteDetails.destination}</p>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="p-4 bg-emerald-50 dark:bg-emerald-900/10 rounded-2xl border border-emerald-100 dark:border-emerald-800/30 text-center">
                                <p className="text-[10px] font-black uppercase text-emerald-600">Tarifa Integral</p>
                                <p className="text-xl font-black">R$ {selectedRouteDetails.price.toFixed(2)}</p>
                            </div>
                            <div className="p-4 bg-blue-50 dark:bg-blue-900/10 rounded-2xl border border-blue-100 dark:border-blue-800/30 text-center">
                                <p className="text-[10px] font-black uppercase text-blue-600">Prefixo</p>
                                <p className="text-xl font-black">{selectedRouteDetails.prefixo_linha}</p>
                            </div>
                        </div>
                      </div>

                      {/* Seções */}
                      {selectedRouteDetails.sections && selectedRouteDetails.sections.length > 0 && (
                          <div className="space-y-3">
                              <h4 className="text-xs font-black uppercase italic flex items-center gap-2">
                                <MapPin size={14} className="text-yellow-500" /> Seções Intermediárias
                              </h4>
                              <div className="grid gap-2">
                                  {selectedRouteDetails.sections.map((section, idx) => (
                                      <div key={idx} className="p-3 bg-slate-50 dark:bg-zinc-950 rounded-xl border border-dotted border-slate-200 dark:border-zinc-850 flex justify-between items-center text-[10px]">
                                          <div className="flex flex-col">
                                              <span className="font-black uppercase">{section.origin} x {section.destination}</span>
                                              <span className="text-slate-400">Tarifa Seção</span>
                                          </div>
                                          <span className="font-black text-emerald-600">R$ {section.price.toFixed(2)}</span>
                                      </div>
                                  ))}
                              </div>
                          </div>
                      )}

                      {/* Horários */}
                      <div className="space-y-4">
                          <div className="flex justify-between items-center bg-slate-50 dark:bg-zinc-900/50 p-2.5 rounded-2xl border dark:border-zinc-800">
                              <h4 className="text-xs font-black uppercase italic flex items-center gap-2">
                                <Clock size={14} className="text-yellow-500" /> Quadro de Horários
                              </h4>
                          </div>

                          <div className="flex flex-col sm:flex-row gap-2 justify-between items-start sm:items-center bg-slate-100 dark:bg-zinc-800 p-3 rounded-2xl">
                              <div className="flex items-center gap-2">
                                  <span className="text-[10px] font-black uppercase text-slate-500">Data:</span>
                                  <input 
                                    type="date" 
                                    value={scheduleDate} 
                                    onChange={(e) => setScheduleDate(e.target.value)}
                                    className="px-2.5 py-1.5 rounded-xl bg-white dark:bg-zinc-700 font-extrabold text-xs uppercase outline-none shadow-sm text-slate-700 dark:text-white border dark:border-zinc-600"
                                  />
                              </div>
                              <div className="flex p-0.5 bg-slate-200 dark:bg-zinc-700 rounded-xl max-sm:w-full">
                                  <button 
                                    onClick={() => setDetailDirection('IDA')}
                                    className={`flex-1 sm:flex-none px-4 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all ${detailDirection === 'IDA' ? 'bg-white dark:bg-zinc-600 shadow-sm' : 'opacity-65'}`}
                                  >Ida</button>
                                  <button 
                                    onClick={() => setDetailDirection('VOLTA')}
                                    className={`flex-1 sm:flex-none px-4 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all ${detailDirection === 'VOLTA' ? 'bg-white dark:bg-zinc-600 shadow-sm' : 'opacity-65'}`}
                                  >Volta</button>
                              </div>
                          </div>

                          {selectedRouteDetails.route_type === 'URBANO' && (
                              <div className="p-4 bg-amber-50 dark:bg-yellow-950/15 text-amber-800 dark:text-yellow-500 border border-yellow-250 dark:border-yellow-500/30 rounded-2xl text-[9px] font-black uppercase text-center leading-relaxed">
                                  ⚠️ Rota Urbana / Municipal: O pagamento da tarifa é realizado diretamente ao operador, a bordo do veículo. Não há venda antecipada de passagens no autoatendimento.
                              </div>
                          )}

                          <div className="grid grid-cols-1 gap-3">
                              {currentSchedules.length > 0 ? (
                                  currentSchedules.map((item, sIdx) => {
                                      const matchingTrip = trips.find(t => 
                                          t.route_id === selectedRouteDetails.id &&
                                          t.direction === detailDirection &&
                                          t.trip_date === scheduleDate &&
                                          t.departure_time === item.time &&
                                          !t.finished
                                      );

                                      return (
                                          <div 
                                            key={sIdx} 
                                            className={`p-4 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all ${
                                              matchingTrip 
                                                ? 'bg-indigo-50/30 dark:bg-indigo-950/20 border-indigo-100 dark:border-indigo-900/40' 
                                                : 'bg-slate-50/50 dark:bg-zinc-950 border-slate-150 dark:border-zinc-850'
                                            }`}
                                          >
                                            <div className="flex-1 space-y-1.5 text-left">
                                                <div className="flex flex-wrap items-center gap-2">
                                                    <span className="px-2.5 py-1 bg-indigo-600 dark:bg-indigo-500 text-white font-extrabold rounded-xl text-xs">{item.time}</span>
                                                    {matchingTrip ? (
                                                      <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-extrabold rounded-lg text-[9px] uppercase border border-emerald-500/20">Escala Ativa • Ônibus {matchingTrip.bus_number}</span>
                                                    ) : (
                                                      <span className="px-2 py-0.5 bg-slate-100 dark:bg-zinc-800 text-slate-500 dark:text-zinc-405 font-bold rounded-lg text-[8px] uppercase">Previsto no Quadro</span>
                                                    )}
                                                </div>
                                                {matchingTrip ? (
                                                  <div className="text-[10px] text-slate-500 dark:text-zinc-400 font-extrabold uppercase">
                                                      <span className="block">Motorista: {matchingTrip.driver_name}</span>
                                                      {matchingTrip.conductor_name && <span className="block text-[9px] text-slate-400">Cobrador: {matchingTrip.conductor_name}</span>}
                                                  </div>
                                                ) : (
                                                  <span className="block text-[9px] italic text-slate-400 font-semibold uppercase">Escala ainda não programada para este dia</span>
                                                )}
                                            </div>
                                            
                                            {matchingTrip && (
                                              selectedRouteDetails.route_type === 'URBANO' ? (
                                                <div className="px-4 py-2 hover:bg-slate-100 dark:hover:bg-zinc-900 text-amber-600 dark:text-amber-500 font-black uppercase text-[9px] rounded-xl border-2 border-dashed border-amber-305 dark:border-amber-500/50 text-center leading-none">
                                                  Pagamento no veículo
                                                </div>
                                              ) : (
                                                <button 
                                                  onClick={() => handleBuyClick(matchingTrip.id, selectedRouteDetails.id)}
                                                  className="px-4 py-2.5 bg-indigo-600 dark:bg-indigo-500 hover:bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase flex items-center gap-2 transition-all shadow-md active:scale-95 shrink-0"
                                                >
                                                  <span>Comprar</span>
                                                  <ShoppingCart size={13} className="text-white/70"/>
                                                </button>
                                              )
                                            )}
                                          </div>
                                      );
                                  })
                              ) : (
                                  <div className="py-8 text-center text-slate-400 text-[10px] font-black uppercase italic border border-dashed rounded-2xl">
                                      Sem horários programados neste dia para direção {detailDirection === 'IDA' ? 'Ida' : 'Volta'}
                                  </div>
                              )}
                          </div>
                      </div>
                  </div>
                  <div className="p-6 bg-slate-50 dark:bg-zinc-900 border-t dark:border-zinc-800 flex flex-col gap-2 shrink-0">
                      <p className="text-[9px] font-black uppercase text-slate-400 text-center italic">
                        {selectedRouteDetails.route_type === 'URBANO' 
                          ? 'Esta linha não aceita venda online. Efetue pagamento direto ao motorista/cobrador no veículo.' 
                          : 'Escolha um horário acima para comprar sua passagem'}
                      </p>
                  </div>
              </div>
          </div>
      )}

      <div 
        ref={scrollRef} onMouseDown={handleMouseDown} onMouseLeave={handleMouseLeave} onMouseUp={handleMouseUp} onMouseMove={handleMouseMove}
        className="flex-1 overflow-y-auto pb-24"
      >
            <div className="p-6 space-y-8">
                {activeTab === 'routes' && (
                    <div className="space-y-6">
                        <div className="bg-white dark:bg-zinc-900 p-8 rounded-[2.5rem] border border-slate-100 dark:border-zinc-800 space-y-6 text-center">
                            <h2 className="text-2xl font-black uppercase italic">Encontre sua <span className="text-yellow-600">Viagem</span></h2>
                            <div className="space-y-4">
                                <div className="relative"><Search className="absolute left-4 top-4 text-slate-400" size={18}/><input type="text" placeholder="Pesquisar Linha..." className="w-full pl-12 pr-4 py-4 rounded-xl bg-slate-50 dark:bg-zinc-800 outline-none font-bold text-sm" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} /></div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    <select value={filterCompany} onChange={e => setFilterCompany(e.target.value)} className="px-4 py-4 bg-slate-50 dark:bg-zinc-800 rounded-xl font-black uppercase text-[10px] outline-none">
                                        <option value="">Todas Empresas</option>
                                        {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                    </select>
                                    <input type="text" placeholder="Cidade..." className="px-4 py-4 bg-slate-50 dark:bg-zinc-800 rounded-xl font-black uppercase text-[10px] outline-none" value={filterCity} onChange={e => setFilterCity(e.target.value)} />
                                </div>
                                <div className="flex gap-2">
                                    <input type="text" placeholder="CEP..." className="flex-1 px-4 py-4 bg-slate-50 dark:bg-zinc-800 rounded-xl font-black uppercase text-[10px] outline-none" value={cepSearch} onChange={e => setCepSearch(e.target.value.replace(/\D/g, '').slice(0, 8))} />
                                    <button onClick={handleCepSearch} className="px-6 bg-slate-900 dark:bg-yellow-400 text-white dark:text-slate-900 rounded-xl font-black uppercase text-[10px]">Buscar</button>
                                </div>
                                {cepCity && <p className="text-[10px] font-black text-emerald-600 uppercase">Localizado: {cepCity} (Raio 10km)</p>}
                            </div>
                        </div>

                        <div className="bg-slate-900 p-8 rounded-[2.5rem] border-4 border-indigo-400 text-center space-y-4">
                            <div className="w-16 h-16 bg-white/10 rounded-3xl mx-auto flex items-center justify-center mb-2">
                                <Ticket size={32} className="text-indigo-400" />
                            </div>
                            <h3 className="text-white font-black uppercase italic">Bilhete Digital</h3>
                            <button 
                                onClick={() => {
                                    onOpenTicketing(undefined, loggedInCard || undefined);
                                }} 
                                className="w-full py-4 bg-indigo-500 text-white rounded-2xl font-black uppercase text-xs flex items-center justify-center gap-2 shadow-xl hover:scale-[1.02] active:scale-95 transition-all"
                            >
                                <ShoppingCart size={16}/> Escolher Rota e Horário
                            </button>
                        </div>

                        <div className="grid gap-4">
                            {filteredRoutes.length === 0 ? (
                                <div className="py-12 bg-white dark:bg-zinc-900 rounded-[2rem] border-2 border-dashed text-center"><p className="text-slate-400 font-black uppercase text-[10px]">Nenhuma rota encontrada</p></div>
                            ) : (
                                filteredRoutes.map(route => {
                                    const activeTrip = trips.find(t => t.route_id === route.id && !t.finished);
                                    return (
                                        <div key={route.id} onClick={() => { setSelectedRouteDetails(route); setDetailDirection('IDA'); }} className="bg-white dark:bg-zinc-900 p-6 rounded-[2rem] border border-slate-100 dark:border-zinc-800 hover:border-yellow-400 cursor-pointer transition-all">
                                            <div className="flex justify-between items-center mb-4">
                                                <span className="bg-slate-900 text-yellow-400 px-3 py-1 rounded-lg text-xs font-black">{route.prefixo_linha}</span>
                                                <span className="text-[10px] font-black text-emerald-600">R$ {route.price.toFixed(2)}</span>
                                            </div>
                                            <h4 className="font-black text-sm uppercase italic mb-3">{route.origin} x {route.destination}</h4>
                                            
                                            {(() => {
                                                const upcomingTrips = trips
                                                    .filter(t => t.route_id === route.id && !t.finished && t.departure_time >= currentTimeStr)
                                                    .sort((a, b) => a.departure_time.localeCompare(b.departure_time))
                                                    .slice(0, 3);
                                                return (
                                                    <div className="pt-4 border-t dark:border-zinc-800 space-y-3">
                                                        <div className="flex items-center gap-2 text-[10px] text-slate-400 font-black uppercase">
                                                            <Clock size={12}/> Próximos Horários (a partir do real):
                                                        </div>
                                                        <div className="grid gap-2">
                                                            {upcomingTrips.length > 0 ? (
                                                                upcomingTrips.map((t, idx) => (
                                                                    <div key={idx} className="p-3 bg-slate-50 dark:bg-zinc-950 rounded-xl border border-slate-100 dark:border-zinc-850 flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 text-left">
                                                                        <div className="flex items-center gap-2">
                                                                            <span className="px-2 py-1 bg-indigo-600 dark:bg-indigo-500 text-white font-black rounded-lg text-[10px]">{t.departure_time}</span>
                                                                            <div className="flex flex-col text-[9px] leading-tight text-slate-500 dark:text-zinc-400 font-medium uppercase">
                                                                                <span>Mot: {t.driver_name}</span>
                                                                                {t.conductor_name && <span>Cob: {t.conductor_name}</span>}
                                                                            </div>
                                                                        </div>
                                                                        <div className="flex items-center gap-2 max-sm:w-full justify-between sm:justify-end">
                                                                            <span className="px-2 py-0.5 bg-yellow-400/15 text-yellow-600 dark:text-yellow-400 font-bold rounded text-[8px] uppercase">Ônibus: {t.bus_number}</span>
                                                                            {route.route_type !== 'URBANO' && (
                                                                                <button 
                                                                                    onClick={(e) => {
                                                                                        e.stopPropagation();
                                                                                        handleBuyClick(t.id, route.id);
                                                                                    }}
                                                                                    className="px-2.5 py-1.5 bg-indigo-600 hover:bg-slate-900 active:scale-95 text-white font-black rounded-lg text-[8px] uppercase flex items-center gap-1 transition-all"
                                                                                >
                                                                                    <span>Comprar</span>
                                                                                    <ShoppingCart size={11} className="text-white/80" />
                                                                                </button>
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                ))
                                                            ) : (
                                                                <span className="text-[9px] italic text-slate-400 uppercase">Sem horários agendados a partir de agora</span>
                                                            )}
                                                        </div>
                                                    </div>
                                                );
                                            })()}
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </div>
                )}

                {activeTab === 'recharge' && (
                    <div className="space-y-6">
                        <div className="bg-white dark:bg-zinc-900 p-8 rounded-[2.5rem] border border-slate-100 dark:border-zinc-800 space-y-6">
                            <h2 className="text-2xl font-black uppercase italic">Meus <span className="text-yellow-600">Saldos</span></h2>
                            <div className="flex gap-2">
                                <input type="text" placeholder="CPF/CARTÃO..." className="flex-1 px-4 py-4 bg-slate-50 dark:bg-zinc-800 rounded-xl font-black uppercase text-[10px] outline-none" value={rechargeQuery} onChange={e => setRechargeQuery(e.target.value)} />
                                <button onClick={handleRechargeSearch} className="px-6 bg-slate-900 dark:bg-yellow-400 text-white dark:text-slate-900 rounded-xl font-black uppercase text-[10px]">Buscar</button>
                            </div>
                        </div>
                        {rechargeCard && (
                            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-yellow-400 p-8 rounded-[2.5rem] border-4 border-slate-900 space-y-6">
                                <h3 className="font-black uppercase italic text-center">{rechargeCard.name} {rechargeCard.surname}</h3>
                                <div className="p-4 bg-white rounded-2xl text-center"><p className="text-[10px] font-black uppercase text-slate-400">Saldo Atual</p><p className="text-2xl font-black">R$ {rechargeCard.balance.toFixed(2)}</p></div>
                                <div className="space-y-4">
                                    <input type="text" className="w-full py-4 text-center text-2xl font-black bg-slate-900 text-yellow-400 rounded-2xl outline-none" value={rechargeAmount} onChange={e => setRechargeAmount(formatCurrencyRTL(e.target.value))} />
                                    <button onClick={handleRecharge} className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black uppercase text-xs">Confirmar Recarga</button>
                                </div>
                            </motion.div>
                        )}
                    </div>
                )}

                {activeTab === 'work-with-us' && (
                    <div className="animate-in fade-in duration-500">
                        <JobApplicationForm onSuccess={() => setActiveTab('routes')} addToast={addToast} currentUser={loggedInCard ? { id: loggedInCard.id, full_name: `${loggedInCard.name}`, role: 'PASSENGER' } : null as any} />
                    </div>
                )}

                {activeTab === 'notices' && (
                    <div className="space-y-6 transition-colors">
                        <h2 className="text-2xl font-black uppercase italic px-2">Mural de <span className="text-yellow-600">Avisos</span></h2>
                        {activeNotices.length === 0 ? (
                            <div className="py-20 text-center text-slate-400 font-black uppercase text-[10px] italic">Sem novidades.</div>
                        ) : (
                            activeNotices.map(notice => (
                                <div key={notice.id} className={`bg-white dark:bg-zinc-900 p-6 rounded-[2rem] border-l-8 transition-all ${!readNotices.has(notice.id) ? 'border-yellow-400' : 'border-slate-200 dark:border-zinc-800'}`}>
                                    <div className="flex justify-between items-start mb-4">
                                        <div className="flex items-center gap-2"><Megaphone size={16} className="text-yellow-500"/><h4 className="font-black text-[10px] uppercase">{notice.title}</h4></div>
                                        <button onClick={() => markAsRead(notice.id)} className="text-[8px] font-black uppercase text-slate-400 hover:text-slate-600">Lido</button>
                                    </div>
                                    <p className="text-xs italic text-slate-500 leading-relaxed bg-slate-50 dark:bg-zinc-800/50 p-4 rounded-xl">"{notice.content}"</p>
                                </div>
                            ))
                        )}
                    </div>
                )}
            {showThemePopup && (
              <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-200 text-slate-900 dark:text-zinc-100">
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
                          className={`p-4 rounded-xl border-2 font-black uppercase text-[10px] tracking-wider transition-all flex items-center justify-center gap-2 ${themeMode === 'light' ? 'border-yellow-400 bg-yellow-50/20 text-slate-900' : 'border-slate-100 dark:border-zinc-800 text-slate-400 hover:border-slate-200 bg-transparent'}`}
                        >
                          <Sun size={16} className={themeMode === 'light' ? 'text-yellow-500' : ''} />
                          Modo Claro
                        </button>
                        <button 
                          type="button" 
                          onClick={() => onChangeThemeMode?.('dark')}
                          className={`p-4 rounded-xl border-2 font-black uppercase text-[10px] tracking-wider transition-all flex items-center justify-center gap-2 ${themeMode === 'dark' ? 'border-yellow-400 bg-yellow-400/10 text-white animate-pulse' : 'border-slate-100 dark:border-zinc-800 text-slate-400 hover:border-slate-805'}`}
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
                      <p className="mt-2 text-[8px] font-bold text-slate-400 uppercase italic leading-tight ml-2">Melhora a legibilidade do sistema para passageiros e motoristas em ambientes externos.</p>
                    </div>

                    {/* Accent Color Palette Selector */}
                    <div>
                      <label className="block text-[10px] font-black uppercase text-slate-400 mb-3 tracking-widest leading-none block">Paleta de Cores Primária</label>
                      <div className="grid grid-cols-1 gap-2 max-h-[160px] overflow-y-auto pr-1">
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
                    </div>
                  </div>
                </div>
              </div>
            )}
            </div>
      </div>
    </div>
  );
};

export default PassengerInterface;
