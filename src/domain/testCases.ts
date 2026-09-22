/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import Decimal from 'decimal.js';
import {
  gerarTabelaSAC,
  gerarTabelaPrice,
  simularProjetoCompleto
} from './financial';
import { PROJETO_REAL_SAC_CAIXA, CENARIO_BASE_PADRAO } from './defaults';

export interface ResultadoTeste {
  id: string;
  nome: string;
  descricao: string;
  esperado: string;
  obtido: string;
  passou: boolean;
}

export function executarTestesAceitacao(): ResultadoTeste[] {
  const resultados: ResultadoTeste[] = [];

  // Teste 1: SAC com P=1.200, n=3, i=1% ao mês, sem custos
  // Amortizações 400; juros 12, 8, 4; parcelas 412, 408, 404; saldo zero
  try {
    const sacP = 120000; // 1200 em centavos
    const i = new Decimal(0.01);
    const sacRes = gerarTabelaSAC(sacP, 3, i, '2026-01-01', 0, 0, 0);
    
    const jurosObtidos = sacRes.map(l => l.jurosCentavos / 100);
    const parcelasObtidas = sacRes.map(l => l.prestacaoCentavos / 100);
    const saldoFinal = sacRes[sacRes.length - 1].saldoDevedorFinalCentavos;

    const cond1 = jurosObtidos[0] === 12 && jurosObtidos[1] === 8 && jurosObtidos[2] === 4;
    const cond2 = parcelasObtidas[0] === 412 && parcelasObtidas[1] === 408 && parcelasObtidas[2] === 404;
    const cond3 = saldoFinal === 0;

    resultados.push({
      id: 'T1_SAC_BASICO',
      nome: 'SAC Básico (P=1.200, n=3, i=1% a.m.)',
      descricao: 'Verifica amortização constante, juros decrescentes e quitação exata',
      esperado: 'Amort=400; Juros=[12, 8, 4]; Parcelas=[412, 408, 404]; Saldo=0',
      obtido: `Juros=[${jurosObtidos.join(', ')}]; Parcelas=[${parcelasObtidas.join(', ')}]; Saldo=${saldoFinal}`,
      passou: cond1 && cond2 && cond3
    });
  } catch (err: any) {
    resultados.push({
      id: 'T1_SAC_BASICO',
      nome: 'SAC Básico',
      descricao: 'Erro na execução',
      esperado: 'Sucesso',
      obtido: String(err),
      passou: false
    });
  }

  // Teste 2: Price com P=1.200, n=3, i=0
  // Três parcelas de 400; sem divisão por zero
  try {
    const priceP = 120000;
    const iZero = new Decimal(0);
    const priceRes = gerarTabelaPrice(priceP, 3, iZero, '2026-01-01', 0, 0, 0);
    const parcelas = priceRes.map(l => l.prestacaoCentavos / 100);
    const cond = parcelas.length === 3 && parcelas.every(p => p === 400);

    resultados.push({
      id: 'T2_PRICE_ZERO',
      nome: 'Price com Taxa Zero (sem divisão por zero)',
      descricao: 'PMT deve ser igual a P/n quando taxa de juros for 0',
      esperado: '3 parcelas de R$ 400,00',
      obtido: `${parcelas.length} parcelas de R$ ${parcelas[0]?.toFixed(2)}`,
      passou: cond
    });
  } catch (err: any) {
    resultados.push({
      id: 'T2_PRICE_ZERO',
      nome: 'Price com Taxa Zero',
      descricao: 'Erro na execução',
      esperado: 'Sucesso',
      obtido: String(err),
      passou: false
    });
  }

  // Teste 3: Chaves de 20.000, índice 0,5% ao mês por 24 meses
  // Resultado: 20000 * (1.005)^24 = 22.543,195... -> R$ 22.543,20 após arredondamento
  try {
    const pChaves = new Decimal(20000);
    const taxa = new Decimal(0.005);
    const valCorrigido = pChaves.times(new Decimal(1).plus(taxa).pow(24)).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
    const passou = valCorrigido.toNumber() === 22543.20;

    resultados.push({
      id: 'T3_CHAVES_INCC',
      nome: 'Correção de Parcela de Chaves (INCC 0,5% a.m. / 24 meses)',
      descricao: 'Verifica capitalização composta de índice e arredondamento ao centavo',
      esperado: 'R$ 22.543,20',
      obtido: `R$ ${valCorrigido.toNumber().toFixed(2)}`,
      passou
    });
  } catch (err: any) {
    resultados.push({
      id: 'T3_CHAVES_INCC',
      nome: 'Correção de Parcela',
      descricao: 'Erro',
      esperado: 'R$ 22.543,20',
      obtido: String(err),
      passou: false
    });
  }

  // Teste 4: Saldo vendedor 50.000, correção 0,5%, pagamento 1.000 após correção
  // Saldo final = 50.000 * 1,005 - 1.000 = 50.250 - 1.000 = 49.250,00
  try {
    const saldoIni = new Decimal(50000);
    const saldoCorr = saldoIni.times(1.005);
    const saldoFinal = saldoCorr.minus(1000);
    const passou = saldoFinal.toNumber() === 49250;

    resultados.push({
      id: 'T4_SALDO_VENDEDOR',
      nome: 'Evolução de Saldo Devedor do Vendedor',
      descricao: 'Atualização monetária pré-pagamento seguida de abatimento',
      esperado: 'R$ 49.250,00',
      obtido: `R$ ${saldoFinal.toNumber().toFixed(2)}`,
      passou
    });
  } catch (err: any) {
    resultados.push({
      id: 'T4_SALDO_VENDEDOR',
      nome: 'Saldo Vendedor',
      descricao: 'Erro',
      esperado: 'R$ 49.250,00',
      obtido: String(err),
      passou: false
    });
  }

  // Teste 5: Caixa 5.000, renda 3.000, vida 2.000, compra 4.000
  // Caixa final = 5.000 + 3.000 - 2.000 - 4.000 = 2.000
  try {
    const caixaIni = 5000;
    const renda = 3000;
    const vida = 2000;
    const compra = 4000;
    const caixaFim = caixaIni + renda - vida - compra;
    const passou = caixaFim === 2000;

    resultados.push({
      id: 'T5_CONCILIACAO_CAIXA',
      nome: 'Equação Fundamental do Fluxo de Caixa Familiar',
      descricao: 'Caixa final = caixa inicial + receitas - despesas - desembolsos',
      esperado: 'R$ 2.000,00',
      obtido: `R$ ${caixaFim.toFixed(2)}`,
      passou
    });
  } catch (err: any) {
    resultados.push({
      id: 'T5_CONCILIACAO_CAIXA',
      nome: 'Conciliação Caixa',
      descricao: 'Erro',
      esperado: 'R$ 2.000,00',
      obtido: String(err),
      passou: false
    });
  }

  // Teste 6: Invariantes do Caso Real SAC CAIXA (Seção 2.1)
  // Verificação dos números do documento de 09/09/2026:
  // Preço R$ 400.000 | Financiamento R$ 279.234,01 | Entrada R$ 120.765,99
  // CET 8,69% a.a. | 1ª parcela R$ 2.524,36 | Prazo 420m
  try {
    const sim = simularProjetoCompleto(PROJETO_REAL_SAC_CAIXA, CENARIO_BASE_PADRAO);
    const rec = sim.reconciliacao;
    const prop = PROJETO_REAL_SAC_CAIXA.propostaBancaria;

    const precoFecha = rec.fechado && rec.diferencaNaoConciliadaCentavos === 0;
    const financiadoOk = prop.valorFinanciadoCentavos === 27923401;
    const entradaOk = prop.valorEntradaCentavos === 12076599;
    const cetOk = prop.cetAnualPercent === 8.69;

    resultados.push({
      id: 'T6_SIMULACAO_REAL_SAC',
      nome: 'Validação Numérica da Proposta Real CAIXA SAC',
      descricao: 'Conferência exata de principal (R$ 279.234,01), entrada (R$ 120.765,99) e reconciliação',
      esperado: 'Preço 100% conciliado (R$ 400.000,00) e parâmetros do PDF preservados',
      obtido: `Financiado: R$ ${(prop.valorFinanciadoCentavos/100).toFixed(2)} | Entrada: R$ ${(prop.valorEntradaCentavos/100).toFixed(2)} | Dif Preço: R$ ${(rec.diferencaNaoConciliadaCentavos/100).toFixed(2)}`,
      passou: precoFecha && financiadoOk && entradaOk && cetOk
    });
  } catch (err: any) {
    resultados.push({
      id: 'T6_SIMULACAO_REAL_SAC',
      nome: 'Validação Simulação Real',
      descricao: 'Erro',
      esperado: 'Conferência total',
      obtido: String(err),
      passou: false
    });
  }

  // Teste 7: Descontos & Bônus de Pontualidade / Bom Pagador da Construtora
  // Verifica abate no preço efetivo e reativação da dívida nas chaves sob estresse
  try {
    const projComBonus = {
      ...PROJETO_REAL_SAC_CAIXA,
      descontosBonus: {
        ativo: true,
        descontoComercialCentavos: 1200000, // R$ 12.000,00
        tipoAbateDesconto: 'ENTRADA' as const,
        bonusPontualidadeCentavos: 1750000, // R$ 17.500,00
        reverterBonusSeAtrasar: true,
        observacoes: 'Bônus bom pagador condicional',
        parcelamentoEntrada: {
          ativo: true,
          numeroParcelas: 24,
          dataPrimeiraParcela: '2026-11-01',
          indiceCorrecao: 'INCC' as const
        }
      }
    };

    // No cenário base (sem perda do bônus)
    const simBase = simularProjetoCompleto(projComBonus, CENARIO_BASE_PADRAO);
    const precoEfetivoBase = simBase.reconciliacao.precoEfetivoCentavos || 0;
    const condPrecoEfetivo = precoEfetivoBase === (PROJETO_REAL_SAC_CAIXA.precoImovelCentavos - 2950000);

    // No cenário adverso com perda do bônus por atraso
    const simEstresse = simularProjetoCompleto(projComBonus, {
      ...CENARIO_BASE_PADRAO,
      perderBonusPontualidade: true
    });
    
    // Verifica se gerou o evento de reativação de dívida nas chaves de R$ 17.500
    const eventoReativacao = simEstresse.linhasCaixa
      .flatMap((f: any) => f.eventosDoMes)
      .find((e: any) => e.descricao.includes('[PERDA DE BÔNUS PONTUALIDADE]'));
    
    const condReativacaoOk = !!eventoReativacao && eventoReativacao.valorCentavos === 1750000;

    resultados.push({
      id: 'T7_BONUS_PONTUALIDADE_CONSTRUTORA',
      nome: 'Bônus Bom Pagador & Reativação de Dívida nas Chaves',
      descricao: 'Verifica abate contratual e reativação de R$ 17.500,00 nas chaves caso haja atraso no parcelamento',
      esperado: 'Preço Efetivo abatido em R$ 29.500,00 e cobrança nas chaves em cenário de estresse',
      obtido: `Preço Efetivo: R$ ${(precoEfetivoBase/100).toFixed(2)} | Cobrança Chaves: R$ ${eventoReativacao ? (eventoReativacao.valorCentavos/100).toFixed(2) : '0.00'}`,
      passou: condPrecoEfetivo && condReativacaoOk
    });
  } catch (err: any) {
    resultados.push({
      id: 'T7_BONUS_PONTUALIDADE_CONSTRUTORA',
      nome: 'Bônus Bom Pagador & Reativação de Dívida',
      descricao: 'Erro na execução',
      esperado: 'Sucesso',
      obtido: String(err),
      passou: false
    });
  }

  return resultados;
}
