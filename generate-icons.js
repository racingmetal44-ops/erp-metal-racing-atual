import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const svgPath = path.join(__dirname, 'public', 'icon.svg');

console.log('?? Gerando Ícones...');

if (!fs.existsSync(svgPath)) {
  console.error('? SVG não encontrado:', svgPath);
  process.exit(1);
}

const svgBuffer = fs.readFileSync(svgPath);
const sizes = [192, 512];

sizes.forEach((size) => {
  const fileName = icon-.png;
  const outputPath = path.join(__dirname, 'public', fileName);
  
  sharp(svgBuffer)
    .resize(size, size)
    .png()
    .toFile(outputPath)
    .then(() => console.log(?  criado))
    .catch((err) => console.error(? Erro ao criar :, err));
});
