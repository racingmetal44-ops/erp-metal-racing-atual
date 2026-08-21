import https from 'https';
import fs from 'fs';

const certPath = './certificados/empresa_1787261142745-cert.pem';
const keyPath = './certificados/empresa_1787261142745-key.pem';
const caPath = './certificados/sefaz-ca-bundle.pem';

const cert = fs.readFileSync(certPath);
const key = fs.readFileSync(keyPath);
const ca = fs.readFileSync(caPath);

const url = 'https://nfe-homologacao.svrs.rs.gov.br/ws/NfeStatusServico/NfeStatusServico4.asmx';

/*
 * IMPORTANTE:
 * O consStatServ deve ser enviado sem espaços/quebras
 * entre as tags.
 */
const consStatServ =
    '<consStatServ versao="4.00" xmlns="http://www.portalfiscal.inf.br/nfe">' +
    '<tpAmb>2</tpAmb>' +
    '<cUF>42</cUF>' +
    '<xServ>STATUS</xServ>' +
    '</consStatServ>';

const soap =
    '<?xml version="1.0" encoding="UTF-8"?>' +
    '<soap12:Envelope xmlns:soap12="http://www.w3.org/2003/05/soap-envelope">' +
    '<soap12:Body>' +
    '<nfeDadosMsg xmlns="http://www.portalfiscal.inf.br/nfe/wsdl/NFeStatusServico4">' +
    consStatServ +
    '</nfeDadosMsg>' +
    '</soap12:Body>' +
    '</soap12:Envelope>';

const parsed = new URL(url);

const options = {
    hostname: parsed.hostname,
    port: 443,
    path: parsed.pathname,
    method: 'POST',

    cert,
    key,
    ca,

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
console.log('CA SEFAZ: OK');
console.log('');
console.log('XML enviado sem caracteres de edição internos:');
console.log(soap);
console.log('');
console.log('Conectando à SEFAZ...');

const req = https.request(options, (res) => {

    console.log('');
    console.log('HTTP Status:', res.statusCode);
    console.log('Status:', res.statusMessage);

    let body = '';

    res.setEncoding('utf8');

    res.on('data', chunk => {
        body += chunk;
    });

    res.on('end', () => {

        console.log('');
        console.log('============================================');
        console.log(' RESPOSTA SEFAZ');
        console.log('============================================');
        console.log(body);
        console.log('============================================');

        const cStatMatch = body.match(/<cStat>([^<]+)<\/cStat>/);
        const motivoMatch = body.match(/<xMotivo>([^<]+)<\/xMotivo>/);

        const cStat = cStatMatch ? cStatMatch[1] : null;
        const motivo = motivoMatch ? motivoMatch[1] : null;

        console.log('');
        console.log('cStat:', cStat || 'não encontrado');
        console.log('xMotivo:', motivo || 'não encontrado');

        if (cStat === '107') {

            console.log('');
            console.log('============================================');
            console.log(' 🎉 SEFAZ CONECTADA COM SUCESSO!');
            console.log('============================================');
            console.log('Serviço em operação.');
            console.log('Ambiente: HOMOLOGAÇÃO');
            console.log('UF: SC');
            console.log('============================================');

        } else {

            console.log('');
            console.log('⚠️ SEFAZ RESPONDEU, MAS HOUVE REJEIÇÃO.');
            console.log('Código:', cStat);
            console.log('Motivo:', motivo);
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
