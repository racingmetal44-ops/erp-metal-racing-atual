import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import PDFDocument from 'pdfkit';
import printer from 'pdf-to-printer';
import db from '../database/db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const STORAGE_DIR = path.resolve(__dirname, '../../../storage/production-labels');
const LABEL_WIDTH = 49 * 2.83465;
const LABEL_HEIGHT = 28 * 2.83465;

function normalizar(valor) {
  return String(valor ?? '').trim().toLowerCase();
}

function buscarEtiqueta(ordem) {
  const valores = [
    ordem.sku,
    ordem.product_code,
    ordem.codigo,
    ordem.product_name,
    ordem.numero
  ]
    .map(normalizar)
    .filter(Boolean);

  if (!valores.length) return null;

  const etiqueta = db.prepare(`
    SELECT *
    FROM etiquetas
    WHERE
      LOWER(TRIM(COALESCE(sku,''))) IN (${valores.map(() => '?').join(',')})
      OR LOWER(TRIM(COALESCE(product_code,''))) IN (${valores.map(() => '?').join(',')})
      OR LOWER(TRIM(COALESCE(codigo,''))) IN (${valores.map(() => '?').join(',')})
      OR LOWER(TRIM(COALESCE(product_name,''))) IN (${valores.map(() => '?').join(',')})
      OR LOWER(TRIM(COALESCE(descricao,''))) IN (${valores.map(() => '?').join(',')})
    ORDER BY id DESC
    LIMIT 1
  `).get(
    ...valores,
    ...valores,
    ...valores,
    ...valores,
    ...valores
  );

  return etiqueta || null;
}

function obterImpressora() {
  const config = db.prepare(`
    SELECT valor
    FROM configuracoes
    WHERE chave = 'impressora_etiquetas_padrao'
    LIMIT 1
  `).get();

  return config?.valor?.trim() || 'LABEL 3';
}

async function gerarPdfEtiqueta(etiqueta, ordem) {
  fs.mkdirSync(STORAGE_DIR, { recursive: true });

  const arquivo = path.join(
    STORAGE_DIR,
    `etiqueta-${ordem.id}-${Date.now()}.pdf`
  );

  const doc = new PDFDocument({
    size: [LABEL_WIDTH, LABEL_HEIGHT],
    margin: 0
  });

  const stream = fs.createWriteStream(arquivo);
  doc.pipe(stream);

  const largura = LABEL_WIDTH - 10;

  doc
    .font('Helvetica-Bold')
    .fontSize(7)
    .text('METAL RACING', 5, 3, {
      width: largura,
      align: 'center'
    });

  const nome = etiqueta.product_name || etiqueta.descricao || ordem.product_name || 'Produto';

  doc
    .fontSize(8)
    .text(String(nome).slice(0, 38), 5, 12, {
      width: largura,
      align: 'center'
    });

  const codigo =
    etiqueta.product_code ||
    etiqueta.codigo ||
    etiqueta.sku ||
    ordem.sku ||
    '';

  doc
    .fontSize(9)
    .text(String(codigo), 5, 22, {
      width: largura,
      align: 'center'
    });

  const sku = etiqueta.sku || ordem.sku || '';

  if (sku) {
    doc
      .fontSize(6)
      .text(`SKU: ${sku}`, 5, 33, {
        width: largura,
        align: 'center'
      });
  }

  if (etiqueta.batch) {
    doc
      .fontSize(6)
      .text(`Lote: ${etiqueta.batch}`, 5, 42, {
        width: largura,
        align: 'center'
      });
  }

  doc.end();

  await new Promise((resolve, reject) => {
    stream.on('finish', resolve);
    stream.on('error', reject);
  });

  return arquivo;
}

export async function imprimirEtiquetaDaOrdem(ordem, operador = {}) {
  if (!ordem?.id) {
    return {
      success: false,
      printed: false,
      reason: 'Ordem sem ID.'
    };
  }

  const etiqueta = buscarEtiqueta(ordem);

  if (!etiqueta) {
    console.warn(
      `[PRODUÇÃO] Nenhuma etiqueta cadastrada para a ordem ${ordem.id} / SKU ${ordem.sku || '-'}`
    );

    return {
      success: true,
      printed: false,
      reason: 'Nenhuma etiqueta cadastrada para o produto.'
    };
  }

  db.exec(`
    CREATE TABLE IF NOT EXISTS production_label_prints (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id TEXT NOT NULL,
      etiqueta_id INTEGER NOT NULL,
      operador_id INTEGER,
      operador_nome TEXT,
      impressora TEXT,
      quantidade INTEGER DEFAULT 1,
      status TEXT DEFAULT 'IMPRESSA',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(order_id, etiqueta_id)
    );
  `);

  const jaImpressa = db.prepare(`
    SELECT id
    FROM production_label_prints
    WHERE order_id = ?
      AND etiqueta_id = ?
    LIMIT 1
  `).get(String(ordem.id), etiqueta.id);

  if (jaImpressa) {
    return {
      success: true,
      printed: false,
      already_printed: true,
      etiqueta_id: etiqueta.id
    };
  }

  const impressora = obterImpressora();
  const arquivo = await gerarPdfEtiqueta(etiqueta, ordem);

  await printer.print(arquivo, {
    printer: impressora,
    silent: true
  });

  db.prepare(`
    INSERT INTO production_label_prints (
      order_id,
      etiqueta_id,
      operador_id,
      operador_nome,
      impressora,
      quantidade,
      status
    )
    VALUES (?, ?, ?, ?, ?, ?, 'IMPRESSA')
  `).run(
    String(ordem.id),
    etiqueta.id,
    operador.id ?? null,
    operador.nome ?? null,
    impressora,
    Number(etiqueta.quantidade || 1)
  );

  return {
    success: true,
    printed: true,
    etiqueta_id: etiqueta.id,
    impressora,
    arquivo
  };
}
