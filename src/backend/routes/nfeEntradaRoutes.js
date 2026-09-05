import express from 'express';
import fs from 'fs-extra';
import path from 'path';
import multer from 'multer';
import { XMLParser } from 'fast-xml-parser';

// Serviços da integração SEFAZ / entrada
import NfeDistribuicaoService, {
    lerNsu
} from '../services/nfe/NfeDistribuicaoService.js';

import NfeManifestacaoService, {
    DESCRICOES_EVENTO
} from '../services/nfe/NfeManifestacaoService.js';

import {
    vincularFornecedor,
    verificarDuplicidade,
    identificarProduto,
    confirmarEntrada as confirmarEntradaTransacional,
    getEntradas as getEntradasService,
    saveEntradas as saveEntradasService
} from '../services/nfe/NfeEntradaService.js';

import { normalizarAmbiente } from '../config/sefaz.js';

const router = express.Router();

const DATA_DIR = path.join(process.cwd(), 'data');
const ENTRADAS_FILE = path.join(DATA_DIR, 'nfe-entradas.json');
const UPLOAD_DIR = path.join(DATA_DIR, 'xml-nfe-entrada');

if (!process.env.VERCEL) {
    fs.ensureDirSync(DATA_DIR);
    fs.ensureDirSync(UPLOAD_DIR);

    if (!fs.existsSync(ENTRADAS_FILE)) {
        fs.writeJsonSync(ENTRADAS_FILE, []);
    }
}

// =====================================================
// UTILITÁRIOS
// =====================================================

function getEntradas() {
    try {
        const dados = fs.readJsonSync(ENTRADAS_FILE);

        if (Array.isArray(dados)) {
            return dados;
        }

        if (dados && typeof dados === 'object') {
            return [dados];
        }

        return [];
    } catch {
        return [];
    }
}

function saveEntradas(lista) {
    fs.writeJsonSync(ENTRADAS_FILE, lista, {
        spaces: 2
    });
}

const uploadDirVercel = process.env.VERCEL ? '/tmp/xml-nfe-entrada' : UPLOAD_DIR;

const upload = multer({
    dest: uploadDirVercel,

    limits: {
        fileSize: 10 * 1024 * 1024
    },

    fileFilter: (req, file, cb) => {
        const nome = file.originalname.toLowerCase();

        if (
            nome.endsWith('.xml') ||
            file.mimetype.includes('xml')
        ) {
            cb(null, true);
        } else {
            cb(
                new Error(
                    'Somente arquivos XML de NF-e são permitidos.'
                )
            );
        }
    }
});

function texto(valor) {
    if (
        valor === undefined ||
        valor === null
    ) {
        return '';
    }

    return String(valor);
}

function numeroSeguro(valor) {
    const n = Number(valor);

    return Number.isFinite(n)
        ? n
        : 0;
}

function arredondar2(valor) {
    return Math.round(
        (Number(valor) + Number.EPSILON) * 100
    ) / 100;
}

function normalizarDocumento(valor) {
    return texto(valor).replace(/\D/g, '');
}

// =====================================================
// CHAVE NF-e
// =====================================================

function validarChaveNFe(chave) {

    if (!/^\d{44}$/.test(chave)) {
        throw new Error(
            `Chave de acesso inválida. A NF-e deve possuir 44 dígitos. Chave recebida: ${chave}`
        );
    }

    const base = chave.substring(0, 43);
    const informado = Number(
        chave.substring(43)
    );

    let soma = 0;
    let peso = 2;

    for (
        let i = base.length - 1;
        i >= 0;
        i--
    ) {
        soma +=
            Number(base[i]) * peso;

        peso =
            peso === 9
                ? 2
                : peso + 1;
    }

    const resto = soma % 11;

    const calculado =
        resto < 2
            ? 0
            : 11 - resto;

    if (calculado !== informado) {
        throw new Error(
            `Dígito verificador da chave inválido. Informado: ${informado}; calculado: ${calculado}.`
        );
    }

    return true;
}

// =====================================================
// VALIDAÇÕES XML
// =====================================================

function validarTextoXml(valor, campo) {

    const textoValor = texto(valor);

    if (
        textoValor.includes('?') ||
        textoValor.includes('ï¿½')
    ) {
        throw new Error(
            `Texto corrompido no XML no campo ${campo}: "${textoValor}"`
        );
    }

    return textoValor;
}

function validarProdutoXml(produto) {

    const quantidade =
        arredondar2(
            produto.quantidade
        );

    const unitario =
        arredondar2(
            produto.valorUnitario
        );

    const totalInformado =
        arredondar2(
            produto.valorTotal
        );

    const totalCalculado =
        arredondar2(
            quantidade * unitario
        );

    if (
        Math.abs(
            totalCalculado -
            totalInformado
        ) > 0.02
    ) {
        throw new Error(
            `Produto "${produto.descricao}" inconsistente: ` +
            `${quantidade} x R$ ${unitario.toFixed(2)} = ` +
            `R$ ${totalCalculado.toFixed(2)}, ` +
            `mas o XML informa R$ ${totalInformado.toFixed(2)}.`
        );
    }

    return true;
}

// =====================================================
// EMPRESA / CONFIGURAÇÃO FISCAL
// =====================================================

function obterEmpresa(empresaId) {

    const arquivoEmpresas =
        path.join(
            process.cwd(),
            'data',
            'companies.json'
        );

    if (!fs.existsSync(arquivoEmpresas)) {
        throw new Error(
            'Arquivo de empresas não encontrado.'
        );
    }

    const empresasRaw =
        fs.readJsonSync(
            arquivoEmpresas
        );

    const empresas =
        Array.isArray(empresasRaw)
            ? empresasRaw
            : (
                empresasRaw &&
                typeof empresasRaw === 'object'
                    ? [empresasRaw]
                    : []
            );

    const empresa =
        empresas.find(
            item =>
                String(item.id) ===
                String(empresaId)
        );

    if (!empresa) {
        throw new Error(
            `Empresa ${empresaId} não encontrada.`
        );
    }

    return empresa;
}

function obterConfigEmpresa(empresaId) {

    const empresa =
        obterEmpresa(empresaId);

    return {

        empresa,

        cnpj:
            String(
                empresa.cnpj || ''
            ).replace(/\D/g, ''),

        uf:
            String(
                empresa.uf ||
                process.env.NFE_UF ||
                'SC'
            ).toUpperCase(),

        ambiente:
            normalizarAmbiente(
                empresa.ambiente ??
                empresa.nfe?.ambiente ??
                process.env.NFE_AMBIENTE ??
                'homologacao'
            )
    };
}

// =====================================================
// VALIDAÇÃO DA NF-e
// =====================================================

function validarEntradaNFe(
    nfe,
    empresaId
) {

    validarChaveNFe(
        nfe.chave
    );

    const empresa =
        obterEmpresa(
            empresaId
        );

    const cnpjEmpresa =
        normalizarDocumento(
            empresa.cnpj
        );

    const cnpjDestinatario =
        normalizarDocumento(
            nfe.destinatario?.cnpj
        );

    if (!cnpjDestinatario) {
        throw new Error(
            'O XML não possui CNPJ do destinatário.'
        );
    }

    if (
        cnpjDestinatario !==
        cnpjEmpresa
    ) {
        throw new Error(
            `NF-e destinada ao CNPJ ${cnpjDestinatario}, ` +
            `mas a empresa selecionada possui CNPJ ${cnpjEmpresa}.`
        );
    }

    for (
        const produto of
        nfe.produtos
    ) {

        validarTextoXml(
            produto.descricao,
            `produto ${produto.item}`
        );

        validarProdutoXml(
            produto
        );
    }

    return true;
}

