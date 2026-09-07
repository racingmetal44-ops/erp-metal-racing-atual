// src/backend/services/certificado/CertificateService.js

import forge from 'node-forge';
import fs from 'fs-extra';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

export class CertificateService {

    constructor() {

        this.certsPath =
            path.join(
                process.cwd(),
                'certificados'
            );

        if (!process.env.VERCEL) {
fs.ensureDirSync(
            this.certsPath
        );

}
    }


    // ============================================
    // UPLOAD DO CERTIFICADO
    // ============================================

    async upload(
        file,
        senha,
        empresaId
    ) {

        let tempPath = null;

        try {

            tempPath =
                path.join(
                    this.certsPath,
                    `${uuidv4()}.pfx`
                );

            await fs.writeFile(
                tempPath,
                file.buffer
            );

            const info =
                await this.extractCertificateInfo(
                    tempPath,
                    senha
                );

            const finalPath =
                path.join(
                    this.certsPath,
                    `empresa_${empresaId}.pfx`
                );

            await fs.move(
                tempPath,
                finalPath,
                {
                    overwrite: true
                }
            );

            tempPath = null;

            return {
                ...info,
                id: String(empresaId)
            };

        } catch (error) {

            if (tempPath) {
                await fs.remove(
                    tempPath
                ).catch(() => {});
            }

            throw new Error(
                `Erro ao processar certificado: ${error.message}`
            );
        }
    }


    // ============================================
    // EXTRAIR INFORMAÇÕES DO CERTIFICADO
    // ============================================

    async extractCertificateInfo(
        filePath,
        senha
    ) {

        try {

            const pfxBuffer =
                await fs.readFile(
                    filePath
                );

            const pfx =
                forge.util.createBuffer(
                    pfxBuffer.toString('binary')
                );

            const p12Asn1 =
                forge.asn1.fromDer(
                    pfx.getBytes()
                );

            const p12 =
                forge.pkcs12.pkcs12FromAsn1(
                    p12Asn1,
                    false,
                    senha
                );

            const bags =
                p12.getBags({
                    bagType:
                        forge.pki.oids.certBag
                });

            const certBags =
                bags[
                    forge.pki.oids.certBag
                ];

            if (
                !certBags ||
                !certBags.length ||
                !certBags[0].cert
            ) {
                throw new Error(
                    'Nenhum certificado encontrado dentro do arquivo PFX'
                );
            }

            const cert =
                certBags[0].cert;


            // ========================================
            // SUBJECT
            // ========================================

            const subject =
                cert.subject?.attributes || [];

            const issuer =
                cert.issuer?.attributes || [];


            // ========================================
            // HELPERS
            // ========================================

            const getAttribute =
                (attributes, names) => {

                    const attr =
                        attributes.find(
                            item =>
                                names.includes(
                                    item.name
                                ) ||
                                names.includes(
                                    item.shortName
                                )
                        );

                    return attr?.value
                        ? String(attr.value)
                        : '';
                };


            // ========================================
            // NOME / CN
            // ========================================

            const commonName =
                getAttribute(
                    subject,
                    [
                        'commonName',
                        'CN'
                    ]
                );


            // ========================================
            // CNPJ
            //
            // Certificado A1:
            //
            // ART GRAV COMUNICACAO INDUSTRIAL LTDA:
            // 13862162000180
            // ========================================

            let cnpj = '';


            // Primeiro tenta encontrar no CN

            const cnCnpjMatch =
                commonName.match(
                    /\d{14}/
                );

            if (cnCnpjMatch) {

                cnpj =
                    cnCnpjMatch[0];

            }


            // Se não encontrou no CN,
            // procura nas OU

            if (!cnpj) {

                for (
                    const attr
                    of subject
                ) {

                    const value =
                        String(
                            attr.value || ''
                        );

                    const match =
                        value.match(
                            /\b\d{14}\b/
                        );

                    if (match) {

                        cnpj =
                            match[0];

                        break;
                    }
                }
            }


            // ========================================
            // FORMATAR CNPJ
            // ========================================

            const formatCnpj =
                value => {

                    const digits =
                        String(
                            value || ''
                        ).replace(
                            /\D/g,
                            ''
                        );

                    if (
                        digits.length !== 14
                    ) {
                        return '';
                    }

                    return (
                        digits.slice(0, 2) +
                        '.' +
                        digits.slice(2, 5) +
                        '.' +
                        digits.slice(5, 8) +
                        '/' +
                        digits.slice(8, 12) +
                        '-' +
                        digits.slice(12, 14)
                    );
                };


            const cnpjFormatado =
                formatCnpj(cnpj);


            // ========================================
            // EMISSOR
            // ========================================

            const emissor =
                getAttribute(
                    issuer,
                    [
                        'commonName',
                        'CN'
                    ]
                );


            // ========================================
            // VALIDADE
            // ========================================

            const agora =
                new Date();

            const valido =
                agora >=
                    cert.validity.notBefore &&
                agora <=
                    cert.validity.notAfter;


            const status =
                valido
                    ? 'VALIDO'
                    : 'EXPIRADO';


            // ========================================
            // RESULTADO
            // ========================================

            return {

                nome:
                    commonName || 'N/A',

                cnpj:
                    cnpjFormatado || 'N/A',

                cnpjNumerico:
                    cnpj || 'N/A',

                emissor:
                    emissor || 'N/A',

                validadeInicial:
                    cert.validity.notBefore,

                validadeFinal:
                    cert.validity.notAfter,

                numeroSerie:
                    cert.serialNumber,

                status,

                valido

            };

        } catch (error) {

            const message =
                String(
                    error.message || ''
                );

            if (
                message.toLowerCase().includes(
                    'password'
                ) ||
                message.includes(
                    'MAC could not be verified'
                ) ||
                message.includes(
                    'Invalid password'
                )
            ) {

                throw new Error(
                    'Senha do certificado inválida'
                );
            }

            throw error;
        }
    }


