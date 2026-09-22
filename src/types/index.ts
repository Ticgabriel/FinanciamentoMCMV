/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type StatusDado = 'CONFIRMADO' | 'INFORMADO' | 'ESTIMADO' | 'NAO_INFORMADO' | 'CONFLITANTE';

export type RotuloFidelidade = 'EXTRAIDO' | 'REPRODUZIDO' | 'CALCULADO' | 'ESTIMADO';

export type ModalidadeOperacao = 
  | 'PRONTO' 
  | 'PLANTA_COM_BANCO_NA_OBRA' 
  | 'PLANTA_COM_REPASSE_FUTURO';

export type SistemaAmortizacao = 'SAC' | 'PRICE' | 'TAXA_ZERO' | 'TABELA_IMPORTADA';

export type OrigemDado = {
  tipo: 'documento' | 'usuario' | 'premissa_cenario' | 'motor';
  documentoId?: string;
  pagina?: number;
  campo?: string;
  confianca?: number;
};

export interface ValorAuditado<T = number> {
  valor: T;
  unidade?: string;
  status: StatusDado;
  rotulo?: RotuloFidelidade;
  origem: OrigemDado;
  dataReferencia?: string;
}

export type TipoFonteRecurso = 
  | 'DINHEIRO_PROPRIO' 
  | 'FGTS' 
  | 'SUBSIDIO' 
  | 'CREDITO_BANCO' 
  | 'SALDO_VENDEDOR_DIRETO'
  | 'OUTRO';

export interface FonteRecurso {
  id: string;
  nome: string;
  tipo: TipoFonteRecurso;
  valorCentavos: number;
  disponivelEm: string; // ISO YYYY-MM-DD
  destino: 'PRECO' | 'CUSTOS_COMPLEMENTARES' | 'RESERVA';
  confirmado: boolean;
  documentoComprovante?: string;
}

export type TipoObrigacaoVendedor = 
  | 'SINAL' 
  | 'PARCELA_OBRA' 
  | 'BALAO_SEMESTRAL' 
  | 'CHAVES' 
  | 'REPASSE_FINANCIAMENTO' 
  | 'OUTRO';

export interface ObrigacaoVendedor {
  id: string;
  descricao: string;
  tipo: TipoObrigacaoVendedor;
  valorBaseCentavos: number;
  vencimento: string; // ISO
  pagoAntecipado: boolean;
  indiceCorrecao: 'SEM_CORRECAO' | 'INCC' | 'IPCA' | 'IGPM';
  taxaJurosMensalPercent: number; // ex: 0 ou 1% a.m. pós chaves
  status: StatusDado;
}

export interface CustoComplementar {
  id: string;
  categoria: 'ITBI' | 'REGISTRO_CARTORIO' | 'TARIFA_AVALIACAO' | 'ASSESSORIA' | 'VISTORIA' | 'MUDANCA' | 'REFORMA_INSTALACAO' | 'CONDOMINIO_INICIAL' | 'OUTRO';
  descricao: string;
  valorCentavos: number;
  vencimento: string; // ISO
  vinculoMarco?: 'DATA_FIXA' | 'CONTRATACAO' | 'CHAVES' | 'MUDANCA';
  diasAposMarco?: number;
  financiadoPeloBanco: boolean;
  status: StatusDado;
}

export interface ReceitaFamiliar {
  id: string;
  descricao: string;
  valorCentavos: number;
  recorrenteMensal: boolean;
  dataCompetencia?: string; // se extraordinária
}

export interface DespesaFamiliar {
  id: string;
  descricao: string;
  valorCentavos: number;
  categoria: 'VIDA' | 'OUTRA_DIVIDA' | 'MORADIA_ATUAL';
  cessaNaMudanca: boolean; // ex: aluguel atual
}

