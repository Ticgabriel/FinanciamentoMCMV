/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { ProjetoFinanciamento, DescontosBonusConstrutora, ObrigacaoVendedor } from '../types';
import { toReais } from '../domain/financial';
import { adicionarMesesCivil } from '../domain/calendar';
import { 
  Gift, 
  AlertTriangle, 
  CheckCircle2, 
  Sparkles, 
  Calculator, 
  Calendar, 
  Layers, 
  Info,
  ArrowRight,
  TrendingUp,
  Percent
} from 'lucide-react';

interface DescontosBonusCardProps {
  projeto: ProjetoFinanciamento;
  onAtualizarProjeto: (p: ProjetoFinanciamento) => void;
  showParceladorEntrada?: boolean;
}

export const DescontosBonusCard: React.FC<DescontosBonusCardProps> = ({
  projeto,
  onAtualizarProjeto,
  showParceladorEntrada = true
}) => {
  // Inicialização segura dos dados de descontos
  const descontos: DescontosBonusConstrutora = projeto.descontosBonus || {
    ativo: false,
    descontoComercialCentavos: 1200000, // R$ 12.000,00
    tipoAbateDesconto: 'ENTRADA',
    bonusPontualidadeCentavos: 1750000, // R$ 17.500,00
    reverterBonusSeAtrasar: true,
    observacoes: 'O bônus de pontualidade é condicionado ao pagamento de 100% das parcelas em dia.',
    parcelamentoEntrada: {
      ativo: false,
      numeroParcelas: 24,
      dataPrimeiraParcela: projeto.dataBase,
      indiceCorrecao: 'INCC'
    }
  };

  const [numeroParcelas, setNumeroParcelas] = useState<number>(
    descontos.parcelamentoEntrada?.numeroParcelas || 24
  );
  const [dataPrimeiraParcela, setDataPrimeiraParcela] = useState<string>(
    descontos.parcelamentoEntrada?.dataPrimeiraParcela || projeto.dataBase
  );
  const [indiceCorrecao, setIndiceCorrecao] = useState<'SEM_CORRECAO' | 'INCC' | 'IPCA' | 'IGPM'>(
    descontos.parcelamentoEntrada?.indiceCorrecao || 'INCC'
  );
  const [msgSucessoParcelas, setMsgSucessoParcelas] = useState<string | null>(null);

  const handleToggleAtivo = (ativo: boolean) => {
    onAtualizarProjeto({
      ...projeto,
      descontosBonus: {
        ...descontos,
        ativo
      }
    });
  };

  const handleAtualizarDesconto = (updates: Partial<DescontosBonusConstrutora>) => {
    onAtualizarProjeto({
      ...projeto,
      descontosBonus: {
        ...descontos,
        ...updates
      }
    });
  };

  // Cálculos da Entrada e Saldo Devedor
  // Entrada total calculada pela proposta bancária ou pela diferença (Preço - Financiamento)
  const precoTotal = projeto.precoImovelCentavos;
  const valorFinanciado = projeto.propostaBancaria.valorFinanciadoCentavos || 0;
  const entradaBrutaExigida = Math.max(0, precoTotal - valorFinanciado);

  const descontoComercial = descontos.ativo ? descontos.descontoComercialCentavos : 0;
  const bonusPontualidade = descontos.ativo ? descontos.bonusPontualidadeCentavos : 0;
  const totalBeneficiosConstrutora = descontoComercial + bonusPontualidade;

  // Recursos que o comprador já tem para a entrada (dinheiro próprio à vista e FGTS)
  const fontesPropriasPreco = projeto.fontes.filter(
    f => f.destino === 'PRECO' && (f.tipo === 'DINHEIRO_PROPRIO' || f.tipo === 'FGTS' || f.tipo === 'SUBSIDIO')
  );
  const somaFontesPropriasCentavos = fontesPropriasPreco.reduce((acc, f) => acc + f.valorCentavos, 0);

  // Saldo devedor da entrada que resta parcelar com a construtora
  // Conta direta: Entrada Bruta - Descontos/Bônus - Recursos Próprios/FGTS já alocados
  const saldoResidualEntradaCentavos = Math.max(
    0,
    entradaBrutaExigida - totalBeneficiosConstrutora - somaFontesPropriasCentavos
  );

  const valorParcelaCentavos = numeroParcelas > 0 
    ? Math.round(saldoResidualEntradaCentavos / numeroParcelas) 
    : 0;

  // Função para gerar as parcelas do saldo de entrada automaticamente nas obrigações do vendedor
  const handleGerarParcelasEntrada = () => {
    if (numeroParcelas <= 0 || saldoResidualEntradaCentavos <= 0) return;

    // Filtra obrigações existentes para remover parcelas de entrada anteriores (se houver)
    // E ajusta o sinal acordado para refletir rigorosamente o valor aportado à vista (somaFontesPropriasCentavos)
    const obrigacoesPreservadas = projeto.obrigacoesVendedor
      .filter(o => !o.id.startsWith('parcela_entrada_auto_'))
      .map(o => {
        if (o.tipo === 'SINAL') {
          return {
            ...o,
            valorBaseCentavos: somaFontesPropriasCentavos
          };
        }
        return o;
      });

    const novasParcelas: ObrigacaoVendedor[] = [];

    for (let i = 1; i <= numeroParcelas; i++) {
      const vencIso = adicionarMesesCivil(dataPrimeiraParcela, i - 1);

      // Ajuste na última parcela para compensar centavos de arredondamento
      const valorDestaParcela = i === numeroParcelas
        ? saldoResidualEntradaCentavos - (valorParcelaCentavos * (numeroParcelas - 1))
        : valorParcelaCentavos;

      novasParcelas.push({
        id: `parcela_entrada_auto_${i}`,
        descricao: `Parcela Entrada Construtora (${i}/${numeroParcelas})`,
        tipo: 'PARCELA_OBRA',
        valorBaseCentavos: valorDestaParcela,
        vencimento: vencIso,
        pagoAntecipado: false,
        indiceCorrecao: indiceCorrecao,
        taxaJurosMensalPercent: 0,
        status: 'CONFIRMADO',
        responsavelPagamento: 'COMPRADOR',
        afetaCaixaLivre: true
      });
    }

    // Atualiza também uma fonte correspondente ao parcelamento com a construtora se não existir
    let novasFontes = [...projeto.fontes];
    const fonteVendedorIndex = novasFontes.findIndex(f => f.tipo === 'SALDO_VENDEDOR_DIRETO');
    if (fonteVendedorIndex >= 0) {
      novasFontes[fonteVendedorIndex] = {
        ...novasFontes[fonteVendedorIndex],
        valorCentavos: saldoResidualEntradaCentavos
      };
    } else {
      novasFontes.push({
        id: `fonte_parcelamento_vendedor`,
        nome: `Entrada Parcelada c/ Construtora (${numeroParcelas}x)`,
        tipo: 'SALDO_VENDEDOR_DIRETO',
        valorCentavos: saldoResidualEntradaCentavos,
        disponivelEm: dataPrimeiraParcela,
        destino: 'PRECO',
        confirmado: true
      });
    }

    onAtualizarProjeto({
      ...projeto,
      fontes: novasFontes,
      obrigacoesVendedor: [...obrigacoesPreservadas, ...novasParcelas],
      descontosBonus: {
        ...descontos,
        parcelamentoEntrada: {
          ativo: true,
          numeroParcelas,
          dataPrimeiraParcela,
          indiceCorrecao
        }
      }
    });

    setMsgSucessoParcelas(`${numeroParcelas} parcelas de ${toReais(valorParcelaCentavos)} geradas e sincronizadas com sucesso!`);
    setTimeout(() => setMsgSucessoParcelas(null), 4000);
  };

  return (
    <div 
      id="secao-descontos-bonus-construtora" 
      className="bg-white rounded-xl border border-stone-200 shadow-xs overflow-hidden"
    >
      {/* Top Banner com Checkbox Principal */}
      <div className="p-4 sm:p-5 border-b border-stone-200 bg-stone-50/70 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <label 
          htmlFor="checkbox-possui-descontos"
          className="flex items-center gap-3 cursor-pointer select-none group"
        >
          <input
            id="checkbox-possui-descontos"
            type="checkbox"
            checked={descontos.ativo}
            onChange={(e) => handleToggleAtivo(e.target.checked)}
            className="w-4 h-4 rounded text-amber-600 focus:ring-amber-500 border-stone-300 transition"
          />
          <div>
            <span className="text-sm font-bold text-stone-900 group-hover:text-amber-700 transition flex items-center gap-2">
              <Gift className="w-4 h-4 text-amber-600" />
              Possui Descontos / Bônus da Construtora?
            </span>
            <p className="text-xs text-stone-500">
              Incentivos comerciais, abatimentos de tabela e bonificação por pontualidade no pagamento da entrada.
            </p>
          </div>
        </label>

        {descontos.ativo && (
          <div className="flex items-center gap-2 self-start sm:self-center">
            <span className="text-xs px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 font-bold flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
              Total de Incentivos: {toReais(totalBeneficiosConstrutora)}
            </span>
          </div>
        )}
      </div>

      {/* Conteúdo Expansível em Árvore Estruturada */}
      {descontos.ativo ? (
        <div className="p-5 space-y-6">
          {/* Estrutura Visual em Árvore Exata */}
          <div className="relative pl-6 sm:pl-8 border-l-2 border-stone-200 ml-2 sm:ml-4 space-y-5">
            
            {/* ├── Desconto Comercial Incondicional */}
            <div className="relative">
              {/* Conector horizontal da árvore */}
              <div className="absolute -left-6 sm:-left-8 top-4 w-6 sm:w-8 h-0.5 bg-stone-300" />
              
              <div className="p-4 rounded-xl border border-stone-200 bg-stone-50/50 hover:border-stone-300 transition">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <label 
                      htmlFor="input-desconto-comercial"
                      className="block text-xs font-bold text-stone-900"
                    >
                      Desconto Comercial Incondicional
                    </label>
                    <span className="text-xs text-stone-500">
                      Abate contratual direto (reduz o preço de tabela ou a entrada exigida)
                    </span>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="relative w-44">
                      <span className="absolute left-2.5 top-1.5 text-xs text-stone-500 font-semibold">R$</span>
                      <input
                        id="input-desconto-comercial"
                        type="text"
                        value={((descontos.descontoComercialCentavos || 0) / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value.replace(/\D/g, '')) || 0;
                          handleAtualizarDesconto({ descontoComercialCentavos: val });
                        }}
                        className="w-full pl-8 pr-2.5 py-1.5 text-xs bg-white border border-stone-300 rounded-md focus:ring-2 focus:ring-amber-500 text-stone-900 font-bold text-right"
                      />
                    </div>

                    <select
                      value={descontos.tipoAbateDesconto}
                      onChange={(e) => handleAtualizarDesconto({ tipoAbateDesconto: e.target.value as 'PRECO' | 'ENTRADA' })}
                      className="text-xs px-2.5 py-1.5 bg-white border border-stone-300 rounded-md text-stone-700 font-medium"
                      title="Onde abater o desconto"
                    >
                      <option value="ENTRADA">Abate da Entrada</option>
                      <option value="PRECO">Abate do Preço</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>

            {/* └── Bônus Pontualidade / Bom Pagador */}
            <div className="relative">
              {/* Conector horizontal da árvore */}
              <div className="absolute -left-6 sm:-left-8 top-4 w-6 sm:w-8 h-0.5 bg-stone-300" />
              
              <div className="p-4 rounded-xl border border-amber-200 bg-amber-50/40 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <label 
                      htmlFor="input-bonus-pontualidade"
                      className="block text-xs font-bold text-amber-950 flex items-center gap-1.5"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                      Bônus Pontualidade / Bom Pagador
                    </label>
                    <span className="text-xs text-amber-800">
                      Crédito concedido na entrada condicionado ao adimplemento rigoroso
                    </span>
                  </div>

                  <div className="relative w-44">
                    <span className="absolute left-2.5 top-1.5 text-xs text-stone-500 font-semibold">R$</span>
                    <input
                      id="input-bonus-pontualidade"
                      type="text"
                      value={((descontos.bonusPontualidadeCentavos || 0) / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value.replace(/\D/g, '')) || 0;
                        handleAtualizarDesconto({ bonusPontualidadeCentavos: val });
                      }}
                      className="w-full pl-8 pr-2.5 py-1.5 text-xs bg-white border border-amber-300 rounded-md focus:ring-2 focus:ring-amber-500 text-stone-900 font-bold text-right"
                    />
                  </div>
                </div>

                {/* └── [!] Alerta da Ferramenta */}
                <div 
                  id="alerta-bonus-pontualidade-box"
                  className="p-3.5 rounded-lg bg-amber-100/70 border border-amber-300/80 text-amber-950 text-xs flex items-start gap-2.5"
                >
                  <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <div className="font-bold text-amber-900 flex items-center gap-1.5">
                      <span>Alerta da Ferramenta: Condição de Retenção do Bônus</span>
                    </div>
                    <p className="leading-relaxed text-amber-950">
                      <strong>&quot;Atenção: O bônus de pontualidade só é garantido se 100% dos pagamentos forem feitos em dia. Se houver atraso, essa dívida é reativada e exigida na entrega das chaves.&quot;</strong>
                    </p>
                    <p className="text-[11px] text-amber-800">
                      No módulo de Cenários e Testes de Estresse, você pode simular o impacto de um eventual atraso com a cobrança integral de {toReais(descontos.bonusPontualidadeCentavos)} nas chaves.
                    </p>
                  </div>
                </div>
              </div>
            </div>

          </div>

          {/* Módulo: Assistente de Parcelamento do Devedor da Entrada Restante */}
          {showParceladorEntrada && (
            <div 
              id="assistente-parcelamento-entrada"
              className="mt-6 pt-5 border-t border-stone-200 space-y-4"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Calculator className="w-4 h-4 text-stone-700" />
                  <h3 className="text-sm font-bold text-stone-900">
                    Parcelamento do Devedor de Entrada c/ a Construtora
                  </h3>
                </div>
                <span className="text-xs text-stone-500">
                  Calcula o valor que falta pagar da entrada e distribui em x vezes
                </span>
              </div>

              {/* Quadro Resumo do Saldo da Entrada */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-stone-50 p-4 rounded-xl border border-stone-200 text-xs">
                <div>
                  <span className="text-stone-500 block">Entrada Total Exigida:</span>
                  <span className="font-bold text-stone-900 text-sm">{toReais(entradaBrutaExigida)}</span>
                </div>
                <div>
                  <span className="text-stone-500 block">(-) Descontos & Bônus:</span>
                  <span className="font-bold text-emerald-700 text-sm">- {toReais(totalBeneficiosConstrutora)}</span>
                </div>
                <div>
                  <span className="text-stone-500 block">(-) Recursos Próprios / FGTS:</span>
                  <span className="font-bold text-stone-800 text-sm">- {toReais(somaFontesPropriasCentavos)}</span>
                </div>
                <div className="bg-amber-100/60 p-2 rounded-lg border border-amber-200">
                  <span className="text-amber-900 font-semibold block uppercase text-[10px]">
                    Saldo Restante a Parcelar:
                  </span>
                  <span className="font-extrabold text-amber-950 text-base">
                    {toReais(saldoResidualEntradaCentavos)}
                  </span>
                </div>
              </div>

              {/* Configuração do Fluxo de Parcelas */}
              <div className="p-4 rounded-xl border border-stone-200 bg-white space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-stone-600 mb-1" htmlFor="input-qtd-parcelas">
                      Número de Parcelas (X vezes)
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        id="input-qtd-parcelas"
                        type="number"
                        min="1"
                        max="72"
                        value={numeroParcelas}
                        onChange={(e) => setNumeroParcelas(Math.max(1, parseInt(e.target.value, 10) || 1))}
                        className="w-full px-2.5 py-1.5 text-xs bg-stone-50 border border-stone-300 rounded font-bold text-stone-900"
                      />
                      <span className="text-xs text-stone-500 whitespace-nowrap">meses</span>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-stone-600 mb-1" htmlFor="input-data-primeira-parcela">
                      Vencimento da 1ª Parcela
                    </label>
                    <input
                      id="input-data-primeira-parcela"
                      type="date"
                      value={dataPrimeiraParcela}
                      onChange={(e) => setDataPrimeiraParcela(e.target.value)}
                      className="w-full px-2.5 py-1.5 text-xs bg-stone-50 border border-stone-300 rounded font-medium text-stone-900"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-stone-600 mb-1" htmlFor="select-indice-entrada">
                      Correção Durante Obra
                    </label>
                    <select
                      id="select-indice-entrada"
                      value={indiceCorrecao}
                      onChange={(e) => setIndiceCorrecao(e.target.value as any)}
                      className="w-full px-2.5 py-1.5 text-xs bg-stone-50 border border-stone-300 rounded text-stone-900 font-medium"
                    >
                      <option value="INCC">INCC (Correção de Obras)</option>
                      <option value="SEM_CORRECAO">Sem Correção (Fixo)</option>
                      <option value="IPCA">IPCA</option>
                      <option value="IGPM">IGP-M</option>
                    </select>
                  </div>
                </div>

                {/* Resultado do Parcelamento e Ação de Aplicação */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
                  <div className="flex items-center gap-3">
                    <div className="px-3 py-2 bg-stone-100 rounded-lg text-stone-900">
                      <span className="text-[10px] text-stone-500 block uppercase font-semibold">Valor Estimado por Parcela:</span>
                      <span className="text-sm font-bold text-stone-900">
                        {numeroParcelas}x de {toReais(valorParcelaCentavos)}
                      </span>
                    </div>
                    {descontos.bonusPontualidadeCentavos > 0 && (
                      <span className="text-[11px] text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded border border-emerald-200">
                        ✓ Pagando certinho, você garante o crédito de {toReais(descontos.bonusPontualidadeCentavos)}
                      </span>
                    )}
                  </div>

                  <button
                    type="button"
                    id="btn-aplicar-parcelas-entrada"
                    onClick={handleGerarParcelasEntrada}
                    className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold transition shadow-xs cursor-pointer shrink-0"
                  >
                    <Layers className="w-3.5 h-3.5" />
                    Gerar e Sincronizar na Agenda da Construtora
                  </button>
                </div>

                {msgSucessoParcelas && (
                  <div className="p-2.5 bg-emerald-50 border border-emerald-300 rounded-lg text-xs text-emerald-900 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>{msgSucessoParcelas}</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="p-4 text-xs text-stone-500 bg-white">
          Marque a caixa acima se houver desconto comercial de tabela ou bonificação por pontualidade / bom pagador concedida pela construtora para o parcelamento da entrada.
        </div>
      )}
    </div>
  );
};
