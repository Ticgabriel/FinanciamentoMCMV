/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Utilitários de Calendário Civil para Planejamento Imobiliário.
 * 
 * Regras cruciais:
 * 1. Preservação do dia âncora: se o vencimento é dia 31, somar 1 mês a 31/01 resulta em 28/02 (ou 29/02),
 *    e somar 2 meses a 31/01 resulta em 31/03 (sem pular fevereiro e sem cair em 03 de março).
 * 2. Manipulação de datas em formato civil ISO 'YYYY-MM-DD' sem interferência de fuso horário UTC.
 * 3. Expansão completa do horizonte de competências do primeiro evento até a última parcela/obrigação.
 */

export interface DataCivilPartes {
  ano: number;
  mes: number; // 1-12
  dia: number; // 1-31
}

export function parseDataCivil(dataStr: string): DataCivilPartes {
  const limpa = dataStr.trim().split('T')[0];
  const partes = limpa.split('-');
  if (partes.length !== 3) {
    const d = new Date();
    return { ano: d.getFullYear(), mes: d.getMonth() + 1, dia: d.getDate() };
  }
  return {
    ano: parseInt(partes[0], 10) || 2026,
    mes: parseInt(partes[1], 10) || 1,
    dia: parseInt(partes[2], 10) || 1
  };
}

export function formatarDataCivil(partes: DataCivilPartes): string {
  const a = partes.ano.toString().padStart(4, '0');
  const m = partes.mes.toString().padStart(2, '0');
  const d = partes.dia.toString().padStart(2, '0');
  return `${a}-${m}-${d}`;
}

export function diasNoMes(ano: number, mes: number): number {
  // Em JavaScript: new Date(ano, mes, 0) retorna o último dia do mês (mes 1-12)
  return new Date(ano, mes, 0).getDate();
}

/**
 * Adiciona N meses a uma data civil preservando o dia âncora contratual.
 * Se o mês de destino possuir menos dias que o dia âncora (ex: 31 em fevereiro),
 * ajusta para o último dia válido daquele mês (28 ou 29).
 */
export function adicionarMesesCivil(dataBaseStr: string, meses: number, diaAncoraOriginal?: number): string {
  const base = parseDataCivil(dataBaseStr);
  const diaAncora = diaAncoraOriginal !== undefined ? diaAncoraOriginal : base.dia;

  // Cálculo de mês e ano de destino
  const mesTotal = (base.mes - 1) + meses;
  const novoAno = base.ano + Math.floor(mesTotal / 12);
  const novoMes = (mesTotal % 12 + 12) % 12 + 1;

  // Clamping ao último dia do mês de destino
  const maxDias = diasNoMes(novoAno, novoMes);
  const novoDia = Math.min(diaAncora, maxDias);

  return formatarDataCivil({ ano: novoAno, mes: novoMes, dia: novoDia });
}

/**
 * Extrai a competência mensal no formato 'YYYY-MM'.
 */
export function extrairCompetencia(dataStr: string): string {
  if (!dataStr) return '2026-01';
  return dataStr.trim().substring(0, 7);
}

/**
 * Retorna a diferença em meses civis entre data1 e data2 (data2 - data1).
 */
export function diferencaMesesCivis(dataInicioStr: string, dataFimStr: string): number {
  const d1 = parseDataCivil(dataInicioStr);
  const d2 = parseDataCivil(dataFimStr);
  return (d2.ano - d1.ano) * 12 + (d2.mes - d1.mes);
}

/**
 * Calcula a lista contínua de competências ('YYYY-MM') desde dataBase até a data mais tardia
 * entre todas as obrigações, custos e parcelas bancárias cadastradas, sem truncamento indevido.
 */
export function calcularHorizonteCompetencias(
  dataBaseStr: string,
  todasAsDatas: string[],
  mesesMinimos = 60
): string[] {
  const base = parseDataCivil(dataBaseStr);
  let maxAno = base.ano;
  let maxMes = base.mes;

  // Avalia todas as datas do projeto
  for (const dt of todasAsDatas) {
    if (!dt) continue;
    const p = parseDataCivil(dt);
    if (p.ano > maxAno || (p.ano === maxAno && p.mes > maxMes)) {
      maxAno = p.ano;
      maxMes = p.mes;
    }
  }

  // Quantidade de meses até a data mais tardia
  const totalMesesAteFim = (maxAno - base.ano) * 12 + (maxMes - base.mes) + 1;
  const mesesTotais = Math.max(mesesMinimos, totalMesesAteFim);

  const competencias: string[] = [];
  for (let m = 0; m < mesesTotais; m++) {
    const mesIdx = (base.mes - 1) + m;
    const ano = base.ano + Math.floor(mesIdx / 12);
    const mes = (mesIdx % 12) + 1;
    competencias.push(`${ano.toString().padStart(4, '0')}-${mes.toString().padStart(2, '0')}`);
  }

  return competencias;
}
