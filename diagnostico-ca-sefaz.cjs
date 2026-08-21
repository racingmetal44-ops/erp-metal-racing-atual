const tls = require("tls");

const host = "nfe-homologacao.svrs.rs.gov.br";

console.log("============================================");
console.log(" DIAGNÓSTICO DA CA DO SERVIDOR");
console.log("============================================");

const socket = tls.connect({
  host,
  port: 443,
  servername: host,

  minVersion: "TLSv1.2",
  maxVersion: "TLSv1.3",

  rejectUnauthorized: false
});

socket.on("secureConnect", () => {
  console.log("");
  console.log("TLS conectado: OK");
  console.log("Protocolo:", socket.getProtocol());
  console.log("Cipher:", socket.getCipher());

  let cert = socket.getPeerCertificate(true);
  let i = 0;

  while (cert && Object.keys(cert).length > 0) {
    console.log("");
    console.log("============================================");
    console.log(" CERTIFICADO", ++i);
    console.log("============================================");

    console.log("Subject:", cert.subject);
    console.log("Issuer:", cert.issuer);
    console.log("CN:", cert.subject?.CN);
    console.log("Issuer CN:", cert.issuer?.CN);
    console.log("Valid From:", cert.valid_from);
    console.log("Valid To:", cert.valid_to);
    console.log("Fingerprint:", cert.fingerprint256);

    cert = cert.issuerCertificate;

    if (
      cert &&
      cert.fingerprint256 === socket.getPeerCertificate(true).fingerprint256
    ) {
      break;
    }
  }

  socket.end();
});

socket.on("error", (error) => {
  console.error("");
  console.error("ERRO:", error.code);
  console.error(error.message);
});
