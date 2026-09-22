/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import Decimal from 'decimal.js';
import {
  ProjetoFinanciamento,
  PremissasCenario,
  ParcelaBancoLinha,
  LinhaCaixaMes,
  ReconciliacaoPreco,
  IndicadoresConsolidados,
  AlertaProjeto,
  SistemaAmortizacao,
  PropostaBancaria,
  EncargoMensalObraLinha,
  ConfiguracaoFaseObra
} from '../types';
import {
  adicionarMesesCivil,
  adicionarDiasCivil,
  resolverDataMarco,
  extrairCompetencia,
  calcularHorizonteCompetencias,
  diferencaMesesCivis
} from './calendar';
export {
  adicionarMesesCivil,
  adicionarDiasCivil,
  resolverDataMarco,
  extrairCompetencia,
  calcularHorizonteCompetencias,
  diferencaMesesCivis
};

// Define precisão padrão para cálculos monetários intermediários
Decimal.set({ precision: 28, rounding: Decimal.ROUND_HALF_UP });

export function toReais(centavos: number): string {
  return (centavos / 100).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

export function toPercent(val: number): string {
  return `${val.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;
}

/**
 * Converte taxa de juros nominal anual para taxa mensal
 * i_m = j_nominal_anual / 12
 */
export function converterTaxaNominalAnualParaMensal(taxaNominalAnualPercent: number): Decimal {
  const taxaAnualDec = new Decimal(taxaNominalAnualPercent).dividedBy(100);
  return taxaAnualDec.dividedBy(12);
}

/**
 * Converte taxa efetiva anual para taxa mensal equivalente
 * i_m = (1 + i_efetiva)^(1/12) - 1
 */
export function converterTaxaEfetivaAnualParaMensal(taxaEfetivaAnualPercent: number): Decimal {
  const taxaAnualDec = new Decimal(taxaEfetivaAnualPercent).dividedBy(100);
  return new Decimal(1).plus(taxaAnualDec).pow(new Decimal(1).dividedBy(12)).minus(1);
}

/**
 * Gera curva teórica de financiamento bancário SAC
 * Suporta atualização monetária pela TR com convenção de recálculo SFH/CAIXA
 * ou resíduo acumulado, sem salto artificial de balão na parcela final.
 */
export function gerarTabelaSAC(
  principalCentavos: number,
  prazoMeses: number,
  taxaMensal: Decimal,
  dataInicioIso: string,
  taxaAdmFixaCentavos: number = 2500, // R$ 25,00
  aliquotaMipPercent: number = 0.0163, // taxa mensal sobre saldo
  aliquotaDfiCentavos: number = 2840, // R$ 28,40 fixo ou tabela
  taxaTrMensal: Decimal = new Decimal(0),
  convencaoTR: 'RECALCULO_MENSAL_PADRAO_SFH' | 'AMORTIZACAO_ORIGINAL_COM_RESIDUO' = 'RECALCULO_MENSAL_PADRAO_SFH'
): ParcelaBancoLinha[] {
  const linhas: ParcelaBancoLinha[] = [];
  if (prazoMeses <= 0 || principalCentavos <= 0) return linhas;

  let saldoDevedor = new Decimal(principalCentavos);
  // Amortização teórica constante base = P / n
  const amortizacaoBase = new Decimal(principalCentavos).dividedBy(prazoMeses).round();

  for (let mes = 1; mes <= prazoMeses; mes++) {
    // Calendário civil robusto preservando o dia âncora
    const vencimentoIso = adicionarMesesCivil(dataInicioIso, mes - 1);
    const saldoInicialCentavos = saldoDevedor.toNumber();

    // Atualização monetária pela TR (se houver)
    let atualizacaoCentavos = 0;
    if (taxaTrMensal.greaterThan(0)) {
      atualizacaoCentavos = saldoDevedor.times(taxaTrMensal).round().toNumber();
      saldoDevedor = saldoDevedor.plus(atualizacaoCentavos);
    }

    // Juros do mês sobre o saldo corrigido
    const jurosCentavos = taxaMensal.isZero() ? 0 : saldoDevedor.times(taxaMensal).round().toNumber();

    // Amortização do mês: no padrão SFH/CAIXA, a TR atualiza o saldo e a amortização
    // é recalculada pelo prazo remanescente (A_k = SD_k / (n - k + 1)), extinguindo o saldo suavemente.
    const prazoRestante = prazoMeses - mes + 1;
    let amortCentavos = 0;

    if (mes === prazoMeses || prazoRestante <= 1) {
      amortCentavos = saldoDevedor.toNumber();
    } else if (convencaoTR === 'RECALCULO_MENSAL_PADRAO_SFH') {
      amortCentavos = saldoDevedor.dividedBy(prazoRestante).round().toNumber();
    } else {
      // Amortização nominal original com resíduo acumulado no final
      amortCentavos = Math.min(saldoDevedor.toNumber(), amortizacaoBase.toNumber());
    }

    if (saldoDevedor.minus(amortCentavos).lessThanOrEqualTo(0)) {
      amortCentavos = saldoDevedor.toNumber();
    }

    const prestacaoCentavos = amortCentavos + jurosCentavos;
    // Na última prestação da CAIXA, MIP e DFI são zerados conforme apólice habitacional
    const mipCentavos = (mes === prazoMeses || aliquotaMipPercent === 0)
      ? 0 
      : saldoDevedor.times(aliquotaMipPercent).dividedBy(100).round().toNumber();
    const dfiCentavos = mes === prazoMeses ? 0 : aliquotaDfiCentavos;
    const taxaAdmCentavos = taxaAdmFixaCentavos;

    const encargoTotalCentavos = prestacaoCentavos + mipCentavos + dfiCentavos + taxaAdmCentavos;

    saldoDevedor = saldoDevedor.minus(amortCentavos);
    const saldoFinalCentavos = Math.max(0, saldoDevedor.toNumber());

    linhas.push({
      numero: mes,
      vencimento: vencimentoIso,
      saldoDevedorInicialCentavos: saldoInicialCentavos,
      atualizacaoCentavos,
      amortizacaoCentavos: amortCentavos,
      jurosCentavos: jurosCentavos,
      prestacaoCentavos: prestacaoCentavos,
      seguroMipCentavos: mipCentavos,
      seguroDfiCentavos: dfiCentavos,
      taxaAdmCentavos: taxaAdmCentavos,
      encargoTotalCentavos: encargoTotalCentavos,
      saldoDevedorFinalCentavos: saldoFinalCentavos,
      rotulo: 'CALCULADO',
      origemTexto: 'Motor SAC Determinístico'
    });

    if (saldoFinalCentavos === 0) break;
  }

  return linhas;
}

/**
 * Gera curva teórica de financiamento bancário Price
 * Suporta Taxa Zero explícita (mantendo seguros se contratados), TR e calendário civil.
 */
export function gerarTabelaPrice(
  principalCentavos: number,
  prazoMeses: number,
  taxaMensal: Decimal,
  dataInicioIso: string,
  taxaAdmFixaCentavos: number = 2500,
  aliquotaMipPercent: number = 0.0163,
  aliquotaDfiCentavos: number = 2840,
  taxaTrMensal: Decimal = new Decimal(0),
  convencaoTR: 'RECALCULO_MENSAL_PADRAO_SFH' | 'AMORTIZACAO_ORIGINAL_COM_RESIDUO' = 'RECALCULO_MENSAL_PADRAO_SFH'
): ParcelaBancoLinha[] {
  const linhas: ParcelaBancoLinha[] = [];
  if (prazoMeses <= 0 || principalCentavos <= 0) return linhas;

  let saldoDevedor = new Decimal(principalCentavos);

  // Amortização teórica base
  const amortizacaoBase = new Decimal(principalCentavos).dividedBy(prazoMeses).round();

  for (let mes = 1; mes <= prazoMeses; mes++) {
    const vencimentoIso = adicionarMesesCivil(dataInicioIso, mes - 1);
    const saldoInicialCentavos = saldoDevedor.toNumber();

    // TR (se houver)
    let atualizacaoCentavos = 0;
    if (taxaTrMensal.greaterThan(0)) {
      atualizacaoCentavos = saldoDevedor.times(taxaTrMensal).round().toNumber();
      saldoDevedor = saldoDevedor.plus(atualizacaoCentavos);
    }

    const prazoRestante = prazoMeses - mes + 1;
    const jurosCentavos = taxaMensal.isZero() ? 0 : saldoDevedor.times(taxaMensal).round().toNumber();

    let pmtTeorico: Decimal;
    if (taxaMensal.isZero()) {
      pmtTeorico = saldoDevedor.dividedBy(prazoRestante).round();
    } else if (convencaoTR === 'RECALCULO_MENSAL_PADRAO_SFH' && taxaTrMensal.greaterThan(0)) {
      const umMaisI = new Decimal(1).plus(taxaMensal);
      const umMaisIMenosN = umMaisI.pow(-prazoRestante);
      const denominador = new Decimal(1).minus(umMaisIMenosN);
      pmtTeorico = saldoDevedor.times(taxaMensal).dividedBy(denominador).round();
    } else {
      const umMaisI = new Decimal(1).plus(taxaMensal);
      const umMaisIMenosN = umMaisI.pow(-prazoMeses);
      const denominador = new Decimal(1).minus(umMaisIMenosN);
      pmtTeorico = new Decimal(principalCentavos).times(taxaMensal).dividedBy(denominador).round();
    }

    let amortCentavos = taxaMensal.isZero()
      ? (mes === prazoMeses ? saldoDevedor.toNumber() : pmtTeorico.toNumber())
      : pmtTeorico.minus(jurosCentavos).toNumber();

    if (mes === prazoMeses || saldoDevedor.minus(amortCentavos).lessThanOrEqualTo(0)) {
      amortCentavos = saldoDevedor.toNumber();
    }

    const prestacaoCentavos = amortCentavos + jurosCentavos;
    const mipCentavos = (mes === prazoMeses || aliquotaMipPercent === 0)
      ? 0
      : saldoDevedor.times(aliquotaMipPercent).dividedBy(100).round().toNumber();
    const dfiCentavos = mes === prazoMeses ? 0 : aliquotaDfiCentavos;
    const taxaAdmCentavos = taxaAdmFixaCentavos;

    const encargoTotalCentavos = prestacaoCentavos + mipCentavos + dfiCentavos + taxaAdmCentavos;

    saldoDevedor = saldoDevedor.minus(amortCentavos);
    const saldoFinalCentavos = Math.max(0, saldoDevedor.toNumber());

    linhas.push({
      numero: mes,
      vencimento: vencimentoIso,
      saldoDevedorInicialCentavos: saldoInicialCentavos,
      atualizacaoCentavos,
      amortizacaoCentavos: amortCentavos,
      jurosCentavos: jurosCentavos,
      prestacaoCentavos: prestacaoCentavos,
      seguroMipCentavos: mipCentavos,
      seguroDfiCentavos: dfiCentavos,
      taxaAdmCentavos: taxaAdmCentavos,
      encargoTotalCentavos: encargoTotalCentavos,
      saldoDevedorFinalCentavos: saldoFinalCentavos,
      rotulo: 'CALCULADO',
      origemTexto: taxaMensal.isZero() ? 'Motor Taxa Zero (0% Juros)' : 'Motor Price Determinístico'
    });

    if (saldoFinalCentavos === 0) break;
  }

  return linhas;
}

/**
 * Gera os encargos e seguros mês a mês durante a fase de obras (construção).
 * Discrimina de forma independente: Juros de Obra, MIP na Obra, DFI na Obra,
 * Taxa de Administração e Atualização Monetária.
 */
export function gerarEncargosFaseObra(
  valorFinanciadoCentavos: number,
  avaliacaoImovelCentavos: number,
  mesesObra: number,
  dataInicioIso: string,
  taxaMensalBanco: Decimal,
  aliquotaMipPercent: number,
  aliquotaDfiCentavos: number,
  taxaAdmCentavos: number,
  config?: ConfiguracaoFaseObra,
  trAnualPercent: number = 0
): EncargoMensalObraLinha[] {
  const linhas: EncargoMensalObraLinha[] = [];
  if (mesesObra <= 0 || valorFinanciadoCentavos <= 0) return linhas;

  const regra = config?.regraLiberacao || 'LINEAR';
  const taxaTrMensal = trAnualPercent > 0
    ? new Decimal(1).plus(new Decimal(trAnualPercent).dividedBy(100)).pow(new Decimal(1).dividedBy(12)).minus(1)
    : new Decimal(0);

  for (let m = 1; m <= mesesObra; m++) {
    const compStr = extrairCompetencia(adicionarMesesCivil(dataInicioIso, m - 1));
    let pctAcumulado = 0;

    if (regra === 'LINEAR') {
      pctAcumulado = Math.min(1, m / mesesObra);
    } else if (regra === 'CURVA_S') {
      // Curva em S suave (Hermite smoothing): avanço moderado no início e fim
      const t = m / mesesObra;
      pctAcumulado = Math.min(1, Math.max(0, 3 * Math.pow(t, 2) - 2 * Math.pow(t, 3)));
    } else if (regra === 'CRONOGRAMA_MEDICOES_CUSTOM' && config?.cronogramaMedicoesCustom) {
      const itemCustom = config.cronogramaMedicoesCustom.find(c => c.mesNumero === m);
      if (itemCustom) {
        pctAcumulado = itemCustom.percentualLiberadoAcumulado / 100;
      } else {
        pctAcumulado = Math.min(1, m / mesesObra);
      }
    }

    const saldoLiberadoAcumuladoDec = new Decimal(valorFinanciadoCentavos).times(pctAcumulado).round();
    const saldoLiberadoCentavos = saldoLiberadoAcumuladoDec.toNumber();

    // Atualização monetária TR na obra (se configurada)
    let atualizacaoCentavos = 0;
    if (config?.indiceAtualizacaoObra === 'TR' && taxaTrMensal.greaterThan(0)) {
      atualizacaoCentavos = saldoLiberadoAcumuladoDec.times(taxaTrMensal).round().toNumber();
    }

    // Juros de obra calculados estritamente sobre o saldo devedor liberado acumulado pelo banco
    const jurosObraCentavos = taxaMensalBanco.isZero()
      ? 0
      : saldoLiberadoAcumuladoDec.plus(atualizacaoCentavos).times(taxaMensalBanco).round().toNumber();

    // MIP na obra: sobre saldo liberado ou sobre valor total financiado
    const baseMip = (config?.baseCalculoMipObra === 'VALOR_TOTAL_FINANCIADO')
      ? new Decimal(valorFinanciadoCentavos)
      : saldoLiberadoAcumuladoDec;
    const aliquotaMip = config?.aliquotaMipObraPercent !== undefined ? config.aliquotaMipObraPercent : aliquotaMipPercent;
    const seguroMipCentavos = aliquotaMip > 0
      ? baseMip.times(aliquotaMip).dividedBy(100).round().toNumber()
      : 0;

    // DFI na obra: valor contratado
    const seguroDfiCentavos = config?.aliquotaDfiObraCentavos !== undefined
      ? config.aliquotaDfiObraCentavos
      : aliquotaDfiCentavos;

    // Taxa de administração na obra
    const taxaAdministracaoCentavos = config?.taxaAdmObraCentavos !== undefined
      ? config.taxaAdmObraCentavos
      : taxaAdmCentavos;

    const encargoTotalMesCentavos = jurosObraCentavos + atualizacaoCentavos + seguroMipCentavos + seguroDfiCentavos + taxaAdministracaoCentavos;

    linhas.push({
      mesNumero: m,
      competencia: compStr,
      percentualAvancoAcumulado: Math.round(pctAcumulado * 100),
      saldoLiberadoCentavos,
      jurosObraCentavos,
      atualizacaoMonetariaCentavos: atualizacaoCentavos,
      seguroMipCentavos,
      seguroDfiCentavos,
      taxaAdministracaoCentavos,
      encargoTotalMesCentavos,
      origemCalculo: `Medição mês ${m} (${Math.round(pctAcumulado * 100)}% liberado)`
    });
  }

  return linhas;
}

/**
 * Despacho unificado de geração de tabela bancária.
 * Trata TAXA_ZERO mantendo seguros se contratados, aplica a TR do cenário
 * e respeita o início da amortização pós-chaves na planta com banco na obra.
 */
export function gerarTabelaFinanciamento(
  prop: PropostaBancaria,
  trAnualPercent: number = 0,
  dataInicioVencimentoIso?: string,
  convencaoTR: 'RECALCULO_MENSAL_PADRAO_SFH' | 'AMORTIZACAO_ORIGINAL_COM_RESIDUO' = 'RECALCULO_MENSAL_PADRAO_SFH',
  valorFinanciadoOverrideCentavos?: number
): ParcelaBancoLinha[] {
  if (prop.sistema === 'TABELA_IMPORTADA' && prop.tabelaImportada && prop.tabelaImportada.length > 0) {
    return prop.tabelaImportada;
  }

  const principalCentavos = valorFinanciadoOverrideCentavos !== undefined
    ? valorFinanciadoOverrideCentavos
    : prop.valorFinanciadoCentavos;

  const dataInicio = dataInicioVencimentoIso || prop.dataPrimeiroVencimento;

  const taxaTrMensal = trAnualPercent > 0
    ? new Decimal(1).plus(new Decimal(trAnualPercent).dividedBy(100)).pow(new Decimal(1).dividedBy(12)).minus(1)
    : new Decimal(0);

  if (prop.sistema === 'TAXA_ZERO') {
    // Taxa Zero: juros zerados, mas mantém seguros contratados conforme apólice
    return gerarTabelaPrice(
      principalCentavos,
      prop.prazoMeses,
      new Decimal(0),
      dataInicio,
      prop.taxaAdmFixaMensalCentavos,
      prop.aliquotaMipInicialPercent,
      prop.aliquotaDfiMensalCentavos,
      new Decimal(0),
      convencaoTR
    );
  }

  const taxaMensal = converterTaxaNominalAnualParaMensal(prop.taxaJurosNominalAnualPercent);
  if (prop.sistema === 'SAC') {
    return gerarTabelaSAC(
      principalCentavos,
      prop.prazoMeses,
      taxaMensal,
      dataInicio,
      prop.taxaAdmFixaMensalCentavos,
      prop.aliquotaMipInicialPercent,
      prop.aliquotaDfiMensalCentavos,
      taxaTrMensal,
      convencaoTR
    );
  } else {
    return gerarTabelaPrice(
      principalCentavos,
      prop.prazoMeses,
      taxaMensal,
      dataInicio,
      prop.taxaAdmFixaMensalCentavos,
      prop.aliquotaMipInicialPercent,
      prop.aliquotaDfiMensalCentavos,
      taxaTrMensal,
      convencaoTR
    );
  }
}

/**
 * Reconciliação do preço do imóvel e integridade das fontes e obrigações.
 * Corrige F03:
 * - Valida preço vs fontes
 * - Valida preço vs obrigações com o vendedor
 * - Valida consistência entre o principal bancário e a fonte de financiamento (R04)
 * - Detecta obrigações vazias ou insuficientes (R03)
 */
export function calcularReconciliacaoPreco(projeto: ProjetoFinanciamento): ReconciliacaoPreco {
  const preco = projeto.precoImovelCentavos;
  const descontos = projeto.descontosBonus;

  const descontoComercialCentavos = (descontos?.ativo ? descontos.descontoComercialCentavos : 0) || 0;
  const bonusPontualidadeCentavos = (descontos?.ativo ? descontos.bonusPontualidadeCentavos : 0) || 0;
  const totalDescontosCentavos = descontoComercialCentavos + bonusPontualidadeCentavos;
  const precoEfetivoCentavos = Math.max(0, preco - totalDescontosCentavos);

  // Fontes destinadas ao preço
  const fontesPreco = projeto.fontes.filter(f => f.destino === 'PRECO');
  const somaFontesPrecoCentavos = fontesPreco.reduce((acc, f) => acc + f.valorCentavos, 0);

  // Obrigações com o vendedor que compõem a liquidação
  const somaObrigacoesPrecoCentavos = projeto.obrigacoesVendedor.reduce(
    (acc, o) => acc + o.valorBaseCentavos, 0
  );

  const diferencaNaoConciliadaCentavos = precoEfetivoCentavos - somaFontesPrecoCentavos;
  const fontesFechamPreco = Math.abs(diferencaNaoConciliadaCentavos) <= 1;

  const pendencias: string[] = [];

  // Verificação 1: Obrigações com o vendedor cadastradas (R03)
  let obrigacoesFechamPreco = true;
  if (projeto.obrigacoesVendedor.length === 0) {
    pendencias.push('Nenhuma obrigação com o vendedor cadastrada. O projeto requer agenda de liquidação.');
    obrigacoesFechamPreco = false;
  } else {
    const difObrigacoesEfetivo = Math.abs(somaObrigacoesPrecoCentavos - precoEfetivoCentavos);
    const difObrigacoesBruto = Math.abs(somaObrigacoesPrecoCentavos - preco);
    if (difObrigacoesEfetivo > 1 && difObrigacoesBruto > 1) {
      pendencias.push(
        `A soma das obrigações com o vendedor (${toReais(somaObrigacoesPrecoCentavos)}) diverge do preço a quitar (${toReais(precoEfetivoCentavos)}).`
      );
      obrigacoesFechamPreco = false;
    }
  }

  // Verificação 2: Consistência entre a Proposta Bancária e a Fonte de Crédito (R04)
  const fonteBanco = fontesPreco.find(f => f.tipo === 'CREDITO_BANCO');
  let creditoBancoConfere = true;
  let deficitCreditoBancoCentavos = 0;
  if (fonteBanco) {
    if (projeto.propostaBancaria.valorFinanciadoCentavos !== fonteBanco.valorCentavos) {
      pendencias.push(
        `Inconsistência bancária: O valor financiado na proposta (${toReais(projeto.propostaBancaria.valorFinanciadoCentavos)}) difere da fonte bancária declarada (${toReais(fonteBanco.valorCentavos)}).`
      );
      creditoBancoConfere = false;
      deficitCreditoBancoCentavos = Math.abs(projeto.propostaBancaria.valorFinanciadoCentavos - fonteBanco.valorCentavos);
    }
  }

  // Verificação 3: Detecção de fontes duplicadas (R02)
  const fontesVistas = new Set<string>();
  for (const f of projeto.fontes) {
    if (fontesVistas.has(f.id)) {
      pendencias.push(`Fonte com ID duplicado detectada: ${f.nome} (${f.id}).`);
    }
    fontesVistas.add(f.id);
  }

  const fechado = fontesFechamPreco && obrigacoesFechamPreco && creditoBancoConfere && pendencias.length === 0;

  return {
    precoImovelCentavos: preco,
    descontoComercialCentavos,
    bonusPontualidadeCentavos,
    precoEfetivoCentavos,
    somaFontesPrecoCentavos,
    somaObrigacoesPrecoCentavos,
    diferencaNaoConciliadaCentavos,
    fechado,
    fontesFechamPreco,
    obrigacoesFechamPreco,
    creditoBancoConfere,
    deficitCreditoBancoCentavos,
    pendencias,
    detalheFontes: fontesPreco.map(f => ({ tipo: f.nome, valorCentavos: f.valorCentavos })),
    detalheObrigacoes: projeto.obrigacoesVendedor.map(o => ({ tipo: o.descricao, valorCentavos: o.valorBaseCentavos }))
  };
}

/**
 * Simula a evolução do caixa familiar e dos encargos mês a mês.
 * Corrige integralmente:
 * - Duplicação do principal no Custo Total da Aquisição (Item 1)
 * - Recálculo efetivo da redução de crédito e liquidação do déficit no caixa (Item 2)
 * - Recálculo do saldo na TR sem salto artificial de balão residual (Item 3)
 * - Preservação de todas as 420 parcelas após a conclusão da obra (Item 4)
 * - Discriminação completa de Juros, Seguros e Tarifas na fase de obras
 * - Respeito a diasAposMarco e marcos temporais com atraso civil
 */
export function simularProjetoCompleto(
  projeto: ProjetoFinanciamento,
  cenario: PremissasCenario
): {
  linhasCaixa: LinhaCaixaMes[];
  reconciliacao: ReconciliacaoPreco;
  indicadores: IndicadoresConsolidados;
  alertas: AlertaProjeto[];
  tabelaBancariaUsada: ParcelaBancoLinha[];
  encargosFaseObraUsados?: EncargoMensalObraLinha[];
} {
  const alertas: AlertaProjeto[] = [];
  const reconciliacao = calcularReconciliacaoPreco(projeto);

  if (!reconciliacao.fechado) {
    alertas.push({
      codigo: 'PRECO_NAO_FECHA',
      severidade: 'BLOQUEANTE',
      titulo: 'Preço ou Obrigações com Inconsistência de Conciliação',
      mensagem: reconciliacao.pendencias && reconciliacao.pendencias.length > 0
        ? reconciliacao.pendencias.join(' | ')
        : `Diferença não conciliada de ${toReais(reconciliacao.diferencaNaoConciliadaCentavos)}. As fontes e obrigações devem fechar o preço do contrato.`,
      acaoSugerida: 'Revise os valores das fontes, da proposta bancária e das obrigações com o vendedor.'
    });
  }

  const prop = projeto.propostaBancaria;
  const modalidade = projeto.modalidade || 'PRONTO';

  // Resolução dos marcos com atraso de obra civil
  const marcoChaves = projeto.marcos.find(m => m.tipo === 'CHAVES');
  const marcoMudanca = projeto.marcos.find(m => m.tipo === 'MUDANCA_EFETIVA');

  let dataChavesEfetivaStr = marcoChaves?.dataPrevista || projeto.dataBase;
  if (cenario.atrasoObraMeses > 0) {
    dataChavesEfetivaStr = adicionarMesesCivil(dataChavesEfetivaStr, cenario.atrasoObraMeses);
  }

  let dataMudancaEfetivaStr = marcoMudanca?.dataPrevista || dataChavesEfetivaStr;
  if (cenario.atrasoObraMeses > 0) {
    dataMudancaEfetivaStr = adicionarMesesCivil(dataMudancaEfetivaStr, cenario.atrasoObraMeses);
  }

  const compChaves = extrairCompetencia(dataChavesEfetivaStr);
  const compMudanca = extrairCompetencia(dataMudancaEfetivaStr);

  // Mapa de marcos para resolução dinâmica de datas com diasAposMarco
  const marcosMap: Record<string, string> = {};
  for (const m of projeto.marcos) {
    let dt = m.dataPrevista || projeto.dataBase;
    if (m.tipo === 'CHAVES') dt = dataChavesEfetivaStr;
    if (m.tipo === 'MUDANCA_EFETIVA') dt = dataMudancaEfetivaStr;
    marcosMap[m.tipo] = dt;
  }
  if (!marcosMap['CHAVES']) marcosMap['CHAVES'] = dataChavesEfetivaStr;
  if (!marcosMap['MUDANCA_EFETIVA']) marcosMap['MUDANCA_EFETIVA'] = dataMudancaEfetivaStr;

  // 1. Recálculo efetivo da redução de crédito aprovado pelo banco (Item 2)
  const variacaoCredito = cenario.variacaoCreditoPercent || 0;
  const fatorCredito = 1 + (variacaoCredito / 100);
  const valorFinanciadoEfetivoCentavos = Math.round(prop.valorFinanciadoCentavos * Math.max(0, fatorCredito));
  const deficitCreditoCentavos = Math.max(0, prop.valorFinanciadoCentavos - valorFinanciadoEfetivoCentavos);

  if (variacaoCredito < 0) {
    alertas.push({
      codigo: 'SALDO_RESIDUAL',
      severidade: 'BLOQUEANTE',
      titulo: `Déficit de Financiamento por Redução de Crédito do Banco (${variacaoCredito}%)`,
      mensagem: `No cenário de estresse, o crédito bancário aprovado foi reduzido em ${Math.abs(variacaoCredito)}% (novo valor financiado: ${toReais(valorFinanciadoEfetivoCentavos)}). O déficit de ${toReais(deficitCreditoCentavos)} foi exigido no caixa familiar na entrega das chaves/repasse como aporte complementar obrigatório.`,
      acaoSugerida: 'Adicione uma fonte complementar de recursos próprios ou renegocie o valor de repasse com a construtora.'
    });
  }

  // 2. Transição da fase de obra e data de início da amortização (Item 4)
  const mesesObraTotal = Math.max(1, diferencaMesesCivis(projeto.dataBase, dataChavesEfetivaStr));
  let dataInicioAmortizacao = prop.dataPrimeiroVencimento;

  if (modalidade === 'PLANTA_COM_BANCO_NA_OBRA' || modalidade === 'PLANTA_COM_REPASSE_FUTURO') {
    const regraInicio = projeto.faseObraConfig?.regraInicioAmortizacao || 'MES_SUBSEQUENTE_CHAVES';
    if (regraInicio === 'DATA_FIXA' && projeto.faseObraConfig?.dataInicioAmortizacaoFixa) {
      dataInicioAmortizacao = projeto.faseObraConfig.dataInicioAmortizacaoFixa;
    } else if (regraInicio === 'MES_CHAVES') {
      dataInicioAmortizacao = dataChavesEfetivaStr;
    } else {
      dataInicioAmortizacao = adicionarMesesCivil(dataChavesEfetivaStr, 1);
    }
  }

  // Geração da tabela de amortização com valor efetivo e data de transição pós-chaves
  const tabelaBancaria = gerarTabelaFinanciamento(
    prop,
    cenario.trAnualPercent,
    dataInicioAmortizacao,
    cenario.convencaoAmortizacaoTR,
    valorFinanciadoEfetivoCentavos
  );

  // Geração dos encargos discriminados da fase de obras
  const taxaMensalBanco = converterTaxaNominalAnualParaMensal(prop.taxaJurosNominalAnualPercent);
  const encargosFaseObra: EncargoMensalObraLinha[] = (modalidade === 'PLANTA_COM_BANCO_NA_OBRA')
    ? gerarEncargosFaseObra(
        valorFinanciadoEfetivoCentavos,
        projeto.avaliacaoBancariaCentavos || projeto.precoImovelCentavos,
        mesesObraTotal,
        projeto.dataBase,
        taxaMensalBanco,
        prop.aliquotaMipInicialPercent,
        prop.aliquotaDfiMensalCentavos,
        prop.taxaAdmFixaMensalCentavos,
        projeto.faseObraConfig,
        cenario.trAnualPercent
      )
    : [];

  // Horizonte contínuo completo com resolução de diasAposMarco
  const datasObrigacoes = projeto.obrigacoesVendedor.map(o =>
    resolverDataMarco(o.vencimento, o.vinculoMarco, o.diasAposMarco, marcosMap)
  );
  const datasCustos = projeto.custosComplementares.map(c =>
    resolverDataMarco(c.vencimento, c.vinculoMarco, c.diasAposMarco, marcosMap)
  );

  const todasAsDatas: string[] = [
    projeto.dataBase,
    dataChavesEfetivaStr,
    dataMudancaEfetivaStr,
    ...datasObrigacoes,
    ...datasCustos,
    ...tabelaBancaria.map(p => p.vencimento)
  ];
  const competencias = calcularHorizonteCompetencias(projeto.dataBase, todasAsDatas, 60);

  const linhasCaixa: LinhaCaixaMes[] = [];

  let saldoCaixaAtual = new Decimal(projeto.caixaInicialCentavos);
  let menorSaldoCaixa = saldoCaixaAtual.toNumber();
  let mesMenorSaldo = competencias[0] || projeto.dataBase.substring(0, 7);
  let maiorDesembolso = 0;
  let mesMaiorDesembolso = competencias[0] || projeto.dataBase.substring(0, 7);
  let primeiroMesInsuficiencia: string | null = null;
  let maxDeficitReserva = 0;
  let saldoCaixaNasChaves = 0;

  // Acumuladores de custos sem duplicação de principal
  let recursosPropriosPagosVendedor = 0;
  let fgtsUtilizado = 0;
  let subsidioUtilizado = 0;
  let repasseFinanciado = 0;
  let custoTotalEncargosObraBanco = 0;
  let custoTotalFinanciamentoAmortizacaoBanco = 0;
  let custoTotalJurosBanco = 0;
  let custoTotalSegurosBanco = 0;
  let custoTotalTaxasAdmBanco = 0;
  let custoTotalPagoBanco = 0;
  let custoTotalPagoVendedor = 0;
  let custoTotalCustosComplementares = 0;

  const taxaInccMensal = new Decimal(cenario.inccAnualPercent).dividedBy(100).dividedBy(12);

  // Flag para aplicar o déficit de crédito bancário uma única vez na data do repasse/chaves
  let deficitCreditoAplicado = false;

  for (let mesIdx = 0; mesIdx < competencias.length; mesIdx++) {
    const competenciaStr = competencias[mesIdx];
    const eventosDoMes: LinhaCaixaMes['eventosDoMes'] = [];

    // 1. Receitas familiares
    let receitasDoMesCentavos = 0;
    for (const rec of projeto.receitas) {
      if (rec.mesInicio && competenciaStr < rec.mesInicio) continue;
      if (rec.mesFim && competenciaStr > rec.mesFim) continue;

      if (rec.recorrenteMensal || (rec.dataCompetencia && rec.dataCompetencia.startsWith(competenciaStr))) {
        let val = new Decimal(rec.valorCentavos);
        if (cenario.variacaoRendaPercent !== 0) {
          val = val.times(new Decimal(1).plus(new Decimal(cenario.variacaoRendaPercent).dividedBy(100)));
        }
        const valCent = val.round().toNumber();
        receitasDoMesCentavos += valCent;
        eventosDoMes.push({
          categoria: 'RECEITA',
          descricao: rec.descricao + (cenario.variacaoRendaPercent !== 0 ? ` (${cenario.variacaoRendaPercent > 0 ? '+' : ''}${cenario.variacaoRendaPercent}% estresse)` : ''),
          valorCentavos: valCent,
          destinatario: 'FAMILIA'
        });
      }
    }

    // 2. Despesas da família (moradia cessa na mudança se configurada)
    let despesasVidaCentavos = 0;
    let moradiaAtualCentavos = 0;
    let outrasDividasCentavos = 0;

    for (const desp of projeto.despesas) {
      if (desp.mesInicio && competenciaStr < desp.mesInicio) continue;
      if (desp.mesFim && competenciaStr > desp.mesFim) continue;

      if (desp.categoria === 'MORADIA_ATUAL') {
        if (desp.cessaNaMudanca && competenciaStr >= compMudanca) {
          continue;
        }
        moradiaAtualCentavos += desp.valorCentavos;
        eventosDoMes.push({
          categoria: 'MORADIA_ATUAL',
          descricao: desp.descricao,
          valorCentavos: desp.valorCentavos,
          destinatario: 'FAMILIA'
        });
      } else if (desp.categoria === 'OUTRA_DIVIDA') {
        outrasDividasCentavos += desp.valorCentavos;
        eventosDoMes.push({
          categoria: 'OUTRA_DIVIDA',
          descricao: desp.descricao,
          valorCentavos: desp.valorCentavos,
          destinatario: 'FAMILIA'
        });
      } else {
        despesasVidaCentavos += desp.valorCentavos;
        eventosDoMes.push({
          categoria: 'DESPESA_VIDA',
          descricao: desp.descricao,
          valorCentavos: desp.valorCentavos,
          destinatario: 'FAMILIA'
        });
      }
    }

    // 3. Desembolso com Vendedor & Liquidações de Fontes
    let desembolsoVendedorCentavos = 0;
    for (let oIdx = 0; oIdx < projeto.obrigacoesVendedor.length; oIdx++) {
      const ob = projeto.obrigacoesVendedor[oIdx];
      if (ob.pagoAntecipado) continue;

      // Resolução de vencimento com diasAposMarco (Item 7)
      const vencimentoEfetivo = resolverDataMarco(ob.vencimento, ob.vinculoMarco, ob.diasAposMarco, marcosMap);
      const obComp = extrairCompetencia(vencimentoEfetivo);

      if (obComp === competenciaStr) {
        let valorCorrigido = new Decimal(ob.valorBaseCentavos);
        if (ob.indiceCorrecao === 'INCC' && taxaInccMensal.greaterThan(0)) {
          const mesesDecorrido = Math.max(0, mesIdx);
          const fator = new Decimal(1).plus(taxaInccMensal).pow(mesesDecorrido);
          valorCorrigido = valorCorrigido.times(fator).round();
        }

        const valCent = valorCorrigido.toNumber();

        const ehRepasseBancario = ob.tipo === 'REPASSE_FINANCIAMENTO' || ob.responsavelPagamento === 'BANCO';
        const ehFgts = ob.responsavelPagamento === 'FGTS' || (ob.tipo === 'OUTRO' && ob.descricao.toUpperCase().includes('FGTS'));
        const ehSubsidio = ob.responsavelPagamento === 'SUBSIDIO' || (ob.tipo === 'OUTRO' && (ob.descricao.toUpperCase().includes('SUBSÍDIO') || ob.descricao.toUpperCase().includes('SUBSIDIO')));

        custoTotalPagoVendedor += valCent;

        if (ehRepasseBancario) {
          // Repasse do banco à construtora (recurso financiado que o comprador pagará ao banco)
          const repasseRealCentavos = Math.min(valCent, valorFinanciadoEfetivoCentavos);
          repasseFinanciado += repasseRealCentavos;

          eventosDoMes.push({
            categoria: 'LIQUIDACAO_DIRETA',
            descricao: `${ob.descricao} (Repasse Bancário efetivo à Construtora: ${toReais(repasseRealCentavos)})`,
            valorCentavos: repasseRealCentavos,
            destinatario: 'VENDEDOR'
          });

          // Se houve redução de crédito, o déficit precisa ser quitado pelo comprador
          if (deficitCreditoCentavos > 0 && !deficitCreditoAplicado) {
            desembolsoVendedorCentavos += deficitCreditoCentavos;
            recursosPropriosPagosVendedor += deficitCreditoCentavos;
            deficitCreditoAplicado = true;
            eventosDoMes.push({
              categoria: 'VENDEDOR',
              descricao: `Aporte Complementar de Recursos Próprios (Déficit de ${Math.abs(variacaoCredito)}% no Financiamento Bancário)`,
              valorCentavos: deficitCreditoCentavos,
              destinatario: 'VENDEDOR'
            });
          }
        } else if (ehFgts) {
          fgtsUtilizado += valCent;
          eventosDoMes.push({
            categoria: 'LIQUIDACAO_DIRETA',
            descricao: `${ob.descricao} (Liquidado via FGTS - sem débito no caixa familiar)`,
            valorCentavos: valCent,
            destinatario: 'VENDEDOR'
          });
        } else if (ehSubsidio) {
          subsidioUtilizado += valCent;
          eventosDoMes.push({
            categoria: 'LIQUIDACAO_DIRETA',
            descricao: `${ob.descricao} (Liquidado via Subsídio Habitacional MCMV)`,
            valorCentavos: valCent,
            destinatario: 'VENDEDOR'
          });
        } else {
          // Recursos próprios pagos pelo comprador
          const afetaCaixa = ob.afetaCaixaLivre !== undefined ? ob.afetaCaixaLivre : true;
          if (afetaCaixa) {
            desembolsoVendedorCentavos += valCent;
            recursosPropriosPagosVendedor += valCent;
            eventosDoMes.push({
              categoria: 'VENDEDOR',
              descricao: ob.descricao + (ob.indiceCorrecao !== 'SEM_CORRECAO' ? ' (com INCC projetado)' : ''),
              valorCentavos: valCent,
              destinatario: 'VENDEDOR'
            });
          } else {
            eventosDoMes.push({
              categoria: 'LIQUIDACAO_DIRETA',
              descricao: `${ob.descricao} (Liquidado direto sem débito em caixa)`,
              valorCentavos: valCent,
              destinatario: 'VENDEDOR'
            });
          }
        }
      }
    }

    // Se houve déficit de crédito e não havia linha de repasse no mês, aplica no mês das chaves
    if (deficitCreditoCentavos > 0 && !deficitCreditoAplicado && competenciaStr === compChaves) {
      desembolsoVendedorCentavos += deficitCreditoCentavos;
      recursosPropriosPagosVendedor += deficitCreditoCentavos;
      deficitCreditoAplicado = true;
      eventosDoMes.push({
        categoria: 'VENDEDOR',
        descricao: `Aporte Complementar de Recursos Próprios (Déficit de ${Math.abs(variacaoCredito)}% no Crédito Bancário)`,
        valorCentavos: deficitCreditoCentavos,
        destinatario: 'VENDEDOR'
      });
    }

    // Reativação da dívida do Bônus de Pontualidade nas chaves se configurado
    if (
      projeto.descontosBonus?.ativo &&
      cenario.perderBonusPontualidade &&
      projeto.descontosBonus.reverterBonusSeAtrasar !== false &&
      projeto.descontosBonus.bonusPontualidadeCentavos > 0 &&
      competenciaStr === compChaves
    ) {
      const valBonus = projeto.descontosBonus.bonusPontualidadeCentavos;
      desembolsoVendedorCentavos += valBonus;
      recursosPropriosPagosVendedor += valBonus;
      custoTotalPagoVendedor += valBonus;
      eventosDoMes.push({
        categoria: 'VENDEDOR',
        descricao: '[PERDA DE BÔNUS PONTUALIDADE] Cobrança nas Chaves por atraso contratual no parcelamento da entrada',
        valorCentavos: valBonus,
        destinatario: 'VENDEDOR'
      });
    }

    // 4. Desembolso Banco & Tratamento de Modalidades
    let desembolsoBancoCentavos = 0;
    let saldoDevedorBanco = 0;

    if (modalidade === 'PLANTA_COM_BANCO_NA_OBRA' && competenciaStr < compChaves) {
      // Fase de Obra com Banco na Obra: Encargos discriminados de evolução de obra
      const encargoObra = encargosFaseObra.find(e => e.competencia === competenciaStr);
      if (encargoObra) {
        desembolsoBancoCentavos += encargoObra.encargoTotalMesCentavos;
        saldoDevedorBanco = encargoObra.saldoLiberadoCentavos;

        custoTotalEncargosObraBanco += encargoObra.encargoTotalMesCentavos;
        custoTotalJurosBanco += encargoObra.jurosObraCentavos;
        custoTotalSegurosBanco += (encargoObra.seguroMipCentavos + encargoObra.seguroDfiCentavos);
        custoTotalTaxasAdmBanco += encargoObra.taxaAdministracaoCentavos;
        custoTotalPagoBanco += encargoObra.encargoTotalMesCentavos;

        if (encargoObra.jurosObraCentavos > 0) {
          eventosDoMes.push({
            categoria: 'ENCARGO_BANCO_JUROS_OBRA',
            descricao: `Juros de Evolução de Obra (~${encargoObra.percentualAvancoAcumulado}% liberado)`,
            valorCentavos: encargoObra.jurosObraCentavos,
            destinatario: 'BANCO'
          });
        }
        if (encargoObra.seguroMipCentavos > 0 || encargoObra.seguroDfiCentavos > 0) {
          eventosDoMes.push({
            categoria: 'ENCARGO_BANCO_SEGUROS',
            descricao: `Seguros na Obra (MIP: ${toReais(encargoObra.seguroMipCentavos)} + DFI: ${toReais(encargoObra.seguroDfiCentavos)})`,
            valorCentavos: encargoObra.seguroMipCentavos + encargoObra.seguroDfiCentavos,
            destinatario: 'BANCO'
          });
        }
        if (encargoObra.taxaAdministracaoCentavos > 0) {
          eventosDoMes.push({
            categoria: 'ENCARGO_BANCO_TAXA_ADM',
            descricao: `Taxa de Administração Bancária na Obra`,
            valorCentavos: encargoObra.taxaAdministracaoCentavos,
            destinatario: 'BANCO'
          });
        }
        if (encargoObra.atualizacaoMonetariaCentavos > 0) {
          eventosDoMes.push({
            categoria: 'ENCARGO_BANCO_ATUALIZACAO',
            descricao: `Atualização TR na Obra`,
            valorCentavos: encargoObra.atualizacaoMonetariaCentavos,
            destinatario: 'BANCO'
          });
        }
      }
    } else if (modalidade === 'PLANTA_COM_REPASSE_FUTURO' && competenciaStr < compChaves) {
      // Planta com Repasse Futuro: sem cobrança bancária durante a obra
      desembolsoBancoCentavos = 0;
      saldoDevedorBanco = 0;
    } else {
      // Fase de amortização (PRONTO ou pós-chaves): nenhuma das 420 parcelas é pulada!
      const parcelasDoMes = tabelaBancaria.filter(p => p.vencimento.startsWith(competenciaStr));
      for (const parcelaBanco of parcelasDoMes) {
        desembolsoBancoCentavos += parcelaBanco.encargoTotalCentavos;
        saldoDevedorBanco = parcelaBanco.saldoDevedorFinalCentavos;

        custoTotalFinanciamentoAmortizacaoBanco += parcelaBanco.encargoTotalCentavos;
        custoTotalJurosBanco += parcelaBanco.jurosCentavos;
        custoTotalSegurosBanco += (parcelaBanco.seguroMipCentavos + parcelaBanco.seguroDfiCentavos);
        custoTotalTaxasAdmBanco += parcelaBanco.taxaAdmCentavos;
        custoTotalPagoBanco += parcelaBanco.encargoTotalCentavos;

        eventosDoMes.push({
          categoria: 'ENCARGO_BANCO',
          descricao: `Parcela Bancária nº ${parcelaBanco.numero} (Amort: ${toReais(parcelaBanco.amortizacaoCentavos)} + Juros: ${toReais(parcelaBanco.jurosCentavos)})`,
          valorCentavos: parcelaBanco.encargoTotalCentavos,
          destinatario: 'BANCO'
        });
      }
    }

    // 5. Custos Complementares (ITBI, Registro, Reforma, Mudança) com diasAposMarco
    let custosComplementaresCentavos = 0;
    for (const custo of projeto.custosComplementares) {
      if (custo.financiadoPeloBanco) continue;

      const dataCustoIso = resolverDataMarco(custo.vencimento, custo.vinculoMarco, custo.diasAposMarco, marcosMap);
      const custoComp = extrairCompetencia(dataCustoIso);

      if (custoComp === competenciaStr) {
        let valCent = custo.valorCentavos;
        if (custo.categoria === 'REFORMA_INSTALACAO' && cenario.aumentoCustosInstalacaoPercent !== 0) {
          valCent = Math.round(valCent * (1 + cenario.aumentoCustosInstalacaoPercent / 100));
        }

        custosComplementaresCentavos += valCent;
        custoTotalCustosComplementares += valCent;
        eventosDoMes.push({
          categoria: 'CUSTO_COMPLEMENTAR',
          descricao: custo.descricao + (cenario.aumentoCustosInstalacaoPercent !== 0 && custo.categoria === 'REFORMA_INSTALACAO' ? ' (+ estresse reforma)' : ''),
          valorCentavos: valCent,
          destinatario: 'CARTORIO_PREFEITURA'
        });
      }
    }

    // 6. Evolução contratual do saldo devedor do vendedor (Item 7)
    let saldoDevedorVendedorCentavos = 0;
    for (const ob of projeto.obrigacoesVendedor) {
      if (ob.pagoAntecipado) continue;
      const vencEfetivo = resolverDataMarco(ob.vencimento, ob.vinculoMarco, ob.diasAposMarco, marcosMap);
      const obComp = extrairCompetencia(vencEfetivo);
      if (obComp > competenciaStr) {
        let val = new Decimal(ob.valorBaseCentavos);
        if (ob.indiceCorrecao === 'INCC' && taxaInccMensal.greaterThan(0)) {
          const mFuturos = Math.max(0, mesIdx);
          val = val.times(new Decimal(1).plus(taxaInccMensal).pow(mFuturos)).round();
        }
        saldoDevedorVendedorCentavos += val.toNumber();
      }
    }

    // 7. Fechamento mensal do caixa da família
    const totalSaidasCentavos = despesasVidaCentavos + moradiaAtualCentavos + outrasDividasCentavos +
      desembolsoVendedorCentavos + desembolsoBancoCentavos + custosComplementaresCentavos;

    const saldoMesCentavos = receitasDoMesCentavos - totalSaidasCentavos;
    saldoCaixaAtual = saldoCaixaAtual.plus(saldoMesCentavos);
    const saldoAcumulado = saldoCaixaAtual.toNumber();

    if (competenciaStr === compChaves) {
      saldoCaixaNasChaves = saldoAcumulado;
    }

    if (saldoAcumulado < menorSaldoCaixa) {
      menorSaldoCaixa = saldoAcumulado;
      mesMenorSaldo = competenciaStr;
    }

    if (saldoAcumulado < 0 && primeiroMesInsuficiencia === null) {
      primeiroMesInsuficiencia = competenciaStr;
    }

    if (totalSaidasCentavos > maiorDesembolso) {
      maiorDesembolso = totalSaidasCentavos;
      mesMaiorDesembolso = competenciaStr;
    }

    const reservaPiso = cenario.reservaMinimaDesejadaCentavos;
    const caixaLivre = saldoAcumulado - reservaPiso;
    const deficitReserva = caixaLivre < 0 ? Math.abs(caixaLivre) : 0;
    if (deficitReserva > maxDeficitReserva) {
      maxDeficitReserva = deficitReserva;
    }

    linhasCaixa.push({
      mesIndice: mesIdx + 1,
      competencia: competenciaStr,
      receitasCentavos: receitasDoMesCentavos,
      despesasVidaCentavos,
      moradiaAtualCentavos,
      outrasDividasCentavos,
      desembolsoVendedorCentavos,
      desembolsoBancoCentavos,
      custosComplementaresCentavos,
      totalSaidasCentavos,
      saldoCaixaMesCentavos: saldoMesCentavos,
      saldoCaixaAcumuladoCentavos: saldoAcumulado,
      saldoDevedorBancoCentavos: saldoDevedorBanco,
      saldoDevedorVendedorCentavos,
      reservaMinimaPisoCentavos: reservaPiso,
      caixaLivreCentavos: caixaLivre,
      deficitAbaixoPisoCentavos: deficitReserva,
      eventosDoMes
    });
  }

  // Alertas de caixa e segurança financeira
  if (primeiroMesInsuficiencia !== null) {
    alertas.push({
      codigo: 'CAIXA_NEGATIVO',
      severidade: 'BLOQUEANTE',
      titulo: 'Caixa familiar entra no negativo durante o planejamento',
      mensagem: `O saldo acumulado fica negativo pela primeira vez em ${primeiroMesInsuficiencia}, atingindo o pior saldo de ${toReais(menorSaldoCaixa)} em ${mesMenorSaldo}.`,
      acaoSugerida: 'Considere aumentar o caixa inicial, renegociar prazos de parcelas com o vendedor ou reduzir custos de reforma/instalação.'
    });
  } else if (maxDeficitReserva > 0) {
    alertas.push({
      codigo: 'RESERVA_CONSUMIDA',
      severidade: 'ATENCAO',
      titulo: 'Reserva de emergência comprometida em determinados meses',
      mensagem: `O caixa livre fica abaixo do piso de segurança desejado (${toReais(cenario.reservaMinimaDesejadaCentavos)}) em até ${toReais(maxDeficitReserva)}.`,
      acaoSugerida: 'Verifique se as saídas coincidem com períodos de 13º salário ou planeje aportes antecipados.'
    });
  }

  // Comprometimento da renda no primeiro mês bancário
  const rendaPrimeiroMes = linhasCaixa[0]?.receitasCentavos || 0;
  const encargoPrimeiroMes = tabelaBancaria[0]?.encargoTotalCentavos || 0;
  let taxaComprometimento = 0;

  if (rendaPrimeiroMes <= 0) {
    alertas.push({
      codigo: 'DADO_ESSENCIAL_AUSENTE',
      severidade: 'ATENCAO',
      titulo: 'Renda Familiar Não Informada ou Zerada',
      mensagem: 'Não foi possível calcular a taxa de comprometimento bancário porque a renda líquida declarada é zero ou não informada.',
      acaoSugerida: 'Cadastre a renda líquida mensal familiar na aba Família & Caixa.'
    });
  } else {
    taxaComprometimento = Number(((encargoPrimeiroMes / rendaPrimeiroMes) * 100).toFixed(2));
    if (taxaComprometimento > 30) {
      alertas.push({
        codigo: 'REGRA_NAO_CONFIRMADA',
        severidade: 'ATENCAO',
        titulo: 'Comprometimento de renda superior a 30% no 1º mês bancário',
        mensagem: `A parcela bancária de ${toReais(encargoPrimeiroMes)} representa ${taxaComprometimento}% da renda líquida familiar (${toReais(rendaPrimeiroMes)}). Bancos exigem margem máxima de 30% na aprovação.`,
        acaoSugerida: 'Avalie compor renda com mais um titular ou aumentar o valor de entrada para reduzir a parcela.'
      });
    }
  }

  // Alerta da Ferramenta: Bônus de Pontualidade / Bom Pagador da Construtora
  if (projeto.descontosBonus?.ativo && projeto.descontosBonus.bonusPontualidadeCentavos > 0) {
    if (cenario.perderBonusPontualidade) {
      alertas.push({
        codigo: 'SALDO_RESIDUAL',
        severidade: 'BLOQUEANTE',
        titulo: 'Alerta da Ferramenta: Bônus de Pontualidade Cobrado nas Chaves',
        mensagem: `Simulação de estresse: devido a atraso no parcelamento, o bônus de ${toReais(projeto.descontosBonus.bonusPontualidadeCentavos)} foi cancelado e a dívida exigida na entrega das chaves (${compChaves}).`,
        acaoSugerida: 'O bônus de pontualidade só é garantido se 100% dos pagamentos forem feitos em dia. Se houver atraso, essa dívida é reativada e exigida na entrega das chaves.'
      });
    } else {
      alertas.push({
        codigo: 'REGRA_NAO_CONFIRMADA',
        severidade: 'ATENCAO',
        titulo: 'Alerta da Ferramenta: Bônus de Pontualidade Condicional',
        mensagem: 'Atenção: O bônus de pontualidade só é garantido se 100% dos pagamentos forem feitos em dia. Se houver atraso, essa dívida é reativada e exigida na entrega das chaves.',
        acaoSugerida: `O crédito concedido é de ${toReais(projeto.descontosBonus.bonusPontualidadeCentavos)}. Mantenha as parcelas do fluxo rigorosamente em dia.`
      });
    }
  }

  // Fix Auditoria Item 1: Custo Efetivo Total da Aquisição SEM duplicação do principal financiado
  // O que a família realmente desembolsa:
  // Recursos Próprios Pagos ao Vendedor + FGTS Usado + Total Pago ao Banco + Custos Complementares
  const custoAquisicaoEfetivoCentavos = 
    recursosPropriosPagosVendedor + 
    fgtsUtilizado + 
    custoTotalPagoBanco + 
    custoTotalCustosComplementares;

  const indicadores: IndicadoresConsolidados = {
    desembolsoInicialContratacaoCentavos: linhasCaixa[0]?.desembolsoVendedorCentavos + (linhasCaixa[0]?.custosComplementaresCentavos || 0),
    maiorDesembolsoMensalCentavos: maiorDesembolso,
    mesMaiorDesembolso,
    menorSaldoCaixaCentavos: menorSaldoCaixa,
    mesMenorSaldoCaixa: mesMenorSaldo,
    primeiroMesInsuficienciaCaixa: primeiroMesInsuficiencia,
    necessidadeAdicionalRecursosCentavos: menorSaldoCaixa < 0 ? Math.abs(menorSaldoCaixa) : 0,
    necessidadeParaPreservarReservaCentavos: maxDeficitReserva,
    saldoCaixaNasChavesCentavos: saldoCaixaNasChaves,
    
    // Decomposição limpa sem duplicação de principal
    recursosPropriosPagosVendedorCentavos: recursosPropriosPagosVendedor,
    fgtsUtilizadoCentavos: fgtsUtilizado,
    subsidioUtilizadoCentavos: subsidioUtilizado,
    repasseFinanciadoCentavos: repasseFinanciado,
    custoTotalEncargosObraBancoCentavos: custoTotalEncargosObraBanco,
    custoTotalFinanciamentoAmortizacaoBancoCentavos: custoTotalFinanciamentoAmortizacaoBanco,
    
    custoTotalJurosBancoCentavos: custoTotalJurosBanco,
    custoTotalSegurosBancoCentavos: custoTotalSegurosBanco,
    custoTotalTaxasAdmBancoCentavos: custoTotalTaxasAdmBanco,
    custoTotalPagoBancoCentavos: custoTotalPagoBanco,
    custoTotalPagoVendedorCentavos: custoTotalPagoVendedor,
    custoTotalCustosComplementaresCentavos: custoTotalCustosComplementares,
    custoAquisicaoEfetivoCentavos,
    taxaComprometimentoRendaPrimeiroMesPercent: taxaComprometimento
  };

  return {
    linhasCaixa,
    reconciliacao,
    indicadores,
    alertas,
    tabelaBancariaUsada: tabelaBancaria,
    encargosFaseObraUsados: encargosFaseObra
  };
}
