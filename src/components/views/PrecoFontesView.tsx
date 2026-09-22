/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { ProjetoFinanciamento, FonteRecurso, TipoFonteRecurso } from '../../types';
import { toReais, calcularReconciliacaoPreco } from '../../domain/financial';
import { DescontosBonusCard } from '../DescontosBonusCard';
import { 
  Scale, 
  CheckCircle2, 
  AlertTriangle, 
  Plus, 
  Trash2, 
  Wallet, 
  Layers, 
  Landmark, 
  ShieldCheck,
  Sparkles
} from 'lucide-react';

interface PrecoFontesViewProps {
  projeto: ProjetoFinanciamento;
  onAtualizarProjeto: (p: ProjetoFinanciamento) => void;
}

export const PrecoFontesView: React.FC<PrecoFontesViewProps> = ({ projeto, onAtualizarProjeto }) => {
  const reconciliacao = calcularReconciliacaoPreco(projeto);
  const fontesPreco = projeto.fontes.filter(f => f.destino === 'PRECO');
  const somaFontesPrecoCentavos = reconciliacao.somaFontesPrecoCentavos;
  const precoEfetivoCentavos = reconciliacao.precoEfetivoCentavos ?? projeto.precoImovelCentavos;
  const diferencaCentavos = reconciliacao.diferencaNaoConciliadaCentavos;
  const reconciliado = reconciliacao.fechado;
  const totalBeneficios = (reconciliacao.descontoComercialCentavos || 0) + (reconciliacao.bonusPontualidadeCentavos || 0);

  const handleAtualizarFonte = (id: string, updates: Partial<FonteRecurso>) => {
    const novasFontes = projeto.fontes.map(f => f.id === id ? { ...f, ...updates } : f);
    
    // Se o valor de financiamento bancário foi alterado, sincroniza com a proposta bancária
    const fonteAlterada = novasFontes.find(f => f.id === id);
    let novaProposta = { ...projeto.propostaBancaria };
    if (fonteAlterada && fonteAlterada.tipo === 'CREDITO_BANCO') {
      novaProposta.valorFinanciadoCentavos = fonteAlterada.valorCentavos;
      novaProposta.valorEntradaCentavos = projeto.precoImovelCentavos - fonteAlterada.valorCentavos;
    }

    onAtualizarProjeto({
      ...projeto,
      fontes: novasFontes,
      propostaBancaria: novaProposta
    });
  };

  const handleAdicionarFonte = () => {
    const novaFonte: FonteRecurso = {
      id: `fonte_${Date.now()}`,
      nome: 'Nova Fonte de Recurso',
      tipo: 'DINHEIRO_PROPRIO',
      valorCentavos: diferencaCentavos > 0 ? diferencaCentavos : 1000000,
      disponivelEm: projeto.dataBase,
      destino: 'PRECO',
      confirmado: true
    };
    onAtualizarProjeto({
      ...projeto,
      fontes: [...projeto.fontes, novaFonte]
    });
  };

  const handleRemoverFonte = (id: string) => {
    onAtualizarProjeto({
      ...projeto,
      fontes: projeto.fontes.filter(f => f.id !== id)
    });
  };

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="border-b border-stone-200 pb-4">
        <h2 className="text-xl font-bold tracking-tight text-stone-900 flex items-center gap-2">
          <Scale className="w-5 h-5 text-amber-600" />
          2. Preço & Reconciliação de Fontes
        </h2>
        <p className="text-sm text-stone-600 mt-1">
          Concilie o preço total do imóvel com a origem de cada centavo. A soma das fontes deve fechar exatamente o valor líquido do contrato.
        </p>
      </div>

      {/* Cartão de Reconciliação Matemática */}
      <div 
        id="painel-reconciliacao-matematica"
        className={`p-5 rounded-xl border transition ${
          reconciliado 
            ? 'bg-emerald-50/50 border-emerald-300' 
            : 'bg-amber-50/60 border-amber-300'
        }`}
      >
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className={`p-2 rounded-lg mt-0.5 ${reconciliado ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-800'}`}>
              {reconciliado ? <CheckCircle2 className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-stone-900">
                  {reconciliado ? 'Preço 100% Conciliado e Fechado' : 'Diferença de Conciliação Detectada'}
                </h3>
                <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                  reconciliado ? 'bg-emerald-200 text-emerald-900' : 'bg-amber-200 text-amber-950'
                }`}>
                  {reconciliado ? 'Auditado' : 'Ajustar Fontes'}
                </span>
              </div>
              <p className="text-xs text-stone-600 mt-1 max-w-xl">
                {reconciliado
                  ? totalBeneficios > 0
                    ? `Preço total de ${toReais(projeto.precoImovelCentavos)} com ${toReais(totalBeneficios)} em descontos/bônus da construtora. As fontes cobrem rigorosamente o valor efetivo de ${toReais(precoEfetivoCentavos)}.`
                    : 'A soma de todas as fontes alocadas (recursos próprios, FGTS, subsídios e crédito bancário) é rigorosamente idêntica ao preço estipulado no contrato de compra e venda.'
                  : `Existe uma diferença de ${toReais(diferencaCentavos)} entre o valor necessário do imóvel (${toReais(precoEfetivoCentavos)}) e as fontes declaradas. Adicione ou ajuste os valores abaixo para conciliar a operação.`}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <div className="bg-white/80 border border-stone-200 rounded-lg px-3 py-2 text-right">
              <span className="text-[10px] text-stone-500 uppercase font-semibold block">Preço de Tabela</span>
              <span className="text-sm font-bold text-stone-900">{toReais(projeto.precoImovelCentavos)}</span>
            </div>
            {totalBeneficios > 0 && (
              <div className="bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2 text-right">
                <span className="text-[10px] text-emerald-700 uppercase font-semibold block">(-) Descontos & Bônus</span>
                <span className="text-sm font-bold text-emerald-800">- {toReais(totalBeneficios)}</span>
              </div>
            )}
            <div className="bg-white/80 border border-stone-200 rounded-lg px-3 py-2 text-right">
              <span className="text-[10px] text-stone-500 uppercase font-semibold block">Soma das Fontes</span>
              <span className="text-sm font-bold text-stone-900">{toReais(somaFontesPrecoCentavos)}</span>
            </div>
            <div className={`rounded-lg px-3 py-2 text-right border ${reconciliado ? 'bg-emerald-100/70 border-emerald-300 text-emerald-900' : 'bg-amber-100/80 border-amber-300 text-amber-950'}`}>
              <span className="text-[10px] uppercase font-semibold block">Diferença</span>
              <span className="text-sm font-bold">{toReais(diferencaCentavos)}</span>
            </div>
          </div>
        </div>

        {reconciliacao.pendencias && reconciliacao.pendencias.length > 0 && (
          <div className="mt-4 pt-3 border-t border-amber-200/80 space-y-1.5">
            <span className="text-xs font-bold text-amber-900 flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4 text-amber-600" />
              Pendências e Inconsistências de Auditoria Documental:
            </span>
            <ul className="list-disc list-inside text-xs text-amber-900 space-y-1">
              {reconciliacao.pendencias.map((pend, idx) => (
                <li key={idx}>{pend}</li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Descontos / Bônus da Construtora e Parcelamento da Entrada */}
      <DescontosBonusCard
        projeto={projeto}
        onAtualizarProjeto={onAtualizarProjeto}
        showParceladorEntrada={true}
      />

      {/* Lista de Fontes de Recurso */}
      <div className="bg-white p-5 rounded-xl border border-stone-200 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-stone-900">Fontes de Pagamento da Aquisição</h3>
            <p className="text-xs text-stone-500">Cada fonte tem destino e regras de liquidação próprias.</p>
          </div>
          <button
            type="button"
            id="btn-adicionar-fonte"
            onClick={handleAdicionarFonte}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-stone-900 hover:bg-stone-800 text-white transition"
          >
            <Plus className="w-3.5 h-3.5" />
            Adicionar Fonte
          </button>
        </div>

        <div className="space-y-3">
          {fontesPreco.map((fonte) => (
            <div 
              key={fonte.id} 
              id={`fonte-item-${fonte.id}`}
              className="p-3.5 rounded-lg border border-stone-200 bg-stone-50/50 flex flex-col md:flex-row md:items-center justify-between gap-3"
            >
              <div className="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* Nome */}
                <div>
                  <label className="block text-[11px] font-semibold text-stone-600 mb-1" htmlFor={`fonte-nome-${fonte.id}`}>
                    Descrição da Fonte
                  </label>
                  <input
                    id={`fonte-nome-${fonte.id}`}
                    type="text"
                    value={fonte.nome}
                    onChange={(e) => handleAtualizarFonte(fonte.id, { nome: e.target.value })}
                    className="w-full px-2.5 py-1.5 text-xs bg-white border border-stone-300 rounded-md focus:ring-2 focus:ring-amber-500 text-stone-900 font-medium"
                  />
                </div>

                {/* Tipo de Fonte */}
                <div>
                  <label className="block text-[11px] font-semibold text-stone-600 mb-1" htmlFor={`fonte-tipo-${fonte.id}`}>
                    Tipo de Recurso
                  </label>
                  <select
                    id={`fonte-tipo-${fonte.id}`}
                    value={fonte.tipo}
                    onChange={(e) => handleAtualizarFonte(fonte.id, { tipo: e.target.value as TipoFonteRecurso })}
                    className="w-full px-2.5 py-1.5 text-xs bg-white border border-stone-300 rounded-md focus:ring-2 focus:ring-amber-500 text-stone-900"
                  >
                    <option value="DINHEIRO_PROPRIO">Dinheiro Próprio (Entrada)</option>
                    <option value="FGTS">Saldo FGTS</option>
                    <option value="SUBSIDIO">Subsídio Governamental (MCMV)</option>
                    <option value="CREDITO_BANCO">Financiamento Bancário</option>
                    <option value="SALDO_VENDEDOR_DIRETO">Parcelamento c/ Construtora</option>
                  </select>
                </div>

                {/* Valor */}
                <div>
                  <label className="block text-[11px] font-semibold text-stone-600 mb-1" htmlFor={`fonte-valor-${fonte.id}`}>
                    Valor (R$)
                  </label>
                  <input
                    id={`fonte-valor-${fonte.id}`}
                    type="text"
                    value={((fonte.valorCentavos || 0) / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    onChange={(e) => {
                      const num = parseFloat(e.target.value.replace(/\D/g, '')) || 0;
                      handleAtualizarFonte(fonte.id, { valorCentavos: num });
                    }}
                    className="w-full px-2.5 py-1.5 text-xs bg-white border border-stone-300 rounded-md focus:ring-2 focus:ring-amber-500 text-stone-900 font-bold"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0 pt-2 sm:pt-0">
                <button
                  type="button"
                  onClick={() => handleRemoverFonte(fonte.id)}
                  className="p-1.5 rounded-md hover:bg-stone-200 text-stone-500 hover:text-rose-600 transition"
                  title="Remover fonte"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
