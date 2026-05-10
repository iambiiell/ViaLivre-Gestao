
import React from 'react';
import { AlertTriangle, LogOut, PhoneCall } from 'lucide-react';
import { motion } from 'framer-motion';

interface SubscriptionExpiredProps {
  onLogout: () => void;
}

const SubscriptionExpired: React.FC<SubscriptionExpiredProps> = ({ onLogout }) => {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md w-full bg-white rounded-2xl shadow-xl border border-red-100 overflow-hidden"
      >
        <div className="bg-red-600 p-8 flex justify-center">
          <div className="bg-white/20 p-4 rounded-full backdrop-blur-sm">
            <AlertTriangle className="w-12 h-12 text-white" />
          </div>
        </div>
        
        <div className="p-8 text-center">
          <h1 className="text-2xl font-bold text-slate-900 mb-4">Acesso Suspenso</h1>
          <p className="text-slate-600 mb-8 leading-relaxed">
            A assinatura desta unidade do <span className="font-semibold text-slate-900">ViaLivre Gestão</span> expirou. 
            Entre em contato com o Administrador Full ou reative seu plano para continuar utilizando o sistema.
          </p>
          
          <div className="space-y-4">
            <button
              onClick={() => window.open('https://wa.me/5521999999999', '_blank')}
              className="w-full flex items-center justify-center gap-2 bg-slate-900 text-white py-3 rounded-xl font-medium hover:bg-slate-800 transition-colors"
            >
              <PhoneCall className="w-5 h-5" />
              Falar com Suporte
            </button>
            
            <button
              onClick={onLogout}
              className="w-full flex items-center justify-center gap-2 bg-white text-slate-600 py-3 rounded-xl font-medium border border-slate-200 hover:bg-slate-50 transition-colors"
            >
              <LogOut className="w-5 h-5" />
              Sair do Sistema
            </button>
          </div>
        </div>
        
        <div className="bg-slate-50 p-4 text-center border-t border-slate-100">
          <p className="text-xs text-slate-400 uppercase tracking-widest font-semibold">
            ViaLivre Gestão • Infraestrutura Digital
          </p>
        </div>
      </motion.div>
    </div>
  );
};

export default SubscriptionExpired;
