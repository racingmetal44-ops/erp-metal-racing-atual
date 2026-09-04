import fs from 'fs';
import path from 'path';

const CODIGOS_UF = {
    AC: 12,
    AL: 27,
    AP: 16,
    AM: 13,
    BA: 29,
    CE: 23,
    DF: 53,
    ES: 32,
    GO: 52,
    MA: 21,
    MT: 51,
    MS: 50,
    MG: 31,
    PA: 15,
    PB: 25,
    PR: 41,
    PE: 26,
    PI: 22,
    RJ: 33,
    RN: 24,
    RS: 43,
    RO: 11,
    RR: 14,
    SC: 42,
    SP: 35,
    SE: 28,
    TO: 17
};

export function loadEmpresas() {
    const filePath =
        path.resolve(
            process.cwd(),
            'data',
            'empresas.json'
        );

    let content =
        fs.readFileSync(
            filePath,
            'utf8'
        );

    if (
        content.charCodeAt(0) === 0xFEFF
    ) {
        content =
            content.slice(1);
    }

    return JSON.parse(content);
}

export function getEmpresaConfig(
    empresaId = 1
) {
    const empresasData =
        loadEmpresas();

    const lista =
        Array.isArray(empresasData)
            ? empresasData
            : empresasData.empresas;

    const empresa =
        lista.find(
            e =>
                String(e.id) ===
                String(empresaId)
        );

    if (!empresa) {
        throw new Error(
            `Empresa ${empresaId} nao encontrada`
        );
    }

    if (empresa.certificado?.path) {
        empresa.certificado.absolutePath =
            path.resolve(
                process.cwd(),
                empresa.certificado.path
            );
    }

    return empresa;
}

export function normalizarAmbiente(
    ambiente
) {
    const valor =
        String(ambiente ?? '')
            .trim()
            .toLowerCase();

    if (
        valor === '2' ||
        valor === 'homologacao' ||
        valor === 'homologacao' ||
        valor === 'homolog'
    ) {
        return 'homologacao';
    }

    if (
        valor === '1' ||
        valor === 'producao' ||
        valor === 'producao' ||
        valor === 'prod'
    ) {
        return 'producao';
    }

    return 'homologacao';
}

export function getTpAmb(
    ambiente
) {
    return normalizarAmbiente(
        ambiente
    ) === 'homologacao'
        ? 2
        : 1;
}

export function getCodigoUF(
    uf
) {
    const sigla =
        String(uf ?? '')
            .trim()
            .toUpperCase();

    const codigo =
        CODIGOS_UF[sigla];

    if (!codigo) {
        throw new Error(
            `UF invalida ou nao configurada: ${sigla}`
        );
    }

    return codigo;
}

export function getSefazServiceUrl(
    uf,
    ambiente,
    servico
) {
    const sigla =
        String(uf ?? '')
            .trim()
            .toUpperCase();

    const amb =
        normalizarAmbiente(
            ambiente
        );

    const urls = {
        SC: {
            homologacao: {
                NFeDistribuicaoDFe:
                    'https://hom1.nfe.fazenda.gov.br/NFeDistribuicaoDFe/NFeDistribuicaoDFe.asmx',

                RecepcaoEvento:
                    'https://nfe-homologacao.svrs.rs.gov.br/ws/recepcaoevento/recepcaoevento4.asmx'
            },

            producao: {
                NFeDistribuicaoDFe:
                    'https://www1.nfe.fazenda.gov.br/NFeDistribuicaoDFe/NFeDistribuicaoDFe.asmx',

                RecepcaoEvento:
                    'https://nfe.svrs.rs.gov.br/ws/recepcaoevento/recepcaoevento4.asmx'
            }
        }
    };

    const url =
        urls?.[sigla]?.[amb]?.[servico];

    if (!url) {
        throw new Error(
            `Web Service nao configurado para UF=${sigla}, ambiente=${amb}, servico=${servico}`
        );
    }

    return url;
}

