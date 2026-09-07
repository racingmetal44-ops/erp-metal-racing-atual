import fs from 'fs';
import path from 'path';
import axios from 'axios';
import https from 'https';
import zlib from 'node:zlib';
import { parseStringPromise } from 'xml2js';
import CertificateLoader from './CertificateLoader.js';
import { getSefazServiceUrl, getCodigoUF, getTpAmb, normalizarAmbiente } from '../../config/sefaz.js';
import { buscarEmpresa, resolverCaminhoCertificado } from '../empresa/EmpresaService.js';

const PROJECT_ROOT = process.cwd();

class NfeDistribuicaoService {
  constructor() {
    this.certificate = null;
    this.empresaConfig = null;
  }

  async getEmpresaConfig(empresaId) {
    const empresa = buscarEmpresa(empresaId);

    if (!empresa) {
      throw new Error(`Empresa ${empresaId} nÃ£o encontrada`);
    }

    const certPath = resolverCaminhoCertificado(empresa);
    const senha =
      process.env.CERT_SENHA ||
      process.env.NFE_CERT_SENHA ||
      process.env.CERTIFICADO_SENHA ||
      '';

    if (!fs.existsSync(certPath)) {
      throw new Error(`Arquivo de certificado nÃ£o encontrado: ${certPath}`);
    }

    return {
      id: empresa.id,
      cnpj: this.somenteNumeros(empresa.cnpj),
      uf: empresa.uf || 'SC',
      certPath,
      certPassword: senha,
      razaoSocial: empresa.razaoSocial,
      ie: empresa.ie || empresa.inscricaoEstadual || '',
      ambiente: normalizarAmbiente(empresa.ambiente)
    };
  }

  async initialize(empresaId) {
    this.empresaConfig = await this.getEmpresaConfig(empresaId);

    // O Node/OpenSSL consegue carregar este PFX diretamente.
    // Não usamos node-forge aqui para evitar:
    // "Unsupported PKCS12 PFX data"
    const pfx = fs.readFileSync(this.empresaConfig.certPath);

    if (!pfx || pfx.length === 0) {
      throw new Error(
        `Certificado PFX vazio: ${this.empresaConfig.certPath}`
      );
    }

    this.certificate = {
      pfx,
      passphrase: this.empresaConfig.certPassword,
      certPath: this.empresaConfig.certPath
    };

    console.log(
      `[DF-e] Certificado PFX carregado diretamente pelo Node: ${this.empresaConfig.certPath}`
    );

    console.log(
      `[DF-e] Tamanho do PFX: ${pfx.length} bytes`
    );

    return true;
  }

  montarEnvelopeDistribuicao(params) {

    const { tpAmb, cUFAutor, cnpj, ultNSU, distNSU, chNFe } = params;

    if (!tpAmb) throw new Error('tpAmb Ã© obrigatÃ³rio');
    if (!cUFAutor) throw new Error('cUFAutor Ã© obrigatÃ³rio');
    if (!cnpj) throw new Error('CNPJ Ã© obrigatÃ³rio');

    const nsu = String(ultNSU || '000000000000000').padStart(15, '0');

    let consulta = '';

    if (chNFe) {
      consulta = [
        '        <consChNFe>',
        `          <chNFe>${chNFe}</chNFe>`,
        '        </consChNFe>'
      ].join('\n');
    } else if (distNSU) {
      consulta = [
        '        <consNSU>',
        `          <NSU>${String(distNSU).padStart(15, '0')}</NSU>`,
        '        </consNSU>'
      ].join('\n');
    } else {
      consulta = [
        '        <distNSU>',
        `          <ultNSU>${nsu}</ultNSU>`,
        '        </distNSU>'
      ].join('\n');
    }

    return [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">',
      '  <soap:Body>',
      '    <nfeDistDFeInteresse xmlns="http://www.portalfiscal.inf.br/nfe/wsdl/NFeDistribuicaoDFe">',
      '      <nfeDadosMsg xmlns="http://www.portalfiscal.inf.br/nfe/wsdl/NFeDistribuicaoDFe">',
      `        <distDFeInt xmlns="http://www.portalfiscal.inf.br/nfe" versao="1.01">`,
      `          <tpAmb>${tpAmb}</tpAmb>`,
      `          <cUFAutor>${cUFAutor}</cUFAutor>`,
      `          <CNPJ>${cnpj}</CNPJ>`,
      consulta,
      '        </distDFeInt>',
      '      </nfeDadosMsg>',
      '    </nfeDistDFeInteresse>',
      '  </soap:Body>',
      '</soap:Envelope>'
    ].join('\n');

  }

