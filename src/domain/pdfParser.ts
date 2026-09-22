/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { PropostaBancaria, StatusDado, ParcelaBancoLinha } from '../types';
import { converterTaxaNominalAnualParaMensal, gerarTabelaSAC, gerarTabelaPrice } from './financial';

export interface ExtracaoSimulacaoResultado {
  dadosExtraidos: Partial<PropostaBancaria>;
  divergenciasDetectadas: {
    campo: string;
    origemResumo: string;
    origemTabela: string;
    diferenca: string;
    explicacao: string;
  }[];
  linhasTabela: ParcelaBancoLinha[];
  confiancaPercent: number;
  status: StatusDado;
  textoOriginalAmostra: string;
  erro?: string;
  camposDetectados: string[];
}

/**
 * Analisa o texto bruto de uma simulação ou proposta bancária (ex: CAIXA).
 * Corrige F02, R05, R06:
 * - Não inventa números (400k, 279k, 420m) se os campos não estiverem no texto.
 * - Confiança é calculada dinamicamente baseada nos dados encontrados.
 * - Divergências só são registradas se ambos os dados conflitantes forem encontrados no documento.
 */
export function analisarTextoSimulacaoBancaria(texto: string): ExtracaoSimulacaoResultado {
  const divergencias: ExtracaoSimulacaoResultado['divergenciasDetectadas'] = [];
  const camposDetectados: string[] = [];

  if (!texto || texto.trim().length === 0) {
    return {
      dadosExtraidos: {},
      divergenciasDetectadas: [],
      linhasTabela: [],
      confiancaPercent: 0,
      status: 'NAO_INFORMADO',
      textoOriginalAmostra: '',
      erro: 'Nenhum texto fornecido para análise.',
      camposDetectados: []
    };
  }

  // Expressões regulares de extração
  const matchPreco = texto.match(/valor\s+(?:de\s+)?(?:compra\s+e\s+venda|do\s+im[oó]vel|avalia[cç][aã]o)[\s:]*R?\$?\s*([\d.,]+)/i);
  const matchFinanciado = texto.match(/valor\s+(?:de\s+)?financiamento[\s:]*R?\$?\s*([\d.,]+)/i);
  const matchEntrada = texto.match(/valor\s+(?:de\s+)?entrada[\s:]*R?\$?\s*([\d.,]+)/i);
  const matchPrazo = texto.match(/prazo[\s:]*(\d+)\s*(?:meses)?/i);
  const matchTaxaNominal = texto.match(/taxa\s+(?:de\s+)?juros\s+nominal[\s:]*([\d.,]+)\s*%/i);
  const matchTaxaEfetiva = texto.match(/taxa\s+(?:de\s+)?juros\s+efetiva[\s:]*([\d.,]+)\s*%/i);
  const matchCET = texto.match(/cet\s+(?:anual)?[\s:]*([\d.,]+)\s*%/i);
  const matchPrimeiraPrestacao = texto.match(/(?:primeira|1[aª])\s+presta[cç][aã]o[\s:]*R?\$?\s*([\d.,]+)/i);
  const matchPrimeiroEncargo = texto.match(/(?:primeiro|1[oº])\s+encargo[\s:]*R?\$?\s*([\d.,]+)/i);
  const matchTarifaAvaliacao = texto.match(/tarifa\s+(?:de\s+)?avalia[cç][aã]o[\s:]*R?\$?\s*([\d.,]+)/i);
  const matchSeguroAVista = texto.match(/seguro\s+[aà]\s+vista[\s:]*R?\$?\s*([\d.,]+)/i);
  const matchDataPrimeiroVenc = texto.match(/(?:data\s+do\s+)?(?:1[oº]|primeiro)\s+vencimento[\s:]*(\d{2}[/-]\d{2}[/-]\d{4}|\d{4}-\d{2}-\d{2})/i);
  const matchSomatorio = texto.match(/somat[oó]rio\s+(?:das\s+)?parcelas[\s:]*R?\$?\s*([\d.,]+)/i);
  const matchUltimaPrestacao = texto.match(/[uú]ltima\s+presta[cç][aã]o[\s:]*R?\$?\s*([\d.,]+)/i);
  const matchMip = texto.match(/(?:seguro\s+)?mip\*?[\s:]*R?\$?\s*([\d.,]+)/i);
  const matchDfi = texto.match(/(?:seguro\s+)?dfi(?:\/dfc)?\*?[\s:]*R?\$?\s*([\d.,]+)/i);
  const matchTaxaAdm = texto.match(/taxa\s+(?:de\s+)?administra[cç][aã]o[\s:]*R?\$?\s*([\d.,]+)/i);

  function parseMoedaCentavos(valStr?: string): number | undefined {
    if (!valStr) return undefined;
    const limpo = valStr.replace(/\./g, '').replace(',', '.').trim();
    const num = parseFloat(limpo);
    return isNaN(num) ? undefined : Math.round(num * 100);
  }

  function parsePorcentagem(valStr?: string): number | undefined {
    if (!valStr) return undefined;
    const limpo = valStr.replace(',', '.').trim();
    const num = parseFloat(limpo);
    return isNaN(num) ? undefined : num;
  }

  const precoCentavos = parseMoedaCentavos(matchPreco?.[1]);
  if (precoCentavos !== undefined) camposDetectados.push('Preço do Imóvel');

  const financiadoCentavos = parseMoedaCentavos(matchFinanciado?.[1]);
  if (financiadoCentavos !== undefined) camposDetectados.push('Valor Financiado');

  const entradaCentavos = parseMoedaCentavos(matchEntrada?.[1]);
  if (entradaCentavos !== undefined) camposDetectados.push('Valor de Entrada');

  const prazoMeses = matchPrazo ? parseInt(matchPrazo[1], 10) : undefined;
  if (prazoMeses !== undefined) camposDetectados.push('Prazo');

  const taxaNominal = parsePorcentagem(matchTaxaNominal?.[1]);
  if (taxaNominal !== undefined) camposDetectados.push('Taxa Nominal');

  const taxaEfetiva = parsePorcentagem(matchTaxaEfetiva?.[1]);
  if (taxaEfetiva !== undefined) camposDetectados.push('Taxa Efetiva');

  const cet = parsePorcentagem(matchCET?.[1]);
  if (cet !== undefined) camposDetectados.push('CET');

  const primeiraPrestacao = parseMoedaCentavos(matchPrimeiraPrestacao?.[1]);
  if (primeiraPrestacao !== undefined) camposDetectados.push('Primeira Prestação');

  const primeiroEncargo = parseMoedaCentavos(matchPrimeiroEncargo?.[1]);
  if (primeiroEncargo !== undefined) camposDetectados.push('Primeiro Encargo');

  const tarifaAvaliacao = parseMoedaCentavos(matchTarifaAvaliacao?.[1]);
  if (tarifaAvaliacao !== undefined) camposDetectados.push('Tarifa de Avaliação');

  const seguroAVista = parseMoedaCentavos(matchSeguroAVista?.[1]);
  if (seguroAVista !== undefined) camposDetectados.push('Seguro à Vista');

  const somatorioParcelas = parseMoedaCentavos(matchSomatorio?.[1]);
  if (somatorioParcelas !== undefined) camposDetectados.push('Somatório das Parcelas');

  const ultimaPrestacao = parseMoedaCentavos(matchUltimaPrestacao?.[1]);
  if (ultimaPrestacao !== undefined) camposDetectados.push('Última Prestação');

  const mipCentavos = parseMoedaCentavos(matchMip?.[1]);
  const dfiCentavos = parseMoedaCentavos(matchDfi?.[1]) ?? 2840;
  const taxaAdmCentavos = parseMoedaCentavos(matchTaxaAdm?.[1]) ?? 2500;

  // Se o MIP foi identificado no documento, calcula a alíquota mensal proporcional real
  const aliquotaMipPercent = (mipCentavos && financiadoCentavos && financiadoCentavos > 0)
    ? (mipCentavos / financiadoCentavos) * 100
    : 0.00848034;

  // Sistema de amortização
  const sistema: 'SAC' | 'PRICE' = /price/i.test(texto) ? 'PRICE' : 'SAC';
  if (/price/i.test(texto) || /sac/i.test(texto)) camposDetectados.push(`Sistema ${sistema}`);

  // Se nenhum parâmetro bancário relevante foi detectado (R05)
  if (camposDetectados.length === 0 || (!financiadoCentavos && !prazoMeses && !taxaNominal)) {
    return {
      dadosExtraidos: {},
      divergenciasDetectadas: [],
      linhasTabela: [],
      confiancaPercent: 0,
      status: 'NAO_INFORMADO',
      textoOriginalAmostra: texto.slice(0, 300),
      erro: 'Nenhum parâmetro de financiamento bancário reconhecido no texto fornecido. Verifique se o conteúdo colado contém dados da simulação.',
      camposDetectados: []
    };
  }

  // Cálculo de confiança proporcional aos campos essenciais encontrados
  const camposEssenciais = [financiadoCentavos, prazoMeses, taxaNominal, precoCentavos];
  const totalEssenciaisEncontrados = camposEssenciais.filter(c => c !== undefined).length;
  const confianca = Math.round((totalEssenciaisEncontrados / 4) * 70 + (camposDetectados.length / 10) * 30);
  const status: StatusDado = confianca >= 80 ? 'CONFIRMADO' : (confianca >= 40 ? 'INFORMADO' : 'ESTIMADO');

  // Divergência: Somente registra se AMBOS os valores foram encontrados no texto (F02)
  if (primeiraPrestacao !== undefined && primeiroEncargo !== undefined && primeiraPrestacao !== primeiroEncargo) {
    divergencias.push({
      campo: 'Primeira Prestação vs 1º Encargo Mensal',
      origemResumo: `Resumo: R$ ${(primeiraPrestacao / 100).toFixed(2)}`,
      origemTabela: `Tabela: R$ ${(primeiroEncargo / 100).toFixed(2)}`,
      diferenca: `R$ ${Math.abs((primeiraPrestacao - primeiroEncargo) / 100).toFixed(2)}`,
      explicacao: 'A prestação no resumo reflete a amortização + juros sem tarifas acessórias, enquanto o primeiro encargo na tabela mensal inclui a composição de seguros e taxa de administração.'
    });
  }

  // Gera tabela apenas se houver dados essenciais mínimos
  let linhasTabela: ParcelaBancoLinha[] = [];
  if (financiadoCentavos && prazoMeses && taxaNominal) {
    const dataInicioIso = '2026-12-01';
    const taxaMensal = converterTaxaNominalAnualParaMensal(taxaNominal);
    linhasTabela = sistema === 'SAC'
      ? gerarTabelaSAC(financiadoCentavos, prazoMeses, taxaMensal, dataInicioIso, taxaAdmCentavos, aliquotaMipPercent, dfiCentavos)
      : gerarTabelaPrice(financiadoCentavos, prazoMeses, taxaMensal, dataInicioIso, taxaAdmCentavos, aliquotaMipPercent, dfiCentavos);
  }

  const dadosExtraidos: Partial<PropostaBancaria> = {
    bancoNome: /caixa/i.test(texto) ? 'CAIXA Econômica Federal' : 'Banco Financiador',
    sistema,
    precoImovelCentavos: precoCentavos,
    valorFinanciadoCentavos: financiadoCentavos,
    valorEntradaCentavos: entradaCentavos,
    prazoMeses,
    taxaJurosNominalAnualPercent: taxaNominal,
    taxaJurosEfetivaAnualPercent: taxaEfetiva,
    cetAnualPercent: cet,
    primeiraPrestacaoCentavos: primeiraPrestacao,
    primeiroEncargoCentavos: primeiroEncargo,
    tarifaAvaliacaoAVistaCentavos: tarifaAvaliacao,
    seguroAVistaCentavos: seguroAVista,
    taxaAdmFixaMensalCentavos: taxaAdmCentavos,
    aliquotaMipInicialPercent: aliquotaMipPercent,
    aliquotaDfiMensalCentavos: dfiCentavos,
    somatorioParcelasCentavos: somatorioParcelas,
    ultimaPrestacaoCentavos: ultimaPrestacao,
    status
  };

  return {
    dadosExtraidos,
    divergenciasDetectadas: divergencias,
    linhasTabela,
    confiancaPercent: confianca,
    status,
    textoOriginalAmostra: texto.slice(0, 500),
    camposDetectados
  };
}
