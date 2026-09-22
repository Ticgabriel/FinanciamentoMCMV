/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { ProjetoFinanciamento, PremissasCenario } from '../../types';
import { toReais, simularProjetoCompleto } from '../../domain/financial';
import { 
  SlidersHorizontal, 
  AlertTriangle, 
  ArrowRight, 
  Clock, 
  TrendingDown, 
  ShieldAlert, 
  DollarSign 
} from 'lucide-react';

interface CenariosViewProps {
  projeto: ProjetoFinanciamento;
  onAtualizarProjeto: (p: ProjetoFinanciamento) => void;
  cenarioAtivoIndex: number;
  onMudarCenario: (idx: number) => void;
}

export const CenariosView: React.FC<CenariosViewProps> = ({
  projeto,
  onAtualizarProjeto,
  cenarioAtivoIndex,
  onMudarCenario
}) => {
  const cenarioBase = projeto.cenarios[0];
  const cenarioAdverso = projeto.cenarios[1] || projeto.cenarios[0];

  // Simula ambos os cenários para o comparativo lado a lado
  const simBase = simularProjetoCompleto(projeto, cenarioBase);
  const simAdverso = simularProjetoCompleto(projeto, cenarioAdverso);

  const handleAtualizarCenarioAdverso = (updates: Partial<PremissasCenario>) => {
    const novosCenarios = [...projeto.cenarios];
    novosCenarios[1] = {
      ...novosCenarios[1],
      ...updates
    };
    onAtualizarProjeto({
      ...projeto,
      cenarios: novosCenarios
    });
  };

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="border-b border-stone-200 pb-4">
        <h2 className="text-xl font-bold tracking-tight text-stone-900 flex items-center gap-2">
          <SlidersHorizontal className="w-5 h-5 text-amber-600" />
          7. Teste de Estresse & Comparador de Cenários
        </h2>
        <p className="text-sm text-stone-600 mt-1">
          Avalie o comportamento do caixa e dos custos caso ocorram atrasos na entrega da obra, queda temporária de renda ou inflação da construção mais alta.
        </p>
      </div>

      {/* Controles de Parâmetros de Estresse */}
      <div className="bg-white p-5 rounded-xl border border-stone-200 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-stone-900">
            Parâmetros do Cenário Adverso (Simulação de Risco)
          </h3>
          <span className="text-xs px-2.5 py-0.5 rounded bg-rose-100 text-rose-800 font-semibold">
            Modo Estresse
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Atraso de Obra */}
          <div className="p-3 rounded-lg border border-stone-200 bg-stone-50">
            <label className="block text-xs font-semibold text-stone-700 mb-1" htmlFor="input-atraso-meses">
              Atraso na Entrega das Chaves
            </label>
            <div className="flex items-center gap-2">
              <input
                id="input-atraso-meses"
                type="number"
                min="0"
                max="24"
                value={cenarioAdverso.atrasoObraMeses}
                onChange={(e) => handleAtualizarCenarioAdverso({ atrasoObraMeses: parseInt(e.target.value, 10) || 0 })}
                className="w-full px-2.5 py-1.5 text-xs bg-white border border-stone-300 rounded font-bold text-stone-900"
              />
              <span className="text-xs text-stone-500 whitespace-nowrap">meses</span>
            </div>
            <span className="text-[11px] text-stone-500 mt-1 block">
              Prolonga pagamento de aluguel atual e encargos de obra
            </span>
          </div>

          {/* Queda de Renda */}
          <div className="p-3 rounded-lg border border-stone-200 bg-stone-50">
            <label className="block text-xs font-semibold text-stone-700 mb-1" htmlFor="input-variacao-renda">
              Variação de Renda Familiar
            </label>
            <div className="flex items-center gap-2">
              <input
                id="input-variacao-renda"
                type="number"
                step="5"
                value={cenarioAdverso.variacaoRendaPercent}
                onChange={(e) => handleAtualizarCenarioAdverso({ variacaoRendaPercent: parseFloat(e.target.value) || 0 })}
                className="w-full px-2.5 py-1.5 text-xs bg-white border border-stone-300 rounded font-bold text-stone-900"
              />
              <span className="text-xs text-stone-500">%</span>
            </div>
            <span className="text-[11px] text-stone-500 mt-1 block">
              Ex: -20% para testar desemprego ou perda de bônus
            </span>
          </div>

          {/* INCC Anual Projetado */}
          <div className="p-3 rounded-lg border border-stone-200 bg-stone-50">
            <label className="block text-xs font-semibold text-stone-700 mb-1" htmlFor="input-incc-anual">
              INCC Anual Projetado
            </label>
            <div className="flex items-center gap-2">
              <input
                id="input-incc-anual"
                type="number"
                step="0.5"
                value={cenarioAdverso.inccAnualPercent}
                onChange={(e) => handleAtualizarCenarioAdverso({ inccAnualPercent: parseFloat(e.target.value) || 0 })}
                className="w-full px-2.5 py-1.5 text-xs bg-white border border-stone-300 rounded font-bold text-stone-900"
              />
              <span className="text-xs text-stone-500">% a.a.</span>
            </div>
            <span className="text-[11px] text-stone-500 mt-1 block">
              Corrige parcelas de obra e saldo devedor com vendedor
            </span>
          </div>

          {/* Aumento Custos Instalação */}
          <div className="p-3 rounded-lg border border-stone-200 bg-stone-50">
            <label className="block text-xs font-semibold text-stone-700 mb-1" htmlFor="input-aumento-instalacao">
              Desvio no Custo de Reforma / Instalação
            </label>
            <div className="flex items-center gap-2">
              <input
                id="input-aumento-instalacao"
                type="number"
                step="5"
                value={cenarioAdverso.aumentoCustosInstalacaoPercent}
                onChange={(e) => handleAtualizarCenarioAdverso({ aumentoCustosInstalacaoPercent: parseFloat(e.target.value) || 0 })}
                className="w-full px-2.5 py-1.5 text-xs bg-white border border-stone-300 rounded font-bold text-stone-900"
              />
              <span className="text-xs text-stone-500">%</span>
            </div>
            <span className="text-[11px] text-stone-500 mt-1 block">
              Ex: +20% para imprevistos de acabamento
            </span>
          </div>

          {/* Reserva Mínima Desejada */}
          <div className="p-3 rounded-lg border border-stone-200 bg-stone-50">
            <label className="block text-xs font-semibold text-stone-700 mb-1" htmlFor="input-reserva-minima">
              Piso de Reserva Mínima Desejado
            </label>
            <div className="relative">
              <span className="absolute left-2.5 top-1.5 text-xs text-stone-500">R$</span>
              <input
                id="input-reserva-minima"
                type="text"
                value={((cenarioAdverso.reservaMinimaDesejadaCentavos || 0) / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                onChange={(e) => {
                  const num = parseFloat(e.target.value.replace(/\D/g, '')) || 0;
                  handleAtualizarCenarioAdverso({ reservaMinimaDesejadaCentavos: num });
                }}
                className="w-full pl-8 pr-2.5 py-1.5 text-xs bg-white border border-stone-300 rounded font-bold text-stone-900"
              />
            </div>
            <span className="text-[11px] text-stone-500 mt-1 block">
              Patamar de emergência que não deve ser consumido
            </span>
          </div>

          {/* Risco: Perda do Bônus de Pontualidade */}
          <div className="p-3 rounded-lg border border-amber-200 bg-amber-50/50 flex flex-col justify-between">
            <div>
              <span className="text-xs font-bold text-amber-950 flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-700" />
                Perda do Bônus Pontualidade
              </span>
              <span className="text-[11px] text-amber-800 mt-0.5 block leading-tight">
                Simula atraso nas parcelas da entrada com cobrança integral do bônus nas chaves.
              </span>
            </div>
            <label className="flex items-center gap-2 mt-2 pt-2 border-t border-amber-200 text-xs font-semibold text-amber-900 cursor-pointer">
              <input
                type="checkbox"
                checked={!!cenarioAdverso.perderBonusPontualidade}
                onChange={(e) => handleAtualizarCenarioAdverso({ perderBonusPontualidade: e.target.checked })}
                className="rounded text-amber-600 focus:ring-amber-500"
              />
              <span>Reativar dívida nas chaves</span>
            </label>
          </div>

          {/* Alternar Ativo */}
          <div className="p-3 rounded-lg border border-stone-200 bg-stone-50 flex flex-col justify-between">
            <span className="text-xs font-semibold text-stone-700 block">Cenário Ativo no Painel</span>
            <div className="flex gap-2 mt-2">
              <button
                type="button"
                onClick={() => onMudarCenario(0)}
                className={`flex-1 py-1.5 text-xs font-semibold rounded transition ${
                  cenarioAtivoIndex === 0
                    ? 'bg-stone-900 text-white'
                    : 'bg-white border border-stone-300 text-stone-700 hover:bg-stone-100'
                }`}
              >
                Ativar Base
              </button>
              <button
                type="button"
                onClick={() => onMudarCenario(1)}
                className={`flex-1 py-1.5 text-xs font-semibold rounded transition ${
                  cenarioAtivoIndex === 1
                    ? 'bg-rose-600 text-white'
                    : 'bg-white border border-stone-300 text-stone-700 hover:bg-stone-100'
                }`}
              >
                Ativar Adverso
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Tabela de Comparação Lado a Lado dos Resultados */}
      <div 
        id="tabela-comparacao-cenarios"
        className="bg-white p-5 rounded-xl border border-stone-200 shadow-xs"
      >
        <h3 className="text-base font-bold text-stone-900 mb-4">
          Comparativo de Indicadores: Cenário Base vs Cenário Adverso
        </h3>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left border-collapse">
            <thead>
              <tr className="border-b border-stone-200 bg-stone-50 text-stone-600 font-semibold">
                <th className="py-2.5 px-3">Indicador Fundamental</th>
                <th className="py-2.5 px-3 text-stone-900">Cenário Base (Contratual)</th>
                <th className="py-2.5 px-3 text-rose-800">Cenário Adverso (Estresse)</th>
                <th className="py-2.5 px-3">Impacto / Variação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {/* Menor Caixa */}
              <tr>
                <td className="py-2.5 px-3 font-semibold text-stone-800">Menor Saldo de Caixa Acumulado</td>
                <td className={`py-2.5 px-3 font-bold ${simBase.indicadores.menorSaldoCaixaCentavos < 0 ? 'text-rose-600' : 'text-stone-900'}`}>
                  {toReais(simBase.indicadores.menorSaldoCaixaCentavos)} ({simBase.indicadores.mesMenorSaldoCaixa})
                </td>
                <td className={`py-2.5 px-3 font-bold ${simAdverso.indicadores.menorSaldoCaixaCentavos < 0 ? 'text-rose-600' : 'text-stone-900'}`}>
                  {toReais(simAdverso.indicadores.menorSaldoCaixaCentavos)} ({simAdverso.indicadores.mesMenorSaldoCaixa})
                </td>
                <td className="py-2.5 px-3 font-semibold text-stone-600">
                  {toReais(simAdverso.indicadores.menorSaldoCaixaCentavos - simBase.indicadores.menorSaldoCaixaCentavos)}
                </td>
              </tr>

              {/* Maior Saída */}
              <tr>
                <td className="py-2.5 px-3 font-semibold text-stone-800">Maior Desembolso Mensal</td>
                <td className="py-2.5 px-3 font-bold text-stone-900">
                  {toReais(simBase.indicadores.maiorDesembolsoMensalCentavos)} ({simBase.indicadores.mesMaiorDesembolso})
                </td>
                <td className="py-2.5 px-3 font-bold text-stone-900">
                  {toReais(simAdverso.indicadores.maiorDesembolsoMensalCentavos)} ({simAdverso.indicadores.mesMaiorDesembolso})
                </td>
                <td className="py-2.5 px-3 font-semibold text-stone-600">
                  +{toReais(simAdverso.indicadores.maiorDesembolsoMensalCentavos - simBase.indicadores.maiorDesembolsoMensalCentavos)}
                </td>
              </tr>

              {/* Necessidade Adicional */}
              <tr>
                <td className="py-2.5 px-3 font-semibold text-stone-800">Necessidade Adicional de Recursos (Déficit)</td>
                <td className="py-2.5 px-3 font-bold text-stone-900">
                  {toReais(simBase.indicadores.necessidadeAdicionalRecursosCentavos)}
                </td>
                <td className={`py-2.5 px-3 font-bold ${simAdverso.indicadores.necessidadeAdicionalRecursosCentavos > 0 ? 'text-rose-700' : 'text-emerald-700'}`}>
                  {toReais(simAdverso.indicadores.necessidadeAdicionalRecursosCentavos)}
                </td>
                <td className="py-2.5 px-3 font-semibold text-rose-700">
                  {simAdverso.indicadores.necessidadeAdicionalRecursosCentavos > 0 ? 'Exige aporte complementar' : 'Caixa autossuficiente'}
                </td>
              </tr>

              {/* Saldo nas Chaves */}
              <tr>
                <td className="py-2.5 px-3 font-semibold text-stone-800">Caixa Disponível na Entrega das Chaves</td>
                <td className="py-2.5 px-3 font-bold text-stone-900">
                  {toReais(simBase.indicadores.saldoCaixaNasChavesCentavos)}
                </td>
                <td className="py-2.5 px-3 font-bold text-stone-900">
                  {toReais(simAdverso.indicadores.saldoCaixaNasChavesCentavos)}
                </td>
                <td className="py-2.5 px-3 font-semibold text-stone-600">
                  {toReais(simAdverso.indicadores.saldoCaixaNasChavesCentavos - simBase.indicadores.saldoCaixaNasChavesCentavos)}
                </td>
              </tr>

              {/* Custo Total de Juros */}
              <tr>
                <td className="py-2.5 px-3 font-semibold text-stone-800">Custo Total de Juros Bancários</td>
                <td className="py-2.5 px-3 font-bold text-stone-900">
                  {toReais(simBase.indicadores.custoTotalJurosBancoCentavos)}
                </td>
                <td className="py-2.5 px-3 font-bold text-stone-900">
                  {toReais(simAdverso.indicadores.custoTotalJurosBancoCentavos)}
                </td>
                <td className="py-2.5 px-3 font-semibold text-stone-600">
                  {toReais(simAdverso.indicadores.custoTotalJurosBancoCentavos - simBase.indicadores.custoTotalJurosBancoCentavos)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
