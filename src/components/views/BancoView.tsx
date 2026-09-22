/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { ProjetoFinanciamento, PropostaBancaria, SistemaAmortizacao } from '../../types';
import { 
  toReais, 
  toPercent, 
  converterTaxaNominalAnualParaMensal, 
  gerarTabelaSAC, 
  gerarTabelaPrice 
} from '../../domain/financial';
import { 
  Building2, 
  ArrowRightLeft, 
  Calculator, 
  ShieldCheck, 
  FileSpreadsheet, 
  HelpCircle,
  TrendingDown,
  Percent
} from 'lucide-react';

interface BancoViewProps {
  projeto: ProjetoFinanciamento;
  onAtualizarProjeto: (p: ProjetoFinanciamento) => void;
}

export const BancoView: React.FC<BancoViewProps> = ({ projeto, onAtualizarProjeto }) => {
  const prop = projeto.propostaBancaria;
  const [modoComparacao, setModoComparacao] = useState<'ISOLADO' | 'SAC_VS_PRICE'>('SAC_VS_PRICE');

  const taxaMensal = converterTaxaNominalAnualParaMensal(prop.taxaJurosNominalAnualPercent);

  // Curvas calculadas para comparativo
  const tabelaSAC = gerarTabelaSAC(
    prop.valorFinanciadoCentavos,
    prop.prazoMeses,
    taxaMensal,
    prop.dataPrimeiroVencimento,
    prop.taxaAdmFixaMensalCentavos,
    prop.aliquotaMipInicialPercent,
    prop.aliquotaDfiMensalCentavos
  );

  const tabelaPrice = gerarTabelaPrice(
    prop.valorFinanciadoCentavos,
    prop.prazoMeses,
    taxaMensal,
    prop.dataPrimeiroVencimento,
    prop.taxaAdmFixaMensalCentavos,
    prop.aliquotaMipInicialPercent,
    prop.aliquotaDfiMensalCentavos
  );

  // Totais SAC
  const sacPrestacaoPuraTotal = tabelaSAC.reduce((acc, l) => acc + l.prestacaoCentavos, 0);
  const sacJurosTotal = tabelaSAC.reduce((acc, l) => acc + l.jurosCentavos, 0);
  const sacSegurosTotal = tabelaSAC.reduce((acc, l) => acc + l.seguroMipCentavos + l.seguroDfiCentavos, 0);
  const sacTarifasTotal = tabelaSAC.reduce((acc, l) => acc + l.taxaAdmCentavos, 0);
  const sacEncargoTotal = tabelaSAC.reduce((acc, l) => acc + l.encargoTotalCentavos, 0);

  // Totais Price
  const pricePrestacaoPuraTotal = tabelaPrice.reduce((acc, l) => acc + l.prestacaoCentavos, 0);
  const priceJurosTotal = tabelaPrice.reduce((acc, l) => acc + l.jurosCentavos, 0);
  const priceSegurosTotal = tabelaPrice.reduce((acc, l) => acc + l.seguroMipCentavos + l.seguroDfiCentavos, 0);
  const priceTarifasTotal = tabelaPrice.reduce((acc, l) => acc + l.taxaAdmCentavos, 0);
  const priceEncargoTotal = tabelaPrice.reduce((acc, l) => acc + l.encargoTotalCentavos, 0);

  const diferencaJuros = priceJurosTotal - sacJurosTotal;

  const handleAtualizarProposta = (updates: Partial<PropostaBancaria>) => {
    onAtualizarProjeto({
      ...projeto,
      propostaBancaria: {
        ...projeto.propostaBancaria,
        ...updates
      }
    });
  };

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="border-b border-stone-200 pb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-stone-900 flex items-center gap-2">
            <Building2 className="w-5 h-5 text-amber-600" />
            3. Financiamento Bancário & Sistema de Amortização
          </h2>
          <p className="text-sm text-stone-600 mt-1">
            Configure taxas, prazos e compare o comportamento das parcelas no sistema SAC versus Price.
          </p>
        </div>

        {/* Toggle de Comparativo */}
        <div className="flex items-center bg-stone-100 p-1 rounded-lg border border-stone-200 shrink-0">
          <button
            type="button"
            onClick={() => setModoComparacao('SAC_VS_PRICE')}
            className={`px-3 py-1 text-xs font-semibold rounded-md transition ${
              modoComparacao === 'SAC_VS_PRICE'
                ? 'bg-white text-stone-900 shadow-xs'
                : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            Comparativo SAC vs Price
          </button>
          <button
            type="button"
            onClick={() => setModoComparacao('ISOLADO')}
            className={`px-3 py-1 text-xs font-semibold rounded-md transition ${
              modoComparacao === 'ISOLADO'
                ? 'bg-white text-stone-900 shadow-xs'
                : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            Sistema Ativo Único
          </button>
        </div>
      </div>

      {/* Formulário de Parâmetros Contratuais */}
      <div className="bg-white p-5 rounded-xl border border-stone-200 shadow-xs">
        <h3 className="text-sm font-bold text-stone-900 mb-4 flex items-center gap-2">
          <Calculator className="w-4 h-4 text-stone-700" />
          Condições de Financiamento Propostas
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Sistema de Amortização */}
          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-1" htmlFor="select-sistema-amortizacao">
              Sistema de Amortização
            </label>
            <select
              id="select-sistema-amortizacao"
              value={prop.sistema}
              onChange={(e) => handleAtualizarProposta({ sistema: e.target.value as SistemaAmortizacao })}
              className="w-full px-3 py-2 text-sm bg-stone-50 border border-stone-300 rounded-lg focus:ring-2 focus:ring-amber-500 font-bold text-stone-900"
            >
              <option value="SAC">SAC (Amortização Constante / Parcelas Decrescentes)</option>
              <option value="PRICE">Price (Tabela Francesa / Parcelas Iniciais Menores)</option>
              <option value="TAXA_ZERO">Taxa Zero / Sem Juros</option>
            </select>
            <span className="text-[11px] text-stone-500 mt-1 block">
              {prop.sistema === 'SAC' ? 'Juros caem todo mês conforme amortiza' : 'Parcelas financeiras constantes'}
            </span>
          </div>

          {/* Valor Financiado */}
          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-1" htmlFor="input-valor-financiado">
              Valor Financiado (Principal)
            </label>
            <input
              id="input-valor-financiado"
              type="text"
              value={((prop.valorFinanciadoCentavos || 0) / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              onChange={(e) => {
                const num = parseFloat(e.target.value.replace(/\D/g, '')) || 0;
                handleAtualizarProposta({ 
                  valorFinanciadoCentavos: num,
                  valorEntradaCentavos: projeto.precoImovelCentavos - num
                });
              }}
              className="w-full px-3 py-2 text-sm bg-stone-50 border border-stone-300 rounded-lg focus:ring-2 focus:ring-amber-500 font-bold text-stone-900"
            />
            <span className="text-[11px] text-stone-500 mt-1 block">
              Saldo liberado ao vendedor
            </span>
          </div>

          {/* Prazo */}
          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-1" htmlFor="input-prazo-meses">
              Prazo em Meses
            </label>
            <div className="flex items-center gap-2">
              <input
                id="input-prazo-meses"
                type="number"
                min="12"
                max="420"
                step="12"
                value={prop.prazoMeses}
                onChange={(e) => handleAtualizarProposta({ prazoMeses: parseInt(e.target.value, 10) || 360 })}
                className="w-full px-3 py-2 text-sm bg-stone-50 border border-stone-300 rounded-lg focus:ring-2 focus:ring-amber-500 font-bold text-stone-900"
              />
              <span className="text-xs text-stone-500 whitespace-nowrap">
                ({(prop.prazoMeses / 12).toFixed(1)} anos)
              </span>
            </div>
            <span className="text-[11px] text-stone-500 mt-1 block">
              Máximo bancário padrão: 420 meses
            </span>
          </div>

          {/* Taxa de Juros Nominal Anual */}
          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-1" htmlFor="input-taxa-nominal">
              Taxa Nominal Anual
            </label>
            <div className="relative">
              <input
                id="input-taxa-nominal"
                type="number"
                step="0.01"
                value={prop.taxaJurosNominalAnualPercent}
                onChange={(e) => handleAtualizarProposta({ taxaJurosNominalAnualPercent: parseFloat(e.target.value) || 0 })}
                className="w-full px-3 py-2 text-sm bg-stone-50 border border-stone-300 rounded-lg focus:ring-2 focus:ring-amber-500 font-bold text-stone-900"
              />
              <span className="absolute right-3 top-2.5 text-xs text-stone-500 font-semibold">% a.a.</span>
            </div>
            <span className="text-[11px] text-stone-500 mt-1 block">
              Equiv. a {(taxaMensal.times(100).toNumber()).toFixed(4)}% ao mês
            </span>
          </div>
        </div>

        {/* Encargos Acessórios e CET */}
        <div className="mt-4 pt-4 border-t border-stone-200 grid grid-cols-1 sm:grid-cols-3 gap-4 bg-stone-50/60 p-3 rounded-lg">
          <div>
            <span className="text-xs text-stone-600 block">CET (Custo Efetivo Total) Informado:</span>
            <span className="text-sm font-bold text-stone-900">{prop.cetAnualPercent}% a.a.</span>
            <span className="text-[10px] text-stone-500 block">Resolução CMN 4.881 (inclui seguros e tarifas)</span>
          </div>
          <div>
            <span className="text-xs text-stone-600 block">Taxa de Administração Mensal:</span>
            <span className="text-sm font-bold text-stone-900">{toReais(prop.taxaAdmFixaMensalCentavos)} / mês</span>
            <span className="text-[10px] text-stone-500 block">Cobrança fixa bancária na prestação</span>
          </div>
          <div>
            <span className="text-xs text-stone-600 block">Tarifa de Avaliação do Imóvel:</span>
            <span className="text-sm font-bold text-stone-900">{toReais(prop.tarifaAvaliacaoAVistaCentavos)}</span>
            <span className="text-[10px] text-stone-500 block">Paga na contratação do crédito</span>
          </div>
        </div>
      </div>

      {/* Painel Comparativo SAC vs Price */}
      {modoComparacao === 'SAC_VS_PRICE' && (
        <div 
          id="painel-comparativo-sac-price"
          className="bg-white p-5 rounded-xl border border-stone-200 shadow-xs space-y-4"
        >
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-stone-900 flex items-center gap-2">
                <ArrowRightLeft className="w-4 h-4 text-amber-600" />
                Comparação Normalizada: SAC vs Price
              </h3>
              <p className="text-xs text-stone-600">
                Isola o efeito do sistema de amortização mantendo exatamente o mesmo montante financiado ({toReais(prop.valorFinanciadoCentavos)}), taxa ({prop.taxaJurosNominalAnualPercent}%) e prazo ({prop.prazoMeses} meses).
              </p>
            </div>
            <span className="text-xs px-2.5 py-1 rounded-full bg-amber-100 text-amber-900 font-semibold">
              Mesmo Principal e Taxa
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Cartão SAC */}
            <div className={`p-4 rounded-xl border transition ${
              prop.sistema === 'SAC' ? 'bg-amber-50/40 border-amber-400 ring-2 ring-amber-400/20' : 'bg-stone-50/50 border-stone-200'
            }`}>
              <div className="flex items-center justify-between pb-2 border-b border-stone-200/80 mb-3">
                <div className="font-bold text-stone-900 text-sm">Sistema SAC (Amortização Constante)</div>
                {prop.sistema === 'SAC' && (
                  <span className="text-[10px] bg-amber-500 text-stone-950 font-bold px-2 py-0.5 rounded">
                    Selecionado no Projeto
                  </span>
                )}
              </div>

              <div className="space-y-2.5 text-xs">
                <div className="flex justify-between py-1 border-b border-stone-200/60">
                  <span className="text-stone-600">Primeira Parcela (Encargo):</span>
                  <span className="font-bold text-stone-900">{toReais(tabelaSAC[0]?.encargoTotalCentavos || 0)}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-stone-200/60">
                  <span className="text-stone-600">Última Parcela (Mês {prop.prazoMeses}):</span>
                  <span className="font-bold text-stone-900">{toReais(tabelaSAC[tabelaSAC.length - 1]?.encargoTotalCentavos || 0)}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-stone-200/60">
                  <span className="text-stone-600">Amortização Mensal Base:</span>
                  <span className="font-semibold text-stone-900">{toReais(tabelaSAC[0]?.amortizacaoCentavos || 0)} / mês</span>
                </div>
                <div className="flex justify-between py-1 border-b border-stone-200/60">
                  <span className="text-stone-600">Total de Juros Pagos:</span>
                  <span className="font-bold text-stone-900">{toReais(sacJurosTotal)}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-stone-200/60">
                  <span className="text-stone-600">Total de Seguros (MIP/DFI):</span>
                  <span className="font-semibold text-stone-900">{toReais(sacSegurosTotal)}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-stone-200/60 bg-amber-50/50 px-1.5 rounded">
                  <span className="text-stone-700 font-medium">Somatório das Prestações (Amort + Juros):</span>
                  <span className="font-bold text-stone-900">{toReais(sacPrestacaoPuraTotal)}</span>
                </div>
                <div className="flex justify-between pt-1 font-bold text-sm">
                  <div>
                    <span className="text-stone-900 block">Total Desembolsado ao Banco:</span>
                    <span className="text-[10px] text-stone-500 font-normal block">Prestações + Seguros + Taxa Adm ({toReais(sacTarifasTotal)})</span>
                  </div>
                  <span className="text-amber-800 self-center">{toReais(sacEncargoTotal)}</span>
                </div>
              </div>
            </div>

            {/* Cartão Price */}
            <div className={`p-4 rounded-xl border transition ${
              prop.sistema === 'PRICE' ? 'bg-amber-50/40 border-amber-400 ring-2 ring-amber-400/20' : 'bg-stone-50/50 border-stone-200'
            }`}>
              <div className="flex items-center justify-between pb-2 border-b border-stone-200/80 mb-3">
                <div className="font-bold text-stone-900 text-sm">Sistema Price (Tabela Francesa)</div>
                {prop.sistema === 'PRICE' && (
                  <span className="text-[10px] bg-amber-500 text-stone-950 font-bold px-2 py-0.5 rounded">
                    Selecionado no Projeto
                  </span>
                )}
              </div>

              <div className="space-y-2.5 text-xs">
                <div className="flex justify-between py-1 border-b border-stone-200/60">
                  <span className="text-stone-600">Primeira Parcela (Encargo):</span>
                  <span className="font-bold text-stone-900">{toReais(tabelaPrice[0]?.encargoTotalCentavos || 0)}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-stone-200/60">
                  <span className="text-stone-600">Última Parcela (Mês {prop.prazoMeses}):</span>
                  <span className="font-bold text-stone-900">{toReais(tabelaPrice[tabelaPrice.length - 1]?.encargoTotalCentavos || 0)}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-stone-200/60">
                  <span className="text-stone-600">Amortização Inicial:</span>
                  <span className="font-semibold text-stone-900">{toReais(tabelaPrice[0]?.amortizacaoCentavos || 0)} (crescente)</span>
                </div>
                <div className="flex justify-between py-1 border-b border-stone-200/60">
                  <span className="text-stone-600">Total de Juros Pagos:</span>
                  <span className="font-bold text-rose-700">{toReais(priceJurosTotal)}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-stone-200/60">
                  <span className="text-stone-600">Total de Seguros (MIP/DFI):</span>
                  <span className="font-semibold text-stone-900">{toReais(priceSegurosTotal)}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-stone-200/60 bg-stone-100/70 px-1.5 rounded">
                  <span className="text-stone-700 font-medium">Somatório das Prestações (Amort + Juros):</span>
                  <span className="font-bold text-stone-900">{toReais(pricePrestacaoPuraTotal)}</span>
                </div>
                <div className="flex justify-between pt-1 font-bold text-sm">
                  <div>
                    <span className="text-stone-900 block">Total Desembolsado ao Banco:</span>
                    <span className="text-[10px] text-stone-500 font-normal block">Prestações + Seguros + Taxa Adm ({toReais(priceTarifasTotal)})</span>
                  </div>
                  <span className="text-rose-900 self-center">{toReais(priceEncargoTotal)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Destaque da Diferença */}
          <div className="p-3.5 rounded-lg bg-stone-100 border border-stone-200 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <span className="font-bold text-stone-900">Conclusão Matemática de Juros: </span>
              <span className="text-stone-600">
                A Tabela Price custa <strong>{toReais(diferencaJuros)} a mais</strong> em juros ao longo de {prop.prazoMeses} meses, porém sua primeira parcela é <strong>{toReais((tabelaSAC[0]?.encargoTotalCentavos || 0) - (tabelaPrice[0]?.encargoTotalCentavos || 0))} menor</strong>, facilitando a aprovação da margem de renda inicial.
              </span>
            </div>
            <button
              type="button"
              onClick={() => handleAtualizarProposta({ sistema: prop.sistema === 'SAC' ? 'PRICE' : 'SAC' })}
              className="px-3 py-1.5 rounded-md bg-stone-900 text-white font-semibold hover:bg-stone-800 transition whitespace-nowrap shrink-0"
            >
              Mudar para {prop.sistema === 'SAC' ? 'Price' : 'SAC'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
