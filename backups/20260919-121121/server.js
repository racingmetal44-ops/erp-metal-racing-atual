import etiquetasRoutes from './src/backend/routes/etiquetasRoutes.js';
// ============================================
// ERP METAL RACING
// SERVER PRINCIPAL
// ============================================

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import express from 'express';
import { XMLParser } from 'fast-xml-parser';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Rotas
import nfeEntradaRoutes from './src/backend/routes/nfeEntradaRoutes.js';
import produtosRoutes from './src/backend/routes/produtosRoutes.js';
import authRoutes from './src/backend/routes/authRoutes.js';
import financeiroRoutes from './src/backend/routes/financeiroRoutes.js';
import certificateRoutes from './src/backend/routes/certificateRoutes.js';
import assinaturaRoutes from './src/backend/routes/assinatura.js';
import nfeRoutes from './src/backend/routes/nfeRoutes.js';
import pcpRoutes from './src/backend/routes/pcpRoutes.js';
import alertasRoutes from './src/backend/routes/alertasRoutes.js';
import devolucoesRoutes from './src/backend/routes/devolucoesRoutes.js';
import { listarEmpresas } from './src/backend/services/empresa/EmpresaService.js';
import Database from 'better-sqlite3';

// Imports para integração SEFAZ
import https from 'https';
import axios from 'axios';
import { SignedXml } from 'xml-crypto';
import forge from 'node-forge';

// DESABILITA VALIDACAO SSL GLOBAL (apenas homologacao SEFAZ)
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';


const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);


// ============================================
// CONFIGURA??O
// ============================================


const app = express();

const PORT = 3001;


// ============================================
// MIDDLEWARE
// ============================================

app.use(cors());

app.use(express.json({
    limit: '20mb'
}));

app.use(express.urlencoded({
    extended: true,
    limit: '20mb'
}));


// ============================================
// LOG DE REQUISI??ES
// ============================================

app.use((req, res, next) => {

    console.log(
        `[${new Date().toISOString()}] ${req.method} ${req.url}`
    );

    next();
});



// ============================================
// STORAGE LOCAL DE ARQUIVOS
// ============================================

const STORAGE_DIR = process.env.VERCEL
    ? path.join('/tmp', 'storage')
    : path.join(__dirname, 'storage');

if (!fs.existsSync(STORAGE_DIR)) {
    fs.mkdirSync(STORAGE_DIR, {
        recursive: true
    });
}

app.use('/storage', express.static(STORAGE_DIR));
// ============================================
// ARMAZENAMENTO LOCAL
// ============================================

const DATA_DIR =
    path.join(__dirname, 'data');

const COMPANIES_FILE =
    path.join(DATA_DIR, 'companies.json');

const NFE_FILE =
    path.join(DATA_DIR, 'nfe.json');


if (!process.env.VERCEL) {
// Criar pasta data
if (!fs.existsSync(DATA_DIR)) {

    fs.mkdirSync(
        DATA_DIR,
        {
            recursive: true
        }
    );
}


// Criar companies.json
if (!fs.existsSync(COMPANIES_FILE)) {

    fs.writeFileSync(
        COMPANIES_FILE,
        JSON.stringify([], null, 2),
        'utf8'
    );
}


// Criar nfe.json
if (!fs.existsSync(NFE_FILE)) {

    fs.writeFileSync(
        NFE_FILE,
        JSON.stringify([], null, 2),
        'utf8'
    );
}



}

// ============================================
// EMPRESAS
// ============================================

function getCompanies() {

    try {
        const empresasNormalizadas = listarEmpresas();
        if (empresasNormalizadas.length > 0) {
            return empresasNormalizadas;
        }

        const data =
            fs.readFileSync(
                COMPANIES_FILE,
                'utf8'
            );

        // Windows editors may save JSON with an UTF-8 BOM. It is not part of
        // the JSON grammar, so remove it before parsing without changing data.
        const companies =
            JSON.parse(data.replace(/^\uFEFF/, ''));

        // Older installations stored a single company as an object. Keep the
        // API contract as an array so all fiscal routes can find empresa_id.
        return Array.isArray(companies)
            ? companies
            : (companies && typeof companies === 'object' ? [companies] : []);

    } catch (error) {

        console.error(
            '[EMPRESAS] Erro ao ler companies.json:',
            error.message
        );

        return [];
    }
}


