const fs = require("fs");
const tls = require("tls");

const pfxPath = process.env.NFE_CERTIFICADO || "./certificados/empresa_1.pfx";
const senha = process.env.NFE_CERT_SENHA || process.env.CERT_SENHA;

console.log("============================================");
console.log(" TESTE DO CERTIFICADO A1");
console.log("============================================");

console.log("Node:", process.version);
console.log("OpenSSL:", process.versions.openssl);
console.log("PFX:", pfxPath);
console.log("Arquivo existe:", fs.existsSync(pfxPath));
console.log("Senha configurada:", Boolean(senha));

if (!fs.existsSync(pfxPath)) {
  throw new Error("PFX não encontrado.");
}

if (!senha) {
  throw new Error("NFE_CERT_SENHA ou CERT_SENHA não configurada.");
}

const pfx = fs.readFileSync(pfxPath);

try {
  tls.createSecureContext({
    pfx,
    passphrase: senha,
    minVersion: "TLSv1.2",
  });

  console.log("");
  console.log("PFX: OK");
  console.log("SecureContext TLS: OK");
  console.log("Certificado pronto para HTTPS/mTLS");
} catch (error) {
  console.error("");
  console.error("ERRO AO CARREGAR PFX:");
  console.error(error.code || "");
  console.error(error.message);
  process.exitCode = 1;
}
