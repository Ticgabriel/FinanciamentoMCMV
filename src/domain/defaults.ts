/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { ProjetoFinanciamento, PremissasCenario } from '../types';

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
  variacaoCreditoPercent: -10, // banco aprova 10% a menos
  inccAnualPercent: 8.5, // INCC acelerado
  trAnualPercent: 1.5, // TR positiva
  aumentoCustosInstalacaoPercent: 20, // reforma 20% mais cara
  reservaMinimaDesejadaCentavos: 1500000,
  perderBonusPontualidade: true // Simula perda do bônus de pontualidade por atraso (cobrança nas chaves)
};

/**
 * Caso 1: Caso Real extraído do PDF SAC (CAIXA 420 meses)
 * Valores rigorosamente verificados na seção 2.1 da especificação
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
      status: 'CONFIRMADO'
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
      status: 'CONFIRMADO'
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
      status: 'CONFIRMADO'
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
      dataPrimeiraParcela: '2026-11-10',
      indiceCorrecao: 'INCC'
    }
  },

  propostaBancaria: {
    id: 'prop_sac',
    bancoNome: 'CAIXA Econômica Federal',
    sistema: 'SAC',
    precoImovelCentavos: 40000000,
    valorFinanciadoCentavos: 27923401, // R$ 279.234,01
    valorEntradaCentavos: 12076599, // R$ 120.765,99
    prazoMeses: 420,
    taxaJurosNominalAnualPercent: 7.66,
    taxaJurosEfetivaAnualPercent: 7.93,
    cetAnualPercent: 8.69,
    primeiraPrestacaoCentavos: 252441, // R$ 2.524,41 resumo
    primeiroEncargoCentavos: 252436, // R$ 2.524,36 tabela
    dataPrimeiroVencimento: '2026-12-01',
    tarifaAvaliacaoAVistaCentavos: 418851, // R$ 4.188,51
    seguroAVistaCentavos: 5213, // R$ 52,13
    taxaAdmFixaMensalCentavos: 2500, // R$ 25,00/mês
    aliquotaMipInicialPercent: 0.0163,
    aliquotaDfiMensalCentavos: 2840, // R$ 28,40
    status: 'CONFIRMADO'
  },

  custosComplementares: [
    {
      id: 'cc1',
      categoria: 'ITBI',
      descricao: 'ITBI Municipal (3% sobre base venal/preço)',
      valorCentavos: 1200000, // R$ 12.000,00
      vencimento: '2026-11-10',
      vinculoMarco: 'CONTRATACAO',
      financiadoPeloBanco: false,
      status: 'ESTIMADO'
    },
    {
      id: 'cc2',
      categoria: 'REGISTRO_CARTORIO',
      descricao: 'Emolumentos de Registro de Imóveis (com desconto 50% 1º imóvel)',
      valorCentavos: 450000, // R$ 4.500,00
      vencimento: '2026-11-20',
      vinculoMarco: 'CONTRATACAO',
      financiadoPeloBanco: false,
      status: 'ESTIMADO'
    },
    {
      id: 'cc3',
      categoria: 'TARIFA_AVALIACAO',
      descricao: 'Tarifa de Avaliação de Bens Recebidos em Garantia (CAIXA)',
      valorCentavos: 418851, // R$ 4.188,51
      vencimento: '2026-10-15',
      vinculoMarco: 'DATA_FIXA',
      financiadoPeloBanco: false,
      status: 'CONFIRMADO'
    },
    {
      id: 'cc4',
      categoria: 'REFORMA_INSTALACAO',
      descricao: 'Pintura, luminárias, box e instalações básicas',
      valorCentavos: 1500000, // R$ 15.000,00
      vencimento: '2026-11-25',
      vinculoMarco: 'CHAVES',
      diasAposMarco: 10,
      financiadoPeloBanco: false,
      status: 'ESTIMADO'
    },
    {
      id: 'cc5',
      categoria: 'MUDANCA',
      descricao: 'Frete e mudança residencial',
      valorCentavos: 180000, // R$ 1.800,00
      vencimento: '2026-12-15',
      vinculoMarco: 'MUDANCA',
      financiadoPeloBanco: false,
      status: 'ESTIMADO'
    }
  ],

  caixaInicialCentavos: 11000000, // R$ 110.000,00 disponível na conta
  receitas: [
    {
      id: 'rec1',
      descricao: 'Renda Líquida Mensal do Titular 1',
      valorCentavos: 750000, // R$ 7.500,00
      recorrenteMensal: true
    },
    {
      id: 'rec2',
      descricao: 'Renda Líquida Mensal do Titular 2',
      valorCentavos: 450000, // R$ 4.500,00
      recorrenteMensal: true
    }
  ],
  despesas: [
    {
      id: 'desp1',
      descricao: 'Custo de Vida e Alimentação Familiar',
      valorCentavos: 450000, // R$ 4.500,00
      categoria: 'VIDA',
      cessaNaMudanca: false
    },
    {
      id: 'desp2',
      descricao: 'Aluguel do Imóvel Atual',
      valorCentavos: 220000, // R$ 2.200,00
      categoria: 'MORADIA_ATUAL',
      cessaNaMudanca: true // cessa após mudança efetiva
    },
    {
      id: 'desp3',
      descricao: 'Parcela de Carro',
      valorCentavos: 90000, // R$ 900,00
      categoria: 'OUTRA_DIVIDA',
      cessaNaMudanca: false
    }
  ],

  cenarios: [CENARIO_BASE_PADRAO, CENARIO_ADVERSO_PADRAO],
  cenarioAtivoIndex: 0,

  checklistDocumental: [
    { id: 'chk1', item: 'Demonstrativo e simulação CAIXA com CET', categoria: 'Bancário', status: 'CONFIRMADO', observacao: 'Documento SAC de 09/09/2026 conferido com 420 parcelas' },
    { id: 'chk2', item: 'Comprovante de saldo FGTS atualizado', categoria: 'Recursos', status: 'CONFIRMADO', observacao: 'Extrato emitido e vinculado à entrada' },
    { id: 'chk3', item: 'Matrícula com certidão de ônus e ações', categoria: 'Imóvel', status: 'PENDENTE', observacao: 'Aguardando certidão de 30 dias do vendedor' },
    { id: 'chk4', item: 'Enquadramento de desconto de 50% no Registro (Lei 6.015/73 art. 290)', categoria: 'Custos', status: 'PENDENTE', observacao: 'Exige declaração de primeiro imóvel' },
    { id: 'chk5', item: 'Guia e alíquota oficial do ITBI Municipal', categoria: 'Tributos', status: 'PENDENTE', observacao: 'Prefeitura de São Paulo - 3% sobre valor de transação' }
  ]
};

/**
 * Caso 2: Simulação Real Price (CAIXA 420 meses)
 * Valores verificados na seção 2.1:
 * Preço: R$ 400.000,00
 * Financiamento: R$ 320.000,00 | Entrada: R$ 80.000,00
 * Juros nominais: 7,66% | CET: 8,58%
 * Primeiro encargo: R$ 2.274,84
 */