function saveCompanies(companies) {

    fs.writeFileSync(
        COMPANIES_FILE,
        JSON.stringify(
            companies,
            null,
            2
        ),
        'utf8'
    );
}


// ============================================
// NF-e
// ============================================

function getNFe() {

    try {

            const data = fs.readFileSync(
                NFE_FILE,
                'utf8'
            );

        const nfeList =
            JSON.parse(data.replace(/^\uFEFF/, ''));

        return Array.isArray(nfeList)
            ? nfeList
            : [];

    } catch (error) {

        console.error(
            '[NFE] Erro ao ler nfe.json:',
            error.message
        );

        return [];
    }
}


function saveNFe(nfeList) {

    fs.writeFileSync(
        NFE_FILE,
        JSON.stringify(
            nfeList,
            null,
            2
        ),
        'utf8'
    );
}


// ============================================
// STATUS DA API
// ============================================

app.get('/', (req, res) => {

    res.json({

        name:
            'ERP Metal Racing API',

        version:
            '1.0.0',

        status:
            'online',

        server:
            `http://localhost:${PORT}`,

        ambiente:
            process.env.NFE_AMBIENTE ||
            'homologacao',

        endpoints: {

            empresas: [
                'GET /api/empresas',
                'POST /api/empresas',
                'PUT /api/empresas/:id',
                'DELETE /api/empresas/:id'
            ],

            nfe: [
                'GET /api/nfe',
                'POST /api/nfe/emitir',
                'POST /api/nfe/testar-sefaz',
                'DELETE /api/nfe/:id'
            ],

            entradas: [
                'API /api/nfe-entradas'
            ],

            assinatura: [
                'POST /api/assinar-xml'
            ]

        }

    });

});


// ============================================
// GET EMPRESAS
// ============================================

app.get('/api/empresas', (req, res) => {

    try {

            getCompanies();

        res.json(companies);

    } catch (error) {

        console.error(
            '[EMPRESAS] GET:',
            error
        );

        res.status(500).json({

            success: false,

            error:
                error.message

        });
    }

});


// ============================================
// POST EMPRESA
// ============================================

app.post('/api/empresas', (req, res) => {

    try {

            getCompanies();

        const body =
            req.body || {};

        const cnpj =
            String(
                body.cnpj || ''
            ).replace(/\D/g, '');

        // Verificar CNPJ duplicado
        if (cnpj) {

            const exists =
                companies.some(company =>
                    String(
                        company.cnpj || ''
                    ).replace(/\D/g, '') === cnpj
                );

            if (exists) {

                return res.status(400).json({

                    success: false,

                    error:
                        'CNPJ j? cadastrado'

                });
            }
        }


        const now =
            new Date().toISOString();


        const newCompany = {

            id:
                Date.now(),

            ...body,

            cnpj:
                body.cnpj || '',

            status:
                'ativo',

            created_at:
                now,

            updated_at:
                now

        };


        companies.push(
            newCompany
        );

        saveCompanies(
            companies
        );


        res.status(201).json({

            success: true,

            data:
                newCompany

        });

    } catch (error) {

        console.error(
            '[EMPRESAS] POST:',
            error
        );

        res.status(500).json({

            success: false,

            error:
                error.message

        });
    }

});


// ============================================
// PUT EMPRESA
// ============================================

app.put('/api/empresas/:id', (req, res) => {

    try {

            getCompanies();

        const id =
            Number(
                req.params.id
            );

        const index =
            companies.findIndex(
                company =>
                    Number(company.id) === id
            );


        if (index === -1) {

            return res.status(404).json({

                success: false,

                error:
                    'Empresa n?o encontrada'

            });
        }


        const oldCompany =
            companies[index];


        companies[index] = {

            ...oldCompany,

            ...req.body,

            id:
                oldCompany.id,

            updated_at:
                new Date().toISOString()

        };


        saveCompanies(
            companies
        );


        res.json({

            success: true,

            data:
                companies[index]

        });

    } catch (error) {

        console.error(
            '[EMPRESAS] PUT:',
            error
        );

        res.status(500).json({

            success: false,

            error:
                error.message

        });
    }

});


