const fs = require('fs');
const forge = require('node-forge');

try {
    const caminho = './certificado.pfx';
    const senha = '123456';

    console.log('Lendo certificado...');
    
    const dados = fs.readFileSync(caminho);
    const der = forge.util.createBuffer(dados.toString('binary'));

    const asn1 = forge.asn1.fromDer(der);
    const p12 = forge.pkcs12.pkcs12FromAsn1(asn1, senha);

    console.log('');
    console.log('========================================');
    console.log('CERTIFICADO A1');
    console.log('========================================');
    console.log('PFX: OK');
    console.log('Senha: OK');
    console.log('PKCS#12: OK');

    const bags = p12.getBags({
        bagType: forge.pki.oids.certBag
    });

    const certificados = bags[forge.pki.oids.certBag] || [];

    console.log('Certificados encontrados:', certificados.length);

    for (const bag of certificados) {
        const cert = bag.cert;

        console.log('');
        console.log('Subject:', cert.subject.attributes
            .map(a => `${a.shortName || a.name}=${a.value}`)
            .join(', '));

        console.log('Issuer:', cert.issuer.attributes
            .map(a => `${a.shortName || a.name}=${a.value}`)
            .join(', '));

        console.log('Validade inicial:', cert.validity.notBefore);
        console.log('Validade final:', cert.validity.notAfter);
    }

    const keyBags = p12.getBags({
        bagType: forge.pki.oids.pkcs8ShroudedKeyBag
    });

    const chaves = keyBags[forge.pki.oids.pkcs8ShroudedKeyBag] || [];

    console.log('');
    console.log('Chaves privadas encontradas:', chaves.length);

    if (chaves.length > 0) {
        console.log('CHAVE PRIVADA: OK');
        console.log('========================================');
        console.log('TESTE CONCLUÍDO COM SUCESSO');
        console.log('========================================');
    } else {
        console.log('ERRO: chave privada não encontrada.');
    }

} catch (error) {
    console.error('');
    console.error('========================================');
    console.error('ERRO AO LER CERTIFICADO');
    console.error('========================================');
    console.error(error.message);
}
