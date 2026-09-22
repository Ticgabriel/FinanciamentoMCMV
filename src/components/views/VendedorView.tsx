/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { ProjetoFinanciamento, ObrigacaoVendedor, TipoObrigacaoVendedor } from '../../types';
import { toReais } from '../../domain/financial';
import { DescontosBonusCard } from '../DescontosBonusCard';
import { 
  Building, 
  Calendar, 
  Plus, 
  Trash2, 
  AlertCircle, 
  TrendingUp, 
  CheckCircle2 
} from 'lucide-react';

interface VendedorViewProps {
  projeto: ProjetoFinanciamento;
  onAtualizarProjeto: (p: ProjetoFinanciamento) => void;
}

export const VendedorView: React.FC<VendedorViewProps> = ({ projeto, onAtualizarProjeto }) => {
  const obrigacoes = projeto.obrigacoesVendedor;
  const totalBaseCentavos = obrigacoes.reduce((acc, o) => acc + o.valorBaseCentavos, 0);

  const handleAtualizarObrigacao = (id: string, updates: Partial<ObrigacaoVendedor>) => {
    const novas = obrigacoes.map(o => o.id === id ? { ...o, ...updates } : o);
    onAtualizarProjeto({
      ...projeto,
      obrigacoesVendedor: novas
    });
  };

  const handleAdicionarObrigacao = () => {
    const nova: ObrigacaoVendedor = {
      id: `ob_${Date.now()}`,
      descricao: 'Nova Parcela / Balão',
      tipo: 'BALAO_SEMESTRAL',
      valorBaseCentavos: 1000000,
      vencimento: projeto.dataBase,
      pagoAntecipado: false,
      indiceCorrecao: 'INCC',
      taxaJurosMensalPercent: 0,
      status: 'CONFIRMADO'
    };
    onAtualizarProjeto({
      ...projeto,
      obrigacoesVendedor: [...obrigacoes, nova]
    });
  };

  const handleRemoverObrigacao = (id: string) => {
    onAtualizarProjeto({
      ...projeto,
      obrigacoesVendedor: obrigacoes.filter(o => o.id !== id)
    });
  };

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="border-b border-stone-200 pb-4">
        <h2 className="text-xl font-bold tracking-tight text-stone-900 flex items-center gap-2">
          <Building className="w-5 h-5 text-amber-600" />
          4. Obrigações com o Vendedor & Construtora
        </h2>
        <p className="text-sm text-stone-600 mt-1">
          Agenda de compromissos diretos: sinal, parcelas durante a obra, balões intermediários, parcela das chaves e repasse final.
        </p>
      </div>

      {/* Resumo da Dívida com o Vendedor */}
      <div className="bg-white p-5 rounded-xl border border-stone-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="text-xs text-stone-500 uppercase tracking-wider font-semibold block">
            Total em Obrigações-Base com o Vendedor
          </span>
          <div className="text-2xl font-bold tracking-tight text-stone-900 mt-0.5">
            {toReais(totalBaseCentavos)}
          </div>
          <p className="text-xs text-stone-500 mt-1">
            Parcelas com correção pelo INCC são atualizadas pelo motor determinístico no momento de cada vencimento.
          </p>
        </div>

        <button
          type="button"
          id="btn-adicionar-obrigacao"
          onClick={handleAdicionarObrigacao}
          className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg bg-stone-900 hover:bg-stone-800 text-white transition shrink-0"
        >
          <Plus className="w-3.5 h-3.5" />
          Adicionar Obrigação
        </button>
      </div>

      {/* Descontos / Bônus da Construtora e Parcelamento do Devedor da Entrada */}
      <DescontosBonusCard
        projeto={projeto}
        onAtualizarProjeto={onAtualizarProjeto}
        showParceladorEntrada={true}
      />

      {/* Lista de Obrigações */}
      <div className="space-y-3">
        {obrigacoes.map((ob) => (
          <div 
            key={ob.id} 
            id={`obrigacao-item-${ob.id}`}
            className="bg-white p-4 rounded-xl border border-stone-200 shadow-xs hover:border-stone-300 transition"
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 items-end">
              {/* Descrição */}
              <div className="lg:col-span-2">
                <label className="block text-[11px] font-semibold text-stone-600 mb-1" htmlFor={`ob-desc-${ob.id}`}>
                  Descrição do Compromisso
                </label>
                <input
                  id={`ob-desc-${ob.id}`}
                  type="text"
                  value={ob.descricao}
                  onChange={(e) => handleAtualizarObrigacao(ob.id, { descricao: e.target.value })}
                  className="w-full px-2.5 py-1.5 text-xs bg-stone-50 border border-stone-300 rounded-md focus:ring-2 focus:ring-amber-500 font-medium text-stone-900"
                />
              </div>

              {/* Tipo */}
              <div>
                <label className="block text-[11px] font-semibold text-stone-600 mb-1" htmlFor={`ob-tipo-${ob.id}`}>
                  Classificação
                </label>
                <select
                  id={`ob-tipo-${ob.id}`}
                  value={ob.tipo}
                  onChange={(e) => handleAtualizarObrigacao(ob.id, { tipo: e.target.value as TipoObrigacaoVendedor })}
                  className="w-full px-2.5 py-1.5 text-xs bg-stone-50 border border-stone-300 rounded-md focus:ring-2 focus:ring-amber-500 text-stone-900"
                >
                  <option value="SINAL">Sinal / Entrada</option>
                  <option value="PARCELA_OBRA">Mensal da Obra</option>
                  <option value="BALAO_SEMESTRAL">Balão Semestral/Anual</option>
                  <option value="CHAVES">Parcela das Chaves</option>
                  <option value="REPASSE_FINANCIAMENTO">Repasse de Financiamento</option>
                  <option value="OUTRO">Outro Compromisso</option>
                </select>
              </div>

              {/* Vencimento */}
              <div>
                <label className="block text-[11px] font-semibold text-stone-600 mb-1" htmlFor={`ob-venc-${ob.id}`}>
                  Vencimento
                </label>
                <input
                  id={`ob-venc-${ob.id}`}
                  type="date"
                  value={ob.vencimento}
                  onChange={(e) => handleAtualizarObrigacao(ob.id, { vencimento: e.target.value })}
                  className="w-full px-2.5 py-1.5 text-xs bg-stone-50 border border-stone-300 rounded-md focus:ring-2 focus:ring-amber-500 text-stone-900"
                />
              </div>

              {/* Valor Base */}
              <div>
                <label className="block text-[11px] font-semibold text-stone-600 mb-1" htmlFor={`ob-val-${ob.id}`}>
                  Valor Base (R$)
                </label>
                <div className="flex items-center gap-1.5">
                  <input
                    id={`ob-val-${ob.id}`}
                    type="text"
                    value={((ob.valorBaseCentavos || 0) / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    onChange={(e) => {
                      const num = parseFloat(e.target.value.replace(/\D/g, '')) || 0;
                      handleAtualizarObrigacao(ob.id, { valorBaseCentavos: num });
                    }}
                    className="w-full px-2.5 py-1.5 text-xs bg-stone-50 border border-stone-300 rounded-md focus:ring-2 focus:ring-amber-500 font-bold text-stone-900"
                  />
                  <button
                    type="button"
                    onClick={() => handleRemoverObrigacao(ob.id)}
                    className="p-1.5 text-stone-400 hover:text-rose-600 rounded-md hover:bg-stone-100 transition"
                    title="Remover obrigação"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>

            {/* Configuração de Correção Monetária */}
            <div className="mt-3 pt-3 border-t border-stone-100 flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <span className="text-stone-500">Índice de Correção:</span>
                  <select
                    value={ob.indiceCorrecao}
                    onChange={(e) => handleAtualizarObrigacao(ob.id, { indiceCorrecao: e.target.value as any })}
                    className="px-2 py-0.5 text-xs bg-stone-100 border border-stone-300 rounded font-medium text-stone-800"
                  >
                    <option value="SEM_CORRECAO">Sem Correção (Fixo)</option>
                    <option value="INCC">INCC (Durante a Obra)</option>
                    <option value="IPCA">IPCA (Pós-chaves)</option>
                    <option value="IGPM">IGP-M</option>
                  </select>
                </div>

                <label className="flex items-center gap-1.5 text-stone-600 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={ob.pagoAntecipado}
                    onChange={(e) => handleAtualizarObrigacao(ob.id, { pagoAntecipado: e.target.checked })}
                    className="rounded text-amber-600 focus:ring-amber-500"
                  />
                  <span>Já quitado antes da data-base (não deduz do caixa atual)</span>
                </label>
              </div>

              <span className="text-[11px] text-stone-400">
                {ob.indiceCorrecao === 'INCC' ? 'Corrigido acumulado pela taxa projetada no cenário' : 'Valor nominal constante'}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
