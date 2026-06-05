
import React, { Component, useState, useEffect, useCallback, ErrorInfo, ReactNode, useRef } from 'react';
import { Loader2, BusFront, X, AlertTriangle, CheckCircle2, Coffee, Sparkles, AlertCircle, RefreshCw, Zap, ChevronRight, Home } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import Topbar from './components/Sidebar'; 
import Dashboard from './components/Dashboard';
import TripSchedule from './components/TripSchedule';
import LoginScreen from './components/LoginScreen';
import RouteManager from './components/RouteManager';
import DriverManager from './components/DriverManager';
import CompanyManager from './components/CompanyManager';
import UserManager from './components/UserManager';
import VehicleManager from './components/VehicleManager';
import ObservationManager from './components/ObservationManager';
import CityManager from './components/CityManager';
import NoticeManager from './components/NoticeManager';
import ReportManager from './components/ReportManager';
import MaintenanceManager from './components/MaintenanceManager';
import TicketAgentInterface from './components/TicketAgentInterface';
import InspectionManager from './components/InspectionManager';
import TicketingConfigManager from './components/TicketingConfigManager';
import PassengerInterface from './components/PassengerInterface';
import MobileBottomNav from './components/MobileBottomNav';
import TimeTrackingManager from './components/TimeTrackingManager';
import PayrollManager from './components/PayrollManager';
import ManagementView from './components/ManagementView';
import DriverShiftManager from './components/DriverShiftManager';
import DriverView from './components/DriverView';
import OperationTabs from './components/OperationTabs';
import NotificationManager from './components/NotificationManager';
import RecruitmentPanel from './components/RecruitmentPanel';
import SkinRepository from './components/SkinRepository';
import { NotificationService } from './services/NotificationService';
import SystemConfigManager from './components/SystemConfigManager';
import DispatcherManager from './components/DispatcherManager';
import SACManager from './components/SACManager';
import JobApplicationForm from './components/JobApplicationForm';
import TrafficViolationManager from './components/TrafficViolationManager';
import SubscriptionManager from './components/SubscriptionManager';
import LicenseManagement from './components/LicenseManagement';
import UserSubscription from './components/UserSubscription';
import SubscriptionExpired from './components/SubscriptionExpired';
import { ViewState, BusRoute, Trip, User, Company, Vehicle, IssueReport, City, Notice, ThemeMode, TicketSale, Inspection, TicketingConfig, RoleConfig, AppNotification, Shift, SystemSettings, UserFine, Subscription, Skin, TimeEntry, TicketBooth } from './types';
import { db, supabase, TableName } from './services/database';

export type ToastType = 'success' | 'error' | 'warning';

interface Toast {
  id: number;
  message: string;
  type: ToastType;
}

interface ErrorBoundaryProps { children?: ReactNode; }
interface ErrorBoundaryState { hasError: boolean; error: Error | null; }

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  public props: ErrorBoundaryProps;
  public state: ErrorBoundaryState = { hasError: false, error: null };

  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.props = props;
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState { 
    return { hasError: true, error }; 
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) { 
    console.error("[CRITICAL_RENDER_ERROR]", error, errorInfo); 
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-900 text-white p-10 flex flex-col items-center justify-center text-center">
          <AlertTriangle size={64} className="text-yellow-400 mb-6" />
          <h1 className="text-2xl font-black uppercase mb-4">Falha Crítica de Renderização</h1>
          <div className="bg-black/50 p-6 rounded-2xl text-left font-mono text-xs text-red-400 mb-8 w-full max-w-2xl overflow-auto">
            {this.state.error?.toString()}
          </div>
          <button onClick={() => window.location.reload()} className="px-8 py-4 bg-yellow-400 text-slate-900 rounded-2xl font-black uppercase">Recarregar Sistema</button>
        </div>
      );
    }
    return this.props.children;
  }
}

const DEFAULT_CONFIG: TicketingConfig = {
  id: 'da4d93ab-b6e9-4556-918d-21861dd26726',
  payment_methods: ['DINHEIRO', 'PIX', 'CREDITO', 'DEBITO', 'IMPCARD'],
  credit_installments: 12,
  credit_surcharge: 0,
  min_installment_value: 1,
  boarding_box: 'Plataforma 01',
  active_coupons: [],
  class_seats: { 'CONVENCIONAL': 44, 'CONVENCIONAL_DD': 64, 'EXECUTIVO': 42, 'EXECUTIVO_DD': 56, 'LEITO': 28, 'LEITO_DD': 36, 'SEMI_LEITO': 32, 'SEMI_LEITO_DD': 44, 'URBANO': 44, 'CAMA': 18 }
};

