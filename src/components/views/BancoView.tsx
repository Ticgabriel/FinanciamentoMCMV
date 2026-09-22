/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import Decimal from 'decimal.js';
import { 
  ProjetoFinanciamento, 
  PropostaBancaria, 
  SistemaAmortizacao, 
  ConfiguracaoFaseObra 
} from '../../types';
import { 
  toReais, 
  toPercent, 
  converterTaxaNominalAnualParaMensal, 
  gerarTabelaSAC, 
  gerarTabelaPrice,
  gerarEncargosFaseObra
} from '../../domain/financial';
import { 
  calcularAliquotaMIPParticipantes, 
  TABELA_FAIXAS_ETARIAS_MIP,
  ParticipanteMIP
} from '../../domain/pdfParser';
import { 
  Building2, 
  ArrowRightLeft, 
  Calculator, 
  ShieldCheck, 
  HardHat,
  Users,
  ChevronRight,
  Info,
  Calendar,
  Layers,
  Sparkles
} from 'lucide-react';

interface BancoViewProps {
  projeto: ProjetoFinanciamento;
  onAtualizarProjeto: (p: ProjetoFinanciamento) => void;
}

export const BancoView: React.FC<BancoViewProps> = ({ projeto, onAtualizarProjeto }) => {
  const prop = projeto.propostaBancaria;
  const [modoComparacao, setModoComparacao] = useState<'ISOLADO' | 'SAC_VS_PRICE'>('SAC_VS_PRICE');
  const [mostrarSimuladorMIP, setMostrarSimuladorMIP] = useState(false);
  const [participantes, setParticipantes] = useState<ParticipanteMIP[]>([
    { id: 'p1', nome: 'Proponente Principal', idade: 32, percentualRenda: 70 },
    { id: 'p2', nome: 'Coobrigado / Cônjuge', idade: 29, percentualRenda: 30 }
  ]);

  const taxaMensal = converterTaxaNominalAnualParaMensal(prop.taxaJurosNominalAnualPercent);

  // Configuração da Fase de Obra
  const faseObraConfig: ConfiguracaoFaseObra = projeto.faseObraConfig ?? {
    ativo: projeto.modalidade === 'PLANTA_COM_BANCO_NA_OBRA',
    duracaoMesesPrevista: 24,
    regraLiberacao: 'CURVA_S',
    baseCalculoMipObra: 'SALDO_LIBERADO',
    aliquotaMipObraPercent: prop.aliquotaMipInicialPercent,
    baseCalculoDfiObra: 'VALOR_AVALIACAO',
    aliquotaDfiObraCentavos: prop.aliquotaDfiMensalCentavos,
    taxaAdmObraCentavos: prop.taxaAdmFixaMensalCentavos,
    indiceAtualizacaoObra: 'SEM_CORRECAO',
    trObraAnualPercent: 0,
    regraInicioAmortizacao: 'MES_SUBSEQUENTE_CHAVES'
  };

  // Encargos da Fase de Obra
  const encargosObra = gerarEncargosFaseObra(
    prop.valorFinanciadoCentavos,
    projeto.avaliacaoBancariaCentavos || projeto.precoImovelCentavos,
    faseObraConfig.duracaoMesesPrevista,
    projeto.dataBase,
    taxaMensal,
    faseObraConfig.aliquotaMipObraPercent ?? prop.aliquotaMipInicialPercent,
    faseObraConfig.aliquotaDfiObraCentavos ?? prop.aliquotaDfiMensalCentavos,
    faseObraConfig.taxaAdmObraCentavos ?? prop.taxaAdmFixaMensalCentavos,
    faseObraConfig,
    faseObraConfig.trObraAnualPercent || 0
  );

  const totalJurosObra = encargosObra.reduce((acc, l) => acc + l.jurosObraCentavos, 0);
  const totalEncargosObra = encargosObra.reduce((acc, l) => acc + l.encargoTotalMesCentavos, 0);

  // Curvas calculadas para comparativo
  const tabelaSAC = gerarTabelaSAC(
    prop.valorFinanciadoCentavos,
    prop.prazoMeses,
    taxaMensal,
    prop.dataPrimeiroVencimento,
    prop.taxaAdmFixaMensalCentavos,
    prop.aliquotaMipInicialPercent,
    prop.aliquotaDfiMensalCentavos,
    new Decimal(0),
    projeto.convencaoTR
  );

  const tabelaPrice = gerarTabelaPrice(
    prop.valorFinanciadoCentavos,
    prop.prazoMeses,
    taxaMensal,
    prop.dataPrimeiroVencimento,
    prop.taxaAdmFixaMensalCentavos,
    prop.aliquotaMipInicialPercent,
    prop.aliquotaDfiMensalCentavos,
    new Decimal(0),
    projeto.convencaoTR
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

  const handleAtualizarFaseObra = (updates: Partial<ConfiguracaoFaseObra>) => {
    onAtualizarProjeto({
      ...projeto,
      faseObraConfig: {
        ...faseObraConfig,
        ...updates
      }
    });
  };

  const aliquotaMIPPonderada = calcularAliquotaMIPParticipantes(participantes);

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="border-b border-stone-200 pb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-stone-900 flex items-center gap-2">
            <Building2 className="w-5 h-5 text-amber-600" />
            3. Financiamento Bancário, Seguros & Fase de Obra
          </h2>
          <p className="text-sm text-stone-600 mt-1">
            Configure taxas contratuais, apólice habitacional (MIP/DFI) e simule os encargos da fase de obra (juros de obra).
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

      {/* 1. Condições Gerais de Financiamento */}
      <div className="bg-white p-5 rounded-xl border border-stone-200 shadow-xs">
        <h3 className="text-sm font-bold text-stone-900 mb-4 flex items-center gap-2">
          <Calculator className="w-4 h-4 text-stone-700" />
          Condições Contratuais do Empréstimo
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
              {prop.sistema === 'SAC' ? 'Juros decaem proporcionalmente ao saldo' : 'Encargos com parcelas fixas'}
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
                  valorEntradaCentavos: Math.max(0, projeto.precoImovelCentavos - num)
                });
              }}
              className="w-full px-3 py-2 text-sm bg-stone-50 border border-stone-300 rounded-lg focus:ring-2 focus:ring-amber-500 font-bold text-stone-900"
            />
            <span className="text-[11px] text-stone-500 mt-1 block">
              Montante bancário concedido
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
              Máximo SFH / CAIXA: 420 meses
            </span>
          </div>

          {/* Taxa Nominal */}
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
        <div className="mt-4 pt-4 border-t border-stone-200 grid grid-cols-1 sm:grid-cols-4 gap-4 bg-stone-50/60 p-3 rounded-lg text-xs">
          <div>
            <span className="text-stone-600 block">CET Informado:</span>
            <span className="text-sm font-bold text-stone-900">{prop.cetAnualPercent}% a.a.</span>
            <span className="text-[10px] text-stone-500 block">Resolução CMN 4.881</span>
          </div>
          <div>
            <span className="text-stone-600 block">Taxa de Administração:</span>
            <span className="text-sm font-bold text-stone-900">{toReais(prop.taxaAdmFixaMensalCentavos)} / mês</span>
            <span className="text-[10px] text-stone-500 block">Tarifa mensal de serviço</span>
          </div>
          <div>
            <span className="text-stone-600 block">Tarifa de Avaliação:</span>
            <span className="text-sm font-bold text-stone-900">{toReais(prop.tarifaAvaliacaoAVistaCentavos)}</span>
            <span className="text-[10px] text-stone-500 block">Paga na contratação</span>
          </div>
          <div>
            <span className="text-stone-600 block">Convenção de TR:</span>
            <select
              value={projeto.convencaoTR || 'RECALCULO_MENSAL_PADRAO_SFH'}
              onChange={(e) => onAtualizarProjeto({ ...projeto, convencaoTR: e.target.value as any })}
              className="mt-0.5 w-full bg-white border border-stone-300 rounded px-2 py-1 text-xs font-semibold text-stone-800"
            >
              <option value="RECALCULO_MENSAL_PADRAO_SFH">Recálculo Mensal Padrão SFH</option>
              <option value="AMORTIZACAO_ORIGINAL_COM_RESIDUO">Amortização Original com Resíduo</option>
            </select>
          </div>
        </div>
      </div>

      {/* 2. Seguros Obrigatórios Habitacionais (MIP & DFI) */}
      <div className="bg-white p-5 rounded-xl border border-stone-200 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-stone-200 pb-3">
          <div>
            <h3 className="text-sm font-bold text-stone-900 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              Seguros Obrigatórios (MIP e DFI)
            </h3>
            <p className="text-xs text-stone-600 mt-0.5">
              Exigidos por lei no SFH/SFI. O MIP varia por faixa etária dos proponentes; o DFI incide sobre o valor de avaliação.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setMostrarSimuladorMIP(!mostrarSimuladorMIP)}
            className="text-xs px-3 py-1.5 rounded-lg border border-stone-300 bg-stone-50 hover:bg-stone-100 font-semibold text-stone-800 flex items-center gap-1.5 transition"
          >
            <Users className="w-3.5 h-3.5 text-stone-600" />
            {mostrarSimuladorMIP ? 'Ocultar Proponentes' : 'Simular Proponentes & Composição de Renda'}
          </button>
        </div>

        {/* Simulador de Proponentes */}
        {mostrarSimuladorMIP && (
          <div className="p-4 bg-emerald-50/40 border border-emerald-200 rounded-xl space-y-3 text-xs">
            <div className="flex items-center justify-between">
              <div className="font-bold text-emerald-950 flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-emerald-600" />
                Cálculo da Taxa MIP por Idade & Composição de Renda (Apólice CAIXA/SUSEP)
              </div>
              <span className="text-[11px] font-semibold text-emerald-900">
                Alíquota Ponderada: {aliquotaMIPPonderada.toFixed(8)}% / mês
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {participantes.map((part, idx) => (
                <div key={part.id || idx} className="p-3 bg-white border border-emerald-200 rounded-lg space-y-2">
                  <div className="font-semibold text-stone-900 flex justify-between">
                    <span>{part.nome}</span>
                    <span className="text-stone-500 font-normal">Participante {idx + 1}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[10px] text-stone-600 font-medium">Idade (anos):</label>
                      <input
                        type="number"
                        min="18"
                        max="80"
                        value={part.idade}
                        onChange={(e) => {
                          const novaIdade = parseInt(e.target.value, 10) || 18;
                          const novos = [...participantes];
                          novos[idx] = { ...novos[idx], idade: novaIdade };
                          setParticipantes(novos);
                        }}
                        className="w-full px-2 py-1 border border-stone-300 rounded text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-stone-600 font-medium">% da Renda:</label>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={part.percentualRenda}
                        onChange={(e) => {
                          const novoPerc = parseFloat(e.target.value) || 0;
                          const novos = [...participantes];
                          novos[idx] = { ...novos[idx], percentualRenda: novoPerc };
                          setParticipantes(novos);
                        }}
                        className="w-full px-2 py-1 border border-stone-300 rounded text-xs"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex justify-end pt-1">
              <button
                type="button"
                onClick={() => handleAtualizarProposta({ aliquotaMipInicialPercent: aliquotaMIPPonderada })}
                className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-600 text-white font-bold rounded-lg transition"
              >
                Aplicar {aliquotaMIPPonderada.toFixed(6)}% à Proposta Bancária
              </button>
            </div>
          </div>
        )}

        {/* Inputs de Seguros */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
          <div>
            <label className="block font-semibold text-stone-700 mb-1" htmlFor="input-aliquota-mip">
              Alíquota Mensal MIP (Morte e Invalidez)
            </label>
            <div className="relative">
              <input
                id="input-aliquota-mip"
                type="number"
                step="0.000001"
                value={prop.aliquotaMipInicialPercent}
                onChange={(e) => handleAtualizarProposta({ aliquotaMipInicialPercent: parseFloat(e.target.value) || 0 })}
                className="w-full px-3 py-2 bg-stone-50 border border-stone-300 rounded-lg font-bold text-stone-900"
              />
              <span className="absolute right-3 top-2 text-stone-500 font-semibold">% / mês</span>
            </div>
            <span className="text-[10px] text-stone-500 mt-1 block">
              Incide mensalmente sobre o saldo devedor
            </span>
          </div>

          <div>
            <label className="block font-semibold text-stone-700 mb-1" htmlFor="input-dfi-mensal">
              Seguro DFI (Danos Físicos ao Imóvel)
            </label>
            <input
              id="input-dfi-mensal"
              type="text"
              value={((prop.aliquotaDfiMensalCentavos || 0) / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              onChange={(e) => {
                const num = parseFloat(e.target.value.replace(/\D/g, '')) || 0;
                handleAtualizarProposta({ aliquotaDfiMensalCentavos: num });
              }}
              className="w-full px-3 py-2 bg-stone-50 border border-stone-300 rounded-lg font-bold text-stone-900"
            />
            <span className="text-[10px] text-stone-500 mt-1 block">
              Valor fixo mensal com base na avaliação
            </span>
          </div>

          <div>
            <label className="block font-semibold text-stone-700 mb-1" htmlFor="input-seguro-a-vista">
              Seguro à Vista (Taxa de Abertura)
            </label>
            <input
              id="input-seguro-a-vista"
              type="text"
              value={((prop.seguroAVistaCentavos || 0) / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              onChange={(e) => {
                const num = parseFloat(e.target.value.replace(/\D/g, '')) || 0;
                handleAtualizarProposta({ seguroAVistaCentavos: num });
              }}
              className="w-full px-3 py-2 bg-stone-50 border border-stone-300 rounded-lg font-bold text-stone-900"
            />
            <span className="text-[10px] text-stone-500 mt-1 block">
              Paga no ato da assinatura contratual
            </span>
          </div>
        </div>
      </div>

      {/* 3. Encargos da Fase de Obra (Crédito Associativo / MCMV Planta) */}
      <div className="bg-white p-5 rounded-xl border border-stone-200 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-stone-200 pb-3">
          <div>
            <h3 className="text-sm font-bold text-stone-900 flex items-center gap-2">
              <HardHat className="w-4 h-4 text-amber-600" />
              Encargos da Fase de Obra (Juros de Obra)
            </h3>
            <p className="text-xs text-stone-600 mt-0.5">
              Aplicável a imóveis na planta com repasse financeiro durante a construção. O mutuário paga juros proporcionais ao saldo liberado, seguros e taxa de administração sem amortizar o principal.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs font-semibold text-stone-700 cursor-pointer flex items-center gap-1.5">
              <input
                type="checkbox"
                checked={faseObraConfig.ativo}
                onChange={(e) => handleAtualizarFaseObra({ ativo: e.target.checked })}
                className="rounded border-stone-300 text-amber-600 focus:ring-amber-500"
              />
              Simular Fase de Obra
            </label>
          </div>
        </div>

        {faseObraConfig.ativo ? (
          <div className="space-y-4">
            {/* Parâmetros da Obra */}
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs bg-stone-50/70 p-3 rounded-lg border border-stone-200">
              <div>
                <label className="block text-stone-600 font-semibold mb-1">Duração da Obra (meses):</label>
                <input
                  type="number"
                  min="6"
                  max="48"
                  value={faseObraConfig.duracaoMesesPrevista}
                  onChange={(e) => handleAtualizarFaseObra({ duracaoMesesPrevista: parseInt(e.target.value, 10) || 24 })}
                  className="w-full px-2 py-1.5 bg-white border border-stone-300 rounded font-semibold text-stone-900"
                />
              </div>

              <div>
                <label className="block text-stone-600 font-semibold mb-1">Curva de Liberação:</label>
                <select
                  value={faseObraConfig.regraLiberacao}
                  onChange={(e) => handleAtualizarFaseObra({ regraLiberacao: e.target.value as any })}
                  className="w-full px-2 py-1.5 bg-white border border-stone-300 rounded font-semibold text-stone-900"
                >
                  <option value="CURVA_S">Curva em S (Realista Construtora)</option>
                  <option value="LINEAR">Linear (Evolução Constante)</option>
                </select>
              </div>

              <div>
                <label className="block text-stone-600 font-semibold mb-1">Base de Cálculo MIP:</label>
                <select
                  value={faseObraConfig.baseCalculoMipObra}
                  onChange={(e) => handleAtualizarFaseObra({ baseCalculoMipObra: e.target.value as any })}
                  className="w-full px-2 py-1.5 bg-white border border-stone-300 rounded font-semibold text-stone-900"
                >
                  <option value="SALDO_LIBERADO">Sobre Saldo Liberado</option>
                  <option value="VALOR_FINANCIADO_TOTAL">Sobre Financiamento Total</option>
                </select>
              </div>

              <div>
                <label className="block text-stone-600 font-semibold mb-1">TR na Obra (% a.a.):</label>
                <input
                  type="number"
                  step="0.1"
                  value={faseObraConfig.trObraAnualPercent || 0}
                  onChange={(e) => handleAtualizarFaseObra({ trObraAnualPercent: parseFloat(e.target.value) || 0 })}
                  className="w-full px-2 py-1.5 bg-white border border-stone-300 rounded font-semibold text-stone-900"
                />
              </div>
            </div>

            {/* Resumo da Obra */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="p-3 bg-amber-50/50 border border-amber-200 rounded-lg">
                <span className="text-stone-500 block text-[10px]">1º Encargo de Obra</span>
                <strong className="text-amber-900 text-sm">
                  {toReais(encargosObra[0]?.encargoTotalMesCentavos || 0)}
                </strong>
                <span className="text-[10px] text-stone-500 block mt-0.5">Mês 1 da construção</span>
              </div>
              <div className="p-3 bg-amber-50/50 border border-amber-200 rounded-lg">
                <span className="text-stone-500 block text-[10px]">Último Encargo de Obra</span>
                <strong className="text-amber-900 text-sm">
                  {toReais(encargosObra[encargosObra.length - 1]?.encargoTotalMesCentavos || 0)}
                </strong>
                <span className="text-[10px] text-stone-500 block mt-0.5">Prestes a entregar as chaves</span>
              </div>
              <div className="p-3 bg-stone-50 border border-stone-200 rounded-lg">
                <span className="text-stone-500 block text-[10px]">Total Juros de Obra</span>
                <strong className="text-stone-900 text-sm">
                  {toReais(totalJurosObra)}
                </strong>
                <span className="text-[10px] text-stone-500 block mt-0.5">Custo a fundo perdido</span>
              </div>
              <div className="p-3 bg-stone-50 border border-stone-200 rounded-lg">
                <span className="text-stone-500 block text-[10px]">Total Desembolsado na Obra</span>
                <strong className="text-stone-900 text-sm">
                  {toReais(totalEncargosObra)}
                </strong>
                <span className="text-[10px] text-stone-500 block mt-0.5">Juros + Seguros + Tarifa Adm</span>
              </div>
            </div>

            {/* Tabela de Evolução da Fase de Obra */}
            <div className="border border-stone-200 rounded-xl overflow-hidden">
              <div className="bg-stone-100/80 px-4 py-2 border-b border-stone-200 font-bold text-xs text-stone-800 flex justify-between">
                <span>Cronograma Mês a Mês da Fase de Obra ({faseObraConfig.duracaoMesesPrevista} Meses)</span>
                <span className="text-stone-500 font-normal">Sem amortização de saldo</span>
              </div>
              <div className="max-h-52 overflow-y-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-stone-50 text-[10px] text-stone-600 font-semibold border-b border-stone-200 sticky top-0">
                    <tr>
                      <th className="px-3 py-2">Mês</th>
                      <th className="px-3 py-2">Competência</th>
                      <th className="px-3 py-2">% Obra</th>
                      <th className="px-3 py-2">Saldo Liberado</th>
                      <th className="px-3 py-2">Juros Obra</th>
                      <th className="px-3 py-2">MIP</th>
                      <th className="px-3 py-2">DFI</th>
                      <th className="px-3 py-2">Adm</th>
                      <th className="px-3 py-2 text-right">Encargo Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100">
                    {encargosObra.map((linha) => (
                      <tr key={linha.mesNumero} className="hover:bg-stone-50">
                        <td className="px-3 py-1.5 font-bold text-stone-900">{linha.mesNumero}</td>
                        <td className="px-3 py-1.5 text-stone-600">{linha.competencia}</td>
                        <td className="px-3 py-1.5 font-semibold text-stone-800">{linha.percentualAvancoAcumulado}%</td>
                        <td className="px-3 py-1.5 text-stone-700">{toReais(linha.saldoLiberadoCentavos)}</td>
                        <td className="px-3 py-1.5 text-amber-900 font-medium">{toReais(linha.jurosObraCentavos)}</td>
                        <td className="px-3 py-1.5 text-stone-600">{toReais(linha.seguroMipCentavos)}</td>
                        <td className="px-3 py-1.5 text-stone-600">{toReais(linha.seguroDfiCentavos)}</td>
                        <td className="px-3 py-1.5 text-stone-600">{toReais(linha.taxaAdministracaoCentavos)}</td>
                        <td className="px-3 py-1.5 font-bold text-stone-900 text-right">{toReais(linha.encargoTotalMesCentavos)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        ) : (
          <div className="p-4 bg-stone-50 rounded-lg text-xs text-stone-600 flex items-center gap-2">
            <Info className="w-4 h-4 text-stone-400 shrink-0" />
            <span>
              A fase de obra está desativada para este projeto. O financiamento segue o fluxo de amortização direta a partir da data de entrega ou contratação. Marque a caixa acima caso adquira imóvel na planta com repasse financeiro na obra.
            </span>
          </div>
        )}
      </div>

      {/* 4. Comparação Normalizada: SAC vs Price */}
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
