/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { ProjetoFinanciamento, CustoComplementar } from '../../types';
import { toReais } from '../../domain/financial';
import { 
  FileText, 
  Plus, 
  Trash2, 
  ShieldCheck, 
  Home, 
  Truck, 
  Wrench, 
  Receipt,
  Info
} from 'lucide-react';

interface CustosComplementaresViewProps {
  projeto: ProjetoFinanciamento;
  onAtualizarProjeto: (p: ProjetoFinanciamento) => void;
}

export const CustosComplementaresView: React.FC<CustosComplementaresViewProps> = ({
  projeto,
  onAtualizarProjeto
}) => {
  const custos = projeto.custosComplementares;
  const totalCustosAVistaCentavos = custos
    .filter(c => !c.financiadoPeloBanco)
    .reduce((acc, c) => acc + c.valorCentavos, 0);

  const handleAtualizarCusto = (id: string, updates: Partial<CustoComplementar>) => {
    const novos = custos.map(c => c.id === id ? { ...c, ...updates } : c);
    onAtualizarProjeto({
      ...projeto,
      custosComplementares: novos
    });
  };

  const handleAdicionarCusto = () => {
    const novo: CustoComplementar = {
      id: `cc_${Date.now()}`,
      categoria: 'OUTRO',
      descricao: 'Novo Custo Adicional',
      valorCentavos: 100000,
      vencimento: projeto.dataBase,
      vinculoMarco: 'DATA_FIXA',
      financiadoPeloBanco: false,
      status: 'ESTIMADO'
    };
    onAtualizarProjeto({
      ...projeto,
      custosComplementares: [...custos, novo]
    });
  };

  const handleRemoverCusto = (id: string) => {
    onAtualizarProjeto({
      ...projeto,
      custosComplementares: custos.filter(c => c.id !== id)
    });
  };

  // Helper para recalcular ITBI padrão (ex: 3% do preço)
  const aplicarITBIPadrao = () => {
    const itbiAtual = custos.find(c => c.categoria === 'ITBI');
    const valorSugerido = Math.round(projeto.precoImovelCentavos * 0.03); // 3%
    if (itbiAtual) {
      handleAtualizarCusto(itbiAtual.id, { valorCentavos: valorSugerido, descricao: `ITBI Municipal (3% sobre ${toReais(projeto.precoImovelCentavos)})` });
    }
  };

  // Helper para aplicar desconto de 50% de registro (1º imóvel SFH/MCMV)
  const aplicarDesconto50Registro = () => {
    const regAtual = custos.find(c => c.categoria === 'REGISTRO_CARTORIO');
    if (regAtual) {
      const novoValor = Math.round(regAtual.valorCentavos / 2);
      handleAtualizarCusto(regAtual.id, { 
        valorCentavos: novoValor,
        descricao: `${regAtual.descricao.replace(' (c/ 50% desc.)', '')} (c/ 50% desc. Lei 6.015/73)`
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="border-b border-stone-200 pb-4">
        <h2 className="text-xl font-bold tracking-tight text-stone-900 flex items-center gap-2">
          <FileText className="w-5 h-5 text-amber-600" />
          5. Custos Complementares & Instalação
        </h2>
        <p className="text-sm text-stone-600 mt-1">
          ITBI, taxas de cartório, avaliação bancária, reforma, instalações e mudança. Despesas essenciais que drenam o caixa familiar além do preço de compra.
        </p>
      </div>

      {/* Cartão de Resumo e Ações Rápidas */}
      <div className="bg-white p-5 rounded-xl border border-stone-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <span className="text-xs text-stone-500 uppercase tracking-wider font-semibold block">
            Total de Custos Complementares a Pagar com Recursos Próprios
          </span>
          <div className="text-2xl font-bold tracking-tight text-stone-900 mt-0.5">
            {toReais(totalCustosAVistaCentavos)}
          </div>
          <p className="text-xs text-stone-500 mt-1">
            Geralmente representam entre 5% e 10% do valor do imóvel.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={aplicarITBIPadrao}
            className="px-2.5 py-1.5 text-xs font-medium rounded-lg bg-stone-100 hover:bg-stone-200 text-stone-700 border border-stone-300 transition"
            title="Recalcular ITBI como 3% sobre o preço do imóvel"
          >
            Calcular ITBI 3%
          </button>
          <button
            type="button"
            onClick={aplicarDesconto50Registro}
            className="px-2.5 py-1.5 text-xs font-medium rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 transition"
            title="Aplicar desconto de 50% de 1º imóvel no registro (Lei 6.015/73)"
          >
            Aplicar 50% Registro (1º Imóvel)
          </button>
          <button
            type="button"
            id="btn-adicionar-custo"
            onClick={handleAdicionarCusto}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-stone-900 hover:bg-stone-800 text-white transition"
          >
            <Plus className="w-3.5 h-3.5" />
            Adicionar Custo
          </button>
        </div>
      </div>

      {/* Lista de Custos */}
      <div className="space-y-3">
        {custos.map((custo) => (
          <div 
            key={custo.id}
            id={`custo-item-${custo.id}`}
            className="bg-white p-4 rounded-xl border border-stone-200 shadow-xs hover:border-stone-300 transition"
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 items-end">
              {/* Descrição */}
              <div className="lg:col-span-2">
                <label className="block text-[11px] font-semibold text-stone-600 mb-1" htmlFor={`custo-desc-${custo.id}`}>
                  Descrição da Despesa
                </label>
                <input
                  id={`custo-desc-${custo.id}`}
                  type="text"
                  value={custo.descricao}
                  onChange={(e) => handleAtualizarCusto(custo.id, { descricao: e.target.value })}
                  className="w-full px-2.5 py-1.5 text-xs bg-stone-50 border border-stone-300 rounded-md focus:ring-2 focus:ring-amber-500 font-medium text-stone-900"
                />
              </div>

              {/* Categoria */}
              <div>
                <label className="block text-[11px] font-semibold text-stone-600 mb-1" htmlFor={`custo-cat-${custo.id}`}>
                  Categoria
                </label>
                <select
                  id={`custo-cat-${custo.id}`}
                  value={custo.categoria}
                  onChange={(e) => handleAtualizarCusto(custo.id, { categoria: e.target.value as any })}
                  className="w-full px-2.5 py-1.5 text-xs bg-stone-50 border border-stone-300 rounded-md focus:ring-2 focus:ring-amber-500 text-stone-900"
                >
                  <option value="ITBI">ITBI (Imposto Municipal)</option>
                  <option value="REGISTRO_CARTORIO">Registro de Imóveis (Cartório)</option>
                  <option value="TARIFA_AVALIACAO">Tarifa de Avaliação Bancária</option>
                  <option value="ASSESSORIA">Assessoria / Despachante</option>
                  <option value="VISTORIA">Vistoria e Engenharia</option>
                  <option value="MUDANCA">Mudança / Frete</option>
                  <option value="REFORMA_INSTALACAO">Reforma e Instalação (Piso/Box/Ilum.)</option>
                  <option value="CONDOMINIO_INICIAL">Condomínio / IPTU Inicial</option>
                  <option value="OUTRO">Outro Custo</option>
                </select>
              </div>

              {/* Vínculo de Vencimento */}
              <div>
                <label className="block text-[11px] font-semibold text-stone-600 mb-1" htmlFor={`custo-vinc-${custo.id}`}>
                  Vínculo com Marcos
                </label>
                <select
                  id={`custo-vinc-${custo.id}`}
                  value={custo.vinculoMarco || 'DATA_FIXA'}
                  onChange={(e) => handleAtualizarCusto(custo.id, { vinculoMarco: e.target.value as any })}
                  className="w-full px-2.5 py-1.5 text-xs bg-stone-50 border border-stone-300 rounded-md focus:ring-2 focus:ring-amber-500 text-stone-900"
                >
                  <option value="DATA_FIXA">Data Fixa do Calendário</option>
                  <option value="CONTRATACAO">Na Contratação Bancária</option>
                  <option value="CHAVES">Nas Chaves (Entrega)</option>
                  <option value="MUDANCA">Na Mudança Efetiva</option>
                </select>
              </div>

              {/* Valor */}
              <div>
                <label className="block text-[11px] font-semibold text-stone-600 mb-1" htmlFor={`custo-val-${custo.id}`}>
                  Valor (R$)
                </label>
                <div className="flex items-center gap-1.5">
                  <input
                    id={`custo-val-${custo.id}`}
                    type="text"
                    value={((custo.valorCentavos || 0) / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    onChange={(e) => {
                      const num = parseFloat(e.target.value.replace(/\D/g, '')) || 0;
                      handleAtualizarCusto(custo.id, { valorCentavos: num });
                    }}
                    className="w-full px-2.5 py-1.5 text-xs bg-stone-50 border border-stone-300 rounded-md focus:ring-2 focus:ring-amber-500 font-bold text-stone-900"
                  />
                  <button
                    type="button"
                    onClick={() => handleRemoverCusto(custo.id)}
                    className="p-1.5 text-stone-400 hover:text-rose-600 rounded-md hover:bg-stone-100 transition"
                    title="Remover custo"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>

            {/* Opção de Financiamento da Despesa */}
            <div className="mt-3 pt-3 border-t border-stone-100 flex items-center justify-between text-xs">
              <label className="flex items-center gap-1.5 text-stone-600 cursor-pointer">
                <input
                  type="checkbox"
                  checked={custo.financiadoPeloBanco}
                  onChange={(e) => handleAtualizarCusto(custo.id, { financiadoPeloBanco: e.target.checked })}
                  className="rounded text-amber-600 focus:ring-amber-500"
                />
                <span>Financiado junto com o crédito imobiliário (não sai do caixa à vista)</span>
              </label>

              <span className="text-[11px] text-stone-400">
                {custo.vinculoMarco === 'CHAVES' ? 'Vencimento sincronizado com a liberação das chaves' : 'Vencimento na data estimada'}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
