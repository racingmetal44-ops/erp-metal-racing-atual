import "dotenv/config";
import fs from "fs";
import https from "https";
import axios from "axios";
import forge from "node-forge";

console.log("========================================");
console.log(" TESTE SEFAZ SVRS - SOAP 1.1");
console.log("========================================");

const pfxPath = "./certificados/empresa_1.pfx";

if (!fs.existsSync(pfxPath)) {
    console.error("ERRO: certificado não encontrado:");
    console.error(pfxPath);
    process.exit(1);
}

const pfxBuffer = fs.readFileSync(pfxPath);

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

const certBag = p12.getBags({
    bagType: forge.pki.oids.certBag
})[forge.pki.oids.certBag][0];

const keyBag = p12.getBags({
    bagType: forge.pki.oids.pkcs8ShroudedKeyBag
})[forge.pki.oids.pkcs8ShroudedKeyBag][0];

const cert = certBag.cert;
const privateKey = keyBag.key;

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
    "http://www.portalfiscal.inf.br/nfe/wsdl/NfeStatusServico4/nfeStatusServicoNF";

const soap = `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
    <soap:Header/>
    <soap:Body>
        <nfeStatusServicoNF xmlns="http://www.portalfiscal.inf.br/nfe/wsdl/NfeStatusServico4">
            <nfeDadosMsg>
                <consStatServ xmlns="http://www.portalfiscal.inf.br/nfe" versao="4.00">
                    <tpAmb>2</tpAmb>
                    <cUF>42</cUF>
                    <xServ>STATUS</xServ>
                </consStatServ>
            </nfeDadosMsg>
        </nfeStatusServicoNF>
    </soap:Body>
</soap:Envelope>`;

console.log("");
console.log("Conectando à SEFAZ/SVRS...");
console.log(url);
console.log("");
console.log("Enviando SOAP 1.1...");

try {

    const response = await axios.post(
        url,
        soap,
        {
            httpsAgent,
            timeout: 60000,

            headers: {
                "Content-Type": "text/xml; charset=utf-8",
                "SOAPAction": `"${soapAction}"`
            },

            validateStatus: () => true
        }
    );

    console.log("");
    console.log("========================================");
    console.log(" RESPOSTA DA SVRS");
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

}