  async consultarDistribuicao(empresaId, ultNSU = '0', nsu = null) {
    if (!this.certificate || !this.empresaConfig || String(this.empresaConfig.id) !== String(empresaId)) {
      await this.initialize(empresaId);
    }

    const config = this.empresaConfig;
    const ambiente = config.ambiente || 'homologacao';
    console.log('[DF-e] ===== DIAGNÓSTICO DE AMBIENTE =====');
    console.log('[DF-e] config.ambiente:', config.ambiente);
    console.log('[DF-e] ambiente normalizado:', ambiente);
    console.log('[DF-e] tpAmb calculado:', getTpAmb(ambiente));
    console.log('[DF-e] ====================================');
    const tpAmb = getTpAmb(ambiente);
    const endpoint = getSefazServiceUrl(config.uf, ambiente, 'NFeDistribuicaoDFe');
    const cUFAutor = getCodigoUF(config.uf);

    const params = {
      tpAmb,
      cUFAutor,
      cnpj: config.cnpj,
      ultNSU: ultNSU || '0'
    };

    if (nsu) {
      params.distNSU = nsu;
    }

    const envelope = this.montarEnvelopeDistribuicao(params);

    const response = await axios.post(endpoint, envelope, {
      headers: {
        'Content-Type': 'text/xml; charset=utf-8',
        'SOAPAction': 'http://www.portalfiscal.inf.br/nfe/wsdl/NFeDistribuicaoDFe/nfeDistDFeInteresse'
      },
      httpsAgent: this.getHttpsAgent(),
      timeout: 60000
    });

    try {
      const debugDir = path.join(PROJECT_ROOT, 'data', 'debug-sefaz');
      fs.mkdirSync(debugDir, { recursive: true });

      fs.writeFileSync(
        path.join(debugDir, 'ultima-resposta-bruta-distribuicao.xml'),
        String(response.data || ''),
        'utf8'
      );

      console.log(
        '[DF-e] Resposta bruta da SEFAZ salva em:',
        path.join(debugDir, 'ultima-resposta-bruta-distribuicao.xml')
      );
    } catch (erroDebug) {
      console.warn(
        '[DF-e] NÃ£o foi possÃ­vel salvar resposta bruta:',
        erroDebug.message
      );
    }

    return this.processarResposta(response.data);
  }

