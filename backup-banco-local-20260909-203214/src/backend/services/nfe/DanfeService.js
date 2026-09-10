import fs from 'fs';
import bwipjs from 'bwip-js';
import path from 'path';
import { XMLParser } from 'fast-xml-parser';

export class DanfeService {

    escapeHtml(value) {
        return String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    formatarNumero(value, casas = 2) {
        const numero = Number(value ?? 0);

        return numero.toLocaleString('pt-BR', {
            minimumFractionDigits: casas,
            maximumFractionDigits: casas
        });
    }

    formatarData(value) {
        if (!value) {
            return '';
        }

        const texto = String(value);

        const match = texto.match(
            /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})/
        );

        if (!match) {
            return texto;
        }

        return `${match[3]}/${match[2]}/${match[1]} ${match[4]}:${match[5]}:${match[6]}`;
    }

    array(value) {
        if (!value) {
            return [];
        }

        return Array.isArray(value)
            ? value
            : [value];
    }

    obterCst(prod) {
        const imposto = prod?.imposto || {};

        return (
            imposto?.ICMS?.ICMS00?.CST ||
            imposto?.ICMS?.ICMS10?.CST ||
            imposto?.ICMS?.ICMS20?.CST ||
            imposto?.ICMS?.ICMS30?.CST ||
            imposto?.ICMS?.ICMS40?.CST ||
            imposto?.ICMS?.ICMS41?.CST ||
            imposto?.ICMS?.ICMS51?.CST ||
            imposto?.ICMS?.ICMS60?.CST ||
            imposto?.ICMS?.ICMS70?.CST ||
            imposto?.ICMS?.ICMS90?.CST ||
            imposto?.ICMS?.ICMSSN101?.CSOSN ||
            imposto?.ICMS?.ICMSSN102?.CSOSN ||
            imposto?.ICMS?.ICMSSN201?.CSOSN ||
            imposto?.ICMS?.ICMSSN202?.CSOSN ||
            imposto?.ICMS?.ICMSSN500?.CSOSN ||
            imposto?.ICMS?.ICMSSN900?.CSOSN ||
            ''
        );
    }

    obterPis(prod) {
        const pis = prod?.imposto?.PIS || {};

        return (
            pis?.PISAliq?.CST ||
            pis?.PISQtde?.CST ||
            pis?.PISNT?.CST ||
            pis?.PISOutr?.CST ||
            ''
        );
    }

    obterCofins(prod) {
        const cofins = prod?.imposto?.COFINS || {};

        return (
            cofins?.COFINSAliq?.CST ||
            cofins?.COFINSQtde?.CST ||
            cofins?.COFINSNT?.CST ||
            cofins?.COFINSOutr?.CST ||
            ''
        );
    }

    obterFormaPagamento(tPag) {

        const mapa = {
            '01': 'Dinheiro',
            '02': 'Cheque',
            '03': 'Cartão de Crédito',
            '04': 'Cartão de Débito',
            '05': 'Crédito Loja',
            '10': 'Vale Alimentaééo',
            '11': 'Vale Refeiééo',
            '12': 'Vale Presente',
            '13': 'Vale Combustével',
            '14': 'Duplicata Mercantil',
            '15': 'Boleto Bancério',
            '16': 'Depésito Bancério',
            '17': 'Pagamento Instanténeo (PIX)',
            '18': 'Transferência bancéria',
            '19': 'Programa de fidelidade',
            '90': 'Sem pagamento',
            '99': 'Outros'
        };

        const codigo =
            String(tPag ?? '')
                .trim()
                .padStart(2, '0');

        return mapa[codigo] ||
            String(tPag ?? 'Não informado');
    }

    obterModalidadeFrete(modFrete) {
        const mapa = {
            '0': 'Contratação do frete por conta do remetente',
            '1': 'Contratação do frete por conta do destinatário',
            '2': 'Contratação do frete por conta de terceiros',
            '3': 'Transporte préprio por conta do remetente',
            '4': 'Transporte préprio por conta do destinatário',
            '9': 'Sem ocorrência de transporte'
        };

        return mapa[String(modFrete || '')] ||
            String(modFrete || 'Não informado');
    }

    gerarBarras(chave) {

        const texto = String(chave || '');

        if (!texto) {
            return '';
        }

        try {

            return bwipjs.toSVG({
                bcid: 'code128',
                text: texto,
                scale: 2,
                height: 14,
                includetext: false,
                backgroundcolor: 'FFFFFF',
                paddingwidth: 2,
                paddingheight: 2
            });

        } catch (error) {

            console.error(
                '[DANFE] Erro ao gerar Code128:',
                error.message
            );

            return '';

        }
    }

    gerarHtml(xml, protocolo = {}) {

        if (!xml) {
            throw new Error('XML da NF-e não informado.');
        }

        const parser = new XMLParser({
            ignoreAttributes: false,
            attributeNamePrefix: '@_',
            trimValues: true
        });

        const doc = parser.parse(xml);

        const nfe =
            doc?.nfeProc?.NFe?.infNFe ||
            doc?.NFe?.infNFe;

        if (!nfe) {
            throw new Error('XML NF-e inválido.');
        }

        const ide = nfe.ide || {};
        const emit = nfe.emit || {};
        const dest = nfe.dest || {};
        const total = nfe.total?.ICMSTot || {};
        const transp = nfe.transp || {};
        const pag = nfe.pag || {};
        const cobr = nfe.cobr || {};
        const infAdic = nfe.infAdic || {};
        const infRespTec = nfe.infRespTec || {};

        let produtos = this.array(nfe.det);

        const protNFe =
            doc?.nfeProc?.protNFe ||
            doc?.protNFe ||
            {};

        const infProt =
            protNFe?.infProt ||
            {};

        const protocoloNFe = {
            nProt:
                infProt?.nProt ||
                protocolo?.nProt ||
                protocolo?.protocolo ||
                '',

            dhRecbto:
                infProt?.dhRecbto ||
                protocolo?.dhRecbto ||
                '',

            cStat:
                infProt?.cStat ||
                protocolo?.cStat ||
                '',

            xMotivo:
                infProt?.xMotivo ||
                protocolo?.xMotivo ||
                ''
        };

        const chave = String(
            nfe['@_Id'] || ''
        ).replace(/^NFe/, '');

        const tpNF =
            String(ide.tpNF || '') === '1'
                ? 'Saída'
                : 'Entrada';

        const homologacao =
            String(ide.tpAmb || '') === '2';

        const status =
            protocolo?.status ||
            (
                homologacao
                    ? 'SEM VALOR FISCAL - HOMOLOGAÇÃO'
                    : (
                        protocoloNFe.cStat === '100'
                            ? 'AUTORIZADA'
                            : 'NF-e'
                    )
            );

        const pagamentos = this.array(pag.detPag);

        const duplicatas = this.array(
            cobr?.dup
        );

        const volumes = this.array(
            transp?.vol
        );

        const fatura = cobr?.fat || {};

        const linhasProdutos = produtos.map((item, index) => {

            const prod = item?.prod || {};

            const cst = this.obterCst(item);
            const pis = this.obterPis(item);
            const cofins = this.obterCofins(item);

            return `
                <tr>
                    <td class="center">${this.escapeHtml(
                        item?.['@_nItem'] || index + 1
                    )}</td>

                    <td>${this.escapeHtml(
                        prod?.cProd || ''
                    )}</td>

                    <td>${this.escapeHtml(
                        prod?.xProd || ''
                    )}</td>

                    <td class="center">${this.escapeHtml(
                        prod?.NCM || ''
                    )}</td>

                    <td class="center">${this.escapeHtml(
                        cst
                    )}</td>

                    <td class="center">${this.escapeHtml(
                        prod?.CFOP || ''
                    )}</td>

                    <td class="center">${this.escapeHtml(
                        prod?.uCom || ''
                    )}</td>

                    <td class="right">${this.formatarNumero(
                        prod?.qCom,
                        4
                    )}</td>

                    <td class="right">${this.formatarNumero(
                        prod?.vUnCom,
                        2
                    )}</td>

                    <td class="right">${this.formatarNumero(
                        prod?.vProd,
                        2
                    )}</td>

                    <td class="center">${this.escapeHtml(pis)}</td>

                    <td class="center">${this.escapeHtml(cofins)}</td>
                </tr>
            `;
        }).join('');

        const linhasFaturamento = duplicatas.length
            ? duplicatas.map((dup, index) => `
                <tr>
                    <td>${this.escapeHtml(
                        dup?.nDup || index + 1
                    )}</td>
                    <td>${this.escapeHtml(
                        this.formatarData(dup?.dVenc)
                    )}</td>
                    <td class="right">
                        R$ ${this.formatarNumero(dup?.vDup)}
                    </td>
                </tr>
            `).join('')
            : `
                <tr>
                    <td>--</td>
                    <td>Não informado</td>
                    <td class="right">R$ 0,00</td>
                </tr>
            `;

        const linhasPagamento = pagamentos.length
            ? pagamentos.map(pagamento => `
                <tr>
                    <td>${this.escapeHtml(
                        this.obterFormaPagamento(
                            pagamento?.tPag
                        )
                    )}</td>
                    <td class="right">
                        R$ ${this.formatarNumero(
                            pagamento?.vPag
                        )}
                    </td>
                </tr>
            `).join('')
            : `
                <tr>
                    <td>Não informado</td>
                    <td class="right">R$ 0,00</td>
                </tr>
            `;

        const linhasVolumes = volumes.length
            ? volumes.map(volume => `
                <tr>
                    <td>${this.escapeHtml(
                        volume?.qVol ?? ''
                    )}</td>
                    <td>${this.escapeHtml(
                        volume?.esp ?? ''
                    )}</td>
                    <td>${this.escapeHtml(
                        volume?.marca ?? ''
                    )}</td>
                    <td>${this.escapeHtml(
                        volume?.nVol ?? ''
                    )}</td>
                    <td class="right">${this.formatarNumero(
                        volume?.pesoL,
                        3
                    )}</td>
                    <td class="right">${this.formatarNumero(
                        volume?.pesoB,
                        3
                    )}</td>
                </tr>
            `).join('')
            : `
                <tr>
                    <td colspan="6" class="center">
                        Nenhum volume informado na NF-e
                    </td>
                </tr>
            `;

        const enderecoEmitente = [
            emit?.enderEmit?.xLgr,
            emit?.enderEmit?.nro
        ].filter(Boolean).join(', ');

        const bairroEmitente =
            emit?.enderEmit?.xBairro || '';

        const cidadeEmitente = [
            emit?.enderEmit?.xMun,
            emit?.enderEmit?.UF
        ].filter(Boolean).join(' / ');

        const enderecoDestinatario = [
            dest?.enderDest?.xLgr,
            dest?.enderDest?.nro
        ].filter(Boolean).join(', ');

        const cidadeDestinatario = [
            dest?.enderDest?.xMun,
            dest?.enderDest?.UF
        ].filter(Boolean).join(' / ');

        const cnpjCpfDest =
            dest?.CNPJ ||
            dest?.CPF ||
            '';

        const ieDest =
            dest?.IE ||
            (
                String(dest?.indIEDest || '') === '9'
                    ? 'Não contribuinte'
                    : ''
            );

        const natureza = ide?.natOp || '';

        const valorProdutos = total?.vProd || 0;
        const valorFrete = total?.vFrete || 0;
        const valorSeguro = total?.vSeg || 0;
        const valorDesconto = total?.vDesc || 0;
        const valorOutros = total?.vOutro || 0;
        const valorIPI = total?.vIPI || 0;
        const valorICMS = total?.vICMS || 0;
        const valorICMSST = total?.vST || 0;
        const valorPIS = total?.vPIS || 0;
        const valorCOFINS = total?.vCOFINS || 0;
        const valorNF = total?.vNF || 0;

        const bcICMS = total?.vBC || 0;
        const bcICMSST = total?.vBCST || 0;

        const logoPath = path.join(
            process.cwd(),
            'src',
            'backend',
            'services',
            'nfe',
            'metal-racing-logo.png'
        );

        let logoDataUri = '';

        if (fs.existsSync(logoPath)) {
            const logoBase64 =
                fs.readFileSync(logoPath)
                    .toString('base64');

            logoDataUri =
                `data:image/png;base64,${logoBase64}`;

            console.log(
                '[DANFE] LOGO CARREGADO:',
                logoPath,
                'bytes:',
                fs.statSync(logoPath).size
            );
        } else {
            console.error(
                '[DANFE] LOGO NºO ENCONTRADO:',
                logoPath
            );
        }

        return `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">

<title>
    DANFE NF-e ${this.escapeHtml(ide?.nNF || '')}
</title>

<style>

@page {
    size: A4;
    margin: 5mm;
}

* {
    box-sizing: border-box;
}

html,
body {
    margin: 0;
    padding: 0;
    background: #fff;
}

body {
    font-family: Arial, Helvetica, sans-serif;
    color: #000;
    font-size: 9.2px;
}

.danfe {
    width: 100%;
}

.section {
    margin-top: 4px;
}

.box {
    border: 1px solid #000;
}

.header {
    display: grid;
    grid-template-columns: 29% 46% 25%;
    min-height: 103px;
    height: 103px;
    border: 1px solid #000;
}

.logo {
    background: #000;
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
}

.logo img {
    display: block;
    width: 100%;
    height: 100%;
    max-width: 100%;
    max-height: 100%;
    object-fit: contain;
}

.logo-fallback {
    color: #fff;
    font-weight: bold;
    font-size: 18px;
    text-align: center;
}

.company {
    padding: 5px 7px;
    border-left: 1px solid #000;
    overflow: hidden;
    min-width: 0;
}

.company .label {
    margin-bottom: 2px;
}

.company-name {
    font-size: 14px;
    line-height: 1.08;
    font-weight: bold;
}

.company-fantasy {
    font-size: 9px;
    margin: 2px 0 4px;
}

.company-line {
    font-size: 8px;
    line-height: 1.18;
    margin-top: 1px;
    white-space: normal;
    overflow-wrap: anywhere;
    word-break: break-word;
}

.danfe-title {
    border-left: 1px solid #000;
    text-align: center;
    padding: 5px;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: stretch;
    overflow: hidden;
}

.danfe-title h1 {
    margin: 0 0 5px;
    font-size: 23px;
}

.danfe-title .auxiliar {
    font-size: 10px;
    line-height: 1.15;
    font-weight: bold;
}

.danfe-number {
    margin-top: 6px;
    font-size: 8px;
}

.danfe-number strong {
    font-size: 15px;
}

.danfe-serie {
    font-size: 8px;
    margin-top: 2px;
}

.danfe-serie strong {
    font-size: 13px;
}

.label {
    font-size: 7px;
    line-height: 1.05;
    font-weight: bold;
    text-transform: uppercase;
    display: block;
    width: 100%;
    white-space: normal;
    overflow-wrap: anywhere;
    word-break: break-word;
}

.value {
    margin-top: 2px;
    font-size: 9px;
    line-height: 1.15;
    display: block;
    width: 100%;
    white-space: normal;
    overflow-wrap: anywhere;
    word-break: break-word;
}

.grid {
    display: grid;
    gap: 0;
    width: 100%;
    min-width: 0;
}

.grid-2 {
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
}

.grid-3 {
    grid-template-columns: repeat(3, minmax(0, 1fr));
}

.grid-4 {
    grid-template-columns: repeat(4, minmax(0, 1fr));
}

.grid-5 {
    grid-template-columns: repeat(5, minmax(0, 1fr));
}

.grid-6 {
    grid-template-columns: repeat(6, minmax(0, 1fr));
}

.cell {
    border: 1px solid #000;
    padding: 4px 5px;
    min-height: 31px;
    vertical-align: top;
    overflow: hidden;
    overflow-wrap: anywhere;
    word-break: break-word;
}

.cell-tight {
    padding: 3px;
    min-height: 25px;
}

.chave-box {
    padding: 5px;
}

.chave {
    font-size: 11px;
    font-weight: bold;
    letter-spacing: 0.25px;
    word-break: break-all;
    overflow-wrap: anywhere;
    margin-top: 2px;
    width: 100%;
}

.barra-box {
    border-top: 0;
    padding: 4px 5px;
    min-height: 39px;
}

.barras {
    height: 32px;
    width: 100%;
    display: flex;
    justify-content: center;
    align-items: stretch;
    overflow: hidden;
    background: #fff;
}

.barras svg {
    display: block;
    width: 98%;
    height: 31px;
    max-height: 31px;
    margin: 0 auto;
}

.barras span {
    display: block;
    height: 100%;
    flex: 0 0 auto;
}

.bar-black {
    background: #000;
}

.bar-white {
    background: #fff;
}

.status {
    border: 2px solid #000;
    min-height: 30px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 11px;
    font-weight: bold;
    letter-spacing: 0.3px;
    text-align: center;
}

.status.homologacao {
    min-height: 24px;
    border: 1px solid #000;
    margin-top: 3px;
    font-size: 8.5px;
}

.section-title {
    font-size: 7.2px;
    line-height: 1.05;
    font-weight: bold;
    text-transform: uppercase;
    margin-bottom: 2px;
    padding-left: 1px;
}

table {
    width: 100%;
    border-collapse: collapse;
    table-layout: fixed;
}

th,
td {
    border: 1px solid #000;
    padding: 3px 4px;
    vertical-align: middle;
    overflow: hidden;
    overflow-wrap: anywhere;
    word-break: break-word;
}

th {
    font-size: 6.8px;
    line-height: 1.05;
    text-align: center;
    font-weight: bold;
    white-space: normal;
}

td {
    font-size: 7.8px;
    line-height: 1.1;
}

.center {
    text-align: center;
}

.right {
    text-align: right;
}

.left {
    text-align: left;
}

.produtos th:nth-child(1) { width: 4%; }
.produtos th:nth-child(2) { width: 8%; }
.produtos th:nth-child(3) { width: 28%; }
.produtos th:nth-child(4) { width: 8%; }
.produtos th:nth-child(5) { width: 8%; }
.produtos th:nth-child(6) { width: 7%; }
.produtos th:nth-child(7) { width: 5%; }
.produtos th:nth-child(8) { width: 8%; }
.produtos th:nth-child(9) { width: 8%; }
.produtos th:nth-child(10) { width: 9%; }
.produtos th:nth-child(11) { width: 3.5%; }
.produtos th:nth-child(12) { width: 3.5%; }

.totais td {
    min-height: 38px;
}

.totais .value {
    font-size: 9px;
}

.total-final {
    font-size: 11px;
    font-weight: bold;
}

.footer {
    padding: 5px;
}

.protocol {
    padding: 5px;
    font-size: 7.5px;
}

.protocol strong {
    font-size: 8px;
}

.small {
    font-size: 6.5px;
}

@media print {

    body {
        background: #fff;
    }

    .no-print {
        display: none !important;
    }

    .section,
    .box,
    table {
        break-inside: avoid;
    }

}

</style>
</head>

<body>

<div class="danfe">

    <!-- CABEéALHO -->
    <div class="header">

        <div class="logo">
            ${
                logoDataUri
                    ? `<img
                        src="${logoDataUri}"
                        alt="Metal Racing"
                       >`
                    : `
                        <div class="logo-fallback">
                            METAL RACING
                        </div>
                      `
            }
        </div>

        <div class="company">

            <div class="label">
                Emitente
            </div>

            <div class="company-name">
                ${this.escapeHtml(emit?.xNome || '')}
            </div>

            <div class="company-fantasy">
                ${this.escapeHtml(emit?.xFant || '')}
            </div>

            <div class="company-line">
                <strong>CNPJ:</strong>
                ${this.escapeHtml(emit?.CNPJ || '')}

                &nbsp;&nbsp;

                <strong>IE:</strong>
                ${this.escapeHtml(emit?.IE || '')}

                &nbsp;&nbsp;

                <strong>CRT:</strong>
                ${this.escapeHtml(emit?.CRT || '')}
            </div>

            <div class="company-line">
                <strong>Endereço:</strong>
                ${this.escapeHtml(enderecoEmitente)}

                ${
                    bairroEmitente
                        ? ` - ${this.escapeHtml(bairroEmitente)}`
                        : ''
                }
            </div>

            <div class="company-line">
                <strong>Município:</strong>
                ${this.escapeHtml(cidadeEmitente)}

                &nbsp;&nbsp;

                <strong>CEP:</strong>
                ${this.escapeHtml(emit?.enderEmit?.CEP || '')}
            </div>

            <div class="company-line">
                <strong>Fone:</strong>
                ${this.escapeHtml(emit?.enderEmit?.fone || '')}
            </div>

        </div>

        <div class="danfe-title">

            <h1>DANFE</h1>

            <div class="auxiliar">
                DOCUMENTO AUXILIAR DA<br>
                NOTA FISCAL ELETRÔNICA
            </div>

            <div class="danfe-number">
                Nº<br>
                <strong>
                    ${this.escapeHtml(ide?.nNF || '')}
                </strong>
            </div>

            <div class="danfe-serie">
                SÉRIE
                <strong>
                    ${this.escapeHtml(ide?.serie || '')}
                </strong>
            </div>

        </div>

    </div>

    <!-- CHAVE -->
    <div class="section box chave-box">

        <div class="label">
            Chave de acesso
        </div>

        <div class="chave">
            ${this.escapeHtml(chave)}
        </div>

    </div>

    <div class="box barra-box">

        <div class="barras">
            ${this.gerarBarras(chave)}
        </div>

    </div>

    <!-- STATUS -->
    <div class="section status">
        ${this.escapeHtml(status)}
    </div>

    ${
        homologacao
            ? `
                <div class="status homologacao">
                    DOCUMENTO EMITIDO EM AMBIENTE DE HOMOLOGAÇÃO
                    - SEM VALOR FISCAL
                </div>
              `
            : ''
    }

    <!-- IDENTIFICAÇÃO -->
    <div class="section">

        <div class="section-title">
            Identificação da NF-e
        </div>

        <div class="grid grid-6">

            <div class="cell cell-tight">
                <div class="label">Natureza da operação</div>
                <div class="value">
                    ${this.escapeHtml(natureza)}
                </div>
            </div>

            <div class="cell cell-tight">
                <div class="label">Data de emissão</div>
                <div class="value">
                    ${this.escapeHtml(
                        this.formatarData(ide?.dhEmi)
                    )}
                </div>
            </div>

            <div class="cell cell-tight">
                <div class="label">Tipo</div>
                <div class="value">
                    ${this.escapeHtml(tpNF)}
                </div>
            </div>

            <div class="cell cell-tight">
                <div class="label">Modelo</div>
                <div class="value">
                    ${this.escapeHtml(ide?.mod || '')}
                </div>
            </div>

            <div class="cell cell-tight">
                <div class="label">Série</div>
                <div class="value">
                    ${this.escapeHtml(ide?.serie || '')}
                </div>
            </div>

            <div class="cell cell-tight">
                <div class="label">Nº NF-e</div>
                <div class="value">
                    ${this.escapeHtml(ide?.nNF || '')}
                </div>
            </div>

        </div>

    </div>

    <!-- DESTINATÁRIO -->
    <div class="section">

        <div class="section-title">
            ${tpNF === 'Saída'
                ? 'Destinatério / Remetente'
                : 'Emitente / Remetente'}
        </div>

        <div class="grid grid-3">

            <div class="cell">
                <div class="label">
                    Nome / Razão Social
                </div>

                <div class="value">
                    ${this.escapeHtml(
                        dest?.xNome || ''
                    )}
                </div>
            </div>

            <div class="cell">
                <div class="label">
                    CPF / CNPJ
                </div>

                <div class="value">
                    ${this.escapeHtml(cnpjCpfDest)}
                </div>
            </div>

            <div class="cell">
                <div class="label">
                    Inscrição Estadual
                </div>

                <div class="value">
                    ${this.escapeHtml(ieDest)}
                </div>
            </div>

        </div>

        <div class="grid grid-4">

            <div class="cell cell-tight">
                <div class="label">
                    Endereço
                </div>

                <div class="value">
                    ${this.escapeHtml(
                        enderecoDestinatario
                    )}
                </div>
            </div>

            <div class="cell cell-tight">
                <div class="label">
                    Bairro
                </div>

                <div class="value">
                    ${this.escapeHtml(
                        dest?.enderDest?.xBairro || ''
                    )}
                </div>
            </div>

            <div class="cell cell-tight">
                <div class="label">
                    Município
                </div>

                <div class="value">
                    ${this.escapeHtml(
                        cidadeDestinatario
                    )}
                </div>
            </div>

            <div class="cell cell-tight">
                <div class="label">
                    CEP
                </div>

                <div class="value">
                    ${this.escapeHtml(
                        dest?.enderDest?.CEP || ''
                    )}
                </div>
            </div>

        </div>

    </div>

    <!-- PRODUTOS -->
    <div class="section">

        <div class="section-title">
            Produtos / Serviços
        </div>

        <table class="produtos">

            <thead>

                <tr>
                    <th>ITEM</th>
                    <th>CÓDIGO</th>
                    <th>DESCRIÇÃO</th>
                    <th>NCM/SH</th>
                    <th>CST/CSOSN</th>
                    <th>CFOP</th>
                    <th>UN</th>
                    <th>QTD</th>
                    <th>V. UNIT.</th>
                    <th>V. TOTAL</th>
                    <th>PIS</th>
                    <th>COFINS</th>
                </tr>

            </thead>

            <tbody>
                ${linhasProdutos}
            </tbody>

        </table>

    </div>

    <!-- CÁLCULO DO IMPOSTO -->
    <div class="section">

        <div class="section-title">
            Cálculo do Imposto
        </div>

        <div class="grid grid-5">

            <div class="cell cell-tight">
                <div class="label">
                    Base de cálculo do ICMS
                </div>

                <div class="value right">
                    R$ ${this.formatarNumero(bcICMS)}
                </div>
            </div>

            <div class="cell cell-tight">
                <div class="label">
                    Valor do ICMS
                </div>

                <div class="value right">
                    R$ ${this.formatarNumero(valorICMS)}
                </div>
            </div>

            <div class="cell cell-tight">
                <div class="label">
                    Base de cálculo ICMS ST
                </div>

                <div class="value right">
                    R$ ${this.formatarNumero(bcICMSST)}
                </div>
            </div>

            <div class="cell cell-tight">
                <div class="label">
                    Valor do ICMS ST
                </div>

                <div class="value right">
                    R$ ${this.formatarNumero(valorICMSST)}
                </div>
            </div>

            <div class="cell cell-tight">
                <div class="label">
                    Valor do IPI
                </div>

                <div class="value right">
                    R$ ${this.formatarNumero(valorIPI)}
                </div>
            </div>

        </div>

        <div class="grid grid-5">

            <div class="cell cell-tight">
                <div class="label">
                    Valor do PIS
                </div>

                <div class="value right">
                    R$ ${this.formatarNumero(valorPIS)}
                </div>
            </div>

            <div class="cell cell-tight">
                <div class="label">
                    Valor da COFINS
                </div>

                <div class="value right">
                    R$ ${this.formatarNumero(valorCOFINS)}
                </div>
            </div>

            <div class="cell cell-tight">
                <div class="label">
                    FCP
                </div>

                <div class="value right">
                    R$ ${this.formatarNumero(total?.vFCP)}
                </div>
            </div>

            <div class="cell cell-tight">
                <div class="label">
                    Outras despesas
                </div>

                <div class="value right">
                    R$ ${this.formatarNumero(valorOutros)}
                </div>
            </div>

            <div class="cell cell-tight">
                <div class="label">
                    Valor total dos produtos
                </div>

                <div class="value right">
                    R$ ${this.formatarNumero(valorProdutos)}
                </div>
            </div>

        </div>

    </div>

    <!-- TOTAIS -->
    <div class="section">

        <div class="section-title">
            Totais da NF-e
        </div>

        <div class="grid grid-6 totais">

            <div class="cell">
                <div class="label">
                    Frete
                </div>
                <div class="value right">
                    R$ ${this.formatarNumero(valorFrete)}
                </div>
            </div>

            <div class="cell">
                <div class="label">
                    Seguro
                </div>
                <div class="value right">
                    R$ ${this.formatarNumero(valorSeguro)}
                </div>
            </div>

            <div class="cell">
                <div class="label">
                    Desconto
                </div>
                <div class="value right">
                    R$ ${this.formatarNumero(valorDesconto)}
                </div>
            </div>

            <div class="cell">
                <div class="label">
                    IPI
                </div>
                <div class="value right">
                    R$ ${this.formatarNumero(valorIPI)}
                </div>
            </div>

            <div class="cell">
                <div class="label">
                    PIS + COFINS
                </div>
                <div class="value right">
                    R$ ${this.formatarNumero(
                        Number(valorPIS) +
                        Number(valorCOFINS)
                    )}
                </div>
            </div>

            <div class="cell">
                <div class="label">
                    Valor total da NF-e
                </div>
                <div class="value right total-final">
                    R$ ${this.formatarNumero(valorNF)}
                </div>
            </div>

        </div>

    </div>

    <!-- TRANSPORTE -->
    <div class="section">

        <div class="section-title">
            Transportador / Volumes Transportados
        </div>

        <div class="grid grid-4">

            <div class="cell">
                <div class="label">
                    Transportadora
                </div>

                <div class="value">
                    ${this.escapeHtml(
                        transp?.transporta?.xNome ||
                        'Não informado'
                    )}
                </div>
            </div>

            <div class="cell">
                <div class="label">
                    CNPJ / CPF
                </div>

                <div class="value">
                    ${this.escapeHtml(
                        transp?.transporta?.CNPJ ||
                        transp?.transporta?.CPF ||
                        ''
                    )}
                </div>
            </div>

            <div class="cell">
                <div class="label">
                    Frete por conta
                </div>

                <div class="value">
                    ${this.escapeHtml(
                        this.obterModalidadeFrete(
                            transp?.modFrete
                        )
                    )}
                </div>
            </div>

            <div class="cell">
                <div class="label">
                    Placa / UF
                </div>

                <div class="value">
                    ${
                        transp?.veicTransp?.placa
                            ? this.escapeHtml(
                                `${transp.veicTransp.placa} / ${transp.veicTransp.UF || ''}`
                            )
                            : 'Não informado'
                    }
                </div>
            </div>

        </div>

        <table>

            <thead>
                <tr>
                    <th>QUANTIDADE</th>
                    <th>ESPÉCIE</th>
                    <th>MARCA</th>
                    <th>NUMERAÇÃO</th>
                    <th>PESO BRUTO</th>
                    <th>PESO LÍQUIDO</th>
                </tr>
            </thead>

            <tbody>
                ${linhasVolumes}
            </tbody>

        </table>

    </div>

    <!-- PAGAMENTO -->
    <div class="section">

        <div class="section-title">
            Faturamento / Pagamento
        </div>

        <div class="grid grid-3">

            <div class="cell">

                <div class="label">
                    Número da fatura
                </div>

                <div class="value">
                    ${this.escapeHtml(
                        fatura?.nFat || 'Não informado'
                    )}
                </div>

            </div>

            <div class="cell">

                <div class="label">
                    Valor original
                </div>

                <div class="value right">
                    R$ ${this.formatarNumero(
                        fatura?.vOrig
                    )}
                </div>

            </div>

            <div class="cell">

                <div class="label">
                    Valor líquido
                </div>

                <div class="value right">
                    R$ ${this.formatarNumero(
                        fatura?.vLiq
                    )}
                </div>

            </div>

        </div>

        <table>

            <thead>

                <tr>
                    <th>FORMA DE PAGAMENTO</th>
                    <th>VALOR</th>
                </tr>

            </thead>

            <tbody>
                ${linhasPagamento}
            </tbody>

        </table>

        ${
            duplicatas.length
                ? `
                    <table>

                        <thead>
                            <tr>
                                <th>NºMERO</th>
                                <th>VENCIMENTO</th>
                                <th>VALOR</th>
                            </tr>
                        </thead>

                        <tbody>
                            ${linhasFaturamento}
                        </tbody>

                    </table>
                  `
                : ''
        }

    </div>

    <!-- INFORMAÇÕES ADICIONAIS -->
    <div class="section box footer">

        <div class="section-title">
            Informações adicionais
        </div>

        <div class="value">
            ${this.escapeHtml(
                infAdic?.infCpl ||
                'Nenhuma informação adicional informada.'
            )}
        </div>

    </div>

    <!-- RESPONSÁVEL TéCNICO -->
    ${
        infRespTec?.CNPJ ||
        infRespTec?.xContato ||
        infRespTec?.email ||
        infRespTec?.fone
            ? `
                <div class="section box footer">

                    <div class="section-title">
                        Responsável técnico
                    </div>

                    <div class="value">
                        <strong>CNPJ:</strong>
                        ${this.escapeHtml(
                            infRespTec?.CNPJ || ''
                        )}

                        &nbsp;&nbsp;

                        <strong>Contato:</strong>
                        ${this.escapeHtml(
                            infRespTec?.xContato || ''
                        )}

                        &nbsp;&nbsp;

                        <strong>E-mail:</strong>
                        ${this.escapeHtml(
                            infRespTec?.email || ''
                        )}

                        &nbsp;&nbsp;

                        <strong>Fone:</strong>
                        ${this.escapeHtml(
                            infRespTec?.fone || ''
                        )}
                    </div>

                </div>
              `
            : ''
    }

    <!-- PROTOCOLO -->
    <div class="section box protocol">

        <strong>
            Protocolo de autorização:
        </strong>

        ${this.escapeHtml(
            protocoloNFe?.nProt ||
            'Não informado'
        )}

        &nbsp;&nbsp;&nbsp;

        <strong>
            Data de autorização:
        </strong>

        ${this.escapeHtml(
            this.formatarData(
                protocoloNFe?.dhRecbto
            ) || 'Não informado'
        )}

        &nbsp;&nbsp;&nbsp;

        <strong>
            Status SEFAZ:
        </strong>

        ${this.escapeHtml(
            protocoloNFe?.cStat ||
            ''
        )}

        ${
            protocoloNFe?.xMotivo
                ? `
                    <br>
                    <strong>Motivo:</strong>
                    ${this.escapeHtml(
                        protocoloNFe.xMotivo
                    )}
                  `
                : ''
        }

    </div>

    <div class="section small">

        ${
            homologacao
                ? 'Documento emitido em ambiente de homologação - sem valor fiscal.'
                : 'Documento auxiliar da Nota Fiscal Eletrônica.'
        }

    </div>

</div>

<script>

window.onload = function () {

    setTimeout(function () {

        window.print();

    }, 500);

};

</script>

</body>
</html>
`;
    }
}

export default new DanfeService();
