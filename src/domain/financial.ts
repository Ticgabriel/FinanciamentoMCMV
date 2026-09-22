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
  SistemaAmortizacao
} from '../types';

// Set standard precision for intermediate financial calculations
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
 */
export function gerarTabelaSAC(
  principalCentavos: number,
  prazoMeses: number,
  taxaMensal: Decimal,
  dataInicioIso: string,
  taxaAdmFixaCentavos: number = 2500, // R$ 25,00
  aliquotaMipPercent: number = 0.0163, // taxa mensal sobre saldo
  aliquotaDfiCentavos: number = 2840 // R$ 28,40 fixo ou tabela
): ParcelaBancoLinha[] {
  const linhas: ParcelaBancoLinha[] = [];
  if (prazoMeses <= 0 || principalCentavos <= 0) return linhas;

  let saldoDevedor = new Decimal(principalCentavos);
  // Amortização teórica constante = P / n
  const amortizacaoBase = new Decimal(principalCentavos).dividedBy(prazoMeses).round();
  const dataRef = new Date(dataInicioIso);

  for (let mes = 1; mes <= prazoMeses; mes++) {
    const dataVenc = new Date(dataRef);
    dataVenc.setMonth(dataVenc.getMonth() + (mes - 1));
    const vencimentoIso = dataVenc.toISOString().split('T')[0];

    const saldoInicialCentavos = saldoDevedor.toNumber();
    
    // Juros = Saldo inicial * taxa mensal (arredondado para centavos)
    const jurosDec = saldoDevedor.times(taxaMensal).round();
    const jurosCentavos = jurosDec.toNumber();

    // No último mês, ajusta resíduo para zerar exatamente
    let amortCentavos = amortizacaoBase.toNumber();
    if (mes === prazoMeses || saldoDevedor.minus(amortCentavos).lessThanOrEqualTo(0)) {
      amortCentavos = saldoDevedor.toNumber();
    }

    const prestacaoCentavos = amortCentavos + jurosCentavos;

    // Seguros
    const mipCentavos = saldoDevedor.times(aliquotaMipPercent).dividedBy(100).round().toNumber();
    const dfiCentavos = aliquotaDfiCentavos;
    const taxaAdmCentavos = taxaAdmFixaCentavos;

    const encargoTotalCentavos = prestacaoCentavos + mipCentavos + dfiCentavos + taxaAdmCentavos;

    saldoDevedor = saldoDevedor.minus(amortCentavos);
    const saldoFinalCentavos = Math.max(0, saldoDevedor.toNumber());

    linhas.push({
      numero: mes,
      vencimento: vencimentoIso,
      saldoDevedorInicialCentavos: saldoInicialCentavos,
      atualizacaoCentavos: 0,
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
 * PMT = P * [ i / (1 - (1+i)^-n) ]
 */
export function gerarTabelaPrice(
  principalCentavos: number,
  prazoMeses: number,
  taxaMensal: Decimal,
  dataInicioIso: string,
  taxaAdmFixaCentavos: number = 2500,
  aliquotaMipPercent: number = 0.0163,
  aliquotaDfiCentavos: number = 2840
): ParcelaBancoLinha[] {
  const linhas: ParcelaBancoLinha[] = [];
  if (prazoMeses <= 0 || principalCentavos <= 0) return linhas;

  let saldoDevedor = new Decimal(principalCentavos);
  const dataRef = new Date(dataInicioIso);

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
    const dataVenc = new Date(dataRef);
    dataVenc.setMonth(dataVenc.getMonth() + (mes - 1));
    const vencimentoIso = dataVenc.toISOString().split('T')[0];

    const saldoInicialCentavos = saldoDevedor.toNumber();
    const jurosDec = saldoDevedor.times(taxaMensal).round();
    const jurosCentavos = jurosDec.toNumber();

    let amortCentavos = pmtTeorico.minus(jurosDec).toNumber();
    if (mes === prazoMeses || saldoDevedor.minus(amortCentavos).lessThanOrEqualTo(0)) {
      amortCentavos = saldoDevedor.toNumber();
    }

    const prestacaoCentavos = amortCentavos + jurosCentavos;
    const mipCentavos = saldoDevedor.times(aliquotaMipPercent).dividedBy(100).round().toNumber();
    const dfiCentavos = aliquotaDfiCentavos;
    const taxaAdmCentavos = taxaAdmFixaCentavos;

    const encargoTotalCentavos = prestacaoCentavos + mipCentavos + dfiCentavos + taxaAdmCentavos;

    saldoDevedor = saldoDevedor.minus(amortCentavos);
    const saldoFinalCentavos = Math.max(0, saldoDevedor.toNumber());

    linhas.push({
      numero: mes,
      vencimento: vencimentoIso,
      saldoDevedorInicialCentavos: saldoInicialCentavos,
      atualizacaoCentavos: 0,
      amortizacaoCentavos: amortCentavos,
      jurosCentavos: jurosCentavos,
      prestacaoCentavos: prestacaoCentavos,
      seguroMipCentavos: mipCentavos,
      seguroDfiCentavos: dfiCentavos,
      taxaAdmCentavos: taxaAdmCentavos,
      encargoTotalCentavos: encargoTotalCentavos,
      saldoDevedorFinalCentavos: saldoFinalCentavos,
      rotulo: 'CALCULADO',
      origemTexto: 'Motor Price Determinístico'
    });

    if (saldoFinalCentavos === 0) break;
  }

  return linhas;
}

/**
 * Reconciliação do preço do imóvel:
 * Preço = recursos próprios programados + FGTS + subsídio + crédito bancário ao vendedor + saldo direto a quitar
 * Se houver descontos/bônus da construtora ativos, o preço efetivo a liquidar é abatido.
 */
export function calcularReconciliacaoPreco(projeto: ProjetoFinanciamento): ReconciliacaoPreco {
  const preco = projeto.precoImovelCentavos;
  const descontos = projeto.descontosBonus;
  
  const descontoComercialCentavos = (descontos?.ativo ? descontos.descontoComercialCentavos : 0) || 0;
  const bonusPontualidadeCentavos = (descontos?.ativo ? descontos.bonusPontualidadeCentavos : 0) || 0;
  
  // Total de bonificação e desconto concedidos pela incorporadora
  const totalDescontosCentavos = descontoComercialCentavos + bonusPontualidadeCentavos;
  const precoEfetivoCentavos = Math.max(0, preco - totalDescontosCentavos);

  // Fontes destinadas ao preço
  const fontesPreco = projeto.fontes.filter(f => f.destino === 'PRECO');
  const somaFontesPrecoCentavos = fontesPreco.reduce((acc, f) => acc + f.valorCentavos, 0);

  // Obrigações com o vendedor que compõem o preço
  const somaObrigacoesPrecoCentavos = projeto.obrigacoesVendedor.reduce(
    (acc, o) => acc + o.valorBaseCentavos, 0
  );

  // A diferença não conciliada avalia se as fontes cadastradas batem com o valor líquido a quitar (ou com o bruto caso os descontos já tenham sido lançados como fonte)
  const diferencaNaoConciliadaCentavos = precoEfetivoCentavos - somaFontesPrecoCentavos;
  const fechado = Math.abs(diferencaNaoConciliadaCentavos) <= 1; // margem de 1 centavo para arredondamento

  return {
    precoImovelCentavos: preco,
    descontoComercialCentavos,
    bonusPontualidadeCentavos,
    precoEfetivoCentavos,
    somaFontesPrecoCentavos,
    somaObrigacoesPrecoCentavos,
    diferencaNaoConciliadaCentavos,
    fechado,
    detalheFontes: fontesPreco.map(f => ({ tipo: f.nome, valorCentavos: f.valorCentavos })),
    detalheObrigacoes: projeto.obrigacoesVendedor.map(o => ({ tipo: o.descricao, valorCentavos: o.valorBaseCentavos }))
  };
}

/**
 * Simula a evolução do caixa familiar e dos encargos mês a mês
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
      titulo: 'Preço do imóvel não coincide com as fontes declaradas',
      mensagem: `Diferença não conciliada de ${toReais(reconciliacao.diferencaNaoConciliadaCentavos)}. A soma das fontes destinadas ao preço (${toReais(reconciliacao.somaFontesPrecoCentavos)}) difere do preço total (${toReais(reconciliacao.precoImovelCentavos)}).`,
      acaoSugerida: 'Ajuste os valores de entrada, FGTS, subsídio ou financiamento para fechar exatamente o preço.'
    });
  }

  // Define tabela bancária a ser usada
  let tabelaBancaria: ParcelaBancoLinha[] = [];
  const prop = projeto.propostaBancaria;

  if (prop.sistema === 'TABELA_IMPORTADA' && prop.tabelaImportada && prop.tabelaImportada.length > 0) {
    tabelaBancaria = prop.tabelaImportada;
  } else {
    const taxaMensal = converterTaxaNominalAnualParaMensal(prop.taxaJurosNominalAnualPercent);
    if (prop.sistema === 'SAC') {
      tabelaBancaria = gerarTabelaSAC(
        prop.valorFinanciadoCentavos,
        prop.prazoMeses,
        taxaMensal,
        prop.dataPrimeiroVencimento,
        prop.taxaAdmFixaMensalCentavos,
        prop.aliquotaMipInicialPercent,
        prop.aliquotaDfiMensalCentavos
      );
    } else {
      tabelaBancaria = gerarTabelaPrice(
        prop.valorFinanciadoCentavos,
        prop.prazoMeses,
        taxaMensal,
        prop.dataPrimeiroVencimento,
        prop.taxaAdmFixaMensalCentavos,
        prop.aliquotaMipInicialPercent,
        prop.aliquotaDfiMensalCentavos
      );
    }
  }

  // Tratar atraso de obra nas datas
  const marcoChaves = projeto.marcos.find(m => m.tipo === 'CHAVES');
  const marcoMudanca = projeto.marcos.find(m => m.tipo === 'MUDANCA_EFETIVA');

  let dataChavesEfetiva = marcoChaves ? new Date(marcoChaves.dataPrevista) : new Date(projeto.dataBase);
  if (cenario.atrasoObraMeses > 0) {
    dataChavesEfetiva.setMonth(dataChavesEfetiva.getMonth() + cenario.atrasoObraMeses);
  }

  let dataMudancaEfetiva = marcoMudanca ? new Date(marcoMudanca.dataPrevista) : new Date(dataChavesEfetiva);
  if (cenario.atrasoObraMeses > 0) {
    dataMudancaEfetiva.setMonth(dataMudancaEfetiva.getMonth() + cenario.atrasoObraMeses);
  }

  // Horizonte de projeção: mínimo 60 meses ou até fim das obrigações
  const horizonteMeses = Math.min(420, Math.max(60, tabelaBancaria.length + 12));
  const linhasCaixa: LinhaCaixaMes[] = [];

  let saldoCaixaAtual = new Decimal(projeto.caixaInicialCentavos);
  let menorSaldoCaixa = saldoCaixaAtual.toNumber();
  let mesMenorSaldo = projeto.dataBase.substring(0, 7);
  let maiorDesembolso = 0;
  let mesMaiorDesembolso = projeto.dataBase.substring(0, 7);
  let primeiroMesInsuficiencia: string | null = null;
  let maxDeficitReserva = 0;
  let saldoCaixaNasChaves = 0;

  // Custo agregados
  let custoTotalJurosBanco = 0;
  let custoTotalSegurosBanco = 0;
  let custoTotalTaxasAdmBanco = 0;
  let custoTotalPagoBanco = 0;
  let custoTotalPagoVendedor = 0;
  let custoTotalCustosComplementares = 0;

  const dataBaseDate = new Date(projeto.dataBase);

  // Mapear obrigações do vendedor por competência
  const taxaInccMensal = new Decimal(cenario.inccAnualPercent).dividedBy(100).dividedBy(12);

  for (let mesIdx = 0; mesIdx < horizonteMeses; mesIdx++) {
    const dataMes = new Date(dataBaseDate);
    dataMes.setMonth(dataMes.getMonth() + mesIdx);
    const competenciaStr = `${dataMes.getFullYear()}-${String(dataMes.getMonth() + 1).padStart(2, '0')}`;
    const eventosDoMes: LinhaCaixaMes['eventosDoMes'] = [];

    // 1. Receitas da família (com variação do cenário se aplicável)
    let receitasDoMesCentavos = 0;
    for (const rec of projeto.receitas) {
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

    // 2. Despesas de vida e outras dívidas
    let despesasVidaCentavos = 0;
    let outrasDividasCentavos = 0;
    let moradiaAtualCentavos = 0;

    for (const desp of projeto.despesas) {
      if (desp.categoria === 'MORADIA_ATUAL') {
        // Cessa quando a mudança efetiva ocorrer
        if (dataMes < dataMudancaEfetiva) {
          moradiaAtualCentavos += desp.valorCentavos;
          eventosDoMes.push({
            categoria: 'DESPESA_MORADIA',
            descricao: desp.descricao,
            valorCentavos: desp.valorCentavos,
            destinatario: 'FAMILIA'
          });
        }
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

    // 3. Desembolso com Vendedor
    let desembolsoVendedorCentavos = 0;
    for (const ob of projeto.obrigacoesVendedor) {
      if (ob.pagoAntecipado) continue; // Já pago antes da data-base não sai do caixa novamente!
      
      const obData = new Date(ob.vencimento);
      if (obData.getFullYear() === dataMes.getFullYear() && obData.getMonth() === dataMes.getMonth()) {
        // Aplica correção INCC acumulada até este mês se configurado
        let valorCorrigido = new Decimal(ob.valorBaseCentavos);
        if (ob.indiceCorrecao === 'INCC' && taxaInccMensal.greaterThan(0)) {
          const fator = new Decimal(1).plus(taxaInccMensal).pow(mesIdx);
          valorCorrigido = valorCorrigido.times(fator).round();
        }

        const valCent = valorCorrigido.toNumber();
        desembolsoVendedorCentavos += valCent;
        custoTotalPagoVendedor += valCent;
        eventosDoMes.push({
          categoria: 'VENDEDOR',
          descricao: ob.descricao + (ob.indiceCorrecao !== 'SEM_CORRECAO' ? ` (com INCC projetado)` : ''),
          valorCentavos: valCent,
          destinatario: 'VENDEDOR'
        });
      }
    }

    // Se houver estresse com perda do bônus de pontualidade/bom pagador, reativa a dívida nas chaves
    if (
      projeto.descontosBonus?.ativo &&
      cenario.perderBonusPontualidade &&
      projeto.descontosBonus.bonusPontualidadeCentavos > 0 &&
      dataMes.getFullYear() === dataChavesEfetiva.getFullYear() &&
      dataMes.getMonth() === dataChavesEfetiva.getMonth()
    ) {
      const valBonus = projeto.descontosBonus.bonusPontualidadeCentavos;
      desembolsoVendedorCentavos += valBonus;
      custoTotalPagoVendedor += valBonus;
      eventosDoMes.push({
        categoria: 'VENDEDOR',
        descricao: `[PERDA DE BÔNUS PONTUALIDADE] Cobrança nas Chaves por atraso contratual no parcelamento da entrada`,
        valorCentavos: valBonus,
        destinatario: 'VENDEDOR'
      });
    }

    // 4. Desembolso Banco
    let desembolsoBancoCentavos = 0;
    let saldoDevedorBanco = 0;

    // Verificar se o banco já iniciou amortização ou fase de obra
    const parcelaBanco = tabelaBancaria.find(p => p.vencimento.startsWith(competenciaStr));
    if (parcelaBanco) {
      desembolsoBancoCentavos += parcelaBanco.encargoTotalCentavos;
      saldoDevedorBanco = parcelaBanco.saldoDevedorFinalCentavos;
      
      custoTotalJurosBanco += parcelaBanco.jurosCentavos;
      custoTotalSegurosBanco += (parcelaBanco.seguroMipCentavos + parcelaBanco.seguroDfiCentavos);
      custoTotalTaxasAdmBanco += parcelaBanco.taxaAdmCentavos;
      custoTotalPagoBanco += parcelaBanco.encargoTotalCentavos;

      eventosDoMes.push({
        categoria: 'ENCARGO_BANCO',
        descricao: `Parcela Bancária nº ${parcelaBanco.numero} (Amort: ${toReais(parcelaBanco.amortizacaoCentavos)} + Juros: ${toReais(parcelaBanco.jurosCentavos)} + Seg: ${toReais(parcelaBanco.seguroMipCentavos + parcelaBanco.seguroDfiCentavos)})`,
        valorCentavos: parcelaBanco.encargoTotalCentavos,
        destinatario: 'BANCO'
      });
    }

    // 5. Custos Complementares (ITBI, Registro, Reforma, Mudança)
    let custosComplementaresCentavos = 0;
    for (const custo of projeto.custosComplementares) {
      if (custo.financiadoPeloBanco) continue; // Não sai do caixa se financiado pelo banco

      let dataCusto = new Date(custo.vencimento);
      if (custo.vinculoMarco === 'CHAVES') {
        dataCusto = new Date(dataChavesEfetiva);
        if (custo.diasAposMarco) dataCusto.setDate(dataCusto.getDate() + custo.diasAposMarco);
      } else if (custo.vinculoMarco === 'MUDANCA') {
        dataCusto = new Date(dataMudancaEfetiva);
        if (custo.diasAposMarco) dataCusto.setDate(dataCusto.getDate() + custo.diasAposMarco);
      }

      if (dataCusto.getFullYear() === dataMes.getFullYear() && dataCusto.getMonth() === dataMes.getMonth()) {
        let val = new Decimal(custo.valorCentavos);
        if (custo.categoria === 'REFORMA_INSTALACAO' && cenario.aumentoCustosInstalacaoPercent !== 0) {
          val = val.times(new Decimal(1).plus(new Decimal(cenario.aumentoCustosInstalacaoPercent).dividedBy(100)));
        }
        const valCent = val.round().toNumber();
        custosComplementaresCentavos += valCent;
        custoTotalCustosComplementares += valCent;

        eventosDoMes.push({
          categoria: 'CUSTO_COMPLEMENTAR',
          descricao: custo.descricao,
          valorCentavos: valCent,
          destinatario: 'CARTORIO_PREFEITURA'
        });
      }
    }

    // Saídas totais do mês
    const totalSaidasCentavos = despesasVidaCentavos + moradiaAtualCentavos + outrasDividasCentavos +
      desembolsoVendedorCentavos + desembolsoBancoCentavos + custosComplementaresCentavos;

    const saldoMesCentavos = receitasDoMesCentavos - totalSaidasCentavos;
    saldoCaixaAtual = saldoCaixaAtual.plus(saldoMesCentavos);
    const saldoAcumulado = saldoCaixaAtual.toNumber();

    // Rastreamento dos indicadores chave
    if (totalSaidasCentavos > maiorDesembolso) {
      maiorDesembolso = totalSaidasCentavos;
      mesMaiorDesembolso = competenciaStr;
    }

    if (saldoAcumulado < menorSaldoCaixa) {
      menorSaldoCaixa = saldoAcumulado;
      mesMenorSaldo = competenciaStr;
    }

    if (saldoAcumulado < 0 && primeiroMesInsuficiencia === null) {
      primeiroMesInsuficiencia = competenciaStr;
    }

    const reservaPiso = cenario.reservaMinimaDesejadaCentavos;
    const caixaLivre = saldoAcumulado - reservaPiso;
    const deficitReserva = caixaLivre < 0 ? Math.abs(caixaLivre) : 0;
    if (deficitReserva > maxDeficitReserva) {
      maxDeficitReserva = deficitReserva;
    }

    // Saldo nas chaves
    if (dataMes.getFullYear() === dataChavesEfetiva.getFullYear() && dataMes.getMonth() === dataChavesEfetiva.getMonth()) {
      saldoCaixaNasChaves = saldoAcumulado;
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
      saldoDevedorVendedorCentavos: 0,
      reservaMinimaPisoCentavos: reservaPiso,
      caixaLivreCentavos: caixaLivre,
      deficitAbaixoPisoCentavos: deficitReserva,
      eventosDoMes
    });
  }

  // Alertas de caixa e reserva
  if (primeiroMesInsuficiencia !== null) {
    alertas.push({
      codigo: 'CAIXA_NEGATIVO',
      severidade: 'BLOQUEANTE',
      titulo: 'Caixa familiar entra no negativo durante o planejamento',
      mensagem: `O saldo acumulado fica negativo pela primeira vez em ${primeiroMesInsuficiencia}, atingindo o pior saldo de ${toReais(menorSaldoCaixa)} em ${mesMenorSaldo}.`,
      acaoSugerida: 'Considere aumentar o caixa inicial, renegociar prazos de balões com o vendedor ou reduzir custos de reforma/instalação.'
    });
  } else if (maxDeficitReserva > 0) {
    alertas.push({
      codigo: 'RESERVA_CONSUMIDA',
      severidade: 'ATENCAO',
      titulo: 'Reserva de emergência comprometida em determinados meses',
      mensagem: `O caixa livre fica abaixo do piso de segurança desejado (${toReais(cenario.reservaMinimaDesejadaCentavos)}) em até ${toReais(maxDeficitReserva)}.`,
      acaoSugerida: 'Verifique se os balões coincidem com períodos de 13º salário ou planeje aportes antecipados.'
    });
  }

  // Comprometimento da renda no primeiro mês
  const rendaPrimeiroMes = linhasCaixa[0]?.receitasCentavos || 1;
  const encargoPrimeiroMes = tabelaBancaria[0]?.encargoTotalCentavos || 0;
  const taxaComprometimento = Number(((encargoPrimeiroMes / rendaPrimeiroMes) * 100).toFixed(2));

  if (taxaComprometimento > 30) {
    alertas.push({
      codigo: 'REGRA_NAO_CONFIRMADA',
      severidade: 'ATENCAO',
      titulo: 'Comprometimento de renda superior a 30% no 1º mês bancário',
      mensagem: `A parcela bancária de ${toReais(encargoPrimeiroMes)} representa ${taxaComprometimento}% da renda líquida familiar (${toReais(rendaPrimeiroMes)}). Bancos exigem margem máxima de 30% na aprovação.`,
      acaoSugerida: 'Avalie compor renda com mais um titular ou aumentar o valor de entrada para reduzir a parcela.'
    });
  }

  // Alerta da Ferramenta: Bônus de Pontualidade / Bom Pagador da Construtora
  if (projeto.descontosBonus?.ativo && projeto.descontosBonus.bonusPontualidadeCentavos > 0) {
    if (cenario.perderBonusPontualidade) {
      alertas.push({
        codigo: 'SALDO_RESIDUAL',
        severidade: 'BLOQUEANTE',
        titulo: 'Alerta da Ferramenta: Bônus de Pontualidade Cobrado nas Chaves',
        mensagem: `Simulação de estresse: devido a atraso no parcelamento, o bônus de ${toReais(projeto.descontosBonus.bonusPontualidadeCentavos)} foi cancelado e a dívida exigida na entrega das chaves (${dataChavesEfetiva.toISOString().substring(0, 7)}).`,
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
    custoAquisicaoEfetivoCentavos: custoTotalPagoVendedor + custoTotalPagoBanco + custoTotalCustosComplementares,
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
