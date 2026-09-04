// src/backend/services/certificado/CertificateLoader.js
// =========================================================
// CAMADA ÚNICA DE CARREGAMENTO DO CERTIFICADO A1
// ---------------------------------------------------------
// - Localiza o PFX da empresa
// - Valida senha e validade
// - Extrai certificado e chave privada
// - Preserva certificados adicionais existentes no PFX
// - Fornece cadeia CA separadamente para validação TLS
// - Nunca registra senha, chave privada ou conteúdo do PFX
// =========================================================

import fs from 'fs-extra';
import path from 'path';
import https from 'https';
import forge from 'node-forge';

const CERTS_DIR = path.join(process.cwd(), 'certificados');

// =========================================================
// CAs locais disponíveis
// =========================================================

const CA_FILES = [
    'sefaz-ca-bundle.pem',
    'ICP-Brasilv10.pem',
    'icp-brasil-v10.pem',
    'serpro-sslv1.pem',
    'an-chain-1.pem',
    'an-chain-2.pem',
    'an-chain-3.pem'
];

// =========================================================
// SENHA DO PFX
// =========================================================

function obterSenha() {
    const senha =
        process.env.NFE_CERT_SENHA ||
        process.env.CERT_SENHA ||
        process.env.CERTIFICADO_SENHA ||
        process.env.PFX_SENHA ||
        '';

    if (!senha) {
        throw new Error(
            'Senha do certificado A1 não configurada. ' +
            'Defina NFE_CERT_SENHA ou CERT_SENHA no arquivo .env.'
        );
    }

    return senha;
}

// =========================================================
// LOCALIZAR PFX
// =========================================================

export async function localizarPfx(empresaId) {
    const candidatos = [];

    if (
        empresaId !== undefined &&
        empresaId !== null &&
        String(empresaId).trim() !== ''
    ) {
        candidatos.push(
            path.join(
                CERTS_DIR,
                `empresa_${String(empresaId).trim()}.pfx`
            )
        );
    }

    if (process.env.NFE_CERTIFICADO) {
        candidatos.push(
            path.resolve(process.env.NFE_CERTIFICADO)
        );
    }

    if (process.env.CERT_PATH) {
        candidatos.push(
            path.resolve(process.env.CERT_PATH)
        );
    }

    const candidatosUnicos = [
        ...new Set(candidatos)
    ];

    for (const caminho of candidatosUnicos) {
        if (await fs.pathExists(caminho)) {
            return caminho;
        }
    }

    throw new Error(
        'Certificado A1 não encontrado. Procurados:\n' +
        candidatosUnicos.join('\n')
    );
}

// =========================================================
// CARREGAR CERTIFICADO
// =========================================================

