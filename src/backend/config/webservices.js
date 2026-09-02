// src/backend/config/webservices.js

// Configuração dos webservices da SEFAZ
export const SEFAZ_WEBSERVICES = {
  'SC': {
    'homologacao': {
      'NfeStatusServico': 'https://hom.nfe.sefaz.sc.gov.br/NFeStatusServico/NFeStatusServico.asmx',
      'NfeAutorizacao': 'https://hom.nfe.sefaz.sc.gov.br/NFeAutorizacao/NFeAutorizacao.asmx',
      'NfeRetAutorizacao': 'https://hom.nfe.sefaz.sc.gov.br/NFeRetAutorizacao/NFeRetAutorizacao.asmx',
      'NfeConsultaProtocolo': 'https://hom.nfe.sefaz.sc.gov.br/NFeConsultaProtocolo/NFeConsultaProtocolo.asmx',
      'NfeInutilizacao': 'https://hom.nfe.sefaz.sc.gov.br/NFeInutilizacao/NFeInutilizacao.asmx',
      'RecepcaoEvento': 'https://hom.nfe.sefaz.sc.gov.br/RecepcaoEvento/RecepcaoEvento.asmx',
      'NFeDistribuicaoDFe': 'https://hom.nfe.sefaz.sc.gov.br/NFeDistribuicaoDFe/NFeDistribuicaoDFe.asmx'
    },
    'producao': {
      'NfeStatusServico': 'https://nfe.sefaz.sc.gov.br/NFeStatusServico/NFeStatusServico.asmx',
      'NfeAutorizacao': 'https://nfe.sefaz.sc.gov.br/NFeAutorizacao/NFeAutorizacao.asmx',
      'NfeRetAutorizacao': 'https://nfe.sefaz.sc.gov.br/NFeRetAutorizacao/NFeRetAutorizacao.asmx',
      'NfeConsultaProtocolo': 'https://nfe.sefaz.sc.gov.br/NFeConsultaProtocolo/NFeConsultaProtocolo.asmx',
      'NfeInutilizacao': 'https://nfe.sefaz.sc.gov.br/NFeInutilizacao/NFeInutilizacao.asmx',
      'RecepcaoEvento': 'https://nfe.sefaz.sc.gov.br/RecepcaoEvento/RecepcaoEvento.asmx',
      'NFeDistribuicaoDFe': 'https://nfe.sefaz.sc.gov.br/NFeDistribuicaoDFe/NFeDistribuicaoDFe.asmx'
    }
  }
};

// Ambiente atual (true = producao, false = homologacao)
let ambienteProducao = false;

/**
 * Define o ambiente (produção ou homologação)
 */
export function setAmbiente(producao) {
  ambienteProducao = producao;
  console.log(`🔧 Ambiente alterado para: ${producao ? 'PRODUÇÃO' : 'HOMOLOGAÇÃO'}`);
}

/**
 * Retorna o ambiente atual
 */
export function getAmbiente() {
  return ambienteProducao ? 'producao' : 'homologacao';
}

/**
 * Retorna o ambiente como código (1 = produção, 2 = homologação)
 */
export function getAmbienteCodigo() {
  return ambienteProducao ? '1' : '2';
}

/**
 * Obtém a URL do webservice para a UF, ambiente e serviço
 */
export function getWebServiceUrl(uf, ambiente, servico) {
  const ufConfig = SEFAZ_WEBSERVICES[uf];
  if (!ufConfig) {
    throw new Error(`UF ${uf} não configurada`);
  }
  
  const ambienteConfig = ufConfig[ambiente];
  if (!ambienteConfig) {
    throw new Error(`Ambiente ${ambiente} não configurado para UF ${uf}`);
  }
  
  const url = ambienteConfig[servico];
  if (!url) {
    throw new Error(`Serviço ${servico} não configurado para UF ${uf} no ambiente ${ambiente}`);
  }
  
  return url;
}

/**
 * Obtém o endpoint para um serviço específico
 * @param {string} uf - UF do emitente
 * @param {string} servico - Nome do serviço
 * @param {string} ambiente - 'producao' ou 'homologacao' (opcional)
 */
export function getEndpoint(uf, servico, ambiente) {
  const amb = ambiente || getAmbiente();
  return getWebServiceUrl(uf, amb, servico);
}

/**
 * Retorna a configuração completa para uma UF e ambiente
 */
export function getConfig(uf, ambiente) {
  const ufConfig = SEFAZ_WEBSERVICES[uf];
  if (!ufConfig) {
    throw new Error(`UF ${uf} não configurada`);
  }
  
  const amb = ambiente || getAmbiente();
  const ambienteConfig = ufConfig[amb];
  if (!ambienteConfig) {
    throw new Error(`Ambiente ${amb} não configurado para UF ${uf}`);
  }
  
  return {
    uf,
    ambiente: amb,
    urls: ambienteConfig
  };
}

// Inicializa com homologação por padrão
setAmbiente(false);

export default {
  SEFAZ_WEBSERVICES,
  setAmbiente,
  getAmbiente,
  getAmbienteCodigo,
  getWebServiceUrl,
  getEndpoint,
  getConfig
};