// =====================================================
// LOCALIZAR NF-e
// =====================================================

function localizarNFe(parsed) {

    return (
        parsed?.nfeProc?.NFe ||
        parsed?.NFe ||
        parsed?.['nfeProc']?.['NFe'] ||
        null
    );
}

// =====================================================
// EXTRAIR XML NF-e
// =====================================================

function extrairXmlNfe(xml) {

    const parser =
        new XMLParser({

            ignoreAttributes: false,

            attributeNamePrefix: '@_',

            removeNSPrefix: true,

            parseTagValue: true,

            trimValues: true
        });

    const parsed =
        parser.parse(xml);

    const nfe =
        localizarNFe(parsed);

    if (!nfe) {
        throw new Error(
            'XML não contém uma NF-e válida.'
        );
    }

    const infNFe =
        nfe.infNFe;

    if (!infNFe) {
        throw new Error(
            'Elemento infNFe não encontrado no XML.'
        );
    }

    const ide =
        infNFe.ide || {};

    const emit =
        infNFe.emit || {};

    const dest =
        infNFe.dest || {};

    const transp =
        infNFe.transp || {};

    const pag =
        infNFe.pag || {};

    const cobr =
        infNFe.cobr || {};

    const infAdic =
        infNFe.infAdic || {};

    const infIntermed =
        infNFe.infIntermed || {};

    const textoSeguro =
        valor => {

            if (
                valor === undefined ||
                valor === null
            ) {
                return '';
            }

            return String(valor);
        };

    const numeroSeguroLocal =
        valor => {

            const n =
                Number(valor);

            return Number.isFinite(n)
                ? n
                : 0;
        };

    const arraySeguro =
        valor => {

            if (
                valor === undefined ||
                valor === null
            ) {
                return [];
            }

            return Array.isArray(valor)
                ? valor
                : [valor];
        };

    const primeiroObjeto =
        valor => {

            if (
                valor &&
                typeof valor === 'object' &&
                !Array.isArray(valor)
            ) {
                return valor;
            }

            if (
                Array.isArray(valor)
            ) {
                return valor[0] || {};
            }

            return {};
        };

    // =================================================
    // TRIBUTOS
    // =================================================

    const extrairTributo =
        (imposto, grupo) => {

            const bloco =
                imposto?.[grupo];

            if (!bloco) {

                return {
                    grupo: null,
                    dados: {}
                };
            }

            const chaves =
                Object.keys(
                    bloco || {}
                );

            for (
                const chaveGrupo
                of chaves
            ) {

                if (
                    bloco[chaveGrupo] &&
                    typeof bloco[chaveGrupo] === 'object'
                ) {

                    return {
                        grupo: chaveGrupo,
                        dados: bloco[chaveGrupo]
                    };
                }
            }

            return {
                grupo,
                dados:
                    primeiroObjeto(
                        bloco
                    )
            };
        };

    const extrairImpostos =
        imposto => {

            const icms =
                extrairTributo(
                    imposto,
                    'ICMS'
                );

            const ipi =
                extrairTributo(
                    imposto,
                    'IPI'
                );

            const pis =
                extrairTributo(
                    imposto,
                    'PIS'
                );

            const cofins =
                extrairTributo(
                    imposto,
                    'COFINS'
                );

            const ii =
                extrairTributo(
                    imposto,
                    'II'
                );

            const issqn =
                extrairTributo(
                    imposto,
                    'ISSQN'
                );

            return {

                icms,
                ipi,
                pis,
                cofins,
                ii,
                issqn,

                resumo: {

                    icmsCst:
                        textoSeguro(
                            icms.dados.CST ||
                            icms.dados.CSOSN
                        ),

                    icmsBase:
                        numeroSeguroLocal(
                            icms.dados.vBC
                        ),

                    icmsAliquota:
                        numeroSeguroLocal(
                            icms.dados.pICMS
                        ),

                    icmsValor:
                        numeroSeguroLocal(
                            icms.dados.vICMS
                        ),

                    ipiCst:
                        textoSeguro(
                            ipi.dados.CST
                        ),

                    ipiValor:
                        numeroSeguroLocal(
                            ipi.dados.vIPI
                        ),

                    pisCst:
                        textoSeguro(
                            pis.dados.CST
                        ),

                    pisValor:
                        numeroSeguroLocal(
                            pis.dados.vPIS
                        ),

                    cofinsCst:
                        textoSeguro(
                            cofins.dados.CST
                        ),

                    cofinsValor:
                        numeroSeguroLocal(
                            cofins.dados.vCOFINS
                        )
                }
            };
        };

    // =================================================
    // CHAVE
    // =================================================

    let chave =
        textoSeguro(
            infNFe['@_Id']
        );

    if (
        chave.startsWith('NFe')
    ) {
        chave =
            chave.substring(3);
    }

    if (!chave) {

        const prot =
            primeiroObjeto(
                nfe.protNFe?.infProt
            );

        chave =
            textoSeguro(
                prot.chNFe
            );
    }

    // =================================================
    // PRODUTOS
    // =================================================

    const produtosRaw =
        infNFe.det || [];

    const detalhes =
        arraySeguro(
            produtosRaw
        );

    const produtos =
        detalhes.map(
            (det, index) => {

                const prod =
                    det?.prod || {};

                const imposto =
                    det?.imposto || {};

                const tributos =
                    extrairImpostos(
                        imposto
                    );

                const impostoDevol =
                    det?.impostoDevol ||
                    null;

                const rastro =
                    arraySeguro(
                        prod?.rastro
                    );

                return {

                    item:
                        numeroSeguro(
                            det?.['@_nItem']
                        ) ||
                        index + 1,

                    codigo:
                        textoSeguro(
                            prod.cProd
                        ),

                    descricao:
                        textoSeguro(
                            prod.xProd
                        ),

                    ean:
                        textoSeguro(
                            prod.cEAN
                        ),

                    eanTrib:
                        textoSeguro(
                            prod.cEANTrib
                        ),

                    ncm:
                        textoSeguro(
                            prod.NCM
                        ),

                    cest:
                        textoSeguro(
                            prod.CEST
                        ),

                    cfop:
                        textoSeguro(
                            prod.CFOP
                        ),

                    unidade:
                        textoSeguro(
                            prod.uCom
                        ),

                    unidadeTributada:
                        textoSeguro(
                            prod.uTrib
                        ),

                    quantidade:
                        numeroSeguro(
                            prod.qCom
                        ),

                    quantidadeTributada:
                        numeroSeguro(
                            prod.qTrib
                        ),

                    valorUnitario:
                        numeroSeguro(
                            prod.vUnCom
                        ),

                    valorUnitarioTributado:
                        numeroSeguro(
                            prod.vUnTrib
                        ),

                    valorTotal:
                        numeroSeguro(
                            prod.vProd
                        ),

                    frete:
                        numeroSeguro(
                            prod.vFrete
                        ),

                    seguro:
                        numeroSeguro(
                            prod.vSeg
                        ),

                    desconto:
                        numeroSeguro(
                            prod.vDesc
                        ),

                    outrasDespesas:
                        numeroSeguro(
                            prod.vOutro
                        ),

                    pedidoCompra:
                        textoSeguro(
                            prod.xPed
                        ),

                    itemPedidoCompra:
                        textoSeguro(
                            prod.nItemPed
                        ),

                    impostos:
                        tributos,

                    impostoDevolucao:
                        impostoDevol,

                    rastreabilidade:
                        rastro
                };
            }
        );

    // =================================================
    // TOTAIS
    // =================================================

    const total =
        infNFe.total?.ICMSTot || {};

    const totalISS =
        infNFe.total?.ISSQNtot || {};

    const totalRet =
        infNFe.total?.retTrib || {};

    // =================================================
    // DOCUMENTOS REFERENCIADOS
    // =================================================

    const documentoReferenciado =
        arraySeguro(
            ide.NFref
        ).map(
            ref => ({

                chave:
                    textoSeguro(
                        ref?.refNFe
                    ),

                nECF:
                    textoSeguro(
                        ref?.refECF
                    ),

                modelo:
                    textoSeguro(
                        ref?.refNF?.mod
                    ),

                numero:
                    textoSeguro(
                        ref?.refNF?.nNF
                    ),

                serie:
                    textoSeguro(
                        ref?.refNF?.serie
                    ),

                aAMM:
                    textoSeguro(
                        ref?.refNF?.AAMM
                    ),

                cUF:
                    textoSeguro(
                        ref?.refNF?.cUF
                    )
            })
        );

    // =================================================
    // PAGAMENTOS
    // =================================================

    const pagamentos =
        arraySeguro(
            pag.detPag
        ).map(
            item => ({

                indicadorPagamento:
                    textoSeguro(
                        item?.indPag
                    ),

                forma:
                    textoSeguro(
                        item?.tPag
                    ),

                descricaoForma:
                    textoSeguro(
                        item?.xPag
                    ),

                valor:
                    numeroSeguro(
                        item?.vPag
                    ),

                troco:
                    numeroSeguro(
                        pag.vTroco
                    ),

                bandeira:
                    textoSeguro(
                        item?.card?.tBand
                    ),

                cnpjCredenciadora:
                    textoSeguro(
                        item?.card?.CNPJ
                    ),

                autorizacao:
                    textoSeguro(
                        item?.card?.cAut
                    )
            })
        );

    // =================================================
    // DUPLICATAS
    // =================================================

    const duplicatas =
        arraySeguro(
            cobr.dup
        ).map(
            item => ({

                numero:
                    textoSeguro(
                        item?.nDup
                    ),

                vencimento:
                    textoSeguro(
                        item?.dVenc
                    ),

                valor:
                    numeroSeguro(
                        item?.vDup
                    )
            })
        );

    // =================================================
    // TRANSPORTE
    // =================================================

    const transportadora =
        transp.transporta || {};

    const volumes =
        arraySeguro(
            transp.vol
        ).map(
            vol => ({

                quantidade:
                    numeroSeguro(
                        vol?.qVol
                    ),

                especie:
                    textoSeguro(
                        vol?.esp
                    ),

                marca:
                    textoSeguro(
                        vol?.marca
                    ),

                numeracao:
                    textoSeguro(
                        vol?.nVol
                    ),

                pesoLiquido:
                    numeroSeguro(
                        vol?.pesoL
                    ),

                pesoBruto:
                    numeroSeguro(
                        vol?.pesoB
                    ),

                lacres:
                    arraySeguro(
                        vol?.lacres
                    )
            })
        );

    // =================================================
    // PROTOCOLO SEFAZ
    // =================================================

    const protNFe =
        primeiroObjeto(
            nfe.protNFe?.infProt
        );

    // =================================================
    // RETORNO
    // =================================================

    return {

        chave,

        numero:
            textoSeguro(
                ide.nNF
            ),

        serie:
            textoSeguro(
                ide.serie
            ),

        modelo:
            textoSeguro(
                ide.mod
            ),

        naturezaOperacao:
            textoSeguro(
                ide.natOp
            ),

        tipoOperacao:
            textoSeguro(
                ide.tpNF
            ),

        finalidade:
            textoSeguro(
                ide.finNFe
            ),

        indicadorPresenca:
            textoSeguro(
                ide.indPres
            ),

        indicadorIntermediador:
            textoSeguro(
                ide.indIntermed
            ),

        indicadorConsumidorFinal:
            textoSeguro(
                ide.indFinal
            ),

        tipoEmissao:
            textoSeguro(
                ide.tpEmis
            ),

        codigoMunicipio:
            textoSeguro(
                ide.cMunFG
            ),

        ambiente:
            textoSeguro(
                protNFe.tpAmb ||
                ide.tpAmb
            ),

        statusSefaz:
            textoSeguro(
                protNFe.cStat
            ),

        motivoSefaz:
            textoSeguro(
                protNFe.xMotivo
            ),

        protocoloSefaz:
            textoSeguro(
                protNFe.nProt
            ),

        dataEmissao:
            textoSeguro(
                ide.dhEmi ||
                ide.dEmi
            ),

        dataEntrada:
            textoSeguro(
                ide.dhSaiEnt ||
                ''
            ),

        // =================================================
        // FORNECEDOR
        // =================================================

        fornecedor: {

            cnpj:
                textoSeguro(
                    emit.CNPJ
                ),

            cpf:
                textoSeguro(
                    emit.CPF
                ),

            razaoSocial:
                textoSeguro(
                    emit.xNome
                ),

            nomeFantasia:
                textoSeguro(
                    emit.xFant
                ),

            ie:
                textoSeguro(
                    emit.IE
                ),

            ieST:
                textoSeguro(
                    emit.IEST
                ),

            im:
                textoSeguro(
                    emit.IM
                ),

            suframa:
                textoSeguro(
                    emit.ISUF
                ),

            regimeTributario:
                textoSeguro(
                    emit.CRT
                ),

            email:
                textoSeguro(
                    emit.email
                ),

            telefone:
                textoSeguro(
                    emit.enderEmit?.fone
                ),

            endereco: {

                logradouro:
                    textoSeguro(
                        emit.enderEmit?.xLgr
                    ),

                numero:
                    textoSeguro(
                        emit.enderEmit?.nro
                    ),

                complemento:
                    textoSeguro(
                        emit.enderEmit?.xCpl
                    ),

                bairro:
                    textoSeguro(
                        emit.enderEmit?.xBairro
                    ),

                cidade:
                    textoSeguro(
                        emit.enderEmit?.xMun
                    ),

                codigoMunicipio:
                    textoSeguro(
                        emit.enderEmit?.cMun
                    ),

                uf:
                    textoSeguro(
                        emit.enderEmit?.UF
                    ),

                cep:
                    textoSeguro(
                        emit.enderEmit?.CEP
                    ),

                pais:
                    textoSeguro(
                        emit.enderEmit?.xPais
                    ),

                codigoPais:
                    textoSeguro(
                        emit.enderEmit?.cPais
                    )
            }
        },

        // =================================================
        // DESTINATÁRIO
        // =================================================

        destinatario: {

            cnpj:
                textoSeguro(
                    dest.CNPJ
                ),

            cpf:
                textoSeguro(
                    dest.CPF
                ),

            razaoSocial:
                textoSeguro(
                    dest.xNome
                ),

            ie:
                textoSeguro(
                    dest.IE
                ),

            email:
                textoSeguro(
                    dest.email
                ),

            telefone:
                textoSeguro(
                    dest.enderDest?.fone
                ),

            tipoPessoa:
                dest.CNPJ
                    ? 'JURIDICA'
                    : dest.CPF
                        ? 'FISICA'
                        : '',

            indicadorIE:
                textoSeguro(
                    dest.indIEDest
                ),

            endereco: {

                logradouro:
                    textoSeguro(
                        dest.enderDest?.xLgr
                    ),

                numero:
                    textoSeguro(
                        dest.enderDest?.nro
                    ),

                complemento:
                    textoSeguro(
                        dest.enderDest?.xCpl
                    ),

                bairro:
                    textoSeguro(
                        dest.enderDest?.xBairro
                    ),

                cidade:
                    textoSeguro(
                        dest.enderDest?.xMun
                    ),

                codigoMunicipio:
                    textoSeguro(
                        dest.enderDest?.cMun
                    ),

                uf:
                    textoSeguro(
                        dest.enderDest?.UF
                    ),

                cep:
                    textoSeguro(
                        dest.enderDest?.CEP
                    ),

                pais:
                    textoSeguro(
                        dest.enderDest?.xPais
                    ),

                codigoPais:
                    textoSeguro(
                        dest.enderDest?.cPais
                    )
            }
        },

        documentoReferenciado,

        produtos,

        // =================================================
        // TOTAIS
        // =================================================

        totais: {

            produtos:
                numeroSeguro(
                    total.vProd
                ),

            frete:
                numeroSeguro(
                    total.vFrete
                ),

            seguro:
                numeroSeguro(
                    total.vSeg
                ),

            desconto:
                numeroSeguro(
                    total.vDesc
                ),

            outrasDespesas:
                numeroSeguro(
                    total.vOutro
                ),

            icmsBase:
                numeroSeguro(
                    total.vBC
                ),

            icms:
                numeroSeguro(
                    total.vICMS
                ),

            icmsDesonerado:
                numeroSeguro(
                    total.vICMSDeson
                ),

            icmsSTBase:
                numeroSeguro(
                    total.vBCST
                ),

            icmsST:
                numeroSeguro(
                    total.vST
                ),

            fcp:
                numeroSeguro(
                    total.vFCP
                ),

            fcpST:
                numeroSeguro(
                    total.vFCPST
                ),

            fcpSTRet:
                numeroSeguro(
                    total.vFCPSTRet
                ),

            ipi:
                numeroSeguro(
                    total.vIPI
                ),

            ipiDevolvido:
                numeroSeguro(
                    total.vIPIDevol
                ),

            pis:
                numeroSeguro(
                    total.vPIS
                ),

            cofins:
                numeroSeguro(
                    total.vCOFINS
                ),

            ii:
                numeroSeguro(
                    total.vII
                ),

            iss:
                numeroSeguro(
                    totalISS.vNF
                ),

            retPIS:
                numeroSeguro(
                    totalRet.vRetPIS
                ),

            retCOFINS:
                numeroSeguro(
                    totalRet.vRetCOFINS
                ),

            retCSLL:
                numeroSeguro(
                    totalRet.vRetCSLL
                ),

            retIRRF:
                numeroSeguro(
                    totalRet.vRetIRRF
                ),

            nota:
                numeroSeguro(
                    total.vNF
                )
        },

        // =================================================
        // TRANSPORTE
        // =================================================

        transporte: {

            modalidadeFrete:
                textoSeguro(
                    transp.modFrete
                ),

            transportador: {

                cnpj:
                    textoSeguro(
                        transportadora.CNPJ
                    ),

                cpf:
                    textoSeguro(
                        transportadora.CPF
                    ),

                nome:
                    textoSeguro(
                        transportadora.xNome
                    ),

                ie:
                    textoSeguro(
                        transportadora.IE
                    ),

                uf:
                    textoSeguro(
                        transportadora.UF
                    ),

                municipio:
                    textoSeguro(
                        transportadora.xMun
                    ),

                endereco:
                    textoSeguro(
                        transportadora.xEnder
                    )
            },

            veiculo: {

                placa:
                    textoSeguro(
                        transp.veicTransp?.placa
                    ),

                uf:
                    textoSeguro(
                        transp.veicTransp?.UF
                    ),

                rntc:
                    textoSeguro(
                        transp.veicTransp?.RNTC
                    )
            },

            volumes
        },

        // =================================================
        // ENTREGA
        // =================================================

        entrega: {

            logradouro:
                textoSeguro(
                    infNFe.entrega?.xLgr
                ),

            numero:
                textoSeguro(
                    infNFe.entrega?.nro
                ),

            complemento:
                textoSeguro(
                    infNFe.entrega?.xCpl
                ),

            bairro:
                textoSeguro(
                    infNFe.entrega?.xBairro
                ),

            codigoMunicipio:
                textoSeguro(
                    infNFe.entrega?.cMun
                ),

            cidade:
                textoSeguro(
                    infNFe.entrega?.xMun
                ),

            uf:
                textoSeguro(
                    infNFe.entrega?.UF
                ),

            cep:
                textoSeguro(
                    infNFe.entrega?.CEP
                ),

            cnpj:
                textoSeguro(
                    infNFe.entrega?.CNPJ
                ),

            cpf:
                textoSeguro(
                    infNFe.entrega?.CPF
                )
        },

        // =================================================
        // RETIRADA
        // =================================================

        retirada: {

            logradouro:
                textoSeguro(
                    infNFe.retirada?.xLgr
                ),

            numero:
                textoSeguro(
                    infNFe.retirada?.nro
                ),

            bairro:
                textoSeguro(
                    infNFe.retirada?.xBairro
                ),

            cidade:
                textoSeguro(
                    infNFe.retirada?.xMun
                ),

            uf:
                textoSeguro(
                    infNFe.retirada?.UF
                ),

            cep:
                textoSeguro(
                    infNFe.retirada?.CEP
                )
        },

        // =================================================
        // PAGAMENTO
        // =================================================

        pagamento: {

            indicador:
                textoSeguro(
                    pag.indPag
                ),

            pagamentos,

            duplicatas,

            valorTroco:
                numeroSeguro(
                    pag.vTroco
                )
        },

        // =================================================
        // INTERMEDIADOR
        // =================================================

        intermediador: {

            cnpj:
                textoSeguro(
                    infIntermed.CNPJ
                ),

            id:
                textoSeguro(
                    infIntermed.idCadIntTran
                ),

            presente:
                Boolean(
                    infIntermed.CNPJ ||
                    infIntermed.idCadIntTran
                )
        },

        // =================================================
        // INFORMAÇÕES ADICIONAIS
        // =================================================

        informacoesAdicionais: {

            complementares:
                textoSeguro(
                    infAdic.infCpl
                ),

            fisco:
                textoSeguro(
                    infAdic.infAdFisco
                ),

            observacoes:
                arraySeguro(
                    infAdic.obsCont
                ).map(
                    item => ({

                        campo:
                            textoSeguro(
                                item?.xCampo
                            ),

                        texto:
                            textoSeguro(
                                item?.xTexto
                            )
                    })
                ),

            observacoesFisco:
                arraySeguro(
                    infAdic.obsFisco
                ).map(
                    item => ({

                        campo:
                            textoSeguro(
                                item?.xCampo
                            ),

                        texto:
                            textoSeguro(
                                item?.xTexto
                            )
                    })
                ),

            processosReferenciados:
                arraySeguro(
                    infAdic.procRef
                ).map(
                    item => ({

                        processo:
                            textoSeguro(
                                item?.nProc
                            ),

                        origem:
                            textoSeguro(
                                item?.indProc
                            )
                    })
                )
        },

        // =================================================
        // COMPRA
        // =================================================

        compra: {

            notaEmpenho:
                textoSeguro(
                    infNFe.compra?.xNEmp
                ),

            pedido:
                textoSeguro(
                    infNFe.compra?.xPed
                ),

            contrato:
                textoSeguro(
                    infNFe.compra?.xCont
                )
        },

        // =================================================
        // EXPORTAÇÃO
        // =================================================

        exportacao: {

            registro:
                arraySeguro(
                    infNFe.exporta
                ).map(
                    item => ({

                        drawback:
                            textoSeguro(
                                item?.nDraw
                            ),

                        exportacao:
                            textoSeguro(
                                item?.exportInd?.nRE
                            )
                    })
                )
        },

        xmlOriginal: xml
    };
}

