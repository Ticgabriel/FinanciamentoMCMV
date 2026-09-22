/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { ProjetoFinanciamento, ModalidadeOperacao, MarcoTemporal } from '../../types';
import { toReais } from '../../domain/financial';
import { Home, Calendar, MapPin, Building, Info, AlertCircle } from 'lucide-react';

interface OperacaoViewProps {
  projeto: ProjetoFinanciamento;
  onAtualizarProjeto: (p: ProjetoFinanciamento) => void;
}

export const OperacaoView: React.FC<OperacaoViewProps> = ({ projeto, onAtualizarProjeto }) => {
  const handleMudarModalidade = (mod: ModalidadeOperacao) => {
    onAtualizarProjeto({
      ...projeto,
      modalidade: mod
    });
  };

  const handlePrecoChange = (valStr: string) => {
    const num = parseFloat(valStr.replace(/\D/g, '')) || 0;
    onAtualizarProjeto({
      ...projeto,
      precoImovelCentavos: num,
      avaliacaoBancariaCentavos: num
    });
  };

  const handleAtualizarMarco = (id: string, novaData: string) => {
    const novosMarcos = projeto.marcos.map(m => m.id === id ? { ...m, dataPrevista: novaData } : m);
    onAtualizarProjeto({
      ...projeto,
      marcos: novosMarcos
    });
  };

  return (
    <div className="space-y-6">
      {/* Cabeçalho da Seção */}
      <div className="border-b border-stone-200 pb-4">
        <h2 className="text-xl font-bold tracking-tight text-stone-900 flex items-center gap-2">
          <Home className="w-5 h-5 text-amber-600" />
          1. Operação & Situação do Imóvel
        </h2>
        <p className="text-sm text-stone-600 mt-1">
          Defina se o imóvel está pronto ou em construção, o preço acordado e o calendário fundamental que orienta os vencimentos.
        </p>
      </div>

      {/* Seletor de Modalidade */}
      <div>
        <label className="block text-xs font-semibold uppercase tracking-wider text-stone-700 mb-2">
          Modalidade de Aquisição
        </label>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {/* Opção 1: Pronto */}
          <button
            type="button"
            id="btn-modalidade-pronto"
            onClick={() => handleMudarModalidade('PRONTO')}
            className={`p-4 rounded-xl border text-left transition relative ${
              projeto.modalidade === 'PRONTO'
                ? 'bg-amber-50/50 border-amber-500 ring-2 ring-amber-500/20 shadow-xs'
                : 'bg-white border-stone-200 hover:border-stone-300'
            }`}
          >
            <div className="font-semibold text-stone-900 text-sm mb-1 flex items-center justify-between">
              Imóvel Pronto
              {projeto.modalidade === 'PRONTO' && (
                <span className="w-2 h-2 rounded-full bg-amber-500"></span>
              )}
            </div>
            <p className="text-xs text-stone-600 leading-relaxed">
              Compra direta (novo ou usado). Financiamento contratado de imediato, pagamento da entrada e entrega das chaves a curto prazo.
            </p>
          </button>

          {/* Opção 2: Planta com Repasse Futuro */}
          <button
            type="button"
            id="btn-modalidade-planta-repasse"
            onClick={() => handleMudarModalidade('PLANTA_COM_REPASSE_FUTURO')}
            className={`p-4 rounded-xl border text-left transition relative ${
              projeto.modalidade === 'PLANTA_COM_REPASSE_FUTURO'
                ? 'bg-amber-50/50 border-amber-500 ring-2 ring-amber-500/20 shadow-xs'
                : 'bg-white border-stone-200 hover:border-stone-300'
            }`}
          >
            <div className="font-semibold text-stone-900 text-sm mb-1 flex items-center justify-between">
              Na Planta (Repasse nas Chaves)
              {projeto.modalidade === 'PLANTA_COM_REPASSE_FUTURO' && (
                <span className="w-2 h-2 rounded-full bg-amber-500"></span>
              )}
            </div>
            <p className="text-xs text-stone-600 leading-relaxed">
              Dívida parcelada com a construtora (sinal, mensais, balões corrigidos pelo INCC). Financiamento bancário obtido somente na entrega do Habite-se.
            </p>
          </button>

          {/* Opção 3: Planta com Banco na Obra */}
          <button
            type="button"
            id="btn-modalidade-planta-banco-obra"
            onClick={() => handleMudarModalidade('PLANTA_COM_BANCO_NA_OBRA')}
            className={`p-4 rounded-xl border text-left transition relative ${
              projeto.modalidade === 'PLANTA_COM_BANCO_NA_OBRA'
                ? 'bg-amber-50/50 border-amber-500 ring-2 ring-amber-500/20 shadow-xs'
                : 'bg-white border-stone-200 hover:border-stone-300'
            }`}
          >
            <div className="font-semibold text-stone-900 text-sm mb-1 flex items-center justify-between">
              Na Planta (Crédito Associativo)
              {projeto.modalidade === 'PLANTA_COM_BANCO_NA_OBRA' && (
                <span className="w-2 h-2 rounded-full bg-amber-500"></span>
              )}
            </div>
            <p className="text-xs text-stone-600 leading-relaxed">
              Contrato bancário assinado ainda durante a construção (MCMV/SBPE). Pagamento de encargos de evolução de obra e início da amortização nas chaves.
            </p>
          </button>
        </div>
      </div>

      {/* Valores do Imóvel & Localização */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-white p-5 rounded-xl border border-stone-200 shadow-xs">
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-stone-700 mb-1" htmlFor="input-preco-imovel">
            Preço do Imóvel (Contrato)
          </label>
          <div className="relative">
            <span className="absolute left-3 top-2.5 text-xs text-stone-500 font-medium">R$</span>
            <input
              id="input-preco-imovel"
              type="text"
              value={((projeto.precoImovelCentavos || 0) / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              onChange={(e) => handlePrecoChange(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-sm border border-stone-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 font-semibold text-stone-900"
            />
          </div>
          <span className="text-[11px] text-stone-500 mt-1 block">
            Valor de compra e venda acordado com o vendedor
          </span>
        </div>

        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-stone-700 mb-1" htmlFor="input-avaliacao-bancaria">
            Avaliação do Banco (Garantia)
          </label>
          <div className="relative">
            <span className="absolute left-3 top-2.5 text-xs text-stone-500 font-medium">R$</span>
            <input
              id="input-avaliacao-bancaria"
              type="text"
              value={((projeto.avaliacaoBancariaCentavos || 0) / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              onChange={(e) => {
                const num = parseFloat(e.target.value.replace(/\D/g, '')) || 0;
                onAtualizarProjeto({ ...projeto, avaliacaoBancariaCentavos: num });
              }}
              className="w-full pl-9 pr-3 py-2 text-sm border border-stone-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 text-stone-900"
            />
          </div>
          <span className="text-[11px] text-stone-500 mt-1 block">
            Base para teto de financiamento (ex: máx. 80%)
          </span>
        </div>

        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-stone-700 mb-1" htmlFor="input-municipio-uf">
            Município / UF
          </label>
          <div className="flex gap-2">
            <input
              id="input-municipio-uf"
              type="text"
              value={projeto.municipio}
              onChange={(e) => onAtualizarProjeto({ ...projeto, municipio: e.target.value })}
              placeholder="São Paulo"
              className="flex-1 px-3 py-2 text-sm border border-stone-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 text-stone-900"
            />
            <input
              type="text"
              value={projeto.uf}
              onChange={(e) => onAtualizarProjeto({ ...projeto, uf: e.target.value.toUpperCase().slice(0, 2) })}
              placeholder="SP"
              className="w-16 px-3 py-2 text-sm border border-stone-300 rounded-lg text-center uppercase focus:ring-2 focus:ring-amber-500 focus:border-amber-500 font-medium text-stone-900"
            />
          </div>
          <span className="text-[11px] text-stone-500 mt-1 block">
            Determina a alíquota municipal de ITBI
          </span>
        </div>
      </div>

      {/* Calendário e Marcos Temporais */}
      <div className="bg-white p-5 rounded-xl border border-stone-200 shadow-xs">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-bold text-stone-900 flex items-center gap-1.5">
              <Calendar className="w-4 h-4 text-amber-600" />
              Marcos Temporais da Operação
            </h3>
            <p className="text-xs text-stone-500">
              O atraso nesses marcos recalcula automaticamente o encerramento do aluguel atual e o vencimento das despesas de mudança e instalação.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {projeto.marcos.map((marco) => (
            <div key={marco.id} className="p-3 rounded-lg border border-stone-200 bg-stone-50/50">
              <label className="block text-xs font-semibold text-stone-800 mb-1" htmlFor={`marco-${marco.id}`}>
                {marco.descricao}
              </label>
              <input
                id={`marco-${marco.id}`}
                type="date"
                value={marco.dataPrevista}
                onChange={(e) => handleAtualizarMarco(marco.id, e.target.value)}
                className="w-full px-2.5 py-1.5 text-xs bg-white border border-stone-300 rounded-md focus:ring-2 focus:ring-amber-500 focus:border-amber-500 text-stone-900"
              />
              <span className="text-[10px] text-stone-500 mt-1 block uppercase tracking-wider font-mono">
                {marco.tipo}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
