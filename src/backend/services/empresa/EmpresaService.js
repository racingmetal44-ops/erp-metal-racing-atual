import fs from 'fs-extra';
import path from 'path';

const PROJECT_ROOT = process.cwd();
const EMPRESAS_PATH = path.join(PROJECT_ROOT, 'data', 'empresas.json');
const COMPANIES_PATH = path.join(PROJECT_ROOT, 'data', 'companies.json');

function somenteNumeros(valor) {
    return String(valor ?? '').replace(/\D/g, '');
}

function lerJsonSemBom(filePath) {
    const raw = fs.readFileSync(filePath, 'utf8').replace(/^\uFEFF/, '');
    return JSON.parse(raw);
}

function carregarListaEmpresas() {
    if (fs.existsSync(EMPRESAS_PATH)) {
        const dados = lerJsonSemBom(EMPRESAS_PATH);

        if (Array.isArray(dados)) {
            return dados;
        }

        if (Array.isArray(dados?.empresas)) {
            return dados.empresas;
        }

        return [];
    }

    if (fs.existsSync(COMPANIES_PATH)) {
        const dados = lerJsonSemBom(COMPANIES_PATH);
        return Array.isArray(dados) ? dados : [dados];
    }

    return [];
}

function responsavelTecnicoPadrao() {
    const cnpj = somenteNumeros(process.env.NFE_RESP_TEC_CNPJ || '');
    const xContato = process.env.NFE_RESP_TEC_CONTATO || '';
    const email = process.env.NFE_RESP_TEC_EMAIL || '';
    const fone = somenteNumeros(process.env.NFE_RESP_TEC_FONE || '');

    if (!cnpj || !xContato || !email || !fone) {
        return null;
    }

    return {
        cnpj,
        xContato,
        email,
        fone,
        idCsrt: process.env.NFE_RESP_TEC_ID_CSRT || '',
        csrt: process.env.NFE_RESP_TEC_CSRT || ''
    };
}

export function normalizarEmpresa(empresa = {}) {
    const uf = String(empresa.uf || process.env.EMPRESA_UF || 'SC').toUpperCase();
    const ufCodigo = empresa.ufCodigo || empresa.uf_codigo || (
        uf === 'SC' ? '42' : ''
    );

    const responsavelTecnico =
        empresa.responsavelTecnico ||
        empresa.responsavel_tecnico ||
        responsavelTecnicoPadrao();

    return {
        ...empresa,
        id: String(empresa.id ?? ''),
        razaoSocial:
            empresa.razaoSocial ||
            empresa.razao_social ||
            empresa.nome ||
            '',
        nomeFantasia:
            empresa.nomeFantasia ||
            empresa.nome_fantasia ||
            '',
        cnpj: empresa.cnpj || '',
        inscricaoEstadual:
            empresa.inscricaoEstadual ||
            empresa.inscricao_estadual ||
            empresa.ie ||
            '',
        ie:
            empresa.ie ||
            empresa.inscricaoEstadual ||
            empresa.inscricao_estadual ||
            '',
        codigoIbge:
            empresa.codigoIbge ||
            empresa.codigo_ibge ||
            '',
        regimeTributario:
            empresa.regimeTributario ||
            empresa.regime_tributario ||
            '',
        crt: String(
            empresa.crt ||
            (
                empresa.regime_tributario === 'Simples Nacional' ||
                empresa.regimeTributario === 'Simples Nacional'
                    ? '1'
                    : empresa.crt
            ) ||
            process.env.EMPRESA_CRT ||
            '1'
        ),
        uf,
        ufCodigo,
        ambiente:
            empresa.ambiente ||
            process.env.NFE_AMBIENTE ||
            'homologacao',
        naturezaOperacao:
            empresa.naturezaOperacao ||
            empresa.natureza_operacao ||
            'VENDA DE MERCADORIA',
        certificadoPath:
            empresa.certificadoPath ||
            empresa.certificado_path ||
            process.env.NFE_CERTIFICADO ||
            process.env.CERT_PATH ||
            `./certificados/empresa_${empresa.id}.pfx`,
        responsavelTecnico,
        nfe: {
            versao:
                empresa.nfe?.versao ||
                '4.00',

            ambiente:
                empresa.nfe?.ambiente ??
                2,

            series:
                empresa.nfe?.series || {
                    '1': {
                        ultimoNumero: 0
                    },
                    '2': {
                        ultimoNumero: 0
                    }
                }
        }
    };
}

const numerosNFeVercel = new Map();