const ViewContent: React.FC<{ 
  currentView: ViewState | string; 
  commonProps: any;
  handleAction: (action: any, table: any, data: any) => Promise<any>;
}> = ({ currentView, commonProps, handleAction }) => {
  const { 
    currentUser, routes, trips, users, companies, vehicles, reports, cities, notices, 
    inspections, ticketingConfig, addToast, roleConfigs, importUserData, setImportUserData,
    notificationMetadata, setNotificationMetadata, handleNotificationClick, loadInitialData, userFines, systemSettings, skins, shifts, notifications,
    handleSendSystemNotification, setCurrentView
  } = commonProps;

  const renderContent = () => {
    switch (currentView) {
      case 'dashboard': return <Dashboard {...commonProps} allTrips={trips} />;
      case 'drivers': 
        return <DriverManager 
          {...commonProps} 
          drivers={users} 
          roleConfigs={roleConfigs} 
          registrationPattern={systemSettings?.registration_pattern} 
          registrationTemplate={systemSettings?.registration_template} 
          initialUserData={importUserData}
          onClearInitialData={() => setImportUserData(null)}
          onAddDriver={u => {
            handleAction('create', 'users', u);
            setImportUserData(null);
          }} 
          onUpdateDriver={u => handleAction('update', 'users', u)} 
          onDeleteDriver={id => handleAction('delete', 'users', id)} 
          userFines={userFines}
          onAddFine={(v) => handleAction('create', 'user_fines', v)}
        />;
      case 'companies': return <CompanyManager {...commonProps} onAddCompany={c => handleAction('create', 'companies', c)} onUpdateCompany={c => handleAction('update', 'companies', c)} onDeleteCompany={id => handleAction('delete', 'companies', id)} onAddBooth={b => handleAction('create', 'ticket_booths', b)} onUpdateBooth={b => handleAction('update', 'ticket_booths', b)} onDeleteBooth={id => handleAction('delete', 'ticket_booths', id)} />;
      case 'routes': return <RouteManager {...commonProps} trips={trips} onAddRoute={r => handleAction('create', 'routes', r)} onUpdateRoute={r => handleAction('update', 'routes', r)} onDeleteRoute={id => handleAction('delete', 'routes', id)} />;
      case 'schedule': return <TripSchedule {...commonProps} drivers={users} onAddTrip={t => handleAction('create', 'trips', t)} onUpdateTrip={t => handleAction('update', 'trips', t)} onDeleteTrip={id => handleAction('delete', 'trips', id)} onSendSMS={handleSendSystemNotification} userFines={userFines} />;
      case 'users': 
        return <UserManager 
          {...commonProps} 
          companies={companies}
          roleConfigs={roleConfigs} 
          initialUserData={importUserData}
          onClearInitialData={() => setImportUserData(null)}
          onAddUser={u => {
            handleAction('create', 'users', u);
            setImportUserData(null);
          }} 
          onUpdateUser={u => handleAction('update', 'users', u)} 
          onDeleteUser={id => handleAction('delete', 'users', id)} 
        />;
      case 'vehicles': return <VehicleManager {...commonProps} onAddVehicle={v => handleAction('create', 'vehicles', v)} onUpdateVehicle={v => handleAction('update', 'vehicles', v)} onDeleteVehicle={id => handleAction('delete', 'vehicles', id)} skins={skins} />;
      case 'observations': return <ObservationManager {...commonProps} initialOccurrenceId={notificationMetadata?.occurrenceId} onResolveReport={(id, metadata) => handleAction('update', 'occurrences', { id, status: 'Concluído', technician_report: metadata })} onDeleteReport={id => handleAction('delete', 'occurrences', id)} />;
      case 'cities': return <CityManager {...commonProps} onAddCity={c => handleAction('create', 'cities', c)} onUpdateCity={c => handleAction('update', 'cities', c)} onDeleteCity={id => handleAction('delete', 'cities', id)} />;
      case 'notices': return <NoticeManager {...commonProps} onAddNotice={n => handleAction('create', 'notices', n)} onDeleteNotice={id => handleAction('delete', 'notices', id)} />;
      case 'reports-view': return <ReportManager {...commonProps} onDeleteTrip={id => handleAction('delete', 'trips', id)} />;
      case 'maintenance': return <MaintenanceManager {...commonProps} />;
      case 'ticketing': return <TicketAgentInterface 
        {...commonProps} 
        onExit={() => setCurrentView(notificationMetadata?.isPassengerTicketing ? 'passenger-view' : 'dashboard')} 
        initialTripId={notificationMetadata?.trip_id} 
        initialRouteId={notificationMetadata?.route_id}
        initialPassengerData={notificationMetadata?.passengerData}
        isPassengerView={notificationMetadata?.isPassengerTicketing}
      />;
      case 'inspections': return <InspectionManager {...commonProps} onAddInspection={i => handleAction('create', 'driver_logs', i)} onDeleteInspection={id => handleAction('delete', 'driver_logs', id)} />;
      case 'ticketing-config': return <TicketingConfigManager initialConfig={ticketingConfig} onUpdateConfig={c => handleAction('update', 'ticketing_config', c)} addToast={addToast} />;
      case 'time-tracking': return <TimeTrackingManager currentUser={currentUser} addToast={addToast} />;
      case 'payroll': return <PayrollManager users={users} companies={companies} addToast={addToast} />;
      case 'management': return <ManagementView addToast={addToast} currentUser={currentUser} />;
      case 'shifts': return <DriverShiftManager shifts={shifts} drivers={users} routes={routes} onAddShift={s => handleAction('create', 'shifts', s)} onUpdateShift={s => handleAction('update', 'shifts', s)} onDeleteShift={id => handleAction('delete', 'shifts', id)} />;
      case 'notifications': 
        return <NotificationManager 
          notifications={notifications} 
          currentUser={currentUser}
          addToast={addToast} 
          onRefresh={loadInitialData} 
          onNotificationClick={handleNotificationClick}
        />;
      case 'dispatcher': return <DispatcherManager currentUser={currentUser} addToast={addToast} />;
      case 'sac': return <SACManager addToast={addToast} />;
      case 'license-management': 
        if (!currentUser?.is_full_admin) return <Dashboard {...commonProps} allTrips={trips} />;
        return <LicenseManagement currentUser={currentUser} addToast={addToast} />;
      case 'subscriptions':
        return <SubscriptionManager currentUser={currentUser} addToast={addToast} />;
      case 'my-subscription': return <UserSubscription currentUser={currentUser} addToast={addToast} />;
      case 'system-config': return <SystemConfigManager roleConfigs={roleConfigs} onUpdateRoleConfig={rc => handleAction('update', 'role_configs', rc)} addToast={addToast} />;
      case 'skins': return <SkinRepository currentUser={currentUser} companies={companies} skins={skins} />;
      case 'recruitment': 
        return <RecruitmentPanel 
          addToast={addToast} 
          currentUser={currentUser}
          initialApplicationId={notificationMetadata?.applicationId}
          onImportToCollaborators={(userData) => {
            setImportUserData(userData);
            setCurrentView('drivers');
          }}
        />;
      case 'driver-view': return <DriverView {...commonProps} onUpdateTrip={t => handleAction('update', 'trips', t)} />;
      case 'monitoring': return <OperationTabs {...commonProps} initialTab="OVERVIEW" onUpdateTrip={t => handleAction('update', 'trips', t)} />;
      case 'operation-center': return <OperationTabs {...commonProps} onUpdateTrip={t => handleAction('update', 'trips', t)} />;
      case 'traffic-violations': return <TrafficViolationManager userFines={userFines} drivers={users} vehicles={vehicles} onAddViolation={v => handleAction('create', 'user_fines', v)} onDeleteViolation={id => handleAction('delete', 'user_fines', id)} onUpdateViolation={v => handleAction('update', 'user_fines', v)} />;
      case 'work-with-us': return <JobApplicationForm addToast={addToast} currentUser={currentUser} onSuccess={() => setCurrentView('dashboard')} />;
      case 'driver-urban': return <DriverView {...commonProps} forcedRole="URBANO" onUpdateTrip={t => handleAction('update', 'trips', t)} />;
      case 'driver-road': return <DriverView {...commonProps} forcedRole="RODOVIARIO" onUpdateTrip={t => handleAction('update', 'trips', t)} />;
      case 'conductor': return <DriverView {...commonProps} forcedRole="COBRADOR" onUpdateTrip={t => handleAction('update', 'trips', t)} />;
      case 'passenger-view': return <PassengerInterface {...commonProps} onExit={() => setCurrentView('dashboard')} onOpenTicketing={(tripId, passengerData, routeId) => {
        setNotificationMetadata(prev => ({ 
          ...prev, 
          trip_id: tripId, 
          route_id: routeId,
          passengerData: passengerData,
          isPassengerTicketing: true
        }));
        setCurrentView('ticketing');
      }} />;
      case 'about': return (
        <div className="bg-white dark:bg-zinc-900 p-12 rounded-[3rem] border border-slate-100 dark:border-zinc-800 shadow-sm transition-colors">
          <div className="max-w-2xl mx-auto text-center">
              <div className="logo-sistema w-24 h-24 bg-yellow-400 rounded-[2rem] mx-auto mb-8 flex items-center justify-center shadow-xl border-4 border-slate-900 overflow-hidden transition-all">
                {systemSettings?.system_logo ? (
                  <img 
                    src={`${systemSettings.system_logo.split('?')[0]}?t=${Date.now()}`} 
                    className="h-full w-auto object-contain" 
                    alt={systemSettings?.system_name || "ViaLivre Gestão"} 
                    referrerPolicy="no-referrer" 
                  />
                ) : (
                  <span className="text-4xl font-black italic text-slate-900">{(systemSettings?.system_name?.[0] || 'V').toUpperCase()}</span>
                )}
              </div>
              <h2 className="text-2xl md:text-4xl font-black text-slate-900 dark:text-zinc-100 uppercase italic tracking-tighter mb-4">
                {systemSettings?.system_name || 'ViaLivre Gestão'}
              </h2>
              <p className="text-slate-500 dark:text-zinc-400 font-bold uppercase tracking-widest text-[10px] mb-12">Sistema Integrado de Gestão de Transportes</p>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-left">
                <div className="bg-slate-50 dark:bg-zinc-800 p-6 rounded-3xl border border-slate-100 dark:border-zinc-700">
                  <p className="text-[9px] font-black text-slate-400 uppercase mb-1">Versão do Sistema</p>
                  <p className="text-lg font-black text-slate-900 dark:text-zinc-100">v2.0</p>
                </div>
                <div className="bg-slate-50 dark:bg-zinc-800 p-6 rounded-3xl border border-slate-100 dark:border-zinc-700">
                  <p className="text-[9px] font-black text-slate-400 uppercase mb-1">Desenvolvedor</p>
                  <p className="text-lg font-black text-slate-900 dark:text-zinc-100">Viação Nicolau S/A</p>
                </div>
                <div className="bg-slate-50 dark:bg-zinc-800 p-6 rounded-3xl border border-slate-100 dark:border-zinc-700 md:col-span-2">
                  <p className="text-[9px] font-black text-slate-400 uppercase mb-1">Suporte Técnico</p>
                  <div className="flex flex-col gap-1.5 border-b border-slate-100 dark:border-zinc-700/50 pb-4 mb-4">
                    <a href={`mailto:${systemSettings?.support_email || 'via.nicolau.sa@gmail.com'}`} className="text-lg font-black text-slate-900 dark:text-zinc-100 hover:text-yellow-600 transition-colors uppercase">
                      {systemSettings?.support_email || 'via.nicolau.sa@gmail.com'}
                    </a>
                    <a href="https://wa.me/5524978358199?text=Ol%C3%A1%2C%20preciso%20de%20suporte%20no%20sistema%20Via%C3%A7%C3%A3o%20Nicolau%20S%2FA" target="_blank" rel="noopener noreferrer" className="text-sm font-black text-yellow-600 hover:underline">
                      (24) 9 7835-8199
                    </a>
                  </div>
                  
                  <p className="text-[9px] font-black text-slate-400 uppercase mb-3 flex items-center gap-2">
                    <RefreshCw size={12} className="text-yellow-400" /> Orientações e Suporte
                  </p>
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <p className="font-black text-xs text-slate-900 dark:text-zinc-100 uppercase italic">Recomeçar Tutorial de Boas-vindas</p>
                      <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1.5 leading-relaxed">
                        Reativa o passo a passo interativo de primeiro acesso das ferramentas administrativas.
                      </p>
                    </div>
                    <button 
                      onClick={() => {
                        localStorage.removeItem('fluxo_tutorial_seen');
                        addToast("Tutorial redefinido com sucesso! O passo a passo será exibido no próximo login ou recarregamento.", "success");
                      }}
                      className="px-6 py-3.5 bg-slate-900 dark:bg-zinc-700 hover:bg-slate-850 dark:hover:bg-zinc-600 text-white rounded-2xl font-black uppercase text-[9px] tracking-widest transition-all shadow-md active:scale-95 flex items-center justify-center gap-2 shrink-0 border border-slate-800 dark:border-zinc-600"
                    >
                      <RefreshCw size={12} />
                      Recomeçar Tutorial
                    </button>
                  </div>
                </div>
              </div>
          </div>
        </div>
      );
      default: return null;
    }
  };

  const getViewLabel = (view: string) => {
    const labels: Record<string, string> = {
      'dashboard': 'Dashboard',
      'operation-center': 'Centro Operacional',
      'monitoring': 'Monitoramento',
      'management': 'Gestão Global',
      'routes': 'Itinerários',
      'schedule': 'Escala de Viagens',
      'users': 'Controle de Acessos',
      'companies': 'Empresas',
      'vehicles': 'Frota de Ônibus',
      'drivers': 'Colaboradores',
      'ticketing': 'Guichê de Vendas',
      'sac': 'Vale Transporte',
      'notices': 'Mural de Avisos',
      'observations': 'Ocorrências',
      'inspections': 'Vistorias',
      'maintenance': 'Manutenção',
      'cities': 'Municípios',
      'reports-view': 'Relatórios',
      'payroll': 'Holerites',
      'time-tracking': 'Ponto Eletrônico',
      'ticketing-config': 'Gestão Guichê',
      'dispatcher': 'Despachante',
      'recruitment': 'Recrutamento',
      'work-with-us': 'Trabalhe Conosco',
      'about': 'Sobre o Sistema'
    };
    return labels[view] || view;
  };

  return (
    <div className="flex flex-col w-full h-full">
      {/* Breadcrumb Section */}
      <div className="px-10 py-4 flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-zinc-600 bg-white/50 dark:bg-zinc-950/50 backdrop-blur-sm border-b border-slate-100 dark:border-zinc-900 transition-colors">
        <button onClick={() => setCurrentView('dashboard')} className="hover:text-yellow-600 flex items-center gap-1.5 transition-colors">
          <Home size={12} /> Home
        </button>
        {currentView !== 'dashboard' && (
          <>
            <ChevronRight size={10} className="text-slate-300 dark:text-zinc-800" />
            <span className="text-slate-900 dark:text-white">{getViewLabel(currentView as string)}</span>
          </>
        )}
      </div>

      <div className="flex-1">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentView as string}
            initial={{ opacity: 0, y: 10, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 1.02 }}
            transition={{ duration: 0.3, ease: [0.23, 1, 0.32, 1] }}
            className="w-full h-full"
          >
            {renderContent()}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
};

