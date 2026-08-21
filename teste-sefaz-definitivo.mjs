import "dotenv/config";
import fs from "fs";
import https from "https";
import axios from "axios";
import forge from "node-forge";

console.log("========================================");
console.log(" TESTE SEFAZ SVRS - XML SEM FORMATAÇÃO");
console.log("========================================");

const pfxPath = "./certificados/empresa_1.pfx";

if (!fs.existsSync(pfxPath)) {
    console.error("ERRO: PFX não encontrado");
    console.error(pfxPath);
    process.exit(1);
}

const pfxBuffer = fs.readFileSync(pfxPath);

console.log("PFX: OK");

const p12Asn1 = forge.asn1.fromDer(
    forge.util.createBuffer(
        pfxBuffer.toString("binary")
    ).getBytes()
);

const p12 = forge.pkcs12.pkcs12FromAsn1(
    p12Asn1,
    false,
    process.env.CERT_SENHA
);

const certBags = p12.getBags({
    bagType: forge.pki.oids.certBag
})[forge.pki.oids.certBag];

const keyBags = p12.getBags({
    bagType: forge.pki.oids.pkcs8ShroudedKeyBag
})[forge.pki.oids.pkcs8ShroudedKeyBag];

if (!certBags?.length) {
    throw new Error("Certificado não encontrado dentro do PFX");
}

if (!keyBags?.length) {
    throw new Error("Chave privada não encontrada dentro do PFX");
}

const cert = certBags[0].cert;
const privateKey = keyBags[0].key;

const certificatePem = forge.pki.certificateToPem(cert);
const privateKeyPem = forge.pki.privateKeyToPem(privateKey);

console.log("Certificado: OK");
console.log("Chave privada: OK");

const httpsAgent = new https.Agent({
    cert: certificatePem,
    key: privateKeyPem,
    rejectUnauthorized: false
});

const url =
    "https://nfe-homologacao.svrs.rs.gov.br/ws/NfeStatusServico/NfeStatusServico4.asmx";

const soapAction =
    "http://www.portalfiscal.inf.br/nfe/wsdl/NFeStatusServico4/nfeStatusServicoNF";

/*
 * IMPORTANTE:
 * XML propositalmente sem espaços/quebras dentro de consStatServ.
 */
const soap =
`<?xml version="1.0" encoding="utf-8"?>` +
`<soap12:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" ` +
`xmlns:xsd="http://www.w3.org/2001/XMLSchema" ` +
`xmlns:soap12="http://www.w3.org/2003/05/soap-envelope">` +
`<soap12:Body>` +
`<nfeDadosMsg xmlns="http://www.portalfiscal.inf.br/nfe/wsdl/NFeStatusServico4">` +
`<consStatServ versao="4.00" xmlns="http://www.portalfiscal.inf.br/nfe">` +
`<tpAmb>2</tpAmb>` +
`<cUF>42</cUF>` +
`<xServ>STATUS</xServ>` +
`</consStatServ>` +
`</nfeDadosMsg>` +
`</soap12:Body>` +
`</soap12:Envelope>`;

console.log("");
console.log("URL:");
console.log(url);

console.log("");
console.log("SOAPAction:");
console.log(soapAction);

console.log("");
console.log("XML enviado:");
console.log(soap);

console.log("");
console.log("Enviando SOAP 1.2...");

try {

    const response = await axios.post(
        url,
        soap,
        {
            httpsAgent,
            timeout: 60000,

            headers: {
                "Content-Type":
                    `application/soap+xml; charset=utf-8; action="${soapAction}"`,

                "Accept":
                    "application/soap+xml, application/xml, text/xml"
            },

            validateStatus: () => true
        }
    );

    console.log("");
    console.log("========================================");
    console.log(" RESPOSTA SVRS");
    console.log("========================================");

    console.log("HTTP:", response.status);
    console.log("");
    console.log(response.data);

} catch (error) {

    console.log("");
    console.log("========================================");
    console.log(" ERRO");
    console.log("========================================");

    console.log("Mensagem:", error.message);
    console.log("Código:", error.code);

    if (error.response) {
        console.log("HTTP:", error.response.status);
        console.log(error.response.data);
    }
}
