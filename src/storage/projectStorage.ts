/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { ProjetoFinanciamento } from '../types';
import { PROJETO_REAL_SAC_CAIXA } from '../domain/defaults';

const STORAGE_KEY = 'planejador_financiamento_projeto_v1';

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
    if (parsed && parsed.schemaVersion) {
      return parsed as ProjetoFinanciamento;
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
  const parsed = JSON.parse(jsonContent);
  if (!parsed || !parsed.precoImovelCentavos || !parsed.propostaBancaria) {
    throw new Error('Arquivo JSON inválido: campos essenciais do projeto ausentes.');
  }
  return parsed as ProjetoFinanciamento;
}