// =====================================================
// LISTAR ENTRADAS
// GET /
// =====================================================

router.get('/', async (req, res) => {

    try {

        const entradas = await getEntradasService();

        res.json({

            success: true,

            entradas,

            count:
                entradas.length
        });

    } catch (error) {

        console.error(
            '[ENTRADAS] Erro ao listar:',
            error
        );

        res.status(500).json({

            success: false,

            error:
                error.message
        });
    }
});

// =====================================================
// IMPORTAR XML
// POST /importar-xml
// =====================================================

router.post(
    '/importar-xml',
    upload.single('xml'),
    async (req, res) => {

        let arquivo = null;

        try {

            if (!req.file) {

                return res.status(400).json({

                    success: false,

                    error:
                        'Arquivo XML não enviado.'
                });
            }

            arquivo =
                req.file.path;

            const xml =
                fs.readFileSync(
                    arquivo,
                    'utf8'
                );

            const nfe =
                extrairXmlNfe(xml);

            validarEntradaNFe(
                nfe,
                req.body.empresaId
            );

            if (!nfe.chave) {

                throw new Error(
                    'Não foi possível identificar a chave de acesso da NF-e.'
                );
            }

            const entradas = getEntradas();

            const duplicada =
                entradas.find(
                    item =>
                        item.chave ===
                        nfe.chave
                );

            if (duplicada) {

                return res.status(409).json({

                    success: false,

                    error:
                        'Esta NF-e já foi importada.',

                    entrada:
                        duplicada
                });
            }

            const entrada = {

                id:
                    Date.now(),

                tipo:
                    'XML',

                status:
                    'CONFERENCIA',

                empresaId:
                    req.body.empresaId ||
                    null,

                chave:
                    nfe.chave,

                numero:
                    nfe.numero,

                serie:
                    nfe.serie,

                modelo:
                    nfe.modelo,

                naturezaOperacao:
                    nfe.naturezaOperacao,

                tipoOperacao:
                    nfe.tipoOperacao,

                finalidade:
                    nfe.finalidade,

                indicadorPresenca:
                    nfe.indicadorPresenca,

                indicadorIntermediador:
                    nfe.indicadorIntermediador,

                indicadorConsumidorFinal:
                    nfe.indicadorConsumidorFinal,

                tipoEmissao:
                    nfe.tipoEmissao,

                codigoMunicipio:
                    nfe.codigoMunicipio,

                dataEmissao:
                    nfe.dataEmissao,

                dataEntrada:
                    nfe.dataEntrada,

                ambiente:
                    nfe.ambiente,

                statusSefaz:
                    nfe.statusSefaz,

                motivoSefaz:
                    nfe.motivoSefaz,

                protocoloSefaz:
                    nfe.protocoloSefaz,

                fornecedor:
                    nfe.fornecedor,

                destinatario:
                    nfe.destinatario,

                documentoReferenciado:
                    nfe.documentoReferenciado,

                produtos:
                    nfe.produtos,

                totais:
                    nfe.totais,

                transporte:
                    nfe.transporte,

                entrega:
                    nfe.entrega,

                retirada:
                    nfe.retirada,

                pagamento:
                    nfe.pagamento,

                intermediador:
                    nfe.intermediador,

                informacoesAdicionais:
                    nfe.informacoesAdicionais,

                compra:
                    nfe.compra,

                exportacao:
                    nfe.exportacao,

                xmlOriginal:
                    xml,

                arquivoOriginal:
                    req.file.originalname,

                createdAt:
                    new Date().toISOString(),

                updatedAt:
                    new Date().toISOString()
            };

            entradas.push(
                entrada
            );

            saveEntradas(
                entradas
            );

            res.status(201).json({

                success: true,

                message:
                    'XML importado com sucesso. Confira os produtos antes de dar entrada.',

                entrada
            });

        } catch (error) {

            console.error(
                'Erro ao importar XML:',
                error
            );

            res.status(400).json({

                success: false,

                error:
                    error.message
            });

        } finally {

            if (arquivo) {

                try {

                    fs.removeSync(
                        arquivo
                    );

                } catch {}
            }
        }
    }
);

