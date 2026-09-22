/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { 
  ProjetoFinanciamento, 
  ObrigacaoVendedor, 
  TipoObrigacaoVendedor, 
  ResponsavelObrigacao 
} from '../../types';
import { toReais, calcularReconciliacaoPreco, adicionarMesesCivil } from '../../domain/financial';
import { DescontosBonusCard } from '../DescontosBonusCard';
import { 
  Building, 
  Plus, 
  Trash2, 
  AlertCircle, 
  CheckCircle2, 
  Scale, 
  Wand2, 
  CalendarDays,
  Filter,
  Check,
  AlertTriangle
} from 'lucide-react';

interface VendedorViewProps {
  projeto: ProjetoFinanciamento;
  onAtualizarProjeto: (p: ProjetoFinanciamento) => void;
}

export const VendedorView: React.FC<VendedorViewProps> = ({ projeto, onAtualizarProjeto }) => {
  const [filtroResponsavel, setFiltroResponsavel] = useState<string>('TODOS');
  const [modalGeradorParcelasAberto, setModalGeradorParcelasAberto] = useState(false);
  const [qtdParcelasObra, setQtdParcelasObra] = useState<number>(12);
  const [valorTotalParcelar, setValorTotalParcelar] = useState<number>(2400000); // R$ 24.000,00
  const [dataPrimeiraParcela, setDataPrimeiraParcela] = useState<string>(projeto.dataBase);

  const obrigacoes = projeto.obrigacoesVendedor;
  const reconciliacao = calcularReconciliacaoPreco(projeto);
  const precoEfetivoCentavos = reconciliacao.precoEfetivoCentavos ?? projeto.precoImovelCentavos;

  // Totais por responsável
  const totalBaseCentavos = obrigacoes.reduce((acc, o) => acc + o.valorBaseCentavos, 0);
  const totalCompradorCentavos = obrigacoes
    .filter(o => !o.responsavelPagamento || o.responsavelPagamento === 'COMPRADOR')
    .reduce((acc, o) => acc + o.valorBaseCentavos, 0);
  const totalBancoCentavos = obrigacoes
    .filter(o => o.responsavelPagamento === 'BANCO')
    .reduce((acc, o) => acc + o.valorBaseCentavos, 0);
  const totalFgtsCentavos = obrigacoes
    .filter(o => o.responsavelPagamento === 'FGTS')
    .reduce((acc, o) => acc + o.valorBaseCentavos, 0);
  const totalSubsidioCentavos = obrigacoes
    .filter(o => o.responsavelPagamento === 'SUBSIDIO')
    .reduce((acc, o) => acc + o.valorBaseCentavos, 0);

  const diferencaPrecoObrigacoes = precoEfetivoCentavos - totalBaseCentavos;

  const handleAtualizarObrigacao = (id: string, updates: Partial<ObrigacaoVendedor>) => {
    const novas = obrigacoes.map(o => {
      if (o.id !== id) return o;
      const updated = { ...o, ...updates };
      // Se alterou para REPASSE_FINANCIAMENTO e não especificou responsável, sugere BANCO
      if (updates.tipo === 'REPASSE_FINANCIAMENTO' && !updates.responsavelPagamento) {
        updated.responsavelPagamento = 'BANCO';
        updated.afetaCaixaLivre = false;
      }
      return updated;
    });
    onAtualizarProjeto({
      ...projeto,
      obrigacoesVendedor: novas
    });
  };

  const handleAdicionarObrigacao = () => {
    const nova: ObrigacaoVendedor = {
      id: `ob_${Date.now()}`,
      descricao: 'Nova Parcela / Balão',
      tipo: 'BALAO_SEMESTRAL',
      valorBaseCentavos: diferencaPrecoObrigacoes > 0 ? diferencaPrecoObrigacoes : 1000000,
      vencimento: projeto.dataBase,
      pagoAntecipado: false,
      indiceCorrecao: 'INCC',
      taxaJurosMensalPercent: 0,
      status: 'CONFIRMADO',
      responsavelPagamento: 'COMPRADOR',
      afetaCaixaLivre: true
    };
    onAtualizarProjeto({
      ...projeto,
      obrigacoesVendedor: [...obrigacoes, nova]
    });
  };

  const handleRemoverObrigacao = (id: string) => {
    onAtualizarProjeto({
      ...projeto,
      obrigacoesVendedor: obrigacoes.filter(o => o.id !== id)
    });
  };

  // Helper 1: Sincronizar Repasse com Financiamento Bancário
  const handleSincronizarRepasseBancario = () => {
    const valorFinanciado = projeto.propostaBancaria.valorFinanciadoCentavos;
    const repasseExistente = obrigacoes.find(o => o.tipo === 'REPASSE_FINANCIAMENTO');

    let novas: ObrigacaoVendedor[];
    if (repasseExistente) {
      novas = obrigacoes.map(o => o.id === repasseExistente.id ? {
        ...o,
        valorBaseCentavos: valorFinanciado,
        responsavelPagamento: 'BANCO' as ResponsavelObrigacao,
        afetaCaixaLivre: false
      } : o);
    } else {
      const novaObrigacao: ObrigacaoVendedor = {
        id: `ob_repasse_${Date.now()}`,
        descricao: 'Financiamento Bancário ao Vendedor',
        tipo: 'REPASSE_FINANCIAMENTO',
        valorBaseCentavos: valorFinanciado,
        vencimento: projeto.dataBase,
        pagoAntecipado: false,
        indiceCorrecao: 'SEM_CORRECAO',
        taxaJurosMensalPercent: 0,
        status: 'CONFIRMADO',
        responsavelPagamento: 'BANCO',
        afetaCaixaLivre: false
      };
      novas = [...obrigacoes, novaObrigacao];
    }

    onAtualizarProjeto({
      ...projeto,
      obrigacoesVendedor: novas
    });
  };

  // Helper 2: Ajustar Sinal / Entrada para Fechar o Preço
  const handleAjustarSinalParaConciliar = () => {
    const totalOutras = obrigacoes
      .filter(o => o.tipo !== 'SINAL')
      .reduce((acc, o) => acc + o.valorBaseCentavos, 0);
    const novoValorSinal = Math.max(0, precoEfetivoCentavos - totalOutras);

    const sinalExistente = obrigacoes.find(o => o.tipo === 'SINAL');
    let novas: ObrigacaoVendedor[];

    if (sinalExistente) {
      novas = obrigacoes.map(o => o.id === sinalExistente.id ? {
        ...o,
        valorBaseCentavos: novoValorSinal
      } : o);
    } else {
      const novoSinal: ObrigacaoVendedor = {
        id: `ob_sinal_${Date.now()}`,
        descricao: 'Sinal de Entrada em Recursos Próprios',
        tipo: 'SINAL',
        valorBaseCentavos: novoValorSinal,
        vencimento: projeto.dataBase,
        pagoAntecipado: false,
        indiceCorrecao: 'SEM_CORRECAO',
        taxaJurosMensalPercent: 0,
        status: 'CONFIRMADO',
        responsavelPagamento: 'COMPRADOR',
        afetaCaixaLivre: true
      };
      novas = [novoSinal, ...obrigacoes];
    }

    onAtualizarProjeto({
      ...projeto,
      obrigacoesVendedor: novas
    });
  };

  // Helper 3: Gerar Cronograma de Parcelas da Entrada
  const handleConfirmarGeracaoParcelas = () => {
    if (qtdParcelasObra <= 0 || valorTotalParcelar <= 0) return;
    const valorParcelaBase = Math.floor(valorTotalParcelar / qtdParcelasObra);
    const restoCentavos = valorTotalParcelar - (valorParcelaBase * qtdParcelasObra);

    const parcelasGeradas: ObrigacaoVendedor[] = [];
    for (let i = 1; i <= qtdParcelasObra; i++) {
      const venc = adicionarMesesCivil(dataPrimeiraParcela, i - 1);
      const valorDesta = i === qtdParcelasObra ? valorParcelaBase + restoCentavos : valorParcelaBase;

      parcelasGeradas.push({
        id: `ob_mensal_obra_${Date.now()}_${i}`,
        descricao: `Mensal da Entrada ${i}/${qtdParcelasObra}`,
        tipo: 'PARCELA_OBRA',
        valorBaseCentavos: valorDesta,
        vencimento: venc,
        pagoAntecipado: false,
        indiceCorrecao: 'INCC',
        taxaJurosMensalPercent: 0,
        status: 'CONFIRMADO',
        responsavelPagamento: 'COMPRADOR',
        afetaCaixaLivre: true
      });
    }

    onAtualizarProjeto({
      ...projeto,
      obrigacoesVendedor: [...obrigacoes, ...parcelasGeradas]
    });
    setModalGeradorParcelasAberto(false);
  };

  const obrigacoesFiltradas = obrigacoes.filter(ob => {
    if (filtroResponsavel === 'TODOS') return true;
    const resp = ob.responsavelPagamento || 'COMPRADOR';
    return resp === filtroResponsavel;
  });

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="border-b border-stone-200 pb-4">
        <h2 className="text-xl font-bold tracking-tight text-stone-900 flex items-center gap-2">
          <Building className="w-5 h-5 text-amber-600" />
          4. Obrigações com o Vendedor & Construtora
        </h2>
        <p className="text-sm text-stone-600 mt-1">
          Agenda completa de compromissos com o vendedor: sinal, parcelas mensais, balões de obra, parcela das chaves e repasse do financiamento.
        </p>
      </div>

      {/* Painel de Reconciliação com o Contrato */}
      <div 
        id="painel-conciliacao-vendedor"
        className={`p-5 rounded-xl border shadow-xs transition ${
          diferencaPrecoObrigacoes === 0
            ? 'bg-emerald-50/50 border-emerald-300'
            : 'bg-amber-50/60 border-amber-300'
        }`}
      >
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              {diferencaPrecoObrigacoes === 0 ? (
                <div className="p-1 rounded-full bg-emerald-100 text-emerald-700">
                  <CheckCircle2 className="w-4 h-4" />
                </div>
              ) : (
                <div className="p-1 rounded-full bg-amber-100 text-amber-700">
                  <AlertCircle className="w-4 h-4" />
                </div>
              )}
              <h3 className="font-bold text-sm text-stone-900">
                {diferencaPrecoObrigacoes === 0
                  ? 'Obrigações Conciliadas com o Preço de Compra e Venda'
                  : 'Divergência Contratual com o Preço do Imóvel'}
              </h3>
            </div>

            <p className="text-xs text-stone-600 mt-1">
              Preço Contratual: <strong>{toReais(precoEfetivoCentavos)}</strong> • Total Cadastrado em Obrigações: <strong>{toReais(totalBaseCentavos)}</strong>
              {diferencaPrecoObrigacoes !== 0 && (
                <span className="text-amber-800 font-bold ml-1">
                  (Diferença de {toReais(Math.abs(diferencaPrecoObrigacoes))} {diferencaPrecoObrigacoes > 0 ? 'a alocar' : 'excedente'})
                </span>
              )}
            </p>
          </div>

          {/* Ações Rápidas de Ajuste */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleSincronizarRepasseBancario}
              className="px-3 py-1.5 bg-white border border-stone-300 hover:bg-stone-50 rounded-lg text-xs font-semibold text-stone-800 transition flex items-center gap-1.5 shadow-xs"
            >
              <Wand2 className="w-3.5 h-3.5 text-amber-600" />
              Sincronizar Repasse Bancário ({toReais(projeto.propostaBancaria.valorFinanciadoCentavos)})
            </button>
            <button
              type="button"
              onClick={handleAjustarSinalParaConciliar}
              className="px-3 py-1.5 bg-white border border-stone-300 hover:bg-stone-50 rounded-lg text-xs font-semibold text-stone-800 transition flex items-center gap-1.5 shadow-xs"
            >
              <Scale className="w-3.5 h-3.5 text-emerald-600" />
              Ajustar Sinal para Fechar Preço
            </button>
            <button
              type="button"
              onClick={() => setModalGeradorParcelasAberto(true)}
              className="px-3 py-1.5 bg-stone-900 hover:bg-stone-800 text-white rounded-lg text-xs font-semibold transition flex items-center gap-1.5"
            >
              <CalendarDays className="w-3.5 h-3.5" />
              Gerar Parcelamento de Entrada
            </button>
          </div>
        </div>

        {/* Subtotais por Pagador */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 pt-3 border-t border-stone-200/80 text-xs">
          <div className="p-2.5 bg-white rounded-lg border border-stone-200">
            <span className="text-stone-500 block text-[10px]">Pago pelo Comprador</span>
            <strong className="text-stone-900">{toReais(totalCompradorCentavos)}</strong>
            <span className="text-[10px] text-amber-800 block">Debita do caixa livre</span>
          </div>
          <div className="p-2.5 bg-white rounded-lg border border-stone-200">
            <span className="text-stone-500 block text-[10px]">Repasse do Banco</span>
            <strong className="text-stone-900">{toReais(totalBancoCentavos)}</strong>
            <span className="text-[10px] text-blue-700 block">Crédito imobiliário</span>
          </div>
          <div className="p-2.5 bg-white rounded-lg border border-stone-200">
            <span className="text-stone-500 block text-[10px]">FGTS Vinculado</span>
            <strong className="text-stone-900">{toReais(totalFgtsCentavos)}</strong>
            <span className="text-[10px] text-emerald-700 block">Saldo liberado</span>
          </div>
          <div className="p-2.5 bg-white rounded-lg border border-stone-200">
            <span className="text-stone-500 block text-[10px]">Subsídio Habitacional</span>
            <strong className="text-stone-900">{toReais(totalSubsidioCentavos)}</strong>
            <span className="text-[10px] text-stone-600 block">Governo Federal</span>
          </div>
        </div>
      </div>

      {/* Descontos / Bônus da Construtora */}
      <DescontosBonusCard
        projeto={projeto}
        onAtualizarProjeto={onAtualizarProjeto}
        showParceladorEntrada={true}
      />

      {/* Barra de Filtros e Adição Manual */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-stone-400" />
          <span className="text-xs text-stone-600 font-semibold">Filtrar por Responsável:</span>
          <div className="flex items-center bg-stone-100 p-0.5 rounded-lg border border-stone-200 text-xs">
            {['TODOS', 'COMPRADOR', 'BANCO', 'FGTS', 'SUBSIDIO'].map(resp => (
              <button
                key={resp}
                type="button"
                onClick={() => setFiltroResponsavel(resp)}
                className={`px-2.5 py-1 rounded-md font-medium transition ${
                  filtroResponsavel === resp
                    ? 'bg-white text-stone-900 font-bold shadow-xs'
                    : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                {resp === 'TODOS' ? 'Todas' : resp}
              </button>
            ))}
          </div>
        </div>

        <button
          type="button"
          id="btn-adicionar-obrigacao"
          onClick={handleAdicionarObrigacao}
          className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg bg-stone-900 hover:bg-stone-800 text-white transition shrink-0"
        >
          <Plus className="w-3.5 h-3.5" />
          Adicionar Obrigação Manual
        </button>
      </div>

      {/* Lista de Obrigações */}
      <div className="space-y-3">
        {obrigacoesFiltradas.length === 0 ? (
          <div className="p-8 text-center bg-white rounded-xl border border-stone-200 text-xs text-stone-500">
            Nenhuma obrigação encontrada para o filtro selecionado.
          </div>
        ) : (
          obrigacoesFiltradas.map((ob) => (
            <div 
              key={ob.id} 
              id={`obrigacao-item-${ob.id}`}
              className="bg-white p-4 rounded-xl border border-stone-200 shadow-xs hover:border-stone-300 transition"
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 items-end">
                {/* Descrição */}
                <div className="lg:col-span-2">
                  <label className="block text-[11px] font-semibold text-stone-600 mb-1" htmlFor={`ob-desc-${ob.id}`}>
                    Descrição do Compromisso
                  </label>
                  <input
                    id={`ob-desc-${ob.id}`}
                    type="text"
                    value={ob.descricao}
                    onChange={(e) => handleAtualizarObrigacao(ob.id, { descricao: e.target.value })}
                    className="w-full px-2.5 py-1.5 text-xs bg-stone-50 border border-stone-300 rounded-md focus:ring-2 focus:ring-amber-500 font-medium text-stone-900"
                  />
                </div>

                {/* Tipo */}
                <div>
                  <label className="block text-[11px] font-semibold text-stone-600 mb-1" htmlFor={`ob-tipo-${ob.id}`}>
                    Classificação
                  </label>
                  <select
                    id={`ob-tipo-${ob.id}`}
                    value={ob.tipo}
                    onChange={(e) => handleAtualizarObrigacao(ob.id, { tipo: e.target.value as TipoObrigacaoVendedor })}
                    className="w-full px-2.5 py-1.5 text-xs bg-stone-50 border border-stone-300 rounded-md focus:ring-2 focus:ring-amber-500 text-stone-900"
                  >
                    <option value="SINAL">Sinal / Entrada</option>
                    <option value="PARCELA_OBRA">Mensal da Obra</option>
                    <option value="BALAO_SEMESTRAL">Balão Semestral/Anual</option>
                    <option value="CHAVES">Parcela das Chaves</option>
                    <option value="REPASSE_FINANCIAMENTO">Repasse de Financiamento</option>
                    <option value="OUTRO">Outro Compromisso</option>
                  </select>
                </div>

                {/* Vencimento */}
                <div>
                  <label className="block text-[11px] font-semibold text-stone-600 mb-1" htmlFor={`ob-venc-${ob.id}`}>
                    Vencimento
                  </label>
                  <input
                    id={`ob-venc-${ob.id}`}
                    type="date"
                    value={ob.vencimento}
                    onChange={(e) => handleAtualizarObrigacao(ob.id, { vencimento: e.target.value })}
                    className="w-full px-2.5 py-1.5 text-xs bg-stone-50 border border-stone-300 rounded-md focus:ring-2 focus:ring-amber-500 text-stone-900"
                  />
                </div>

                {/* Valor Base */}
                <div>
                  <label className="block text-[11px] font-semibold text-stone-600 mb-1" htmlFor={`ob-val-${ob.id}`}>
                    Valor Base (R$)
                  </label>
                  <div className="flex items-center gap-1.5">
                    <input
                      id={`ob-val-${ob.id}`}
                      type="text"
                      value={((ob.valorBaseCentavos || 0) / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      onChange={(e) => {
                        const num = parseFloat(e.target.value.replace(/\D/g, '')) || 0;
                        handleAtualizarObrigacao(ob.id, { valorBaseCentavos: num });
                      }}
                      className="w-full px-2.5 py-1.5 text-xs bg-stone-50 border border-stone-300 rounded-md focus:ring-2 focus:ring-amber-500 font-bold text-stone-900"
                    />
                    <button
                      type="button"
                      onClick={() => handleRemoverObrigacao(ob.id)}
                      className="p-1.5 text-stone-400 hover:text-rose-600 rounded-md hover:bg-stone-100 transition"
                      title="Remover obrigação"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Configuração de Correção Monetária e Responsabilidade */}
              <div className="mt-3 pt-3 border-t border-stone-100 flex flex-wrap items-center justify-between gap-3 text-xs">
                <div className="flex flex-wrap items-center gap-4">
                  <div className="flex items-center gap-2">
                    <span className="text-stone-500">Índice:</span>
                    <select
                      value={ob.indiceCorrecao}
                      onChange={(e) => handleAtualizarObrigacao(ob.id, { indiceCorrecao: e.target.value as any })}
                      className="px-2 py-0.5 text-xs bg-stone-100 border border-stone-300 rounded font-medium text-stone-800"
                    >
                      <option value="SEM_CORRECAO">Sem Correção (Fixo)</option>
                      <option value="INCC">INCC (Durante a Obra)</option>
                      <option value="IPCA">IPCA (Pós-chaves)</option>
                      <option value="IGPM">IGP-M</option>
                    </select>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-stone-500">Responsável pelo Pagamento:</span>
                    <select
                      value={ob.responsavelPagamento || (ob.tipo === 'REPASSE_FINANCIAMENTO' ? 'BANCO' : 'COMPRADOR')}
                      onChange={(e) => {
                        const resp = e.target.value as any;
                        handleAtualizarObrigacao(ob.id, { 
                          responsavelPagamento: resp,
                          afetaCaixaLivre: resp === 'COMPRADOR'
                        });
                      }}
                      className="px-2 py-0.5 text-xs bg-stone-100 border border-stone-300 rounded font-medium text-stone-800"
                    >
                      <option value="COMPRADOR">Comprador (Recursos Próprios)</option>
                      <option value="BANCO">Banco (Financiamento Bancário)</option>
                      <option value="FGTS">FGTS (Saldo Vinculado)</option>
                      <option value="SUBSIDIO">Governo / MCMV (Subsídio)</option>
                      <option value="OUTRO">Outro / Terceiros</option>
                    </select>
                  </div>

                  <label className="flex items-center gap-1.5 text-stone-600 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={ob.afetaCaixaLivre !== false}
                      disabled={ob.responsavelPagamento && ob.responsavelPagamento !== 'COMPRADOR'}
                      onChange={(e) => handleAtualizarObrigacao(ob.id, { afetaCaixaLivre: e.target.checked })}
                      className="rounded text-amber-600 focus:ring-amber-500 disabled:opacity-40"
                    />
                    <span>Debita do Caixa da Família</span>
                  </label>

                  <label className="flex items-center gap-1.5 text-stone-600 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={ob.pagoAntecipado}
                      onChange={(e) => handleAtualizarObrigacao(ob.id, { pagoAntecipado: e.target.checked })}
                      className="rounded text-amber-600 focus:ring-amber-500"
                    />
                    <span>Já quitado antes da data-base</span>
                  </label>
                </div>

                <div>
                  {ob.afetaCaixaLivre === false ? (
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                      Não sai do caixa familiar (Repasse externo / FGTS / Banco)
                    </span>
                  ) : (
                    <span className="text-[11px] text-stone-400">
                      {ob.indiceCorrecao === 'INCC' ? 'Corrigido acumulado no mês de vencimento' : 'Valor nominal'}
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Modal Gerador de Parcelamento de Entrada */}
      {modalGeradorParcelasAberto && (
        <div className="fixed inset-0 z-50 bg-stone-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-stone-200 space-y-4 text-xs">
            <div className="flex items-center justify-between border-b border-stone-200 pb-3">
              <h4 className="font-bold text-sm text-stone-900 flex items-center gap-2">
                <CalendarDays className="w-4 h-4 text-amber-600" />
                Gerar Parcelamento da Entrada
              </h4>
              <button
                type="button"
                onClick={() => setModalGeradorParcelasAberto(false)}
                className="text-stone-400 hover:text-stone-700"
              >
                ✕
              </button>
            </div>

            <p className="text-stone-600">
              Gera automaticamente um conjunto de parcelas mensais corrigidas pelo INCC para o fluxo da construtora.
            </p>

            <div className="space-y-3">
              <div>
                <label className="block text-stone-700 font-semibold mb-1">
                  Valor Total a Parcelar (R$):
                </label>
                <input
                  type="text"
                  value={((valorTotalParcelar || 0) / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  onChange={(e) => {
                    const num = parseFloat(e.target.value.replace(/\D/g, '')) || 0;
                    setValorTotalParcelar(num);
                  }}
                  className="w-full p-2 bg-stone-50 border border-stone-300 rounded font-bold text-stone-900"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-stone-700 font-semibold mb-1">
                    Número de Parcelas:
                  </label>
                  <input
                    type="number"
                    min="2"
                    max="72"
                    value={qtdParcelasObra}
                    onChange={(e) => setQtdParcelasObra(parseInt(e.target.value, 10) || 12)}
                    className="w-full p-2 bg-stone-50 border border-stone-300 rounded font-bold text-stone-900"
                  />
                </div>

                <div>
                  <label className="block text-stone-700 font-semibold mb-1">
                    Primeiro Vencimento:
                  </label>
                  <input
                    type="date"
                    value={dataPrimeiraParcela}
                    onChange={(e) => setDataPrimeiraParcela(e.target.value)}
                    className="w-full p-2 bg-stone-50 border border-stone-300 rounded font-medium text-stone-900"
                  />
                </div>
              </div>

              <div className="p-3 bg-stone-50 rounded-lg border border-stone-200">
                <span className="text-stone-500 block text-[10px]">Valor Base por Parcela:</span>
                <strong className="text-stone-900 text-sm">
                  {toReais(Math.floor(valorTotalParcelar / qtdParcelasObra))} / mês
                </strong>
                <span className="text-[10px] text-stone-500 block">
                  Com correção monetária pelo INCC no vencimento
                </span>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setModalGeradorParcelasAberto(false)}
                className="px-3 py-2 rounded-lg border border-stone-300 hover:bg-stone-50 font-semibold text-stone-700"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmarGeracaoParcelas}
                className="px-4 py-2 bg-stone-900 hover:bg-stone-800 text-white font-bold rounded-lg transition"
              >
                Gerar {qtdParcelasObra} Parcelas
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
