/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { IndicadoresConsolidados, ReconciliacaoPreco, AlertaProjeto } from '../types';
import { toReais } from '../domain/financial';
import { 
  TrendingDown, 
  Wallet, 
  ArrowUpRight, 
  Scale, 
  AlertTriangle, 
  CheckCircle,
  Building,
  PiggyBank
} from 'lucide-react';

interface ProjectSummaryBarProps {
  indicadores: IndicadoresConsolidados;
  reconciliacao: ReconciliacaoPreco;
  alertas: AlertaProjeto[];
  cenarioNome: string;
}

export const ProjectSummaryBar: React.FC<ProjectSummaryBarProps> = ({
  indicadores,
  reconciliacao,
  alertas,
  cenarioNome
}) => {
  const alertasBloqueantes = alertas.filter(a => a.severidade === 'BLOQUEANTE');
  const alertasAtencao = alertas.filter(a => a.severidade === 'ATENCAO');

  return (
    <section 
      id="barra-resumo-indicadores"
      aria-label="Indicadores Chave do Planejamento"
      className="bg-white border-b border-stone-200 shadow-xs"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
        {/* Banner de status de conciliação e alertas se houver */}
        {(!reconciliacao.fechado || alertasBloqueantes.length > 0) && (
          <div className="mb-3 p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-900 text-xs flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>
                <strong>Atenção:</strong> {!reconciliacao.fechado 
                  ? `Preço não conciliado (diferença de ${toReais(reconciliacao.diferencaNaoConciliadaCentavos)}).` 
                  : alertasBloqueantes[0]?.mensagem}
              </span>
            </div>
            <span className="text-[11px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded bg-rose-200 text-rose-800 shrink-0">
              Ajuste Necessário
            </span>
          </div>
        )}

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {/* 1. Menor Saldo de Caixa */}
          <div 
            id="card-menor-saldo-caixa"
            className={`p-2.5 rounded-lg border transition ${
              indicadores.menorSaldoCaixaCentavos < 0 
                ? 'bg-rose-50/70 border-rose-300' 
                : 'bg-stone-50/80 border-stone-200'
            }`}
          >
            <div className="flex items-center justify-between text-stone-500 mb-1">
              <span className="text-[11px] font-medium uppercase tracking-wider">Menor Caixa</span>
              <Wallet className={`w-3.5 h-3.5 ${indicadores.menorSaldoCaixaCentavos < 0 ? 'text-rose-600' : 'text-stone-600'}`} />
            </div>
            <div className={`text-base font-bold tracking-tight ${indicadores.menorSaldoCaixaCentavos < 0 ? 'text-rose-700' : 'text-stone-900'}`}>
              {toReais(indicadores.menorSaldoCaixaCentavos)}
            </div>
            <p className="text-[11px] text-stone-500 truncate">
              {indicadores.menorSaldoCaixaCentavos < 0 
                ? `Insuficiência em ${indicadores.mesMenorSaldoCaixa}` 
                : `Mínimo em ${indicadores.mesMenorSaldoCaixa}`}
            </p>
          </div>

          {/* 2. Maior Desembolso Mensal */}
          <div 
            id="card-maior-desembolso"
            className="p-2.5 rounded-lg bg-stone-50/80 border border-stone-200"
          >
            <div className="flex items-center justify-between text-stone-500 mb-1">
              <span className="text-[11px] font-medium uppercase tracking-wider">Maior Saída</span>
              <TrendingDown className="w-3.5 h-3.5 text-amber-600" />
            </div>
            <div className="text-base font-bold tracking-tight text-stone-900">
              {toReais(indicadores.maiorDesembolsoMensalCentavos)}
            </div>
            <p className="text-[11px] text-stone-500 truncate">
              Ocorrência em {indicadores.mesMaiorDesembolso}
            </p>
          </div>

          {/* 3. Conciliação do Preço */}
          <div 
            id="card-conciliacao-preco"
            className={`p-2.5 rounded-lg border ${
              reconciliacao.fechado 
                ? 'bg-emerald-50/70 border-emerald-200' 
                : 'bg-amber-50/80 border-amber-200'
            }`}
          >
            <div className="flex items-center justify-between text-stone-500 mb-1">
              <span className="text-[11px] font-medium uppercase tracking-wider">Preço vs Fontes</span>
              <Scale className={`w-3.5 h-3.5 ${reconciliacao.fechado ? 'text-emerald-600' : 'text-amber-600'}`} />
            </div>
            <div className={`text-base font-bold tracking-tight ${reconciliacao.fechado ? 'text-emerald-700' : 'text-amber-800'}`}>
              {reconciliacao.fechado ? '100% Fechado' : toReais(reconciliacao.diferencaNaoConciliadaCentavos)}
            </div>
            <p className="text-[11px] text-stone-500 truncate">
              {reconciliacao.fechado ? `${toReais(reconciliacao.precoImovelCentavos)} coberto` : 'Diferença não alocada'}
            </p>
          </div>

          {/* 4. Custo de Juros do Financiamento */}
          <div 
            id="card-juros-totais"
            className="p-2.5 rounded-lg bg-stone-50/80 border border-stone-200"
          >
            <div className="flex items-center justify-between text-stone-500 mb-1">
              <span className="text-[11px] font-medium uppercase tracking-wider">Juros Banco</span>
              <Building className="w-3.5 h-3.5 text-indigo-600" />
            </div>
            <div className="text-base font-bold tracking-tight text-stone-900">
              {toReais(indicadores.custoTotalJurosBancoCentavos)}
            </div>
            <p className="text-[11px] text-stone-500 truncate">
              Sem TR projetada
            </p>
          </div>

          {/* 5. Caixa nas Chaves */}
          <div 
            id="card-caixa-chaves"
            className="p-2.5 rounded-lg bg-stone-50/80 border border-stone-200"
          >
            <div className="flex items-center justify-between text-stone-500 mb-1">
              <span className="text-[11px] font-medium uppercase tracking-wider">Caixa nas Chaves</span>
              <PiggyBank className="w-3.5 h-3.5 text-stone-600" />
            </div>
            <div className="text-base font-bold tracking-tight text-stone-900">
              {toReais(indicadores.saldoCaixaNasChavesCentavos)}
            </div>
            <p className="text-[11px] text-stone-500 truncate">
              Saldo pós-vistoria
            </p>
          </div>

          {/* 6. Comprometimento de Renda 1º Mês */}
          <div 
            id="card-comprometimento-renda"
            className={`p-2.5 rounded-lg border ${
              indicadores.taxaComprometimentoRendaPrimeiroMesPercent > 30 
                ? 'bg-amber-50/80 border-amber-300' 
                : 'bg-stone-50/80 border-stone-200'
            }`}
          >
            <div className="flex items-center justify-between text-stone-500 mb-1">
              <span className="text-[11px] font-medium uppercase tracking-wider">Margem 1ª Parc.</span>
              <ArrowUpRight className={`w-3.5 h-3.5 ${indicadores.taxaComprometimentoRendaPrimeiroMesPercent > 30 ? 'text-amber-600' : 'text-stone-600'}`} />
            </div>
            <div className={`text-base font-bold tracking-tight ${indicadores.taxaComprometimentoRendaPrimeiroMesPercent > 30 ? 'text-amber-800' : 'text-stone-900'}`}>
              {indicadores.taxaComprometimentoRendaPrimeiroMesPercent}%
            </div>
            <p className="text-[11px] text-stone-500 truncate">
              {indicadores.taxaComprometimentoRendaPrimeiroMesPercent > 30 ? 'Acima do limite bancário' : 'Dentro do limite (30%)'}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
};