const ROLE_TUTORIALS: Record<string, {
  title: string;
  subtitle: string;
  step1Title: string;
  step1Desc: string;
  step2Title: string;
  step2Desc: string;
  quote: string;
  features: { l: string; d: string }[];
}> = {
  ADMIN: {
    title: "Bem-vindo ao ViaLivre Gestão!",
    subtitle: "Tutorial de Primeiro Acesso para Administradores de Frota",
    step1Title: "Configuração Básica do Painel",
    step1Desc: "Para permitir o correto funcionamento operacional, as abas Colaboradores, Empresas, Itinerários e Municípios devem ser povoadas primeiro. Elas criam o alicerce de rotas e equipes.",
    step2Title: "Operação e Supervisão Integrada",
    step2Desc: "Utilize a Escala de Viagens para designar veículos, motoristas e horários. Visualize em tempo real o andamento e registre incidentes com os despachantes.",
    quote: '"O sucesso da sua operação começa com dados bem cadastrados e processos organizados. Vamos começar?"',
    features: [
      { l: "Dashboard Geral", d: "Visão analítica de passageiros e faturamento diário" },
      { l: "Gestão Global", d: "Controle de cargos, permissões e redefinição de tutorial" },
      { l: "Itinerários & Frota", d: "Pontos de parada, linhas, veículos e vistorias" },
      { l: "Fechamento Financeiro", d: "Folha de pagamento e monitoramento de rubricas" },
      { l: "Controle de Despacho", d: "Atribuição e liberação em garagem" },
      { l: "SAC & Ouvidoria", d: "Atendimento ao cliente e suporte especializado" }
    ]
  },
  DRIVER: {
    title: "Portal de Bordo do Motorista!",
    subtitle: "Guia de Inicialização e Registro de Jornada",
    step1Title: "Ponto Eletrônico e Jornada",
    step1Desc: "Antes de ver ou iniciar qualquer viagem, você deve registrar o seu Ponto de Entrada (Clock-In) na aba correspondente do sistema. Isso libera as suas escalas.",
    step2Title: "Programação e Escalas",
    step2Desc: "Acesse as escalas de viagem designadas para você hoje. Acompanhe a viatura designada, paradas obrigatórias, itinerário detalhado e relate quaisquer ocorrências no percurso.",
    quote: '"Direção defensiva de alta qualidade e pontualidade garantem um transporte público exemplar. Boa viagem!"',
    features: [
      { l: "Ponto Digital", d: "Registro rápido e seguro da entrada e saída de turno" },
      { l: "Minhas Escalas", d: "Quadro de horários e ônibus escalados para o seu CPF" },
      { l: "Relato de Alertas", d: "Envio rápido de avisos sobre problemas na via" },
      { l: "Quadro de Avisos", d: "Notícias e mudanças operacionais emitidas pela central" },
      { l: "Diário de Bordo", d: "Envio de ocorrências ou falhas veiculares do motorista" },
      { l: "SAC & Rotas", d: "Consulta de rotas e contato direto com a empresa" }
    ]
  },
  CONDUCTOR: {
    title: "Jornada de Trabalho do Cobrador!",
    subtitle: "Guia Operacional e Fiscalização de Tarifas",
    step1Title: "Registro de Expediente",
    step1Desc: "Sempre inicie o seu turno batendo a Entrada no Ponto Eletrônico. Dessa forma, suas escalas de faturamento e ônibus vinculados ficam liberados.",
    step2Title: "Controle de Tarifa e Vendas",
    step2Desc: "Monitore o embarque de passageiros, faça a conferência de passes escolares, gratuidades ou carregamento dos cartões de transporte integrados no veículo.",
    quote: '"Sua atenção no fluxo de passageiros e no controle de faturamento é fundamental para a saúde operacional do trajeto."',
    features: [
      { l: "Ponto Eletrônico", d: "Abertura e fechamento oficial de expediente" },
      { l: "Escalas do Cobrador", d: "Viagens marcadas em que você fará a assistência de embarque" },
      { l: "Quadro de Avisos", d: "Instruções diretas do despachante ou da diretoria" },
      { l: "Ocorrências de Viagem", d: "Comunique rapidamente qualquer conflito ou sinistro" },
      { l: "Histórico de Ponto", d: "Audite suas próprias horas trabalhadas com clareza" },
      { l: "Contato de Suporte", d: "Suporte imediato de garagem e RH no menu de ajuda" }
    ]
  },
  FISCAL: {
    title: "Painel de Fiscalização Ativa!",
    subtitle: "Controle de Linhas, Cumprimento de Horários e Segurança",
    step1Title: "Abertura de Serviços",
    step1Desc: "Informe o início do seu dia registrando o Ponto. O aplicativo habilitará as ferramentas de fiscalização de garagem, partidas e inspeção de viaturas.",
    step2Title: "Cumprimento de Horários e Vistoria",
    step2Desc: "Registre o estado físico dos ônibus antes de partirem. Verifique se o itinerário está correto, se os horários de partida batem e emita advertências ou multas.",
    quote: '"A regularidade do serviço e o cumprimento rígido de horários dependem da precisão do seu olhar clínico. Bom trabalho!"',
    features: [
      { l: "Acompanhamento Ativo", d: "Tabelas de partidas e verificação de frotas em trânsito" },
      { l: "Inspeções de Veículo", d: "Checklists completos de segurança e conservação do ônibus" },
      { l: "Eventos Operacionais", d: "Anotação rápida de avarias, sinistros ou atrasos na linha" },
      { l: "Histórico de Multas", d: "Monitoramento de multas emitidas para motoristas" },
      { l: "Avisos Gerais", d: "Criação de notícias corporativas urgentes para colaboradores" },
      { l: "Rotas & Itinerários", d: "Conferência rápida e visual de quilometragem e tempos" }
    ]
  },
  AGENTE: {
    title: "Terminal de Bilheteria ConsImp!",
    subtitle: "Emissão de Passagens e Gestão de Tarifas Comerciais",
    step1Title: "Venda Rápida e Poltronas",
    step1Desc: "Selecione a viagem desejada, clique nos assentos disponíveis de forma interativa e informe a classe (Ex: Convencional, Luxo). Insira os dados do passageiro para emitir.",
    step2Title: "Controle de Cartão e Recarga",
    step2Desc: "Agilize a carga de créditos para passageiros físicos. Informe o número do cartão, adicione o valor desejado (PIX, Crédito, Débito ou Dinheiro) e valide o bilhete térmico.",
    quote: '"Um atendimento cordial e processos de emissão rápidos reduzem filas e encantam o usuário final. Boas vendas!"',
    features: [
      { l: "Bilhetagem Rápida", d: "Emissão de passagens e geração de QR code impresso" },
      { l: "Configuração de Poltronas", d: "Defina a quantidade de assentos de acordo com a classe do ônibus" },
      { l: "SAC & Chamados", d: "Ajude na tratativa de reclamações e resoluções no balcão" },
      { l: "Controle de Vouchers", d: "Gestão de passagens emitidas e reimpressão de comprovantes" },
      { l: "Status das Partidas", d: "Acompanhe vagas disponíveis por ônibus em viagem futura" },
      { l: "Quadro de Avisos", d: "Alertas corporativos urgentes para guichês em rodoviárias" }
    ]
  },
  DESPACHANTE: {
    title: "Central de Despacho Operacional!",
    subtitle: "Controle Dinâmico de Tráfego, Escala e Veículos em Garagem",
    step1Title: "Liberação de Veículos",
    step1Desc: "Acompanhe as viagens prontas para partida. Associe ônibus mecânicos saudáveis sob escalas corretas e valide a presença da tripulação antes de cada partida.",
    step2Title: "Monitoramento de Eventos",
    step2Desc: "Identifique carros retidos por falha, quebras no trajeto, multas e envie comunicados imediatos para que motoristas fiquem cientes em tempo real no app.",
    quote: '"Você é o coração da operação logística. Manter a garagem ativa e os horários em dia é o nosso combustível!"',
    features: [
      { l: "Quadro de Despacho", d: "Tabela viva de partidas, permissões de viagem e liberação" },
      { l: "Manutenção da Frota", d: "Controle preventivo e corretivo e status dos carros" },
      { l: "Painel de Incidentes", d: "Histórico e registro de problemas no percurso" },
      { l: "Gestão de Escalas", d: "Distribuição equitativa de Motoristas e Cobradores" },
      { l: "Avisos de Emergência", d: "Disparos instantâneos de notícias para a equipe de rua" },
      { l: "Itinerários Operacionais", d: "Mapa de frotagem e rotas cadastradas por linha" }
    ]
  },
  RH: {
    title: "Gestão Estratégica de Pessoas & RH!",
    subtitle: "Administração de Contratações, Holerites e Auditoria de Ponto",
    step1Title: "Gestão Profissional",
    step1Desc: "Acompanhe fichas completas de contratação, cargos, datas de admissão, validades de CNH para motoristas e redefina acessos setoriais do sistema.",
    step2Title: "Folha de Pagamento Inteligente",
    step2Desc: "Apure mensalmente ou semanalmente as horas extras, faltas e aplique rubricas salariais devidas (deduções ou benefícios) para emissão de holerites fiscais.",
    quote: '"Cuidar do bem-estar dos colaboradores e manter a conformidade trabalhista gera uma equipe de alta dedicação."',
    features: [
      { l: "Talentos & Recrutamento", d: "Acompanhamento de vagas em aberto e currículos recebidos" },
      { l: "Folha de Pagamento", d: "Lançamento de rubricas personalizadas e geração de holerites" },
      { l: "Auditoria de Ponto", d: "Controle detalhado de horas, entradas, saídas e justificativas" },
      { l: "Cargos e Funções", d: "Configuração de privilégios para cada colaborador" },
      { l: "Comunicação Interna", d: "Publicação de avisos administrativos de RH para a equipe" },
      { l: "Skins e Identidade", d: "Acompanhe e configure a imagem visual da frota corporativa" }
    ]
  }
};