// =====================================================
// ENTRADA MANUAL
// POST /manual
// =====================================================

router.post(
    '/manual',
    (req, res) => {

        try {

            const {
                empresaId,
                fornecedor,
                numero: numeroNfe,
                serie,
                chave,
                dataEmissao,
                naturezaOperacao,
                cfop,
                frete,
                desconto,
                valorTotal,
                produtos,
                observacao
            } = req.body;

            if (!empresaId) {

                return res.status(400).json({

                    success: false,

                    error:
                        'Empresa não informada.'
                });
            }

            if (!fornecedor) {

                return res.status(400).json({

                    success: false,

                    error:
                        'Fornecedor não informado.'
                });
            }

            if (!numeroNfe) {

                return res.status(400).json({

                    success: false,

                    error:
                        'Número da NF-e não informado.'
                });
            }

            if (
                !produtos ||
                !Array.isArray(produtos) ||
                produtos.length === 0
            ) {

                return res.status(400).json({

                    success: false,

                    error:
                        'Informe pelo menos um produto.'
                });
            }

            const entradas = getEntradas();

            if (chave) {

                const duplicada =
                    entradas.find(
                        item =>
                            item.chave ===
                            chave
                    );

                if (duplicada) {

                    return res.status(409).json({

                        success: false,

                        error:
                            'Esta chave de NF-e já está cadastrada.',

                        entrada:
                            duplicada
                    });
                }
            }

            const produtosNormalizados =
                produtos.map(
                    (produto, index) => ({

                        item:
                            index + 1,

                        codigo:
                            texto(
                                produto.codigo
                            ),

                        descricao:
                            texto(
                                produto.descricao
                            ),

                        ncm:
                            texto(
                                produto.ncm
                            ),

                        cfop:
                            texto(
                                produto.cfop
                            ),

                        unidade:
                            texto(
                                produto.unidade ||
                                'UN'
                            ),

                        quantidade:
                            numeroSeguro(
                                produto.quantidade
                            ),

                        valorUnitario:
                            numeroSeguro(
                                produto.valorUnitario
                            ),

                        valorTotal:
                            numeroSeguro(
                                produto.valorTotal
                            ) ||
                            numeroSeguro(
                                produto.quantidade
                            ) *
                            numeroSeguro(
                                produto.valorUnitario
                            ),

                        cstCsosn:
                            texto(
                                produto.cstCsosn
                            ),

                        ipi:
                            numeroSeguro(
                                produto.ipi
                            ),

                        pis:
                            numeroSeguro(
                                produto.pis
                            ),

                        cofins:
                            numeroSeguro(
                                produto.cofins
                            )
                    })
                );

            const totalProdutos =
                produtosNormalizados.reduce(
                    (soma, produto) =>
                        soma +
                        produto.valorTotal,
                    0
                );

            const valorFrete =
                Math.max(
                    0,
                    numeroSeguro(
                        frete
                    )
                );

            const valorDesconto =
                Math.max(
                    0,
                    numeroSeguro(
                        desconto
                    )
                );

            const totalCalculado =
                Math.max(
                    0,
                    totalProdutos +
                    valorFrete -
                    valorDesconto
                );

            const totalInformado =
                numeroSeguro(
                    valorTotal
                );

            const totalNota =
                totalInformado > 0
                    ? totalInformado
                    : totalCalculado;

            const entrada = {

                id:
                    Date.now(),

                tipo:
                    'MANUAL',

                status:
                    'CONFERENCIA',

                empresaId,

                chave:
                    chave || '',

                numero:
                    texto(
                        numeroNfe
                    ),

                serie:
                    texto(
                        serie || '1'
                    ),

                naturezaOperacao:
                    texto(
                        naturezaOperacao ||
                        'COMPRA'
                    ),

                cfop:
                    texto(cfop),

                dataEmissao:
                    dataEmissao ||
                    new Date().toISOString(),

                fornecedor,

                produtos:
                    produtosNormalizados,

                totais: {

                    produtos:
                        totalProdutos,

                    frete:
                        valorFrete,

                    desconto:
                        valorDesconto,

                    nota:
                        totalNota
                },

                valorTotalInformado:
                    totalInformado ||
                    null,

                observacao:
                    texto(
                        observacao
                    ),

                createdAt:
                    new Date().toISOString(),

                updatedAt:
                    new Date().toISOString()
            };

            entradas.push(
                entrada
            );

            saveEntradas(
                entradas
            );

            res.status(201).json({

                success: true,

                message:
                    'Entrada manual cadastrada para conferência.',

                entrada
            });

        } catch (error) {

            console.error(
                'Erro na entrada manual:',
                error
            );

            res.status(500).json({

                success: false,

                error:
                    error.message
            });
        }
    }
);

