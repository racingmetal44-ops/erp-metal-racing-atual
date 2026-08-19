// src/backend/config/webservices.js

export const SEFAZ_WEBSERVICES = {
  'SC': {
    'homologacao': {
      'NfeStatusServico': 'https://hom.nfe.sefaz.sc.gov.br/NFeStatusServico/NFeStatusServico.asmx',
      'NfeAutorizacao': 'https://hom.nfe.sefaz.sc.gov.br/NFeAutorizacao/NFeAutorizacao.asmx',
      'NfeRetAutorizacao': 'https://hom.nfe.sefaz.sc.gov.br/NFeRetAutorizacao/NFeRetAutorizacao.asmx',
      'NfeConsultaProtocolo': 'https://hom.nfe.sefaz.sc.gov.br/NFeConsultaProtocolo/NFeConsultaProtocolo.asmx',
      'NfeInutilizacao': 'https://hom.nfe.sefaz.sc.gov.br/NFeInutilizacao/NFeInutilizacao.asmx',
      'RecepcaoEvento': 'https://hom.nfe.sefaz.sc.gov.br/RecepcaoEvento/RecepcaoEvento.asmx'
    },
    'producao': {
      'NfeStatusServico': 'https://nfe.sefaz.sc.gov.br/NFeStatusServico/NFeStatusServico.asmx',
      'NfeAutorizacao': 'https://nfe.sefaz.sc.gov.br/NFeAutorizacao/NFeAutorizacao.asmx',
      'NfeRetAutorizacao': 'https://nfe.sefaz.sc.gov.br/NFeRetAutorizacao/NFeRetAutorizacao.asmx',
      'NfeConsultaProtocolo': 'https://nfe.sefaz.sc.gov.br/NFeConsultaProtocolo/NFeConsultaProtocolo.asmx',
      'NfeInutilizacao': 'https://nfe.sefaz.sc.gov.br/NFeInutilizacao/NFeInutilizacao.asmx',
      'RecepcaoEvento': 'https://nfe.sefaz.sc.gov.br/RecepcaoEvento/RecepcaoEvento.asmx'
    }
  }
};

export function getWebServiceUrl(uf, ambiente, servico) {
  const ufConfig = SEFAZ_WEBSERVICES[uf];
  if (!ufConfig) {
    throw new Error('UF ' + uf + ' nao configurada');
  }
  
  const ambienteConfig = ufConfig[ambiente];
  if (!ambienteConfig) {
    throw new Error('Ambiente ' + ambiente + ' nao configurado para UF ' + uf);
  }
  
  const url = ambienteConfig[servico];
  if (!url) {
    throw new Error('Servico ' + servico + ' nao configurado');
  }
  
  return url;
}
