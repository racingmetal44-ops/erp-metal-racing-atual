import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import JsBarcode from 'jsbarcode';

export default function LabelsPage() {
  const [labels, setLabels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState([]);
  const [formData, setFormData] = useState({
    product_code: '',
    product_name: '',
    sku: '',
    batch: '',
    barcode: '',
    image_url: '',
    status: 'ativo'
  });
  const [editingId, setEditingId] = useState(null);
  const [message, setMessage] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [showPrint, setShowPrint] = useState(false);
  const [selectedLabel, setSelectedLabel] = useState(null);
  const [selectedImage, setSelectedImage] = useState('');
  const [selectedLabelIds, setSelectedLabelIds] = useState([]);
  const barcodeRef = useRef(null);

  async function loadLabels() {
    setLoading(true);
    const { data, error } = await supabase
      .from('product_labels')
      .select('*')
      .order('id', { ascending: false });
    if (!error) setLabels(data || []);
    setLoading(false);
  }

  async function loadProducts() {
    const { data } = await supabase
      .from('products')
      .select('id, name, sku, barcode')
      .order('name', { ascending: true });
    setProducts(data || []);
  }

  useEffect(() => {
    loadLabels();
    loadProducts();
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setMessage('');

    if (!formData.barcode?.trim()) {
      setMessage('? Código de barras é obrigatório!');
      return;
    }

    const dataToSave = {
      product_code: formData.product_code.trim(),
      product_name: formData.product_name.trim(),
      sku: formData.sku?.trim() || null,
      batch: formData.batch?.trim() || null,
      barcode: formData.barcode.trim(),
      image_url: formData.image_url?.trim() || null,
      status: formData.status || 'ativo'
    };

    if (editingId) {
      const { error } = await supabase
        .from('product_labels')
        .update(dataToSave)
        .eq('id', editingId);
      if (error) {
        setMessage('? Erro: ' + error.message);
      } else {
        setMessage('? Etiqueta atualizada!');
        setEditingId(null);
        resetForm();
        loadLabels();
      }
    } else {
      const { error } = await supabase
        .from('product_labels')
        .insert(dataToSave);
      if (error) {
        setMessage('? Erro: ' + error.message);
      } else {
        setMessage('? Etiqueta criada!');
        resetForm();
        loadLabels();
      }
    }
  }

  function resetForm() {
    setFormData({
      product_code: '',
      product_name: '',
      sku: '',
      batch: '',
      barcode: '',
      image_url: '',
      status: 'ativo'
    });
  }

  function handleEdit(label) {
    setEditingId(label.id);
    setFormData({
      product_code: label.product_code || '',
      product_name: label.product_name || '',
      sku: label.sku || '',
      batch: label.batch || '',
      barcode: label.barcode || '',
      image_url: label.image_url || '',
      status: label.status || 'ativo'
    });
  }

  async function handleDelete(id) {
    if (!confirm('Tem certeza?')) return;
    const { error } = await supabase
      .from('product_labels')
      .delete()
      .eq('id', id);
    if (!error) {
      setMessage('? Etiqueta removida!');
      loadLabels();
    } else {
      setMessage('? Erro: ' + error.message);
    }
  }

  function generateBarcodeSVG(code) {
    if (!code) return '';
    try {
      // Cria um elemento SVG temporário
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('id', 'temp-barcode');
      document.body.appendChild(svg);
      
      JsBarcode('#temp-barcode', code, {
        format: 'CODE128',
        width: 2,
        height: 60,
        displayValue: true,
        fontSize: 16,
        margin: 5
      });
      
      const svgContent = svg.outerHTML;
      document.body.removeChild(svg);
      return svgContent;
    } catch (error) {
      console.error('Erro ao gerar código de barras:', error);
      return `<div style="font-family: monospace; font-size: 20px; letter-spacing: 4px; padding: 10px; background: #f0f0f0; border-radius: 4px;">${code}</div>`;
    }
  }

  function handlePrint(label) {
    setSelectedLabel(label);
    setSelectedImage(label.image_url || '');
    setShowPrint(true);
  }

  function handleBulkPrint() {
    if (selectedLabelIds.length === 0) {
      setMessage('? Selecione pelo menos uma etiqueta para imprimir.');
      return;
    }
    setSelectedLabel({ id: 'bulk', product_code: selectedLabelIds.length + ' etiquetas' });
    setShowPrint(true);
  }

  function handleToggleLabelSelection(labelId) {
    setSelectedLabelIds((prev) =>
      prev.includes(labelId) ? prev.filter((id) => id !== labelId) : [...prev, labelId]
    );
  }

  function confirmPrint() {
    setShowPrint(false);
    const printWindow = window.open('', '_blank');
    let html = `
      <html>
      <head>
        <title>Etiquetas</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          @page {
            size: 49mm 28mm;
            margin: 0;
          }
          body { 
            font-family: 'Arial', 'Helvetica', sans-serif; 
            background: #fff;
          }
          .container { 
            margin: 0;
          }
          .grid { 
            display: grid; 
            grid-template-columns: repeat(auto-fill, 49mm); 
            gap: 2mm;
          }
          .label { 
            width: 49mm;
            height: 28mm;
            border: 1px solid #000; 
            padding: 1.5mm; 
            text-align: center; 
            border-radius: 0; 
            page-break-inside: avoid;
            background: #fff;
            overflow: hidden;
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
          }
          .label .brand {
            font-size: 6px;
            color: #999;
            text-transform: uppercase;
            letter-spacing: 1px;
            border-bottom: 1px solid #eee;
            padding-bottom: 1mm;
            margin-bottom: 1mm;
            width: 100%;
          }
          .label .product-name {
            font-size: 9px;
            font-weight: bold;
            margin: 0.5mm 0;
            text-transform: uppercase;
            line-height: 1.1;
          }
          .label .product-code {
            font-size: 7px;
            color: #666;
            margin: 0.3mm 0;
          }
          .label .sku {
            font-size: 7px;
            color: #888;
            margin: 0.3mm 0;
          }
          .label .batch {
            font-size: 6px;
            color: #aaa;
            margin: 0.3mm 0;
          }
          .label .barcode-container {
            margin: 1mm 0;
            padding: 0;
            background: none;
            width: 100%;
          }
          .label .barcode-container img {
            max-width: 100%;
            height: 12mm;
          }
          .label .barcode-text {
            font-family: 'Courier New', monospace;
            font-size: 7px;
            letter-spacing: 1px;
            color: #333;
            margin-top: 0.5mm;
          }
          .label img.product-image {
            max-width: 100%;
            max-height: 8mm;
            margin: 0.5mm 0;
            object-fit: contain;
          }
          .label .footer {
            margin-top: 0.5mm;
            font-size: 5px;
            color: #ccc;
            width: 100%;
            border-top: 1px solid #eee;
            padding-top: 0.5mm;
          }
          @media print {
            .label { 
              border: 1px solid #000;
              page-break-inside: avoid;
            }
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="grid">
    `;

    // Funcao para gerar SVG inline
    const generateBarcodeSVGInline = (code) => {
      if (!code) return '';
      try {
        // Usa canvas para gerar a imagem base64 do codigo de barras
        const canvas = document.createElement('canvas');
        JsBarcode(canvas, code, {
          format: 'CODE128',
          width: 1,
          height: 20,
          displayValue: true,
          fontSize: 8,
          margin: 0,
          background: '#ffffff',
          lineColor: '#000000'
        });
        return canvas.toDataURL('image/png');
      } catch (error) {
        return '';
      }
    };

    const selectedLabelsToPrint = selectedLabel?.id === 'bulk'
      ? labels.filter((label) => selectedLabelIds.includes(label.id))
      : [selectedLabel];

    selectedLabelsToPrint.forEach((label) => {
      const barcodeImage = generateBarcodeSVGInline(label.barcode || label.product_code || '1234567890');
      html += `
        <div class="label">
          <div class="brand">? METAL RACING ?</div>
          <div class="product-name">${label.product_name || 'PRODUTO'}</div>
          <div class="product-code">${label.product_code || 'SEM CODIGO'}</div>
          <div class="sku">SKU: ${label.sku || 'N/D'}</div>
          <div class="batch">Lote: ${label.batch || 'N/D'}</div>
          <div class="barcode-container">
            ${barcodeImage ? `<img src="${barcodeImage}" alt="Codigo de Barras" />` : 
              `<div class="barcode-text">${label.barcode || label.product_code || 'N/D'}</div>`}
          </div>
        </div>
      `;
    });

    html += `
          </div>
        </div>
        <script>
          window.onload = function() { 
            window.print();
            window.onafterprint = function() { window.close(); };
          }
        </script>
      </body>
      </html>
    `;

    printWindow.document.write(html);
    printWindow.document.close();
  }

  const filteredLabels = labels.filter(label => {
    const search = searchTerm.toLowerCase().trim();
    if (!search) return true;
    return (
      (label.product_code || '').toLowerCase().includes(search) ||
      (label.product_name || '').toLowerCase().includes(search) ||
      (label.sku || '').toLowerCase().includes(search) ||
      (label.batch || '').toLowerCase().includes(search) ||
      (label.barcode || '').toLowerCase().includes(search)
    );
  });

  const imageUrls = labels.map(l => l.image_url).filter(Boolean);

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
        <p className="text-sm text-orange-400">Operação logística</p>
        <h1 className="mt-2 text-3xl font-semibold">Etiquetas</h1>
        <p className="mt-2 text-sm text-slate-400">Cadastro, gestáo e impressão de etiquetas com código de barras.</p>
      </div>

      <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
        <h2 className="text-lg font-semibold">{editingId ? 'Editar' : 'Nova'} etiqueta</h2>
        {message && <p className="mt-3 text-sm text-slate-300">{message}</p>}
        
        <form onSubmit={handleSubmit} className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <div className="col-span-full">
            <label className="block text-sm text-slate-400">Escolher produto do estoque (opcional)</label>
            <select
              className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-slate-100"
              onChange={(e) => {
                const product = products.find(p => String(p.id) === String(e.target.value));
                if (product) {
                  setFormData({
                    ...formData,
                    product_name: product.name || '',
                    sku: product.sku || '',
                    barcode: product.barcode || ''
                  });
                }
              }}
            >
              <option value="">Nenhum</option>
              {products.map(p => (
                <option key={p.id} value={p.id}>
                  {p.name} - {p.sku || 'SEM SKU'}
                </option>
              ))}
            </select>
          </div>

          <input
            className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-slate-100 placeholder:text-slate-500"
            placeholder="Código da etiqueta *"
            value={formData.product_code}
            onChange={(e) => setFormData({ ...formData, product_code: e.target.value })}
            required
          />

          <input
            className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-slate-100 placeholder:text-slate-500"
            placeholder="Produto *"
            value={formData.product_name}
            onChange={(e) => setFormData({ ...formData, product_name: e.target.value })}
            required
          />

          <input
            className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-slate-100 placeholder:text-slate-500"
            placeholder="SKU"
            value={formData.sku || ''}
            onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
          />

          <input
            className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-slate-100 placeholder:text-slate-500"
            placeholder="Lote"
            value={formData.batch || ''}
            onChange={(e) => setFormData({ ...formData, batch: e.target.value })}
          />

          <input
            className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-slate-100 placeholder:text-slate-500"
            placeholder="Código de barras * (ex: 7891234567890)"
            value={formData.barcode || ''}
            onChange={(e) => setFormData({ ...formData, barcode: e.target.value })}
            required
          />

          <input
            className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-slate-100 placeholder:text-slate-500"
            placeholder="URL da imagem"
            value={formData.image_url || ''}
            onChange={(e) => setFormData({ ...formData, image_url: e.target.value })}
          />

          <select
            className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-slate-100"
            value={formData.status}
            onChange={(e) => setFormData({ ...formData, status: e.target.value })}
          >
            <option value="ativo">Ativo</option>
            <option value="inativo">Inativo</option>
          </select>

          <div className="flex gap-2 md:col-span-2 xl:col-span-1">
            <button
              type="submit"
              className="rounded-xl bg-orange-500 px-4 py-3 font-semibold text-white hover:bg-orange-600 transition"
            >
              {editingId ? 'Salvar' : 'Cadastrar'}
            </button>
            {editingId && (
              <button
                type="button"
                onClick={() => { setEditingId(null); resetForm(); }}
                className="rounded-xl border border-slate-700 px-4 py-3 text-slate-300 hover:bg-slate-800 transition"
              >
                Cancelar
              </button>
            )}
          </div>
        </form>
      </div>

      <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
        <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <h2 className="text-lg font-semibold">Etiquetas cadastradas</h2>
          <div className="flex gap-2">
            <button
              onClick={handleBulkPrint}
              className="flex items-center gap-2 rounded-xl border border-slate-700 px-3 py-2 text-sm text-slate-300 hover:bg-slate-800 transition"
            >
              ??? Imprimir em massa
            </button>
            <input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar..."
              className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-2 text-slate-100 placeholder:text-slate-500"
            />
          </div>
        </div>

        {loading ? (
          <p className="text-sm text-slate-500">Carregando...</p>
        ) : filteredLabels.length === 0 ? (
          <p className="text-sm text-slate-500">Nenhuma etiqueta encontrada.</p>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {filteredLabels.map(label => (
              <div
                key={label.id}
                className={`rounded-2xl border p-5 ${selectedLabelIds.includes(label.id)
                  ? 'border-orange-500/40 bg-orange-950/40'
                  : 'border-slate-800 bg-slate-950/60'}`}
              >
                <div className="mb-4 flex items-center justify-between gap-2">
                  <label className="inline-flex items-center gap-2 text-sm text-slate-300">
                    <input
                      type="checkbox"
                      checked={selectedLabelIds.includes(label.id)}
                      onChange={() => handleToggleLabelSelection(label.id)}
                      className="h-4 w-4 rounded border-slate-600 bg-slate-950 text-orange-500"
                    />
                    Selecionar
                  </label>
                  {selectedLabelIds.includes(label.id) && (
                    <span className="rounded-full bg-orange-500/10 px-2 py-0.5 text-[11px] text-orange-300">
                      Selecionado
                    </span>
                  )}
                </div>
                <h2 className="text-lg font-semibold text-slate-100">
                  {label.product_code || 'Etiqueta'}
                </h2>
                <p className="mt-2 text-sm text-slate-400">
                  <span className="font-medium">Produto:</span> {label.product_name || 'N/D'}
                </p>
                <p className="mt-1 text-sm text-slate-500">
                  <span className="font-medium">SKU:</span> {label.sku || 'N/D'}
                </p>
                <p className="mt-1 text-sm text-slate-500">
                  <span className="font-medium">Cód. Barras:</span> {label.barcode || 'N/D'}
                </p>
                <div className="mt-4 flex gap-2">
                  <button
                    onClick={() => handleEdit(label)}
                    className="rounded-lg border border-slate-700 px-3 py-1 text-xs text-slate-300 hover:bg-slate-800 transition"
                  >
                    ?? Editar
                  </button>
                  <button
                    onClick={() => handlePrint(label)}
                    className="flex items-center gap-1 rounded-lg border border-orange-500/40 px-3 py-1 text-xs text-orange-300 hover:bg-orange-500/10 transition"
                  >
                    ??? Imprimir
                  </button>
                  <button
                    onClick={() => handleDelete(label.id)}
                    className="rounded-lg border border-rose-500/30 px-3 py-1 text-xs text-rose-300 hover:bg-rose-500/10 transition"
                  >
                    ??? Excluir
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showPrint && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4">
          <div className="w-full max-w-lg rounded-2xl border border-slate-800 bg-slate-900 p-6">
            <h3 className="text-lg font-semibold text-slate-100">Configurar impressão</h3>
            <p className="mt-2 text-sm text-slate-400">
              A etiqueta seré impressa com código de barras legével por scanner.
            </p>

            <div className="mt-4">
              <label className="block text-sm text-slate-400">Imagem da etiqueta</label>
              <select
                value={selectedImage}
                onChange={(e) => setSelectedImage(e.target.value)}
                className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-slate-100"
              >
                <option value="">Sem imagem</option>
                {imageUrls.map((url, index) => (
                  <option key={index} value={url}>
                    {url.substring(0, 40)}...
                  </option>
                ))}
              </select>
            </div>

            {selectedImage && (
              <img
                src={selectedImage}
                alt="Pré-visualização"
                className="mt-4 h-32 w-full rounded-xl object-cover border border-slate-700"
              />
            )}

            <div className="mt-4 rounded-xl border border-slate-800 bg-slate-950/70 p-3 text-sm text-slate-400">
              {selectedLabel?.id === 'bulk' 
                ? `??? Impressão em massa para ${selectedLabelIds.length} etiqueta(s).`
                : `??? Impressão para ${selectedLabel?.product_code || 'etiqueta'}.`}
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <button
                onClick={() => setShowPrint(false)}
                className="rounded-xl border border-slate-700 px-4 py-2 text-sm text-slate-300 hover:bg-slate-800 transition"
              >
                Cancelar
              </button>
              <button
                onClick={confirmPrint}
                className="rounded-xl bg-orange-500 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-600 transition"
              >
                ? Confirmar e imprimir
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