// =====================================================
// SINCRONIZAR COM SEFAZ
// POST /sincronizar-sefaz
// =====================================================

router.post(
    '/sincronizar-sefaz',
    async (req, res) => {

        try {

            const {
                empresaId,
                nsuEspecifico,
                chNFe
            } = req.body || {};

            if (!empresaId) {

                return res.status(400).json({

                    success: false,

                    error:
                        'Empresa não informada.'
                });
            }

            const config =
                obterConfigEmpresa(
                    empresaId
                );

            if (
                !config.cnpj ||
                config.cnpj.length !== 14
            ) {

                return res.status(400).json({

                    success: false,

                    error:
                        `Empresa sem CNPJ válido configurado (${config.cnpj || 'vazio'}).`
                });
            }

            const resultado =
                await NfeDistribuicaoService.consultar({

                    empresaId,

                    cnpj:
                        config.cnpj,

                    uf:
                        config.uf,

                    ambiente:
                        config.ambiente,

                    nsuEspecifico:
                        nsuEspecifico ||
                        null,

                    chNFe:
                        chNFe ||
                        null
                });

            // =============================================
            // 656 = CONSUMO INDEVIDO
            // =============================================

            if (
                String(
                    resultado.cStat
                ) === '656'
            ) {

                return res.status(429).json({

                    success: false,

                    comunicacao: true,

                    cStat:
                        resultado.cStat,

                    xMotivo:
                        resultado.xMotivo,

                    ultNSU:
                        resultado.ultNSU ||
                        lerNsu(
                            empresaId
                        ).ultimoNsu,

                    maxNSU:
                        resultado.maxNSU ||
                        '000000000000000',

                    quantidadeDocumentos:
                        0,

                    novasEntradas:
                        0,

                    bloqueado:
                        true,

                    aguardarMinutos:
                        60,

                    message:
                        'A SEFAZ bloqueou temporariamente a consulta por consumo indevido. Aguarde 1 hora antes de consultar novamente.'
                });
            }

            // =============================================
            // DOCUMENTOS ENCONTRADOS
            // =============================================

            let novasEntradas = 0;

            if (
                resultado.success &&
                resultado.documentos?.length
            ) {

                const entradas = getEntradas();

                for (
                    const doc
                    of resultado.documentos
                ) {

                    if (
                        doc.tipo !== 'PROC_NFE' &&
                        doc.tipo !== 'NFE'
                    ) {
                        continue;
                    }

                    try {

                        const nfe =
                            extrairXmlNfe(
                                doc.xml
                            );

                        if (!nfe.chave) {
                            continue;
                        }

                        const jaExiste =
                            entradas.find(
                                e =>
                                    String(
                                        e.empresaId
                                    ) ===
                                    String(
                                        empresaId
                                    ) &&
                                    e.chave ===
                                    nfe.chave
                            );

                        if (jaExiste) {
                            continue;
                        }

                        // =================================
                        // VALIDAR DESTINATÁRIO
                        // =================================

                        try {

                            validarEntradaNFe(
                                nfe,
                                empresaId
                            );

                        } catch (
                            erroValidacao
                        ) {

                            console.warn(
                                `[SINCRONIZAR] NF-e ${nfe.chave} ignorada: ${erroValidacao.message}`
                            );

                            continue;
                        }

                        // =================================
                        // CRIAR ENTRADA
                        // =================================

                        entradas.push({

                            id:
                                Date.now() +
                                novasEntradas,

                            tipo:
                                'SEFAZ',

                            status:
                                'CONFERENCIA',

                            empresaId:
                                String(
                                    empresaId
                                ),

                            chave:
                                nfe.chave,

                            numero:
                                nfe.numero,

                            serie:
                                nfe.serie,

                            naturezaOperacao:
                                nfe.naturezaOperacao,

                            dataEmissao:
                                nfe.dataEmissao,

                            fornecedor:
                                nfe.fornecedor,

                            destinatario:
                                nfe.destinatario,

                            produtos:
                                nfe.produtos,

                            totais:
                                nfe.totais,

                            nsu:
                                doc.nsu,

                            xmlPath:
                                doc.xmlPath ||
                                null,

                            xmlOriginal:
                                doc.xml,

                            createdAt:
                                new Date().toISOString(),

                            updatedAt:
                                new Date().toISOString()
                        });

                        novasEntradas++;

                        // =================================
                        // VINCULAR FORNECEDOR
                        // =================================

                        vincularFornecedor({

                            ...nfe.fornecedor,

                            origem:
                                'NFE_SEFAZ'
                        });

                    } catch (erroDoc) {

                        console.error(
                            '[SINCRONIZAR] Erro ao processar documento:',
                            erroDoc.message
                        );
                    }
                }

                if (
                    novasEntradas > 0
                ) {

                    saveEntradas(
                        entradas
                    );
                }
            }

            res.json({

                success:
                    resultado.success,

                cStat:
                    resultado.cStat,

                xMotivo:
                    resultado.xMotivo,

                ultNSU:
                    resultado.ultNSU ||
                    lerNsu(
                        empresaId
                    ).ultimoNsu,

                maxNSU:
                    resultado.maxNSU,

                ultNSUAtualizado:
                    resultado.ultNSUAtualizado ||
                    null,

                quantidadeDocumentos:
                    resultado.documentos?.length ||
                    0,

                novasEntradas,

                tipoErro:
                    resultado.tipoErro ||
                    null,

                tempoMs:
                    resultado.tempoMs,

                httpStatus:
                    resultado.httpStatus,

                message:
                    resultado.success

                        ? (
                            resultado.temDocumentos

                                ? `${resultado.documentos.length} documento(s) recebido(s); ${novasEntradas} nova(s) NF-e importada(s).`

                                : 'Nenhum documento novo destinado à empresa.'
                        )

                        : (
                            resultado.xMotivo ||
                            'Consulta ao SEFAZ sem sucesso fiscal.'
                        )
            });

        } catch (error) {

            console.error(
                '[SINCRONIZAR] Erro:',
                error
            );

            res.status(500).json({

                success: false,

                error:
                    error.message
            });
        }
    }
);

