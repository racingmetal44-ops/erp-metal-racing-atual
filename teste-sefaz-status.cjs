const fs = require("fs");
const https = require("https");
const forge = require("node-forge");

const HOST = "nfe-homologacao.svrs.rs.gov.br";
const PATH = "/ws/NfeStatusServico/NfeStatusServico4.asmx";

const pfxPath =
    process.env.NFE_CERTIFICADO ||
    "./certificados/empresa_1.pfx";

const senha =
    process.env.NFE_CERT_SENHA ||
    process.env.CERT_SENHA;

const caPath =
    "./certificados/sefaz-ca-bundle.pem";

console.log("============================================");
console.log(" TESTE STATUS SERVICO NF-e → SEFAZ");
console.log("============================================");
console.log("Servidor:", HOST);
console.log("Endpoint:", PATH);
console.log("Ambiente: HOMOLOGAÇÃO");
console.log("UF: SC");
console.log("");

if (!senha) {
    throw new Error("Senha do certificado não configurada.");
}

if (!fs.existsSync(pfxPath)) {
    throw new Error("PFX não encontrado: " + pfxPath);
}

if (!fs.existsSync(caPath)) {
    throw new Error("CA bundle não encontrado: " + caPath);
}

const pfxBuffer = fs.readFileSync(pfxPath);
const ca = fs.readFileSync(caPath);

console.log("[1] Abrindo certificado A1...");

const pfxAsn1 = forge.asn1.fromDer(
    forge.util.createBuffer(
        pfxBuffer.toString("binary")
    ).getBytes()
);

const p12 = forge.pkcs12.pkcs12FromAsn1(
    pfxAsn1,
    false,
    senha
);

const certBags =
    p12.getBags({
        bagType: forge.pki.oids.certBag
    })[forge.pki.oids.certBag];

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

if (!certBags || !certBags.length) {
    throw new Error("Certificado não encontrado dentro do PFX.");
}

if (!keyBags || !keyBags.length) {
    throw new Error("Chave privada não encontrada dentro do PFX.");
}

const certPem =
    forge.pki.certificateToPem(
        certBags[0].cert
    );

const keyPem =
    forge.pki.privateKeyToPem(
        keyBags[0].key
    );

console.log("Certificado: OK");
console.log("Chave privada: OK");
console.log("");

//
// XML SEM ESPAÇOS / QUEBRAS DE LINHA
// dentro de consStatServ
//
const consStatServ =
    '<consStatServ versao="4.00" xmlns="http://www.portalfiscal.inf.br/nfe"><tpAmb>2</tpAmb><cUF>42</cUF><xServ>STATUS</xServ></consStatServ>';

const soapXml =
    '<?xml version="1.0" encoding="UTF-8"?>' +
    '<soap12:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" ' +
    'xmlns:xsd="http://www.w3.org/2001/XMLSchema" ' +
    'xmlns:soap12="http://www.w3.org/2003/05/soap-envelope">' +
    '<soap12:Body>' +
    '<nfeDadosMsg xmlns="http://www.portalfiscal.inf.br/nfe/wsdl/NFeStatusServico4">' +
    consStatServ +
    '</nfeDadosMsg>' +
    '</soap12:Body>' +
    '</soap12:Envelope>';

console.log("[2] XML SOAP preparado");
console.log("Tamanho:", Buffer.byteLength(soapXml), "bytes");
console.log("");

const options = {
    hostname: HOST,
    port: 443,
    path: PATH,
    method: "POST",

    cert: certPem,
    key: keyPem,

    ca: ca,

    minVersion: "TLSv1.2",
    maxVersion: "TLSv1.3",

    rejectUnauthorized: true,

    servername: HOST,

    headers: {
        "Content-Type":
            'application/soap+xml; charset=utf-8; action="http://www.portalfiscal.inf.br/nfe/wsdl/NFeStatusServico4/nfeStatusServicoNF"',
        "Content-Length":
            Buffer.byteLength(soapXml)
    },

    timeout: 30000
};

console.log("[3] Enviando SOAP para SEFAZ...");
console.log("");

const req = https.request(
    options,
    (res) => {

        console.log("============================================");
        console.log(" RESPOSTA DA SEFAZ");
        console.log("============================================");
        console.log("HTTP Status:", res.statusCode);
        console.log("");

        let body = "";

        res.on("data", (chunk) => {
            body += chunk.toString();
        });

        res.on("end", () => {

            console.log("SOAP recebido:");
            console.log(body);
            console.log("");

            const cStat =
                body.match(
                    /<cStat>(.*?)<\/cStat>/
                )?.[1];

            const xMotivo =
                body.match(
                    /<xMotivo>(.*?)<\/xMotivo>/
                )?.[1];

            console.log("============================================");
            console.log(" RESULTADO");
            console.log("============================================");
            console.log("cStat:", cStat || "não encontrado");
            console.log(
                "xMotivo:",
                xMotivo || "não encontrado"
            );

            if (cStat === "107") {

                console.log("");
                console.log("============================================");
                console.log(" ✅ SEFAZ EM FUNCIONAMENTO");
                console.log("============================================");

            } else if (cStat) {

                console.log("");
                console.log("⚠️ SEFAZ RESPONDEU");
                console.log("Código retornado:", cStat);

            } else {

                console.log("");
                console.log("❌ cStat não encontrado.");

            }

            console.log("");
            console.log("============================================");
            console.log(" TESTE FINALIZADO");
            console.log("============================================");
        });
    }
);

req.on("socket", (socket) => {

    socket.on("secureConnect", () => {

        console.log("TLS conectado: OK");
        console.log(
            "Protocolo:",
            socket.getProtocol()
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
                socket.authorizationError
            );
        }

        console.log("");
    });
});

req.on("timeout", () => {

    console.error("");
    console.error("❌ TIMEOUT SEFAZ");

    req.destroy(
        new Error(
            "Timeout de 30 segundos."
        )
    );
});

req.on("error", (error) => {

    console.error("");
    console.error("============================================");
    console.error(" ERRO SOAP / SEFAZ");
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

req.write(soapXml);
req.end();
