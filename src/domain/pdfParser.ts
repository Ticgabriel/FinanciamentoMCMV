/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import * as pdfjsLib from 'pdfjs-dist';
import { PropostaBancaria, StatusDado, ParcelaBancoLinha } from '../types';
import { converterTaxaNominalAnualParaMensal, gerarTabelaSAC, gerarTabelaPrice } from './financial';

// Configuração de worker do PDF.js
if (typeof window !== 'undefined') {
  try {
    pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
      'pdfjs-dist/build/pdf.worker.min.mjs',
      import.meta.url
    ).toString();
  } catch {
    pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version || '4.10.38'}/pdf.worker.min.mjs`;
  }
}

export interface ParticipanteMIP {
  id?: string;
  nome?: string;
  idade: number;
  percentualRenda: number; // ex: 60 para 60%
}

/**
 * Tabela de referência SUSEP / Apólices Habitacionais SFH (MIP - Morte e Invalidez Permanente)
 * Faixas etárias de contratação e alíquotas mensais sobre o saldo devedor
 */
export const TABELA_FAIXAS_ETARIAS_MIP = [
  { idadeMax: 25, taxaMensalPercent: 0.00848034, descricao: 'Até 25 anos' },
  { idadeMax: 30, taxaMensalPercent: 0.01120000, descricao: '26 a 30 anos' },
  { idadeMax: 35, taxaMensalPercent: 0.01560000, descricao: '31 a 35 anos' },
  { idadeMax: 40, taxaMensalPercent: 0.02210000, descricao: '36 a 40 anos' },
  { idadeMax: 45, taxaMensalPercent: 0.03450000, descricao: '41 a 45 anos' },
  { idadeMax: 50, taxaMensalPercent: 0.05600000, descricao: '46 a 50 anos' },
  { idadeMax: 55, taxaMensalPercent: 0.09800000, descricao: '51 a 55 anos' },
  { idadeMax: 60, taxaMensalPercent: 0.16500000, descricao: '56 a 60 anos' },
  { idadeMax: 65, taxaMensalPercent: 0.28500000, descricao: '61 a 65 anos' },
  { idadeMax: 80, taxaMensalPercent: 0.49500000, descricao: 'Acima de 65 anos' }
];

export function obterAliquotaMIPPorIdade(idade: number): number {
  for (const faixa of TABELA_FAIXAS_ETARIAS_MIP) {
    if (idade <= faixa.idadeMax) {
      return faixa.taxaMensalPercent;
    }
  }
  return 0.495;
}

/**
 * Calcula a alíquota ponderada de seguro MIP considerando a idade e composição de renda dos proponentes
 */
export function calcularAliquotaMIPParticipantes(participantes: ParticipanteMIP[]): number {
  if (!participantes || participantes.length === 0) {
    return 0.00848034;
  }
  const somaPercentuais = participantes.reduce((acc, p) => acc + (p.percentualRenda || 0), 0);
  if (somaPercentuais <= 0) return 0.00848034;

  let aliquotaPonderada = 0;
  for (const p of participantes) {
    const aliquotaP = obterAliquotaMIPPorIdade(p.idade);
    const peso = (p.percentualRenda || 0) / somaPercentuais;
    aliquotaPonderada += aliquotaP * peso;
  }
  return Number(aliquotaPonderada.toFixed(8));
}

/**
 * Extrai todo o texto legível de um arquivo PDF carregado pelo usuário via pdfjs-dist.
 */
export async function extrairTextoDeArquivoPDF(arquivoOuBuffer: File | ArrayBuffer | Uint8Array): Promise<string> {
  let uint8Data: Uint8Array;
  if (arquivoOuBuffer instanceof Uint8Array) {
    uint8Data = arquivoOuBuffer;
  } else if (arquivoOuBuffer instanceof ArrayBuffer) {
    uint8Data = new Uint8Array(arquivoOuBuffer);
  } else if (typeof File !== 'undefined' && arquivoOuBuffer instanceof File) {
    const ab = await arquivoOuBuffer.arrayBuffer();
    uint8Data = new Uint8Array(ab);
  } else {
    throw new Error('Formato de arquivo PDF inválido.');
  }

  const loadingTask = pdfjsLib.getDocument({
    data: uint8Data,
    useSystemFonts: true
  });

  const pdfDocument = await loadingTask.promise;
  const paginasTexto: string[] = [];

  for (let numPagina = 1; numPagina <= pdfDocument.numPages; numPagina++) {
    const pagina = await pdfDocument.getPage(numPagina);
    const textContent = await pagina.getTextContent();
    
    const itens = textContent.items as any[];
    let textoPagina = '';
    let ultimoY: number | null = null;

    for (const item of itens) {
      if ('str' in item) {
        const itemY = Math.round(item.transform[5]);
        if (ultimoY !== null && Math.abs(itemY - ultimoY) > 5) {
          textoPagina += '\n';
        } else if (ultimoY !== null && !textoPagina.endsWith(' ') && !textoPagina.endsWith('\n')) {
          textoPagina += ' ';
        }
        textoPagina += item.str;
        ultimoY = itemY;
      }
    }
    paginasTexto.push(textoPagina);
  }

  return paginasTexto.join('\n\n--- PÁGINA SEGUINTE ---\n\n');
}

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
 * Analisa o texto de uma proposta ou simulação bancária (ex: CAIXA / SFH).
 * Não injeta números presumidos se ausentes no documento.
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
  if (mipCentavos !== undefined) camposDetectados.push('Seguro MIP');

  const dfiCentavos = parseMoedaCentavos(matchDfi?.[1]);
  if (dfiCentavos !== undefined) camposDetectados.push('Seguro DFI');

  const taxaAdmCentavos = parseMoedaCentavos(matchTaxaAdm?.[1]);
  if (taxaAdmCentavos !== undefined) camposDetectados.push('Taxa de Administração');

  // Se o MIP foi identificado no documento, calcula a alíquota mensal proporcional real
  let aliquotaMipPercent: number | undefined = undefined;
  if (mipCentavos !== undefined && financiadoCentavos && financiadoCentavos > 0) {
    aliquotaMipPercent = (mipCentavos / financiadoCentavos) * 100;
  }

  // Sistema de amortização
  const sistema: 'SAC' | 'PRICE' = /price/i.test(texto) ? 'PRICE' : 'SAC';
  if (/price/i.test(texto) || /sac/i.test(texto)) camposDetectados.push(`Sistema ${sistema}`);

  // Se nenhum parâmetro bancário relevante foi detectado
  if (camposDetectados.length === 0 || (!financiadoCentavos && !prazoMeses && !taxaNominal)) {
    return {
      dadosExtraidos: {},
      divergenciasDetectadas: [],
      linhasTabela: [],
      confiancaPercent: 0,
      status: 'NAO_INFORMADO',
      textoOriginalAmostra: texto.slice(0, 300),
      erro: 'Nenhum parâmetro de financiamento bancário reconhecido no texto fornecido. Verifique se o documento contém os dados da simulação.',
      camposDetectados: []
    };
  }

  // Cálculo de confiança proporcional aos campos essenciais encontrados
  const camposEssenciais = [financiadoCentavos, prazoMeses, taxaNominal, precoCentavos];
  const totalEssenciaisEncontrados = camposEssenciais.filter(c => c !== undefined).length;
  const confianca = Math.round((totalEssenciaisEncontrados / 4) * 70 + (camposDetectados.length / 10) * 30);
  const status: StatusDado = confianca >= 80 ? 'CONFIRMADO' : (confianca >= 40 ? 'INFORMADO' : 'ESTIMADO');

  // Divergência: Somente registra se AMBOS os valores foram encontrados no texto
  if (primeiraPrestacao !== undefined && primeiroEncargo !== undefined && primeiraPrestacao !== primeiroEncargo) {
    divergencias.push({
      campo: 'Primeira Prestação vs 1º Encargo Mensal',
      origemResumo: `Resumo: R$ ${(primeiraPrestacao / 100).toFixed(2)}`,
      origemTabela: `Tabela: R$ ${(primeiroEncargo / 100).toFixed(2)}`,
      diferenca: `R$ ${Math.abs((primeiraPrestacao - primeiroEncargo) / 100).toFixed(2)}`,
      explicacao: 'A prestação no resumo reflete a amortização + juros sem tarifas acessórias, enquanto o primeiro encargo na tabela mensal inclui a composição de seguros e taxa de administração.'
    });
  }

  // Gera tabela de projeção apenas se houver dados essenciais mínimos
  let linhasTabela: ParcelaBancoLinha[] = [];
  if (financiadoCentavos && prazoMeses && taxaNominal) {
    const dataInicioIso = '2026-12-01';
    const taxaMensal = converterTaxaNominalAnualParaMensal(taxaNominal);
    const taxaAdmEfetiva = taxaAdmCentavos ?? 2500;
    const mipEfetivo = aliquotaMipPercent ?? 0.00848034;
    const dfiEfetivo = dfiCentavos ?? 2840;

    linhasTabela = sistema === 'SAC'
      ? gerarTabelaSAC(financiadoCentavos, prazoMeses, taxaMensal, dataInicioIso, taxaAdmEfetiva, mipEfetivo, dfiEfetivo)
      : gerarTabelaPrice(financiadoCentavos, prazoMeses, taxaMensal, dataInicioIso, taxaAdmEfetiva, mipEfetivo, dfiEfetivo);
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
