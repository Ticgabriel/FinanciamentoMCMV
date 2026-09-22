/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef } from 'react';
import { ProjetoFinanciamento } from '../../types';
import { 
  analisarTextoSimulacaoBancaria, 
  extrairTextoDeArquivoPDF, 
  ExtracaoSimulacaoResultado 
} from '../../domain/pdfParser';
import { importarProjetoDeJSON } from '../../storage/projectStorage';
import { toReais } from '../../domain/financial';
import { 
  X, 
  Upload, 
  FileText, 
  CheckCircle2, 
  AlertTriangle, 
  FileJson, 
  FileUp, 
  Loader2, 
  Check 
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
  const [abaAtiva, setAbaAtiva] = useState<'ARQUIVO_PDF' | 'SIMULACAO_TEXTO' | 'ARQUIVO_JSON'>('ARQUIVO_PDF');
  const [textoSimulacao, setTextoSimulacao] = useState('');
  const [resultadoExtracao, setResultadoExtracao] = useState<ExtracaoSimulacaoResultado | null>(null);
  const [erroJSON, setErroJSON] = useState<string | null>(null);
  const [processandoPDF, setProcessandoPDF] = useState(false);
  const [nomeArquivoPDF, setNomeArquivoPDF] = useState<string | null>(null);
  const [erroPDF, setErroPDF] = useState<string | null>(null);

  const fileInputPDFRef = useRef<HTMLInputElement>(null);

  if (!aberto) return null;

  const handleProcessarArquivoPDF = async (file: File) => {
    if (!file || !file.name.toLowerCase().endsWith('.pdf')) {
      setErroPDF('Por favor selecione um arquivo em formato PDF válido.');
      return;
    }
    setNomeArquivoPDF(file.name);
    setProcessandoPDF(true);
    setErroPDF(null);

    try {
      const textoExtraido = await extrairTextoDeArquivoPDF(file);
      setTextoSimulacao(textoExtraido);
      const res = analisarTextoSimulacaoBancaria(textoExtraido);
      setResultadoExtracao(res);
    } catch (err: any) {
      console.error('Erro ao processar PDF:', err);
      setErroPDF(err.message || 'Falha ao ler o conteúdo do arquivo PDF.');
    } finally {
      setProcessandoPDF(false);
    }
  };

  const handleDropPDF = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) {
      handleProcessarArquivoPDF(file);
    }
  };

  const handleAnalisarTexto = () => {
    if (!textoSimulacao.trim()) return;
    const res = analisarTextoSimulacaoBancaria(textoSimulacao);
    setResultadoExtracao(res);
  };

  const handleConfirmarImportacaoSimulacao = () => {
    if (!resultadoExtracao || !resultadoExtracao.dadosExtraidos) return;
    const dados = resultadoExtracao.dadosExtraidos;

    const precoFinal = dados.precoImovelCentavos ?? projetoAtual.precoImovelCentavos;
    const financiadoFinal = dados.valorFinanciadoCentavos ?? projetoAtual.propostaBancaria.valorFinanciadoCentavos;
    
    // Calcula entrada sem números presumidos
    let entradaFinal = dados.valorEntradaCentavos;
    if (entradaFinal === undefined) {
      if (precoFinal > financiadoFinal) {
        entradaFinal = precoFinal - financiadoFinal;
      } else {
        entradaFinal = projetoAtual.propostaBancaria.valorEntradaCentavos;
      }
    }

    // Preserva FGTS existente do comprador se houver
    const fonteFgtsExistente = projetoAtual.fontes.find(f => f.tipo === 'FGTS');
    const valorFgts = (fonteFgtsExistente && fonteFgtsExistente.valorCentavos < entradaFinal)
      ? fonteFgtsExistente.valorCentavos
      : 0;
    const valorRecursosProprios = Math.max(0, entradaFinal - valorFgts);

    const novasFontes = [
      {
        id: 'f_prop',
        nome: 'Recursos Próprios (Entrada)',
        tipo: 'DINHEIRO_PROPRIO' as const,
        valorCentavos: valorRecursosProprios,
        disponivelEm: projetoAtual.dataBase,
        destino: 'PRECO' as const,
        confirmado: true
      },
      ...(valorFgts > 0 ? [{
        id: 'f_fgts',
        nome: 'FGTS Aplicado na Entrada',
        tipo: 'FGTS' as const,
        valorCentavos: valorFgts,
        disponivelEm: projetoAtual.dataBase,
        destino: 'PRECO' as const,
        confirmado: true
      }] : []),
      {
        id: 'f_banco',
        nome: `Financiamento Bancário ${dados.sistema || projetoAtual.propostaBancaria.sistema}`,
        tipo: 'CREDITO_BANCO' as const,
        valorCentavos: financiadoFinal,
        disponivelEm: projetoAtual.dataBase,
        destino: 'PRECO' as const,
        confirmado: true
      }
    ];

    const novasObrigacoes = [
      {
        id: 'ob_sinal',
        descricao: 'Entrada Recursos Próprios',
        tipo: 'SINAL' as const,
        valorBaseCentavos: valorRecursosProprios,
        vencimento: projetoAtual.dataBase,
        pagoAntecipado: false,
        indiceCorrecao: 'SEM_CORRECAO' as const,
        taxaJurosMensalPercent: 0,
        status: 'CONFIRMADO' as const,
        responsavelPagamento: 'COMPRADOR' as const,
        afetaCaixaLivre: true
      },
      ...(valorFgts > 0 ? [{
        id: 'ob_fgts',
        descricao: 'Liberação Saldo de FGTS',
        tipo: 'OUTRO' as const,
        valorBaseCentavos: valorFgts,
        vencimento: projetoAtual.dataBase,
        pagoAntecipado: false,
        indiceCorrecao: 'SEM_CORRECAO' as const,
        taxaJurosMensalPercent: 0,
        status: 'CONFIRMADO' as const,
        responsavelPagamento: 'FGTS' as const,
        afetaCaixaLivre: false
      }] : []),
      {
        id: 'ob_repasse',
        descricao: 'Financiamento Bancário ao Vendedor',
        tipo: 'REPASSE_FINANCIAMENTO' as const,
        valorBaseCentavos: financiadoFinal,
        vencimento: projetoAtual.dataBase,
        pagoAntecipado: false,
        indiceCorrecao: 'SEM_CORRECAO' as const,
        taxaJurosMensalPercent: 0,
        status: 'CONFIRMADO' as const,
        responsavelPagamento: 'BANCO' as const,
        afetaCaixaLivre: false
      }
    ];

    const novoProjeto: ProjetoFinanciamento = {
      ...projetoAtual,
      precoImovelCentavos: precoFinal,
      avaliacaoBancariaCentavos: precoFinal,
      propostaBancaria: {
        ...projetoAtual.propostaBancaria,
        ...dados,
        valorFinanciadoCentavos: financiadoFinal,
        valorEntradaCentavos: entradaFinal,
        tabelaImportada: resultadoExtracao.linhasTabela.length > 0 ? resultadoExtracao.linhasTabela : undefined
      } as any,
      fontes: novasFontes,
      obrigacoesVendedor: novasObrigacoes
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
Seguro a vista: R$ 52,13
Taxa de administracao: R$ 25,00
Seguro DFI: R$ 28,40
Seguro MIP: R$ 23,68`);
    setAbaAtiva('SIMULACAO_TEXTO');
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
        <div className="flex border-b border-stone-200 bg-stone-100/60 px-6 pt-2 gap-2">
          <button
            type="button"
            onClick={() => setAbaAtiva('ARQUIVO_PDF')}
            className={`px-4 py-2 text-xs font-semibold border-b-2 transition flex items-center gap-1.5 ${
              abaAtiva === 'ARQUIVO_PDF'
                ? 'border-amber-600 text-stone-900 bg-white rounded-t-lg'
                : 'border-transparent text-stone-600 hover:text-stone-900'
            }`}
          >
            <FileUp className="w-3.5 h-3.5 text-amber-600" />
            Importar PDF da CAIXA
          </button>
          <button
            type="button"
            onClick={() => setAbaAtiva('SIMULACAO_TEXTO')}
            className={`px-4 py-2 text-xs font-semibold border-b-2 transition flex items-center gap-1.5 ${
              abaAtiva === 'SIMULACAO_TEXTO'
                ? 'border-amber-600 text-stone-900 bg-white rounded-t-lg'
                : 'border-transparent text-stone-600 hover:text-stone-900'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            Colar Texto da Simulação
          </button>
          <button
            type="button"
            onClick={() => setAbaAtiva('ARQUIVO_JSON')}
            className={`px-4 py-2 text-xs font-semibold border-b-2 transition flex items-center gap-1.5 ${
              abaAtiva === 'ARQUIVO_JSON'
                ? 'border-amber-600 text-stone-900 bg-white rounded-t-lg'
                : 'border-transparent text-stone-600 hover:text-stone-900'
            }`}
          >
            <FileJson className="w-3.5 h-3.5" />
            Carregar JSON
          </button>
        </div>

        {/* Conteúdo */}
        <div className="p-6 overflow-y-auto space-y-4 flex-1 text-xs">
          {/* ABA 1: PDF REAL */}
          {abaAtiva === 'ARQUIVO_PDF' && (
            <div className="space-y-4">
              <div 
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleDropPDF}
                onClick={() => fileInputPDFRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition flex flex-col items-center justify-center gap-3 ${
                  processandoPDF 
                    ? 'bg-stone-50 border-stone-300 pointer-events-none' 
                    : 'bg-stone-50/50 border-amber-300 hover:bg-amber-50/50 hover:border-amber-500'
                }`}
              >
                <input 
                  type="file" 
                  ref={fileInputPDFRef}
                  accept=".pdf" 
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleProcessarArquivoPDF(f);
                  }}
                />
                
                {processandoPDF ? (
                  <>
                    <Loader2 className="w-8 h-8 text-amber-600 animate-spin" />
                    <div className="text-stone-700 font-semibold">
                      Extraindo e analisando o documento PDF com pdfjs-dist...
                    </div>
                    <p className="text-[11px] text-stone-500">
                      Lendo páginas, tabelas de amortização e apólice de seguros.
                    </p>
                  </>
                ) : (
                  <>
                    <div className="p-3 bg-amber-100/70 text-amber-800 rounded-full">
                      <FileUp className="w-6 h-6" />
                    </div>
                    <div>
                      <div className="font-bold text-stone-900 text-sm">
                        {nomeArquivoPDF ? nomeArquivoPDF : 'Arraste ou clique para selecionar o PDF da simulação'}
                      </div>
                      <p className="text-stone-500 text-xs mt-1">
                        Compatível com propostas e demonstrativos habitacionais da CAIXA / SFH.
                      </p>
                    </div>
                    <span className="text-[11px] px-3 py-1 bg-stone-900 text-white rounded-md font-semibold">
                      Selecionar Arquivo PDF
                    </span>
                  </>
                )}
              </div>

              {erroPDF && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-800 text-xs flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
                  <span>{erroPDF}</span>
                </div>
              )}
            </div>
          )}

          {/* ABA 2: TEXTO */}
          {abaAtiva === 'SIMULACAO_TEXTO' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-stone-600">
                  Cole as informações extraídas do demonstrativo da CAIXA:
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
            </div>
          )}

          {/* ABA 3: JSON */}
          {abaAtiva === 'ARQUIVO_JSON' && (
            <div className="space-y-4 py-2">
              <div className="border-2 border-dashed border-stone-300 rounded-xl p-6 text-center hover:bg-stone-50 transition">
                <FileJson className="w-8 h-8 text-stone-400 mx-auto mb-2" />
                <label className="cursor-pointer block">
                  <span className="text-sm font-semibold text-stone-800 block">
                    Selecione um arquivo de projeto .JSON
                  </span>
                  <span className="text-xs text-stone-500">
                    O projeto será validado estruturalmente com as regras do planejador.
                  </span>
                  <input
                    type="file"
                    accept=".json"
                    onChange={handleUploadJSON}
                    className="hidden"
                  />
                </label>
              </div>

              {erroJSON && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-800 text-xs flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
                  <span>{erroJSON}</span>
                </div>
              )}
            </div>
          )}

          {/* PAINEL DE RESULTADO DA EXTRAÇÃO (PDF OU TEXTO) */}
          {resultadoExtracao && (abaAtiva === 'ARQUIVO_PDF' || abaAtiva === 'SIMULACAO_TEXTO') && (
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
                      Dados Identificados ({resultadoExtracao.dadosExtraidos.sistema || 'SAC'})
                    </span>
                    <span className={`px-2 py-0.5 rounded font-bold ${
                      resultadoExtracao.confiancaPercent >= 75 ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                    }`}>
                      {resultadoExtracao.confiancaPercent}% de Confiança ({resultadoExtracao.status})
                    </span>
                  </div>

                  {/* Badges de Campos Detectados */}
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {resultadoExtracao.camposDetectados.map(c => (
                      <span key={c} className="px-2 py-0.5 rounded text-[10px] bg-stone-200 text-stone-800 font-medium flex items-center gap-1">
                        <Check className="w-3 h-3 text-emerald-600" />
                        {c}
                      </span>
                    ))}
                  </div>

                  {/* Grid de Resumo dos Parâmetros Extraídos */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 text-xs">
                    <div className="p-2 bg-white rounded border border-stone-200">
                      <span className="text-stone-500 block text-[10px]">Preço Imóvel</span>
                      <strong className="text-stone-900">
                        {resultadoExtracao.dadosExtraidos.precoImovelCentavos !== undefined
                          ? toReais(resultadoExtracao.dadosExtraidos.precoImovelCentavos)
                          : 'Não informado'}
                      </strong>
                    </div>
                    <div className="p-2 bg-white rounded border border-stone-200">
                      <span className="text-stone-500 block text-[10px]">Financiamento</span>
                      <strong className="text-stone-900">
                        {resultadoExtracao.dadosExtraidos.valorFinanciadoCentavos !== undefined
                          ? toReais(resultadoExtracao.dadosExtraidos.valorFinanciadoCentavos)
                          : 'Não informado'}
                      </strong>
                    </div>
                    <div className="p-2 bg-white rounded border border-stone-200">
                      <span className="text-stone-500 block text-[10px]">Entrada</span>
                      <strong className="text-stone-900">
                        {resultadoExtracao.dadosExtraidos.valorEntradaCentavos !== undefined
                          ? toReais(resultadoExtracao.dadosExtraidos.valorEntradaCentavos)
                          : 'Não informada'}
                      </strong>
                    </div>
                    <div className="p-2 bg-white rounded border border-stone-200">
                      <span className="text-stone-500 block text-[10px]">Prazo / Taxa</span>
                      <strong className="text-stone-900">
                        {resultadoExtracao.dadosExtraidos.prazoMeses}m @ {resultadoExtracao.dadosExtraidos.taxaJurosNominalAnualPercent}%
                      </strong>
                    </div>
                  </div>

                  {/* Divergências se houver */}
                  {resultadoExtracao.divergenciasDetectadas.length > 0 && (
                    <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-lg space-y-1 text-amber-900">
                      <div className="font-bold text-xs flex items-center gap-1.5">
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                        Divergências no Documento Auditadas:
                      </div>
                      {resultadoExtracao.divergenciasDetectadas.map((d, i) => (
                        <div key={i} className="text-[11px] leading-relaxed pl-5">
                          <strong>{d.campo}:</strong> {d.origemResumo} vs {d.origemTabela} (Dif: {d.diferenca}).
                          <div className="text-amber-800 text-[10px]">{d.explicacao}</div>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="pt-2 flex justify-end">
                    <button
                      type="button"
                      onClick={handleConfirmarImportacaoSimulacao}
                      className="px-4 py-2 bg-emerald-700 hover:bg-emerald-600 text-white font-bold rounded-lg transition flex items-center gap-2"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      Aplicar Proposta ao Projeto
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
