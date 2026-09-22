/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { ProjetoFinanciamento } from '../../types';
import { analisarTextoSimulacaoBancaria, ExtracaoSimulacaoResultado } from '../../domain/pdfParser';
import { importarProjetoDeJSON } from '../../storage/projectStorage';
import { toReais } from '../../domain/financial';
import { 
  X, 
  Upload, 
  FileText, 
  CheckCircle2, 
  AlertTriangle, 
  FileJson, 
  Copy 
} from 'lucide-react';

interface ImportarModalProps {
  aberto: boolean;
  onFechar: () => void;
  onAplicarProjeto: (p: ProjetoFinanciamento) => void;
  projetoAtual: ProjetoFinanciamento;
}

export const ImportarModal: React.FC<ImportarModalProps> = ({
  aberto,
  onFechar,
  onAplicarProjeto,
  projetoAtual
}) => {
  const [abaAtiva, setAbaAtiva] = useState<'SIMULACAO_TEXTO' | 'ARQUIVO_JSON'>('SIMULACAO_TEXTO');
  const [textoSimulacao, setTextoSimulacao] = useState('');
  const [resultadoExtracao, setResultadoExtracao] = useState<ExtracaoSimulacaoResultado | null>(null);
  const [erroJSON, setErroJSON] = useState<string | null>(null);

  if (!aberto) return null;

  const handleAnalisarTexto = () => {
    if (!textoSimulacao.trim()) return;
    const res = analisarTextoSimulacaoBancaria(textoSimulacao);
    setResultadoExtracao(res);
  };

  const handleConfirmarImportacaoSimulacao = () => {
    if (!resultadoExtracao || !resultadoExtracao.dadosExtraidos) return;
    const dados = resultadoExtracao.dadosExtraidos;

    const novoProjeto: ProjetoFinanciamento = {
      ...projetoAtual,
      precoImovelCentavos: dados.precoImovelCentavos || projetoAtual.precoImovelCentavos,
      avaliacaoBancariaCentavos: dados.precoImovelCentavos || projetoAtual.precoImovelCentavos,
      propostaBancaria: {
        ...projetoAtual.propostaBancaria,
        ...dados,
        tabelaImportada: resultadoExtracao.linhasTabela
      } as any,
      fontes: [
        {
          id: 'f_prop',
          nome: 'Recursos Próprios (Entrada)',
          tipo: 'DINHEIRO_PROPRIO',
          valorCentavos: dados.valorEntradaCentavos || 8000000,
          disponivelEm: projetoAtual.dataBase,
          destino: 'PRECO',
          confirmado: true
        },
        {
          id: 'f_banco',
          nome: `Financiamento Bancário ${dados.sistema}`,
          tipo: 'CREDITO_BANCO',
          valorCentavos: dados.valorFinanciadoCentavos || 32000000,
          disponivelEm: projetoAtual.dataBase,
          destino: 'PRECO',
          confirmado: true
        }
      ],
      obrigacoesVendedor: [
        {
          id: 'ob_sinal',
          descricao: 'Entrada Acordada',
          tipo: 'SINAL',
          valorBaseCentavos: dados.valorEntradaCentavos || 8000000,
          vencimento: projetoAtual.dataBase,
          pagoAntecipado: false,
          indiceCorrecao: 'SEM_CORRECAO',
          taxaJurosMensalPercent: 0,
          status: 'CONFIRMADO',
          responsavelPagamento: 'COMPRADOR',
          afetaCaixaLivre: true
        },
        {
          id: 'ob_repasse',
          descricao: 'Financiamento Bancário ao Vendedor',
          tipo: 'REPASSE_FINANCIAMENTO',
          valorBaseCentavos: dados.valorFinanciadoCentavos || 32000000,
          vencimento: projetoAtual.dataBase,
          pagoAntecipado: false,
          indiceCorrecao: 'SEM_CORRECAO',
          taxaJurosMensalPercent: 0,
          status: 'CONFIRMADO',
          responsavelPagamento: 'BANCO',
          afetaCaixaLivre: false
        }
      ]
    };

    onAplicarProjeto(novoProjeto);
    onFechar();
  };

  const handleUploadJSON = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const conteudo = ev.target?.result as string;
        const p = importarProjetoDeJSON(conteudo);
        onAplicarProjeto(p);
        onFechar();
      } catch (err: any) {
        setErroJSON(err.message || 'Falha ao interpretar o arquivo JSON');
      }
    };
    reader.readAsText(file);
  };

  const carregarTextoExemploSAC = () => {
    setTextoSimulacao(`CAIXA ECONOMICA FEDERAL - DEMONSTRATIVO DE FINANCIAMENTO
Valor de compra e venda: R$ 400.000,00
Valor de financiamento: R$ 279.234,01
Valor de entrada: R$ 120.765,99
Prazo: 420 meses
Sistema de amortizacao: SAC
Taxa de juros nominal: 7,66% a.a.
Taxa de juros efetiva: 7,93% a.a.
CET anual: 8,69% a.a.
Primeira prestacao: R$ 2.524,41
Primeiro encargo: R$ 2.524,36
Tarifa de avaliacao: R$ 4.188,51
Seguro a vista: R$ 52,13`);
  };

  return (
    <div className="fixed inset-0 z-50 bg-stone-950/70 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-2xl w-full border border-stone-200 shadow-xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header Modal */}
        <div className="px-6 py-4 border-b border-stone-200 flex items-center justify-between bg-stone-50">
          <div className="flex items-center gap-2">
            <Upload className="w-5 h-5 text-amber-600" />
            <h3 className="text-base font-bold text-stone-900">
              Importador de Proposta & Arquivos
            </h3>
          </div>
          <button
            type="button"
            onClick={onFechar}
            className="p-1 rounded-md text-stone-400 hover:text-stone-700 hover:bg-stone-200 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Abas */}
        <div className="flex border-b border-stone-200 bg-stone-100/60 px-6 pt-2">
          <button
            type="button"
            onClick={() => setAbaAtiva('SIMULACAO_TEXTO')}
            className={`px-4 py-2 text-xs font-semibold border-b-2 transition ${
              abaAtiva === 'SIMULACAO_TEXTO'
                ? 'border-amber-600 text-stone-900 bg-white rounded-t-lg'
                : 'border-transparent text-stone-600 hover:text-stone-900'
            }`}
          >
            Colar Texto da Simulação Bancária
          </button>
          <button
            type="button"
            onClick={() => setAbaAtiva('ARQUIVO_JSON')}
            className={`px-4 py-2 text-xs font-semibold border-b-2 transition ${
              abaAtiva === 'ARQUIVO_JSON'
                ? 'border-amber-600 text-stone-900 bg-white rounded-t-lg'
                : 'border-transparent text-stone-600 hover:text-stone-900'
            }`}
          >
            Carregar Projeto em JSON
          </button>
        </div>

        {/* Conteúdo */}
        <div className="p-6 overflow-y-auto space-y-4 flex-1 text-xs">
          {abaAtiva === 'SIMULACAO_TEXTO' ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-stone-600">
                  Cole as informações extraídas do PDF ou demonstrativo da CAIXA:
                </span>
                <button
                  type="button"
                  onClick={carregarTextoExemploSAC}
                  className="text-amber-700 font-semibold hover:underline"
                >
                  Carregar Exemplo Real SAC
                </button>
              </div>

              <textarea
                rows={6}
                value={textoSimulacao}
                onChange={(e) => setTextoSimulacao(e.target.value)}
                placeholder="Cole o texto da proposta com valor de compra, financiamento, taxas e prazos..."
                className="w-full p-3 font-mono text-xs border border-stone-300 rounded-lg focus:ring-2 focus:ring-amber-500 text-stone-900 bg-stone-50"
              />

              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={handleAnalisarTexto}
                  disabled={!textoSimulacao.trim()}
                  className="px-4 py-2 bg-stone-900 hover:bg-stone-800 disabled:opacity-40 text-white font-semibold rounded-lg transition"
                >
                  Analisar Texto & Detectar Divergências
                </button>
              </div>

              {/* Resultado da Extração e Divergências */}
              {resultadoExtracao && (
                <div className="p-4 rounded-xl border border-stone-200 bg-stone-50 space-y-3">
                  {resultadoExtracao.erro ? (
                    <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-2.5 text-amber-900">
                      <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                      <div>
                        <strong className="block font-semibold">Nenhum dado bancário reconhecido</strong>
                        <p className="text-xs text-amber-800">{resultadoExtracao.erro}</p>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-stone-900 text-sm">
                          Dados Identificados ({resultadoExtracao.dadosExtraidos.sistema})
                        </span>
                        <span className={`px-2 py-0.5 rounded font-bold ${
                          resultadoExtracao.confiancaPercent >= 75 ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                        }`}>
                          {resultadoExtracao.confiancaPercent}% de Confiança ({resultadoExtracao.status})
                        </span>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                        <div>
                          <span className="text-stone-500 block">Preço:</span>
                          <strong className="text-stone-900">{toReais(resultadoExtracao.dadosExtraidos.precoImovelCentavos || 0)}</strong>
                        </div>
                        <div>
                          <span className="text-stone-500 block">Financiado:</span>
                          <strong className="text-stone-900">{toReais(resultadoExtracao.dadosExtraidos.valorFinanciadoCentavos || 0)}</strong>
                        </div>
                        <div>
                          <span className="text-stone-500 block">Entrada:</span>
                          <strong className="text-stone-900">{toReais(resultadoExtracao.dadosExtraidos.valorEntradaCentavos || 0)}</strong>
                        </div>
                        <div>
                          <span className="text-stone-500 block">Taxa Nominal:</span>
                          <strong className="text-stone-900">{resultadoExtracao.dadosExtraidos.taxaJurosNominalAnualPercent}% a.a.</strong>
                        </div>
                        <div>
                          <span className="text-stone-500 block">CET Anual:</span>
                          <strong className="text-stone-900">{resultadoExtracao.dadosExtraidos.cetAnualPercent || 0}% a.a.</strong>
                        </div>
                        <div>
                          <span className="text-stone-500 block">Prazo:</span>
                          <strong className="text-stone-900">{resultadoExtracao.dadosExtraidos.prazoMeses} meses</strong>
                        </div>
                      </div>
                    </>
                  )}

                  {/* Divergências Documentadas */}
                  {resultadoExtracao.divergenciasDetectadas.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-stone-200 space-y-2">
                      <span className="font-bold text-stone-900 block flex items-center gap-1.5 text-rose-800">
                        <AlertTriangle className="w-4 h-4 text-rose-600" />
                        Divergências Documentadas Detectadas no PDF:
                      </span>
                      {resultadoExtracao.divergenciasDetectadas.map((div, i) => (
                        <div key={i} className="p-2.5 rounded bg-white border border-stone-200 space-y-1">
                          <div className="font-semibold text-stone-900 flex justify-between">
                            <span>{div.campo}</span>
                            <span className="text-rose-700">Dif: {div.diferenca}</span>
                          </div>
                          <div className="text-stone-500 text-[11px] flex gap-4">
                            <span>{div.origemResumo}</span>
                            <span>{div.origemTabela}</span>
                          </div>
                          <p className="text-stone-600 text-[11px] mt-1">{div.explicacao}</p>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="pt-2 flex justify-end">
                    <button
                      type="button"
                      onClick={handleConfirmarImportacaoSimulacao}
                      className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white font-semibold rounded-lg transition"
                    >
                      Aplicar Proposta ao Projeto
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4 text-center py-6">
              <FileJson className="w-12 h-12 text-stone-400 mx-auto" />
              <div>
                <p className="font-semibold text-stone-800">Selecione o arquivo .json do projeto salvo</p>
                <p className="text-stone-500 mt-0.5">O arquivo restaurará todas as fontes, despesas e cenários configurados.</p>
              </div>

              <input
                type="file"
                accept=".json"
                onChange={handleUploadJSON}
                className="block w-full text-xs text-stone-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-stone-900 file:text-white hover:file:bg-stone-800 cursor-pointer"
              />

              {erroJSON && (
                <div className="p-3 rounded-lg bg-rose-50 text-rose-800 border border-rose-200">
                  {erroJSON}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
