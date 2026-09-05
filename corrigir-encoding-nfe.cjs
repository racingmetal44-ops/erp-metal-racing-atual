const fs = require("fs");

const arquivos = [
  "./src/backend/routes/nfeEntradaRoutes.js",
  "./src/components/fiscal/NfeEntradaPanel.jsx"
];

function contarProblemas(texto) {
  return (texto.match(/Ã.|Â.|�/g) || []).length;
}

for (const arquivo of arquivos) {
  const original = fs.readFileSync(arquivo, "utf8");

  let corrigido = original;

  // Corrige UTF-8 interpretado como Latin-1.
  for (let i = 0; i < 2; i++) {
    const candidato = Buffer.from(corrigido, "latin1").toString("utf8");

    if (contarProblemas(candidato) < contarProblemas(corrigido)) {
      corrigido = candidato;
    } else {
      break;
    }
  }

  fs.writeFileSync(arquivo, corrigido, "utf8");

  console.log(
    `${arquivo}: ${contarProblemas(original)} -> ${contarProblemas(corrigido)} problemas`
  );
}
