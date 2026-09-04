// ============================================
// ERP METAL RACING
// SERVER PRINCIPAL
// ============================================

import 'dotenv/config';

import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Rotas
import nfeEntradaRoutes from './src/backend/routes/nfeEntradaRoutes.js';
import financeiroRoutes from './src/backend/routes/financeiroRoutes.js';
import certificateRoutes from './src/backend/routes/certificateRoutes.js';
import assinaturaRoutes from './src/backend/routes/assinatura.js';
import nfeRoutes from './src/backend/routes/nfeRoutes.js';
import { listarEmpresas } from './src/backend/services/empresa/EmpresaService.js';


// ============================================
// CONFIGURA��O
// ============================================

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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
// LOG DE REQUISI��ES
// ============================================

app.use((req, res, next) => {

    console.log(
        `[${new Date().toISOString()}] ${req.method} ${req.url}`
    );

    next();
});


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

        const data =
            fs.readFileSync(
                NFE_FILE,
                'utf8'
            );

        const nfeList =
            JSON.parse(data);

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

        const companies =
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

        const companies =
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
                        'CNPJ j� cadastrado'

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

        const companies =
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
                    'Empresa n�o encontrada'

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

        const companies =
            getCompanies();

        const id =
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
                    'Empresa n�o encontrada'

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

app.use('/api/nfe', nfeRoutes);


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
// TRATAMENTO DE ROTA N�O ENCONTRADA
// ============================================

app.use(
    (req, res) => {

        res.status(404).json({

            success: false,

            error:
                'Rota n�o encontrada.',

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
app.listen(
    PORT,
    '0.0.0.0',
    () => {

        console.log('');
        console.log(
            '============================================'
        );
        console.log(
            ' ?? ERP METAL RACING - SERVIDOR'
        );
        console.log(
            '============================================'
        );
        console.log(
            ` ?? Servidor: http://localhost:${PORT}`
        );
        console.log(
            ` ?? Dados: ${DATA_DIR}`
        );
        console.log(
            ` ?? Empresas: ${getCompanies().length}`
        );
        console.log(
            ` ?? NF-e armazenadas: ${getNFe().length}`
        );
        console.log(
            ` ?? CERT_SENHA: ${
                process.env.CERT_SENHA
                    ? 'CONFIGURADA'
                    : 'N�O CONFIGURADA'
            }`
        );
        console.log(
            ` ?? Ambiente padr�o: ${
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
