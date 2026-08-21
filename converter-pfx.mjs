import forge from 'node-forge';
import fs from 'fs';

const pfxPath = './certificados/empresa_1787261142745.pfx';
const senha = process.env.CERT_SENHA;

if (!senha) {
    console.error('❌ CERT_SENHA não configurada.');
    process.exit(1);
}

try {
    const buffer = fs.readFileSync(pfxPath);

    const der = forge.util.createBuffer(
        buffer.toString('binary')
    );

    const asn1 = forge.asn1.fromDer(
        der.getBytes()
    );

    const p12 = forge.pkcs12.pkcs12FromAsn1(
        asn1,
        false,
        senha
    );

    const certBags = p12.getBags({
        bagType: forge.pki.oids.certBag
    });

    const keyBags = p12.getBags({
        bagType: forge.pki.oids.pkcs8ShroudedKeyBag
    });

    const certBag =
        certBags[forge.pki.oids.certBag][0];

    const keyBag =
        keyBags[forge.pki.oids.pkcs8ShroudedKeyBag][0];

    const cert = certBag.cert;
    const privateKey = keyBag.key;

    const certPem =
        forge.pki.certificateToPem(cert);

    const keyPem =
        forge.pki.privateKeyToPem(privateKey);

    fs.writeFileSync(
        './certificados/empresa_1787261142745-cert.pem',
        certPem,
        'utf8'
    );

    fs.writeFileSync(
        './certificados/empresa_1787261142745-key.pem',
        keyPem,
        'utf8'
    );

    console.log('');
    console.log('============================================');
    console.log(' CERTIFICADO CONVERTIDO');
    console.log('============================================');
    console.log('Certificado: OK');
    console.log('Chave privada: OK');
    console.log('');
    console.log('Arquivos criados:');
    console.log('empresa_1787261142745-cert.pem');
    console.log('empresa_1787261142745-key.pem');
    console.log('============================================');

} catch (error) {

    console.error('');
    console.error('❌ ERRO AO CONVERTER PFX');
    console.error(error.message);

    process.exit(1);
}
