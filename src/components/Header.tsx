/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { ProjetoFinanciamento } from '../types';
import { PROJETO_REAL_SAC_CAIXA, PROJETO_REAL_PRICE_CAIXA, PROJETO_PLANTA_REPASSE } from '../domain/defaults';
import { 
  Building2, 
  Download, 
  Upload, 
  FileText, 
  CheckCircle2, 
  AlertTriangle, 
  RefreshCw,
  SlidersHorizontal
} from 'lucide-react';
import { exportarProjetoParaJSON } from '../storage/projectStorage';

interface HeaderProps {
  projeto: ProjetoFinanciamento;
  onCarregarProjeto: (p: ProjetoFinanciamento) => void;
  onAbrirImportador: () => void;
  onAbrirTestes: () => void;
  cenarioAtivoIndex: number;
  onMudarCenario: (idx: number) => void;
}

export const Header: React.FC<HeaderProps> = ({
  projeto,
  onCarregarProjeto,
  onAbrirImportador,
  onAbrirTestes,
  cenarioAtivoIndex,
  onMudarCenario
}) => {
  return (
    <header className="bg-stone-900 text-stone-100 border-b border-stone-800 sticky top-0 z-40 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between py-3 gap-3">
          {/* Logo & Título */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-semibold tracking-tight text-stone-100">
                  Planejador de Financiamento Imobiliário
                </h1>
                <span className="text-xs px-2 py-0.5 rounded bg-stone-800 text-stone-300 font-mono border border-stone-700">
                  v1.2 • Auditável
                </span>
              </div>
              <p className="text-xs text-stone-400">
                Consolidação de caixa familiar, simulações SAC/Price e cenários determinísticos
              </p>
            </div>
          </div>

          {/* Seletores & Ações */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Seletor de Casos Pré-configurados */}
            <div className="flex items-center gap-1.5 bg-stone-800/80 rounded-md px-2 py-1 border border-stone-700">
              <span className="text-xs text-stone-400 font-medium">Exemplo:</span>
              <select
                id="select-exemplo-predefinido"
                className="bg-transparent text-xs text-stone-200 font-medium focus:outline-none cursor-pointer"
                value={projeto.id}
                onChange={(e) => {
                  const id = e.target.value;
                  if (id === PROJETO_REAL_SAC_CAIXA.id) onCarregarProjeto(PROJETO_REAL_SAC_CAIXA);
                  else if (id === PROJETO_REAL_PRICE_CAIXA.id) onCarregarProjeto(PROJETO_REAL_PRICE_CAIXA);
                  else if (id === PROJETO_PLANTA_REPASSE.id) onCarregarProjeto(PROJETO_PLANTA_REPASSE);
                }}
              >
                <option value={PROJETO_REAL_SAC_CAIXA.id} className="bg-stone-900 text-stone-200">
                  CAIXA SAC 420m (PDF Real)
                </option>
                <option value={PROJETO_REAL_PRICE_CAIXA.id} className="bg-stone-900 text-stone-200">
                  CAIXA Price 420m (PDF Real)
                </option>
                <option value={PROJETO_PLANTA_REPASSE.id} className="bg-stone-900 text-stone-200">
                  Planta c/ Balões e Repasse
                </option>
              </select>
            </div>

            {/* Alternador de Cenário */}
            <div className="flex items-center bg-stone-800 rounded-md p-0.5 border border-stone-700">
              <button
                id="btn-cenario-base"
                type="button"
                onClick={() => onMudarCenario(0)}
                className={`text-xs px-2.5 py-1 rounded transition-colors ${
                  cenarioAtivoIndex === 0
                    ? 'bg-amber-500 text-stone-950 font-semibold shadow-sm'
                    : 'text-stone-400 hover:text-stone-200'
                }`}
              >
                Cenário Base
              </button>
              <button
                id="btn-cenario-adverso"
                type="button"
                onClick={() => onMudarCenario(1)}
                className={`text-xs px-2.5 py-1 rounded transition-colors flex items-center gap-1 ${
                  cenarioAtivoIndex === 1
                    ? 'bg-rose-500 text-white font-semibold shadow-sm'
                    : 'text-stone-400 hover:text-stone-200'
                }`}
              >
                <SlidersHorizontal className="w-3 h-3" />
                Adverso (Estresse)
              </button>
            </div>

            {/* Botões de Ação */}
            <div className="flex items-center gap-1">
              <button
                id="btn-importar-modal"
                type="button"
                onClick={onAbrirImportador}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-md bg-stone-800 hover:bg-stone-700 text-stone-200 border border-stone-700 transition"
                title="Importar simulação bancária ou arquivo JSON"
              >
                <Upload className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Importar</span>
              </button>

              <button
                id="btn-exportar-json"
                type="button"
                onClick={() => exportarProjetoParaJSON(projeto)}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-md bg-stone-800 hover:bg-stone-700 text-stone-200 border border-stone-700 transition"
                title="Exportar projeto completo em JSON versionado"
              >
                <Download className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Exportar JSON</span>
              </button>

              <button
                id="btn-testes-aceitacao"
                type="button"
                onClick={onAbrirTestes}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-md bg-emerald-950/60 hover:bg-emerald-900/80 text-emerald-400 border border-emerald-800/80 transition"
                title="Executar testes de aceitação e invariantes da seção 17"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Testes Numéricos</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};
