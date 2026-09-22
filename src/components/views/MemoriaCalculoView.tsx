/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { LinhaCaixaMes, ParcelaBancoLinha, RotuloFidelidade } from '../../types';
import { toReais } from '../../domain/financial';
import { 
  FileSpreadsheet, 
  Search, 
  Download, 
  ChevronLeft, 
  ChevronRight, 
  ChevronDown, 
  ChevronUp, 
  Filter 
} from 'lucide-react';

interface MemoriaCalculoViewProps {
  linhasCaixa: LinhaCaixaMes[];
  tabelaBancaria: ParcelaBancoLinha[];
}

export const MemoriaCalculoView: React.FC<MemoriaCalculoViewProps> = ({
  linhasCaixa,
  tabelaBancaria
}) => {
  const [busca, setBusca] = useState('');
  const [pagina, setPagina] = useState(1);
  const [itensPorPagina, setItensPorPagina] = useState(24);
  const [linhaExpandida, setLinhaExpandida] = useState<number | null>(null);

  // Mapeia parcelas bancárias por competência para enriquecimento
  const mapaBanco = new Map<string, ParcelaBancoLinha>();
  tabelaBancaria.forEach(p => {
    mapaBanco.set(p.vencimento.substring(0, 7), p);
  });

  const linhasFiltradas = linhasCaixa.filter(l => 
    l.competencia.includes(busca) || 
    String(l.mesIndice) === busca ||
    l.eventosDoMes.some(e => e.descricao.toLowerCase().includes(busca.toLowerCase()))
  );

  const totalPaginas = Math.ceil(linhasFiltradas.length / itensPorPagina) || 1;
  const inicio = (pagina - 1) * itensPorPagina;
  const linhasExibidas = linhasFiltradas.slice(inicio, inicio + itensPorPagina);

  // Exportar para CSV
  const exportarCSV = () => {
    const cabecalho = [
      'Mes',
      'Competencia',
      'Amortizacao_BRL',
      'Juros_BRL',
      'Seguro_MIP_BRL',
      'Seguro_DFI_BRL',
      'Taxa_Adm_BRL',
      'Encargo_Total_Banco_BRL',
      'Saldo_Devedor_Final_BRL',
      'Desembolso_Vendedor_BRL',
      'Custos_Complementares_BRL',
      'Total_Saidas_Mes_BRL',
      'Receitas_Mes_BRL',
      'Saldo_Caixa_Acumulado_BRL'
    ].join(';');

    const linhasCSV = linhasCaixa.map(l => {
      const b = mapaBanco.get(l.competencia);
      return [
        l.mesIndice,
        l.competencia,
        b ? (b.amortizacaoCentavos / 100).toFixed(2) : '0.00',
        b ? (b.jurosCentavos / 100).toFixed(2) : '0.00',
        b ? (b.seguroMipCentavos / 100).toFixed(2) : '0.00',
        b ? (b.seguroDfiCentavos / 100).toFixed(2) : '0.00',
        b ? (b.taxaAdmCentavos / 100).toFixed(2) : '0.00',
        b ? (b.encargoTotalCentavos / 100).toFixed(2) : '0.00',
        b ? (b.saldoDevedorFinalCentavos / 100).toFixed(2) : '0.00',
        (l.desembolsoVendedorCentavos / 100).toFixed(2),
        (l.custosComplementaresCentavos / 100).toFixed(2),
        (l.totalSaidasCentavos / 100).toFixed(2),
        (l.receitasCentavos / 100).toFixed(2),
        (l.saldoCaixaAcumuladoCentavos / 100).toFixed(2)
      ].join(';');
    });

    const conteudo = [cabecalho, ...linhasCSV].join('\n');
    const blob = new Blob([conteudo], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `memoria_calculo_fluxo_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  const getRotuloBadge = (rotulo?: RotuloFidelidade) => {
    switch (rotulo) {
      case 'EXTRAIDO':
        return <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-800">EXTRAÍDO</span>;
      case 'REPRODUZIDO':
        return <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">REPRODUZIDO</span>;
      case 'ESTIMADO':
        return <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800">ESTIMADO</span>;
      default:
        return <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-stone-100 text-stone-700">CALCULADO</span>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="border-b border-stone-200 pb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-stone-900 flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-amber-600" />
            8. Memória de Cálculo Mensal & Razão de Eventos
          </h2>
          <p className="text-sm text-stone-600 mt-1">
            Auditoria completa linha a linha: amortização, juros, seguros, saídas familiares e saldo acumulado de caixa mês a mês.
          </p>
        </div>

        <button
          type="button"
          onClick={exportarCSV}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-stone-900 hover:bg-stone-800 text-white transition shrink-0"
        >
          <Download className="w-3.5 h-3.5" />
          Exportar Planilha (CSV)
        </button>
      </div>

      {/* Barra de Filtros e Busca */}
      <div className="bg-white p-4 rounded-xl border border-stone-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="w-4 h-4 text-stone-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Buscar por mês (ex: 2027-04 ou parcela)..."
            value={busca}
            onChange={(e) => {
              setBusca(e.target.value);
              setPagina(1);
            }}
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-stone-50 border border-stone-300 rounded-md focus:ring-2 focus:ring-amber-500 text-stone-900"
          />
        </div>

        <div className="flex items-center gap-3 text-xs text-stone-500">
          <span>Itens por página:</span>
          <select
            value={itensPorPagina}
            onChange={(e) => {
              setItensPorPagina(Number(e.target.value));
              setPagina(1);
            }}
            className="px-2 py-1 bg-stone-50 border border-stone-300 rounded text-stone-800"
          >
            <option value="12">12 meses (1 ano)</option>
            <option value="24">24 meses (2 anos)</option>
            <option value="60">60 meses (5 anos)</option>
            <option value="120">120 meses (10 anos)</option>
            <option value="420">420 meses (Tudo)</option>
          </select>

          <span className="font-medium text-stone-700">
            Página {pagina} de {totalPaginas} ({linhasFiltradas.length} meses)
          </span>

          <div className="flex items-center gap-1">
            <button
              type="button"
              disabled={pagina <= 1}
              onClick={() => setPagina(p => Math.max(1, p - 1))}
              className="p-1 rounded border border-stone-300 hover:bg-stone-100 disabled:opacity-40"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              disabled={pagina >= totalPaginas}
              onClick={() => setPagina(p => Math.min(totalPaginas, p + 1))}
              className="p-1 rounded border border-stone-300 hover:bg-stone-100 disabled:opacity-40"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Tabela de Memória */}
      <div className="bg-white rounded-xl border border-stone-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
          <table className="w-full text-xs text-left border-collapse">
            <thead className="bg-stone-100/90 text-stone-700 sticky top-0 z-10 border-b border-stone-200">
              <tr>
                <th className="py-2.5 px-3 font-semibold">Mês</th>
                <th className="py-2.5 px-3 font-semibold">Competência</th>
                <th className="py-2.5 px-3 font-semibold text-right">Amortização</th>
                <th className="py-2.5 px-3 font-semibold text-right">Juros Banco</th>
                <th className="py-2.5 px-3 font-semibold text-right">Seguros (MIP/DFI)</th>
                <th className="py-2.5 px-3 font-semibold text-right">Encargo Banco</th>
                <th className="py-2.5 px-3 font-semibold text-right">Saldo Devedor</th>
                <th className="py-2.5 px-3 font-semibold text-right">Vendedor / Balão</th>
                <th className="py-2.5 px-3 font-semibold text-right">Outros Custos</th>
                <th className="py-2.5 px-3 font-semibold text-right">Total Saídas</th>
                <th className="py-2.5 px-3 font-semibold text-right">Saldo Caixa</th>
                <th className="py-2.5 px-3 font-semibold text-center">Fidelidade</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100 font-mono">
              {linhasExibidas.map((l) => {
                const b = mapaBanco.get(l.competencia);
                const expandida = linhaExpandida === l.mesIndice;

                return (
                  <React.Fragment key={l.mesIndice}>
                    <tr 
                      onClick={() => setLinhaExpandida(expandida ? null : l.mesIndice)}
                      className={`hover:bg-amber-50/40 cursor-pointer transition ${
                        expandida ? 'bg-amber-50/60' : (l.saldoCaixaAcumuladoCentavos < 0 ? 'bg-rose-50/30' : '')
                      }`}
                    >
                      <td className="py-2 px-3 font-sans font-medium text-stone-900">
                        {l.mesIndice}
                      </td>
                      <td className="py-2 px-3 font-sans font-medium text-stone-700">
                        {l.competencia}
                      </td>
                      <td className="py-2 px-3 text-right text-stone-800">
                        {b ? toReais(b.amortizacaoCentavos) : '-'}
                      </td>
                      <td className="py-2 px-3 text-right text-stone-800">
                        {b ? toReais(b.jurosCentavos) : '-'}
                      </td>
                      <td className="py-2 px-3 text-right text-stone-600">
                        {b ? toReais(b.seguroMipCentavos + b.seguroDfiCentavos) : '-'}
                      </td>
                      <td className="py-2 px-3 text-right font-bold text-stone-900">
                        {b ? toReais(b.encargoTotalCentavos) : '-'}
                      </td>
                      <td className="py-2 px-3 text-right text-stone-700">
                        {b ? toReais(b.saldoDevedorFinalCentavos) : '-'}
                      </td>
                      <td className="py-2 px-3 text-right text-stone-800">
                        {l.desembolsoVendedorCentavos > 0 ? toReais(l.desembolsoVendedorCentavos) : '-'}
                      </td>
                      <td className="py-2 px-3 text-right text-stone-800">
                        {l.custosComplementaresCentavos > 0 ? toReais(l.custosComplementaresCentavos) : '-'}
                      </td>
                      <td className="py-2 px-3 text-right font-bold text-amber-900">
                        {toReais(l.totalSaidasCentavos)}
                      </td>
                      <td className={`py-2 px-3 text-right font-bold ${
                        l.saldoCaixaAcumuladoCentavos < 0 ? 'text-rose-700' : 'text-stone-900'
                      }`}>
                        {toReais(l.saldoCaixaAcumuladoCentavos)}
                      </td>
                      <td className="py-2 px-3 text-center">
                        {getRotuloBadge(b?.rotulo)}
                      </td>
                    </tr>

                    {/* Detalhamento expandido dos eventos do mês */}
                    {expandida && (
                      <tr className="bg-stone-50/90 font-sans text-xs">
                        <td colSpan={12} className="p-4 border-y border-stone-200">
                          <div className="space-y-2">
                            <h4 className="font-bold text-stone-900 text-xs flex items-center justify-between">
                              <span>Eventos Financeiros de {l.competencia} (Mês {l.mesIndice}):</span>
                              <span className="text-[11px] font-normal text-stone-500">
                                Caixa acumulado ao fechar: {toReais(l.saldoCaixaAcumuladoCentavos)}
                              </span>
                            </h4>
                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                              {l.eventosDoMes.map((ev, i) => (
                                <div key={i} className="p-2 rounded bg-white border border-stone-200">
                                  <div className="flex items-center justify-between font-semibold text-stone-800">
                                    <span>{ev.categoria}</span>
                                    <span className={ev.categoria === 'RECEITA' ? 'text-emerald-700' : 'text-stone-900'}>
                                      {toReais(ev.valorCentavos)}
                                    </span>
                                  </div>
                                  <div className="text-[11px] text-stone-600 mt-0.5 truncate">{ev.descricao}</div>
                                  <div className="text-[10px] text-stone-400 mt-1 uppercase font-mono">Dest: {ev.destinatario}</div>
                                </div>
                              ))}
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