export interface ParcelaBancoLinha {
  numero: number;
  vencimento: string;
  saldoDevedorInicialCentavos: number;
  atualizacaoCentavos: number;
  amortizacaoCentavos: number;
  jurosCentavos: number;
  prestacaoCentavos: number; // amort + juros
  seguroMipCentavos: number;
  seguroDfiCentavos: number;
  taxaAdmCentavos: number;
  encargoTotalCentavos: number; // prestação + seguros + adm
  saldoDevedorFinalCentavos: number;
  rotulo: RotuloFidelidade;
  origemTexto?: string;
}

export interface PropostaBancaria {
  id: string;
  bancoNome: string;
  sistema: SistemaAmortizacao;
  precoImovelCentavos: number;
  valorFinanciadoCentavos: number;
  valorEntradaCentavos: number;
  prazoMeses: number;
  taxaJurosNominalAnualPercent: number; // ex: 7.66
  taxaJurosEfetivaAnualPercent: number; // ex: 7.93
  cetAnualPercent: number; // ex: 8.69
  primeiraPrestacaoCentavos: number;
  primeiroEncargoCentavos: number;
  dataPrimeiroVencimento: string;
  tarifaAvaliacaoAVistaCentavos: number; // ex: 4188.51
  seguroAVistaCentavos: number; // ex: 52.13
  taxaAdmFixaMensalCentavos: number; // ex: 25.00
  aliquotaMipInicialPercent: number; // ex: 0.0163%
  aliquotaDfiMensalCentavos: number; // ex: 28.40
  tabelaImportada?: ParcelaBancoLinha[];
  status: StatusDado;
}

export interface MarcoTemporal {
  id: string;
  tipo: 'COMPRA' | 'CONTRATO_BANCO' | 'INICIO_OBRA' | 'CHAVES' | 'MUDANCA_EFETIVA' | 'PRIMEIRA_PARCELA_BANCO';
  dataPrevista: string;
  dataEfetiva?: string;
  descricao: string;
}

export interface PremissasCenario {
  nome: string;
  atrasoObraMeses: number; // ex: 0 ou 6 ou 12
  variacaoRendaPercent: number; // ex: -20 para queda de 20%
  variacaoCreditoPercent: number; // ex: -10 para repasse com 10% a menos
  inccAnualPercent: number; // ex: 6% ao ano projetado
  trAnualPercent: number; // ex: 0% ou 1.5%
  aumentoCustosInstalacaoPercent: number; // ex: 20%
  reservaMinimaDesejadaCentavos: number; // ex: R$ 15.000,00
  perderBonusPontualidade?: boolean; // Se ativado no cenário de estresse, simula perda do bônus por atraso contratual (cobrança nas chaves)
}

export interface LinhaCaixaMes {
  mesIndice: number;
  competencia: string; // YYYY-MM
  receitasCentavos: number;
  despesasVidaCentavos: number;
  moradiaAtualCentavos: number;
  outrasDividasCentavos: number;
  desembolsoVendedorCentavos: number;
  desembolsoBancoCentavos: number;
  custosComplementaresCentavos: number;
  totalSaidasCentavos: number;
  saldoCaixaMesCentavos: number;
  saldoCaixaAcumuladoCentavos: number;
  saldoDevedorBancoCentavos: number;
  saldoDevedorVendedorCentavos: number;
  reservaMinimaPisoCentavos: number;
  caixaLivreCentavos: number; // acumulado - reserva
  deficitAbaixoPisoCentavos: number;
  eventosDoMes: {
    categoria: string;
    descricao: string;
    valorCentavos: number;
    destinatario: 'BANCO' | 'VENDEDOR' | 'CARTORIO_PREFEITURA' | 'SERVICOS' | 'FAMILIA';
    origemFonte?: string;
  }[];
}

export interface DescontosBonusConstrutora {
  ativo: boolean;
  descontoComercialCentavos: number; // ex: R$ 12.000,00 (Abate do preço ou da entrada)
  tipoAbateDesconto: 'PRECO' | 'ENTRADA'; // Define se o desconto abate do preço total ou da entrada
  bonusPontualidadeCentavos: number; // ex: R$ 17.500,00 (Crédito Bom Pagador)
  reverterBonusSeAtrasar: boolean; // Se atrasar, dívida é reativada e exigida na entrega das chaves
  observacoes?: string;
  parcelamentoEntrada?: {
    ativo: boolean;
    numeroParcelas: number; // ex: 24, 36, 48
    dataPrimeiraParcela: string; // ISO YYYY-MM-DD
    indiceCorrecao: 'SEM_CORRECAO' | 'INCC' | 'IPCA' | 'IGPM';
  };
}

