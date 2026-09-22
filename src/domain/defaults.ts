/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { ProjetoFinanciamento, PremissasCenario, ObrigacaoVendedor } from '../types';
import { adicionarMesesCivil } from './calendar';

export const CENARIO_BASE_PADRAO: PremissasCenario = {
  nome: 'Cenário Base (Contratual)',
  atrasoObraMeses: 0,
  variacaoRendaPercent: 0,
  variacaoCreditoPercent: 0,
  inccAnualPercent: 5.5,
  trAnualPercent: 0,
  aumentoCustosInstalacaoPercent: 0,
  reservaMinimaDesejadaCentavos: 1500000 // R$ 15.000,00
};

export const CENARIO_ADVERSO_PADRAO: PremissasCenario = {
  nome: 'Cenário Adverso (Estresse)',
  atrasoObraMeses: 6, // 6 meses de atraso
  variacaoRendaPercent: -20, // queda de 20% na renda
  variacaoCreditoPercent: -10, // banco aprova 10% a menos (rombo no repasse)
  inccAnualPercent: 8.5, // INCC acelerado
  trAnualPercent: 1.5, // TR positiva 1,5% a.a.
  aumentoCustosInstalacaoPercent: 20, // reforma 20% mais cara
  reservaMinimaDesejadaCentavos: 1500000,
  perderBonusPontualidade: true // Simula perda do bônus de pontualidade por atraso (cobrança nas chaves)
};

/**
 * Caso 1: Caso Real extraído do PDF SAC (CAIXA 420 meses)
 * Valores rigorosamente verificados na seção 2.1 da especificação
 * Corrige F01: FGTS e Repasse Bancário marcados com afetaCaixaLivre: false
 */
