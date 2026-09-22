/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { ProjetoFinanciamento } from './types';
import { 
  carregarProjetoSalvo, 
  salvarProjetoLocalmente 
} from './storage/projectStorage';
import { simularProjetoCompleto } from './domain/financial';
import { Header } from './components/Header';
import { ProjectSummaryBar } from './components/ProjectSummaryBar';
import { TabsNavigation, TabId } from './components/TabsNavigation';
import { OperacaoView } from './components/views/OperacaoView';
import { PrecoFontesView } from './components/views/PrecoFontesView';
import { BancoView } from './components/views/BancoView';
import { VendedorView } from './components/views/VendedorView';
import { CustosComplementaresView } from './components/views/CustosComplementaresView';
import { CaixaFamiliarView } from './components/views/CaixaFamiliarView';
import { CenariosView } from './components/views/CenariosView';
import { MemoriaCalculoView } from './components/views/MemoriaCalculoView';
import { AuditoriaView } from './components/views/AuditoriaView';
import { ImportarModal } from './components/views/ImportarModal';

export default function App() {
  const [projeto, setProjeto] = useState<ProjetoFinanciamento>(() => carregarProjetoSalvo());
  const [abaAtiva, setAbaAtiva] = useState<TabId>('OPERACAO');
  const [cenarioAtivoIndex, setCenarioAtivoIndex] = useState<number>(0);
  const [modalImportarAberto, setModalImportarAberto] = useState<boolean>(false);
  const [notificacao, setNotificacao] = useState<string | null>(null);

  // Auto-salva alterações no armazenamento local
  useEffect(() => {
    salvarProjetoLocalmente(projeto);
  }, [projeto]);

  const exibirNotificacao = (msg: string) => {
    setNotificacao(msg);
    setTimeout(() => setNotificacao(null), 3500);
  };

  const cenarioAtivo = projeto.cenarios[cenarioAtivoIndex] || projeto.cenarios[0];

  // Motor determinístico reativo
  const simulacao = useMemo(() => {
    return simularProjetoCompleto(projeto, cenarioAtivo);
  }, [projeto, cenarioAtivo]);

  const handleAtualizarProjeto = (novoProjeto: ProjetoFinanciamento) => {
    setProjeto(novoProjeto);
  };

  const handleCarregarProjetoPredefinido = (p: ProjetoFinanciamento) => {
    setProjeto(p);
    setCenarioAtivoIndex(0);
    exibirNotificacao(`Projeto "${p.nome}" carregado com sucesso.`);
  };

  return (
    <div className="min-h-screen flex flex-col bg-stone-100/70 text-stone-900 font-sans selection:bg-amber-200">
      {/* Toast de Notificação */}
      {notificacao && (
        <div className="fixed bottom-4 right-4 z-50 bg-stone-900 text-stone-100 text-xs px-4 py-2.5 rounded-lg shadow-lg border border-stone-700 animate-fade-in flex items-center gap-2">
          <span>{notificacao}</span>
        </div>
      )}

      {/* Cabeçalho Superior */}
      <Header
        projeto={projeto}
        onCarregarProjeto={handleCarregarProjetoPredefinido}
        onAbrirImportador={() => setModalImportarAberto(true)}
        onAbrirTestes={() => setAbaAtiva('AUDITORIA')}
        cenarioAtivoIndex={cenarioAtivoIndex}
        onMudarCenario={(idx) => {
          setCenarioAtivoIndex(idx);
          exibirNotificacao(`Cenário ${idx === 0 ? 'Base' : 'Adverso'} ativado.`);
        }}
      />

      {/* Faixa Fixa de Indicadores de Caixa & Conciliação */}
      <ProjectSummaryBar
        indicadores={simulacao.indicadores}
        reconciliacao={simulacao.reconciliacao}
        alertas={simulacao.alertas}
        cenarioNome={cenarioAtivo.nome}
      />

      {/* Barra de Navegação das Seções */}
      <TabsNavigation
        abaAtiva={abaAtiva}
        onSelecionarAba={(tab) => setAbaAtiva(tab)}
        precoReconciliado={simulacao.reconciliacao.fechado}
        caixaInsuficiente={simulacao.indicadores.menorSaldoCaixaCentavos < 0}
      />

      {/* Conteúdo Principal da Aba Selecionada */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {abaAtiva === 'OPERACAO' && (
          <OperacaoView 
            projeto={projeto} 
            onAtualizarProjeto={handleAtualizarProjeto} 
          />
        )}

        {abaAtiva === 'PRECO_FONTES' && (
          <PrecoFontesView 
            projeto={projeto} 
            onAtualizarProjeto={handleAtualizarProjeto} 
          />
        )}

        {abaAtiva === 'BANCO' && (
          <BancoView 
            projeto={projeto} 
            onAtualizarProjeto={handleAtualizarProjeto} 
          />
        )}

        {abaAtiva === 'VENDEDOR' && (
          <VendedorView 
            projeto={projeto} 
            onAtualizarProjeto={handleAtualizarProjeto} 
          />
        )}

        {abaAtiva === 'CUSTOS' && (
          <CustosComplementaresView 
            projeto={projeto} 
            onAtualizarProjeto={handleAtualizarProjeto} 
          />
        )}

        {abaAtiva === 'CAIXA' && (
          <CaixaFamiliarView 
            projeto={projeto} 
            onAtualizarProjeto={handleAtualizarProjeto}
            linhasCaixa={simulacao.linhasCaixa}
          />
        )}

        {abaAtiva === 'CENARIOS' && (
          <CenariosView 
            projeto={projeto} 
            onAtualizarProjeto={handleAtualizarProjeto}
            cenarioAtivoIndex={cenarioAtivoIndex}
            onMudarCenario={(idx) => setCenarioAtivoIndex(idx)}
          />
        )}

        {abaAtiva === 'MEMORIA' && (
          <MemoriaCalculoView 
            linhasCaixa={simulacao.linhasCaixa}
            tabelaBancaria={simulacao.tabelaBancariaUsada}
          />
        )}

        {abaAtiva === 'AUDITORIA' && (
          <AuditoriaView 
            projeto={projeto} 
            onAtualizarProjeto={handleAtualizarProjeto}
          />
        )}
      </main>

      {/* Modal de Importação */}
      <ImportarModal
        aberto={modalImportarAberto}
        onFechar={() => setModalImportarAberto(false)}
        onAplicarProjeto={(p) => {
          setProjeto(p);
          exibirNotificacao('Proposta bancária importada e aplicada.');
        }}
        projetoAtual={projeto}
      />

      {/* Rodapé Discreto e Informativo */}
      <footer className="bg-white border-t border-stone-200 py-4 text-xs text-stone-500">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-2 text-center sm:text-left">
          <div>
            <strong>Planejador de Financiamento Imobiliário</strong> • Motor Determinístico v1.2 (2026.09)
          </div>
          <div>
            Cálculo verificado e auditável • Em conformidade com a Resolução CMN 4.881
          </div>
        </div>
      </footer>
    </div>
  );
}