export function reservarNumeroNFe(empresaId, serie = 1) {
    if (process.env.VERCEL) {
        const serieKey = somenteNumeros(serie) || '1';
        const chave = `${empresaId}:${serieKey}`;

        const ultimoNumero =
            numerosNFeVercel.get(chave) ??
            Number(
                process.env.NFE_NUMERO_INICIAL ||
                (serieKey === '1' ? 18144 : 0)
            );

        const proximoNumero = ultimoNumero + 1;

        numerosNFeVercel.set(chave, proximoNumero);

        return String(proximoNumero);
    }

    const dados = lerJsonSemBom(EMPRESAS_PATH);

    const lista = Array.isArray(dados)
        ? dados
        : dados.empresas;

    if (!Array.isArray(lista)) {
        throw new Error('Estrutura de empresas.json inv√°lida.');
    }

    const empresa = lista.find(
        item => String(item.id) === String(empresaId)
    );

    if (!empresa) {
        throw new Error(
            `Empresa ${empresaId} n√£o encontrada.`
        );
    }

    const serieKey =
        somenteNumeros(serie) || '1';

    if (!empresa.nfe || typeof empresa.nfe !== 'object') {
        empresa.nfe = {
            versao: '4.00',
            ambiente: 2,
            series: {}
        };
    }

    if (
        !empresa.nfe.series ||
        typeof empresa.nfe.series !== 'object'
    ) {
        empresa.nfe.series = {};
    }

    if (
        !empresa.nfe.series[serieKey] ||
        typeof empresa.nfe.series[serieKey] !== 'object'
    ) {
        empresa.nfe.series[serieKey] = {
            ultimoNumero: 0
        };
    }

    const ultimoNumero =
        Number(
            empresa.nfe.series[serieKey].ultimoNumero
        );

    if (
        !Number.isInteger(ultimoNumero) ||
        ultimoNumero < 0
    ) {
        throw new Error(
            `√öltimo n√∫mero inv√°lido para a s√©rie ${serieKey}.`
        );
    }

    const proximoNumero =
        ultimoNumero + 1;

    empresa.nfe.series[serieKey].ultimoNumero =
        proximoNumero;

    const novoConteudo =
        Array.isArray(dados)
            ? JSON.stringify(lista, null, 4)
            : JSON.stringify(
                {
                    ...dados,
                    empresas: lista
                },
                null,
                4
            );

    fs.writeFileSync(
        EMPRESAS_PATH,
        novoConteudo,
        'utf8'
    );

    return String(proximoNumero);
}
export function resolverCaminhoCertificado(empresa) {
    const relativo =
        empresa.certificadoPath ||
        `./certificados/empresa_${empresa.id}.pfx`;

    if (path.isAbsolute(relativo)) {
        return relativo;
    }

    return path.resolve(PROJECT_ROOT, relativo.replace(/^\.\//, ''));
}

export function buscarEmpresa(empresaId) {
    if (process.env.VERCEL) {
        const idSolicitado = String(empresaId);

        const empresa = normalizarEmpresa({
            id: process.env.NFE_EMPRESA_ID || idSolicitado,
            razaoSocial:
                process.env.NFE_RAZAO_SOCIAL ||
                'ART GRAV COMUNICA«√O INDUSTRIAL LTDA',
            nomeFantasia:
                process.env.NFE_NOME_FANTASIA ||
                'METAL RACING ACESS”RIOS AUTOMOTIVO',
            cnpj: process.env.NFE_CNPJ || '',
            ie: process.env.NFE_IE || '',
            inscricaoEstadual: process.env.NFE_IE || '',
            uf: process.env.NFE_UF || 'SC',
            ufCodigo: process.env.NFE_CUF || '42',
            codigoIbge:
                process.env.NFE_CODIGO_IBGE ||
                '4209102',
            crt:
                process.env.NFE_CRT ||
                '1',
            regimeTributario:
                process.env.NFE_REGIME_TRIBUTARIO ||
                'Simples Nacional',
            endereco:
                process.env.NFE_ENDERECO ||
                'Rua TeresÛpolis',
            numero:
                process.env.NFE_NUMERO ||
                '1180',
            bairro:
                process.env.NFE_BAIRRO ||
                'Guanabara',
            cidade:
                process.env.NFE_CIDADE ||
                'Joinville',
            cep:
                process.env.NFE_CEP ||
                '89207500',
            telefone:
                process.env.NFE_TELEFONE ||
                '4734336664',
            email:
                process.env.NFE_EMAIL ||
                '',
            nfe: {
                versao: '4.00',
                ambiente: 2,
                series: {
                    '1': {
                        ultimoNumero: 18144
                    }
                }
            }
        });

        return String(empresa.id) === idSolicitado
            ? empresa
            : null;
    }

    const lista = carregarListaEmpresas();

    const empresa = lista.find(
        item => String(item.id) === String(empresaId)
    );

    if (!empresa) {
        return null;
    }

    return normalizarEmpresa(empresa);
}

export function listarEmpresas() {
    return carregarListaEmpresas().map(normalizarEmpresa);
}

export default {
    buscarEmpresa,
    reservarNumeroNFe,
    listarEmpresas,
    normalizarEmpresa,
    resolverCaminhoCertificado
};


