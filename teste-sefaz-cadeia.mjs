import "dotenv/config";
import fs from "fs";
import https from "https";
import axios from "axios";
import forge from "node-forge";

const certPath = "./certificados/empresa_1.pfx";
const senha = process.env.CERT_SENHA;

const pfxBuffer = fs.readFileSync(certPath);

const pfxAsn1 = forge.asn1.fromDer(
    forge.util.createBuffer(pfxBuffer.toString("binary"))
);

const p12 = forge.pkcs12.pkcs12FromAsn1(
    pfxAsn1,
    false,
    senha
);

const certBag = p12.getBags({
    bagType: forge.pki.oids.certBag
})[forge.pki.oids.certBag][0];

const keyBag = p12.getBags({
    bagType: forge.pki.oids.pkcs8ShroudedKeyBag
})[forge.pki.oids.pkcs8ShroudedKeyBag][0];

const certificate = forge.pki.certificateToPem(certBag.cert);
const privateKey = forge.pki.privateKeyToPem(keyBag.key);

const httpsAgent = new https.Agent({
    cert: certificate,
    key: privateKey,
    rejectUnauthorized: false
});

const url =
    "https://nfe-homologacao.svrs.rs.gov.br/ws/NfeStatusServico/NfeStatusServico4.asmx";

const soap = `<?xml version="1.0" encoding="utf-8"?>
<soap12:Envelope
 xmlns:soap12="http://www.w3.org/2003/05/soap-envelope">
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

console.log("TESTE TEMPORÁRIO");
console.log("Validação do servidor: DESATIVADA SOMENTE NESTE TESTE");
console.log("Conectando...");

try {
    const response = await axios.post(url, soap, {
        httpsAgent,
        timeout: 30000,
        headers: {
            "Content-Type": "application/soap+xml; charset=utf-8"
        },
        validateStatus: () => true
    });

    console.log("");
    console.log("HTTP:", response.status);
    console.log("");
    console.log(response.data);

} catch (error) {
    console.error("");
    console.error("ERRO:", error.message);
    console.error("CÓDIGO:", error.code);
}
