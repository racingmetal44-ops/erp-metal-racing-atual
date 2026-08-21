import "dotenv/config";
import fs from "fs";
import https from "https";
import axios from "axios";
import forge from "node-forge";

console.log("========================================");
console.log(" TESTE REAL - STATUS SEFAZ/SVRS");
console.log("========================================");

const pfxPath = "./certificados/empresa_1.pfx";
const senha = process.env.CERT_SENHA;

const pfxBuffer = fs.readFileSync(pfxPath);

const asn1 = forge.asn1.fromDer(
    forge.util.createBuffer(pfxBuffer.toString("binary"))
);

const p12 = forge.pkcs12.pkcs12FromAsn1(
    asn1,
    false,
    senha
);

const certBag = p12.getBags({
    bagType: forge.pki.oids.certBag
})[forge.pki.oids.certBag][0];

const keyBag = p12.getBags({
    bagType: forge.pki.oids.pkcs8ShroudedKeyBag
})[forge.pki.oids.pkcs8ShroudedKeyBag][0];

const cert = forge.pki.certificateToPem(certBag.cert);
const key = forge.pki.privateKeyToPem(keyBag.key);

console.log("Certificado: OK");
console.log("Chave privada: OK");

const agent = new https.Agent({
    cert,
    key,
    rejectUnauthorized: false
});

const url =
    "https://nfe-homologacao.svrs.rs.gov.br/ws/NfeStatusServico/NfeStatusServico4.asmx";

const xml = `<?xml version="1.0" encoding="utf-8"?>
<soap12:Envelope
    xmlns:soap12="http://www.w3.org/2003/05/soap-envelope">

    <soap12:Header>
        <nfeCabecMsg
            xmlns="http://www.portalfiscal.inf.br/nfe/wsdl/NfeStatusServico4">
            <cUF>42</cUF>
            <versaoDados>4.00</versaoDados>
        </nfeCabecMsg>
    </soap12:Header>

    <soap12:Body>
        <nfeDadosMsg
            xmlns="http://www.portalfiscal.inf.br/nfe/wsdl/NfeStatusServico4">

            <consStatServ
                xmlns="http://www.portalfiscal.inf.br/nfe"
                versao="4.00">

                <tpAmb>2</tpAmb>
                <cUF>42</cUF>
                <xServ>STATUS</xServ>

            </consStatServ>

        </nfeDadosMsg>
    </soap12:Body>

</soap12:Envelope>`;

console.log("");
console.log("Enviando POST para SVRS...");
console.log(url);

try {

    const resposta = await axios({
        method: "POST",
        url,
        data: xml,
        httpsAgent: agent,
        timeout: 30000,

        headers: {
            "Content-Type": "application/soap+xml; charset=utf-8; action=\"http://www.portalfiscal.inf.br/nfe/wsdl/NfeStatusServico4/nfeStatusServicoNF\""
        },

        transformResponse: [
            data => data
        ],

        validateStatus: () => true
    });

    console.log("");
    console.log("========================================");
    console.log(" RESPOSTA DA SVRS");
    console.log("========================================");

    console.log("HTTP:", resposta.status);
    console.log("");
    console.log(resposta.data);

} catch (erro) {

    console.log("");
    console.log("========================================");
    console.log(" ERRO");
    console.log("========================================");

    console.log("Mensagem:", erro.message);
    console.log("Código:", erro.code);

}