  async consultar(opcoes) {

    const {
      empresaId,
      nsuEspecifico,
      chNFe
    } = opcoes || {};

    if (!empresaId) {
      throw new Error(
        'empresaId Ã© obrigatÃ³rio'
      );
    }

    const nsuAtual =
      lerNsu(empresaId).ultimoNsu || '000000000000000';

    const resultado =
      await this.consultarDistribuicao(
        empresaId,
        nsuAtual,
        nsuEspecifico || null
      );

    // -------------------------------------------------
    // CONTROLE CORRETO DO NSU
    // -------------------------------------------------
    //
    // SÃ© avanÃ©a o NSU quando a SEFAZ devolver um valor
    // vÃ¡lido superior ao atual.
    //
    // cStat 656 nunca deve avanÃ§ar o NSU.
    // cStat 137 significa que nÃ£o hÃ© documentos novos
    // no momento; nÃ£o devemos inventar um NSU.
    //
    const nsuRecebido =
      String(
        resultado.ultNSU ||
        ''
      ).replace(/\D/g, '').padStart(15, '0');

    const nsuAnterior =
      String(
        nsuAtual ||
        '000000000000000'
      ).replace(/\D/g, '').padStart(15, '0');

    const maxNsuRecebido =
      String(
        resultado.maxNSU ||
        ''
      ).replace(/\D/g, '').padStart(15, '0');

    const cStat =
      String(
        resultado.cStat ||
        ''
      );

    if (
      cStat !== '656' &&
      nsuRecebido &&
      nsuRecebido >= nsuAnterior &&
      nsuRecebido !== '000000000000000'
    ) {

      salvarNsu(
        empresaId,
        nsuRecebido
      );

      console.log(
        `[DF-e] NSU atualizado: ${nsuAnterior} -> ${nsuRecebido}`
      );

    } else if (cStat === '137') {

      console.log(
        `[DF-e] cStat 137. Nenhum documento novo. NSU permanece ${nsuAnterior}.`
      );

    } else if (cStat === '656') {

      console.warn(
        `[DF-e] cStat 656. NSU NÂºO serÃ© alterado.`
      );
    }

    const documentos = [];


    for (const doc of resultado.docZip || []) {

      const xml =
        this.decodificarDocZip(doc.xml);

      if (!xml) {
        continue;
      }

      if (
        chNFe &&
        !xml.includes(String(chNFe))
      ) {
        continue;
      }

      let tipo = 'OUTRO';

      if (
        /<procNFe\b/i.test(xml)
      ) {
        tipo = 'PROC_NFE';

      } else if (
        /<NFe\b/i.test(xml)
      ) {
        tipo = 'NFE';

      } else if (
        /<resNFe\b/i.test(xml)
      ) {
        tipo = 'RES_NFE';
      }

      documentos.push({
        nsu: doc.nsu || '',
        schema: doc.schema || '',
        tipo,
        xml,
        xmlPath: null
      });

    }

    const sucesso =
      String(resultado.cStat) === '137' ||
      String(resultado.cStat) === '138' ||
      String(resultado.cStat) === '656';

    return {
      success:
        sucesso ||
        documentos.length > 0,

      comunicacao: true,

      cStat:
        resultado.cStat,

      xMotivo:
        resultado.xMotivo,

      ultNSU:
        resultado.ultNSU || nsuAtual,

      maxNSU:
        resultado.maxNSU || '0',

      documentos,

      temDocumentos:
        documentos.length > 0,

      quantidadeDocumentos:
        documentos.length
    };

  }

