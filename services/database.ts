
import { BusRoute, Company, Trip, User, Vehicle, IssueReport, City, Notice, TicketSale, Inspection, TicketingConfig, PayrollRubric, RoleConfig, AppNotification, Shift, SystemSettings } from '../types';
import { supabase } from './supabaseClient';

export { supabase };
import { RealtimeChannel } from '@supabase/supabase-js';

export type TableName = 'routes' | 'trips' | 'users' | 'companies' | 'vehicles' | 'occurrences' | 'cities' | 'notices' | 'push_subscriptions' | 'ticket_sales' | 'maintenance' | 'inspections' | 'ticketing_config' | 'payroll_rubrics' | 'role_configs' | 'notifications' | 'shifts' | 'time_tracking' | 'driver_logs' | 'routes_logs' | 'system_settings' | 'imp_cards' | 'imp_card_recharges' | 'user_occurrences' | 'traffic_violations' | 'user_fines' | 'job_applications' | 'job_vacancies' | 'skins' | 'trips_audit' | 'activation_keys' | 'subscriptions';

export const cleanPayload = (table: TableName, obj: any, isUpdate = false) => {
  if (!obj || typeof obj !== 'object') return {};
  
  const entries = Object.entries(obj).filter(([key, v]) => {
    if (key.startsWith('_')) return false;
    if (key === 'id' && !isUpdate) return false;
    if (v === undefined || v === null) return false;
    if (typeof v === 'string' && v.trim() === '') return false;
    return true;
  });
  
  const payload = Object.fromEntries(entries);
  
  // Regra solicitada: Deletar total_daily_hours se for a tabela de ponto no update
  if (table === 'time_tracking' as any && isUpdate) {
    delete (payload as any).total_daily_hours;
  }
  
  return payload;
};

let currentSystemId: string | null = null;