export const PROJETO_REAL_SAC_CAIXA: ProjetoFinanciamento = {
  id: 'caso_real_sac_420',
  schemaVersion: '1.2.0',
  engineVersion: '2026.09',
  nome: 'Simulação Real CAIXA - SAC 420 Meses',
  criadoEm: '2026-09-09',
  atualizadoEm: '2026-09-22',
  modalidade: 'PRONTO',
  dataBase: '2026-10-01',
  precoImovelCentavos: 40000000, // R$ 400.000,00
  municipio: 'São Paulo',
  uf: 'SP',
  avaliacaoBancariaCentavos: 40000000,
  
  marcos: [
    { id: 'm1', tipo: 'COMPRA', dataPrevista: '2026-10-01', descricao: 'Assinatura da proposta e sinal' },
    { id: 'm2', tipo: 'CONTRATO_BANCO', dataPrevista: '2026-11-01', descricao: 'Emissão e assinatura contrato bancário' },
    { id: 'm3', tipo: 'CHAVES', dataPrevista: '2026-11-15', descricao: 'Disponibilidade das chaves e posse' },
    { id: 'm4', tipo: 'MUDANCA_EFETIVA', dataPrevista: '2026-12-15', descricao: 'Mudança definitiva para o imóvel' },
    { id: 'm5', tipo: 'PRIMEIRA_PARCELA_BANCO', dataPrevista: '2026-12-01', descricao: 'Primeiro vencimento do financiamento' }
  ],
  
  fontes: [
    {
      id: 'f1',
      nome: 'Recursos Próprios (Entrada)',
      tipo: 'DINHEIRO_PROPRIO',
      valorCentavos: 8076599, // R$ 80.765,99
      disponivelEm: '2026-10-01',
      destino: 'PRECO',
      confirmado: true
    },
    {
      id: 'f2',
      nome: 'FGTS Aplicado na Entrada',
      tipo: 'FGTS',
      valorCentavos: 4000000, // R$ 40.000,00
      disponivelEm: '2026-10-01',
      destino: 'PRECO',
      confirmado: true
    },
    {
      id: 'f3',
      nome: 'Financiamento Bancário CAIXA',
      tipo: 'CREDITO_BANCO',
      valorCentavos: 27923401, // R$ 279.234,01
      disponivelEm: '2026-11-01',
      destino: 'PRECO',
      confirmado: true
    }
  ],

  obrigacoesVendedor: [
    {
      id: 'ob1',
      descricao: 'Sinal e Recursos Próprios Pagos',
      tipo: 'SINAL',
      valorBaseCentavos: 8076599,
      vencimento: '2026-10-01',
      pagoAntecipado: false,
      indiceCorrecao: 'SEM_CORRECAO',
      taxaJurosMensalPercent: 0,
      status: 'CONFIRMADO',
      responsavelPagamento: 'COMPRADOR',
      afetaCaixaLivre: true
    },
    {
      id: 'ob2',
      descricao: 'Liberação do Saldo de FGTS',
      tipo: 'OUTRO',
      valorBaseCentavos: 4000000,
      vencimento: '2026-10-15',
      pagoAntecipado: false,
      indiceCorrecao: 'SEM_CORRECAO',
      taxaJurosMensalPercent: 0,
      status: 'CONFIRMADO',
      responsavelPagamento: 'FGTS',
      afetaCaixaLivre: false // NÃO sai da conta da família
    },
    {
      id: 'ob3',
      descricao: 'Repasse Financiamento Bancário ao Vendedor',
      tipo: 'REPASSE_FINANCIAMENTO',
      valorBaseCentavos: 27923401,
      vencimento: '2026-11-01',
      pagoAntecipado: false,
      indiceCorrecao: 'SEM_CORRECAO',
      taxaJurosMensalPercent: 0,
      status: 'CONFIRMADO',
      responsavelPagamento: 'BANCO',
      afetaCaixaLivre: false // NÃO sai da conta da família
    }
  ],

  descontosBonus: {
    ativo: false,
    descontoComercialCentavos: 1200000, // R$ 12.000,00
    tipoAbateDesconto: 'ENTRADA',
    bonusPontualidadeCentavos: 1750000, // R$ 17.500,00
    reverterBonusSeAtrasar: true,
    observacoes: 'Bônus de pontualidade/bom pagador concedido no parcelamento da entrada.',
    parcelamentoEntrada: {
      ativo: false,
      numeroParcelas: 24,
      dataPrimeiraParcela: '2026-11-01',
      indiceCorrecao: 'INCC'
    }
  },

  propostaBancaria: {
    id: 'prop_caixa_sac',
    bancoNome: 'CAIXA Econômica Federal',
    sistema: 'SAC',
    precoImovelCentavos: 40000000,
    valorFinanciadoCentavos: 27923401, // R$ 279.234,01
    valorEntradaCentavos: 12076599, // R$ 120.765,99 (FGTS + Recursos Próprios)
    prazoMeses: 420,
    taxaJurosNominalAnualPercent: 7.66,
    taxaJurosEfetivaAnualPercent: 7.93,
    cetAnualPercent: 8.69,
    primeiraPrestacaoCentavos: 252441, // R$ 2.524,41 resumo
    primeiroEncargoCentavos: 252436, // R$ 2.524,36 tabela
    dataPrimeiroVencimento: '2026-12-01',
    tarifaAvaliacaoAVistaCentavos: 418851, // R$ 4.188,51
    seguroAVistaCentavos: 5213, // R$ 52,13
    taxaAdmFixaMensalCentavos: 2500, // R$ 25,00
    aliquotaMipInicialPercent: 0.00848034, // R$ 23,68 na 1ª parcela da CAIXA (0,00848% sobre saldo)
    aliquotaDfiMensalCentavos: 2840, // R$ 28,40
    somatorioParcelasCentavos: 65443885, // R$ 654.438,85 informado na simulação CAIXA
    ultimaPrestacaoCentavos: 69408, // R$ 694,08
    status: 'CONFIRMADO'
  },

  custosComplementares: [
    {
      id: 'cc1',
      categoria: 'ITBI',
      descricao: 'ITBI Prefeitura de São Paulo (3%)',
      valorCentavos: 1200000, // R$ 12.000,00
      vencimento: '2026-11-10',
      vinculoMarco: 'CONTRATACAO',
      financiadoPeloBanco: false,
      status: 'CONFIRMADO'
    },
    {
      id: 'cc2',
      categoria: 'REGISTRO_CARTORIO',
      descricao: 'Escritura e Registro com Alienação Fiduciária',
      valorCentavos: 480000, // R$ 4.800,00
      vencimento: '2026-11-20',
      vinculoMarco: 'CONTRATACAO',
      financiadoPeloBanco: false,
      status: 'CONFIRMADO'
    },
    {
      id: 'cc3',
      categoria: 'TARIFA_AVALIACAO',
      descricao: 'Tarifa Operacional de Avaliação CAIXA',
      valorCentavos: 418851, // R$ 4.188,51
      vencimento: '2026-10-25',
      vinculoMarco: 'CONTRATACAO',
      financiadoPeloBanco: false,
      status: 'CONFIRMADO'
    },
    {
      id: 'cc4',
      categoria: 'REFORMA_INSTALACAO',
      descricao: 'Pintura, iluminação e adequações iniciais',
      valorCentavos: 1500000, // R$ 15.000,00
      vencimento: '2026-11-30',
      vinculoMarco: 'CHAVES',
      financiadoPeloBanco: false,
      status: 'ESTIMADO'
    },
    {
      id: 'cc5',
      categoria: 'MUDANCA',
      descricao: 'Caminhão e equipe de mudança',
      valorCentavos: 250000, // R$ 2.500,00
      vencimento: '2026-12-10',
      vinculoMarco: 'MUDANCA',
      financiadoPeloBanco: false,
      status: 'ESTIMADO'
    }
  ],

  caixaInicialCentavos: 12000000, // R$ 120.000,00 disponíveis na conta da família
  receitas: [
    {
      id: 'rec1',
      descricao: 'Salário Líquido Proponente 1',
      valorCentavos: 850000, // R$ 8.500,00
      recorrenteMensal: true
    },
    {
      id: 'rec2',
      descricao: 'Renda Líquida Proponente 2',
      valorCentavos: 450000, // R$ 4.500,00
      recorrenteMensal: true
    }
  ],
  despesas: [
    {
      id: 'desp1',
      descricao: 'Aluguel Atual (Cessa após a mudança)',
      valorCentavos: 220000, // R$ 2.200,00
      categoria: 'MORADIA_ATUAL',
      cessaNaMudanca: true
    },
    {
      id: 'desp2',
      descricao: 'Despesas de Vida e Manutenção',
      valorCentavos: 480000, // R$ 4.800,00
      categoria: 'VIDA',
      cessaNaMudanca: false
    }
  ],

  cenarios: [CENARIO_BASE_PADRAO, CENARIO_ADVERSO_PADRAO],
  cenarioAtivoIndex: 0,

  checklistDocumental: [
    { id: 'chk1', item: 'Extrato analítico do FGTS emitido há menos de 30 dias', categoria: 'Comprador', status: 'CONFIRMADO', observacao: 'Saldo de R$ 40.000,00 conferido no app FGTS' },
    { id: 'chk2', item: 'Demonstrativo de simulação CAIXA assinado', categoria: 'Bancário', status: 'CONFIRMADO', observacao: 'Taxa nominal 7.66%, prazo 420m' },
    { id: 'chk3', item: 'Matrícula do imóvel atualizada com negativa de ônus', categoria: 'Imóvel', status: 'CONFIRMADO', observacao: 'Válida por 30 dias a partir da emissão' },
    { id: 'chk4', item: 'Certidões negativas da construtora e sócios', categoria: 'Vendedor', status: 'CONFIRMADO', observacao: 'CND Federal, Trabalhista e Cível em dia' },
    { id: 'chk5', item: 'Comprovante de pagamento da Tarifa de Avaliação', categoria: 'Bancário', status: 'PENDENTE', observacao: 'Boleto de R$ 4.188,51 a pagar na assinatura' }
  ]
};

