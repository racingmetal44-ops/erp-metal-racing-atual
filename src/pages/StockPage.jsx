import { useEffect, useState } from 'react';
import { Image as ImageIcon, Trash2, Upload, Search } from 'lucide-react';
import { supabase } from '../lib/supabase';

const emptyForm = {
  name: '',
  sku: '',
  barcode: '',
  current_stock: 0,
  min_stock: 0,
  status: 'ativo',
  category: '',
  unit: '',
  ncm: '',
  cfop: '',
  origem: '',
  cst_csosn: '',
  icms_aliquota: '',
  pis_aliquota: '',
  cofins_aliquota: '',
  ipi_aliquota: '',
  gtin: '',
};

function generateBarcode() {
  return `BC-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
}

export default function StockPage() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalImage, setModalImage] = useState(null);

  
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [search, setSearch] = useState('');
  const [message, setMessage] = useState('');
  const [pendingFiles, setPendingFiles] = useState([]);
  const [gallery, setGallery] = useState([]);
  const [uploading, setUploading] = useState(false);

  async function loadProducts() {
    setLoading(true);
    const [{ data: productsData, error: productsError }, { data: filesData, error: filesError }] = await Promise.all([
      supabase.from('products').select('*').order('id', { ascending: false }),
      supabase.from('product_files').select('*').order('id', { ascending: false }),
    ]);

    if (productsError) {
      setMessage(`Falha ao carregar produtos: ${productsError.message}`);
      setProducts([]);
      setLoading(false);
      return;
    }

    const filesByProduct = (filesData ?? []).reduce((acc, file) => {
      const productId = file.product_id;
      if (!acc[productId]) acc[productId] = [];
      acc[productId].push(file);
      return acc;
    }, {});

    const mappedProducts = (productsData ?? []).map((product) => ({
      ...product,
      images: (filesByProduct[product.id] ?? []).sort((a, b) => Number(b.is_primary) - Number(a.is_primary)),
    }));

    if (filesError) {
      setMessage(`Produtos carregados, mas falha ao recuperar imagens: ${filesError.message}`);
    }

    setProducts(mappedProducts);
    setLoading(false);
  }

  useEffect(() => {
    loadProducts();
  }, []);

  function openImageModal(url) {
    setModalImage(url);
  }

  function closeImageModal() {
    setModalImage(null);
  }

  function resetForm() {
    setEditingId(null);
    setForm(emptyForm);
    setPendingFiles([]);
    setGallery([]);
  }

  async function uploadProductFiles(productId) {
    if (!pendingFiles.length) return;

    const bucketName = 'product-files';
    for (const [index, fileEntry] of pendingFiles.entries()) {
      const storagePath = `${productId}/${Date.now()}-${fileEntry.file.name.replace(/\s+/g, '-')}`;
      const { error: uploadError } = await supabase.storage.from(bucketName).upload(storagePath, fileEntry.file, {
        upsert: true,
        contentType: fileEntry.file.type,
      });

      if (uploadError) {
        throw new Error(`Falha ao enviar imagem para Storage: ${uploadError.message}`);
      }

      const { data: publicData, error: urlError } = supabase.storage.from(bucketName).getPublicUrl(storagePath);
      if (urlError) {
        throw new Error(`Falha ao gerar URL pública: ${urlError.message}`);
      }

      const fileData = {
        product_id: productId,
        product_name: form.name,
        product_barcode: form.barcode || '',
        file_url: publicData?.publicUrl ?? '',
        file_name: fileEntry.file.name,
        file_type: fileEntry.file.type,
        file_size: fileEntry.file.size,
        file_category: 'foto',
        photo_angle: 'front',
        sort_order: index + 1,
        is_ai_training: false,
        added_by_name: 'sistema',
        created_date: new Date().toISOString(),
        updated_date: new Date().toISOString(),
      };

      const { error: dbError } = await supabase.from('product_files').insert(fileData);
      if (dbError) {
        throw new Error(`Falha ao salvar metadados de imagem: ${dbError.message}`);
      }
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setMessage('');
    setUploading(true);

    const barcodeValue = form.barcode?.trim() || generateBarcode();
    const payload = {
      ...form,
      barcode: barcodeValue,
      current_stock: Number(form.current_stock),
      min_stock: Number(form.min_stock),
      ncm: form.ncm || '',
      cfop: form.cfop || '',
      origem: form.origem || '',
      cst_csosn: form.cst_csosn || '',
      icms_aliquota: form.icms_aliquota || '',
      pis_aliquota: form.pis_aliquota || '',
      cofins_aliquota: form.cofins_aliquota || '',
      ipi_aliquota: form.ipi_aliquota || '',
      gtin: form.gtin || '',
    };

    try {
      if (editingId) {
        const { error } = await supabase.from('products').update(payload).eq('id', editingId);
        if (error) throw error;
        if (pendingFiles.length) await uploadProductFiles(editingId);
        setMessage('Produto atualizado com sucesso.');
      } else {
        const { data: insertedProduct, error } = await supabase.from('products').insert(payload).select().single();
        if (error) throw error;
        if (pendingFiles.length) await uploadProductFiles(insertedProduct.id);
        setMessage('Produto criado com sucesso.');
      }

      resetForm();
      setSearch('');
      await loadProducts();
    } catch (error) {
      setMessage(error.message || 'Falha ao salvar o produto.');
    } finally {
      setUploading(false);
    }
  }

  function handleEdit(product) {
    setEditingId(product.id);
    setForm({
      name: product.name ?? '',
      sku: product.sku ?? '',
      barcode: product.barcode ?? '',
      current_stock: product.current_stock ?? 0,
      min_stock: product.min_stock ?? 0,
      status: product.status ?? 'ativo',
      category: product.category ?? '',
      unit: product.unit ?? '',
    });
    setGallery(product.images ?? []);
    setPendingFiles([]);
  }

  async function handleDelete(id) {
    const { error } = await supabase.from('product_files').delete().eq('product_id', id);
    const { error: productError } = await supabase.from('products').delete().eq('id', id);
    if (!error && !productError) {
      setMessage('Produto removido com sucesso.');
      await loadProducts();
    } else {
      setMessage(productError?.message || error?.message || 'Falha ao remover o produto.');
    }
  }

  function handleFilesChange(event) {
    const files = Array.from(event.target.files || []);
    const imageFiles = files.filter((file) => file.type.startsWith('image/'));
    const previews = imageFiles.map((file) => ({ file, preview: URL.createObjectURL(file) }));
    setPendingFiles((current) => [...current, ...previews]);
  }

  function removePendingFile(index) {
    setPendingFiles((current) => {
      const next = [...current];
      if (next[index]?.preview) URL.revokeObjectURL(next[index].preview);
      return next.filter((_, itemIndex) => itemIndex !== index);
    });
  }

  const filtered = products.filter((product) => {
    const term = search.trim().toLowerCase();
    if (!term) return true;
    const values = [
      product.name,
      product.product_name,
      product.sku,
      product.barcode,
      product.product_barcode,
      product.category,
      product.unit,
      product.status,
    ]
      .map((value) => String(value ?? '').toLowerCase());
    return values.some((value) => value.includes(term));
  });

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
        <p className="text-sm text-orange-400">Módulo</p>
        <h1 className="mt-2 text-3xl font-semibold">Estoque</h1>
        <p className="mt-2 text-sm text-slate-400">Cadastro, edição e controle de estoque com integração real ao Supabase.</p>
      </div>

      <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
        <h2 className="text-lg font-semibold">{editingId ? 'Editar produto' : 'Novo produto'}</h2>
        {message ? <p className="mt-3 text-sm text-slate-300">{message}</p> : null}
        <form onSubmit={handleSubmit} className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <input className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3" placeholder="Nome" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          <input className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3" placeholder="SKU" value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} required />
          <input className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3" placeholder="Código de barras" value={form.barcode} onChange={(e) => setForm({ ...form, barcode: e.target.value })} />
          <input className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3" placeholder="NCM" value={form.ncm} onChange={(e) => setForm({ ...form, ncm: e.target.value })} />

          <input className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3" placeholder="CFOP" value={form.cfop} onChange={(e) => setForm({ ...form, cfop: e.target.value })} />
          <input type="number" className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3" placeholder="Estoque atual" value={form.current_stock} onChange={(e) => setForm({ ...form, current_stock: e.target.value })} />
          <input type="number" className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3" placeholder="Estoque mínimo" value={form.min_stock} onChange={(e) => setForm({ ...form, min_stock: e.target.value })} />
          <input className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3" placeholder="Origem" value={form.origem} onChange={(e) => setForm({ ...form, origem: e.target.value })} />
          <input className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3" placeholder="CST / CSOSN" value={form.cst_csosn} onChange={(e) => setForm({ ...form, cst_csosn: e.target.value })} />
          <input className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3" placeholder="ICMS %" value={form.icms_aliquota} onChange={(e) => setForm({ ...form, icms_aliquota: e.target.value })} />
          <input className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3" placeholder="PIS %" value={form.pis_aliquota} onChange={(e) => setForm({ ...form, pis_aliquota: e.target.value })} />
          <input className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3" placeholder="COFINS %" value={form.cofins_aliquota} onChange={(e) => setForm({ ...form, cofins_aliquota: e.target.value })} />
          <input className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3" placeholder="IPI %" value={form.ipi_aliquota} onChange={(e) => setForm({ ...form, ipi_aliquota: e.target.value })} />
          <input className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3" placeholder="GTIN / EAN" value={form.gtin} onChange={(e) => setForm({ ...form, gtin: e.target.value })} />
          <input className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3" placeholder="Categoria" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} />
          <input className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3" placeholder="Unidade" value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} />
          <select className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
            <option value="ativo">Ativo</option>
            <option value="inativo">Inativo</option>
          </select>
          <div className="md:col-span-2 xl:col-span-3">
            <label className="mb-2 block text-sm text-slate-400">Fotos do produto</label>
            <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-slate-700 bg-slate-950/70 px-4 py-3 text-sm text-slate-300">
              <Upload size={16} />
              Selecionar imagens
              <input type="file" accept="image/*" multiple className="hidden" onChange={handleFilesChange} />
            </label>
            {(pendingFiles.length > 0 || gallery.length > 0) ? (
              <div className="mt-3 grid gap-3 md:grid-cols-3">
                {gallery.map((image) => (
                  <div key={image.id} className="rounded-xl border border-slate-800 bg-slate-950/70 p-2">
                    {image.file_url ? (
                      <button type="button" onClick={() => openImageModal(image.file_url)} className="block w-full">
                        <img src={image.file_url} alt={image.file_name || 'Imagem'} className="h-24 w-full rounded-lg object-cover" />
                      </button>
                    ) : (
                      <div className="flex h-24 items-center justify-center rounded-lg bg-slate-900">
                        <ImageIcon size={20} />
                      </div>
                    )}
                    <p className="mt-2 text-xs text-slate-400">{image.file_name || 'Imagem salva'}</p>
                  </div>
                ))}
                {pendingFiles.map((image, index) => (
                  <div key={index} className="rounded-xl border border-slate-800 bg-slate-950/70 p-2">
                    <img src={image.preview} alt={image.file.name} className="h-24 w-full rounded-lg object-cover" />
                    <div className="mt-2 flex items-center justify-between">
                      <p className="text-xs text-slate-400">{image.file.name}</p>
                      <button type="button" onClick={() => removePendingFile(index)} className="text-rose-300">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
          <div className="flex gap-2 md:col-span-2 xl:col-span-1">
            <button disabled={uploading} className="rounded-xl bg-orange-500 px-4 py-3 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60">{editingId ? (uploading ? 'Salvando...' : 'Salvar') : (uploading ? 'Cadastrando...' : 'Cadastrar')}</button>
            {editingId ? <button type="button" onClick={resetForm} className="rounded-xl border border-slate-700 px-4 py-3 text-slate-300">Cancelar</button> : null}
          </div>
        </form>
      </div>

      <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
        <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <h2 className="text-lg font-semibold">Produtos cadastrados</h2>
          <div className="relative w-full md:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); setSearch(e.target.value); } }}
              placeholder="Buscar por nome, SKU ou categoria"
              className="rounded-xl border border-slate-700 bg-slate-950 px-10 py-2 w-full"
            />
          </div>
        </div>
        {loading ? (
          <p className="text-sm text-slate-500">Carregando...</p>
        ) : filtered.length === 0 ? (
          <p className="rounded-3xl border border-slate-800 bg-slate-950/80 p-6 text-sm text-slate-400">Nenhum produto encontrado para essa busca.</p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {filtered.map((product) => {
              const imageUrl = product.images?.[0]?.file_url;
              return (
                <div key={product.id} className="rounded-3xl border border-slate-800 bg-slate-950/80 p-4 shadow-lg shadow-slate-950/10">
                  <div className="relative overflow-hidden rounded-3xl bg-slate-900">
                    {imageUrl ? (
                      <button type="button" onClick={() => openImageModal(imageUrl)} className="w-full h-52">
                        <img src={imageUrl} alt={product.name} className="h-52 w-full object-contain object-center" />
                      </button>
                    ) : (
                      <div className="flex h-52 items-center justify-center bg-slate-900 text-slate-500">
                        <ImageIcon size={32} />
                      </div>
                    )}
                  </div>
                  <div className="mt-4 space-y-2">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <h3 className="text-lg font-semibold text-slate-100">{product.name || 'Produto sem nome'}</h3>
                        <p className="text-sm text-slate-500">{product.sku ? `SKU ${product.sku}` : 'SKU não informado'}</p>
                      </div>
                      <span className="rounded-full bg-orange-500/15 px-3 py-1 text-xs font-semibold text-orange-300">{product.status}</span>
                    </div>
                    <div className="grid gap-2 text-sm text-slate-400">
                      <p>Estoque: <span className="font-semibold text-slate-100">{product.current_stock ?? 0}</span></p>
                      <p>Mínimo: <span className="font-semibold text-slate-100">{product.min_stock ?? 0}</span></p>
                      {product.category ? <p>Categoria: <span className="font-semibold text-slate-100">{product.category}</span></p> : null}
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <button onClick={() => handleEdit(product)} className="rounded-2xl border border-slate-700 bg-slate-900 px-3 py-2 text-xs font-semibold text-slate-200 transition hover:border-orange-500/60 hover:text-orange-300">Editar</button>
                      <button onClick={() => handleDelete(product.id)} className="rounded-2xl border border-rose-500/30 bg-slate-900 px-3 py-2 text-xs font-semibold text-rose-300 transition hover:bg-rose-500/10">Excluir</button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {modalImage ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70" onClick={closeImageModal}>
          <div className="relative p-4" onClick={(e) => e.stopPropagation()}>
            <button onClick={closeImageModal} className="absolute right-2 top-2 rounded-full bg-black/40 p-2 text-white">Fechar</button>
            <img src={modalImage} alt="Preview" className="max-h-[80vh] max-w-[90vw] object-contain rounded-lg" />
          </div>
        </div>
      ) : null}
    </div>
  );
}