const App: React.FC = () => {

  console.log('App component rendered');
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isPassengerMode, setIsPassengerMode] = useState(false);
  const [showPassengerTicketing, setShowPassengerTicketing] = useState(false);
  const [currentView, setCurrentView] = useState<ViewState | string>(localStorage.getItem('fluxo_current_view') || 'dashboard'); 
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [themeMode, setThemeMode] = useState<ThemeMode>((localStorage.getItem('fluxo_theme') as ThemeMode) || 'light');
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [errorModal, setErrorModal] = useState<{ message: string } | null>(null);
  
  const [showWelcome, setShowWelcome] = useState(false);
  const [showGoodbye, setShowGoodbye] = useState(false);

  const [routes, setRoutes] = useState<BusRoute[]>([]);
  const [trips, setTrps] = useState<Trip[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [reports, setReports] = useState<IssueReport[]>([]);
  const [cities, setCities] = useState<City[]>([]);
  const [notices, setNotices] = useState<Notice[]>([]);
  const [inspections, setInspections] = useState<Inspection[]>([]);
  const [ticketBooths, setTicketBooths] = useState<TicketBooth[]>([]);
  const [ticketingConfig, setTicketingConfig] = useState<TicketingConfig | null>(DEFAULT_CONFIG);
  const [roleConfigs, setRoleConfigs] = useState<RoleConfig[]>([]);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [notificationMetadata, setNotificationMetadata] = useState<any>(null);
  const [importUserData, setImportUserData] = useState<Partial<User> | null>(null);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [userFines, setUserFines] = useState<UserFine[]>([]);
  const [systemSettings, setSystemSettings] = useState<SystemSettings | null>(null);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [showTrialWarning, setShowTrialWarning] = useState(false);
  const [isPurging, setIsPurging] = useState(false);
  const [skins, setSkins] = useState<Skin[]>([]);
  const [showTutorial, setShowTutorial] = useState(false);
  const [isClockedIn, setIsClockedIn] = useState<boolean | null>(null);

  const debounceTimers = useRef<Record<string, number>>({});
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Tecla ESC: Fecha sidebar ou modais se estiverem abertos
      if (e.key === 'Escape') {
        if (isSidebarOpen) setIsSidebarOpen(false);
        window.dispatchEvent(new CustomEvent('close-all-modals'));
      }

      // Tecla ENTER: Navegação similar a TAB
      if (e.key === 'Enter') {
        const target = e.target as HTMLElement;
        if (target && (target.tagName === 'INPUT' || target.tagName === 'SELECT')) {
          // Allow default behavior for checkboxes and radio buttons if needed, or just let them move focus
          if (target.getAttribute('type') === 'checkbox' || target.getAttribute('type') === 'radio') {
              return;
          }

          const isPassword = target.getAttribute('type') === 'password';
          const isLoginScreen = !!target.closest('.login-screen-vialivre');

          e.preventDefault();
          const form = target.closest('form');
          if (form) {
            const elements = Array.from(form.querySelectorAll('input:not([type="hidden"]), select, textarea, button'))
              .filter(el => {
                const style = window.getComputedStyle(el);
                return !el.hasAttribute('disabled') && style.display !== 'none' && style.visibility !== 'hidden';
              });
            const index = elements.indexOf(target);

            // Auto-login logic for Login Screen
            if (isLoginScreen && form.getAttribute('id') === 'login-form-main') {
              const loginInputs = form.querySelectorAll('input');
              const isFilled = Array.from(loginInputs).every(inp => inp.value.trim().length > 0);
              if (isFilled && (index === elements.length - 1 || isPassword)) {
                form.requestSubmit();
                return;
              }
            }

            if (index > -1 && index < elements.length - 1) {
              (elements[index + 1] as HTMLElement).focus();
            } else if (index === elements.length - 1) {
              const confirmCheck = form.querySelector('input[type="checkbox"][id*="confirm"]') as HTMLElement;
              const saveBtn = form.querySelector('button[type="submit"]') as HTMLElement;
              if (confirmCheck) confirmCheck.focus();
              else if (saveBtn) saveBtn.focus();
            }
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isSidebarOpen]);

  // Effect to apply dynamic theme color palettes globally
  useEffect(() => {
    const root = document.documentElement;
    const themeColor = systemSettings?.theme_color || 'yellow';
    
    const colors: Record<string, { primary: string; dark: string }> = {
      yellow: { primary: '#facc15', dark: '#eab308' }, // Amarelo (Padrão)
      blue: { primary: '#3b82f6', dark: '#2563eb' }, // Azul
      indigo: { primary: '#6366f1', dark: '#4f46e5' }, // Índigo
      emerald: { primary: '#10b981', dark: '#059669' }, // Esmeralda
      rose: { primary: '#ec4899', dark: '#db2777' }, // Rosa Elegante
    };
    
    const selected = colors[themeColor] || colors.yellow;
    root.style.setProperty('--primary-color', selected.primary);
    root.style.setProperty('--primary-color-dark', selected.dark);
  }, [systemSettings]);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    const handleViewChange = (e: any) => {
        setCurrentView(e.detail);
        if (e.metadata) setNotificationMetadata(e.metadata);
    };
    window.addEventListener('resize', handleResize);
    window.addEventListener('change-view', handleViewChange);
    return () => {
        window.removeEventListener('resize', handleResize);
        window.removeEventListener('change-view', handleViewChange);
    };
  }, []);

  useEffect(() => {
    localStorage.setItem('fluxo_current_view', currentView);
  }, [currentView]);

  const addToast = useCallback((message: string, type: ToastType = 'success') => {
    if (type === 'error') {
      setErrorModal({ message });
      return;
    }
    const id = Date.now() + Math.random();
    setToasts(prev => [...(prev || []), { id, message, type }]);
    setTimeout(() => { setToasts(prev => (prev || []).filter(t => t.id !== id)); }, 5000);
  }, []);

  useEffect(() => {
    const root = window.document.documentElement;
    if (themeMode === 'dark') root.classList.add('dark');
    else root.classList.remove('dark');
    localStorage.setItem('fluxo_theme', themeMode);
  }, [themeMode]);

  useEffect(() => {
    const requestNotifications = async () => {
      const granted = await NotificationService.requestPermission();
      if (granted) {
        console.log('Permissão de notificação concedida');
      }
    };
    requestNotifications();
  }, []);

  const loadInitialData = useCallback(async () => {
    console.log('loadInitialData called');
    try {
      const [r, t, u, c, v, rep, cit, n, insp, cfg, roles, notifs, sfts, settings, fines, subs, skns, tt, booths] = await Promise.allSettled([
        db.getRoutes(), db.getTrips(), db.getUsers(), db.getCompanies(), db.getVehicles(), db.getReports(), db.getCities(), db.getNotices(), db.getInspections(), db.getTicketingConfig(), db.getRoleConfigs(), db.getNotifications(), db.getShifts(), db.getSystemSettings(), db.getUserFines(), db.getSubscriptions(), db.getSkins(), db.fetchAll<TimeEntry>('time_tracking' as any), db.getTicketBooths()
      ]);
      
      if (r.status === 'fulfilled') setRoutes(r.value || []);
      if (t.status === 'fulfilled') setTrps(t.value || []);
      if (u.status === 'fulfilled') setUsers(u.value || []);
      if (c.status === 'fulfilled') setCompanies(c.value || []);
      if (v.status === 'fulfilled') setVehicles(v.value || []);
      if (rep.status === 'fulfilled') setReports(rep.value || []);
      if (cit.status === 'fulfilled') setCities(cit.value || []);
      if (n.status === 'fulfilled') setNotices(n.value || []);
      if (insp.status === 'fulfilled') setInspections(insp.value || []);
      if (booths.status === 'fulfilled') setTicketBooths(booths.value || []);
      if (cfg.status === 'fulfilled' && cfg.value && cfg.value.length > 0) setTicketingConfig(cfg.value[0]);
      if (roles.status === 'fulfilled') {
        const roleData = roles.value || [];
        setRoleConfigs(roleData);
        
        // Sync currentUser permissions if they differ from role config
        if (currentUser && roleData.length > 0) {
          const roleConf = roleData.find(rc => rc.name === currentUser.job_title);
          if (roleConf && JSON.stringify(roleConf.permissions) !== JSON.stringify(currentUser.permissions)) {
            console.log('Runtime sync: updating currentUser permissions from role config');
            setCurrentUser(prev => prev ? { ...prev, permissions: roleConf.permissions } : null);
          }
        }
      }
      if (notifs.status === 'fulfilled') setNotifications(notifs.value || []);
      if (sfts.status === 'fulfilled') setShifts(sfts.value || []);
      if (fines.status === 'fulfilled') setUserFines(fines.value || []);
      if (skns.status === 'fulfilled') setSkins(skns.value || []);
      if (tt.status === 'fulfilled' && currentUser) {
        const today = new Date().toISOString().split('T')[0];
        const todayEntry = (tt.value as TimeEntry[] || []).find(e => e.date === today && e.user_id === currentUser.id);
        setIsClockedIn(!!todayEntry?.clock_in);
      } else if (tt.status === 'rejected' || !currentUser) {
        setIsClockedIn(false);
      }
      if (subs.status === 'fulfilled') {
        if (subs.value && subs.value.length > 0) {
          const activeSub = subs.value[0] as Subscription;
          setSubscription(activeSub);
          
          // Check for 6th day trial warning
          if (activeSub.plan_type === 'TRIAL' && activeSub.status === 'ACTIVE') {
            const expiresAt = new Date(activeSub.expires_at);
            const now = new Date();
            const diffTime = expiresAt.getTime() - now.getTime();
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            
            // If 1 day left (6th day of 7), and user is admin
            if (diffDays === 1 && !localStorage.getItem(`vialivre_trial_warned_${activeSub.id}`)) {
              setShowTrialWarning(true);
            }
          }
        } else if (currentUser && db.getSystemId() && currentUser.role === 'ADMIN') {
          // Auto-create 7-day trial if no subscription exists
          const trialExpires = new Date();
          trialExpires.setDate(trialExpires.getDate() + 7);
          const newTrial: Partial<Subscription> = {
            system_id: db.getSystemId()!,
            plan_type: 'TRIAL' as any,
            activated_at: new Date().toISOString(),
            expires_at: trialExpires.toISOString(),
            status: 'ACTIVE' as any,
            created_at: new Date().toISOString()
          };
          db.create('subscriptions', newTrial).then(s => {
            if (s) setSubscription(s as Subscription);
          });
        }
      }
      if (settings.status === 'fulfilled' && settings.value && settings.value.length > 0) {
        const s = settings.value[0];
        if (s.system_logo) {
          s.system_logo = `${s.system_logo.split('?')[0]}?t=${Date.now()}`;
        }
        setSystemSettings(s);
      }
    } catch (e) {
      addToast("Erro ao conectar com o banco de dados.", "error");
    } finally { 
      setIsLoading(false);
    }
  }, [addToast, currentUser]);

  const handleRealtimeEvent = useCallback((table: string, payload: any) => {
    const { eventType, new: newItem, old: oldItem } = payload;
    if (debounceTimers.current[table]) clearTimeout(debounceTimers.current[table]);
    
    debounceTimers.current[table] = window.setTimeout(() => {
      const syncList = (prev: any[]) => {
        const currentList = Array.isArray(prev) ? prev : [];
        if (eventType === 'INSERT') {
          const exists = currentList.some(item => item.id === newItem.id);
          return exists ? currentList.map(item => item.id === newItem.id ? newItem : item) : [...currentList, newItem];
        }
        if (eventType === 'UPDATE') return currentList.map(item => item.id === newItem.id ? newItem : item);
        if (eventType === 'DELETE') return currentList.filter(item => item.id !== (oldItem?.id || newItem?.id));
        return currentList;
      };

      switch (table) {
        case 'trips': 
          setTrps(syncList); 
          if (eventType === 'INSERT' && currentUser) {
            if (newItem.driver_id === currentUser.id || newItem.conductor_id === currentUser.id || newItem.fiscal_id === currentUser.id) {
              addToast(`VOCÊ TEM UMA NOVA ESCALA: ${newItem.departure_time} - Carro ${newItem.bus_number}`, 'success');
              NotificationService.sendLocalNotification("Nova Escala de Viagem", { 
                body: `Você foi escalado para a viagem das ${newItem.departure_time} (Viatura ${newItem.bus_number}).`
              });
            }
          }
          break;
        case 'occurrences': setReports(syncList); break;
        case 'users': setUsers(syncList); break;
        case 'routes': setRoutes(syncList); break;
        case 'companies': setCompanies(syncList); break;
        case 'vehicles': setVehicles(syncList); break;
        case 'cities': setCities(syncList); break;
        case 'notices': 
          setNotices(syncList); 
          if (eventType === 'INSERT') {
            const userRole = currentUser?.role || 'PASSENGER';
            if (userRole === 'ADMIN' || newItem.target_role === 'ALL' || newItem.target_role === userRole) {
              const notificationBody = newItem.attachment_info 
                ? `${newItem.content}\n\nAnexo: ${newItem.attachment_info}`
                : newItem.content;
              addToast(`Novo Alerta: ${newItem.title}`, 'info');
              NotificationService.sendLocalNotification(newItem.title, { body: notificationBody });
            }
          }
          break;
        case 'inspections': setInspections(syncList); break;
        case 'ticket_booths': setTicketBooths(syncList); break;
        case 'traffic_violations': setUserFines(syncList); break;
        case 'user_fines': setUserFines(syncList); break;
        case 'notifications': setNotifications(syncList); break;
        case 'skins': setSkins(syncList); break;
        case 'time_tracking': 
          if (currentUser) {
            const today = new Date().toISOString().split('T')[0];
            if (eventType === 'INSERT' && newItem.user_id === currentUser.id && newItem.date === today) {
              setIsClockedIn(!!newItem.clock_in);
            } else if (eventType === 'UPDATE' && newItem.user_id === currentUser.id && newItem.date === today) {
              setIsClockedIn(!!newItem.clock_in);
            } else if (eventType === 'DELETE' && oldItem.user_id === currentUser.id && oldItem.date === today) {
              setIsClockedIn(false);
            }
          }
          break;
        case 'role_configs': setRoleConfigs(syncList); break;
        case 'activation_keys': 
          // Re-fetch subscriptions if activation keys change as they are related
          db.getSubscriptions().then(subs => subs && subs.length > 0 && setSubscription(subs[0]));
          break;
        case 'subscriptions':
          db.getSubscriptions().then(subs => subs && subs.length > 0 && setSubscription(subs[0]));
          break;
        case 'ticketing_config': 
          db.getTicketingConfig().then(cfg => cfg && cfg.length > 0 && setTicketingConfig(cfg[0]));
          break;
      }
    }, 300);
  }, [addToast, currentUser]);

  useEffect(() => {
    console.log('Realtime/Initial Data useEffect triggered');
    if (!currentUser && !isPassengerMode) {
      console.log('Skipping loadInitialData due to no user or passenger mode');
      return;
    }
    loadInitialData();
    const channel = db.initializeRealtime(handleRealtimeEvent);
    return () => { channel.unsubscribe(); };
  }, [currentUser, isPassengerMode, loadInitialData, handleRealtimeEvent]);

  useEffect(() => {
    console.log('User session useEffect triggered');
    const savedUser = localStorage.getItem('fluxo_session_user');
    if (savedUser) {
      try { 
        const u = JSON.parse(savedUser);
        db.setSystemId(u.system_id || null);
        setCurrentUser(u);
        setCurrentView('dashboard');
        
        // Auto trigger tutorial for all collaborators if not seen
        if (u.role && u.role !== 'PASSENGER' && !localStorage.getItem('fluxo_tutorial_seen')) {
          setTimeout(() => {
            setShowTutorial(true);
          }, 1500);
        }
      } 
      catch (e) { localStorage.removeItem('fluxo_session_user'); setIsLoading(false); }
    } else {
      setIsLoading(false);
    }
  }, []);

  // Navigation Restriction & Auto Clock-out Logic
  useEffect(() => {
    if (!currentUser) return;

    const isCollaborator = ['DRIVER', 'CONDUCTOR', 'FISCAL', 'TICKET_AGENT', 'MECHANIC'].includes(currentUser.role);
    if (!isCollaborator) return;

    // Restriction Logic: Unlock if clocked in
    const isRestrictedView = currentView !== 'time-tracking' && currentView !== 'about';
    if (isClockedIn === false && isRestrictedView) {
      setCurrentView('time-tracking');
      addToast("Acesso restrito: Por favor, registre sua entrada (Ponto Eletrônico) para liberar as outras funções.", "warning");
    }

    // Auto Clock-out Logic
    const checkAutoClockOut = async () => {
      const today = new Date().toISOString().split('T')[0];
      const now = new Date();
      const currentTimeStr = now.toTimeString().split(' ')[0].substring(0, 5); // HH:mm

      // Find today's shift
      const todayShift = shifts.find(s => s.driver_id === currentUser.id && s.date === today);
      if (!todayShift) return;

      // Find today's time entry
      const tt = await db.fetchAll<TimeEntry>('time_tracking' as any);
      const todayEntry = tt.find(e => e.date === today && e.user_id === currentUser.id);

      if (todayEntry && todayEntry.clock_in && !todayEntry.clock_out) {
        // If current time > shift end time + some buffer (e.g., 30 mins)
        // Or simply if shift end time is passed
        if (currentTimeStr > todayShift.end_time) {
          await db.update('time_tracking' as any, {
            ...todayEntry,
            clock_out: todayShift.end_time,
            notes: (todayEntry.notes || '') + ' [Encerrado automaticamente pelo sistema após fim da escala]'
          });
          addToast("Seu ponto foi encerrado automaticamente pois sua escala de trabalho chegou ao fim.", "info");
        }
      }
    };

    const timer = setInterval(checkAutoClockOut, 60000); // Check every minute
    checkAutoClockOut(); // Initial check

    return () => clearInterval(timer);
  }, [currentUser, isClockedIn, currentView, addToast, shifts]);

  const handleSetUser = (user: User | null) => {
      if (user) {
          db.setSystemId(user.system_id || null);
          setCurrentUser(user);
          localStorage.setItem('fluxo_session_user', JSON.stringify(user));
          setShowWelcome(true);
          setTimeout(() => {
            setShowWelcome(false);
            if (user.role && user.role !== 'PASSENGER' && !localStorage.getItem('fluxo_tutorial_seen')) {
              setShowTutorial(true);
            }
          }, 4500);
          
          // Determine initial view based on role and permissions
          if (user.role === 'ADMIN' || (user.permissions && user.permissions.includes('dashboard'))) {
              setCurrentView('dashboard');
          } else {
              // Get allowed views from role configs if available, or just find the first one from sidebar if permissions are set
              // For now, let's look at the sidebar common views or just sort available keys
              const viewsForRole: Record<string, string[]> = {
                  'DRIVER': ['driver-view', 'reports-view'],
                  'CONDUCTOR': ['driver-view'],
                  'FISCAL': ['schedule', 'reports-view', 'dispatcher'],
                  'AGENTE': ['ticketing', 'reports-view'],
                  'DESPACHANTE': ['dispatcher', 'schedule', 'maintenance'],
                  'RH': ['management', 'drivers', 'payroll']
              };
              
              const defaultViews = viewsForRole[user.role] || ['dashboard'];
              const sortedViews = [...defaultViews].sort((a, b) => a.localeCompare(b));
              setCurrentView(sortedViews[0] || 'dashboard');
          }
      } else {
          db.setSystemId(null);
          setShowGoodbye(true);
          setTimeout(() => {
            setShowGoodbye(false);
            setCurrentUser(null);
            localStorage.removeItem('fluxo_session_user');
          }, 3000);
      }
  };

  const handleNotificationClick = useCallback((notif: AppNotification) => {
    if (notif.link) {
      setCurrentView(notif.link);
      setNotificationMetadata(notif.metadata);
    }
    if (!notif.is_read) {
      db.update('notifications', { id: notif.id, is_read: true }).then(() => loadInitialData());
    }
  }, [loadInitialData]);

  const handleAction = async (action: 'create' | 'update' | 'delete', table: TableName, itemOrId: any) => {
    try {
        let res;
        if (action === 'create') {
          res = await db.create(table, itemOrId);
          if (table === 'notices' && res) {
            await db.create<AppNotification>('notifications', {
              title: `Novo Comunicado: ${(res as any).title}`,
              message: (res as any).content,
              type: 'INFO',
              category: 'SYSTEM',
              target_role: (res as any).target_role || 'ALL',
              is_read: false,
              created_at: new Date().toISOString()
            });
            
            // Send local notification
            NotificationService.sendLocalNotification(`Novo Comunicado: ${(res as any).title}`, {
              body: (res as any).content,
              icon: '/favicon.ico'
            });
          }
        }
        else if (action === 'update') res = await db.update(table, itemOrId);
        else {
          let query = supabase.from(table).delete().eq('id', itemOrId);
          
          if (currentUser?.system_id) {
            query = query.eq('system_id', currentUser.system_id);
          }

          const { error } = await query;
          if (error) {
            console.error('Delete error details:', error);
            if (error.code === '23503') {
              throw new Error("Não é possível excluir este registro pois existem outros dados vinculados a ele (ex: usuários, veículos ou rotas).");
            }
            throw error;
          }
          res = true; // Indicate success for deletion
        }
        if (res) {
          addToast("Operação concluída com sucesso.", "success");
          loadInitialData();
          return true;
        }
        return null;
    } catch (error: any) {
        addToast(error.message || "Falha operacional no banco de dados.", "error");
        return null;
    }
  };

  const handleSendSystemNotification = async (driverId: string, message: string) => {
    const driver = users.find(u => u.id === driverId);
    if (!driver) {
      addToast("Motorista não encontrado.", "error");
      return;
    }

    try {
      // Log notification in system
      await handleAction('create', 'notifications', {
        id: Math.random().toString(36).substr(2, 9),
        user_id: driverId,
        title: 'Alerta de Viagem',
        message: message,
        type: 'ERROR',
        category: 'SCHEDULE',
        is_read: false,
        created_at: new Date().toISOString()
      });
      addToast(`Notificação enviada para ${driver.full_name || driver.name}`);
    } catch (error) {
      addToast("Erro ao enviar notificação.", "error");
    }
  };

  console.log('Current state:', { isLoading, showWelcome, showGoodbye, isPassengerMode, currentUser: !!currentUser });
  const handlePurgeData = async () => {
    setIsPurging(true);
    try {
      const tablesToClear = db.getIsolatedTables();
      // Keep subscriptions table to mark it as EXPIRED or similar? 
      // Actually the user said "todos os cadastros realizados no sistema serão apagados automaticamente"
      // I should clear everything except maybe the subscription itself (to prevent immediate re-trial?)
      // or clear that too.
      
      for (const table of tablesToClear) {
        if (table === 'subscriptions') continue;
        await db.clearTable(table);
      }
      
      // Mark subscription as canceled/expired
      if (subscription) {
        await db.update('subscriptions', { ...subscription, status: 'CANCELED' });
      }
      
      addToast("Todos os dados do sistema foram apagados com sucesso.", "success");
      setShowTrialWarning(false);
      handleSetUser(null); // Logout
    } catch (error) {
      console.error('Error purging data:', error);
      addToast("Erro ao apagar dados do sistema.", "error");
    } finally {
      setIsPurging(false);
    }
  };

  const handleKeepSystem = () => {
    const phone = systemSettings?.support_phone || '5511999999999'; // Default or from settings
    const message = encodeURIComponent(`Olá! Meu período de teste no ViaLivre Gestão está terminando e gostaria de adquirir uma assinatura para manter meus dados.`);
    window.open(`https://wa.me/${phone.replace(/\D/g, '')}?text=${message}`, '_blank');
    
    // Mark as warned so it doesn't pop up every refresh until next day
    if (subscription) {
      localStorage.setItem(`vialivre_trial_warned_${subscription.id}`, 'true');
    }
    setShowTrialWarning(false);
  };

  if (isLoading) return (
    <div className="min-h-screen bg-white dark:bg-zinc-950 flex items-center justify-center flex-col gap-6">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.5, repeat: Infinity, repeatType: "reverse" }}
        >
          <BusFront size={64} className="text-yellow-400" />
        </motion.div>
        <Loader2 className="w-10 h-10 text-yellow-500 animate-spin" />
    </div>
  );

  if (showWelcome) return (
    <AnimatePresence>
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="min-h-screen bg-yellow-400 flex flex-col items-center justify-center text-slate-900 z-[1000] fixed inset-0"
      >
          <motion.div 
            initial={{ scale: 0.9, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            className="p-10 bg-white rounded-[3.5rem] shadow-2xl flex flex-col items-center gap-8 border-4 border-slate-900 w-full max-w-xl mx-4"
          >
              <div className="flex flex-col items-center gap-4">
                  <motion.div 
                    animate={{ y: [0, -10, 0] }}
                    transition={{ repeat: Infinity, duration: 2 }}
                    className="w-20 h-20 bg-yellow-400 rounded-3xl shadow-xl flex items-center justify-center border-2 border-slate-900 overflow-hidden"
                  >
                      {systemSettings?.system_logo ? (
                        <img src={`${systemSettings.system_logo.split('?')[0]}?t=${Date.now()}`} className="w-full h-full object-contain" alt="Logo" referrerPolicy="no-referrer" />
                      ) : (
                        <Sparkles size={48} className="text-white" />
                      )}
                  </motion.div>
                  <div className="text-center">
                      <h1 className="text-3xl font-black uppercase italic tracking-tighter mb-1">Olá, {currentUser?.full_name?.split(' ')[0]}!</h1>
                      <div className="inline-block px-4 py-1 bg-slate-900 text-white rounded-full font-black uppercase text-[8px] tracking-widest">
                          {currentUser?.role === 'ADMIN' ? 'ADMINISTRADOR' : (currentUser?.job_title || (currentUser?.role === 'RH' ? 'Recursos Humanos' : currentUser?.role))}
                      </div>
                  </div>
              </div>
              <div className="w-full space-y-2">
                  <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: "100%" }}
                        transition={{ duration: 4, ease: "linear" }}
                        className="h-full bg-yellow-400"
                      ></motion.div>
                  </div>
                  <p className="text-[9px] font-black uppercase tracking-[0.2em] opacity-40 text-center italic">Sincronizando seu perfil operacional...</p>
              </div>
          </motion.div>
      </motion.div>
    </AnimatePresence>
  );

  if (showGoodbye) return (
    <AnimatePresence>
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="min-h-screen bg-slate-900 flex flex-col items-center justify-center text-white z-[1000] fixed inset-0"
      >
          <motion.div 
            initial={{ scale: 0.9, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            className="p-10 bg-zinc-900 rounded-[3.5rem] shadow-2xl flex flex-col items-center gap-6 border-4 border-yellow-400 w-full max-sm mx-4"
          >
              <motion.div 
                animate={{ opacity: [0.5, 1, 0.5] }}
                transition={{ repeat: Infinity, duration: 2 }}
                className="w-16 h-16 bg-white/5 rounded-3xl flex items-center justify-center text-yellow-400 border border-white/10 overflow-hidden"
              >
                  {systemSettings?.system_logo ? (
                    <img src={`${systemSettings.system_logo.split('?')[0]}?t=${Date.now()}`} className="w-full h-full object-contain" alt="Logo" referrerPolicy="no-referrer" />
                  ) : (
                    <Coffee size={40} />
                  )}
              </motion.div>
              <div className="text-center">
                  <h1 className="text-4xl font-black uppercase italic tracking-tighter mb-2">Bom descanso!</h1>
                  <div className="px-6 py-2 bg-yellow-400 text-slate-900 rounded-full font-black uppercase text-[10px] tracking-widest shadow-lg">Dia Finalizado</div>
              </div>
              <p className="text-[10px] font-black uppercase tracking-[0.4em] opacity-30 text-center leading-relaxed italic">Suas sessões foram encerradas<br/>com segurança em todos os terminais.</p>
          </motion.div>
      </motion.div>
    </AnimatePresence>
  );

  if (isPassengerMode) {
    if (showPassengerTicketing) {
      return (
        <TicketAgentInterface 
          routes={routes} 
          trips={trips} 
          vehicles={vehicles} 
          companies={companies} 
          cities={cities}
          currentUser={null} 
          ticketingConfig={ticketingConfig} 
          onExit={() => {
            setShowPassengerTicketing(false);
            setNotificationMetadata(null);
          }} 
          addToast={addToast} 
          isPassengerView={true}
          initialTripId={notificationMetadata?.trip_id}
          initialRouteId={notificationMetadata?.route_id}
          initialPassengerData={notificationMetadata?.passengerData}
        />
      );
    }
    return (
      <PassengerInterface 
        routes={routes} 
        trips={trips} 
        companies={companies} 
        cities={cities} 
        notices={notices} 
        vehicles={vehicles} 
        addToast={addToast} 
        onExit={() => setIsPassengerMode(false)} 
        onOpenTicketing={(tripId, passengerData, routeId) => {
          setNotificationMetadata({
            trip_id: tripId,
            passengerData: passengerData,
            route_id: routeId
          });
          setShowPassengerTicketing(true);
        }}
      />
    );
  }
  if (!currentUser) return <LoginScreen onLogin={handleSetUser} onRegister={handleSetUser} onPassengerAccess={() => setIsPassengerMode(true)} themeMode={themeMode} setThemeMode={setThemeMode} resolvedTheme={themeMode} systemSettings={systemSettings} />;

  // Subscription check logic
  const isSubscriptionExpired = () => {
    if (!subscription) return false;
    if (subscription.plan_type === 'LIFETIME') return false;
    const now = new Date();
    const expiresAt = new Date(subscription.expires_at);
    return expiresAt < now;
  };

  if (isSubscriptionExpired()) {
    return <SubscriptionExpired onLogout={() => handleSetUser(null)} />;
  }

  const commonProps = { 
    routes, 
    trips, 
    users, 
    companies, 
    vehicles, 
    reports, 
    cities, 
    notices, 
    currentUser, 
    inspections, 
    ticketingConfig, 
    addToast, 
    subscription, 
    skins, 
    systemSettings, 
    ticketBooths, 
    onUpdateSettings: (s: any) => handleAction('update', 'system_settings', s),
    userFines,
    roleConfigs,
    shifts,
    notifications,
    loadInitialData,
    handleNotificationClick,
    handleSendSystemNotification,
    importUserData,
    setImportUserData,
    setCurrentView,
    notificationMetadata,
    setNotificationMetadata
  };

  return (
    <ErrorBoundary>
      <div className={`min-h-screen bg-white dark:bg-zinc-950 text-slate-900 dark:text-slate-100 ${isMobile ? 'pb-24' : ''}`}>
        <Topbar 
          currentView={currentView as ViewState} 
          onChangeView={(v) => setCurrentView(v as ViewState)} 
          onLogout={() => handleSetUser(null)} 
          isOpen={isSidebarOpen} 
          onClose={()=>setIsSidebarOpen(false)} 
          onToggle={()=>setIsSidebarOpen(!isSidebarOpen)} 
          currentUser={currentUser} 
          themeMode={themeMode} 
          onToggleTheme={()=>setThemeMode(themeMode === 'light' ? 'dark' : 'light')} 
          onChangeThemeMode={(mode) => setThemeMode(mode)}
          onUpdateSettings={(s) => handleAction('update', 'system_settings', s)}
          unreadNotificationsCount={notifications.filter(n => {
            if (n.is_read) return false;
            if (currentUser?.role === 'ADMIN') return true;
            if (n.user_id === currentUser?.id) return true;
            if (!n.user_id && (!n.target_role || n.target_role === 'ALL' || n.target_role === currentUser?.role)) return true;
            return false;
          }).length} 
          systemSettings={systemSettings} 
        />
        
        <main key={currentView} className={`w-full ${isMobile ? 'pt-16 px-4' : 'pt-18 px-8'} h-full transition-all pb-44 md:pb-24`}>
          <ViewContent currentView={currentView as ViewState} commonProps={commonProps} handleAction={handleAction} />
        </main>

        <div className="fixed top-16 right-4 z-[300] flex flex-col gap-3 max-w-[90vw] pointer-events-none">
          <AnimatePresence>
            {(toasts || []).map(toast => (
              <motion.div 
                key={toast.id}
                initial={{ opacity: 0, x: 50, scale: 0.9 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9, x: 20 }}
                className={`pointer-events-auto px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-4 border-2 ${
                  toast.type === 'success' ? 'bg-emerald-500 text-white border-emerald-400' :
                  toast.type === 'error' ? 'bg-red-600 text-white border-red-500' :
                  'bg-yellow-400 text-slate-900 border-yellow-500'
                }`}
              >
                <CheckCircle2 size={20}/>
                <span className="text-xs font-black uppercase tracking-tight">{toast.message}</span>
                <button onClick={() => setToasts(prev => (prev || []).filter(t => t.id !== toast.id))} className="ml-2 opacity-60 hover:opacity-100"><X size={16}/></button>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        <AnimatePresence>
          {errorModal && (
            <div 
              className="fixed inset-0 z-[2000] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm"
              onClick={() => setErrorModal(null)}
            >
              <motion.div 
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="bg-white dark:bg-zinc-900 w-full max-w-md rounded-[2.5rem] shadow-2xl border border-slate-100 dark:border-zinc-800 overflow-hidden"
                onClick={e => e.stopPropagation()}
              >
                <div className="p-6 border-b border-slate-100 dark:border-zinc-800 flex justify-between items-center bg-red-50 dark:bg-red-900/10">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-900/20 flex items-center justify-center">
                      <AlertCircle className="text-red-600" size={20} />
                    </div>
                    <h3 className="text-sm font-black text-red-600 uppercase tracking-widest">Erro no Sistema</h3>
                  </div>
                  <button 
                    onClick={() => setErrorModal(null)}
                    className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                  >
                    <X size={24} />
                  </button>
                </div>
                <div className="p-8">
                  <p className="text-slate-600 dark:text-zinc-400 font-bold text-center leading-relaxed">
                    {errorModal.message}
                  </p>
                  <button 
                    onClick={() => setErrorModal(null)}
                    className="w-full mt-8 py-4 bg-slate-900 dark:bg-zinc-800 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-black dark:hover:bg-zinc-700 transition-all shadow-lg active:scale-95"
                  >
                    Entendido
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {showTrialWarning && (
            <div className="fixed inset-0 z-[3000] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md">
              <motion.div 
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 20 }}
                className="bg-white dark:bg-zinc-900 w-full max-w-lg rounded-[3rem] shadow-2xl border-4 border-yellow-400 overflow-hidden"
              >
                <div className="p-8 text-center space-y-6">
                  <div className="w-20 h-20 bg-yellow-400 rounded-3xl mx-auto flex items-center justify-center text-slate-900 shadow-xl border-4 border-white dark:border-zinc-800">
                    <AlertTriangle size={40} className="fill-current" />
                  </div>
                  
                  <div className="space-y-2">
                    <h2 className="text-3xl font-black uppercase italic tracking-tighter text-slate-900 dark:text-white leading-tight">
                      Período de Teste Quase Expirado!
                    </h2>
                    <p className="text-xs font-bold text-slate-500 leading-relaxed">
                      Sua licença de teste gratuito de 7 dias expira em breve (6º dia). Para continuar gerenciando sua frota e manter seus dados salvos, você deve adquirir uma assinatura.
                    </p>
                  </div>

                  <div className="bg-red-50 dark:bg-red-900/20 p-6 rounded-[2rem] border-2 border-red-100 dark:border-red-900/50 shadow-inner">
                    <div className="flex items-center justify-center gap-3 text-red-600 dark:text-red-400 mb-2">
                      <AlertCircle size={20} className="animate-pulse" />
                      <span className="text-xs font-black uppercase tracking-widest">Atenção: Ação Irreversível</span>
                    </div>
                    <p className="text-[11px] text-red-600 dark:text-red-400 font-black leading-tight uppercase text-center bg-white/50 dark:bg-black/20 p-3 rounded-xl border border-red-200 dark:border-red-800">
                      CASO SELECCIONE "NÃO", TODOS OS SEUS DADOS (VEÍCULOS, LINHAS, CLIENTES, VENDAS) SERÃO APAGADOS DEFINITIVAMENTE DO BANCO DE DADOS AGORA.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 gap-4 pt-4">
                    <button 
                      onClick={handleKeepSystem}
                      className="w-full bg-slate-900 dark:bg-yellow-400 text-white dark:text-slate-900 py-5 rounded-[2rem] font-black uppercase text-xs tracking-[0.2em] shadow-xl flex items-center justify-center gap-3 hover:scale-[1.02] active:scale-95 transition-all"
                    >
                      <Sparkles size={18} className="text-yellow-400 dark:text-slate-900" />
                      Manter meu Sistema
                    </button>
                    
                    <button 
                      onClick={() => {
                        if (window.confirm("VOCÊ TEM CERTEZA? Se selecionar 'NÃO', TODOS os cadastros realizados no sistema serão apagados AUTOMATICAMENTE agora. Esta ação é IRREVERSÍVEL.")) {
                          handlePurgeData();
                        }
                      }}
                      disabled={isPurging}
                      className="w-full text-slate-400 hover:text-red-600 font-black uppercase text-[10px] tracking-widest flex items-center justify-center gap-2 transition-all transition-colors"
                    >
                      {isPurging ? <RefreshCw size={14} className="animate-spin" /> : <X size={14} />}
                      Não, não desejo manter
                    </button>
                  </div>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {isMobile && currentView !== 'driver-view' && <MobileBottomNav currentView={currentView} onChangeView={(v) => setCurrentView(v)} onOpenMenu={() => setIsSidebarOpen(true)} currentUser={currentUser} />}

        {showTutorial && (() => {
          const userRole = currentUser?.role || 'ADMIN';
          const tut = ROLE_TUTORIALS[userRole === 'TICKET_AGENT' ? 'AGENTE' : userRole] || ROLE_TUTORIALS.ADMIN;
          return (
            <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-xl z-[2000] flex items-center justify-center p-4 overflow-y-auto">
              <motion.div 
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="bg-white dark:bg-zinc-950 w-full max-w-4xl rounded-[3rem] shadow-2xl border-4 border-yellow-400 overflow-hidden flex flex-col my-8"
              >
                <div className="p-8 bg-slate-900 text-white flex justify-between items-center">
                  <div>
                    <h2 className="text-2xl font-black uppercase italic tracking-tighter">{tut.title}</h2>
                    <p className="text-[10px] font-black text-yellow-400 uppercase mt-1">{tut.subtitle}</p>
                  </div>
                  <button onClick={() => { setShowTutorial(false); localStorage.setItem('fluxo_tutorial_seen', 'true'); }} className="p-3 bg-white/10 rounded-2xl hover:bg-red-500 transition-colors"><X size={24}/></button>
                </div>
                <div className="p-8 space-y-8 overflow-y-auto max-h-[60vh] custom-scrollbar">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-4">
                      <h3 className="text-sm font-black uppercase text-slate-800 dark:text-zinc-100 flex items-center gap-2">
                        <div className="w-8 h-8 bg-yellow-400 rounded-lg flex items-center justify-center text-slate-900 font-black">1</div>
                        {tut.step1Title}
                      </h3>
                      <p className="text-xs text-slate-500 dark:text-zinc-400 leading-relaxed font-bold">
                        {tut.step1Desc}
                      </p>
                    </div>
                    <div className="space-y-4">
                      <h3 className="text-sm font-black uppercase text-slate-800 dark:text-zinc-100 flex items-center gap-2">
                        <div className="w-8 h-8 bg-yellow-400 rounded-lg flex items-center justify-center text-slate-900 font-black">2</div>
                        {tut.step2Title}
                      </h3>
                      <p className="text-xs text-slate-500 dark:text-zinc-400 leading-relaxed font-bold">
                        {tut.step2Desc}
                      </p>
                    </div>
                  </div>

                  <div className="bg-slate-50 dark:bg-zinc-900 p-6 rounded-3xl border border-slate-100 dark:border-zinc-800">
                    <h4 className="text-[10px] font-black text-slate-400 uppercase mb-4 tracking-widest">Resumo das Funcionalidades da sua Conta:</h4>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                      {tut.features.map(item => (
                        <div key={item.l} className="p-3 bg-white dark:bg-zinc-800 rounded-xl border dark:border-zinc-700">
                          <p className="text-[9px] font-black text-slate-800 dark:text-zinc-100 uppercase mb-1">{item.l}</p>
                          <p className="text-[8px] text-slate-400 font-bold uppercase leading-tight">{item.d}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="p-6 bg-yellow-50 dark:bg-yellow-900/10 rounded-3xl border-2 border-dashed border-yellow-400">
                    <p className="text-xs font-black text-slate-800 dark:text-zinc-100 uppercase text-center italic">
                      {tut.quote}
                    </p>
                  </div>
                </div>
                <div className="p-8 bg-slate-50 dark:bg-zinc-900 border-t dark:border-zinc-800 flex justify-center">
                  <button 
                    onClick={() => { setShowTutorial(false); localStorage.setItem('fluxo_tutorial_seen', 'true'); }}
                    className="px-12 py-4 bg-yellow-400 text-slate-900 rounded-2xl font-black uppercase text-xs shadow-xl border-2 border-slate-900 active:scale-95 transition-all"
                  >
                    Entendido, vamos lá!
                  </button>
                </div>
              </motion.div>
            </div>
          );
        })()}
      </div>
    </ErrorBoundary>
  );
};

export default App;
