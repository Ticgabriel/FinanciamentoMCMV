/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { ProjetoFinanciamento } from '../types';
import { PROJETO_REAL_SAC_CAIXA } from '../domain/defaults';

const STORAGE_KEY = 'planejador_financiamento_projeto_v1';
const DB_NAME = 'FinanciamentoMCMV_DB';
const DB_VERSION = 1;
const STORE_PROJETOS = 'projetos';

export interface ValidacaoProjetoResultado {
  valido: boolean;
  erros: string[];
  avisos?: string[];
  projeto?: ProjetoFinanciamento;
}

/**
 * Validação estrutural e semântica rigorosa do projeto JSON.
 * Impede que dados malformados corrompam a aplicação.
 */
export function validarEstruturaProjeto(dados: any): ValidacaoProjetoResultado {
  const erros: string[] = [];
  const avisos: string[] = [];

  if (!dados || typeof dados !== 'object') {
    return { valido: false, erros: ['Conteúdo não é um objeto JSON válido.'] };
  }

  // Preço do Imóvel
  if (typeof dados.precoImovelCentavos !== 'number' || dados.precoImovelCentavos <= 0) {
    erros.push('precoImovelCentavos deve ser um número inteiro positivo (em centavos).');
  }

  // Modalidade
  const modalidadesValidas = ['PRONTO', 'PLANTA_COM_REPASSE_FUTURO', 'PLANTA_COM_BANCO_NA_OBRA'];
  if (dados.modalidade && !modalidadesValidas.includes(dados.modalidade)) {
    erros.push(`modalidade inválida. Valores permitidos: ${modalidadesValidas.join(', ')}.`);
  }

  // Proposta Bancária
  if (!dados.propostaBancaria || typeof dados.propostaBancaria !== 'object') {
    erros.push('propostaBancaria ausente ou inválida.');
  } else {
    const prop = dados.propostaBancaria;
    if (typeof prop.valorFinanciadoCentavos !== 'number' || prop.valorFinanciadoCentavos <= 0) {
      erros.push('propostaBancaria.valorFinanciadoCentavos deve ser um número positivo em centavos.');
    }
    if (typeof prop.prazoMeses !== 'number' || prop.prazoMeses <= 0 || prop.prazoMeses > 600) {
      erros.push('propostaBancaria.prazoMeses deve ser entre 1 e 600 meses.');
    }
    if (typeof prop.taxaJurosNominalAnualPercent !== 'number' || prop.taxaJurosNominalAnualPercent < 0) {
      erros.push('propostaBancaria.taxaJurosNominalAnualPercent deve ser informada e não negativa.');
    }
    if (prop.sistema && !['SAC', 'PRICE'].includes(prop.sistema)) {
      erros.push('propostaBancaria.sistema deve ser "SAC" ou "PRICE".');
    }
  }

  // Fontes de recursos
  if (!Array.isArray(dados.fontes)) {
    erros.push('fontes deve ser uma lista de fontes de recurso.');
  } else {
    dados.fontes.forEach((f: any, idx: number) => {
      if (!f.id || !f.nome || typeof f.valorCentavos !== 'number' || f.valorCentavos < 0) {
        erros.push(`Fonte [${idx}]: campos 'id', 'nome' e 'valorCentavos' positivo são obrigatórios.`);
      }
    });
  }

  // Obrigações com o vendedor
  if (!Array.isArray(dados.obrigacoesVendedor)) {
    erros.push('obrigacoesVendedor deve ser uma lista de obrigações contratuais.');
  } else {
    dados.obrigacoesVendedor.forEach((ob: any, idx: number) => {
      if (!ob.id || typeof ob.valorBaseCentavos !== 'number' || ob.valorBaseCentavos < 0) {
        erros.push(`Obrigação [${idx}]: campos 'id' e 'valorBaseCentavos' são obrigatórios.`);
      }
      if (typeof ob.afetaCaixaLivre !== 'boolean') {
        avisos.push(`Obrigação [${idx}]: 'afetaCaixaLivre' não especificado, assumindo false.`);
      }
    });
  }

  // Marcos temporais
  if (!Array.isArray(dados.marcos)) {
    erros.push('marcos deve ser uma lista de marcos temporais do projeto.');
  } else {
    dados.marcos.forEach((m: any, idx: number) => {
      if (!m.id || !m.tipo || !m.dataPrevista) {
        erros.push(`Marco [${idx}]: campos 'id', 'tipo' e 'dataPrevista' são obrigatórios.`);
      }
    });
  }

  // Receitas & Despesas
  if (!Array.isArray(dados.receitas)) {
    erros.push('receitas deve ser uma lista de receitas familiares.');
  }
  if (!Array.isArray(dados.despesas)) {
    erros.push('despesas deve ser uma lista de despesas familiares.');
  }

  // Custos Complementares
  if (!Array.isArray(dados.custosComplementares)) {
    erros.push('custosComplementares deve ser uma lista de custos.');
  }

  // Cenários
  if (!Array.isArray(dados.cenarios) || dados.cenarios.length === 0) {
    erros.push('cenarios deve conter pelo menos um cenário de simulação.');
  }

  if (erros.length > 0) {
    return { valido: false, erros, avisos };
  }

  return { valido: true, erros: [], avisos, projeto: dados as ProjetoFinanciamento };
}

