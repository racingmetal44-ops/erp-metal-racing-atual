import "dotenv/config";
import fs from "fs";
import https from "https";
import axios from "axios";
import forge from "node-forge";

const pfxPath = "./certificados/empresa_1.pfx";
const senha = process.env.CERT_SENHA;

console.log("========================================");
console.log(" TESTE STATUS SEFAZ/SVRS - SOAP 1.2");
console.log("========================================");

console.log("Lendo certificado...");

const pfxBuffer = fs.readFileSync(pfxPath);

const p12Asn1 = forge.asn1.fromDer(
    forge.util.createBuffer(pfxBuffer.toString("binary")).getBytes()
);

const p12 = forge.pkcs12.pkcs12FromAsn1(
    p12Asn1,
    false,
    senha
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

console.log("Certificado PEM: OK");
console.log("Chave privada PEM: OK");

const httpsAgent = new https.Agent({
    cert: certificatePem,
    key: privateKeyPem,
    rejectUnauthorized: false
});

const url =
    "https://nfe-homologacao.svrs.rs.gov.br/ws/NfeStatusServico/NfeStatusServico4.asmx";

const soap = `<?xml version="1.0" encoding="utf-8"?>
<soap12:Envelope
    xmlns:soap12="http://www.w3.org/2003/05/soap-envelope"
    xmlns:nfe="http://www.portalfiscal.inf.br/nfe/wsdl/NfeStatusServico4">

  <soap12:Header/>

  <soap12:Body>

    <nfe:nfeStatusServicoNF>
      <nfe:nfeDadosMsg>
        <consStatServ
          xmlns="http://www.portalfiscal.inf.br/nfe"
          versao="4.00">

          <tpAmb>2</tpAmb>
          <cUF>42</cUF>
          <xServ>STATUS</xServ>

        </consStatServ>
      </nfe:nfeDadosMsg>
    </nfe:nfeStatusServicoNF>

  </soap12:Body>

</soap12:Envelope>`;

console.log("");
console.log("URL:");
console.log(url);

console.log("");
console.log("SOAPAction:");
console.log(
    '"http://www.portalfiscal.inf.br/nfe/wsdl/NfeStatusServico4/nfeStatusServicoNF"'
);

console.log("");
console.log("Enviando...");

try {

    const response = await axios.post(url, soap, {

        httpsAgent,

        timeout: 60000,

        headers: {
            "Content-Type":
                'application/soap+xml; charset=utf-8; action="http://www.portalfiscal.inf.br/nfe/wsdl/NfeStatusServico4/nfeStatusServicoNF"',
            "SOAPAction":
                '"http://www.portalfiscal.inf.br/nfe/wsdl/NfeStatusServico4/nfeStatusServicoNF"'
        },

        validateStatus: () => true

    });

    console.log("");
    console.log("========================================");
    console.log(" RESPOSTA");
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