  async processarResposta(xmlResponse) {

    const parsed = await parseStringPromise(xmlResponse, {
      explicitArray: false,
      mergeAttrs: true
    });

    const envelope =
      parsed?.['soap:Envelope'] ||
      parsed?.['soap12:Envelope'] ||
      parsed?.Envelope ||
      parsed?.['S:Envelope'];

    if (!envelope) {
      throw new Error('Envelope SOAP nÃ£o encontrado.');
    }

    const body =
      envelope?.['soap:Body'] ||
      envelope?.['soap12:Body'] ||
      envelope?.Body ||
      envelope?.['S:Body'];

    if (!body) {
      throw new Error('Body SOAP nÃ£o encontrado.');
    }

    const response =
      body?.nfeDistDFeInteresseResponse;

    if (!response) {
      console.error(
        '[DF-e] Body SOAP:',
        JSON.stringify(body, null, 2)
      );
      throw new Error(
        'Resposta nfeDistDFeInteresseResponse nÃ£o encontrada.'
      );
    }

    const resultado =
      response?.nfeDistDFeInteresseResult ||
      response?.['nfeDistDFeInteresseResult'];

    if (!resultado) {
      console.error(
        '[DF-e] Response SOAP:',
        JSON.stringify(response, null, 2)
      );
      throw new Error(
        'nfeDistDFeInteresseResult nÃ£o encontrado.'
      );
    }

    // Na resposta real da SEFAZ, o conteÃºdo vem como
    // retDistDFeInt diretamente dentro do Result.
    let ret =
      resultado?.retDistDFeInt ||
      resultado?.['retDistDFeInt'];

    // Alguns parsers/versÃ©es podem devolver o XML interno
    // como texto em _ ou #text.
    if (!ret && typeof resultado === 'object') {
      const texto =
        resultado?._ ||
        resultado?.['#text'];

      if (texto && typeof texto === 'string') {
        try {
          const interno = await parseStringPromise(
            texto,
            {
              explicitArray: false,
              mergeAttrs: true
            }
          );

          ret =
            interno?.retDistDFeInt ||
            interno?.['retDistDFeInt'];
        } catch {
          // Segue para a extraÃ©Ã©o por regex.
        }
      }
    }

    if (!ret) {
      const bruto = String(xmlResponse || '');

      const match = bruto.match(
        /<retDistDFeInt\b[^>]*>[\s\S]*?<\/retDistDFeInt>/i
      );

      if (match) {
        const interno = await parseStringPromise(
          match[0],
          {
            explicitArray: false,
            mergeAttrs: true
          }
        );

        ret =
          interno?.retDistDFeInt ||
          interno?.['retDistDFeInt'];
      }
    }

    if (!ret) {
      throw new Error(
        'retDistDFeInt nÃ£o encontrado na resposta da SEFAZ.'
      );
    }

    const result = {
      tpAmb: ret.tpAmb || null,
      verAplic: ret.verAplic || null,
      cStat: ret.cStat || null,
      xMotivo: ret.xMotivo || null,
      ultNSU: ret.ultNSU || '000000000000000',
      maxNSU: ret.maxNSU || '000000000000000',
      docZip: []
    };

    if (ret.docZip) {

      const documentos =
        Array.isArray(ret.docZip)
          ? ret.docZip
          : [ret.docZip];

      result.docZip = documentos.map(doc => ({

        nsu:
          doc?.$?.NSU ||
          doc?.NSU ||
          '',

        schema:
          doc?.$?.schema ||
          doc?.schema ||
          '',

        xml:
          doc?._ ||
          doc?.['#text'] ||
          null

      }));
    }

    return result;
  }

  getHttpsAgent() {
    if (!this.certificate || !this.certificate.pfx) {
      throw new Error('Certificado PFX não carregado');
    }

    return new https.Agent({
      pfx: this.certificate.pfx,
      passphrase: this.certificate.passphrase,
      rejectUnauthorized: true,
      minVersion: 'TLSv1.2'
    });
  }
}

export function salvarNsu(empresaId = 1, ultimoNsu = '000000000000000') {

  const dataDir = path.join(PROJECT_ROOT, 'data');
  const nsuDir = path.join(dataDir, 'nsu');

  if (!fs.existsSync(nsuDir)) {
    fs.mkdirSync(nsuDir, { recursive: true });
  }

  const arquivo = path.join(
    nsuDir,
    'empresa_' + String(empresaId) + '.json'
  );

  const nsu = String(
    ultimoNsu || '000000000000000'
  ).replace(/\D/g, '').padStart(15, '0');

  const registro = {
    ultimoNsu: nsu,
    atualizadoEm: new Date().toISOString()
  };

  fs.writeFileSync(
    arquivo,
    JSON.stringify(registro, null, 2),
    'utf8'
  );

  return registro;
}
export function lerNsu(empresaId = 1) {
  const dataDir = path.join(PROJECT_ROOT, 'data');
  const nsuDir = path.join(dataDir, 'nsu');

  if (!fs.existsSync(nsuDir)) {
    fs.mkdirSync(nsuDir, { recursive: true });
  }

  const arquivo = path.join(
    nsuDir,
    ("empresa_" + String(empresaId) + ".json")
  );

  if (!fs.existsSync(arquivo)) {
    const inicial = {
      ultimoNsu: '000000000000000'
    };

    fs.writeFileSync(
      arquivo,
      JSON.stringify(inicial, null, 2),
      'utf8'
    );

    return inicial;
  }

  try {
    const dados = JSON.parse(
      fs.readFileSync(arquivo, 'utf8')
    );

    return {
      ultimoNsu: String(
        dados.ultimoNsu || '000000000000000'
      ).padStart(15, '0')
    };
  } catch {
    return {
      ultimoNsu: '000000000000000'
    };
  }
}

export default new NfeDistribuicaoService();