/**
 * Caso 2: Proposta Normalizada Price CAIXA (Mesmo principal R$ 320.000)
 */
export const PROJETO_PRICE_CAIXA: ProjetoFinanciamento = {
  ...PROJETO_REAL_SAC_CAIXA,
  id: 'caso_price_comparativo',
  nome: 'Simulação CAIXA - Tabela Price 420 Meses',
  fontes: [
    {
      id: 'f1_p',
      nome: 'Recursos Próprios (Entrada)',
      tipo: 'DINHEIRO_PROPRIO',
      valorCentavos: 4000000, // R$ 40.000,00
      disponivelEm: '2026-10-01',
      destino: 'PRECO',
      confirmado: true
    },
    {
      id: 'f2_p',
      nome: 'FGTS Entrada',
      tipo: 'FGTS',
      valorCentavos: 4000000, // R$ 40.000,00
      disponivelEm: '2026-10-01',
      destino: 'PRECO',
      confirmado: true
    },
    {
      id: 'f3_p',
      nome: 'Financiamento Bancário Price',
      tipo: 'CREDITO_BANCO',
      valorCentavos: 32000000, // R$ 320.000,00
      disponivelEm: '2026-11-01',
      destino: 'PRECO',
      confirmado: true
    }
  ],
  obrigacoesVendedor: [
    {
      id: 'ob1_p',
      descricao: 'Entrada em Recursos Próprios',
      tipo: 'SINAL',
      valorBaseCentavos: 4000000,
      vencimento: '2026-10-01',
      pagoAntecipado: false,
      indiceCorrecao: 'SEM_CORRECAO',
      taxaJurosMensalPercent: 0,
      status: 'CONFIRMADO',
      responsavelPagamento: 'COMPRADOR',
      afetaCaixaLivre: true
    },
    {
      id: 'ob2_p',
      descricao: 'Liberação de Saldo FGTS',
      tipo: 'OUTRO',
      valorBaseCentavos: 4000000,
      vencimento: '2026-10-15',
      pagoAntecipado: false,
      indiceCorrecao: 'SEM_CORRECAO',
      taxaJurosMensalPercent: 0,
      status: 'CONFIRMADO',
      responsavelPagamento: 'FGTS',
      afetaCaixaLivre: false
    },
    {
      id: 'ob3_p',
      descricao: 'Repasse Financiamento Bancário Price',
      tipo: 'REPASSE_FINANCIAMENTO',
      valorBaseCentavos: 32000000,
      vencimento: '2026-11-01',
      pagoAntecipado: false,
      indiceCorrecao: 'SEM_CORRECAO',
      taxaJurosMensalPercent: 0,
      status: 'CONFIRMADO',
      responsavelPagamento: 'BANCO',
      afetaCaixaLivre: false
    }
  ],
  propostaBancaria: {
    id: 'prop_price',
    bancoNome: 'CAIXA Econômica Federal',
    sistema: 'PRICE',
    precoImovelCentavos: 40000000,
    valorFinanciadoCentavos: 32000000, // R$ 320.000,00
    valorEntradaCentavos: 8000000, // R$ 80.000,00
    prazoMeses: 420,
    taxaJurosNominalAnualPercent: 7.66,
    taxaJurosEfetivaAnualPercent: 7.93,
    cetAnualPercent: 8.58,
    primeiraPrestacaoCentavos: 227485, // R$ 2.274,85 resumo
    primeiroEncargoCentavos: 227484, // R$ 2.274,84 tabela
    dataPrimeiroVencimento: '2026-12-01',
    tarifaAvaliacaoAVistaCentavos: 480000, // R$ 4.800,00
    seguroAVistaCentavos: 5560, // R$ 55,60
    taxaAdmFixaMensalCentavos: 2500,
    aliquotaMipInicialPercent: 0.0163,
    aliquotaDfiMensalCentavos: 2840,
    status: 'CONFIRMADO'
  }
};

