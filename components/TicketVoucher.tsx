import React from 'react';
import { TicketSale, BusRoute, Trip } from '../types';
import { ShieldAlert } from 'lucide-react';

interface TicketVoucherProps {
  type: 'passageiro' | 'motorista';
  lastTicket: TicketSale | null;
  selectedRoute: BusRoute | undefined;
  selectedTrip: Trip | undefined;
}

const TicketVoucher: React.FC<TicketVoucherProps> = ({ type, lastTicket, selectedRoute, selectedTrip }) => {
    if (!lastTicket) return null;
    const ticketId = lastTicket.id.slice(-8).toUpperCase();
    return (
        <div className="border-2 border-black p-8 mb-6 relative bg-white text-black font-mono page-break-avoid">
            <div className="flex justify-between items-start border-b-2 border-black pb-4 mb-4">
                <div className="flex gap-4 items-center">
                    <div className="w-20 h-20 bg-white flex items-center justify-center border-2 border-black rounded-xl overflow-hidden">
                        <img 
                            src="/Logo_ViaLivre.png" 
                            alt="Logo ViaLivre Gestão" 
                            className="w-[65px] h-auto object-contain"
                            referrerPolicy="no-referrer"
                            onError={(e) => {
                                (e.target as HTMLImageElement).src = "https://picsum.photos/seed/transport/200/200";
                            }}
                        />
                    </div>
                    <div>
                        <h2 className="text-xl font-black uppercase leading-none">{lastTicket.company_data?.name || 'VIALIVRE GESTÃO'}</h2>
                        <p className="text-[10px] uppercase mt-1">CNPJ: {lastTicket.company_data?.cnpj || '00.000.000/0001-99'}</p>
                        <p className="text-[10px] uppercase">IE: {(!lastTicket.company_data?.ie || lastTicket.company_data.ie.trim() === '') ? 'ISENTO' : lastTicket.company_data.ie}</p>
                        <p className="text-[8px] uppercase text-gray-500 mt-1 max-w-[250px]">{lastTicket.company_data?.address || 'ENDEREÇO NÃO CADASTRADO'}</p>
                    </div>
                </div>
                <div className="text-right">
                    <span className="px-3 py-1 bg-black text-white text-[10px] font-black uppercase mb-2 inline-block">
                        {type === 'passageiro' ? 'VIA PASSAGEIRO' : 'VIA MOTORISTA'}
                    </span>
                    <p className="text-2xl font-black">#{ticketId}</p>
                </div>
            </div>

            <div className="grid grid-cols-2 gap-8 mb-6">
                <div>
                    <p className="text-[9px] font-bold text-gray-500 uppercase">ORIGEM / DESTINO</p>
                    <p className="text-sm font-black uppercase italic">{selectedRoute?.origin} {" > "} {selectedRoute?.destination}</p>
                </div>
                <div className="text-right">
                    <p className="text-[9px] font-bold text-gray-500 uppercase">EMBARQUE</p>
                    <p className="text-sm font-black">{(lastTicket.trip_date || lastTicket.created_at.split('T')[0]).split('-').reverse().join('/')} às {selectedTrip?.departure_time || lastTicket.departure_time || '---'}</p>
                </div>
            </div>

            <div className="grid grid-cols-3 gap-4 border-y-2 border-black py-4 mb-6">
                <div className="text-center border-r-2 border-black">
                    <p className="text-[9px] font-bold uppercase">POLTRONA</p>
                    <p className="text-3xl font-black">{lastTicket.seat_number.toString().padStart(2, '0')}</p>
                </div>
                <div className="text-center border-r-2 border-black">
                    <p className="text-[9px] font-bold uppercase">CARRO</p>
                    <p className="text-3xl font-black">{(selectedTrip?.bus_number || lastTicket.is_presale) ? `#${selectedTrip?.bus_number || 'PRE'}` : '---'}</p>
                </div>
                <div className="text-center">
                    <p className="text-[9px] font-bold uppercase">TOTAL PAGO</p>
                    <p className="text-3xl font-black">R$ {lastTicket.total_price.toFixed(2)}</p>
                </div>
            </div>

            <div className="grid grid-cols-2 gap-x-8 gap-y-2 mb-6 border-b-2 border-black pb-4">
                <div className="flex justify-between text-[10px]">
                    <span className="font-bold uppercase">TARIFA:</span>
                    <span>R$ {(lastTicket.price_base || 0).toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-[10px]">
                    <span className="font-bold uppercase">PEDÁGIO:</span>
                    <span>R$ {(lastTicket.price_toll || 0).toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-[10px]">
                    <span className="font-bold uppercase">TAXA EMBARQUE:</span>
                    <span>R$ {(lastTicket.price_boarding_fee || 0).toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-[10px]">
                    <span className="font-bold uppercase">OUTRAS TAXAS:</span>
                    <span>R$ {(lastTicket.price_fees || 0).toFixed(2)}</span>
                </div>
                { (lastTicket.discount_value || 0) > 0 && (
                    <div className="flex justify-between text-[10px] text-red-600 col-span-2 border-t border-dashed border-gray-300 pt-2">
                        <span className="font-black uppercase italic">DESCONTO (CUPOM):</span>
                        <span className="font-black italic">- R$ {lastTicket.discount_value?.toFixed(2)}</span>
                    </div>
                )}
            </div>

            <div className="mb-6">
                <p className="text-[10px] font-black uppercase mb-1">PASSAGEIRO: {lastTicket.passenger_name}</p>
                <p className="text-[10px] uppercase">DOCUMENTO: {lastTicket.passenger_cpf} | PAGAMENTO: {lastTicket.payment_method}</p>
            </div>

            <div className="grid grid-cols-2 gap-x-8 gap-y-2 mb-6 border-t-2 border-black pt-4">
                <div className="flex justify-between text-[10px]">
                    <span className="font-bold uppercase">VEÍCULO:</span>
                    <span className="uppercase">{lastTicket.vehicle_model || '---'}</span>
                </div>
                <div className="flex justify-between text-[10px]">
                    <span className="font-bold uppercase">PREFIXO:</span>
                    <span className="uppercase">{lastTicket.vehicle_prefix || '---'}</span>
                </div>
            </div>

            <div className="bg-slate-50 p-4 border border-black rounded text-[9px] leading-tight">
                <p className="font-black mb-2 flex items-center gap-2"><ShieldAlert size={14}/> NORMAS E CONDIÇÕES DE VIAGEM:</p>
                {type === 'passageiro' ? (
                    <ul className="list-disc pl-4 space-y-1">
                        <li>Apresente este bilhete e documento original com foto para embarque.</li>
                        <li>Chegue à plataforma com pelo menos 30 minutos de antecedência.</li>
                        <li>O bilhete é pessoal e intransferível. Trocas até 3h antes da partida.</li>
                        <li>Bagagem: 30kg no bagageiro e 5kg no porta-embrulhos.</li>
                    </ul>
                ) : (
                    <ul className="list-disc pl-4 space-y-1">
                        <li>Conferir o documento do passageiro e coletar esta via no embarque.</li>
                        <li>Verificar integridade da poltrona e cinto de segurança.</li>
                        <li>Informar à central qualquer divergência de ocupação.</li>
                    </ul>
                )}
            </div>
            
            <div className="mt-6 flex justify-between items-center opacity-30">
                <div className="barcode-strip w-48 h-8 bg-black"></div>
                <p className="text-[8px] font-bold uppercase">Emitido via ViaLivre Gestão em {new Date().toLocaleString('pt-BR')}</p>
            </div>
        </div>
    );
};

export default TicketVoucher;
