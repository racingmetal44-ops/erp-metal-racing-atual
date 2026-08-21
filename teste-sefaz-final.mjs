import 'dotenv/config';
import fs from 'fs';
import https from 'https';
import axios from 'axios';
import forge from 'node-forge';

const PFX_PATH = './certificados/empresa_1.pfx';
const SENHA = process.env.CERT_SENHA;

const URL =
  'https://nfe-homologacao.svrs.rs.gov.br/ws/NfeStatusServico/NfeStatusServico4.asmx';

console.log('========================================');
console.log(' TESTE A1 + SOAP 1.2 + SEFAZ/SVRS');
console.log('========================================');

if (!fs.existsSync(PFX_PATH)) {
  throw new Error('PFX não encontrado: ' + PFX_PATH);
}

console.log('PFX: OK');

const pfx = fs.readFileSync(PFX_PATH);

const p12Asn1 = forge.asn1.fromDer(
  forge.util.createBuffer(pfx.toString('binary')).getBytes()
);

const p12 = forge.pkcs12.pkcs12FromAsn1(
  p12Asn1,
  false,
  SENHA
);

const certBags = p12.getBags({
  bagType: forge.pki.oids.certBag
})[forge.pki.oids.certBag];

const keyBags = p12.getBags({
  bagType: forge.pki.oids.pkcs8ShroudedKeyBag
})[forge.pki.oids.pkcs8ShroudedKeyBag];

const cert = certBags[0].cert;
const privateKey = keyBags[0].key;

const certPem = forge.pki.certificateToPem(cert);
const keyPem = forge.pki.privateKeyToPem(privateKey);

console.log('Certificado PEM: OK');
console.log('Chave privada PEM: OK');

const httpsAgent = new https.Agent({
  cert: certPem,
  key: keyPem,
  rejectUnauthorized: false
});

const soap = `<?xml version="1.0" encoding="utf-8"?>
<soap12:Envelope
    xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
    xmlns:xsd="http://www.w3.org/2001/XMLSchema"
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

console.log('');
console.log('URL:');
console.log(URL);

console.log('');
console.log('SOAPAction:');
console.log(
  'http://www.portalfiscal.inf.br/nfe/wsdl/NfeStatusServico4/nfeStatusServicoNF'
);

console.log('');
console.log('Enviando...');

try {

  const response = await axios.post(URL, soap, {

    httpsAgent,

    timeout: 60000,

    headers: {
      'Content-Type':
        'application/soap+xml; charset=utf-8; action="http://www.portalfiscal.inf.br/nfe/wsdl/NfeStatusServico4/nfeStatusServicoNF"',
      'Accept': 'application/soap+xml, text/xml, */*'
    },

    validateStatus: () => true

  });

  console.log('');
  console.log('========================================');
  console.log(' RESPOSTA DA SVRS');
  console.log('========================================');

  console.log('HTTP:', response.status);

  console.log('');
  console.log(response.data);

} catch (error) {

  console.log('');
  console.log('========================================');
  console.log(' ERRO');
  console.log('========================================');

  console.log('Mensagem:', error.message);
  console.log('Código:', error.code);

}
