
import React, { useState, useMemo } from 'react';
import { Company, User } from '../types';
import { Plus, Pencil, Trash2, X, Building2, Phone, Mail, Loader2, MapPin, Save, Search, AlertCircle, Copy } from 'lucide-react';
import { fetchAddress } from '../services/cep';
import { cnpjMask, phoneMask, cepMask, ieMask } from '../utils/masks';

interface CompanyManagerProps {
  companies: Company[];
  currentUser: User | null;
  onAddCompany: (company: Company) => void;
  onUpdateCompany: (company: Company) => void;
  onDeleteCompany: (id: string) => void;
}

const CompanyManager: React.FC<CompanyManagerProps> = ({ companies = [], onAddCompany, onUpdateCompany, onDeleteCompany }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isLoadingCep, setIsLoadingCep] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [errors, setErrors] = useState<Set<string>>(new Set());
  const [formData, setFormData] = useState<Partial<Company>>({ 
    active: true,
    name: '',
    razao_social: '',
    nome_fantasia: '',
    cnpj: '',
    ie: '',
    contact_email: '',
    contact_phone: ''
  });

  const filteredCompanies = useMemo(() => {
    return (companies || [])
      .filter(c => 
          (c.nome_fantasia || c.name || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
          (c.razao_social || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
          (c.cnpj || '').includes(searchTerm)
      )
      .sort((a, b) => (a.nome_fantasia || a.name || '').localeCompare(b.nome_fantasia || b.name || ''));
  }, [companies, searchTerm]);

  const handleOpenModal = (company?: Company) => {
    if (company) {
        setEditingId(company.id);
        setFormData({ ...company });
    } else {
        setEditingId(null);
        setFormData({ 
            active: true, name: '', razao_social: '', nome_fantasia: '', cnpj: '', ie: '', cep: '', 
            address_street: '', address_number: '', address_neighborhood: '', 
            address_city: '', address_state: '', address_complement: '',
            contact_email: '', contact_phone: ''
        });
    }
    setErrors(new Set());
    setIsModalOpen(true);
  };

  const handleDuplicate = (company: Company) => {
    setEditingId(null);
    setFormData({
        ...company,
        id: undefined,
        name: `${company.nome_fantasia || company.name} (Cópia)`,
        nome_fantasia: `${company.nome_fantasia || company.name} (Cópia)`,
        cnpj: '', 
    });
    setErrors(new Set());
    setIsModalOpen(true);
  };

  const handleCepChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = cepMask(e.target.value);
    setFormData(prev => ({ ...prev, cep: val }));
    const clean = val.replace(/\D/g, '');
    if (clean.length === 8) {
        setIsLoadingCep(true);
        try {
            const data = await fetchAddress(clean);
            if (data) {
                setFormData(prev => ({ 
                  ...prev, 
                  address_street: data.addressStreet, 
                  address_neighborhood: data.addressNeighborhood, 
                  address_city: data.addressCity, 
                  address_state: data.addressState 
                }));
            }
        } finally {
            setIsLoadingCep(false);
        }
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors = new Set<string>();
    if (!formData.razao_social) newErrors.add('razao_social');
    if (!formData.nome_fantasia) newErrors.add('nome_fantasia');
    if (!formData.cnpj) newErrors.add('cnpj');
    if (!formData.contact_phone) newErrors.add('contact_phone');
    if (!formData.contact_email) newErrors.add('contact_email');
    if (!formData.cep) newErrors.add('cep');
    if (!formData.address_number) newErrors.add('address_number');

    if (newErrors.size > 0) {
        setErrors(newErrors);
        return;
    }
    
    const companyData = { 
      ...formData,
      name: formData.nome_fantasia || formData.razao_social || '' 
    } as Company;
    if (editingId) {
      onUpdateCompany({ ...companyData, id: editingId });
    } else {
      onAddCompany(companyData);
    }
    setIsModalOpen(false);
  };

  const inputClass = (field: string) => `w-full px-5 py-4 border-2 rounded-2xl font-bold bg-slate-50 dark:bg-zinc-900 text-slate-900 dark:text-zinc-100 outline-none transition-all ${errors.has(field) ? 'border-red-500 animate-shake' : 'border-slate-100 dark:border-zinc-800 focus:border-blue-500'}`;

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-white dark:bg-zinc-900 p-8 rounded-[2.5rem] shadow-sm border border-slate-100 dark:border-zinc-800 transition-colors gap-4">
        <div className="flex-1 w-full">
            <h2 className="text-3xl font-black text-slate-800 dark:text-zinc-100 uppercase italic">Empresas</h2>
            <div className="mt-6 relative max-w-md">
                <Search className="absolute left-4 top-4 text-slate-400" size={18} />
                <input 
                    type="text" 
                    placeholder="Pesquisar por nome ou CNPJ..." 
                    className="w-full pl-12 pr-4 py-4 rounded-2xl bg-slate-50 dark:bg-zinc-800 border-none text-[10px] font-black uppercase outline-none dark:text-zinc-300 shadow-inner transition-all"
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                />
            </div>
        </div>
        <button onClick={() => handleOpenModal()} className="bg-blue-600 text-white px-8 py-4 rounded-2xl font-black uppercase text-[10px] tracking-widest flex items-center gap-2 shadow-xl hover:bg-blue-700 active:scale-95 transition-all"><Plus size={20} /> Nova Empresa</button>
      </div>

      <div className="flex overflow-x-auto pb-6 gap-6 snap-x snap-mandatory md:grid md:grid-cols-2 lg:grid-cols-3 md:overflow-x-visible md:pb-0 md:snap-none custom-scrollbar">
        {filteredCompanies.map(company => (
          <div key={company.id} className="min-w-[280px] sm:min-w-[320px] md:min-w-0 snap-center flex-1">
            <div className="bg-white dark:bg-zinc-900 p-6 rounded-[2.5rem] border border-slate-100 dark:border-zinc-800 shadow-sm group hover:shadow-xl transition-all relative overflow-hidden h-full flex flex-col">
            <div className={`absolute top-0 right-0 w-2 h-full ${company.active ? 'bg-green-500' : 'bg-slate-300'}`} />
            <div className="flex items-center gap-4 mb-6">
               <div className="w-14 h-14 bg-indigo-50 dark:bg-indigo-900/10 rounded-2xl flex items-center justify-center text-indigo-600 shadow-inner transition-colors"><Building2 size={28} /></div>
               <div>
                   <h3 className="font-black text-slate-800 dark:text-zinc-100 uppercase text-xs truncate max-w-[150px] transition-colors">{company.nome_fantasia || company.name}</h3>
                   <p className="text-[7px] font-black text-slate-400 uppercase truncate max-w-[150px]">{company.razao_social}</p>
                   <div className="flex flex-col mt-1">
                       <span className="text-[8px] font-mono text-slate-400 dark:text-zinc-500 transition-colors">CNPJ: {company.cnpj}</span>
                       <span className="text-[8px] font-mono text-slate-400 dark:text-zinc-500 transition-colors">IE: {company.ie || '---'}</span>
                   </div>
               </div>
            </div>
            <div className="space-y-1 text-[9px] text-slate-500 dark:text-zinc-400 font-bold uppercase transition-colors flex-1">
                <p className="flex items-center gap-1"><MapPin size={12}/> {company.address_neighborhood}, {company.address_city} - {company.address_state}</p>
                <p className="flex items-center gap-1"><Phone size={12}/> {company.contact_phone}</p>
                <p className="flex items-center gap-1"><Mail size={12}/> {company.contact_email}</p>
            </div>
            <div className="flex gap-2 pt-4 border-t border-slate-50 dark:border-zinc-800 justify-end transition-colors items-center mt-4">
                <button onClick={() => handleDuplicate(company)} title="Duplicar Cadastro" className="p-3 text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/10 rounded-xl transition-all"><Copy size={18} /></button>
                <button onClick={() => handleOpenModal(company)} className="p-3 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/10 rounded-xl transition-all"><Pencil size={18} /></button>
                
                {deletingId === company.id ? (
                  <div className="flex gap-2 animate-in fade-in slide-in-from-right-2">
                    <button 
                      onClick={() => { onDeleteCompany(company.id); setDeletingId(null); }} 
                      className="px-4 py-2 bg-red-600 text-white text-[9px] font-black uppercase rounded-xl shadow-lg active:scale-95 transition-all"
                    >
                      Confirmar
                    </button>
                    <button 
                      onClick={() => setDeletingId(null)} 
                      className="px-4 py-2 bg-slate-100 dark:bg-zinc-800 text-slate-500 dark:text-zinc-400 text-[9px] font-black uppercase rounded-xl hover:bg-slate-200 transition-all"
                    >
                      Não
                    </button>
                  </div>
                ) : (
                  <button 
                    onClick={() => setDeletingId(company.id)} 
                    className="p-3 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/10 rounded-xl transition-all"
                    title="Excluir Empresa"
                  >
                    <Trash2 size={18} />
                  </button>
                )}
            </div>
          </div>
        </div>
        ))}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 dark:bg-black/70 z-[120] flex items-center justify-center p-4 backdrop-blur-md animate-in zoom-in duration-300">
          <div className="bg-white dark:bg-zinc-950 w-full max-w-2xl rounded-[3rem] shadow-2xl flex flex-col max-h-[92vh] border dark:border-zinc-800 overflow-hidden transition-colors">
            <div className="p-8 border-b dark:border-zinc-800 bg-slate-50 dark:bg-zinc-900 flex justify-between items-center transition-colors">
                <h3 className="text-xl font-black text-slate-900 dark:text-zinc-100 uppercase italic leading-none">{editingId ? 'Editar Empresa' : 'Nova Empresa'}</h3>
                <button onClick={() => setIsModalOpen(false)} className="text-slate-400 dark:text-zinc-500 hover:rotate-90 transition-transform"><X size={32} /></button>
            </div>
            <form onSubmit={handleSubmit} className="p-8 space-y-6 overflow-y-auto custom-scrollbar bg-white dark:bg-zinc-950 transition-colors flex-1">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <label className="block text-[10px] font-black text-black uppercase mb-1 ml-2">Razão Social *</label>
                        <input className={inputClass('razao_social')} value={formData.razao_social || ''} onChange={e => setFormData({...formData, razao_social: e.target.value})} placeholder={errors.has('razao_social') ? "Campo obrigatório!" : "Ex: Expresso do Sul Ltda"} />
                    </div>
                    <div>
                        <label className="block text-[10px] font-black text-black uppercase mb-1 ml-2">Nome Fantasia *</label>
                        <input className={inputClass('nome_fantasia')} value={formData.nome_fantasia || ''} onChange={e => setFormData({...formData, nome_fantasia: e.target.value})} placeholder={errors.has('nome_fantasia') ? "Campo obrigatório!" : "Ex: Expresso do Sul"} />
                    </div>
                    <div>
                        <label className="block text-[10px] font-black text-black uppercase mb-1 ml-2">CNPJ *</label>
                        <input className={inputClass('cnpj')} value={formData.cnpj || ''} onChange={e => setFormData({...formData, cnpj: cnpjMask(e.target.value)})} placeholder="00.000.000/0000-00" />
                    </div>
                    <div>
                        <label className="block text-[10px] font-black text-black uppercase mb-1 ml-2">Inscrição Estadual (IE)</label>
                        <input className="w-full px-5 py-4 border-2 border-slate-100 dark:border-zinc-800 rounded-2xl font-bold bg-slate-50 dark:bg-zinc-900 text-slate-900 dark:text-zinc-100 outline-none focus:border-blue-500 transition-all" value={formData.ie || ''} onChange={e => setFormData({...formData, ie: ieMask(e.target.value)})} placeholder="00.000.00-0" />
                    </div>
                    <div>
                        <label className="block text-[10px] font-black text-black uppercase mb-1 ml-2">Telefone *</label>
                        <input className={inputClass('contact_phone')} value={formData.contact_phone || ''} onChange={e => setFormData({...formData, contact_phone: phoneMask(e.target.value)})} placeholder="(00) 0 0000-0000" />
                    </div>
                    <div className="col-span-full">
                        <label className="block text-[10px] font-black text-black uppercase mb-1 ml-2">E-mail Operacional *</label>
                        <input type="email" className={inputClass('contact_email')} value={formData.contact_email || ''} onChange={e => setFormData({...formData, contact_email: e.target.value})} placeholder="email@empresa.com.br" />
                    </div>
                    <div className="relative">
                        <label className="block text-[10px] font-black text-black uppercase mb-1 ml-2">CEP *</label>
                        <input className={inputClass('cep')} value={formData.cep || ''} onChange={handleCepChange} placeholder="00.000-000" />
                        {isLoadingCep && <Loader2 className="absolute right-4 top-10 animate-spin text-blue-500" size={20}/>}
                    </div>
                    <div>
                        <label className="block text-[10px] font-black text-black uppercase mb-1 ml-2">Número *</label>
                        <input className={inputClass('address_number')} value={formData.address_number || ''} onChange={e => setFormData({...formData, address_number: e.target.value})} placeholder="Ex: 123" />
                    </div>
                    <div className="col-span-full">
                        <label className="block text-[10px] font-black text-black uppercase mb-1 ml-2">Logradouro</label>
                        <input className="w-full px-5 py-4 border-2 border-slate-100 dark:border-zinc-800 rounded-2xl font-bold bg-slate-50 dark:bg-zinc-900 text-slate-900 dark:text-zinc-100 outline-none" value={formData.address_street || ''} onChange={e => setFormData({...formData, address_street: e.target.value})} />
                    </div>
                    <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase mb-1 ml-2">Bairro</label>
                        <input className="w-full px-5 py-4 border-2 border-slate-100 dark:border-zinc-800 rounded-2xl font-bold bg-slate-50 dark:bg-zinc-900 text-slate-900 dark:text-zinc-100 outline-none" value={formData.address_neighborhood || ''} onChange={e => setFormData({...formData, address_neighborhood: e.target.value})} />
                    </div>
                    <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase mb-1 ml-2">Cidade</label>
                        <input className="w-full px-5 py-4 border-2 border-slate-100 dark:border-zinc-800 rounded-2xl font-bold bg-slate-50 dark:bg-zinc-900 text-slate-900 dark:text-zinc-100 outline-none" value={formData.address_city || ''} onChange={e => setFormData({...formData, address_city: e.target.value})} />
                    </div>
                </div>
                <div className="p-8 border-t dark:border-zinc-800 bg-slate-50 dark:bg-zinc-900 flex gap-4 transition-colors">
                    <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 py-4 text-slate-400 font-black uppercase text-[10px] tracking-widest transition-all">Cancelar</button>
                    <button type="submit" className="flex-[2] py-4 bg-blue-600 text-white rounded-[2rem] font-black uppercase text-xs shadow-xl active:scale-95 flex items-center justify-center gap-2 hover:bg-blue-700 transition-all transition-colors"><Save size={20}/> Salvar Empresa</button>
                </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default CompanyManager;