export const PROJETO_REAL_PRICE_CAIXA = PROJETO_PRICE_CAIXA;

/**
 * Helper para gerar 24 obrigações mensais individuais de obra e 4 balões semestrais
 * Corrige F10 / R13: datas e valores individuais sem aglomeração artificial
 */
function gerarObrigacoesPlanta(): ObrigacaoVendedor[] {
  const obrigacoes: ObrigacaoVendedor[] = [
    {
      id: 'ob_pl1',
      descricao: 'Sinal / Ato Construtora',
      tipo: 'SINAL',
      valorBaseCentavos: 3500000,
      vencimento: '2026-10-01',
      pagoAntecipado: false,
      indiceCorrecao: 'SEM_CORRECAO',
      taxaJurosMensalPercent: 0,
      status: 'CONFIRMADO',
      responsavelPagamento: 'COMPRADOR',
      afetaCaixaLivre: true
    }
  ];

  // 24 Mensais da Obra de R$ 1.500,00 com INCC
  for (let i = 1; i <= 24; i++) {
    const dataVenc = adicionarMesesCivil('2026-11-01', i - 1);
    obrigacoes.push({
      id: `ob_pl_m${i}`,
      descricao: `Mensal da Obra ${i}/24`,
      tipo: 'PARCELA_OBRA',
      valorBaseCentavos: 150000, // R$ 1.500,00
      vencimento: dataVenc,
      pagoAntecipado: false,
      indiceCorrecao: 'INCC',
      taxaJurosMensalPercent: 0,
      status: 'CONFIRMADO',
      responsavelPagamento: 'COMPRADOR',
      afetaCaixaLivre: true
    });
  }

  // 4 Balões Semestrais de R$ 8.000,00 com INCC
  const datasBaloes = ['2027-04-01', '2027-10-01', '2028-04-01', '2028-10-01'];
  datasBaloes.forEach((dt, idx) => {
    obrigacoes.push({
      id: `ob_pl_b${idx + 1}`,
      descricao: `Balão Semestral ${idx + 1}/4`,
      tipo: 'BALAO_SEMESTRAL',
      valorBaseCentavos: 800000, // R$ 8.000,00
      vencimento: dt,
      pagoAntecipado: false,
      indiceCorrecao: 'INCC',
      taxaJurosMensalPercent: 0,
      status: 'CONFIRMADO',
      responsavelPagamento: 'COMPRADOR',
      afetaCaixaLivre: true
    });
  });

  // Chaves e Repasse
  obrigacoes.push({
    id: 'ob_pl_chaves',
    descricao: 'Parcela Única das Chaves',
    tipo: 'CHAVES',
    valorBaseCentavos: 2700000, // R$ 27.000,00 (paga com FGTS)
    vencimento: '2028-10-01',
    pagoAntecipado: false,
    indiceCorrecao: 'INCC',
    taxaJurosMensalPercent: 0,
    status: 'CONFIRMADO',
    responsavelPagamento: 'FGTS',
    afetaCaixaLivre: false
  });

  obrigacoes.push({
    id: 'ob_pl_repasse',
    descricao: 'Saldo para Repasse Bancário',
    tipo: 'REPASSE_FINANCIAMENTO',
    valorBaseCentavos: 22000000, // R$ 220.000,00
    vencimento: '2028-11-01',
    pagoAntecipado: false,
    indiceCorrecao: 'INCC',
    taxaJurosMensalPercent: 0,
    status: 'ESTIMADO',
    responsavelPagamento: 'BANCO',
    afetaCaixaLivre: false
  });

  return obrigacoes;
}