export async function carregarCertificado(empresaId) {
    const senha = obterSenha();

    let certPath = null;
    let pfxBuffer;

    if (process.env.NFE_CERT_PFX_BASE64) {
        try {
            pfxBuffer = Buffer.from(
                process.env.NFE_CERT_PFX_BASE64,
                'base64'
            );

            if (!pfxBuffer.length) {
                throw new Error('NFE_CERT_PFX_BASE64 está vazia.');
            }

            certPath = '[NFE_CERT_PFX_BASE64]';
        } catch (error) {
            throw new Error(
                'Certificado A1 em Base64 inválido: ' + error.message
            );
        }
    } else {
        certPath = await localizarPfx(empresaId);
        pfxBuffer = await fs.readFile(certPath);
    }
    // -----------------------------------------------------
    // Abrir PFX
    // -----------------------------------------------------

    let p12;

    try {
        const der =
            forge.util.createBuffer(
                pfxBuffer.toString('binary')
            );

        const asn1 =
            forge.asn1.fromDer(der);

        p12 =
            forge.pkcs12.pkcs12FromAsn1(
                asn1,
                false,
                senha
            );

    } catch (error) {
        const msg =
            String(error?.message || '');

        const lower =
            msg.toLowerCase();

        if (
            msg.includes('MAC') ||
            lower.includes('password') ||
            lower.includes('invalid') ||
            lower.includes('decrypt')
        ) {
            throw new Error(
                'Senha do certificado A1 inválida. ' +
                'Verifique NFE_CERT_SENHA/CERT_SENHA no .env.'
            );
        }

        throw new Error(
            `PFX inválido ou corrompido: ${msg}`
        );
    }

    // -----------------------------------------------------
    // Extrair certificados e chave privada
    // -----------------------------------------------------

    const certs = [];
    let privateKey = null;

    for (const safeContents of p12.safeContents || []) {

        for (const safeBag of safeContents.safeBags || []) {

            if (
                safeBag.type === forge.pki.oids.certBag &&
                safeBag.cert
            ) {
                certs.push(
                    safeBag.cert
                );
            }

            if (
                (
                    safeBag.type ===
                        forge.pki.oids.pkcs8ShroudedKeyBag ||
                    safeBag.type ===
                        forge.pki.oids.keyBag
                ) &&
                safeBag.key
            ) {
                privateKey =
                    safeBag.key;
            }
        }
    }

    if (certs.length === 0) {
        throw new Error(
            'Nenhum certificado X.509 encontrado dentro do PFX.'
        );
    }

    if (!privateKey) {
        throw new Error(
            'Nenhuma chave privada encontrada dentro do PFX.'
        );
    }

    // -----------------------------------------------------
    // Identificar certificado principal
    // -----------------------------------------------------
    // Preferimos o certificado cujo subject possui CN.
    // Caso contrário, utilizamos o primeiro.
    // -----------------------------------------------------

    const certPrincipal =
        certs.find(cert => {

            try {
                const cn =
                    cert.subject
                        ?.getField('CN')
                        ?.value || '';

                return Boolean(
                    String(cn).trim()
                );

            } catch {
                return false;
            }

        }) || certs[0];

    // -----------------------------------------------------
    // PEM do certificado principal
    // -----------------------------------------------------

    const certPem =
        forge.pki.certificateToPem(
            certPrincipal
        );

    // -----------------------------------------------------
    // Certificados adicionais existentes no PFX
    // -----------------------------------------------------

    const certificadosAdicionais =
        certs
            .filter(cert => cert !== certPrincipal)
            .map(cert =>
                forge.pki.certificateToPem(cert)
            )
            .filter(Boolean);

    const clientCertificateChain =
        certificadosAdicionais.length > 0
            ? certificadosAdicionais.join('\n')
            : '';

    // -----------------------------------------------------
    // Chave privada PEM
    // -----------------------------------------------------

    const keyPem =
        forge.pki.privateKeyToPem(
            privateKey
        );

    // -----------------------------------------------------
    // VALIDADE
    // -----------------------------------------------------

    const agora = new Date();

    if (
        agora <
        certPrincipal.validity.notBefore
    ) {
        throw new Error(
            'Certificado ainda não é válido. ' +
            `Válido a partir de ` +
            `${certPrincipal.validity.notBefore.toISOString()}.`
        );
    }

    if (
        agora >
        certPrincipal.validity.notAfter
    ) {
        throw new Error(
            'Certificado A1 EXPIRADO em ' +
            `${certPrincipal.validity.notAfter.toISOString()}. ` +
            'Renove o certificado.'
        );
    }

    // -----------------------------------------------------
    // CA LOCAL
    // -----------------------------------------------------

    const ca = [];

    for (const arquivo of CA_FILES) {

        const caminho =
            path.join(
                CERTS_DIR,
                arquivo
            );

        if (
            await fs.pathExists(caminho)
        ) {
            ca.push(
                await fs.readFile(
                    caminho
                )
            );
        }
    }

    // -----------------------------------------------------
    // INFORMAÇÕES SEGURAS
    // -----------------------------------------------------

    const subjectCN =
        (
            certPrincipal.subject
                ?.getField('CN') || {}
        ).value || '';

    const issuerCN =
        (
            certPrincipal.issuer
                ?.getField('CN') || {}
        ).value || '';

    const diasRestantes =
        Math.floor(
            (
                certPrincipal.validity.notAfter -
                agora
            ) /
            (
                24 * 60 * 60 * 1000
            )
        );

    const info = {
        nome: subjectCN,
        emissor: issuerCN,
        validade:
            certPrincipal.validity.notAfter.toISOString(),
        validoDesde:
            certPrincipal.validity.notBefore.toISOString(),
        diasRestantes,
        quantidadeCertificadosPfx:
            certs.length,
        quantidadeCAsLocais:
            ca.length
    };

    // -----------------------------------------------------
    // RETORNO
    // -----------------------------------------------------

    return {
        // Certificado principal do titular
        cert: certPem,

        // Chave privada
        key: keyPem,

        // CAs locais para validação do servidor
        ca:
            ca.length > 0
                ? ca
                : undefined,

        // Certificados adicionais encontrados no PFX
        clientCertificateChain:
            clientCertificateChain || undefined,

        // PFX original em memória
        pfx: pfxBuffer,

        // Senha em memória para quem realmente precisar
        passphrase: senha,

        // Caminho do certificado
        certPath,

        // Metadados seguros
        info
    };
}

// =========================================================
// CRIAR HTTPS AGENT
// =========================================================

export async function criarHttpsAgent(
    empresaId
) {
    const certificado =
        await carregarCertificado(
            empresaId
        );

    // -----------------------------------------------------
    // Enviar certificado principal + certificados adicionais
    // do PFX, quando existirem.
    // -----------------------------------------------------

    const certCliente =
        certificado.clientCertificateChain
            ? `${certificado.cert}\n${certificado.clientCertificateChain}`
            : certificado.cert;

    return new https.Agent({

        cert:
            certCliente,

        key:
            certificado.key,

        // IMPORTANTE:
        // As CAs locais são usadas para validar o servidor.
        ca:
            certificado.ca,

        rejectUnauthorized:
            true,

        minVersion:
            'TLSv1.2',

        keepAlive:
            false
    });
}

// =========================================================
// VALIDAR CERTIFICADO
// =========================================================

export async function validarCertificado(
    empresaId
) {
    try {

        const certificado =
            await carregarCertificado(
                empresaId
            );

        return {

            valido: true,

            existe: true,

            certPath:
                certificado.certPath,

            ...certificado.info
        };

    } catch (error) {

        return {

            valido: false,

            existe:
                await fs.pathExists(
                    path.join(
                        CERTS_DIR,
                        `empresa_${String(
                            empresaId || ''
                        )}.pfx`
                    )
                ),

            erro:
                error.message
        };
    }
}

// =========================================================
// EXPORT DEFAULT
// =========================================================

export default {
    localizarPfx,
    carregarCertificado,
    criarHttpsAgent,
    validarCertificado
};