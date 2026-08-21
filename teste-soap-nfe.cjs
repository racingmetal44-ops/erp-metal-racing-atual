const fs = require("fs");
const https = require("https");

const HOST = "nfe-homologacao.svrs.rs.gov.br";
const PATH = "/ws/NfeStatusServico/NfeStatusServico4.asmx";

const PFX_PATH = "./certificados/empresa_1.pfx";
const CA_PATH = "./certificados/sefaz-ca-bundle.pem";

const SENHA =
  process.env.NFE_CERT_SENHA ||
  process.env.CERT_SENHA;

if (!SENHA) {
  throw new Error("CERT_SENHA ou NFE_CERT_SENHA não configurada.");
}

const pfx = fs.readFileSync(PFX_PATH);
const ca = fs.readFileSync(CA_PATH);

const SOAP_ACTION =
  "http://www.portalfiscal.inf.br/nfe/wsdl/NFeStatusServico4/nfeStatusServicoNF";

const xml = `<soap:Envelope
xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"
xmlns:nfe="http://www.portalfiscal.inf.br/nfe">

<soap:Body>

<nfe:nfeDadosMsg>

<nfe:consStatServ versao="4.00">

<nfe:tpAmb>2</nfe:tpAmb>
<nfe:cUF>43</nfe:cUF>
<nfe:xServ>STATUS</nfe:xServ>

</nfe:consStatServ>

</nfe:nfeDadosMsg>

</soap:Body>

</soap:Envelope>`;

console.log("============================================");
console.log(" TESTE SOAP NF-e - SVRS");
console.log("============================================");
console.log("Servidor:", HOST);
console.log("Path:", PATH);
console.log("Ambiente: HOMOLOGAÇÃO");
console.log("UF: RS");
console.log("SOAP: 1.1");
console.log("");
console.log("PFX:", PFX_PATH);
console.log("PFX bytes:", pfx.length);
console.log("CA:", CA_PATH);
console.log("CA bytes:", ca.length);
console.log("SOAPAction:", SOAP_ACTION);
console.log("");

console.log("XML enviado:");
console.log("--------------------------------------------");
console.log(xml);
console.log("--------------------------------------------");
console.log("");

const options = {
  hostname: HOST,
  port: 443,
  path: PATH,
  method: "POST",

  pfx,
  passphrase: SENHA,

  ca,

  minVersion: "TLSv1.2",
  maxVersion: "TLSv1.2",

  rejectUnauthorized: true,

  headers: {
    "Content-Type": "text/xml; charset=utf-8",
    "SOAPAction": `"${SOAP_ACTION}"`,
    "Content-Length": Buffer.byteLength(xml)
  },

  timeout: 30000
};

const req = https.request(options, (res) => {

  console.log("============================================");
  console.log(" RESPOSTA SEFAZ");
  console.log("============================================");

  console.log("HTTP STATUS:", res.statusCode);
  console.log(
    "Content-Type:",
    res.headers["content-type"] || ""
  );

  console.log("");

  let body = "";

  res.setEncoding("utf8");

  res.on("data", chunk => {
    body += chunk;
  });

  res.on("end", () => {

    console.log("Resposta recebida:");
    console.log("--------------------------------------------");
    console.log(body);
    console.log("--------------------------------------------");
    console.log("");

    const cStatMatch =
      body.match(/<cStat>(.*?)<\/cStat>/);

    const motivoMatch =
      body.match(/<xMotivo>(.*?)<\/xMotivo>/);

    if (cStatMatch) {

      const cStat = cStatMatch[1];

      const motivo =
        motivoMatch ? motivoMatch[1] : "";

      console.log("============================================");
      console.log(" SEFAZ RESPONDEU");
      console.log("============================================");

      console.log("cStat:", cStat);
      console.log("xMotivo:", motivo);

      if (cStat === "107") {

        console.log("");
        console.log("============================================");
        console.log(" SUCESSO");
        console.log("============================================");
        console.log("SEFAZ respondeu: Serviço em Operação");
        console.log("");

      } else {

        console.log("");
        console.log("⚠️ SEFAZ respondeu.");
        console.log("O cStat não é 107.");
        console.log("");
      }

    } else if (
      body.includes("soap:Fault") ||
      body.includes("<Fault")
    ) {

      console.log("============================================");
      console.log(" SOAP FAULT");
      console.log("============================================");

      const reason =
        body.match(
          /<faultstring>(.*?)<\/faultstring>/
        ) ||
        body.match(
          /<soap:Text[^>]*>(.*?)<\/soap:Text>/
        );

      console.log(
        "Motivo:",
        reason ? reason[1] : "não identificado"
      );

    } else {

      console.log("============================================");
      console.log(" RESPOSTA NÃO RECONHECIDA");
      console.log("============================================");

    }

  });

});

req.on("socket", socket => {

  socket.on("secureConnect", () => {

    console.log("TLS conectado: OK");
    console.log("TLS:", socket.getProtocol());
    console.log("Cipher:", socket.getCipher());

    console.log(
      "TLS autorizado:",
      socket.authorized ? "SIM" : "NÃO"
    );

    const cert = socket.getPeerCertificate();

    console.log(
      "Servidor:",
      cert.subject?.CN || "não informado"
    );

    console.log(
      "Emissor:",
      cert.issuer?.CN || "não informado"
    );

    console.log("");
  });

});

req.on("timeout", () => {

  console.error("");
  console.error("TIMEOUT");
  console.error("A SEFAZ não respondeu em 30 segundos.");

  req.destroy(
    new Error("Timeout de 30 segundos.")
  );

});

req.on("error", error => {

  console.error("");
  console.error("============================================");
  console.error(" ERRO SOAP");
  console.error("============================================");

  console.error("Código:", error.code || "");
  console.error("Mensagem:", error.message);
});

console.log("Enviando XML para SEFAZ...");
console.log("");

req.write(xml);
req.end();