    // ============================================
    // TESTAR CERTIFICADO
    // ============================================

    async testCertificate(
        file,
        senha
    ) {

        let tempPath = null;

        try {

            tempPath =
                path.join(
                    this.certsPath,
                    `${uuidv4()}.pfx`
                );

            await fs.writeFile(
                tempPath,
                file.buffer
            );

            const info =
                await this.extractCertificateInfo(
                    tempPath,
                    senha
                );

            await fs.remove(
                tempPath
            );

            tempPath = null;

            return {

                valid:
                    info.valido === true,

                message:
                    info.valido
                        ? 'Certificado válido'
                        : 'Certificado expirado',

                data:
                    info

            };

        } catch (error) {

            if (tempPath) {
                await fs.remove(
                    tempPath
                ).catch(() => {});
            }

            return {

                valid: false,

                message:
                    error.message ||
                    'Erro ao testar certificado'

            };
        }
    }


    // ============================================
    // OBTER CERTIFICADO DA EMPRESA
    // ============================================

    async getCertificateInfo(
        empresaId
    ) {

        try {

            const certificatePath =
                path.join(
                    this.certsPath,
                    `empresa_${empresaId}.pfx`
                );


            // ========================================
            // NÃO EXISTE
            // ========================================

            if (
                !(await fs.pathExists(
                    certificatePath
                ))
            ) {

                return {

                    exists: false,

                    valid: false,

                    empresaId:
                        String(empresaId),

                    message:
                        'Certificado não encontrado'

                };
            }


            // ========================================
            // SENHA
            // ========================================

            const senha =
                process.env.NFE_CERT_SENHA ||
                process.env.CERT_SENHA;


            if (!senha) {

                return {

                    exists: true,

                    valid: false,

                    empresaId:
                        String(empresaId),

                    message:
                        'Senha do certificado não configurada'

                };
            }


            // ========================================
            // LER CERTIFICADO
            // ========================================

            const info =
                await this.extractCertificateInfo(
                    certificatePath,
                    senha
                );


            return {

                exists: true,

                valid:
                    info.valido === true,

                empresaId:
                    String(empresaId),

                ...info

            };

        } catch (error) {

            return {

                exists: true,

                valid: false,

                empresaId:
                    String(empresaId),

                error:
                    error.message ||
                    'Erro ao ler certificado'

            };
        }
    }
}