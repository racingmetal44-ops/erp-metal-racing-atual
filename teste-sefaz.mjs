import fs from 'fs';
import https from 'https';
import axios from 'axios';

const empresaId = process.argv[2];

if (!empresaId) {
    console.error('Informe o ID da empresa.');
    console.error('Exemplo: node teste-sefaz.cjs 1');
    process.exit(1);
}

const certPath = `./certificados/empresa_${empresaId}.pfx`;
const senha =
    process.env.CERT_SENHA ||
    process.env.CERTIFICADO_SENHA ||
    process.env.PFX_SENHA;

console.log('');
console.log('============================================');
console.log(' TESTE REAL - SEFAZ SC');
console.log('============================================');
console.log('Certificado:', certPath);
console.log('Senha:', senha ? 'CONFIGURADA' : 'NÃO CONFIGURADA');

if (!fs.existsSync(certPath)) {
    console.error('❌ Certificado não encontrado:', certPath);
    process.exit(1);
}

if (!senha) {
    console.error('❌ Senha do certificado não configurada.');
    process.exit(1);
}

const pfx = fs.readFileSync(certPath);

const httpsAgent = new https.Agent({
    pfx,
    passphrase: senha,
    rejectUnauthorized: true,
    minVersion: 'TLSv1.2'
});

const xml = `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope
    xmlns:soap="http://www.w3.org/2003/05/soap-envelope">

    <soap:Header>
        <nfeCabecMsg
            xmlns="http://www.portalfiscal.inf.br/nfe/wsdl/NFeStatusServico4">

            <cUF>42</cUF>
            <versaoDados>4.00</versaoDados>

        </nfeCabecMsg>
    </soap:Header>

    <soap:Body>

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

    </soap:Body>

</soap:Envelope>`;

const url =
    'https://nfe-homologacao.svrs.rs.gov.br/ws/NfeStatusServico/NfeStatusServico4.asmx';

console.log('');
console.log('URL:', url);
console.log('Ambiente: HOMOLOGAÇÃO');
console.log('UF: SC');
console.log('');
console.log('Conectando à SEFAZ...');

try {

    const response = await axios.post(
        url,
        xml,
        {
            httpsAgent,

            headers: {
                'Content-Type':
                    'application/soap+xml; charset=utf-8',

                'SOAPAction':
                    '"http://www.portalfiscal.inf.br/nfe/wsdl/NFeStatusServico4/nfeStatusServicoNF"'
            },

            timeout: 60000,

            validateStatus: () => true
        }
    );

    console.log('');
    console.log('============================================');
    console.log(' RESPOSTA SEFAZ');
    console.log('============================================');

    console.log('HTTP:', response.status);

    console.log(
        String(response.data).substring(0, 5000)
    );

    console.log('');
    console.log('============================================');

} catch (error) {

    console.error('');
    console.error('============================================');
    console.error('❌ ERRO DE COMUNICAÇÃO');
    console.error('============================================');

    console.error('Mensagem:', error.message);

    if (error.code) {
        console.error('Código:', error.code);
    }

    if (error.response) {
        console.error('HTTP:', error.response.status);
        console.error(
            String(error.response.data).substring(0, 5000)
        );
    }

    console.error('============================================');

    process.exit(1);
}
