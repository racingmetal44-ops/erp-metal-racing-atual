// src/pages/LabelsPage.jsx
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export default function LabelsPage() {
  const [labels, setLabels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState([]);
  const [formData, setFormData] = useState({
    product_code: '',
    product_name: '',
    sku: '',
    batch: '',
    image_url: '',
    status: 'ativo'
  });
  const [editingId, setEditingId] = useState(null);
  const [message, setMessage] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [showPrint, setShowPrint] = useState(false);
  const [selectedLabel, setSelectedLabel] = useState(null);
  const [selectedImage, setSelectedImage] = useState('');

  // Carregar etiquetas
  async function loadLabels() {
    setLoading(true);
    const { data, error } = await supabase
      .from('product_labels')
      .select('*')
      .order('id', { ascending: false });
    if (!error) setLabels(data || []);
    setLoading(false);
  }

  // Carregar produtos para o select
  async function loadProducts() {
    const { data } = await supabase
      .from('products')
      .select('id, name, sku')
      .order('name', { ascending: true });
    setProducts(data || []);
  }

  useEffect(() => {
    loadLabels();
    loadProducts();
  }, []);

  // Salvar ou atualizar etiqueta
  async function handleSubmit(e) {
    e.preventDefault();
    setMessage('');

    const dataToSave = {
      product_code: formData.product_code,
      product_name: formData.product_name,
      sku: formData.sku || null,
      batch: formData.batch || null,
      image_url: formData.image_url || null,
      status: formData.status
    };

    if (editingId) {
      const { error } = await supabase
        .from('product_labels')
        .update(dataToSave)
        .eq('id', editingId);
      if (error) {
        setMessage('Erro ao atualizar: ' + error.message);
      } else {
        setMessage('Etiqueta atualizada com sucesso!');
        setEditingId(null);
        resetForm();
        await loadLabels();
      }
    } else {
      const { error } = await supabase
        .from('product_labels')
        .insert(dataToSave);
      if (error) {
        setMessage('Erro ao criar: ' + error.message);
      } else {
        setMessage('Etiqueta criada com sucesso!');
        resetForm();
        await loadLabels();
      }
    }
  }

  function resetForm() {
    setFormData({
      product_code: '',
      product_name: '',
      sku: '',
      batch: '',
      image_url: '',
      status: 'ativo'
    });
  }

  // Editar etiqueta
  function handleEdit(label) {
    setEditingId(label.id);
    setFormData({
      product_code: label.product_code || '',
      product_name: label.product_name || '',
      sku: label.sku || '',
      batch: label.batch || '',
      image_url: label.image_url || '',
      status: label.status || 'ativo'
    });
    // Scroll para o formulário
    document.getElementById('form-label')?.scrollIntoView({ behavior: 'smooth' });
  }

  // Excluir etiqueta
  async function handleDelete(id) {
    if (!confirm('Tem certeza que deseja excluir esta etiqueta?')) return;
    const { error } = await supabase
      .from('product_labels')
      .delete()
      .eq('id', id);
    if (error) {
      setMessage('Erro ao excluir: ' + error.message);
    } else {
      setMessage('Etiqueta removida com sucesso!');
      await loadLabels();
    }
  }

  // Configurar impressão individual
  function handlePrint(label) {
    setSelectedLabel(label);
    setSelectedImage(label.image_url || '');
    setShowPrint(true);
  }

  // Configurar impressão em massa
  function handleBulkPrint() {
    if (filteredLabels.length === 0) {
      setMessage('Nenhuma etiqueta para imprimir.');
      return;
    }
    setSelectedLabel({ id: 'bulk', product_code: `${filteredLabels.length} etiquetas` });
    setSelectedImage('');
    setShowPrint(true);
  }

  // Confirmar e imprimir
  function confirmPrint() {
    setShowPrint(false);
    
    if (selectedLabel.id === 'bulk') {
      // Impressão em massa
      const printWindow = window.open('', '_blank');
      printWindow.document.write(`
        <html>
          <head>
            <title>Etiquetas em Massa</title>
            <style>
              * { margin: 0; padding: 0; box-sizing: border-box; }
              body { 
                font-family: 'Arial', sans-serif; 
                padding: 20px; 
                background: #fff;
              }
              .container {
                max-width: 1200px;
                margin: 0 auto;
              }
              .header {
                text-align: center;
                padding: 20px;
                border-bottom: 2px solid #000;
                margin-bottom: 30px;
              }
              .header h1 {
                font-size: 24px;
                text-transform: uppercase;
              }
              .grid {
                display: grid;
                grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
                gap: 20px;
              }
              .label {
                border: 2px solid #000;
                padding: 20px;
                text-align: center;
                border-radius: 8px;
                page-break-inside: avoid;
              }
              .label h2 {
                font-size: 18px;
                margin-bottom: 8px;
              }
              .label h3 {
                font-size: 16px;
                color: #333;
                margin-bottom: 5px;
              }
              .label .sku {
                font-size: 14px;
                color: #666;
                margin: 5px 0;
              }
              .label .batch {
                font-size: 12px;
                color: #999;
                margin: 5px 0;
              }
              .label img {
                max-width: 100%;
                max-height: 150px;
                margin: 10px 0;
                border-radius: 4px;
              }
              .label .barcode {
                margin-top: 10px;
                font-size: 12px;
                color: #666;
                border-top: 1px dashed #ccc;
                padding-top: 10px;
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
              <div class="header">
                <h1>Etiquetas - Impressão em Massa</h1>
                <p>Total: ${filteredLabels.length} etiquetas</p>
              </div>
              <div class="grid">
                ${filteredLabels.map(label => `
                  <div class="label">
                    <h2>${label.product_code || 'SEM CÓDIGO'}</h2>
                    <h3>${label.product_name || 'SEM NOME'}</h3>
                    <div class="sku"><strong>SKU:</strong> ${label.sku || 'N/D'}</div>
                    <div class="batch"><strong>Lote:</strong> ${label.batch || 'N/D'}</div>
                    ${label.image_url ? `<img src="${label.image_url}" alt="Imagem" />` : ''}
                    <div class="barcode">? ? ? ? ? ? ? ? ? ?</div>
                  </div>
                `).join('')}
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
      `);
      printWindow.document.close();
    } else if (selectedLabel) {
      // Impressão individual
      const printWindow = window.open('', '_blank');
      printWindow.document.write(`
        <html>
          <head>
            <title>Etiqueta ${selectedLabel.product_code}</title>
            <style>
              * { margin: 0; padding: 0; box-sizing: border-box; }
              body { 
                font-family: 'Arial', sans-serif; 
                display: flex;
                justify-content: center;
                align-items: center;
                min-height: 100vh;
                background: #f5f5f5;
              }
              .label {
                background: #fff;
                border: 3px solid #000;
                padding: 40px;
                max-width: 400px;
                text-align: center;
                border-radius: 12px;
                box-shadow: 0 4px 20px rgba(0,0,0,0.1);
              }
              .label h2 {
                font-size: 24px;
                margin-bottom: 10px;
                text-transform: uppercase;
              }
              .label h3 {
                font-size: 20px;
                color: #333;
                margin-bottom: 8px;
              }
              .label .sku {
                font-size: 16px;
                color: #666;
                margin: 8px 0;
                padding: 8px;
                background: #f0f0f0;
                border-radius: 4px;
              }
              .label .batch {
                font-size: 14px;
                color: #999;
                margin: 8px 0;
              }
              .label img {
                max-width: 100%;
                max-height: 200px;
                margin: 15px 0;
                border-radius: 8px;
                border: 1px solid #ddd;
              }
              .label .barcode {
                margin-top: 15px;
                font-size: 14px;
                color: #666;
                border-top: 2px dashed #ccc;
                padding-top: 15px;
                letter-spacing: 2px;
              }
              .label .footer {
                margin-top: 10px;
                font-size: 10px;
                color: #aaa;
              }
              @media print {
                body { background: #fff; }
                .label { 
                  border: 2px solid #000;
                  box-shadow: none;
                  padding: 30px;
                }
              }
            </style>
          </head>
          <body>
            <div class="label">
              <h2>${selectedLabel.product_code || 'CÓDIGO'}</h2>
              <h3>${selectedLabel.product_name || 'PRODUTO'}</h3>
              <div class="sku"><strong>SKU:</strong> ${selectedLabel.sku || 'N/D'}</div>
              <div class="batch"><strong>Lote:</strong> ${selectedLabel.batch || 'N/D'}</div>
              ${selectedImage ? `<img src="${selectedImage}" alt="Imagem do produto" />` : ''}
              <div class="barcode">? ? ? ? ? ? ? ? ? ?</div>
              <div class="footer">Impresso em ${new Date().toLocaleDateString()}</div>
            </div>
            <script>
              window.onload = function() { 
                window.print();
                window.onafterprint = function() { window.close(); };
              }
            </script>
          </body>
        </html>
      `);
      printWindow.document.close();
    }
  }

  // Filtrar etiquetas
  const filteredLabels = labels.filter(label => {
    const search = searchTerm.toLowerCase().trim();
    if (!search) return true;
    return (
      (label.product_code || '').toLowerCase().includes(search) ||
      (label.product_name || '').toLowerCase().includes(search) ||
      (label.sku || '').toLowerCase().includes(search) ||
      (label.batch || '').toLowerCase().includes(search)
    );
  });

  // Lista de URLs de imagens para o select
  const imageUrls = labels
    .map(label => label.image_url)
    .filter(url => url && url.trim() !== '');

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
        <p className="text-sm text-orange-400">Operação logística</p>
        <h1 className="mt-2 text-3xl font-semibold">Etiquetas</h1>
        <p className="mt-2 text-sm text-slate-400">
          Cadastro, gestáo e impressão de etiquetas com configuração prévia.
        </p>
      </div>

      {/* Formulário */}
      <div id="form-label" className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
        <h2 className="text-lg font-semibold">
          {editingId ? 'Editar etiqueta' : 'Nova etiqueta'}
        </h2>
        {message && (
          <p className={`mt-3 text-sm ${message.includes('sucesso') ? 'text-emerald-400' : 'text-rose-400'}`}>
            {message}
          </p>
        )}

        <form onSubmit={handleSubmit} className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {/* Select de produtos */}
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
                    sku: product.sku || ''
                  });
                }
              }}
            >
              <option value="">Nenhum</option>
              {products.map(product => (
                <option key={product.id} value={product.id}>
                  {product.name} - {product.sku || 'SEM SKU'}
                </option>
              ))}
            </select>
          </div>

          {/* Código da etiqueta */}
          <input
            className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-slate-100"
            placeholder="Código da etiqueta"
            value={formData.product_code}
            onChange={(e) => setFormData({ ...formData, product_code: e.target.value })}
            required
          />

          {/* Produto */}
          <input
            className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-slate-100"
            placeholder="Produto"
            value={formData.product_name}
            onChange={(e) => setFormData({ ...formData, product_name: e.target.value })}
            required
          />

          {/* SKU */}
          <input
            className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-slate-100"
            placeholder="SKU do produto"
            value={formData.sku || ''}
            onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
          />

          {/* Lote */}
          <input
            className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-slate-100"
            placeholder="Lote (opcional)"
            value={formData.batch || ''}
            onChange={(e) => setFormData({ ...formData, batch: e.target.value })}
          />

          {/* URL da imagem */}
          <input
            className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-slate-100"
            placeholder="URL da imagem da etiqueta"
            value={formData.image_url || ''}
            onChange={(e) => setFormData({ ...formData, image_url: e.target.value })}
          />

          {/* Status */}
          <select
            className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-slate-100"
            value={formData.status}
            onChange={(e) => setFormData({ ...formData, status: e.target.value })}
          >
            <option value="ativo">Ativo</option>
            <option value="inativo">Inativo</option>
          </select>

          {/* Botões */}
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
                onClick={() => {
                  setEditingId(null);
                  resetForm();
                }}
                className="rounded-xl border border-slate-700 px-4 py-3 text-slate-300 hover:bg-slate-800 transition"
              >
                Cancelar
              </button>
            )}
          </div>
        </form>
      </div>

      {/* Lista de etiquetas */}
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
              placeholder="Buscar por código, produto ou lote"
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
              <div key={label.id} className="rounded-2xl border border-slate-800 bg-slate-950/60 p-5">
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
                  <span className="font-medium">Lote:</span> {label.batch || 'N/D'}
                </p>
                <p className="mt-1 text-sm text-slate-500">
                  <span className="font-medium">Status:</span>{' '}
                  <span className={label.status === 'ativo' ? 'text-emerald-400' : 'text-rose-400'}>
                    {label.status || 'ativo'}
                  </span>
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

      {/* Modal de impressão */}
      {showPrint && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4">
          <div className="w-full max-w-lg rounded-2xl border border-slate-800 bg-slate-900 p-6">
            <h3 className="text-lg font-semibold text-slate-100">Configurar impressão</h3>
            <p className="mt-2 text-sm text-slate-400">
              A janela do navegador abriré as opéées de impressora disponíveis.
            </p>

            <div className="mt-4 space-y-4">
              <div>
                <label className="block text-sm text-slate-400">Imagem da etiqueta</label>
                <select
                  value={selectedImage}
                  onChange={(e) => setSelectedImage(e.target.value)}
                  className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-slate-100"
                >
                  <option value="">Sem imagem</option>
                  {imageUrls.map((url, index) => (
                    <option key={index} value={url}>
                      {url.substring(0, 50)}...
                    </option>
                  ))}
                </select>
              </div>

              {selectedImage && (
                <img
                  src={selectedImage}
                  alt="Pré-visualização"
                  className="h-32 w-full rounded-xl object-cover border border-slate-700"
                />
              )}

              <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3 text-sm text-slate-400">
                {selectedLabel?.id === 'bulk' 
                  ? `??? Impressão em massa para ${filteredLabels.length} etiqueta(s).`
                  : `??? Impressão para ${selectedLabel?.product_code || 'etiqueta'}.`}
              </div>
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