/**
 * Abre conexão assíncrona com o IndexedDB do navegador.
 */
function abrirBancoIndexedDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      return reject(new Error('IndexedDB não suportado neste ambiente.'));
    }

    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event: IDBVersionChangeEvent) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_PROJETOS)) {
        db.createObjectStore(STORE_PROJETOS, { keyPath: 'id' });
      }
    };

    request.onsuccess = (event) => {
      resolve((event.target as IDBOpenDBRequest).result);
    };

    request.onerror = (event) => {
      reject((event.target as IDBOpenDBRequest).error);
    };
  });
}

/**
 * Salva o projeto no IndexedDB de forma assíncrona e resiliente.
 */
export async function salvarProjetoIndexedDB(projeto: ProjetoFinanciamento): Promise<void> {
  try {
    const db = await abrirBancoIndexedDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_PROJETOS], 'readwrite');
      const store = transaction.objectStore(STORE_PROJETOS);
      const req = store.put({
        ...projeto,
        atualizadoEm: new Date().toISOString()
      });

      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn('Falha na persistência via IndexedDB:', err);
  }
}

/**
 * Carrega o projeto do IndexedDB pelo seu identificador ou o primeiro disponível.
 */
export async function carregarProjetoIndexedDB(id?: string): Promise<ProjetoFinanciamento | null> {
  try {
    const db = await abrirBancoIndexedDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_PROJETOS], 'readonly');
      const store = transaction.objectStore(STORE_PROJETOS);
      
      const req = id ? store.get(id) : store.openCursor();

      if (id) {
        req.onsuccess = () => {
          const resultado = (req as IDBRequest).result;
          if (resultado) {
            const val = validarEstruturaProjeto(resultado);
            resolve(val.valido ? val.projeto! : null);
          } else {
            resolve(null);
          }
        };
      } else {
        // Pega o primeiro registro encontrado
        req.onsuccess = (ev) => {
          const cursor = (ev.target as IDBRequest).result as IDBCursorWithValue;
          if (cursor && cursor.value) {
            const val = validarEstruturaProjeto(cursor.value);
            resolve(val.valido ? val.projeto! : null);
          } else {
            resolve(null);
          }
        };
      }

      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn('Falha ao recuperar do IndexedDB:', err);
    return null;
  }
}

/**
 * Lista todos os projetos salvos no IndexedDB.
 */
export async function listarProjetosIndexedDB(): Promise<{ id: string; nome: string; atualizadoEm: string }[]> {
  try {
    const db = await abrirBancoIndexedDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_PROJETOS], 'readonly');
      const store = transaction.objectStore(STORE_PROJETOS);
      const req = store.getAll();

      req.onsuccess = () => {
        const itens = (req.result || []) as any[];
        resolve(itens.map(item => ({
          id: item.id || 'projeto',
          nome: item.nome || 'Projeto Sem Nome',
          atualizadoEm: item.atualizadoEm || item.criadoEm || ''
        })));
      };
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    return [];
  }
}

/**
 * Salva localmente de forma síncrona (localStorage) com replicação assíncrona para IndexedDB.
 */
export function salvarProjetoLocalmente(projeto: ProjetoFinanciamento): void {
  try {
    const jsonStr = JSON.stringify({
      ...projeto,
      atualizadoEm: new Date().toISOString()
    });
    localStorage.setItem(STORAGE_KEY, jsonStr);
    
    // Replicação resiliente para IndexedDB em background
    salvarProjetoIndexedDB(projeto).catch(() => {});
  } catch (e) {
    console.warn('Não foi possível persistir no localStorage:', e);
  }
}

/**
 * Restaura o projeto da sessão ou localStorage com fallback instantâneo para o caso real SAC.
 */
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
