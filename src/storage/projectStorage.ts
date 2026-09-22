/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { ProjetoFinanciamento } from '../types';
import { PROJETO_REAL_SAC_CAIXA } from '../domain/defaults';

const STORAGE_KEY = 'planejador_financiamento_projeto_v1';

export interface ValidacaoProjetoResultado {
  valido: boolean;
  erros: string[];
  projeto?: ProjetoFinanciamento;
}

/**
 * Validação estrutural rigorosa do projeto JSON (Corrige F13, R18).
 * Impede que JSONs malformados ou incompletos (como {precoImovelCentavos:1, propostaBancaria:{}})
 * quebrem o aplicativo ou corrompam o estado do usuário.
 */
export function validarEstruturaProjeto(dados: any): ValidacaoProjetoResultado {
  const erros: string[] = [];

  if (!dados || typeof dados !== 'object') {
    return { valido: false, erros: ['Conteúdo não é um objeto JSON válido.'] };
  }

  if (typeof dados.precoImovelCentavos !== 'number' || dados.precoImovelCentavos <= 0) {
    erros.push('precoImovelCentavos deve ser um número positivo.');
  }

  if (!dados.propostaBancaria || typeof dados.propostaBancaria !== 'object') {
    erros.push('propostaBancaria ausente ou inválida.');
  } else {
    const prop = dados.propostaBancaria;
    if (typeof prop.valorFinanciadoCentavos !== 'number' || prop.valorFinanciadoCentavos <= 0) {
      erros.push('propostaBancaria.valorFinanciadoCentavos deve ser um número positivo.');
    }
    if (typeof prop.prazoMeses !== 'number' || prop.prazoMeses <= 0) {
      erros.push('propostaBancaria.prazoMeses deve ser maior que zero.');
    }
    if (typeof prop.taxaJurosNominalAnualPercent !== 'number') {
      erros.push('propostaBancaria.taxaJurosNominalAnualPercent deve ser informada.');
    }
  }

  if (!Array.isArray(dados.fontes)) {
    erros.push('fontes deve ser uma lista de fontes de recurso.');
  }

  if (!Array.isArray(dados.obrigacoesVendedor)) {
    erros.push('obrigacoesVendedor deve ser uma lista de obrigações com o vendedor.');
  }

  if (!Array.isArray(dados.marcos)) {
    erros.push('marcos deve ser uma lista de marcos temporais.');
  }

  if (!Array.isArray(dados.receitas)) {
    erros.push('receitas deve ser uma lista de receitas familiares.');
  }

  if (!Array.isArray(dados.despesas)) {
    erros.push('despesas deve ser uma lista de despesas familiares.');
  }

  if (!Array.isArray(dados.custosComplementares)) {
    erros.push('custosComplementares deve ser uma lista.');
  }

  if (!Array.isArray(dados.cenarios) || dados.cenarios.length === 0) {
    erros.push('cenarios deve conter pelo menos um cenário de simulação.');
  }

  if (erros.length > 0) {
    return { valido: false, erros };
  }

  return { valido: true, erros: [], projeto: dados as ProjetoFinanciamento };
}

export function salvarProjetoLocalmente(projeto: ProjetoFinanciamento): void {
  try {
    const jsonStr = JSON.stringify({
      ...projeto,
      atualizadoEm: new Date().toISOString()
    });
    localStorage.setItem(STORAGE_KEY, jsonStr);
  } catch (e) {
    console.warn('Não foi possível persistir no localStorage:', e);
  }
}

export function carregarProjetoSalvo(): ProjetoFinanciamento {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return PROJETO_REAL_SAC_CAIXA;
    const parsed = JSON.parse(raw);
    const validacao = validarEstruturaProjeto(parsed);
    if (validacao.valido && validacao.projeto) {
      return validacao.projeto;
    } else {
      console.warn('Projeto salvo no localStorage continha erros de esquema. Restaurando padrão:', validacao.erros);
    }
  } catch (e) {
    console.error('Falha ao restaurar projeto salvo, utilizando padrão:', e);
  }
  return PROJETO_REAL_SAC_CAIXA;
}

export function exportarProjetoParaJSON(projeto: ProjetoFinanciamento): void {
  const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(projeto, null, 2));
  const downloadAnchor = document.createElement('a');
  downloadAnchor.setAttribute('href', dataStr);
  downloadAnchor.setAttribute('download', `financiamento_${projeto.id || 'projeto'}_${new Date().toISOString().split('T')[0]}.json`);
  document.body.appendChild(downloadAnchor);
  downloadAnchor.click();
  downloadAnchor.remove();
}

export function importarProjetoDeJSON(jsonContent: string): ProjetoFinanciamento {
  let parsed: any;
  try {
    parsed = JSON.parse(jsonContent);
  } catch (err: any) {
    throw new Error(`Sintaxe JSON corrompida: ${err.message}`);
  }

  const validacao = validarEstruturaProjeto(parsed);
  if (!validacao.valido) {
    throw new Error(`Arquivo JSON inválido para o projeto: ${validacao.erros.join('; ')}`);
  }

  return validacao.projeto!;
}