export const db = {
  setSystemId: (id: string | null) => {
    currentSystemId = id;
    console.info(`[DB_CONFIG] System ID definido para: ${id}`);
  },

  getSystemId: () => currentSystemId,

  getIsolatedTables: (): TableName[] => [
    'routes', 'trips', 'users', 'companies', 'vehicles', 'occurrences', 
    'notices', 'ticket_sales', 'maintenance', 'driver_logs', 'ticketing_config', 
    'payroll_rubrics', 'role_configs', 'notifications', 'shifts', 'time_tracking', 
    'system_settings', 'imp_cards', 
    'imp_card_recharges', 'user_occurrences', 'traffic_violations', 'user_fines',
    'job_applications', 'job_vacancies', 'skins', 'trips_audit',
    'subscriptions'
  ],

  fetchAll: async <T>(table: TableName): Promise<T[]> => {
    console.info(`[DB_QUERY] Buscando dados da tabela: ${table}`);
    
    const isolatedTables = db.getIsolatedTables();

    let query = supabase.from(table).select('*');
    
    if (currentSystemId && isolatedTables.includes(table)) {
      query = query.eq('system_id', currentSystemId);
    } else if (isolatedTables.includes(table) && table !== 'routes' && table !== 'trips' && table !== 'companies' && table !== 'notices') {
      // Se a tabela exige isolamento e não temos system_id, retornamos vazio (exceto para itens públicos)
      console.warn(`[DB_WARN] Tentativa de buscar ${table} sem system_id definido. Retornando vazio.`);
      return [];
    }

    const { data, error } = await query;
    if (error) {
      console.error(`[DB_ERROR] Falha ao buscar ${table}:`, { message: error.message, details: error.details, hint: error.hint });
      throw error;
    }
    console.log(`[DB_SUCCESS] ${data?.length || 0} registros recuperados de ${table}`);
    return (data || []) as T[];
  },

  fetchAllGlobal: async <T>(table: TableName): Promise<T[]> => {
    console.info(`[DB_QUERY_GLOBAL] Buscando dados globais da tabela: ${table}`);
    const { data, error } = await supabase.from(table).select('*');
    if (error) {
      console.error(`[DB_ERROR_GLOBAL] Falha na busca global em ${table}:`, error);
      throw error;
    }
    return (data || []) as T[];
  },

  create: async <T extends { id?: string; system_id?: string }>(table: TableName, item: Partial<T>): Promise<T | null> => {
    console.info(`[DB_INSERT] Tentando inserir em ${table}:`, item);
    const forceId = item.id && (table === 'ticketing_config' || table === 'payroll_rubrics');
    const payload = cleanPayload(table, item, !!forceId);
    
    if (currentSystemId && !payload.system_id && db.getIsolatedTables().includes(table)) {
      payload.system_id = currentSystemId;
    }
    
    const { data, error } = await supabase.from(table).insert(payload).select().single();
    if (error) {
      console.error(`[DB_ERROR] Falha na inserção em ${table}:`, { message: error.message, details: error.details, payload });
      throw error;
    }
    console.log(`[DB_SUCCESS] Registro criado em ${table} com ID: ${data.id}`);
    return data as T;
  },

  update: async <T extends { id: string; system_id?: string }>(table: TableName, item: T): Promise<T | null> => {
    console.info(`[DB_UPDATE] Tentando atualizar ${table} ID: ${item.id}`);
    const payload = cleanPayload(table, item, true);
    
    let query = supabase.from(table).update(payload).eq('id', item.id);
    
    if (currentSystemId && db.getIsolatedTables().includes(table)) {
      query = query.eq('system_id', currentSystemId);
    }

    const { data, error } = await query.select().single();
    if (error) {
      console.error(`[DB_ERROR] Falha na atualização em ${table}:`, { message: error.message, details: error.details, payload });
      throw error;
    }
    console.log(`[DB_SUCCESS] Registro ${item.id} atualizado em ${table}`);
    return data as T;
  },

  delete: async (table: TableName, id: string): Promise<boolean> => {
    console.warn(`[DB_DELETE] Tentando excluir ID: ${id} da tabela: ${table}`);
    let query = supabase.from(table).delete().eq('id', id);
    
    if (currentSystemId && db.getIsolatedTables().includes(table)) {
      query = query.eq('system_id', currentSystemId);
    }

    const { error } = await query;
    if (error) {
      console.error(`[DB_ERROR] Falha ao excluir de ${table}:`, { message: error.message, details: error.details, id });
      throw error;
    }
    console.log(`[DB_SUCCESS] Registro ${id} removido permanentemente de ${table}`);
    return true;
  },

  clearTable: async (table: TableName): Promise<boolean> => {
    try {
      let query = supabase.from(table).delete().neq('id', '00000000-0000-0000-0000-000000000000');
      
      if (currentSystemId) {
        query = query.eq('system_id', currentSystemId);
      }

      const { error } = await query;
      if (error) throw error;
      return true;
    } catch (error) { return false; }
  },

  initializeRealtime: (onEvent: (table: string, payload: any) => void): RealtimeChannel => {
    const channel = supabase
      .channel('db-changes-v2')
      .on('postgres_changes', { event: 'INSERT', schema: 'public' }, (p) => {
        if (!currentSystemId || p.new.system_id === currentSystemId) onEvent(p.table, p);
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public' }, (p) => {
        if (!currentSystemId || p.new.system_id === currentSystemId) onEvent(p.table, p);
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public' }, (p) => {
        // For delete, we might not have the system_id in the payload easily if it's not in the 'old' record
        // But usually, the client will filter its own state
        onEvent(p.table, p);
      })
      .subscribe();
    return channel;
  },

  getUsers: () => db.fetchAll<User>('users'),
  getCities: () => db.fetchAll<City>('cities'),
  getRoutes: () => db.fetchAll<BusRoute>('routes'),
  getTrips: () => db.fetchAll<Trip>('trips'),
  getCompanies: () => db.fetchAll<Company>('companies'),
  getVehicles: () => db.fetchAll<Vehicle>('vehicles'),
  getReports: () => db.fetchAll<IssueReport>('occurrences'),
  getNotices: () => db.fetchAll<Notice>('notices'),
  getSales: () => db.fetchAll<TicketSale>('ticket_sales'),
  getInspections: () => db.fetchAll<Inspection>('driver_logs'),
  getTicketingConfig: () => db.fetchAll<TicketingConfig>('ticketing_config'),
  getRubrics: () => db.fetchAll<PayrollRubric>('payroll_rubrics'),
  getRoleConfigs: () => db.fetchAll<RoleConfig>('role_configs'),
  getNotifications: () => db.fetchAll<AppNotification>('notifications'),
  getShifts: () => db.fetchAll<Shift>('shifts'),
  getOccurrences: () => db.fetchAll<any>('user_occurrences'),
  getDriverLogs: () => db.fetchAll<any>('driver_logs'),
  getSystemSettings: () => db.fetchAll<SystemSettings>('system_settings'),
  getImpCards: () => db.fetchAll<any>('imp_cards'),
  getImpCardRecharges: () => db.fetchAll<any>('imp_card_recharges'),
  getTrafficViolations: () => db.fetchAll<any>('traffic_violations'),
  getUserFines: () => db.fetchAll<any>('user_fines'),
  getJobApplications: () => db.fetchAll<any>('job_applications'),
  getJobVacancies: () => db.fetchAll<any>('job_vacancies'),
  getSkins: () => db.fetchAll<any>('skins'),
  getTripsAudit: () => db.fetchAll<any>('trips_audit'),
  getActivationKeys: () => db.fetchAll<any>('activation_keys'),
  getSubscriptions: () => db.fetchAll<any>('subscriptions'),
  getAllUsers: () => db.fetchAllGlobal<User>('users'),
  getAllActivationKeys: () => db.fetchAllGlobal<any>('activation_keys'),
  getAllSubscriptions: () => db.fetchAllGlobal<any>('subscriptions'),
};
