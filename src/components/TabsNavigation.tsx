/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { 
  Home, 
  Scale, 
  Building2, 
  Building, 
  FileText, 
  Wallet, 
  SlidersHorizontal, 
  FileSpreadsheet, 
  ShieldCheck 
} from 'lucide-react';

export type TabId = 
  | 'OPERACAO' 
  | 'PRECO_FONTES' 
  | 'BANCO' 
  | 'VENDEDOR' 
  | 'CUSTOS' 
  | 'CAIXA' 
  | 'CENARIOS' 
  | 'MEMORIA' 
  | 'AUDITORIA';

interface TabsNavigationProps {
  abaAtiva: TabId;
  onSelecionarAba: (tab: TabId) => void;
  precoReconciliado: boolean;
  caixaInsuficiente: boolean;
}

export const TabsNavigation: React.FC<TabsNavigationProps> = ({
  abaAtiva,
  onSelecionarAba,
  precoReconciliado,
  caixaInsuficiente
}) => {
  const abas = [
    { id: 'OPERACAO' as TabId, label: '1. Imóvel', icon: Home },
    { 
      id: 'PRECO_FONTES' as TabId, 
      label: '2. Preço & Fontes', 
      icon: Scale,
      alerta: !precoReconciliado 
    },
    { id: 'BANCO' as TabId, label: '3. Banco (SAC/Price)', icon: Building2 },
    { id: 'VENDEDOR' as TabId, label: '4. Vendedor & Obra', icon: Building },
    { id: 'CUSTOS' as TabId, label: '5. Custos & Registro', icon: FileText },
    { 
      id: 'CAIXA' as TabId, 
      label: '6. Caixa Familiar', 
      icon: Wallet,
      alerta: caixaInsuficiente 
    },
    { id: 'CENARIOS' as TabId, label: '7. Cenários Estresse', icon: SlidersHorizontal },
    { id: 'MEMORIA' as TabId, label: '8. Memória de Cálculo', icon: FileSpreadsheet },
    { id: 'AUDITORIA' as TabId, label: '9. Auditoria & Testes', icon: ShieldCheck }
  ];

  return (
    <nav 
      aria-label="Navegação das Seções do Planejamento"
      className="bg-white border-b border-stone-200 overflow-x-auto"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex space-x-1 sm:space-x-2 py-2 min-w-max">
          {abas.map((tab) => {
            const Icon = tab.icon;
            const ativo = abaAtiva === tab.id;

            return (
              <button
                key={tab.id}
                id={`tab-btn-${tab.id}`}
                type="button"
                onClick={() => onSelecionarAba(tab.id)}
                className={`flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg transition relative ${
                  ativo
                    ? 'bg-amber-500 text-stone-950 shadow-xs'
                    : 'text-stone-600 hover:text-stone-900 hover:bg-stone-100'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 shrink-0 ${ativo ? 'text-stone-950' : 'text-stone-500'}`} />
                <span>{tab.label}</span>
                {tab.alerta && (
                  <span className="w-2 h-2 rounded-full bg-rose-500 shrink-0"></span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </nav>
  );
};
