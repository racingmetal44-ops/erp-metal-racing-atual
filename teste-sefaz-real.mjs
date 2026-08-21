import fs from 'fs';
import https from 'https';

const certPath = './certificados/empresa_1787261142745.pfx';
const senha = process.env.CERT_SENHA;

if (!senha) {
    console.error('❌ CERT_SENHA não configurada.');
    process.exit(1);
}

if (!fs.existsSync(certPath)) {
    console.error('❌ Certificado não encontrado:', certPath);
    process.exit(1);
}

const pfx = fs.readFileSync(certPath);

const agent = new https.Agent({
    pfx,
    passphrase: senha,
    rejectUnauthorized: true,
    minVersion: 'TLSv1.2'
});

const url =
    'https://nfe-homologacao.svrs.rs.gov.br/ws/NfeStatusServico/NfeStatusServico4.asmx';

const soap = `<?xml version="1.0" encoding="utf-8"?>
<soap12:Envelope
    xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
    xmlns:xsd="http://www.w3.org/2001/XMLSchema"
    xmlns:soap12="http://www.w3.org/2003/05/soap-envelope">

    <soap12:Body>
        <nfeDadosMsg
            xmlns="http://www.portalfiscal.inf.br/nfe/wsdl/NFeStatusServico4">

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
console.log('============================================');
console.log(' TESTE REAL SEFAZ-SC');
console.log('============================================');
console.log('Empresa ID: 1787261142745');
console.log('Certificado: OK');
console.log('Ambiente: HOMOLOGAÇÃO');
console.log('UF: SC');
console.log('URL:', url);
console.log('');
console.log('Conectando à SEFAZ...');
console.log('');

const req = https.request(
    url,
    {
        method: 'POST',
        agent,

        headers: {
            'Content-Type': 'application/soap+xml; charset=utf-8',
            'Content-Length': Buffer.byteLength(soap)
        },

        timeout: 60000
    },
    response => {

        let body = '';

        console.log('HTTP:', response.statusCode);

        response.on('data', chunk => {
            body += chunk.toString();
        });

        response.on('end', () => {

            console.log('');
            console.log('============================================');
            console.log(' RESPOSTA SEFAZ');
            console.log('============================================');

            console.log(body.substring(0, 5000));

            const cStat = body.match(
                /<(?:[\w-]+:)?cStat\b[^>]*>([\s\S]*?)<\/(?:[\w-]+:)?cStat>/
            );

            const xMotivo = body.match(
                /<(?:[\w-]+:)?xMotivo\b[^>]*>([\s\S]*?)<\/(?:[\w-]+:)?xMotivo>/
            );

            console.log('');
            console.log('cStat:', cStat ? cStat[1] : 'não encontrado');
            console.log(
                'xMotivo:',
                xMotivo ? xMotivo[1] : 'não encontrado'
            );

            console.log('');
            console.log('============================================');

            if (cStat && cStat[1] === '107') {
                console.log('✅ SEFAZ RESPONDEU: SERVIÇO EM OPERAÇÃO');
            } else {
                console.log('⚠️ SEFAZ respondeu, mas verificar cStat.');
            }

            console.log('============================================');
        });
    }
);

req.on('timeout', () => {
    console.error('❌ Timeout aguardando SEFAZ.');
    req.destroy();
});

req.on('error', error => {
    console.error('');
    console.error('============================================');
    console.error('❌ ERRO NA COMUNICAÇÃO');
    console.error('============================================');
    console.error(error.code || '');
    console.error(error.message);
});

req.write(soap);
req.end();