// =====================================================
// STATUS DA DISTRIBUIÇÃO
// GET /distribuicao?empresaId=1
// =====================================================

router.get(
    '/distribuicao',
    (req, res) => {

        try {

            const {
                empresaId
            } = req.query;

            if (!empresaId) {

                return res.status(400).json({

                    success: false,

                    error:
                        'empresaId é obrigatório.'
                });
            }

            const config =
                obterConfigEmpresa(
                    empresaId
                );

            const nsu =
                lerNsu(
                    empresaId
                );

            res.json({

                success: true,

                empresaId:
                    String(
                        empresaId
                    ),

                cnpj:
                    config.cnpj,

                uf:
                    config.uf,

                ambiente:
                    config.ambiente,

                ultimoNsu:
                    nsu.ultimoNsu,

                atualizadoEm:
                    nsu.atualizadoEm
            });

        } catch (error) {

            res.status(500).json({

                success: false,

                error:
                    error.message
            });
        }
    }
);

// =====================================================
// NF-e PENDENTES DE CONFERÊNCIA
// GET /pendentes?empresaId=1
// =====================================================

router.get(
    '/pendentes',
    (req, res) => {

        try {

            const {
                empresaId
            } = req.query;

            let entradas =
                getEntradas();

            if (empresaId) {

                entradas =
                    entradas.filter(
                        e =>
                            String(
                                e.empresaId
                            ) ===
                            String(
                                empresaId
                            )
                    );
            }

            const pendentes =
                entradas.filter(
                    e =>
                        e.status ===
                        'CONFERENCIA'
                );

            res.json({

                success: true,

                pendentes,

                count:
                    pendentes.length
            });

        } catch (error) {

            console.error(
                '[PENDENTES] Erro:',
                error
            );

            res.status(500).json({

                success: false,

                error:
                    error.message
            });
        }
    }
);

