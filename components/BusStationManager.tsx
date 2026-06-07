import React, { useState, useMemo } from 'react';
import { BusStation, User } from '../types';
import { Plus, Trash2, MapPin, AlertTriangle, Loader2, X, Pencil, Search, Save, Building2, Tag, Layers } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cepMask } from '../utils/masks';
import { fetchAddress } from '../services/cep';

interface BusStationManagerProps {
  busStations: BusStation[];
  currentUser: User | null;
  onAddStation: (station: Partial<BusStation>) => void;
  onUpdateStation: (station: BusStation) => void;
  onDeleteStation: (id: string) => void;
  addToast: (message: string, type?: 'success' | 'error' | 'warning') => void;
}

const BusStationManager: React.FC<BusStationManagerProps> = ({ 
  busStations = [], 
  onAddStation, 
  onUpdateStation, 
  onDeleteStation, 
  addToast 
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  
  const [name, setName] = useState('');
  const [cep, setCep] = useState('');
  const [logradouro, setLogradouro] = useState('');
  const [bairro, setBairro] = useState('');
  const [cidade, setCidade] = useState('');
  const [estado, setEstado] = useState('');
  const [number, setNumber] = useState('');
  const [complement, setComplement] = useState('');
  const [isLoadingCep, setIsLoadingCep] = useState(false);
  const [platforms, setPlatforms] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  const filteredStations = useMemo(() => {
    return (busStations || [])
      .filter(s => 
        (s.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (s.address || '').toLowerCase().includes(searchTerm.toLowerCase())
      )
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [busStations, searchTerm]);

  const parseStoredAddress = (addr: string) => {
    let cepVal = '';
    let logVal = '';
    let barVal = '';
    let cidVal = '';
    let estVal = '';
    let numVal = '';
    let compVal = '';

    if (!addr) {
      return { cepVal, logVal, barVal, cidVal, estVal, numVal, compVal };
    }

    if (!addr.toUpperCase().includes('CEP:')) {
      logVal = addr;
      return { cepVal, logVal, barVal, cidVal, estVal, numVal, compVal };
    }

    // Extract CEP
    const cepMatch = addr.match(/CEP:\s*(\d{5}-?\d{3})/i);
    if (cepMatch) {
      cepVal = cepMatch[1];
      addr = addr.replace(/,\s*CEP:\s*\d{5}-?\d{3}/i, '').replace(/CEP:\s*\d{5}-?\d{3}/i, '');
    }

    const parts = addr.split(',');
    if (parts.length >= 2) {
      const lastPart = parts[parts.length - 1].trim(); 
      const firstPart = parts.slice(0, parts.length - 1).join(',').trim(); 

      if (lastPart.includes('-')) {
        const subParts = lastPart.split('-');
        estVal = subParts[subParts.length - 1].trim();
        cidVal = subParts.slice(0, subParts.length - 1).join('-').trim();
      } else {
        cidVal = lastPart;
      }

      const subParts1 = firstPart.split(',');
      if (subParts1.length >= 2) {
        logVal = subParts1[0].trim();
        const rest = subParts1.slice(1).join(',').trim(); 
        const dashParts = rest.split('-').map(x => x.trim());
        if (dashParts.length === 1) {
          if (/^\d+/.test(dashParts[0])) {
            numVal = dashParts[0];
          } else {
            barVal = dashParts[0];
          }
        } else if (dashParts.length === 2) {
          numVal = dashParts[0];
          barVal = dashParts[1];
        } else if (dashParts.length >= 3) {
          numVal = dashParts[0];
          compVal = dashParts.slice(1, dashParts.length - 1).join(' - ');
          barVal = dashParts[dashParts.length - 1];
        }
      } else {
        const dashParts = firstPart.split('-').map(x => x.trim());
        if (dashParts.length >= 2) {
          logVal = dashParts[0].trim();
          barVal = dashParts[dashParts.length - 1].trim();
          if (dashParts.length > 2) {
            compVal = dashParts.slice(1, dashParts.length - 1).join(' - ').trim();
          }
        } else {
          logVal = firstPart;
        }
      }
    } else {
      logVal = addr;
    }

    return {
      cepVal,
      logVal,
      barVal,
      cidVal,
      estVal,
      numVal,
      compVal
    };
  };

  const handleOpenModal = (station?: BusStation) => {
    if (station) { 
      setEditingId(station.id); 
      setName(station.name); 
      const parsed = parseStoredAddress(station.address);
      setCep(parsed.cepVal);
      setLogradouro(parsed.logVal);
      setBairro(parsed.barVal);
      setCidade(parsed.cidVal);
      setEstado(parsed.estVal);
      setNumber(parsed.numVal);
      setComplement(parsed.compVal);
      setPlatforms(station.platforms);
    } 
    else { 
      setEditingId(null); 
      setName(''); 
      setCep('');
      setLogradouro('');
      setBairro('');
      setCidade('');
      setEstado('');
      setNumber('');
      setComplement('');
      setPlatforms('');
    }
    setIsModalOpen(true);
  };

  const handleCepChangeLocal = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = cepMask(e.target.value);
    setCep(val);
    
    const clean = val.replace(/\D/g, '');
    if (clean.length === 8) {
      setIsLoadingCep(true);
      try {
        const data = await fetchAddress(clean);
        if (data) {
          setLogradouro(data.addressStreet || '');
          setBairro(data.addressNeighborhood || '');
          setCidade(data.addressCity || '');
          setEstado(data.addressState || '');
        } else {
          addToast("CEP não encontrado.", "warning");
        }
      } catch (err) {
        addToast("Erro ao buscar CEP.", "error");
        console.error("Erro ao buscar CEP:", err);
      } finally {
        setIsLoadingCep(false);
      }
    }
  };

  const handleSave = () => {
    if (!name.trim() || !platforms.trim()) {
      addToast("Preencha o Nome e ao menos uma Plataforma.", "error");
      return;
    }
    if (!cep.trim() || !logradouro.trim() || !bairro.trim() || !cidade.trim() || !estado.trim() || !number.trim()) {
      addToast("Preencha todos os campos obrigatórios do endereço (CEP, Logradouro, Número, Bairro, Cidade e Estado).", "error");
      return;
    }
    
    const combinedAddress = `${logradouro}, ${number}${complement ? ` - ${complement}` : ''} - ${bairro}, ${cidade} - ${estado}, CEP: ${cep}`;
    
    const stationData: Partial<BusStation> = { 
      name: name.trim(), 
      address: combinedAddress, 
      platforms: platforms.trim() 
    };
    
    if (editingId) {
      onUpdateStation({ ...stationData, id: editingId } as BusStation);
    } else {
      onAddStation(stationData);
    }
    setIsModalOpen(false);
  };

  return (
    <div className="space-y-6">
      {/* Header and Search */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-white dark:bg-zinc-900 p-8 rounded-[2.5rem] shadow-sm border border-slate-100 dark:border-zinc-800 gap-4 transition-colors">
        <div className="flex-1 w-full">
          <h2 className="text-3xl font-black text-black dark:text-zinc-100 tracking-tighter uppercase italic leading-none transition-colors">Rodoviárias Conveniadas</h2>
          <div className="mt-6 relative max-w-md">
            <Search className="absolute left-4 top-4 text-slate-400" size={18} />
            <input 
              type="text" 
              placeholder="Pesquisar rodoviária ou endereço..." 
              className="w-full pl-12 pr-4 py-4 rounded-2xl bg-slate-50 dark:bg-zinc-800 border-none text-[10px] font-black uppercase outline-none shadow-inner dark:text-zinc-300 transition-all"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
        <button 
          onClick={() => handleOpenModal()} 
          className="px-6 py-4 bg-yellow-400 hover:bg-yellow-500 text-slate-900 font-extrabold text-[10px] uppercase rounded-2xl flex items-center gap-2 border-2 border-slate-950 transition-colors shadow-lg self-stretch md:self-auto justify-center select-none cursor-pointer"
        >
          <Plus size={16} /> Nova Rodoviária
        </button>
      </div>

      {/* Grid List */}
      {filteredStations.length === 0 ? (
        <div className="bg-white dark:bg-zinc-900 p-16 rounded-[2.5rem] border border-slate-100 dark:border-zinc-800 text-center uppercase tracking-tighter transition-colors">
          <Building2 className="mx-auto text-slate-300 dark:text-zinc-700 mb-4" size={48} />
          <h3 className="text-xl font-black text-slate-400 dark:text-zinc-500">Nenhuma Rodoviária Cadastrada</h3>
          <p className="mt-2 text-xs text-slate-400">Clique em "Nova Rodoviária" acima para adicionar.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredStations.map((station) => (
            <motion.div 
              layout
              key={station.id}
              className="bg-white dark:bg-zinc-900 p-6 rounded-[2rem] border border-slate-100 dark:border-zinc-800 flex flex-col justify-between shadow-sm hover:shadow-md transition-all relative overflow-hidden group"
            >
              <div className="space-y-4">
                <div className="flex justify-between items-start gap-4">
                  <div className="p-3 bg-red-100 dark:bg-red-950/50 rounded-2xl text-red-600 dark:text-red-400">
                    <Building2 size={24} />
                  </div>
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => handleOpenModal(station)} 
                      className="p-2 bg-slate-50 dark:bg-zinc-800 hover:bg-slate-100 dark:hover:bg-zinc-700 text-slate-600 dark:text-zinc-300 rounded-xl transition-all cursor-pointer"
                    >
                      <Pencil size={14} />
                    </button>
                    <button 
                      onClick={() => setDeletingId(station.id)} 
                      className="p-2 bg-red-50 dark:bg-red-950/20 hover:bg-red-100 dark:hover:bg-red-900/50 text-red-500 rounded-xl transition-all cursor-pointer"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>

                <div>
                  <h4 className="text-lg font-black text-slate-800 dark:text-white leading-none tracking-tight">{station.name}</h4>
                  <div className="mt-3 flex items-start gap-2 text-slate-500 dark:text-zinc-400">
                    <MapPin size={14} className="mt-0.5 shrink-0" />
                    <span className="text-[10px] font-black leading-tight">{station.address}</span>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-50 dark:border-zinc-800/50">
                  <span className="text-[8px] font-black text-slate-400 uppercase tracking-wider block mb-2">Plataformas Disponíveis:</span>
                  <div className="flex flex-wrap gap-1.5">
                    {station.platforms.split(',').map((p, idx) => (
                      <span 
                        key={idx} 
                        className="px-2.5 py-1 bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 text-[8px] font-black rounded-lg border border-slate-200 dark:border-zinc-700"
                      >
                        {p.trim()}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Save Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white dark:bg-zinc-900 w-full max-w-xl rounded-[2.5rem] overflow-hidden border border-slate-100 dark:border-zinc-800 shadow-2xl flex flex-col"
            >
              <div className="flex justify-between items-center p-8 border-b border-slate-50 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-900">
                <h3 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tighter">
                  {editingId ? 'Editar Rodoviária' : 'Adicionar Rodoviária'}
                </h3>
                <button 
                  onClick={() => setIsModalOpen(false)} 
                  className="p-2 bg-white dark:bg-zinc-800 border dark:border-zinc-700 rounded-full text-slate-400 dark:text-zinc-300 hover:text-slate-600 dark:hover:text-white cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="p-8 space-y-6 overflow-y-auto max-h-[70vh]">
                <div>
                  <label className="block text-[10px] font-black text-slate-400 dark:text-zinc-500 uppercase mb-1 ml-2">Nome Comercial *</label>
                  <input 
                    type="text" 
                    placeholder="Ex: Rodoviária de Belo Horizonte" 
                    value={name} 
                    onChange={e => setName(e.target.value)}
                    className="w-full px-5 py-4 border-2 border-slate-200 dark:border-zinc-800 rounded-2xl font-bold bg-slate-50 dark:bg-zinc-900 dark:text-zinc-100 placeholder:text-slate-300 outline-none focus:border-yellow-400 transition-all text-xs"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 dark:text-zinc-500 uppercase mb-1 ml-2 flex items-center justify-between">
                      <span>CEP *</span>
                      {isLoadingCep && <Loader2 size={12} className="animate-spin text-yellow-500 animate" />}
                    </label>
                    <input 
                      type="text" 
                      placeholder="00000-000" 
                      value={cep} 
                      onChange={handleCepChangeLocal}
                      className="w-full px-5 py-4 border-2 border-slate-200 dark:border-zinc-800 rounded-2xl font-bold bg-slate-50 dark:bg-zinc-900 dark:text-zinc-100 placeholder:text-slate-300 outline-none focus:border-yellow-400 transition-all text-xs"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-black text-slate-400 dark:text-zinc-500 uppercase mb-1 ml-2">UF / Estado *</label>
                    <input 
                      type="text" 
                      placeholder="Ex: MG" 
                      value={estado} 
                      onChange={e => setEstado(e.target.value)}
                      className="w-full px-5 py-4 border-2 border-slate-200 dark:border-zinc-800 rounded-2xl font-bold bg-slate-50 dark:bg-zinc-900 dark:text-zinc-100 placeholder:text-slate-300 outline-none focus:border-yellow-400 transition-all text-xs"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="md:col-span-2">
                    <label className="block text-[10px] font-black text-slate-400 dark:text-zinc-500 uppercase mb-1 ml-2">Logradouro *</label>
                    <input 
                      type="text" 
                      placeholder="Ex: Avenida do Contorno" 
                      value={logradouro} 
                      onChange={e => setLogradouro(e.target.value)}
                      className="w-full px-5 py-4 border-2 border-slate-200 dark:border-zinc-800 rounded-2xl font-bold bg-slate-50 dark:bg-zinc-900 dark:text-zinc-100 placeholder:text-slate-300 outline-none focus:border-yellow-400 transition-all text-xs"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-black text-slate-400 dark:text-zinc-500 uppercase mb-1 ml-2">Número *</label>
                    <input 
                      type="text" 
                      placeholder="Ex: 123" 
                      value={number} 
                      onChange={e => setNumber(e.target.value)}
                      className="w-full px-5 py-4 border-2 border-slate-200 dark:border-zinc-800 rounded-2xl font-bold bg-slate-50 dark:bg-zinc-900 dark:text-zinc-100 placeholder:text-slate-300 outline-none focus:border-yellow-400 transition-all text-xs"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 dark:text-zinc-500 uppercase mb-1 ml-2">Complemento (Opcional)</label>
                    <input 
                      type="text" 
                      placeholder="Ex: Sala A" 
                      value={complement} 
                      onChange={e => setComplement(e.target.value)}
                      className="w-full px-5 py-4 border-2 border-slate-200 dark:border-zinc-800 rounded-2xl font-bold bg-slate-50 dark:bg-zinc-900 dark:text-zinc-100 placeholder:text-slate-300 outline-none focus:border-yellow-400 transition-all text-xs"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-black text-slate-400 dark:text-zinc-500 uppercase mb-1 ml-2">Bairro *</label>
                    <input 
                      type="text" 
                      placeholder="Ex: Centro" 
                      value={bairro} 
                      onChange={e => setBairro(e.target.value)}
                      className="w-full px-5 py-4 border-2 border-slate-200 dark:border-zinc-800 rounded-2xl font-bold bg-slate-50 dark:bg-zinc-900 dark:text-zinc-100 placeholder:text-slate-300 outline-none focus:border-yellow-400 transition-all text-xs"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-black text-slate-400 dark:text-zinc-500 uppercase mb-1 ml-2">Cidade *</label>
                    <input 
                      type="text" 
                      placeholder="Ex: Belo Horizonte" 
                      value={cidade} 
                      onChange={e => setCidade(e.target.value)}
                      className="w-full px-5 py-4 border-2 border-slate-200 dark:border-zinc-800 rounded-2xl font-bold bg-slate-50 dark:bg-zinc-900 dark:text-zinc-100 placeholder:text-slate-300 outline-none focus:border-yellow-400 transition-all text-xs"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-black text-slate-400 dark:text-zinc-500 uppercase mb-1 ml-2">Plataformas (separadas por vírgula) *</label>
                  <input 
                    type="text" 
                    placeholder="Ex: Plataforma 1, Plataforma 2" 
                    value={platforms} 
                    onChange={e => setPlatforms(e.target.value)}
                    className="w-full px-5 py-4 border-2 border-slate-200 dark:border-zinc-800 rounded-2xl font-bold bg-slate-50 dark:bg-zinc-900 dark:text-zinc-100 placeholder:text-slate-300 outline-none focus:border-yellow-400 transition-all text-xs"
                  />
                  <p className="mt-2 text-[8px] font-black text-slate-400 uppercase ml-2 italic">Estas plataformas serão usadas para configurar os itinerários/rotas e serão exibidas nas passagens baixadas.</p>
                </div>
              </div>

              <div className="flex justify-end gap-3 p-8 border-t border-slate-50 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-900/50">
                <button 
                  onClick={() => setIsModalOpen(false)} 
                  className="px-6 py-4 bg-white dark:bg-zinc-800 border-2 border-slate-200 dark:border-zinc-700 text-slate-700 dark:text-zinc-300 font-extrabold text-[10px] uppercase rounded-2xl cursor-pointer"
                >
                  Cancelar
                </button>
                <button 
                  onClick={handleSave} 
                  className="px-6 py-4 bg-yellow-400 hover:bg-yellow-500 text-slate-900 font-extrabold text-[10px] uppercase rounded-2xl border-2 border-slate-950 flex items-center gap-2 select-none cursor-pointer"
                >
                  <Save size={14} /> Salvar Alterações
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {deletingId && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white dark:bg-zinc-900 w-full max-w-md rounded-[2.5rem] p-8 border border-slate-100 dark:border-zinc-800 shadow-2xl flex flex-col text-center"
            >
              <div className="w-16 h-16 bg-red-100 dark:bg-red-950/50 text-red-600 dark:text-red-400 rounded-full flex items-center justify-center mx-auto mb-6">
                <AlertTriangle size={32} />
              </div>
              <h3 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tighter leading-none mb-2">Excluir Rodoviária?</h3>
              <p className="text-xs text-slate-500 mb-8 uppercase font-bold">Esta ação é irreversível e pode afetar itinerários já vinculados a esta estação.</p>
              
              <div className="flex gap-3 justify-center">
                <button 
                  onClick={() => setDeletingId(null)} 
                  className="px-6 py-4 bg-slate-50 dark:bg-zinc-800 border-2 border-slate-200 dark:border-zinc-700 text-slate-700 dark:text-zinc-300 font-extrabold text-[10px] uppercase rounded-2xl cursor-pointer"
                >
                  Cancelar
                </button>
                <button 
                  onClick={() => {
                    onDeleteStation(deletingId);
                    setDeletingId(null);
                  }} 
                  className="px-6 py-4 bg-red-600 hover:bg-red-700 text-white font-extrabold text-[10px] uppercase rounded-2xl border-2 border-red-950 select-none cursor-pointer"
                >
                  Excluir Definitivamente
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default BusStationManager;
