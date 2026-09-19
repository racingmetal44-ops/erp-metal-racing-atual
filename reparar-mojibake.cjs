const fs = require('fs');

const arquivo = process.argv[2];

if (!arquivo) {
  console.error('Informe o arquivo.');
  process.exit(1);
}

const cp1252 = new TextDecoder('windows-1252');

let texto = fs.readFileSync(arquivo, 'utf8');

function score(s) {
  return (s.match(/Ã|Â|â|ð|�/g) || []).length;
}

function repararToken(token) {
  let atual = token;

  for (let i = 0; i < 6; i++) {
    const antes = score(atual);

    if (antes === 0) break;

    try {
      const bytes = Buffer.from(atual, 'latin1');
      const candidato = cp1252.decode(bytes);
      const depois = score(candidato);

      if (depois < antes && !candidato.includes('\uFFFD')) {
        atual = candidato;
      } else {
        break;
      }
    } catch {
      break;
    }
  }

  return atual;
}

const regex = /[^\s]*[ÃÂâð�][^\s]*/g;

let alteracoes = 0;

texto = texto.replace(regex, (token) => {
  const novo = repararToken(token);

  if (novo !== token) {
    alteracoes++;
    return novo;
  }

  return token;
});

fs.writeFileSync(arquivo, texto, 'utf8');

console.log(`Tokens corrigidos: ${alteracoes}`);
console.log(`Marcadores restantes: ${score(texto)}`);
console.log(`Arquivo: ${arquivo}`);
