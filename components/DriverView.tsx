
import React, { useMemo, useState, useEffect, useRef } from 'react';
import { BusRoute, Trip, User, Vehicle, Company, TicketSale } from '../types';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../services/database';
import { 
  BusFront, 
  Clock, 
  MapPin, 
  CheckCircle2, 
  Play, 
  Square, 
  AlertCircle, 
  ArrowRight, 
  Calendar,
  Hash,
  Search,
  ClipboardList,
  User as UserIcon,
  Ticket,
  X,
  Navigation,
  Gauge,
  Droplets,
  CheckSquare,
  DollarSign,
  CreditCard,
  History,
  AlertTriangle,
  Layout
} from 'lucide-react';
import TripSelectionModal from './TripSelectionModal';

interface DriverViewProps {
  trips: Trip[];
  routes: BusRoute[];
  vehicles: Vehicle[];
  companies: Company[];
  currentUser: User | null;
  onUpdateTrip: (trip: Trip) => void;
  addToast: (message: string, type?: 'success' | 'white' | 'error') => void;
  forcedRole?: 'URBANO' | 'RODOVIARIO' | 'COBRADOR';
  isSupervision?: boolean;
  ticketingConfig?: any;
}

const DriverView: React.FC<DriverViewProps> = ({ 
  trips = [], 
  routes = [], 
  vehicles = [], 
  companies = [],
  currentUser, 
  onUpdateTrip, 
  addToast,
  forcedRole,
  isSupervision = false,
  ticketingConfig
}) => {
  const [filterDate, setFilterDate] = useState(new Date().toISOString().split('T')[0]);
  const [showTutorial, setShowTutorial] = useState(false);
  const [tutorialStep, setTutorialStep] = useState(0);
  const [checkinModal, setCheckinModal] = useState<{ trip: Trip; mode: 'start' | 'end' } | null>(null);

  useEffect(() => {
    if (currentUser?.id) {
      const isCompleted = localStorage.getItem(`vialivre_driver_tutorial_completed_${currentUser.id}`);
      if (!isCompleted) {
        setShowTutorial(true);
      }
    }
  }, [currentUser]);
  const [boardingMapTrip, setBoardingMapTrip] = useState<Trip | null>(null);
  const [showVTPrompt, setShowVTPrompt] = useState(false);
  const [vtInputTemp, setVtInputTemp] = useState('');
  const [tickets, setTickets] = useState<TicketSale[]>([]);
  const [formData, setFormData] = useState<any>({
    odometer: '',
    fuel: 'CHEIO',
    checklist: false,
    turnstile: '',
    ticketNumber: '',
    cash: '',
    cardPix: '',
    gratuity: '',
    confirm: false
  });

  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    audioRef.current = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
            setCheckinModal(null);
            setBoardingMapTrip(null);
        }
        if (e.key === 'Enter') {
            const activeElement = document.activeElement;
            if (activeElement && (activeElement.tagName === 'INPUT' || activeElement.tagName === 'SELECT' || activeElement.tagName === 'TEXTAREA')) {
                const form = activeElement.closest('form');
                if (form) {
                    const inputs = Array.from(form.querySelectorAll('input, select, textarea')) as HTMLElement[];
                    const index = inputs.indexOf(activeElement as HTMLElement);
                    if (index > -1 && index < inputs.length - 1) {
                        inputs[index + 1].focus();
                        e.preventDefault();
                    }
                }
            }
        }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [checkinModal, boardingMapTrip]);

  const jobRole = useMemo(() => {
    if (forcedRole) return forcedRole;
    const role = currentUser?.role?.toUpperCase() || '';
    if (role.includes('RODOVIARIO')) return 'RODOVIARIO';
    if (role.includes('COBRADOR')) return 'COBRADOR';
    if (role.includes('URBANO')) return 'URBANO';
    
    const title = currentUser?.job_title?.toUpperCase() || '';
    if (title.includes('RODOVIÁRIO') || title.includes('RODOVIARIO')) return 'RODOVIARIO';
    if (title.includes('COBRADOR')) return 'COBRADOR';
    return 'URBANO';
  }, [currentUser, forcedRole]);

  // Real-time tickets for Rodoviario
  useEffect(() => {
    if (jobRole !== 'RODOVIARIO') return;

    const fetchTickets = async () => {
        const { data } = await supabase.from('ticket_sales').select('*');
        if (data) setTickets(data);
    };
    fetchTickets();

    const channel = supabase
      .channel('ticket-alerts')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'ticket_sales' }, (payload) => {
        const newTicket = payload.new as TicketSale;
        setTickets(prev => [...prev, newTicket]);
        
        // Notify driver if it's for an active trip
        const activeTripIds = myTrips.filter(t => t.status === 'Em Andamento' || t.status === 'Em Rota').map(t => t.id);
        if (activeTripIds.includes(newTicket.trip_id)) {
            addToast(`Venda Realizada: Poltrona ${newTicket.seat_number}`, 'success');
            if (audioRef.current) {
                audioRef.current.currentTime = 0;
                audioRef.current.play().catch(err => console.error("Erro ao tocar alarme:", err));
            }
        }
      })
      .subscribe();

    return () => { channel.unsubscribe(); };
  }, [jobRole, filterDate, currentUser]);

  const myTrips = useMemo(() => {
    const isUserAdmin = currentUser?.role === 'ADMIN' || (currentUser?.job_title || '').toUpperCase().includes('ADMINISTRADOR');

    return trips.filter(t => {
        if (!isUserAdmin) {
            // Collaborators only see trips assigned to themselves across all views (including Monitoramento)
            const isAssigned = (t.driver_id === currentUser?.id || t.conductor_id === currentUser?.id);
            if (!isAssigned) return false;
        } else {
            // Admin only filtered by isAssigned if they aren't in supervision/monitoring mode
            if (!isSupervision) {
                const isAssigned = (t.driver_id === currentUser?.id || t.conductor_id === currentUser?.id);
                if (!isAssigned) return false;
            }
        }
        
        if (t.trip_date !== filterDate) return false;

        // If a specific cargo tab is selected (URBANO, RODOVIARIO)
        if (forcedRole) {
            if (jobRole === 'URBANO') return t.trip_type === 'Urbano';
            if (jobRole === 'RODOVIARIO') return t.trip_type === 'Rodoviário';
        }
        
        return true;
    }).sort((a, b) => a.departure_time.localeCompare(b.departure_time));
  }, [trips, currentUser, filterDate, routes, jobRole, forcedRole, isSupervision]);

  const activeTrip = useMemo(() => myTrips.find(t => t.status === 'Em Andamento' || t.status === 'Em Rota'), [myTrips]);

  const handleStartTrip = (trip: Trip) => {
    if (activeTrip && activeTrip.id !== trip.id) {
        addToast("Você já possui uma viagem em andamento. Finalize-a antes de iniciar outra.", "error");
        return;
    }
    setFormData({
        odometer: trip.initial_odometer || '',
        fuel: trip.fuel_level || 'CHEIO',
        checklist: !!trip.checklist_ok,
        turnstile: trip.initial_turnstile || '',
        ticketNumber: trip.initial_ticket_number || '',
        confirm: false
    });
    setCheckinModal({ trip, mode: 'start' });
  };

  const handleEndTrip = (trip: Trip) => {
    setFormData({
        odometer: trip.final_odometer || '',
        fuel: trip.fuel_level || 'CHEIO',
        checklist: !!trip.checklist_ok,
        turnstile: trip.final_turnstile || '',
        ticketNumber: trip.final_ticket_number || '',
        cash: trip.cash_total || '',
        cardPix: trip.card_pix_total || '',
        gratuity: trip.gratuity_total || '',
        confirm: false
    });
    setCheckinModal({ trip, mode: 'end' });
  };

  const handleConfirmClosure = () => {
    if (!checkinModal) return;
    const { trip, mode } = checkinModal;

    if (!formData.confirm) {
        addToast("Marque a checkbox de confirmação para salvar.", "warning");
        return;
    }

    const now = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    const isUrban = trip.trip_type === 'Urbano';

    const updateData: Partial<Trip> = {
        ...trip,
        status: mode === 'start' ? 'Em Andamento' : 'Concluída',
        fuel_level: formData.fuel,
        checklist_ok: formData.checklist,
    };

    if (mode === 'start') {
        // Automatic Exit Log
        if (jobRole !== 'COBRADOR') {
            supabase.from('driver_logs').insert({
                driver_id: currentUser?.id,
                vehicle_id: vehicles.find(v => v.prefix === trip.bus_number)?.id,
                odometer_start: Number(formData.odometer),
                created_at: new Date().toISOString(),
                status: 'OPEN',
                system_id: currentUser?.system_id,
                notes: `Início automático via DriverView - Viagem ${trip.id}`
            }).then(({ error }) => {
                if (error) console.error("Erro ao salvar log automático:", error);
            });
        }

        updateData.actual_start_time = now;
        if (jobRole !== 'COBRADOR') updateData.initial_odometer = Number(formData.odometer);
        if (isUrban || jobRole === 'COBRADOR') updateData.initial_turnstile = Number(formData.turnstile);
        if (jobRole === 'RODOVIARIO') updateData.initial_ticket_number = formData.ticketNumber;
    } else {
        updateData.actual_end_time = now;
        if (jobRole !== 'COBRADOR') updateData.final_odometer = Number(formData.odometer);
        updateData.finished = true;
        if (isUrban || jobRole === 'COBRADOR') {
            updateData.final_turnstile = Number(formData.turnstile);
            updateData.cash_total = Number(formData.cash);
            updateData.card_pix_total = Number(formData.cardPix);
            updateData.gratuity_total = Number(formData.gratuity);
        }
        if (jobRole === 'RODOVIARIO') updateData.final_ticket_number = formData.ticketNumber;
    }

    onUpdateTrip(updateData as Trip);
    addToast(`Viagem ${mode === 'start' ? 'iniciada' : 'finalizada'} com sucesso!`);
    setCheckinModal(null);
  };

  const finalizeSection = async (trip: Trip) => {
    const route = routes.find(r => r.id === trip.route_id);
    if (!route || !route.sections) return;

    const currentIndex = trip.current_section_index || 0;
    const currentSection = route.sections[currentIndex];
    
    if (!currentSection) return;

    // Update tickets status
    const ticketsToUpdate = tickets.filter(t => t.trip_id === trip.id && t.section_destination === currentSection.destination && t.status === 'boarded');
    
    for (const ticket of ticketsToUpdate) {
        await supabase.from('ticket_sales').update({ status: 'disembarked' }).eq('id', ticket.id);
    }

    const nextIndex = currentIndex + 1;
    onUpdateTrip({
        ...trip,
        current_section_index: nextIndex >= route.sections.length ? currentIndex : nextIndex
    });

    addToast(`Seção ${currentSection.name} finalizada. Poltronas liberadas.`);
  };

  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<string>('DINHEIRO');
  const [couponCode, setCouponCode] = useState('');
  const [discountValue, setDiscountValue] = useState(0);

  // Auto-fill and apply coupons based on selected payment method
  useEffect(() => {
    if (!ticketingConfig || !ticketingConfig.active_coupons) {
      if (discountValue > 0) {
        setDiscountValue(0);
        setCouponCode('');
      }
      return;
    }

    // Find any coupon specifically linked to this selected payment method, e.g. [PGTO: DINHEIRO]
    const matchedCoupon = (ticketingConfig.active_coupons || []).find((c: any) => {
      if (c.conditions && c.conditions.includes('[PGTO:')) {
        const requiredMethod = c.conditions.match(/\[PGTO:\s*(.+?)\]/)?.[1];
        return requiredMethod && requiredMethod.toUpperCase() === selectedPaymentMethod.toUpperCase();
      }
      return false;
    });

    if (matchedCoupon) {
      setCouponCode(matchedCoupon.code);

      // Apply coupon discount automatically
      const route = routes.find(r => r.id === activeTrip?.route_id);
      const sectionIndex = activeTrip?.current_section_index;
      const basePrice = (sectionIndex === -1 || sectionIndex === undefined) 
          ? (route?.price || 0) 
          : (route?.sections?.[sectionIndex]?.price || 0);

      const discount = matchedCoupon.type === 'PERCENT' ? (basePrice * (matchedCoupon.discount / 100)) : matchedCoupon.discount;
      setDiscountValue(discount);
      addToast(`Cupom ${matchedCoupon.code} aplicado automaticamente para a forma de pagamento ${selectedPaymentMethod}!`, "success");
    } else {
      // If there was an active payment-method-specific coupon but it doesn't apply, reset it
      setDiscountValue(0);
      setCouponCode('');
    }
  }, [selectedPaymentMethod, ticketingConfig, activeTrip, routes]);

  const [paymentDetails, setPaymentDetails] = useState({
      received: '',
      change: 0,
      cardOrCpf: ''
  });

  const handleApplyCoupon = () => {
    if (!couponCode || !ticketingConfig) return;
    const coupon = (ticketingConfig.active_coupons || []).find((c: any) => 
        c.code.toUpperCase() === couponCode.toUpperCase() || 
        (c.numeric_code && c.numeric_code === couponCode)
    );

    if (coupon) {
        // Validation: Payment Method Restriction
        if (coupon.conditions && coupon.conditions.includes('[PGTO:')) {
            const requiredMethod = coupon.conditions.match(/\[PGTO:\s*(.+?)\]/)?.[1];
            if (requiredMethod && selectedPaymentMethod !== requiredMethod.toUpperCase()) {
                setDiscountValue(0);
                addToast(`Este cupom é válido apenas para pagamento via ${requiredMethod.toUpperCase()}.`, "warning");
                return;
            }
        }

        const route = routes.find(r => r.id === activeTrip?.route_id);
        const sectionIndex = activeTrip?.current_section_index;
        const basePrice = (sectionIndex === -1 || sectionIndex === undefined) 
            ? (route?.price || 0) 
            : (route?.sections?.[sectionIndex]?.price || 0);

        const discount = coupon.type === 'PERCENT' ? (basePrice * (coupon.discount / 100)) : coupon.discount;
        setDiscountValue(discount);
        addToast(`Cupom ${coupon.code} aplicado! Desconto de R$ ${discount.toFixed(2)}`, "success");
    } else {
        setDiscountValue(0);
        addToast("Cupom inválido ou expirado.", "error");
    }
  };

  const handleRegisterPassage = () => {
    if (!activeTrip) return;
    const route = routes.find(r => r.id === activeTrip.route_id);
    if (!route) return;

    let basePrice = 0;
    let label = '';

    const sectionIndex = activeTrip.current_section_index;
    
    if (sectionIndex === -1 || sectionIndex === undefined) {
      basePrice = route.price;
      label = "Passagem INTEGRAL";
    } else {
      const section = route.sections?.[sectionIndex];
      if (section) {
        basePrice = section.price;
        label = `Seção: ${section.name}`;
      }
    }
    
    if (basePrice === 0 && label === '') return;

    // Apply discount
    const price = Math.max(0, basePrice - discountValue);

    // Additional validations for VT
    if (selectedPaymentMethod === 'IMPCARD' && !paymentDetails.cardOrCpf) {
        addToast("Por favor, informe o Número do Cartão ou CPF para Vale Transporte.", "error");
        return;
    }

    addToast(`${label} (${selectedPaymentMethod}) R$ ${price.toFixed(2)} registrada! ${discountValue > 0 ? `(Desc: R$ ${discountValue.toFixed(2)})` : ''}`, 'success');
    
    const updateData: Partial<Trip> = { ...activeTrip };
    
    if (selectedPaymentMethod === 'DINHEIRO') {
        updateData.cash_total = (activeTrip.cash_total || 0) + price;
    } else if (['CREDITO', 'DEBITO', 'PIX', 'CARD'].includes(selectedPaymentMethod)) {
        updateData.card_pix_total = (activeTrip.card_pix_total || 0) + price;
    } else if (selectedPaymentMethod === 'IMPCARD') {
        updateData.card_pix_total = (activeTrip.card_pix_total || 0) + price;
    } else if (selectedPaymentMethod === 'GRATUIDADE') {
        updateData.gratuity_total = (activeTrip.gratuity_total || 0) + 1;
    }
    
    onUpdateTrip(updateData as Trip);
    
    // Reset payment details
    setPaymentDetails({ received: '', change: 0, cardOrCpf: '' });
    setCouponCode('');
    setDiscountValue(0);
  };

  const isUrbanCurrentView = routes.find(r => r.id === activeTrip?.route_id)?.route_type === 'URBANO';

  const tutorialSteps = [
    {
      title: "Bem-Vindo ao Tutorial de Bordo!",
      description: "Olá, Motorista! Este é o seu espaço de trabalho digital. A partir de agora, daremos um tour rápido sobre como utilizar as ferramentas de viagem e comandar suas programações com facilidade.",
      icon: <Layout className="text-yellow-500" size={44} />,
    },
    {
      title: "Como Iniciar uma Viagem",
      description: "Localize a sua viagem programada na lista do dia. Clique no botão verde 'Iniciar Viagem'. Para itinerários Urbanos, certifique-se de preencher a roleta inicial na janela que se abrir, para poder despachar de forma correta.",
      icon: <Play className="text-emerald-500 animate-pulse" size={44} />,
    },
    {
      title: "Durante a Viagem",
      description: "Uma vez iniciada, a viagem estará com o status 'Em Rota'. Todas as estatísticas e vendas em tempo real serão sincronizadas para te dar suporte no caminho.",
      icon: <Navigation className="text-blue-500" size={44} />,
    },
    {
      title: "Como Finalizar sua Viagem",
      description: "Ao chegar ao destino final, clique no botão azul 'Finalizar Viagem'. Em trajetos urbanos, será aberta uma janela para preencher a roleta final e o faturamento do dia (dinheiro, pix, etc.). É super prático!",
      icon: <CheckCircle2 className="text-indigo-500" size={44} />,
    }
  ];

  const handleFinishTutorial = () => {
    if (currentUser?.id) {
      localStorage.setItem(`vialivre_driver_tutorial_completed_${currentUser.id}`, 'true');
    }
    setShowTutorial(false);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-24">
      <TripSelectionModal 
        isOpen={!!boardingMapTrip}
        onClose={() => setBoardingMapTrip(null)}
        trips={myTrips}
        routes={routes}
        vehicles={vehicles}
        currentUser={currentUser}
        activeTripId={activeTrip?.id || null}
        tickets={tickets}
        onStartTrip={handleStartTrip}
        onFinalizeSection={finalizeSection}
      />
      
      {/* Header de Boas-vindas */}
      <div className="bg-slate-900 text-white p-8 rounded-[2.5rem] border-4 border-yellow-400 shadow-2xl relative overflow-hidden">
        {currentUser?.license_validity && new Date(currentUser.license_validity) < new Date() && (
            <div className="absolute top-4 right-4 bg-red-600 text-white px-4 py-2 rounded-xl font-black text-[10px] uppercase animate-pulse shadow-lg flex items-center gap-2 z-20">
                <AlertTriangle size={14} /> CNH VENCIDA
            </div>
        )}
        <div className="relative z-10">
          <p className="text-[10px] font-black uppercase tracking-[0.4em] text-yellow-400 mb-2">Painel do Colaborador - {currentUser?.role === 'ADMIN' ? 'ADMINISTRADOR' : (currentUser?.job_title || 'Motorista')}</p>
          <h2 className="text-3xl font-black uppercase italic tracking-tighter mb-1">Olá, {currentUser?.full_name?.split(' ')[0]}</h2>
          <div className="flex flex-wrap gap-4 mt-4">
              <div className="bg-white/10 px-4 py-2 rounded-xl backdrop-blur-sm border border-white/10">
                  <p className="text-[8px] font-black text-yellow-400 uppercase mb-1">Matrícula</p>
                  <p className="text-sm font-black italic">{currentUser?.registration_id || 'N/A'}</p>
              </div>
              <div className="bg-white/10 px-4 py-2 rounded-xl backdrop-blur-sm border border-white/10">
                  <p className="text-[8px] font-black text-yellow-400 uppercase mb-1">Ponto Focal</p>
                  <p className="text-sm font-black italic">
                      {(() => {
                          const userCompany = companies.find(c => c.id === currentUser?.company_id);
                          return userCompany?.nome_fantasia || userCompany?.name || currentUser?.unidade || 'Central';
                      })()}
                  </p>
              </div>
              {(jobRole === 'URBANO' || jobRole === 'RODOVIARIO') && (
                  <div className="bg-white/10 px-4 py-2 rounded-xl backdrop-blur-sm border border-white/10">
                      <p className="text-[8px] font-black text-yellow-400 uppercase mb-1">CNH ({currentUser?.license_type || 'N/A'})</p>
                      <p className="text-sm font-black italic">{currentUser?.license_validity ? new Date(currentUser.license_validity).toLocaleDateString('pt-BR') : 'Sem data'}</p>
                  </div>
              )}
          </div>
        </div>
        <BusFront size={120} className="absolute -right-8 -bottom-8 text-white/5 rotate-12" />
      </div>

      {/* Seletor de Data */}
      <div className="flex bg-white dark:bg-zinc-900 p-4 rounded-[2rem] border border-slate-100 dark:border-zinc-800 shadow-sm items-center gap-4">
        <Calendar className="text-yellow-500" size={24} />
        <div className="flex-1">
          <p className="text-[8px] font-black text-slate-400 uppercase mb-1 ml-1">Data da Escala</p>
          <input 
            type="date" 
            className="w-full bg-transparent font-black text-slate-900 dark:text-white outline-none"
            value={filterDate || ''}
            onChange={e => setFilterDate(e.target.value)}
          />
        </div>
      </div>

      {/* Alerta de Viagem Ativa */}
      <AnimatePresence>
        {activeTrip && (
          <div className="space-y-4">
             <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-emerald-500 text-white p-6 rounded-[2rem] shadow-xl flex items-center justify-between border-2 border-emerald-400"
            >
                <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center animate-pulse">
                    <Play size={24} fill="white" />
                </div>
                <div>
                    <p className="text-[10px] font-black uppercase tracking-widest opacity-80 mb-1">Viagem em Curso</p>
                    <h3 className="text-xl font-black uppercase italic leading-none">
                    {routes.find(r => r.id === activeTrip.route_id)?.prefixo_linha}
                    </h3>
                </div>
                </div>
                <div className="flex gap-2">
                    {jobRole === 'RODOVIARIO' && (
                        <button 
                            onClick={() => setBoardingMapTrip(activeTrip)}
                            className="bg-white text-emerald-600 px-6 py-3 rounded-xl font-black uppercase text-[10px] tracking-widest shadow-lg hover:bg-slate-100 transition-all flex items-center gap-2"
                        >
                            <Ticket size={14} /> Mapa
                        </button>
                    )}
                    <button 
                    onClick={() => handleEndTrip(activeTrip)}
                    className="bg-white text-emerald-600 px-6 py-3 rounded-xl font-black uppercase text-[10px] tracking-widest shadow-lg hover:bg-slate-100 transition-all flex items-center gap-2"
                    >
                    <Square size={14} fill="currentColor" /> Finalizar
                    </button>
                </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Seção do Cobrador */}
      {jobRole === 'COBRADOR' && activeTrip && (
          <div className="bg-white dark:bg-zinc-900 p-8 rounded-[2.5rem] border border-slate-100 dark:border-zinc-800 shadow-xl space-y-6">
              <div className="flex items-center justify-between">
                  <h3 className="text-xl font-black uppercase italic italic tracking-tighter text-slate-900 dark:text-white">Registro de Passagem (Cobrador)</h3>
                  <div className="flex items-center gap-2 text-emerald-500 bg-emerald-50 px-4 py-2 rounded-xl">
                      <DollarSign size={16} />
                      <span className="text-[10px] font-black uppercase">Acumulado: R$ {(activeTrip.cash_total || 0).toFixed(2)}</span>
                  </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="md:col-span-1">
                      <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-2">Trecho da Viagem</label>
                      <select 
                        className="w-full px-6 py-5 bg-slate-50 dark:bg-zinc-800 rounded-2xl font-black text-slate-900 dark:text-white border-2 border-slate-100 dark:border-zinc-700 outline-none focus:border-yellow-400"
                        value={activeTrip.current_section_index ?? -1}
                        onChange={(e) => onUpdateTrip({...activeTrip, current_section_index: Number(e.target.value)})}
                      >
                          {routes.find(r => r.id === activeTrip.route_id) && (
                              <option value={-1}>
                                  {routes.find(r => r.id === activeTrip.route_id)?.origin} » {routes.find(r => r.id === activeTrip.route_id)?.destination} (INTEGRAL - R$ {routes.find(r => r.id === activeTrip.route_id)?.price.toFixed(2)})
                              </option>
                          )}
                          {routes.find(r => r.id === activeTrip.route_id)?.sections?.map((s, idx) => (
                              <option key={idx} value={idx}>{s.origin} » {s.destination} (R$ {s.price.toFixed(2)})</option>
                          ))}
                      </select>
                  </div>

                  <div className="md:col-span-1">
                      <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-2">Forma de Pagamento</label>
                      <select 
                        className="w-full px-6 py-5 bg-slate-50 dark:bg-zinc-800 rounded-2xl font-black text-slate-900 dark:text-white border-2 border-slate-100 dark:border-zinc-700 outline-none focus:border-yellow-400"
                        value={selectedPaymentMethod}
                        onChange={(e) => {
                            const val = e.target.value;
                            setSelectedPaymentMethod(val);
                            if (val === 'IMPCARD') {
                                setVtInputTemp(paymentDetails.cardOrCpf || '');
                                setShowVTPrompt(true);
                            }
                        }}
                      >
                          {ticketingConfig?.payment_methods?.map((m: string) => (
                              <option key={m} value={m.toUpperCase()}>{m.toUpperCase().replace('_', ' ')}</option>
                          )) || (
                              <>
                                <option value="DINHEIRO">DINHEIRO</option>
                                <option value="IMPCARD">VALE TRANSPORTE</option>
                                <option value="PIX">PIX</option>
                                <option value="CARD">CARTÃO</option>
                                <option value="GRATUIDADE">GRATUIDADE</option>
                              </>
                          )}
                      </select>
                  </div>

                  <div className="md:col-span-1">
                      <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-2">Cupom de Desconto</label>
                      <div className="flex gap-2">
                        <input 
                            placeholder="CÓDIGO"
                            className="flex-1 px-6 py-5 bg-slate-50 dark:bg-zinc-800 rounded-2xl font-black text-slate-900 dark:text-white border-2 border-slate-100 dark:border-zinc-700 outline-none focus:border-yellow-400 uppercase"
                            value={couponCode}
                            onChange={(e) => setCouponCode(e.target.value)}
                        />
                        <button 
                            onClick={handleApplyCoupon}
                            className="px-6 py-5 bg-slate-900 hover:bg-slate-800 text-white rounded-2xl font-black uppercase text-[10px] active:scale-95 transition-transform"
                        >
                            Aplicar
                        </button>
                      </div>
                      {ticketingConfig?.active_coupons && ticketingConfig.active_coupons.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-2">
                              {ticketingConfig.active_coupons.map((c: any) => (
                                  <button 
                                    key={c.code}
                                    onClick={() => { setCouponCode(c.code); }}
                                    className="px-2 py-1 bg-indigo-50 dark:bg-indigo-900/20 text-[8px] font-bold text-indigo-600 rounded border border-indigo-100 dark:border-indigo-800 uppercase"
                                  >
                                      {c.code} ({c.type === 'PERCENT' ? `${c.discount}%` : `R$ ${c.discount}`})
                                  </button>
                              ))}
                          </div>
                      )}
                  </div>

                  <div className="md:col-span-1">
                      {selectedPaymentMethod === 'DINHEIRO' && (
                          <div>
                              <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-2">Valor Recebido (Troco)</label>
                              <div className="flex gap-2">
                                  <input 
                                    type="number" 
                                    placeholder="0.00"
                                    className="w-full px-6 py-5 bg-slate-50 dark:bg-zinc-800 rounded-2xl font-black text-slate-900 dark:text-white border-2 border-slate-100 dark:border-zinc-700 outline-none focus:border-yellow-400"
                                    value={paymentDetails.received}
                                    onChange={(e) => {
                                        const received = e.target.value;
                                        const route = routes.find(r => r.id === activeTrip.route_id);
                                        const price = activeTrip.current_section_index === -1 ? (route?.price || 0) : (route?.sections?.[activeTrip.current_section_index || 0]?.price || 0);
                                        setPaymentDetails({
                                            ...paymentDetails,
                                            received,
                                            change: Number(received) > price ? Number(received) - price : 0
                                        });
                                    }}
                                  />
                                  {paymentDetails.change > 0 && (
                                      <div className="bg-yellow-100 text-yellow-800 px-4 py-5 rounded-2xl font-black text-xs flex items-center justify-center whitespace-nowrap">
                                          T: R$ {paymentDetails.change.toFixed(2)}
                                      </div>
                                  )}
                              </div>
                          </div>
                      )}
                      {selectedPaymentMethod === 'IMPCARD' && (
                          <div>
                              <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-2">Cartão ou CPF (VT)</label>
                              <input 
                                type="text" 
                                placeholder="000.000.000-00"
                                className="w-full px-6 py-5 bg-slate-50 dark:bg-zinc-800 rounded-2xl font-black text-slate-900 dark:text-white border-2 border-slate-100 dark:border-zinc-700 outline-none focus:border-yellow-400"
                                value={paymentDetails.cardOrCpf}
                                onChange={(e) => setPaymentDetails({...paymentDetails, cardOrCpf: e.target.value})}
                              />
                          </div>
                      )}
                      {(['PIX', 'CARD', 'GRATUIDADE'].includes(selectedPaymentMethod)) && (
                          <div className="flex items-center justify-center h-full pt-6">
                              <div className="text-[10px] font-black text-slate-400 uppercase italic">Registro Automático</div>
                          </div>
                      )}
                  </div>
              </div>
              
              <div className="flex items-end gap-2">
                  <button 
                    onClick={handleRegisterPassage}
                    className="flex-1 py-5 bg-emerald-600 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2"
                  >
                     <DollarSign size={14} /> Registrar Passagem
                  </button>
                  <button 
                    onClick={() => handleEndTrip(activeTrip)}
                    className="flex-1 py-5 bg-slate-900 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2"
                  >
                     <CheckCircle2 size={14} /> Fechar Caixa
                  </button>
              </div>

              {/* Payment Methods Display */}
              <div className="mt-3 flex flex-wrap gap-2 px-2">
                {routes.find(r => r.id === activeTrip.route_id)?.payment_methods_accepted?.map((method, idx) => {
                  const iconMap: Record<string, any> = {
                    'DINHEIRO': <DollarSign size={10} />,
                    'PIX': <Hash size={10} />,
                    'CREDITO': <CreditCard size={10} />,
                    'DEBITO': <CreditCard size={10} />,
                    'IMPCARD': <CreditCard size={10} />,
                    'CARD': <CreditCard size={10} />
                  };
                  return (
                    <div key={idx} className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 dark:bg-zinc-800 rounded-full border border-slate-200 dark:border-zinc-700">
                      <span className="text-yellow-600">{iconMap[method.toUpperCase()] || <DollarSign size={10} />}</span>
                      <span className="text-[8px] font-black uppercase text-slate-500 dark:text-slate-400">{method}</span>
                    </div>
                  );
                })}
              </div>
          </div>
      )}

      {/* Lista de Viagens do Dia */}
      <div className="space-y-4">
        <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4 mb-2 flex items-center gap-2">
          <ClipboardList size={14} /> Minha Escala de Hoje
        </h3>

        {myTrips.length === 0 ? (
          <div className="bg-white dark:bg-zinc-900 p-12 rounded-[2.5rem] border-2 border-dashed border-slate-200 dark:border-zinc-800 text-center">
            <div className="w-16 h-16 bg-slate-50 dark:bg-zinc-800 rounded-full flex items-center justify-center mx-auto mb-4">
              <Calendar size={32} className="text-slate-300" />
            </div>
            <p className="text-sm font-bold text-slate-500 uppercase tracking-widest">Nenhuma viagem escalada para este dia.</p>
          </div>
        ) : (
          <div className="grid gap-4">
            {myTrips.map(trip => {
              const route = routes.find(r => r.id === trip.route_id);
              const vehicle = vehicles.find(v => v.prefix === trip.bus_number);
              const isUrban = route?.route_type === 'URBANO';
              
              return (
                <motion.div 
                  key={trip.id}
                  layout
                  className={`bg-white dark:bg-zinc-900 p-6 rounded-[2.5rem] border border-slate-100 dark:border-zinc-800 shadow-sm relative overflow-hidden transition-all ${
                    trip.status === 'Em Rota' ? 'ring-2 ring-emerald-500' : 
                    trip.status === 'Concluída' ? 'opacity-60 bg-slate-50' : ''
                  }`}
                >
                  <div className="flex items-start justify-between mb-6">
                    <div className="flex items-center gap-4">
                      <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shadow-inner ${
                        trip.status === 'Em Rota' ? 'bg-emerald-500 text-white' :
                        trip.status === 'Concluída' ? 'bg-slate-200 text-slate-400' :
                        'bg-yellow-400 text-slate-900'
                      }`}>
                        <BusFront size={28} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{route?.prefixo_linha}</span>
                          {isUrban && <span className="bg-blue-100 text-blue-600 px-2 py-0.5 rounded text-[8px] font-black uppercase">Urbano</span>}
                        </div>
                        <h4 className="text-lg font-black font-mono tracking-tighter text-slate-900 dark:text-white uppercase leading-tight">
                          {route?.origin} <ArrowRight className="inline mx-1" size={14} /> {route?.destination}
                        </h4>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] font-black text-slate-400 uppercase mb-1">Partida</p>
                      <p className="text-xl font-black text-slate-900 dark:text-white">{trip.departure_time}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 mb-6">
                    <div className="bg-slate-50 dark:bg-zinc-800 p-4 rounded-2xl border border-slate-100 dark:border-zinc-700">
                      <p className="text-[8px] font-black text-slate-400 uppercase mb-1">Viatura</p>
                      <div className="flex items-center gap-2">
                        <Hash size={14} className="text-yellow-600" />
                        <span className="text-sm font-black text-slate-900 dark:text-white">{trip.bus_number}</span>
                        <span className="text-[9px] font-bold text-slate-400 uppercase">{vehicle?.type}</span>
                      </div>
                    </div>
                    <div className="bg-slate-50 dark:bg-zinc-800 p-4 rounded-2xl border border-slate-100 dark:border-zinc-700">
                      <p className="text-[8px] font-black text-slate-400 uppercase mb-1">{jobRole === 'RODOVIARIO' ? 'Assentos' : 'Roleta'}</p>
                      <div className="flex items-center gap-2">
                        <UserIcon size={14} className="text-yellow-600" />
                        <span className="text-sm font-black text-slate-900 dark:text-white">
                          {jobRole === 'RODOVIARIO' ? `${trip.occupied_seats || 0}/${vehicle?.capacity || 40}` : (trip.initial_turnstile || '---')}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    {jobRole === 'RODOVIARIO' && (
                      <button 
                        onClick={() => setBoardingMapTrip(trip)}
                        className="flex-1 py-4 bg-white dark:bg-zinc-800 text-slate-900 dark:text-white border-2 border-slate-900 dark:border-zinc-700 rounded-2xl font-black uppercase text-[10px] tracking-widest flex items-center justify-center gap-2 hover:bg-slate-50 transition-all"
                      >
                        <UserIcon size={16} /> Mapa
                      </button>
                    )}
                    {trip.status === 'Agendada' && !activeTrip && (
                      <button 
                        onClick={() => handleStartTrip(trip)}
                        className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl flex items-center justify-center gap-2 active:scale-95 transition-all"
                      >
                        <Play size={16} fill="white" /> Iniciar Viagem
                      </button>
                    )}
                    {trip.status === 'Em Rota' && (
                      <button 
                        onClick={() => handleEndTrip(trip)}
                        className="w-full py-4 bg-emerald-500 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl flex items-center justify-center gap-2 active:scale-95 transition-all border-2 border-emerald-400"
                      >
                        <Square size={16} fill="white" /> Finalizar Viagem
                      </button>
                    )}
                    {trip.status === 'Concluída' && (
                      <div className="w-full py-4 bg-slate-100 dark:bg-zinc-800 text-slate-400 rounded-2xl font-black uppercase text-[10px] tracking-widest flex items-center justify-center gap-2">
                        <CheckCircle2 size={16} /> Viagem Concluída
                      </div>
                    )}
                  </div>

                  {trip.status === 'Concluída' && (
                    <div className="mt-4 pt-4 border-t border-slate-100 dark:border-zinc-800 grid grid-cols-2 gap-4">
                      <div className="text-center">
                        <p className="text-[8px] font-black text-slate-400 uppercase">Início</p>
                        <p className="text-xs font-black text-slate-600">{trip.actual_start_time || '--:--'}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-[8px] font-black text-slate-400 uppercase">Término</p>
                        <p className="text-xs font-black text-slate-600">{trip.actual_end_time || '--:--'}</p>
                      </div>
                    </div>
                  )}
                </motion.div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal de Fechamento / Início (Motorista/Cobrador) */}
      {checkinModal && (
        <div 
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[2000] flex items-center justify-center p-4"
            onKeyDown={(e) => {
                if (e.key === 'Enter') {
                    const form = e.currentTarget.querySelector('form');
                    const inputs = Array.from(form?.querySelectorAll('input, select') || []);
                    const currentIndex = inputs.indexOf(document.activeElement as any);
                    if (currentIndex > -1 && currentIndex < inputs.length - 1) {
                        (inputs[currentIndex + 1] as HTMLElement).focus();
                    } else if (formData.confirm) {
                        handleConfirmClosure();
                    }
                }
            }}
        >
          <motion.div 
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white dark:bg-zinc-900 w-full max-lg rounded-[2.5rem] shadow-2xl border border-slate-100 dark:border-zinc-800 overflow-hidden flex flex-col max-h-[90vh]"
          >
            <div className={`p-8 ${checkinModal.mode === 'start' ? 'bg-slate-900' : 'bg-emerald-600'} text-white text-center`}>
              <div className="w-16 h-16 bg-white/20 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-xl border-4 border-white/20">
                <ClipboardList size={32} />
              </div>
              <h3 className="text-xl font-black uppercase italic tracking-tighter">
                {checkinModal.mode === 'start' ? 'Início de Viagem' : 'Fechamento de Viagem'}
              </h3>
              <p className="text-[10px] font-black opacity-60 uppercase mt-2 tracking-widest">
                {routes.find(r => r.id === checkinModal.trip.route_id)?.prefixo_linha} - Carro {checkinModal.trip.bus_number}
              </p>
            </div>

            <div className="p-8 space-y-6 overflow-y-auto custom-scrollbar flex-1">
              <form className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {jobRole !== 'COBRADOR' && (
                    <>
                      <div className="col-span-1">
                          <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-2">Odômetro</label>
                          <div className="relative">
                              <Gauge className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                              <input 
                                type="number" 
                                className="w-full pl-12 pr-6 py-4 bg-slate-50 dark:bg-zinc-800 rounded-2xl font-black text-slate-900 dark:text-white border-2 border-transparent focus:border-yellow-400"
                                placeholder="000000"
                                value={formData.odometer || ''}
                                onChange={(e) => setFormData({...formData, odometer: e.target.value})}
                              />
                          </div>
                      </div>

                      <div className="col-span-1">
                          <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-2">Combustível</label>
                          <div className="relative">
                              <Droplets className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                              <select 
                                className="w-full pl-12 pr-6 py-4 bg-slate-50 dark:bg-zinc-800 rounded-2xl font-black text-slate-900 dark:text-white border-2 border-transparent focus:border-yellow-400 outline-none"
                                value={formData.fuel || ''}
                                onChange={(e) => setFormData({...formData, fuel: e.target.value})}
                              >
                                  <option value="RESERVA">RESERVA</option>
                                  <option value="1/4">1/4</option>
                                  <option value="1/2">1/2</option>
                                  <option value="3/4">3/4</option>
                                  <option value="CHEIO">CHEIO</option>
                              </select>
                          </div>
                      </div>
                    </>
                  )}

                  {(routes.find(r => r.id === checkinModal.trip.route_id)?.route_type === 'URBANO' || jobRole === 'COBRADOR' || jobRole === 'RODOVIARIO') && (
                      <div className={`col-span-full ${jobRole === 'COBRADOR' ? '' : 'bg-slate-50 dark:bg-zinc-800/50 p-6 rounded-3xl border border-slate-100 dark:border-zinc-700'} space-y-4`}>
                           <div className={`grid grid-cols-1 ${jobRole === 'COBRADOR' ? '' : 'md:grid-cols-2'} gap-4`}>
                                {(routes.find(r => r.id === checkinModal.trip.route_id)?.route_type === 'URBANO' || jobRole === 'COBRADOR') && (
                                    <div className={jobRole === 'COBRADOR' ? 'col-span-full' : ''}>
                                        <label className="block text-[10px] font-black text-slate-400 uppercase mb-3 ml-2 flex items-center gap-2">
                                            <Hash size={14} className="text-indigo-500"/>
                                            Número da Roleta (Catraca) *
                                        </label>
                                        <input 
                                            type="number" 
                                            className="w-full px-8 py-6 bg-slate-50 dark:bg-zinc-800 rounded-3xl font-black text-slate-900 dark:text-white border-4 border-indigo-100 dark:border-indigo-900/30 text-3xl text-center outline-none focus:border-indigo-500 shadow-inner"
                                            placeholder="000000"
                                            value={formData.turnstile || ''}
                                            onChange={(e) => setFormData({...formData, turnstile: e.target.value})}
                                            autoFocus={jobRole === 'COBRADOR'}
                                        />
                                    </div>
                                )}
                                {jobRole === 'RODOVIARIO' && (
                                    <div>
                                        <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-2">Nº do Bilhete</label>
                                        <input 
                                            type="text" 
                                            className="w-full px-6 py-4 bg-white dark:bg-zinc-800 rounded-2xl font-black text-slate-900 dark:text-white border-2 border-transparent focus:border-yellow-400"
                                            placeholder="A-000000"
                                            value={formData.ticketNumber || ''}
                                            onChange={(e) => setFormData({...formData, ticketNumber: e.target.value})}
                                        />
                                    </div>
                                )}
                                {checkinModal.mode === 'end' && (routes.find(r => r.id === checkinModal.trip.route_id)?.route_type === 'URBANO' || jobRole === 'COBRADOR') && (
                                    <>
                                        {(!routes.find(r => r.id === checkinModal.trip.route_id)?.payment_methods_accepted || 
                                          routes.find(r => r.id === checkinModal.trip.route_id)?.payment_methods_accepted?.includes('DINHEIRO')) && (
                                            <div className={jobRole === 'COBRADOR' ? 'col-span-full' : ''}>
                                                <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-2">Dinheiro (Total)</label>
                                                <input 
                                                    type="number" 
                                                    step="0.01"
                                                    className="w-full px-6 py-4 bg-white dark:bg-zinc-800 rounded-2xl font-black text-slate-900 dark:text-white border-2 border-transparent focus:border-yellow-400"
                                                    placeholder="0.00"
                                                    value={formData.cash || ''}
                                                    onChange={(e) => setFormData({...formData, cash: e.target.value})}
                                                />
                                            </div>
                                        )}
                                        {(!routes.find(r => r.id === checkinModal.trip.route_id)?.payment_methods_accepted || 
                                          routes.find(r => r.id === checkinModal.trip.route_id)?.payment_methods_accepted?.some(m => ['CREDITO', 'DEBITO', 'PIX', 'CARD', 'IMPCARD'].includes(m))) && (
                                            <div className={jobRole === 'COBRADOR' ? 'col-span-full' : ''}>
                                                <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-2">Cartão/PIX/Digital (Total)</label>
                                                <input 
                                                    type="number" 
                                                    step="0.01"
                                                    className="w-full px-6 py-4 bg-white dark:bg-zinc-800 rounded-2xl font-black text-slate-900 dark:text-white border-2 border-transparent focus:border-yellow-400"
                                                    placeholder="0.00"
                                                    value={formData.cardPix || ''}
                                                    onChange={(e) => setFormData({...formData, cardPix: e.target.value})}
                                                />
                                            </div>
                                        )}
                                        <div className={jobRole === 'COBRADOR' ? 'col-span-full' : ''}>
                                            <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-2">Gratuidades</label>
                                            <input 
                                                type="number" 
                                                className="w-full px-6 py-4 bg-white dark:bg-zinc-800 rounded-2xl font-black text-slate-900 dark:text-white border-2 border-transparent focus:border-yellow-400"
                                                placeholder="0"
                                                value={formData.gratuity || ''}
                                                onChange={(e) => setFormData({...formData, gratuity: e.target.value})}
                                            />
                                        </div>
                                    </>
                                )}
                           </div>
                      </div>
                  )}

                  {jobRole !== 'COBRADOR' && (
                    <div className="col-span-full">
                        <div 
                          className={`p-6 rounded-3xl border-2 transition-all flex items-center gap-4 cursor-pointer ${formData.checklist ? 'bg-emerald-50 border-emerald-500 text-emerald-900' : 'bg-slate-50 border-slate-200 text-slate-400'}`}
                          onClick={() => setFormData({...formData, checklist: !formData.checklist})}
                        >
                            <CheckSquare className={formData.checklist ? 'text-emerald-500' : 'text-slate-300'} size={24} />
                            <div>
                                <p className="text-[10px] font-black uppercase tracking-widest">Checklist de Saída OK</p>
                                <p className="text-[9px] font-bold opacity-60">Confirmo que o veículo está em condições ideais.</p>
                            </div>
                        </div>
                    </div>
                  )}

                  <div className="col-span-full mt-4">
                      <div 
                        className={`p-6 rounded-3xl border-2 transition-all flex items-center gap-4 cursor-pointer ${formData.confirm ? 'bg-yellow-50 border-yellow-500 text-slate-900' : 'bg-slate-50 border-slate-200 text-slate-400'}`}
                        onClick={() => setFormData({...formData, confirm: !formData.confirm})}
                      >
                          <AlertTriangle className={formData.confirm ? 'text-yellow-600' : 'text-slate-300'} size={24} />
                          <div>
                              <p className="text-[10px] font-black uppercase tracking-widest">Confirmação de Dados</p>
                              <p className="text-[9px] font-bold opacity-60">Declaro que todas as informações acima são verdadeiras.</p>
                          </div>
                      </div>
                  </div>
              </form>
            </div>

            <div className="p-8 border-t border-slate-100 dark:border-zinc-800 flex gap-4">
                <button 
                  onClick={() => setCheckinModal(null)}
                  className="flex-1 py-4 text-slate-400 font-black uppercase text-[10px] tracking-widest"
                >
                  Cancelar
                </button>
                <button 
                  onClick={handleConfirmClosure}
                  disabled={!formData.confirm}
                  className={`flex-[2] py-4 rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl active:scale-95 transition-all text-white ${formData.confirm ? (checkinModal.mode === 'start' ? 'bg-slate-900' : 'bg-emerald-600') : 'bg-slate-200 cursor-not-allowed'}`}
                >
                  Salvar {checkinModal.mode === 'start' ? 'Início' : 'Fechamento'}
                </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Modal de Mapa de Embarque (Rodoviário) foi substituído pelo TripSelectionModal acima */}

      {/* Onboarding Tutorial Mode */}
      <AnimatePresence>
        {showTutorial && (
          <div className="fixed inset-0 bg-slate-950/85 dark:bg-black/90 z-[300] flex items-center justify-center p-4 backdrop-blur-md">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="bg-white dark:bg-zinc-950 w-full max-w-md rounded-[2.5rem] p-8 md:p-10 border-4 border-yellow-400 shadow-2xl flex flex-col items-center text-center relative max-h-[90vh] overflow-y-auto"
            >
              {/* Close Button / Absolute X */}
              <button 
                onClick={handleFinishTutorial} 
                className="absolute top-6 right-6 p-2 text-slate-400 hover:text-slate-600 dark:hover:text-zinc-100 rounded-full transition-all"
                title="Pular Tutorial"
              >
                <X size={20} />
              </button>

              {/* Step counter */}
              <div className="text-[9px] font-black tracking-widest text-yellow-600 dark:text-yellow-500 uppercase mb-6">
                Passo {tutorialStep + 1} de {tutorialSteps.length} • Tutorial de Bordo
              </div>

              {/* Animated Step Content */}
              <div className="flex flex-col items-center gap-6 flex-1 min-h-[220px]">
                <div className="w-20 h-20 rounded-[2rem] bg-slate-50 dark:bg-zinc-900 flex items-center justify-center shadow-inner border border-slate-100 dark:border-zinc-850">
                  {tutorialSteps[tutorialStep].icon}
                </div>
                
                <div>
                  <h3 className="text-lg font-black text-slate-900 dark:text-zinc-100 uppercase italic tracking-tight mb-2">
                    {tutorialSteps[tutorialStep].title}
                  </h3>
                  <p className="text-xs font-bold text-slate-500 dark:text-zinc-400 leading-relaxed max-w-sm">
                    {tutorialSteps[tutorialStep].description}
                  </p>
                </div>
              </div>

              {/* Dots Progress Indicator */}
              <div className="flex gap-2.5 my-6 self-center">
                {tutorialSteps.map((_, idx) => (
                  <button
                    key={idx}
                    onClick={() => setTutorialStep(idx)}
                    className={`h-1.5 rounded-full transition-all ${tutorialStep === idx ? 'w-6 bg-yellow-400' : 'w-1.5 bg-slate-200 dark:bg-zinc-800'}`}
                  />
                ))}
              </div>

              {/* Navigation Actions */}
              <div className="flex w-full gap-3 mt-auto">
                {tutorialStep > 0 ? (
                  <button
                    onClick={() => setTutorialStep(prev => prev - 1)}
                    className="flex-1 py-3 bg-slate-100 dark:bg-zinc-900 hover:bg-slate-200 text-slate-600 dark:text-zinc-300 rounded-xl font-black uppercase text-[9px] tracking-widest transition-all"
                  >
                    Voltar
                  </button>
                ) : (
                  <button
                    onClick={handleFinishTutorial}
                    className="flex-1 py-3 text-slate-400 hover:text-slate-600 dark:hover:text-zinc-300 font-black uppercase text-[9px] tracking-widest transition-all"
                  >
                    Pular
                  </button>
                )}

                {tutorialStep < tutorialSteps.length - 1 ? (
                  <button
                    onClick={() => setTutorialStep(prev => prev + 1)}
                    className="flex-[2] py-3 bg-yellow-400 hover:bg-yellow-500 text-slate-900 rounded-xl font-black uppercase text-[9px] tracking-widest shadow-lg shadow-yellow-500/10 transition-all active:scale-95 border-2 border-slate-950"
                  >
                    Avançar
                  </button>
                ) : (
                  <button
                    onClick={handleFinishTutorial}
                    className="flex-[2] py-3 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-black uppercase text-[9px] tracking-widest shadow-lg shadow-emerald-500/10 transition-all active:scale-95 border-2 border-slate-950"
                  >
                    Compreendido
                  </button>
                )}
              </div>
            </motion.div>
          </div>
        )}

        {showVTPrompt && (
          <div className="fixed inset-0 bg-slate-900/60 dark:bg-black/70 z-[150] flex items-center justify-center p-4 backdrop-blur-sm">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white dark:bg-zinc-950 w-full max-w-md p-8 rounded-[2.5rem] border-4 border-yellow-400 shadow-2xl space-y-6 text-center"
            >
              <div className="space-y-2">
                <span className="text-4xl inline-block animate-bounce mb-2">💳</span>
                <h3 className="text-xl font-black uppercase italic text-slate-900 dark:text-white">Vale Transporte</h3>
                <p className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wider">Informe o CPF ou número do cartão do passageiro</p>
              </div>
              
              <input 
                type="text"
                autoFocus
                placeholder="000.000.000-00 ou Número"
                value={vtInputTemp}
                onChange={(e) => setVtInputTemp(e.target.value)}
                className="w-full px-6 py-5 bg-slate-50 dark:bg-zinc-800 rounded-2xl font-black text-center text-slate-900 dark:text-white border-2 border-yellow-400 outline-none"
              />
              
              <div className="flex gap-3">
                <button 
                  type="button"
                  onClick={() => {
                    setShowVTPrompt(false);
                    setSelectedPaymentMethod('DINHEIRO');
                  }}
                  className="flex-1 py-4 bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-500 rounded-2xl font-black uppercase text-[10px]"
                >
                  Cancelar
                </button>
                <button 
                  type="button"
                  onClick={() => {
                    if (!vtInputTemp.trim()) {
                      addToast("Informe o CPF ou cartão do passageiro", "warning");
                      return;
                    }
                    setPaymentDetails({ ...paymentDetails, cardOrCpf: vtInputTemp });
                    setShowVTPrompt(false);
                    addToast("Vale Transporte validado!", "success");
                  }}
                  className="flex-1 py-4 bg-yellow-400 hover:bg-yellow-500 text-slate-900 rounded-2xl font-black uppercase text-[10px]"
                >
                  Confirmar
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default DriverView;