/**
 * Caso 3: Imóvel na Planta com Balões e Repasse nas Chaves
 * Corrige F06, F10: modalidade suportada e cronograma com 28 eventos reais
 */
export const PROJETO_PLANTA_REPASSE: ProjetoFinanciamento = {
  id: 'caso_planta_repasse_chaves',
  schemaVersion: '1.2.0',
  engineVersion: '2026.09',
  nome: 'Imóvel na Planta - Balões e Financiamento na Entrega',
  criadoEm: '2026-09-22',
  atualizadoEm: '2026-09-22',
  modalidade: 'PLANTA_COM_REPASSE_FUTURO',
  dataBase: '2026-10-01',
  precoImovelCentavos: 35000000, // R$ 350.000,00
  municipio: 'Campinas',
  uf: 'SP',
  avaliacaoBancariaCentavos: 35000000,
  
  marcos: [
    { id: 'm1_pl', tipo: 'COMPRA', dataPrevista: '2026-10-01', descricao: 'Assinatura contrato construtora' },
    { id: 'm2_pl', tipo: 'INICIO_OBRA', dataPrevista: '2026-11-01', descricao: 'Início da fundação' },
    { id: 'm3_pl', tipo: 'CHAVES', dataPrevista: '2028-10-01', descricao: 'Habite-se e vistoria das chaves (24 meses)' },
    { id: 'm4_pl', tipo: 'CONTRATO_BANCO', dataPrevista: '2028-11-01', descricao: 'Repasse bancário na entrega das chaves' },
    { id: 'm5_pl', tipo: 'MUDANCA_EFETIVA', dataPrevista: '2028-12-01', descricao: 'Mudança após reforma inicial' },
    { id: 'm6_pl', tipo: 'PRIMEIRA_PARCELA_BANCO', dataPrevista: '2028-12-01', descricao: 'Primeiro encargo bancário pós-repasse' }
  ],

  fontes: [
    { id: 'f_pl1', nome: 'Sinal Próprio', tipo: 'DINHEIRO_PROPRIO', valorCentavos: 3500000, disponivelEm: '2026-10-01', destino: 'PRECO', confirmado: true },
    { id: 'f_pl2', nome: 'Mensais Obra (24x R$ 1.500)', tipo: 'DINHEIRO_PROPRIO', valorCentavos: 3600000, disponivelEm: '2026-11-01', destino: 'PRECO', confirmado: true },
    { id: 'f_pl3', nome: 'Balões Semestrais (4x R$ 8.000)', tipo: 'DINHEIRO_PROPRIO', valorCentavos: 3200000, disponivelEm: '2027-04-01', destino: 'PRECO', confirmado: true },
    { id: 'f_pl4', nome: 'FGTS na Entrega das Chaves', tipo: 'FGTS', valorCentavos: 2700000, disponivelEm: '2028-10-01', destino: 'PRECO', confirmado: true },
    { id: 'f_pl5', nome: 'Financiamento Bancário a Obter no Repasse', tipo: 'CREDITO_BANCO', valorCentavos: 22000000, disponivelEm: '2028-11-01', destino: 'PRECO', confirmado: true }
  ],

  obrigacoesVendedor: gerarObrigacoesPlanta(),

  propostaBancaria: {
    id: 'prop_planta_repasse',
    bancoNome: 'Banco a Contratar na Entrega',
    sistema: 'SAC',
    precoImovelCentavos: 35000000,
    valorFinanciadoCentavos: 22000000,
    valorEntradaCentavos: 13000000,
    prazoMeses: 360,
    taxaJurosNominalAnualPercent: 8.5,
    taxaJurosEfetivaAnualPercent: 8.84,
    cetAnualPercent: 9.6,
    primeiraPrestacaoCentavos: 216700,
    primeiroEncargoCentavos: 222000,
    dataPrimeiroVencimento: '2028-12-01',
    tarifaAvaliacaoAVistaCentavos: 350000,
    seguroAVistaCentavos: 5000,
    taxaAdmFixaMensalCentavos: 2500,
    aliquotaMipInicialPercent: 0.0163,
    aliquotaDfiMensalCentavos: 2840,
    status: 'ESTIMADO'
  },

  custosComplementares: [
    { id: 'cc_pl1', categoria: 'ITBI', descricao: 'ITBI na transmissão das chaves', valorCentavos: 1050000, vencimento: '2028-10-15', vinculoMarco: 'CHAVES', financiadoPeloBanco: false, status: 'ESTIMADO' },
    { id: 'cc_pl2', categoria: 'REGISTRO_CARTORIO', descricao: 'Registro da escritura com alienação', valorCentavos: 420000, vencimento: '2028-11-15', vinculoMarco: 'CHAVES', financiadoPeloBanco: false, status: 'ESTIMADO' },
    { id: 'cc_pl3', categoria: 'REFORMA_INSTALACAO', descricao: 'Piso, revestimento, bancadas e gesso', valorCentavos: 2500000, vencimento: '2028-11-20', vinculoMarco: 'CHAVES', financiadoPeloBanco: false, status: 'ESTIMADO' }
  ],

  caixaInicialCentavos: 4500000, // R$ 45.000,00
  receitas: [
    { id: 'rec_pl1', descricao: 'Renda Líquida Familiar', valorCentavos: 900000, recorrenteMensal: true }
  ],
  despesas: [
    { id: 'desp_pl1', descricao: 'Aluguel Atual durante Obra', valorCentavos: 180000, categoria: 'MORADIA_ATUAL', cessaNaMudanca: true },
    { id: 'desp_pl2', descricao: 'Despesas de Vida', valorCentavos: 400000, categoria: 'VIDA', cessaNaMudanca: false }
  ],

  cenarios: [CENARIO_BASE_PADRAO, CENARIO_ADVERSO_PADRAO],
  cenarioAtivoIndex: 0,

  checklistDocumental: [
    { id: 'chk_pl1', item: 'Quadro resumo da incorporação e memorial descritivo', categoria: 'Construtora', status: 'CONFIRMADO', observacao: 'Memorial registrado no Cartório de Imóveis' },
    { id: 'chk_pl2', item: 'Índice de correção do contrato (INCC-DI ou INCC-M)', categoria: 'Contratual', status: 'CONFIRMADO', observacao: 'Cláusula prevê INCC-M da FGV até Habite-se' },
    { id: 'chk_pl3', item: 'Patrimônio de Afetação constituído pela construtora', categoria: 'Segurança Jurídica', status: 'CONFIRMADO', observacao: 'Blindagem patrimonial ativa e comprovada' },
    { id: 'chk_pl4', item: 'Simulação preliminar de capacidade de crédito para repasse', categoria: 'Bancário', status: 'PENDENTE', observacao: 'Reavaliar 6 meses antes da entrega das chaves' }
  ]
};

export const PROJETOS_EXEMPLO: ProjetoFinanciamento[] = [
  PROJETO_REAL_SAC_CAIXA,
  PROJETO_PRICE_CAIXA,
  PROJETO_PLANTA_REPASSE
];