// =====================================================
// CONSULTAR UMA ENTRADA
// GET /:id
// =====================================================

router.get(
    '/:id',
    (req, res) => {

        try {

            const id =
                Number(
                    req.params.id
                );

            const entrada =
                getEntradas().find(
                    item =>
                        item.id === id
                );

            if (!entrada) {

                return res.status(404).json({

                    success: false,

                    error:
                        'Entrada não encontrada.'
                });
            }

            res.json({

                success: true,

                entrada
            });

        } catch (error) {

            res.status(500).json({

                success: false,

                error:
                    error.message
            });
        }
    }
);

// =====================================================
// MANIFESTAÇÃO DO DESTINATÁRIO
// POST /:id/manifestar
// =====================================================

router.post(
    '/:id/manifestar',
    async (req, res) => {

        try {

            const id =
                Number(
                    req.params.id
                );

            const {
                tipoEvento,
                justificativa
            } =
                req.body || {};

            const entrada =
                getEntradas().find(
                    e =>
                        Number(e.id) ===
                        id
                );

            if (!entrada) {

                return res.status(404).json({

                    success: false,

                    error:
                        'Entrada não encontrada.'
                });
            }

            if (!entrada.chave) {

                return res.status(400).json({

                    success: false,

                    error:
                        'Esta entrada não possui chave de acesso (entrada manual sem chave).'
                });
            }

            if (
                !DESCRICOES_EVENTO[
                    tipoEvento
                ]
            ) {

                return res.status(400).json({

                    success: false,

                    error:
                        `tipoEvento inválido. Use um dos: ${Object.keys(DESCRICOES_EVENTO).join(', ')} (210200=Confirmação, 210210=Ciência, 210220=Desconhecimento, 210240=Não Realizada).`
                });
            }

            const config =
                obterConfigEmpresa(
                    entrada.empresaId
                );

            const resultado =
                await NfeManifestacaoService.manifestar({

                    empresaId:
                        entrada.empresaId,

                    cnpj:
                        config.cnpj,

                    uf:
                        config.uf,

                    ambiente:
                        normalizarAmbiente(
                            entrada.ambiente ||
                            config.ambiente
                        ),

                    chNFe:
                        entrada.chave,

                    tipoEvento,

                    justificativa
                });

            const entradas = getEntradas();

            const index =
                entradas.findIndex(
                    e =>
                        Number(e.id) ===
                        id
                );

            if (index >= 0) {

                entradas[index].manifestacao = {

                    tipoEvento,

                    descricao:
                        DESCRICOES_EVENTO[
                            tipoEvento
                        ],

                    cStat:
                        resultado.cStat,

                    xMotivo:
                        resultado.xMotivo,

                    protocolo:
                        resultado.protocolo,

                    success:
                        resultado.success,

                    dataHora:
                        new Date().toISOString()
                };

                entradas[index].updatedAt =
                    new Date().toISOString();

                saveEntradas(
                    entradas
                );
            }

            res.status(
                resultado.success
                    ? 200
                    : 502
            ).json({

                success:
                    resultado.success,

                cStat:
                    resultado.cStat,

                xMotivo:
                    resultado.xMotivo,

                protocolo:
                    resultado.protocolo,

                message:
                    resultado.success

                        ? `Manifestação enviada: ${DESCRICOES_EVENTO[tipoEvento]}.`

                        : (
                            resultado.xMotivo ||
                            'SEFAZ não vinculou o evento.'
                        )
            });

        } catch (error) {

            console.error(
                '[MANIFESTAR] Erro:',
                error
            );

            res.status(500).json({

                success: false,

                error:
                    error.message
            });
        }
    }
);

