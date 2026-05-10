
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../services/database';
import { TicketSale, User, BusRoute } from '../types';

export const useTicketSales = (activeTripId: string | null, currentUser: User | null, activeRoute: BusRoute | null) => {
  const [sales, setSales] = useState<TicketSale[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [saleAlert, setSaleAlert] = useState<{ seat: number } | null>(null);

  const fetchSales = useCallback(async () => {
    if (!activeTripId) return;
    const { data, error } = await supabase.from('ticket_sales').select('*').eq('trip_id', activeTripId);
    if (!error && data) setSales(data);
  }, [activeTripId]);

  useEffect(() => {
    if (activeTripId) {
      fetchSales();
      const channel = supabase
        .channel(`trip_sales_${activeTripId}`)
        .on('postgres_changes', { 
            event: 'INSERT', 
            schema: 'public', 
            table: 'ticket_sales', 
            filter: `trip_id=eq.${activeTripId}` 
        }, (payload) => {
            const newSale = payload.new as TicketSale;
            setSales(prev => [...prev, newSale]);
            if (newSale.seat_number) {
                 setSaleAlert({ seat: newSale.seat_number });
                 setTimeout(() => setSaleAlert(null), 5000);
            }
        })
        .subscribe();
      
      return () => { channel.unsubscribe(); };
    }
  }, [activeTripId, fetchSales]);

  const processBordoSale = async (paymentMethod: string, selectedSectionIdx: number | null) => {
    if (!activeTripId || !paymentMethod) return;
    
    setIsLoading(true);
    try {
        const section = selectedSectionIdx !== null ? activeRoute?.sections?.[selectedSectionIdx] : null;
        const price = section ? section.price : (activeRoute?.price || 0);
        
        const newSale: any = {
            trip_id: activeTripId,
            system_id: currentUser?.system_id,
            passenger_name: 'PASSAGEIRO BORDO',
            payment_method: paymentMethod,
            total_paid: price,
            status: 'CONCLUIDO',
            created_at: new Date().toISOString(),
            route_id: activeRoute?.id,
            origin: section?.origin || activeRoute?.origin,
            destination: section?.destination || activeRoute?.destination
        };

        const { error } = await supabase.from('ticket_sales').insert(newSale);
        if (error) throw error;
        
        await fetchSales();
        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
    } finally {
        setIsLoading(false);
    }
  };

  return {
    sales,
    isLoading,
    saleAlert,
    fetchSales,
    processBordoSale
  };
};