export interface ReconciliacaoPreco {
  precoImovelCentavos: number;
  descontoComercialCentavos?: number;
  bonusPontualidadeCentavos?: number;
  precoEfetivoCentavos?: number;
  somaFontesPrecoCentavos: number;
  somaObrigacoesPrecoCentavos: number;
  diferencaNaoConciliadaCentavos: number;
  fechado: boolean;
  detalheFontes: { tipo: string; valorCentavos: number }[];
  detalheObrigacoes: { tipo: string; valorCentavos: number }[];
}

export interface IndicadoresConsolidados {
  desembolsoInicialContratacaoCentavos: number;
  maiorDesembolsoMensalCentavos: number;
  mesMaiorDesembolso: string;
  menorSaldoCaixaCentavos: number;
  mesMenorSaldoCaixa: string;
  primeiroMesInsuficienciaCaixa: string | null;
  necessidadeAdicionalRecursosCentavos: number;
  necessidadeParaPreservarReservaCentavos: number;
  saldoCaixaNasChavesCentavos: number;
  custoTotalJurosBancoCentavos: number;
  custoTotalSegurosBancoCentavos: number;
  custoTotalTaxasAdmBancoCentavos: number;
  custoTotalPagoBancoCentavos: number;
  custoTotalPagoVendedorCentavos: number;
  custoTotalCustosComplementaresCentavos: number;
  custoAquisicaoEfetivoCentavos: number;
  taxaComprometimentoRendaPrimeiroMesPercent: number;
}

export type CodigoAlerta = 
  | 'PRECO_NAO_FECHA' 
  | 'DADO_ESSENCIAL_AUSENTE' 
  | 'PDF_DIVERGENTE' 
  | 'CAIXA_NEGATIVO' 
  | 'RESERVA_CONSUMIDA' 
  | 'REPASSE_INSUFICIENTE' 
  | 'REGRA_NAO_CONFIRMADA' 
  | 'DATAS_INCOMPATIVEIS' 
  | 'SALDO_RESIDUAL';

export interface AlertaProjeto {
  codigo: CodigoAlerta;
  severidade: 'BLOQUEANTE' | 'ATENCAO' | 'INFORMATIVO';
  titulo: string;
  mensagem: string;
  acaoSugerida: string;
  objetoAfetado?: string;
}

export interface ProjetoFinanciamento {
  id: string;
  schemaVersion: string;
  engineVersion: string;
  nome: string;
  criadoEm: string;
  atualizadoEm: string;
  modalidade: ModalidadeOperacao;
  dataBase: string; // ISO YYYY-MM-DD
  
  // Imóvel
  precoImovelCentavos: number;
  municipio: string;
  uf: string;
  avaliacaoBancariaCentavos: number;
  
  // Marcos
  marcos: MarcoTemporal[];
  
  // Fontes & Vendedor
  fontes: FonteRecurso[];
  obrigacoesVendedor: ObrigacaoVendedor[];
  
  // Descontos e Bônus da Construtora
  descontosBonus?: DescontosBonusConstrutora;
  
  // Proposta bancária ativa
  propostaBancaria: PropostaBancaria;
  
  // Custos Complementares
  custosComplementares: CustoComplementar[];
  
  // Orçamento Familiar
  caixaInicialCentavos: number;
  receitas: ReceitaFamiliar[];
  despesas: DespesaFamiliar[];
  
  // Cenários
  cenarios: PremissasCenario[];
  cenarioAtivoIndex: number;
  
  // Checklist documental e pendências
  checklistDocumental: {
    id: string;
    item: string;
    categoria: string;
    status: 'CONFIRMADO' | 'PENDENTE' | 'DISPENSADO';
    observacao: string;
  }[];
}
