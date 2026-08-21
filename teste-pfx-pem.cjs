const fs = require("fs");
const forge = require("node-forge");
const tls = require("tls");

const pfxPath = "./certificados/empresa_1.pfx";
const senha = process.env.CERT_SENHA || process.env.NFE_CERT_SENHA;

console.log("============================================");
console.log(" TESTE PFX → PEM → TLS");
console.log("============================================");

if (!senha) {
    throw new Error("Senha do certificado não encontrada.");
}

const pfxBuffer = fs.readFileSync(pfxPath);

console.log("PFX bytes:", pfxBuffer.length);

const pfxAsn1 = forge.asn1.fromDer(
    forge.util.createBuffer(pfxBuffer.toString("binary")).getBytes()
);

const p12 = forge.pkcs12.pkcs12FromAsn1(
    pfxAsn1,
    false,
    senha
);

const certBags = p12.getBags({
    bagType: forge.pki.oids.certBag
})[forge.pki.oids.certBag];

const keyBags = p12.getBags({
    bagType: forge.pki.oids.pkcs8ShroudedKeyBag
})[forge.pki.oids.pkcs8ShroudedKeyBag];

if (!certBags || !certBags.length) {
    throw new Error("Certificado não encontrado dentro do PFX.");
}

if (!keyBags || !keyBags.length) {
    throw new Error("Chave privada não encontrada dentro do PFX.");
}

const cert = certBags[0].cert;
const privateKey = keyBags[0].key;

const certPem = forge.pki.certificateToPem(cert);
const keyPem = forge.pki.privateKeyToPem(privateKey);

console.log("Certificado PEM: OK");
console.log("Chave privada PEM: OK");

const secureContext = tls.createSecureContext({
    cert: certPem,
    key: keyPem,
    minVersion: "TLSv1.2"
});

console.log("SecureContext TLS: OK");
console.log("============================================");
console.log(" TESTE CONCLUÍDO");
console.log("============================================");
