const tls = require("tls");
const fs = require("fs");

const host = "nfe-homologacao.svrs.rs.gov.br";

const socket = tls.connect({
  host,
  port: 443,
  servername: host,
  minVersion: "TLSv1.2",
  rejectUnauthorized: false
});

socket.on("secureConnect", () => {
  const chain = socket.getPeerCertificate(true);

  let cert = chain;
  let index = 1;

  while (cert && cert.raw) {
    const pem =
      "-----BEGIN CERTIFICATE-----\n" +
      cert.raw.toString("base64").match(/.{1,64}/g).join("\n") +
      "\n-----END CERTIFICATE-----\n";

    const file = `./certificados/sefaz-chain-${index}.pem`;

    fs.writeFileSync(file, pem);

    console.log(`Salvo: ${file}`);
    console.log(`Subject: ${cert.subject?.CN || ""}`);
    console.log(`Issuer: ${cert.issuer?.CN || ""}`);

    const next = cert.issuerCertificate;

    if (!next || next === cert) break;

    if (
      next.fingerprint256 &&
      cert.fingerprint256 &&
      next.fingerprint256 === cert.fingerprint256
    ) {
      break;
    }

    cert = next;
    index++;
  }

  socket.destroy();
});

socket.on("error", (err) => {
  console.error(err.code, err.message);
});
