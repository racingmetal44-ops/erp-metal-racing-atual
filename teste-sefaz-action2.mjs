import 'dotenv/config';
import fs from 'fs';
import https from 'https';
import axios from 'axios';
import forge from 'node-forge';

const pfx = fs.readFileSync('./certificados/empresa_1.pfx');
const senha = process.env.CERT_SENHA;

const asn1 = forge.asn1.fromDer(
  forge.util.createBuffer(pfx.toString('binary')).getBytes()
);

const p12 = forge.pkcs12.pkcs12FromAsn1(asn1, false, senha);

const certBag = p12.getBags({
  bagType: forge.pki.oids.certBag
})[forge.pki.oids.certBag][0];

const keyBag = p12.getBags({
  bagType: forge.pki.oids.pkcs8ShroudedKeyBag
})[forge.pki.oids.pkcs8ShroudedKeyBag][0];

const certPem = forge.pki.certificateToPem(certBag.cert);
const keyPem = forge.pki.privateKeyToPem(keyBag.key);

const httpsAgent = new https.Agent({
  cert: certPem,
  key: keyPem,
  rejectUnauthorized: false
});

const url =
  'https://nfe-homologacao.svrs.rs.gov.br/ws/NfeStatusServico/NfeStatusServico4.asmx';

const soap = `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope
 xmlns:soap="http://www.w3.org/2003/05/soap-envelope">
 <soap:Body>
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
 </soap:Body>
</soap:Envelope>`;

console.log('========================================');
console.log(' TESTE SOAP ACTION ALTERNATIVO');
console.log('========================================');

try {

  const response = await axios.post(url, soap, {
    httpsAgent,
    timeout: 60000,
    headers: {
      'Content-Type':
        'application/soap+xml; charset=utf-8; action="http://www.portalfiscal.inf.br/nfe/wsdl/NfeStatusServico"',
      'SOAPAction':
        '"http://www.portalfiscal.inf.br/nfe/wsdl/NfeStatusServico"'
    },
    validateStatus: () => true
  });

  console.log('HTTP:', response.status);
  console.log('');
  console.log(response.data);

} catch (error) {

  console.error('ERRO:', error.message);
  console.error('CÓDIGO:', error.code);

}