// ============================================
// DELETE EMPRESA
// ============================================

app.delete('/api/empresas/:id', (req, res) => {

    try {

            getCompanies();

            Number(
                req.params.id
            );


        const filtered =
            companies.filter(
                company =>
                    Number(company.id) !== id
            );


        if (
            filtered.length ===
            companies.length
        ) {

            return res.status(404).json({

                success: false,

                error:
                    'Empresa n?o encontrada'

            });
        }


        saveCompanies(
            filtered
        );


        res.json({

            success: true,

            message:
                'Empresa removida!'

        });

    } catch (error) {

        console.error(
            '[EMPRESAS] DELETE:',
            error
        );

        res.status(500).json({

            success: false,

            error:
                error.message

        });
    }

});


// ============================================
// NF-e
// ============================================


app.use('/api/etiquetas', etiquetasRoutes);


// ============================================
// NF-e — CONSULTA SEFAZ (rotas ANTES do router genérico)
// ============================================

// NF-e — CONSULTA SEFAZ (SVRS - SC)
// ============================================


// Carrega o certificado A1 (apenas lê o buffer, https.request aceita pfx direto)
let certificadoCache = null;
function carregarCertificado() {
  if (certificadoCache) return certificadoCache;

  const pfxPath = process.env.CERT_PATH || './certificados/empresa_1.pfx';
  const senha = process.env.CERT_SENHA;

  if (!senha) throw new Error('CERT_SENHA nao configurada');

  const pfxBuffer = fs.readFileSync(pfxPath);
  console.log('[NFE] Certificado A1 carregado:', pfxBuffer.length, 'bytes');

  certificadoCache = {
    pfxBuffer: pfxBuffer,
    senha: senha
  };

  return certificadoCache;
}
// Cliente SOAP que cuida de headers/envelope automaticamente
import soap from 'soap';

