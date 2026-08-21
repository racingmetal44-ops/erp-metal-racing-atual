import https from 'https';
import fs from 'fs';

const certPath = './certificados/empresa_1787261142745-cert.pem';
const keyPath = './certificados/empresa_1787261142745-key.pem';

const cert = fs.readFileSync(certPath);
const key = fs.readFileSync(keyPath);

const url = 'https://nfe-homologacao.svrs.rs.gov.br/ws/NfeStatusServico/NfeStatusServico4.asmx';

const soap = `<?xml version="1.0" encoding="utf-8"?>
<soap12:Envelope
    xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
    xmlns:xsd="http://www.w3.org/2001/XMLSchema"
    xmlns:soap12="http://www.w3.org/2003/05/soap-envelope">
  <soap12:Body>
    <nfeDadosMsg xmlns="http://www.portalfiscal.inf.br/nfe/wsdl/NFeStatusServico4">
      <consStatServ
          xmlns="http://www.portalfiscal.inf.br/nfe"
          versao="4.00"
          cUF="42"
          tpAmb="2">
        <xServ>STATUS</xServ>
      </consStatServ>
    </nfeDadosMsg>
  </soap12:Body>
</soap12:Envelope>`;

const parsed = new URL(url);

const options = {
    hostname: parsed.hostname,
    port: 443,
    path: parsed.pathname,
    method: 'POST',

    cert,
    key,

    rejectUnauthorized: true,

    headers: {
        'Content-Type': 'application/soap+xml; charset=utf-8',
        'Content-Length': Buffer.byteLength(soap),
        'User-Agent': 'ERP Metal Racing/1.0'
    }
};

console.log('');
console.log('============================================');
console.log(' TESTE REAL SEFAZ-SC');
console.log('============================================');
console.log('Empresa: ART GRAV COMUNICACAO INDUSTRIAL LTDA');
console.log('CNPJ: 13.862.162/0001-80');
console.log('UF: SC');
console.log('Ambiente: HOMOLOGAÇÃO');
console.log('URL:', url);
console.log('');
console.log('Certificado PEM: OK');
console.log('Chave privada PEM: OK');
console.log('');
console.log('Conectando à SEFAZ...');
console.log('');

const req = https.request(options, (res) => {

    console.log('HTTP Status:', res.statusCode);
    console.log('Status:', res.statusMessage);
    console.log('');

    let body = '';

    res.setEncoding('utf8');

    res.on('data', chunk => {
        body += chunk;
    });

    res.on('end', () => {

        console.log('============================================');
        console.log(' RESPOSTA SEFAZ');
        console.log('============================================');
        console.log(body);
        console.log('============================================');

        if (body.includes('<cStat>107</cStat>')) {
            console.log('');
            console.log('✅ SEFAZ CONECTADA');
            console.log('✅ Serviço em operação');
            console.log('');
        } else if (body.includes('<cStat>')) {
            const match = body.match(/<cStat>(.*?)<\/cStat>/);
            const motivo = body.match(/<xMotivo>(.*?)<\/xMotivo>/);

            console.log('');
            console.log('⚠️ SEFAZ RESPONDEU');
            console.log('cStat:', match ? match[1] : 'não encontrado');
            console.log('xMotivo:', motivo ? motivo[1] : 'não encontrado');
        } else {
            console.log('');
            console.log('❌ Resposta não reconhecida da SEFAZ');
        }
    });
});

req.on('error', (error) => {
    console.log('');
    console.log('============================================');
    console.log(' ❌ ERRO NA COMUNICAÇÃO');
    console.log('============================================');
    console.log('Código:', error.code);
    console.log('Mensagem:', error.message);
    console.log('');
});

req.write(soap);
req.end();

