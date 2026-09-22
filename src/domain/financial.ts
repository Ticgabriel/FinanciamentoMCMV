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
  PropostaBancaria
} from '../types';
import {
  adicionarMesesCivil,
  extrairCompetencia,
  calcularHorizonteCompetencias,
  diferencaMesesCivis
} from './calendar';

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
 * Suporta atualização monetária pela TR e calendário civil sem saltos de mês.
 */
export function gerarTabelaSAC(
  principalCentavos: number,
  prazoMeses: number,
  taxaMensal: Decimal,
  dataInicioIso: string,
  taxaAdmFixaCentavos: number = 2500, // R$ 25,00
  aliquotaMipPercent: number = 0.0163, // taxa mensal sobre saldo
  aliquotaDfiCentavos: number = 2840, // R$ 28,40 fixo ou tabela
  taxaTrMensal: Decimal = new Decimal(0)
): ParcelaBancoLinha[] {
  const linhas: ParcelaBancoLinha[] = [];
  if (prazoMeses <= 0 || principalCentavos <= 0) return linhas;

  let saldoDevedor = new Decimal(principalCentavos);
  // Amortização teórica constante = P / n
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

    // Amortização do mês (ajuste na última para zerar)
    let amortCentavos = amortizacaoBase.toNumber();
    if (mes === prazoMeses || saldoDevedor.minus(amortCentavos).lessThanOrEqualTo(0)) {
      amortCentavos = saldoDevedor.toNumber();
    }

    const prestacaoCentavos = amortCentavos + jurosCentavos;
    const mipCentavos = (mes === prazoMeses || (taxaMensal.isZero() && aliquotaMipPercent === 0))
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
 * Suporta Taxa Zero explícita (sem juros e sem divisão por zero), TR e calendário civil.
 */
export function gerarTabelaPrice(
  principalCentavos: number,
  prazoMeses: number,
  taxaMensal: Decimal,
  dataInicioIso: string,
  taxaAdmFixaCentavos: number = 2500,
  aliquotaMipPercent: number = 0.0163,
  aliquotaDfiCentavos: number = 2840,
  taxaTrMensal: Decimal = new Decimal(0)
): ParcelaBancoLinha[] {
  const linhas: ParcelaBancoLinha[] = [];
  if (prazoMeses <= 0 || principalCentavos <= 0) return linhas;

  let saldoDevedor = new Decimal(principalCentavos);

  // Se taxa for zero: PMT = P / n
  let pmtTeorico: Decimal;
  if (taxaMensal.isZero()) {
    pmtTeorico = new Decimal(principalCentavos).dividedBy(prazoMeses).round();
  } else {
    // PMT = P * i / (1 - (1+i)^-n)
    const umMaisI = new Decimal(1).plus(taxaMensal);
    const umMaisIMenosN = umMaisI.pow(-prazoMeses);
    const denominador = new Decimal(1).minus(umMaisIMenosN);
    pmtTeorico = new Decimal(principalCentavos).times(taxaMensal).dividedBy(denominador).round();
  }

  for (let mes = 1; mes <= prazoMeses; mes++) {
    const vencimentoIso = adicionarMesesCivil(dataInicioIso, mes - 1);
    const saldoInicialCentavos = saldoDevedor.toNumber();

    // TR (se houver)
    let atualizacaoCentavos = 0;
    if (taxaTrMensal.greaterThan(0)) {
      atualizacaoCentavos = saldoDevedor.times(taxaTrMensal).round().toNumber();
      saldoDevedor = saldoDevedor.plus(atualizacaoCentavos);
    }

    const jurosCentavos = taxaMensal.isZero() ? 0 : saldoDevedor.times(taxaMensal).round().toNumber();

    let amortCentavos = taxaMensal.isZero()
      ? (mes === prazoMeses ? saldoDevedor.toNumber() : pmtTeorico.toNumber())
      : pmtTeorico.minus(jurosCentavos).toNumber();

    if (mes === prazoMeses || saldoDevedor.minus(amortCentavos).lessThanOrEqualTo(0)) {
      amortCentavos = saldoDevedor.toNumber();
    }

    const prestacaoCentavos = amortCentavos + jurosCentavos;
    const mipCentavos = (mes === prazoMeses || (taxaMensal.isZero() && aliquotaMipPercent === 0))
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
 * Despacho unificado de geração de tabela bancária.
 * Trata TAXA_ZERO com juros rigorosamente zerados e aplica a TR do cenário.
 */
export function gerarTabelaFinanciamento(
  prop: PropostaBancaria,
  trAnualPercent: number = 0
): ParcelaBancoLinha[] {
  if (prop.sistema === 'TABELA_IMPORTADA' && prop.tabelaImportada && prop.tabelaImportada.length > 0) {
    return prop.tabelaImportada;
  }

  const taxaTrMensal = trAnualPercent > 0
    ? new Decimal(1).plus(new Decimal(trAnualPercent).dividedBy(100)).pow(new Decimal(1).dividedBy(12)).minus(1)
    : new Decimal(0);

  if (prop.sistema === 'TAXA_ZERO') {
    return gerarTabelaPrice(
      prop.valorFinanciadoCentavos,
      prop.prazoMeses,
      new Decimal(0),
      prop.dataPrimeiroVencimento,
      prop.taxaAdmFixaMensalCentavos,
      0, // sem MIP
      0, // sem DFI
      new Decimal(0)
    );
  }

  const taxaMensal = converterTaxaNominalAnualParaMensal(prop.taxaJurosNominalAnualPercent);
  if (prop.sistema === 'SAC') {
    return gerarTabelaSAC(
      prop.valorFinanciadoCentavos,
      prop.prazoMeses,
      taxaMensal,
      prop.dataPrimeiroVencimento,
      prop.taxaAdmFixaMensalCentavos,
      prop.aliquotaMipInicialPercent,
      prop.aliquotaDfiMensalCentavos,
      taxaTrMensal
    );
  } else {
    return gerarTabelaPrice(
      prop.valorFinanciadoCentavos,
      prop.prazoMeses,
      taxaMensal,
      prop.dataPrimeiroVencimento,
      prop.taxaAdmFixaMensalCentavos,
      prop.aliquotaMipInicialPercent,
      prop.aliquotaDfiMensalCentavos,
      taxaTrMensal
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
 * Corrige F01, F04, F05, F06, F07, F09, F11, F12.
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

  // Tabela bancária teórica gerada com suporte a taxa zero e TR
  const prop = projeto.propostaBancaria;
  const tabelaBancaria = gerarTabelaFinanciamento(prop, cenario.trAnualPercent);

  // Alerta de variação do crédito aprovado pelo banco (F07, R11)
  if (cenario.variacaoCreditoPercent < 0) {
    const deficitCreditoCentavos = Math.round(prop.valorFinanciadoCentavos * Math.abs(cenario.variacaoCreditoPercent) / 100);
    alertas.push({
      codigo: 'SALDO_RESIDUAL',
      severidade: 'BLOQUEANTE',
      titulo: `Déficit de Financiamento por Redução de Crédito do Banco (${cenario.variacaoCreditoPercent}%)`,
      mensagem: `No cenário de estresse, o banco aprova ${Math.abs(cenario.variacaoCreditoPercent)}% a menos de financiamento (redução de ${toReais(deficitCreditoCentavos)}). Essa diferença exigirá aporte adicional de recursos próprios.`,
      acaoSugerida: 'Adicione uma fonte complementar de recursos próprios ou renegocie o valor de repasse com a construtora.'
    });
  }

  // Resolução de marcos com atraso de obra civil
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

  // Horizonte contínuo completo sem omissão de parcelas ou obrigações (F04, R07)
  const todasAsDatas: string[] = [
    projeto.dataBase,
    dataChavesEfetivaStr,
    dataMudancaEfetivaStr,
    ...projeto.obrigacoesVendedor.map(o => o.vencimento),
    ...projeto.custosComplementares.map(c => c.vencimento),
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

  let custoTotalJurosBanco = 0;
  let custoTotalSegurosBanco = 0;
  let custoTotalTaxasAdmBanco = 0;
  let custoTotalPagoBanco = 0;
  let custoTotalPagoVendedor = 0;
  let custoTotalCustosComplementares = 0;

  const taxaInccMensal = new Decimal(cenario.inccAnualPercent).dividedBy(100).dividedBy(12);
  const taxaMensalBanco = converterTaxaNominalAnualParaMensal(prop.taxaJurosNominalAnualPercent);

  // Quantidade de meses de obra até as chaves para cálculo da evolução de juros de obra
  const mesesObraTotal = Math.max(1, diferencaMesesCivis(projeto.dataBase, dataChavesEfetivaStr));

  for (let mesIdx = 0; mesIdx < competencias.length; mesIdx++) {
    const competenciaStr = competencias[mesIdx];
    const eventosDoMes: LinhaCaixaMes['eventosDoMes'] = [];

    // 1. Receitas familiares
    let receitasDoMesCentavos = 0;
    for (const rec of projeto.receitas) {
      // Verifica intervalo temporal de vigência (se houver)
      if (rec.mesInicio && competenciaStr < rec.mesInicio) continue;
      if (rec.mesFim && competenciaStr > rec.mesFim) continue;

      if (rec.recorrenteMensal || (rec.dataCompetencia && rec.dataCompetencia.startsWith(competenciaStr))) {
        let val = new Decimal(rec.valorCentavos);
        // Variação de renda (estresse)
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

    // 2. Despesas da família (moradia cessa na mudança se configurada - F11, R12)
    let despesasVidaCentavos = 0;
    let moradiaAtualCentavos = 0;
    let outrasDividasCentavos = 0;

    for (const desp of projeto.despesas) {
      if (desp.mesInicio && competenciaStr < desp.mesInicio) continue;
      if (desp.mesFim && competenciaStr > desp.mesFim) continue;

      if (desp.categoria === 'MORADIA_ATUAL') {
        if (desp.cessaNaMudanca && competenciaStr >= compMudanca) {
          // Cessou aluguel / moradia atual após a mudança efetiva!
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

    // 3. Desembolso com Vendedor & Liquidações de Fontes (F01 / R01 FIX CRÍTICO)
    let desembolsoVendedorCentavos = 0;
    for (const ob of projeto.obrigacoesVendedor) {
      if (ob.pagoAntecipado) continue;

      const obComp = extrairCompetencia(ob.vencimento);
      if (obComp === competenciaStr) {
        // Correção INCC contratual sobre obrigações corrigíveis
        let valorCorrigido = new Decimal(ob.valorBaseCentavos);
        if (ob.indiceCorrecao === 'INCC' && taxaInccMensal.greaterThan(0)) {
          const mesesDecorrido = Math.max(0, mesIdx);
          const fator = new Decimal(1).plus(taxaInccMensal).pow(mesesDecorrido);
          valorCorrigido = valorCorrigido.times(fator).round();
        }

        const valCent = valorCorrigido.toNumber();

        // Classificação do pagador e impacto no caixa livre (F01)
        const ehRepasseBancario = ob.tipo === 'REPASSE_FINANCIAMENTO' || ob.responsavelPagamento === 'BANCO';
        const ehFgtsOuSubsidio = 
          ob.responsavelPagamento === 'FGTS' || 
          ob.responsavelPagamento === 'SUBSIDIO' ||
          (ob.tipo === 'OUTRO' && (
            ob.descricao.toUpperCase().includes('FGTS') || 
            ob.descricao.toUpperCase().includes('SUBSÍDIO') || 
            ob.descricao.toUpperCase().includes('SUBSIDIO')
          ));

        const afetaCaixaLivre = ob.afetaCaixaLivre !== undefined
          ? ob.afetaCaixaLivre
          : (!ehRepasseBancario && !ehFgtsOuSubsidio);

        custoTotalPagoVendedor += valCent;

        if (afetaCaixaLivre) {
          // Desembolso de recursos próprios do comprador (sai do caixa da família)
          desembolsoVendedorCentavos += valCent;
          eventosDoMes.push({
            categoria: 'VENDEDOR',
            descricao: ob.descricao + (ob.indiceCorrecao !== 'SEM_CORRECAO' ? ' (com INCC projetado)' : ''),
            valorCentavos: valCent,
            destinatario: 'VENDEDOR'
          });
        } else {
          // Liquidado via FGTS / Repasse Bancário: NÃO sai do caixa livre familiar (F01, R01)
          eventosDoMes.push({
            categoria: 'LIQUIDACAO_DIRETA',
            descricao: `${ob.descricao} (Liquidado via ${ehRepasseBancario ? 'Repasse Bancário' : 'FGTS/Subsídio'} - sem débito no caixa livre familiar)`,
            valorCentavos: valCent,
            destinatario: 'VENDEDOR'
          });
        }
      }
    }

    // Reativação da dívida do Bônus de Pontualidade nas chaves se configurado (F12, R17)
    if (
      projeto.descontosBonus?.ativo &&
      cenario.perderBonusPontualidade &&
      projeto.descontosBonus.reverterBonusSeAtrasar !== false &&
      projeto.descontosBonus.bonusPontualidadeCentavos > 0 &&
      competenciaStr === compChaves
    ) {
      const valBonus = projeto.descontosBonus.bonusPontualidadeCentavos;
      desembolsoVendedorCentavos += valBonus;
      custoTotalPagoVendedor += valBonus;
      eventosDoMes.push({
        categoria: 'VENDEDOR',
        descricao: '[PERDA DE BÔNUS PONTUALIDADE] Cobrança nas Chaves por atraso contratual no parcelamento da entrada',
        valorCentavos: valBonus,
        destinatario: 'VENDEDOR'
      });
    }

    // 4. Desembolso Banco & Tratamento de Modalidades (F06, R09)
    let desembolsoBancoCentavos = 0;
    let saldoDevedorBanco = 0;

    const modalidade = projeto.modalidade || 'PRONTO';

    if (modalidade === 'PLANTA_COM_BANCO_NA_OBRA' && competenciaStr < compChaves) {
      // Fase de Obra com Banco na Obra: Juros de Evolução de Obra proporcionais ao avanço
      const mesesDecorridosObra = Math.min(mesesObraTotal, mesIdx + 1);
      const progressoObra = Math.min(1, Math.max(0.1, mesesDecorridosObra / mesesObraTotal));
      const principalDisponibilizado = new Decimal(prop.valorFinanciadoCentavos).times(progressoObra);
      
      const jurosObraCentavos = taxaMensalBanco.isZero() ? 0 : principalDisponibilizado.times(taxaMensalBanco).round().toNumber();
      const segurosObraCentavos = prop.aliquotaDfiMensalCentavos + prop.taxaAdmFixaMensalCentavos;
      const encargoObraCentavos = jurosObraCentavos + segurosObraCentavos;

      desembolsoBancoCentavos += encargoObraCentavos;
      saldoDevedorBanco = principalDisponibilizado.round().toNumber();

      custoTotalJurosBanco += jurosObraCentavos;
      custoTotalSegurosBanco += prop.aliquotaDfiMensalCentavos;
      custoTotalTaxasAdmBanco += prop.taxaAdmFixaMensalCentavos;
      custoTotalPagoBanco += encargoObraCentavos;

      eventosDoMes.push({
        categoria: 'ENCARGO_BANCO',
        descricao: `Juros de Evolução de Obra (~${Math.round(progressoObra * 100)}% de avanço físico)`,
        valorCentavos: encargoObraCentavos,
        destinatario: 'BANCO'
      });
    } else if (modalidade === 'PLANTA_COM_REPASSE_FUTURO' && competenciaStr < compChaves) {
      // Planta com Repasse Futuro: nenhum encargo bancário antes das chaves
      desembolsoBancoCentavos = 0;
      saldoDevedorBanco = 0;
    } else {
      // Modalidade Pronto ou fase de amortização pós-chaves
      // Agrupa todas as parcelas bancárias que caem nesta competência (R09)
      const parcelasDoMes = tabelaBancaria.filter(p => p.vencimento.startsWith(competenciaStr));
      for (const parcelaBanco of parcelasDoMes) {
        desembolsoBancoCentavos += parcelaBanco.encargoTotalCentavos;
        saldoDevedorBanco = parcelaBanco.saldoDevedorFinalCentavos;

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

    // 5. Custos Complementares (ITBI, Registro, Reforma, Mudança)
    let custosComplementaresCentavos = 0;
    for (const custo of projeto.custosComplementares) {
      if (custo.financiadoPeloBanco) continue;

      let dataCustoIso = custo.vencimento;
      if (custo.vinculoMarco === 'CHAVES') {
        dataCustoIso = dataChavesEfetivaStr;
      } else if (custo.vinculoMarco === 'MUDANCA') {
        dataCustoIso = dataMudancaEfetivaStr;
      }

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

    // 6. Cálculo do saldo devedor restante do vendedor (F09, R14)
    let saldoDevedorVendedorCentavos = 0;
    for (const ob of projeto.obrigacoesVendedor) {
      if (ob.pagoAntecipado) continue;
      const obComp = extrairCompetencia(ob.vencimento);
      if (obComp > competenciaStr) {
        saldoDevedorVendedorCentavos += ob.valorBaseCentavos;
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

  // Comprometimento da renda no primeiro mês (F11, R15)
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
    custoTotalJurosBancoCentavos: custoTotalJurosBanco,
    custoTotalSegurosBancoCentavos: custoTotalSegurosBanco,
    custoTotalTaxasAdmBancoCentavos: custoTotalTaxasAdmBanco,
    custoTotalPagoBancoCentavos: custoTotalPagoBanco,
    custoTotalPagoVendedorCentavos: custoTotalPagoVendedor,
    custoTotalCustosComplementaresCentavos: custoTotalCustosComplementares,
    custoAquisicaoEfetivoCentavos: custoTotalPagoBanco + custoTotalPagoVendedor + custoTotalCustosComplementares,
    taxaComprometimentoRendaPrimeiroMesPercent: taxaComprometimento
  };

  return {
    linhasCaixa,
    reconciliacao,
    indicadores,
    alertas,
    tabelaBancariaUsada: tabelaBancaria
  };
}
