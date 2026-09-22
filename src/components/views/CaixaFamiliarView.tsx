/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { ProjetoFinanciamento, ReceitaFamiliar, DespesaFamiliar, LinhaCaixaMes } from '../../types';
import { toReais } from '../../domain/financial';
import { 
  Wallet, 
  TrendingUp, 
  TrendingDown, 
  Plus, 
  Trash2, 
  Home, 
  AlertTriangle, 
  ShieldAlert,
  PiggyBank
} from 'lucide-react';
import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine
} from 'recharts';

interface CaixaFamiliarViewProps {
  projeto: ProjetoFinanciamento;
  onAtualizarProjeto: (p: ProjetoFinanciamento) => void;
  linhasCaixa: LinhaCaixaMes[];
}

export const CaixaFamiliarView: React.FC<CaixaFamiliarViewProps> = ({
  projeto,
  onAtualizarProjeto,
  linhasCaixa
}) => {
  const receitas = projeto.receitas;
  const despesas = projeto.despesas;

  const totalReceitasMensaisCentavos = receitas
    .filter(r => r.recorrenteMensal)
    .reduce((acc, r) => acc + r.valorCentavos, 0);

  const totalDespesasFixasCentavos = despesas
    .reduce((acc, d) => acc + d.valorCentavos, 0);

  const sobraMensalBase = totalReceitasMensaisCentavos - totalDespesasFixasCentavos;

  // Prepara dados dos primeiros 36 meses para o gráfico
  const dadosGrafico = linhasCaixa.slice(0, 36).map((linha) => ({
    mes: linha.competencia,
    saldoAcumulado: Math.round(linha.saldoCaixaAcumuladoCentavos / 100),
    reservaPiso: Math.round(linha.reservaMinimaPisoCentavos / 100),
    saidasMes: Math.round(linha.totalSaidasCentavos / 100),
    receitasMes: Math.round(linha.receitasCentavos / 100)
  }));

  const handleAtualizarCaixaInicial = (valStr: string) => {
    const num = parseFloat(valStr.replace(/\D/g, '')) || 0;
    onAtualizarProjeto({ ...projeto, caixaInicialCentavos: num });
  };

  const handleAdicionarReceita = () => {
    const nova: ReceitaFamiliar = {
      id: `rec_${Date.now()}`,
      descricao: 'Nova Receita / 13º / Bônus',
      valorCentavos: 300000,
      recorrenteMensal: true
    };
    onAtualizarProjeto({ ...projeto, receitas: [...receitas, nova] });
  };

  const handleRemoverReceita = (id: string) => {
    onAtualizarProjeto({ ...projeto, receitas: receitas.filter(r => r.id !== id) });
  };

  const handleAtualizarReceita = (id: string, updates: Partial<ReceitaFamiliar>) => {
    onAtualizarProjeto({
      ...projeto,
      receitas: receitas.map(r => r.id === id ? { ...r, ...updates } : r)
    });
  };

  const handleAdicionarDespesa = () => {
    const nova: DespesaFamiliar = {
      id: `desp_${Date.now()}`,
      descricao: 'Nova Despesa Familiar',
      valorCentavos: 100000,
      categoria: 'VIDA',
      cessaNaMudanca: false
    };
    onAtualizarProjeto({ ...projeto, despesas: [...despesas, nova] });
  };

  const handleRemoverDespesa = (id: string) => {
    onAtualizarProjeto({ ...projeto, despesas: despesas.filter(d => d.id !== id) });
  };

  const handleAtualizarDespesa = (id: string, updates: Partial<DespesaFamiliar>) => {
    onAtualizarProjeto({
      ...projeto,
      despesas: despesas.map(d => d.id === id ? { ...d, ...updates } : d)
    });
  };

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="border-b border-stone-200 pb-4">
        <h2 className="text-xl font-bold tracking-tight text-stone-900 flex items-center gap-2">
          <Wallet className="w-5 h-5 text-amber-600" />
          6. Orçamento Familiar & Evolução do Caixa
        </h2>
        <p className="text-sm text-stone-600 mt-1">
          Acompanhe o saldo disponível da família ao longo do tempo. O modelo garante que nenhuma obrigação futura deixe a conta no negativo ou abaixo da reserva de emergência.
        </p>
      </div>

      {/* Caixa Inicial e Resumo de Renda */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Caixa Disponível Hoje */}
        <div className="bg-white p-5 rounded-xl border border-stone-200 shadow-xs">
          <label className="block text-xs font-semibold uppercase tracking-wider text-stone-700 mb-1" htmlFor="input-caixa-inicial">
            Caixa Inicial Disponível
          </label>
          <div className="relative">
            <span className="absolute left-3 top-2.5 text-xs text-stone-500 font-medium">R$</span>
            <input
              id="input-caixa-inicial"
              type="text"
              value={((projeto.caixaInicialCentavos || 0) / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              onChange={(e) => handleAtualizarCaixaInicial(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-base border border-stone-300 rounded-lg focus:ring-2 focus:ring-amber-500 font-bold text-stone-900"
            />
          </div>
          <span className="text-[11px] text-stone-500 mt-1 block">
            Saldo livre já descontados sinais pagos anteriormente
          </span>
        </div>

        {/* Renda Líquida Mensal */}
        <div className="bg-white p-5 rounded-xl border border-stone-200 shadow-xs">
          <span className="text-xs font-semibold uppercase tracking-wider text-stone-700 block mb-1">
            Renda Líquida Recorrente
          </span>
          <div className="text-xl font-bold text-stone-900">
            {toReais(totalReceitasMensaisCentavos)} / mês
          </div>
          <span className="text-[11px] text-stone-500 mt-1 block">
            Soma dos rendimentos de todos os titulares
          </span>
        </div>

        {/* Sobra Líquida Operacional */}
        <div className="bg-white p-5 rounded-xl border border-stone-200 shadow-xs">
          <span className="text-xs font-semibold uppercase tracking-wider text-stone-700 block mb-1">
            Sobra Familiar (Antes da Compra)
          </span>
          <div className={`text-xl font-bold ${sobraMensalBase >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
            {toReais(sobraMensalBase)} / mês
          </div>
          <span className="text-[11px] text-stone-500 mt-1 block">
            Capacidade de absorção de parcelas e balões
          </span>
        </div>
      </div>

      {/* Gráfico de Evolução de Caixa e Piso de Reserva */}
      <div 
        id="grafico-curva-caixa"
        className="bg-white p-5 rounded-xl border border-stone-200 shadow-xs"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
          <div>
            <h3 className="text-sm font-bold text-stone-900 flex items-center gap-1.5">
              <TrendingUp className="w-4 h-4 text-amber-600" />
              Trajetória do Caixa Acumulado vs Piso de Reserva (36 Meses)
            </h3>
            <p className="text-xs text-stone-500">
              A linha preta exibe o caixa em conta. A linha tracejada vermelha representa a reserva mínima de segurança estipulada.
            </p>
          </div>
        </div>

        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={dadosGrafico} margin={{ top: 10, right: 10, left: 10, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e7e5e4" />
              <XAxis 
                dataKey="mes" 
                tick={{ fontSize: 10, fill: '#78716c' }} 
                interval={2}
                angle={-30}
                textAnchor="end"
              />
              <YAxis 
                tick={{ fontSize: 10, fill: '#78716c' }} 
                tickFormatter={(v) => `R$ ${(v / 1000).toFixed(0)}k`}
              />
              <Tooltip 
                formatter={(val: any) => [`R$ ${Number(val).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, '']}
                labelFormatter={(lbl) => `Competência: ${lbl}`}
                contentStyle={{ backgroundColor: '#1c1917', borderRadius: '8px', color: '#fff', fontSize: '11px' }}
              />
              <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
              <ReferenceLine y={0} stroke="#dc2626" strokeWidth={1.5} label={{ value: 'Zero (Negativo)', fill: '#dc2626', fontSize: 10 }} />
              
              <Bar dataKey="saidasMes" name="Total Saídas no Mês" fill="#f59e0b" opacity={0.4} />
              <Line 
                type="monotone" 
                dataKey="saldoAcumulado" 
                name="Saldo de Caixa Acumulado" 
                stroke="#1c1917" 
                strokeWidth={2.5} 
                dot={false}
              />
              <Line 
                type="monotone" 
                dataKey="reservaPiso" 
                name="Piso Reserva Mínima" 
                stroke="#ef4444" 
                strokeWidth={1.5} 
                strokeDasharray="4 4" 
                dot={false}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Gestão de Receitas e Despesas Familiares */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Receitas */}
        <div className="bg-white p-5 rounded-xl border border-stone-200 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-stone-900 flex items-center gap-1.5">
              <TrendingUp className="w-4 h-4 text-emerald-600" />
              Fontes de Renda Familiar
            </h3>
            <button
              type="button"
              onClick={handleAdicionarReceita}
              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded bg-stone-100 hover:bg-stone-200 text-stone-800 transition"
            >
              <Plus className="w-3.5 h-3.5" />
              Adicionar
            </button>
          </div>

          <div className="space-y-2">
            {receitas.map((r) => (
              <div key={r.id} className="p-2.5 rounded-lg border border-stone-200 bg-stone-50 flex items-center gap-2">
                <input
                  type="text"
                  value={r.descricao}
                  onChange={(e) => handleAtualizarReceita(r.id, { descricao: e.target.value })}
                  className="flex-1 px-2 py-1 text-xs bg-white border border-stone-300 rounded font-medium text-stone-900"
                />
                <div className="w-32">
                  <input
                    type="text"
                    value={((r.valorCentavos || 0) / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    onChange={(e) => {
                      const num = parseFloat(e.target.value.replace(/\D/g, '')) || 0;
                      handleAtualizarReceita(r.id, { valorCentavos: num });
                    }}
                    className="w-full px-2 py-1 text-xs bg-white border border-stone-300 rounded font-bold text-stone-900 text-right"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => handleRemoverReceita(r.id)}
                  className="p-1 text-stone-400 hover:text-rose-600 transition"
                  title="Remover receita"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Despesas */}
        <div className="bg-white p-5 rounded-xl border border-stone-200 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-stone-900 flex items-center gap-1.5">
              <TrendingDown className="w-4 h-4 text-rose-600" />
              Despesas e Dívidas Existentes
            </h3>
            <button
              type="button"
              onClick={handleAdicionarDespesa}
              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded bg-stone-100 hover:bg-stone-200 text-stone-800 transition"
            >
              <Plus className="w-3.5 h-3.5" />
              Adicionar
            </button>
          </div>

          <div className="space-y-2">
            {despesas.map((d) => (
              <div key={d.id} className="p-2.5 rounded-lg border border-stone-200 bg-stone-50 space-y-2">
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={d.descricao}
                    onChange={(e) => handleAtualizarDespesa(d.id, { descricao: e.target.value })}
                    className="flex-1 px-2 py-1 text-xs bg-white border border-stone-300 rounded font-medium text-stone-900"
                  />
                  <select
                    value={d.categoria}
                    onChange={(e) => handleAtualizarDespesa(d.id, { categoria: e.target.value as any })}
                    className="px-2 py-1 text-xs bg-white border border-stone-300 rounded text-stone-800"
                  >
                    <option value="VIDA">Custo de Vida</option>
                    <option value="MORADIA_ATUAL">Moradia Atual (Aluguel)</option>
                    <option value="OUTRA_DIVIDA">Outra Dívida (Carro/Emp.)</option>
                  </select>
                  <div className="w-28">
                    <input
                      type="text"
                      value={((d.valorCentavos || 0) / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      onChange={(e) => {
                        const num = parseFloat(e.target.value.replace(/\D/g, '')) || 0;
                        handleAtualizarDespesa(d.id, { valorCentavos: num });
                      }}
                      className="w-full px-2 py-1 text-xs bg-white border border-stone-300 rounded font-bold text-stone-900 text-right"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRemoverDespesa(d.id)}
                    className="p-1 text-stone-400 hover:text-rose-600 transition"
                    title="Remover despesa"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                {d.categoria === 'MORADIA_ATUAL' && (
                  <label className="flex items-center gap-1.5 text-[11px] text-stone-600 pl-1 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={d.cessaNaMudanca}
                      onChange={(e) => handleAtualizarDespesa(d.id, { cessaNaMudanca: e.target.checked })}
                      className="rounded text-amber-600 focus:ring-amber-500"
                    />
                    <span>Cessa automaticamente no mês da mudança efetiva para o novo imóvel</span>
                  </label>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
