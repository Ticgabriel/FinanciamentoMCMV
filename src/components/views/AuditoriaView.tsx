/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { ProjetoFinanciamento } from '../../types';
import { executarTestesAceitacao, ResultadoTeste } from '../../domain/testCases';
import { 
  ShieldCheck, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle, 
  RefreshCw, 
  FileCheck, 
  ListChecks, 
  Info 
} from 'lucide-react';

interface AuditoriaViewProps {
  projeto: ProjetoFinanciamento;
  onAtualizarProjeto: (p: ProjetoFinanciamento) => void;
}

export const AuditoriaView: React.FC<AuditoriaViewProps> = ({ projeto, onAtualizarProjeto }) => {
  const [testes, setTestes] = useState<ResultadoTeste[]>(() => executarTestesAceitacao());

  const rodarTestesNovamente = () => {
    setTestes(executarTestesAceitacao());
  };

  const handleMudarStatusChecklist = (id: string, status: 'CONFIRMADO' | 'PENDENTE' | 'DISPENSADO') => {
    const novoChecklist = projeto.checklistDocumental.map(item => 
      item.id === id ? { ...item, status } : item
    );
    onAtualizarProjeto({
      ...projeto,
      checklistDocumental: novoChecklist
    });
  };

  const todosPassaram = testes.every(t => t.passou);

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="border-b border-stone-200 pb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-stone-900 flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-amber-600" />
            9. Auditoria, Testes Numéricos & Checklist Documental
          </h2>
          <p className="text-sm text-stone-600 mt-1">
            Validação matemática de invariantes financeiras e lista de diligência documental para aprovação de crédito e contratação segura.
          </p>
        </div>

        <button
          type="button"
          onClick={rodarTestesNovamente}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-stone-900 hover:bg-stone-800 text-white transition shrink-0"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Reexecutar Testes Numéricos
        </button>
      </div>

      {/* Cartão de Resumo dos Testes Determinísticos */}
      <div className={`p-4 rounded-xl border ${
        todosPassaram ? 'bg-emerald-50/60 border-emerald-300' : 'bg-rose-50 border-rose-300'
      }`}>
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg ${todosPassaram ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>
            {todosPassaram ? <CheckCircle2 className="w-5 h-5" /> : <XCircle className="w-5 h-5" />}
          </div>
          <div>
            <h3 className="text-sm font-bold text-stone-900">
              {todosPassaram ? 'Todos os Testes de Aceitação Numérica Passaram (100% OK)' : 'Falha em Teste de Invariante Numérica'}
            </h3>
            <p className="text-xs text-stone-600 mt-0.5">
              Validação das fórmulas de amortização SAC, Price com taxa zero, correção composta de balão de chaves pelo INCC e equivalência contábil de fluxo de caixa familiar.
            </p>
          </div>
        </div>
      </div>

      {/* Tabela de Resultados dos Testes da Seção 17 */}
      <div className="bg-white p-5 rounded-xl border border-stone-200 shadow-xs space-y-3">
        <h3 className="text-sm font-bold text-stone-900 flex items-center gap-2">
          <FileCheck className="w-4 h-4 text-stone-700" />
          Critérios de Aceitação Determinísticos (Seção 17 da Especificação)
        </h3>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left border-collapse">
            <thead>
              <tr className="bg-stone-100/80 text-stone-700 font-semibold border-b border-stone-200">
                <th className="py-2.5 px-3">Identificador</th>
                <th className="py-2.5 px-3">Caso de Teste</th>
                <th className="py-2.5 px-3">Resultado Esperado</th>
                <th className="py-2.5 px-3">Resultado Obtido</th>
                <th className="py-2.5 px-3 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {testes.map((t) => (
                <tr key={t.id} className="hover:bg-stone-50">
                  <td className="py-2 px-3 font-mono font-medium text-stone-500">{t.id}</td>
                  <td className="py-2 px-3 font-semibold text-stone-900">
                    <div>{t.nome}</div>
                    <span className="text-[11px] text-stone-500 font-normal">{t.descricao}</span>
                  </td>
                  <td className="py-2 px-3 font-mono text-stone-700">{t.esperado}</td>
                  <td className="py-2 px-3 font-mono text-stone-700">{t.obtido}</td>
                  <td className="py-2 px-3 text-center">
                    {t.passou ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                        <CheckCircle2 className="w-3 h-3" /> APROVADO
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800">
                        <XCircle className="w-3 h-3" /> FALHOU
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Checklist Documental (Word Capítulos 13 a 19) */}
      <div className="bg-white p-5 rounded-xl border border-stone-200 shadow-xs space-y-4">
        <div>
          <h3 className="text-sm font-bold text-stone-900 flex items-center gap-2">
            <ListChecks className="w-4 h-4 text-stone-700" />
            Checklist de Diligência Documental & Enquadramento
          </h3>
          <p className="text-xs text-stone-500 mt-0.5">
            Itens indispensáveis antes de formalizar compromissos de compra e assinar contratos de financiamento bancário.
          </p>
        </div>

        <div className="space-y-2.5">
          {projeto.checklistDocumental.map((item) => (
            <div 
              key={item.id}
              className="p-3 rounded-lg border border-stone-200 bg-stone-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
            >
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-stone-900">{item.item}</span>
                  <span className="text-[10px] font-mono uppercase px-1.5 py-0.2 rounded bg-stone-200 text-stone-700">
                    {item.categoria}
                  </span>
                </div>
                <p className="text-xs text-stone-600 mt-1">{item.observacao}</p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <select
                  value={item.status}
                  onChange={(e) => handleMudarStatusChecklist(item.id, e.target.value as any)}
                  className={`text-xs px-2.5 py-1 rounded-md border font-semibold ${
                    item.status === 'CONFIRMADO' 
                      ? 'bg-emerald-50 border-emerald-300 text-emerald-800' 
                      : (item.status === 'PENDENTE' ? 'bg-amber-50 border-amber-300 text-amber-800' : 'bg-stone-100 border-stone-300 text-stone-600')
                  }`}
                >
                  <option value="CONFIRMADO">CONFIRMADO</option>
                  <option value="PENDENTE">PENDENTE</option>
                  <option value="DISPENSADO">DISPENSADO</option>
                </select>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