export const PROJETO_REAL_PRICE_CAIXA: ProjetoFinanciamento = {
  ...PROJETO_REAL_SAC_CAIXA,
  id: 'caso_real_price_420',
  nome: 'Simulação Real CAIXA - Price 420 Meses',
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
      nome: 'FGTS Aplicado na Entrada',
      tipo: 'FGTS',
      valorCentavos: 4000000, // R$ 40.000,00
      disponivelEm: '2026-10-01',
      destino: 'PRECO',
      confirmado: true
    },
    {
      id: 'f3_p',
      nome: 'Financiamento Bancário CAIXA Price',
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
      status: 'CONFIRMADO'
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
      status: 'CONFIRMADO'
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
      status: 'CONFIRMADO'
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

/**
 * Caso 3: Imóvel na Planta com Balões e Repasse nas Chaves
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
    { id: 'f_pl5', nome: 'Financiamento Bancário a Obter no Repasse', tipo: 'CREDITO_BANCO', valorCentavos: 22000000, disponivelEm: '2028-11-01', destino: 'PRECO', confirmado: false }
  ],

  obrigacoesVendedor: [
    { id: 'ob_pl1', descricao: 'Sinal / Ato Construtora', tipo: 'SINAL', valorBaseCentavos: 3500000, vencimento: '2026-10-01', pagoAntecipado: false, indiceCorrecao: 'SEM_CORRECAO', taxaJurosMensalPercent: 0, status: 'CONFIRMADO' },
    { id: 'ob_pl2', descricao: 'Mensais da Obra (24 parcelas)', tipo: 'PARCELA_OBRA', valorBaseCentavos: 3600000, vencimento: '2026-11-01', pagoAntecipado: false, indiceCorrecao: 'INCC', taxaJurosMensalPercent: 0, status: 'CONFIRMADO' },
    { id: 'ob_pl3', descricao: '4 Balões Semestrais', tipo: 'BALAO_SEMESTRAL', valorBaseCentavos: 3200000, vencimento: '2027-04-01', pagoAntecipado: false, indiceCorrecao: 'INCC', taxaJurosMensalPercent: 0, status: 'CONFIRMADO' },
    { id: 'ob_pl4', descricao: 'Parcela Única das Chaves', tipo: 'CHAVES', valorBaseCentavos: 2700000, vencimento: '2028-10-01', pagoAntecipado: false, indiceCorrecao: 'INCC', taxaJurosMensalPercent: 0, status: 'CONFIRMADO' },
    { id: 'ob_pl5', descricao: 'Saldo para Repasse Bancário', tipo: 'REPASSE_FINANCIAMENTO', valorBaseCentavos: 22000000, vencimento: '2028-11-01', pagoAntecipado: false, indiceCorrecao: 'INCC', taxaJurosMensalPercent: 0, status: 'ESTIMADO' }
  ],

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