// =====================================================
// DOWNLOAD DO XML
// GET /:id/xml
// =====================================================

router.get(
    '/:id/xml',
    (req, res) => {

        try {

            const id =
                Number(
                    req.params.id
                );

            const entrada =
                getEntradas().find(
                    e =>
                        Number(e.id) ===
                        id
                );

            if (!entrada) {

                return res.status(404).json({

                    success: false,

                    error:
                        'Entrada não encontrada.'
                });
            }

            if (
                entrada.xmlPath &&
                fs.existsSync(
                    entrada.xmlPath
                )
            ) {

                res.setHeader(
                    'Content-Type',
                    'application/xml; charset=utf-8'
                );

                res.setHeader(
                    'Content-Disposition',
                    `attachment; filename="nfe-${entrada.chave || entrada.id}.xml"`
                );

                return res.send(
                    fs.readFileSync(
                        entrada.xmlPath,
                        'utf8'
                    )
                );
            }

            if (
                entrada.xmlOriginal
            ) {

                res.setHeader(
                    'Content-Type',
                    'application/xml; charset=utf-8'
                );

                res.setHeader(
                    'Content-Disposition',
                    `attachment; filename="nfe-${entrada.chave || entrada.id}.xml"`
                );

                return res.send(
                    entrada.xmlOriginal
                );
            }

            return res.status(404).json({

                success: false,

                error:
                    'XML não disponível para esta entrada.'
            });

        } catch (error) {

            res.status(500).json({

                success: false,

                error:
                    error.message
            });
        }
    }
);

// =====================================================
// CONFIRMAR ENTRADA
// Estoque + manifestação 210200
// =====================================================

router.post(
    '/:id/confirmar',
    async (req, res) => {

        try {

            const id =
                Number(
                    req.params.id
                );

            const entradas = getEntradas();

            const index =
                entradas.findIndex(
                    item =>
                        Number(item.id) ===
                        id
                );

            if (index === -1) {

                return res.status(404).json({

                    success: false,

                    error:
                        'Entrada não encontrada.'
                });
            }

            const entrada =
                entradas[index];

            if (
                entrada.status ===
                'CONFIRMADA'
            ) {

                return res.status(400).json({

                    success: false,

                    error:
                        'Esta NF-e já possui entrada de estoque.'
                });
            }

            const itens =
                Array.isArray(
                    req.body?.itens
                )
                    ? req.body.itens
                    : [];

            if (
                entrada.produtos?.length &&
                itens.length !==
                entrada.produtos.length
            ) {

                return res.status(400).json({

                    success: false,

                    error:
                        'A quantidade de itens enviados não corresponde à quantidade de itens da NF-e.'
                });
            }

            // =============================================
            // ENTRADA TRANSACIONAL
            // =============================================

            const {
                entrada:
                    entradaAtualizada,
                resumo
            } =
                await confirmarEntradaTransacional({

                    entradaId:
                        id,

                    itens,

                    usuario:
                        req.body?.usuario ||
                        null
                });

            // =============================================
            // SALVAR ERP
            // =============================================

            entradas[index] =
                entradaAtualizada;

            saveEntradas(
                entradas
            );

            // =============================================
            // CONFIRMAÇÃO SEFAZ
            // 210200
            // =============================================

            let sefaz = {

                enviada: false,

                success: false,

                cStat: null,

                xMotivo: null,

                protocolo: null,

                tipoEvento: null
            };

            if (
                entradaAtualizada.chave
            ) {

                sefaz.tipoEvento =
                    '210200';

                try {

                    const config =
                        obterConfigEmpresa(
                            entradaAtualizada.empresaId
                        );

                    const resultado =
                        await NfeManifestacaoService.manifestar({

                            empresaId:
                                entradaAtualizada.empresaId,

                            cnpj:
                                config.cnpj,

                            uf:
                                config.uf,

                            ambiente:
                                normalizarAmbiente(
                                    entradaAtualizada.ambiente ||
                                    config.ambiente
                                ),

                            chNFe:
                                entradaAtualizada.chave,

                            tipoEvento:
                                '210200'
                        });

                    sefaz = {

                        enviada: true,

                        success:
                            Boolean(
                                resultado.success
                            ),

                        cStat:
                            resultado.cStat ||
                            null,

                        xMotivo:
                            resultado.xMotivo ||
                            null,

                        protocolo:
                            resultado.protocolo ||
                            null,

                        tipoEvento:
                            '210200'
                    };

                    entradaAtualizada.manifestacao = {

                        tipoEvento:
                            '210200',

                        descricao:
                            'Confirmação da Operação',

                        success:
                            Boolean(
                                resultado.success
                            ),

                        cStat:
                            resultado.cStat ||
                            null,

                        xMotivo:
                            resultado.xMotivo ||
                            null,

                        protocolo:
                            resultado.protocolo ||
                            null,

                        dataHora:
                            new Date().toISOString()
                    };

                    entradas[index] =
                        entradaAtualizada;

                    saveEntradas(
                        entradas
                    );

                } catch (error) {

                    console.error(
                        '[ENTRADA] Erro ao enviar confirmação para SEFAZ:',
                        error
                    );

                    sefaz = {

                        enviada: true,

                        success: false,

                        cStat: null,

                        xMotivo:
                            error.message,

                        protocolo: null,

                        tipoEvento:
                            '210200'
                    };

                    entradaAtualizada.manifestacao = {

                        tipoEvento:
                            '210200',

                        descricao:
                            'Confirmação da Operação',

                        success: false,

                        cStat: null,

                        xMotivo:
                            error.message,

                        protocolo: null,

                        dataHora:
                            new Date().toISOString()
                    };

                    entradas[index] =
                        entradaAtualizada;

                    saveEntradas(
                        entradas
                    );
                }

            } else {

                sefaz = {

                    enviada: false,

                    success: false,

                    cStat: null,

                    xMotivo:
                        'Entrada sem chave de acesso. A confirmação não foi enviada à SEFAZ.',

                    protocolo: null,

                    tipoEvento: null
                };
            }

            // =============================================
            // MENSAGEM
            // =============================================

            const mensagem =
                sefaz.success

                    ? 'Entrada realizada com sucesso. Estoque atualizado. Confirmação da Operação aceita pela SEFAZ.'

                    : (
                        sefaz.enviada

                            ? 'Entrada realizada com sucesso. Estoque atualizado, mas a Confirmação da Operação não foi aceita pela SEFAZ.'

                            : 'Entrada realizada com sucesso. Estoque atualizado. Não foi enviada manifestação à SEFAZ porque esta entrada não possui chave de acesso.'
                    );

            res.json({

                success: true,

                message:
                    mensagem,

                entrada:
                    entradaAtualizada,

                resumo,

                sefaz
            });

        } catch (error) {

            console.error(
                'Erro ao confirmar entrada:',
                error
            );

            res.status(400).json({

                success: false,

                error:
                    error.message
            });
        }
    }
);

// =====================================================
// EXPORT
// =====================================================

export default router;


