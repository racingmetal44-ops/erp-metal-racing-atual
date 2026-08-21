import "dotenv/config";
import fs from "fs";
import forge from "node-forge";

console.log("========================================");
console.log(" TESTE DO CERTIFICADO DIGITAL A1");
console.log("========================================");

const certPath = process.env.NFE_CERTIFICADO;
const senha = process.env.NFE_CERT_SENHA;

console.log("Caminho configurado:", certPath);

if (!certPath) {
    throw new Error("NFE_CERTIFICADO não está configurado no .env");
}

if (!senha) {
    throw new Error("NFE_CERT_SENHA não está configurada no .env");
}

if (!fs.existsSync(certPath)) {
    throw new Error("Certificado não encontrado: " + certPath);
}

console.log("PFX: OK");

try {
    const pfxBuffer = fs.readFileSync(certPath);

    const der = forge.util.createBuffer(
        pfxBuffer.toString("binary")
    );

    const asn1 = forge.asn1.fromDer(der);

    const p12 = forge.pkcs12.pkcs12FromAsn1(
        asn1,
        false,
        senha
    );

    console.log("Senha: OK");
    console.log("PKCS#12: OK");

    const certBags = p12.getBags({
        bagType: forge.pki.oids.certBag
    });

    const certBag =
        certBags[forge.pki.oids.certBag]?.[0];

    if (!certBag || !certBag.cert) {
        throw new Error(
            "Certificado não encontrado dentro do PFX"
        );
    }

    const cert = certBag.cert;

    console.log("Certificado: OK");

    console.log(
        "Validade inicial:",
        cert.validity.notBefore.toLocaleString()
    );

    console.log(
        "Validade final:",
        cert.validity.notAfter.toLocaleString()
    );

    if (new Date() > cert.validity.notAfter) {
        throw new Error("CERTIFICADO EXPIRADO");
    }

    console.log("Validade: OK");

    const keyBags = p12.getBags({
        bagType: forge.pki.oids.keyBag
    });

    const keyBag =
        keyBags[forge.pki.oids.keyBag]?.[0];

    const encryptedKeyBags = p12.getBags({
        bagType: forge.pki.oids.pkcs8ShroudedKeyBag
    });

    const encryptedKeyBag =
        encryptedKeyBags[
            forge.pki.oids.pkcs8ShroudedKeyBag
        ]?.[0];

    if (
        (!keyBag || !keyBag.key) &&
        (!encryptedKeyBag || !encryptedKeyBag.key)
    ) {
        throw new Error(
            "CHAVE PRIVADA NÃO ENCONTRADA"
        );
    }

    console.log("Chave privada: OK");

    console.log("========================================");
    console.log(" CERTIFICADO A1 VALIDADO COM SUCESSO");
    console.log("========================================");

} catch (error) {

    console.error("");
    console.error("========================================");
    console.error(" ERRO AO LER CERTIFICADO");
    console.error("========================================");
    console.error(error.message);
    console.error("========================================");

    process.exit(1);
}
