const fs = require("fs");
const https = require("https");
const forge = require("node-forge");

const host = "nfe-homologacao.svrs.rs.gov.br";

const pfxPath =
    process.env.NFE_CERTIFICADO ||
    "./certificados/empresa_1.pfx";

const senha =
    process.env.NFE_CERT_SENHA ||
    process.env.CERT_SENHA;

const caPath = "./certificados/sefaz-ca-bundle.pem";

console.log("============================================");
console.log(" TESTE HTTPS + A1 — PFX → PEM");
console.log("============================================");
console.log("Servidor:", host);
console.log("PFX:", pfxPath);
console.log("");

if (!senha) {
    throw new Error(
        "NFE_CERT_SENHA ou CERT_SENHA não configurada."
    );
}

if (!fs.existsSync(pfxPath)) {
    throw new Error("PFX não encontrado: " + pfxPath);
}

if (!fs.existsSync(caPath)) {
    throw new Error("CA bundle não encontrado: " + caPath);
}

const pfxBuffer = fs.readFileSync(pfxPath);
const ca = fs.readFileSync(caPath);

console.log("PFX bytes:", pfxBuffer.length);
console.log("CA bytes:", ca.length);
console.log("");

//
// ============================================
// PFX → PEM
// ============================================
//

console.log("[1] Abrindo PFX...");

const pfxDer = forge.asn1.fromDer(
    forge.util.createBuffer(
        pfxBuffer.toString("binary")
    ).getBytes()
);

const p12 = forge.pkcs12.pkcs12FromAsn1(
    pfxDer,
    false,
    senha
);

console.log("PFX: OK");

//
// CERTIFICADO
//

const certBags =
    p12.getBags({
        bagType: forge.pki.oids.certBag
    })[forge.pki.oids.certBag];

if (!certBags || !certBags.length) {
    throw new Error(
        "Certificado não encontrado dentro do PFX."
    );
}

const cert = certBags[0].cert;

//
// CHAVE PRIVADA
//

let keyBags =
    p12.getBags({
        bagType: forge.pki.oids.pkcs8ShroudedKeyBag
    })[forge.pki.oids.pkcs8ShroudedKeyBag];

if (!keyBags || !keyBags.length) {
    keyBags =
        p12.getBags({
            bagType: forge.pki.oids.keyBag
        })[forge.pki.oids.keyBag];
}

if (!keyBags || !keyBags.length) {
    throw new Error(
        "Chave privada não encontrada dentro do PFX."
    );
}

const privateKey = keyBags[0].key;

const certPem =
    forge.pki.certificateToPem(cert);

const keyPem =
    forge.pki.privateKeyToPem(privateKey);

console.log("Certificado PEM: OK");
console.log("Chave privada PEM: OK");
console.log("");

//
// ============================================
// HTTPS
// ============================================
//

const options = {
    hostname: host,
    port: 443,
    method: "GET",

    cert: certPem,
    key: keyPem,

    ca,

    minVersion: "TLSv1.2",
    maxVersion: "TLSv1.3",

    rejectUnauthorized: true,

    servername: host,

    timeout: 30000
};

console.log("[2] Abrindo conexão TLS...");

const req = https.request(options, (res) => {

    console.log("");
    console.log("============================================");
    console.log(" HTTPS CONECTADO");
    console.log("============================================");

    console.log("HTTP STATUS:", res.statusCode);

    let body = "";

    res.on("data", chunk => {
        body += chunk.toString();
    });

    res.on("end", () => {

        console.log("");
        console.log("Resposta recebida:");

        console.log(
            body.substring(0, 1000)
        );

        console.log("");
        console.log("============================================");
        console.log(" TESTE FINALIZADO");
        console.log("============================================");
    });
});

req.on("socket", socket => {

    socket.on("secureConnect", () => {

        console.log("");
        console.log("TLS conectado: OK");
        console.log(
            "Protocolo:",
            socket.getProtocol()
        );

        console.log(
            "Cipher:",
            socket.getCipher()
        );

        const servidor =
            socket.getPeerCertificate(true);

        console.log(
            "Servidor:",
            servidor.subject?.CN ||
            "não informado"
        );

        console.log(
            "Emissor:",
            servidor.issuer?.CN ||
            "não informado"
        );

        console.log(
            "TLS autorizado:",
            socket.authorized
                ? "SIM"
                : "NÃO"
        );

        if (!socket.authorized) {

            console.log(
                "Motivo:",
                socket.authorizationError ||
                "desconhecido"
            );
        }
    });
});

req.on("timeout", () => {

    console.error("");
    console.error("TIMEOUT HTTPS");

    req.destroy(
        new Error(
            "Timeout de 30 segundos."
        )
    );
});

req.on("error", error => {

    console.error("");
    console.error("============================================");
    console.error(" ERRO HTTPS");
    console.error("============================================");

    console.error(
        "Código:",
        error.code || ""
    );

    console.error(
        "Mensagem:",
        error.message
    );
});

req.end();