async function chamarSefazSOAP(url, action, xmlBody) {
  const cert = carregarCertificado();

  // Extrai o corpo interno do envelope (o que o SEFAZ realmente espera)
  // O cliente SOAP envolve automaticamente
  const match = xmlBody.match(/<nfeDadosMsg[^>]*>([\s\S]*?)<\/nfeDadosMsg>/);
  const corpoInterno = match ? match[1].trim() : xmlBody;

  // Cria client com certificado
  const agent = new https.Agent({
    pfx: cert.pfxBuffer,
    passphrase: cert.senha,
    rejectUnauthorized: false,
    keepAlive: true
  });

  // Baixa o WSDL manualmente com axios (que respeita o httpsAgent)
  const wsdlResp = await axios.get(url + '?wsdl', {
    httpsAgent: agent,
    timeout: 30000
  });
  const wsdlXml = wsdlResp.data;

  // Cria client a partir do WSDL em string (nao tenta baixar de novo)
  const client = await soap.createClientAsync(wsdlXml, {
    httpsAgent: agent,
    disableCache: true,
    forceSoap12Headers: false,
    endpoint: url,
  });

  // Detecta o método e chama
  const metodo = action.split('/').pop();
  if (typeof client[metodo + 'Async'] !== 'function') {
    throw new Error('Metodo SOAP nao encontrado: ' + metodo);
  }

  const [resultado, rawResponse] = await client[metodo + 'Async']({ nfeDadosMsg: corpoInterno });

  return {
    status: 200,
    body: typeof rawResponse === 'string' ? rawResponse : JSON.stringify(rawResponse)
  };
}
// Rota: consultar NF-e pela chave de acesso
app.post('/api/nfe/consultar', async (req, res) => {
  try {
    const { chave } = req.body;

    if (!chave || chave.length !== 44 || !/^\d+$/.test(chave)) {
      return res.status(400).json({ success: false, error: 'Chave deve ter 44 dígitos numéricos' });
    }

    const empresa = getCompanies()[0];
    const cnpj = (empresa?.cnpj || '').replace(/\D/g, '');
    const uf = empresa?.uf || 'SC';

    // SC usa SVRS
    const url = 'https://nfe-homologacao.svrs.rs.gov.br/ws/NfeConsulta/NfeConsulta4.asmx';
    const action = 'http://www.portalfiscal.inf.br/nfe/wsdl/NFeConsulta4/nfeConsultaNF';

    const xmlBody = `<?xml version="1.0" encoding="UTF-8"?>
<soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap12="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <nfeConsultaNF xmlns="http://www.portalfiscal.inf.br/nfe/wsdl/NFeConsulta4">
      <nfeDadosMsg>
        <consSitNFe versao="4.00" xmlns="http://www.portalfiscal.inf.br/nfe">
          <tpAmb>2</tpAmb>
          <xServ>CONSULTAR</xServ>
          <chNFe>${chave}</chNFe>
        </consSitNFe>
      </nfeDadosMsg>
    </nfeConsultaNF>
  </soap:Body>
</soap:Envelope>`;

    const resposta = await chamarSefazSOAP(url, action, xmlBody);

    // Extrai cStat e xMotivo do XML de retorno
    const parser = new XMLParser({ ignoreAttributes: false });
    let cStat = null, xMotivo = null;

    try {
      const parsed = parser.parse(resposta.body);
      const ret = parsed?.['soap:Envelope']?.['soap:Body']?.['nfeConsultaNFResponse']?.['nfeResultMsg']?.['retConsSitNFe'];
      if (ret) {
        cStat = ret.cStat;
        xMotivo = ret.xMotivo;
      }
    } catch (e) {
      console.error('[NFE] Erro ao parsear resposta:', e.message);
    }

    res.json({
      success: cStat === '100' || cStat === '101' || cStat === '110',
      httpStatus: resposta.status,
      cStat,
      xMotivo,
      respostaCompleta: resposta.body.substring(0, 2000)
    });

  } catch (error) {
    console.error('[NFE] Erro na consulta SEFAZ:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Rota: enviar manifestação do destinatário
app.post('/api/nfe/manifestar', async (req, res) => {
  try {
    const { chave, tipoEvento } = req.body;
    // tipoEvento: 210200=Confirmação, 210210=Ciência, 210220=Desconhecimento, 210240=Não Realizada

    if (!chave || chave.length !== 44) {
      return res.status(400).json({ success: false, error: 'Chave inválida' });
    }

    if (!['210200', '210210', '210220', '210240'].includes(tipoEvento)) {
      return res.status(400).json({ success: false, error: 'Tipo de evento inválido' });
    }

    const empresa = getCompanies()[0];
    const cnpj = (empresa?.cnpj || '').replace(/\D/g, '');
    const url = 'https://nfe-homologacao.svrs.rs.gov.br/ws/RecepcaoEvento/RecepcaoEvento4.asmx';
    const action = 'http://www.portalfiscal.inf.br/nfe/wsdl/NFeRecepcaoEvento4/nfeRecepcaoEvento';

    const dhEvento = new Date().toISOString();
    const nSeqEvento = '1';
    const idEvento = `ID${tipoEvento}${chave}${nSeqEvento.padStart(2, '0')}`;

    const xmlBody = `<?xml version="1.0" encoding="UTF-8"?>
<soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap12="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <nfeRecepcaoEvento xmlns="http://www.portalfiscal.inf.br/nfe/wsdl/NFeRecepcaoEvento4">
      <nfeDadosMsg>
        <envEvento versao="1.00" xmlns="http://www.portalfiscal.inf.br/nfe">
          <idLote>1</idLote>
          <evento versao="1.00">
            <infEvento Id="${idEvento}">
              <cOrgao>42</cOrgao>
              <tpAmb>2</tpAmb>
              <CNPJ>${cnpj}</CNPJ>
              <chNFe>${chave}</chNFe>
              <dhEvento>${dhEvento}</dhEvento>
              <tpEvento>${tipoEvento}</tpEvento>
              <nSeqEvento>${nSeqEvento}</nSeqEvento>
              <verEvento>1.00</verEvento>
              <detEvento versao="1.00">
                <descEvento>${tipoEvento === '210200' ? 'Confirmacao da Operacao' : tipoEvento === '210210' ? 'Ciencia da Operacao' : tipoEvento === '210220' ? 'Desconhecimento da Operacao' : 'Operacao Nao Realizada'}</descEvento>
              </detEvento>
            </infEvento>
          </evento>
        </envEvento>
      </nfeDadosMsg>
    </nfeRecepcaoEvento>
  </soap:Body>
</soap:Envelope>`;

    const resposta = await chamarSefazSOAP(url, action, xmlBody);
    const parser = new XMLParser({ ignoreAttributes: false });

    let cStat = null, xMotivo = null;
    try {
      const parsed = parser.parse(resposta.body);
      const ret = parsed?.['soap:Envelope']?.['soap:Body']?.['nfeRecepcaoEventoResponse']?.['nfeResultMsg']?.['retEnvEvento'];
      if (ret) {
        cStat = ret.cStat;
        xMotivo = ret.xMotivo;
      }
    } catch (e) {
      console.error('[NFE] Erro ao parsear resposta:', e.message);
    }

    res.json({
      success: cStat === '128' || cStat === '135',
      httpStatus: resposta.status,
      cStat,
      xMotivo,
      respostaCompleta: resposta.body.substring(0, 2000)
    });

  } catch (error) {
    console.error('[NFE] Erro na manifestação SEFAZ:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});


app.use('/api/nfe', nfeRoutes);

// PCP - Produção
app.use('/api/pcp', pcpRoutes);


// ============================================
// NF-e - ENTRADAS DE MERCADORIAS
// ============================================

app.use(
    '/api/nfe-entradas',
    nfeEntradaRoutes
);


// ============================================
// FINANCEIRO

app.use(
    '/api/financeiro',
    financeiroRoutes
);


// CERTIFICADOS
// ============================================

app.use(
    '/api/empresas',
    certificateRoutes
);


// ============================================
// ASSINATURA XML
// ============================================

app.use(
    '/api',
    assinaturaRoutes
);



// ============================================
// PRODUTOS / ESTOQUE
// ============================================

app.use(
    '/api/produtos',
    produtosRoutes
);

app.use(
    '/api/devolucoes',
    devolucoesRoutes
);

app.use(
    '/api/auth',
    authRoutes
);


// ============================================
// ROTAS DE ALERTAS
// ============================================
app.use('/api/alertas', alertasRoutes);

// ============================================
// TRATAMENTO DE ROTA N?O ENCONTRADA
// ============================================

app.use(
    (req, res) => {

        res.status(404).json({

            success: false,

            error:
                'Rota n?o encontrada.',

            method:
                req.method,

            path:
                req.originalUrl

        });

    }
);


// ============================================
// TRATAMENTO GLOBAL DE ERROS
// ============================================

app.use(
    (error, req, res, next) => {

        console.error(
            '[SERVER] Erro global:',
            error
        );

        if (res.headersSent) {
            return next(error);
        }

        res.status(500).json({

            success: false,

            error:
                error.message ||
                'Erro interno do servidor.'

        });

    }
);


// ============================================
// INICIAR SERVIDOR
// ============================================

export default app;

if (!process.env.VERCEL) {




// ============================================
app.listen(
    PORT,
    '0.0.0.0',
    () => {

        console.log('');
        console.log(
            '============================================'
        );
        console.log(
            '🚀 ERP METAL RACING - SERVIDOR'
        );
        console.log(
            '============================================'
        );
        console.log(
            `📡 Servidor: http://localhost:${PORT}`
        );
        console.log(
            `📁 Dados: ${DATA_DIR}`
        );
        console.log(
            ` 🏢 Empresas: ${getCompanies().length}`
        );
        console.log(
            ` 📄 NF-e armazenadas: ${getNFe().length}`
        );
        console.log(
            `🔐 CERT_SENHA: ${
                process.env.CERT_SENHA
                    ? 'CONFIGURADA'
                    : 'N?O CONFIGURADA'
            }`
        );
        console.log(
            `🌎 Ambiente padrão: ${
                process.env.NFE_AMBIENTE ||
                'homologacao'
            }`
        );
        console.log(
            '============================================'
        );
        console.log('');

    }
);
}
































