import { useEffect, useState, useRef } from 'react';
import {
  Image as ImageIcon,
  Trash2,
  Upload,
  Search,
  ChevronLeft,
  ChevronRight,
  X,
  QrCode,
  Plus,
  Minus,
  AlertTriangle,
  CheckCircle,
  Package,
  TrendingUp,
  TrendingDown
} from 'lucide-react';
import { supabase } from '../lib/supabase';

function generateBarcode() {
  return `BC-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
}

const emptyForm = {
  name: '',
  sku: '',
  barcode: '',
  current_stock: 0,
  min_stock: 0,
  max_stock: 0,
  status: 'ativo',
  category: '',
  unit: '',
};

export default function StockPage() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalImage, setModalImage] = useState(null);
  const [modalImages, setModalImages] = useState([]);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [search, setSearch] = useState('');
  const [message, setMessage] = useState('');
  const [pendingFiles, setPendingFiles] = useState([]);
  const [gallery, setGallery] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [bipeModalOpen, setBipeModalOpen] = useState(false);
  const [bipeCode, setBipeCode] = useState('');
  const [bipeProduct, setBipeProduct] = useState(null);
  const [bipeLoading, setBipeLoading] = useState(false);
  const [bipeStatus, setBipeStatus] = useState('');
  const bipeInputRef = useRef(null);
  const [stats, setStats] = useState({ total: 0, baixo: 0, alto: 0, totalItens: 0 });
  const [bipeTimeout, setBipeTimeout] = useState(null);

  // =============================================
  // VALIDAÇÃO DE DUPLICIDADE (FUNCIONANDO)
  // =============================================
  async function verificarDuplicado() {
    const nome = form.name?.trim();
    const sku = form.sku?.trim();

    if (!nome && !sku) return { duplicado: false };

    try {
      let query = supabase
        .from('products')
        .select('id, name, sku')
        .or(`name.ilike.${nome},sku.ilike.${sku}`);

      // Se estiver editando, excluir o próprio produto
      if (editingId) {
        query = query.neq('id', editingId);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Erro na validação:', error);
        return { duplicado: false, erro: error.message };
      }

      if (data && data.length > 0) {
        // Verificar quais campos coincidem
        const encontrados = [];
        data.forEach(p => {
          const pNome = p.name?.toLowerCase();
          const pSku = p.sku?.toLowerCase();
          const nomeLower = nome.toLowerCase();
          const skuLower = sku.toLowerCase();

          if (pNome === nomeLower && pSku === skuLower) {
            encontrados.push(`"${p.name}" (Nome e SKU exatamente iguais)`);
          } else if (pNome === nomeLower) {
            encontrados.push(`"${p.name}" (mesmo NOME)`);
          } else if (pSku === skuLower) {
            encontrados.push(`SKU "${p.sku}" (mesmo SKU)`);
          }
        });

        if (encontrados.length > 0) {
          return {
            duplicado: true,
            mensagem: `❌ Já existe: ${encontrados.join(', ')}`
          };
        }
      }

      return { duplicado: false };
    } catch (error) {
      console.error('Erro na validação:', error);
      return { duplicado: false, erro: error.message };
    }
  }

  async function loadProducts() {
    setLoading(true);
    try {
      const { data: productsData, error: productsError } = await supabase
        .from('products')
        .select('*')
        .order('id', { ascending: false });

      if (productsError) {
        setMessage(`Falha ao carregar produtos: ${productsError.message}`);
        setProducts([]);
        setLoading(false);
        return;
      }

      const { data: filesData, error: filesError } = await supabase
        .from('product_files')
        .select('*')
        .order('id', { ascending: false });

      const filesByProduct = {};
      if (filesData) {
        filesData.forEach((file) => {
          const productId = file.product_id;
          if (!filesByProduct[productId]) {
            filesByProduct[productId] = [];
          }
          filesByProduct[productId].push(file);
        });
      }

      const mappedProducts = (productsData || []).map((product) => ({
        ...product,
        images: (filesByProduct[product.id] || []).sort((a, b) =>
          (b.sort_order || 0) - (a.sort_order || 0)
        ),
      }));

      if (filesError) {
        setMessage(`Produtos carregados, mas falha ao recuperar imagens: ${filesError.message}`);
      }

      setProducts(mappedProducts);
      calcularEstatisticas(mappedProducts);
    } catch (error) {
      setMessage(`Erro: ${error.message}`);
    } finally {
      setLoading(false);
    }
  }

  function calcularEstatisticas(lista) {
    const baixo = lista.filter(p => (p.current_stock ?? 0) < (p.min_stock ?? 0)).length;
    const alto = lista.filter(p => (p.current_stock ?? 0) > (p.max_stock ?? 99999)).length;
    const totalItens = lista.reduce((sum, p) => sum + (p.current_stock ?? 0), 0);
    setStats({ total: lista.length, baixo, alto, totalItens });
  }

  useEffect(() => {
    loadProducts();
  }, []);

  function openImageModal(productImages, initialIndex = 0) {
    if (!productImages || productImages.length === 0) return;
    setModalImages(productImages);
    setCurrentImageIndex(initialIndex);
    setModalImage(productImages[initialIndex]?.file_url || null);
  }

  function closeImageModal() {
    setModalImage(null);
    setModalImages([]);
    setCurrentImageIndex(0);
  }

  function goToPreviousImage() {
    if (modalImages.length === 0) return;
    const newIndex = currentImageIndex === 0 ? modalImages.length - 1 : currentImageIndex - 1;
    setCurrentImageIndex(newIndex);
    setModalImage(modalImages[newIndex]?.file_url || null);
  }

  function goToNextImage() {
    if (modalImages.length === 0) return;
    const newIndex = currentImageIndex === modalImages.length - 1 ? 0 : currentImageIndex + 1;
    setCurrentImageIndex(newIndex);
    setModalImage(modalImages[newIndex]?.file_url || null);
  }

  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === 'Escape') closeImageModal();
      if (e.key === 'ArrowLeft') goToPreviousImage();
      if (e.key === 'ArrowRight') goToNextImage();
    }
    if (modalImage) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [modalImage, currentImageIndex, modalImages]);

  useEffect(() => {
    if (bipeModalOpen && bipeInputRef.current) {
      bipeInputRef.current.focus();
    }
  }, [bipeModalOpen]);

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
      const { error: uploadError } = await supabase.storage
        .from(bucketName)
        .upload(storagePath, fileEntry.file, {
          upsert: true,
          contentType: fileEntry.file.type,
        });

      if (uploadError) {
        throw new Error(`Falha ao enviar imagem: ${uploadError.message}`);
      }

      const { data: publicData } = supabase.storage.from(bucketName).getPublicUrl(storagePath);

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
        throw new Error(`Falha ao salvar metadados: ${dbError.message}`);
      }
    }
  }

  // =============================================
  // HANDLE SUBMIT COM VALIDAÇÃO
  // =============================================
  async function handleSubmit(e) {
    e.preventDefault();
    setMessage('');
    setUploading(true);

    // VALIDAÇÃO BÁSICA
    if (!form.name?.trim()) {
      setMessage('❌ Nome do produto é obrigatório!');
      setUploading(false);
      return;
    }

    if (!form.sku?.trim()) {
      setMessage('❌ SKU é obrigatório!');
      setUploading(false);
      return;
    }

    // =============================================
    // VERIFICAR DUPLICIDADE
    // =============================================
    const validacao = await verificarDuplicado();

    if (validacao.duplicado) {
      setMessage(validacao.mensagem);
      setUploading(false);
      return;
    }

    if (validacao.erro) {
      setMessage(`⚠️ Erro na validação: ${validacao.erro}`);
      setUploading(false);
      return;
    }

    // CONTINUAR COM O CADASTRO
    const barcodeValue = form.barcode?.trim() || generateBarcode();
    const payload = {
      name: form.name.trim(),
      sku: form.sku.trim(),
      barcode: barcodeValue,
      current_stock: Number(form.current_stock) || 0,
      min_stock: Number(form.min_stock) || 0,
      max_stock: Number(form.max_stock) || 99999,
      status: form.status || 'ativo',
      category: form.category || '',
      unit: form.unit || '',
    };

    try {
      if (editingId) {
        const { error } = await supabase
          .from('products')
          .update(payload)
          .eq('id', editingId);

        if (error) throw error;
        if (pendingFiles.length) await uploadProductFiles(editingId);
        setMessage('✅ Produto atualizado com sucesso.');
      } else {
        const { data: insertedProduct, error } = await supabase
          .from('products')
          .insert(payload)
          .select()
          .single();

        if (error) throw error;
        if (pendingFiles.length && insertedProduct) {
          await uploadProductFiles(insertedProduct.id);
        }
        setMessage('✅ Produto criado com sucesso.');
      }

      resetForm();
      setSearch('');
      await loadProducts();
    } catch (error) {
      setMessage(`❌ ${error.message || 'Falha ao salvar o produto.'}`);
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
      max_stock: product.max_stock ?? 0,
      status: product.status ?? 'ativo',
      category: product.category ?? '',
      unit: product.unit ?? '',
    });
    setGallery(product.images ?? []);
    setPendingFiles([]);
  }

  async function handleDelete(id) {
    if (!confirm('Tem certeza que deseja excluir este produto?')) return;

    try {
      await supabase.from('product_files').delete().eq('product_id', id);
      const { error } = await supabase.from('products').delete().eq('id', id);
      if (error) throw error;
      setMessage('🗑️ Produto removido com sucesso.');
      await loadProducts();
    } catch (error) {
      setMessage(`❌ ${error.message || 'Falha ao remover o produto.'}`);
    }
  }

  function handleFilesChange(event) {
    const files = Array.from(event.target.files || []);
    const imageFiles = files.filter((file) => file.type.startsWith('image/'));
    const previews = imageFiles.map((file) => ({
      file,
      preview: URL.createObjectURL(file)
    }));
    setPendingFiles((current) => [...current, ...previews]);
  }

  function removePendingFile(index) {
    setPendingFiles((current) => {
      const next = [...current];
      if (next[index]?.preview) URL.revokeObjectURL(next[index].preview);
      return next.filter((_, itemIndex) => itemIndex !== index);
    });
  }

  function abrirModalBipe() {
    setBipeModalOpen(true);
    setBipeCode('');
    setBipeProduct(null);
    setBipeLoading(false);
    setBipeStatus('');
    setTimeout(() => bipeInputRef.current?.focus(), 100);
  }

  function fecharModalBipe() {
    setBipeModalOpen(false);
    setBipeProduct(null);
    setBipeCode('');
    setBipeStatus('');
    if (bipeTimeout) {
      clearTimeout(bipeTimeout);
      setBipeTimeout(null);
    }
  }

  function handleBipeCodeChange(e) {
    const value = e.target.value;
    setBipeCode(value);
    
    if (bipeTimeout) {
      clearTimeout(bipeTimeout);
      setBipeTimeout(null);
    }
    
    if (value.length >= 3) {
      const timeout = setTimeout(() => {
        buscarProdutoParaBipe(value);
      }, 300);
      setBipeTimeout(timeout);
    }
  }

  async function buscarProdutoParaBipe(codigo) {
    if (!codigo || codigo.trim() === '') return;
    setBipeLoading(true);
    setBipeStatus('');

    try {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .or(`barcode.eq.${codigo},sku.eq.${codigo}`)
        .single();

      setBipeLoading(false);

      if (error || !data) {
        setBipeProduct(null);
        setBipeStatus('nao-encontrado');
        setMessage('🔵 Produto não encontrado!');
        setTimeout(() => setMessage(''), 3000);
        return;
      }

      const { data: files } = await supabase
        .from('product_files')
        .select('*')
        .eq('product_id', data.id)
        .order('is_primary', { ascending: false });

      setBipeProduct({
        ...data,
        images: files ?? []
      });
      setBipeStatus('encontrado');
      setMessage('');
    } catch (error) {
      setBipeLoading(false);
      setBipeStatus('nao-encontrado');
      setMessage(`❌ Erro: ${error.message}`);
    }
  }

  async function confirmarBipe(operacao = 'adicionar') {
    if (!bipeProduct) return;

    const novaQuantidade = operacao === 'adicionar'
      ? (bipeProduct.current_stock ?? 0) + 1
      : Math.max(0, (bipeProduct.current_stock ?? 0) - 1);

    try {
      const { error } = await supabase
        .from('products')
        .update({ current_stock: novaQuantidade })
        .eq('id', bipeProduct.id);

      if (error) throw error;

      if (operacao === 'adicionar') {
        setBipeStatus('entrada');
        setMessage(`🟢 ENTRADA: ${bipeProduct.name} +1 (Total: ${novaQuantidade})`);
      } else {
        setBipeStatus('saida');
        setMessage(`🔴 SAÍDA: ${bipeProduct.name} -1 (Total: ${novaQuantidade})`);
      }

      setTimeout(() => {
        setBipeProduct(null);
        setBipeCode('');
        setBipeStatus('');
        if (bipeInputRef.current) {
          bipeInputRef.current.focus();
        }
      }, 1500);
      
      await loadProducts();
    } catch (error) {
      setMessage(`❌ Erro ao atualizar: ${error.message}`);
    }
  }

  function getStockStatus(product) {
    const current = product.current_stock ?? 0;
    const min = product.min_stock ?? 0;
    const max = product.max_stock ?? 99999;

    if (current < min) {
      return { label: 'Baixo', color: 'text-rose-400', bg: 'bg-rose-500/15', icon: AlertTriangle };
    }
    if (current > max) {
      return { label: 'Alto', color: 'text-amber-400', bg: 'bg-amber-500/15', icon: TrendingUp };
    }
    return { label: 'OK', color: 'text-emerald-400', bg: 'bg-emerald-500/15', icon: CheckCircle };
  }

  function getBipeBgColor() {
    switch (bipeStatus) {
      case 'entrada':
        return 'border-emerald-500/50 bg-emerald-500/10';
      case 'saida':
        return 'border-rose-500/50 bg-rose-500/10';
      case 'nao-encontrado':
        return 'border-blue-500/50 bg-blue-500/10';
      default:
        return 'border-slate-800 bg-slate-900';
    }
  }

  const filtered = products.filter((product) => {
    const term = search.trim().toLowerCase();
    if (!term) return true;
    const values = [
      product.name,
      product.sku,
      product.barcode,
      product.category,
      product.unit,
      product.status,
    ].map((value) => String(value ?? '').toLowerCase());
    return values.some((value) => value.includes(term));
  });

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
        <p className="text-sm text-orange-400">Módulo</p>
        <h1 className="mt-2 text-3xl font-semibold">📡 Estoque</h1>
        <p className="mt-2 text-sm text-slate-400">Cadastro, edição e controle de estoque com integração real ao Supabase.</p>
      </div>

      {/* ESTATÍSTICAS */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
          <div className="flex items-center gap-2 text-slate-400"><Package size={18} /><span className="text-sm">Total</span></div>
          <p className="mt-1 text-2xl font-bold text-white">{stats.total}</p>
        </div>
        <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-4">
          <div className="flex items-center gap-2 text-rose-400"><TrendingDown size={18} /><span className="text-sm">Abaixo do Mínimo</span></div>
          <p className="mt-1 text-2xl font-bold text-rose-400">{stats.baixo}</p>
        </div>
        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4">
          <div className="flex items-center gap-2 text-amber-400"><TrendingUp size={18} /><span className="text-sm">Acima do Máximo</span></div>
          <p className="mt-1 text-2xl font-bold text-amber-400">{stats.alto}</p>
        </div>
        <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4">
          <div className="flex items-center gap-2 text-emerald-400"><Package size={18} /><span className="text-sm">Total em Estoque</span></div>
          <p className="mt-1 text-2xl font-bold text-emerald-400">{stats.totalItens}</p>
        </div>
      </div>

      {/* FORMULÁRIO */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">{editingId ? '✏️ Editar produto' : '📦 Novo produto'}</h2>
          {editingId && <button onClick={resetForm} className="text-sm text-slate-400 hover:text-white">Cancelar edição</button>}
        </div>

        <form onSubmit={handleSubmit} className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <input className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white placeholder:text-slate-500 focus:border-orange-500 focus:outline-none" placeholder="Nome da peça *" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          <input className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white placeholder:text-slate-500 focus:border-orange-500 focus:outline-none" placeholder="SKU *" value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} required />
          <input className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white placeholder:text-slate-500 focus:border-orange-500 focus:outline-none" placeholder="Código de barras" value={form.barcode} onChange={(e) => setForm({ ...form, barcode: e.target.value })} />

          <div className="md:col-span-2 xl:col-span-3">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 rounded-xl border border-slate-700 bg-slate-950/50">
              <p className="col-span-full text-sm font-semibold text-slate-300 mb-1">📊 Controle de Estoque</p>
              <div>
                <label className="text-xs text-slate-400">Quantidade atual</label>
                <input type="number" className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white placeholder:text-slate-500 focus:border-orange-500 focus:outline-none" placeholder="0" value={form.current_stock} onChange={(e) => setForm({ ...form, current_stock: Number(e.target.value) || 0 })} min="0" />
              </div>
              <div>
                <label className="text-xs text-slate-400">Estoque mínimo</label>
                <input type="number" className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white placeholder:text-slate-500 focus:border-orange-500 focus:outline-none" placeholder="5" value={form.min_stock} onChange={(e) => setForm({ ...form, min_stock: Number(e.target.value) || 0 })} min="0" />
              </div>
              <div>
                <label className="text-xs text-slate-400">Estoque máximo</label>
                <input type="number" className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white placeholder:text-slate-500 focus:border-orange-500 focus:outline-none" placeholder="20" value={form.max_stock} onChange={(e) => setForm({ ...form, max_stock: Number(e.target.value) || 0 })} min="0" />
              </div>
            </div>
          </div>

          <input className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white placeholder:text-slate-500 focus:border-orange-500 focus:outline-none" placeholder="Categoria" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} />
          <input className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white placeholder:text-slate-500 focus:border-orange-500 focus:outline-none" placeholder="Unidade" value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} />
          <select className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white focus:border-orange-500 focus:outline-none" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
            <option value="ativo">Ativo</option>
            <option value="inativo">Inativo</option>
          </select>

          <div className="md:col-span-2 xl:col-span-3">
            <label className="mb-2 block text-sm text-slate-400">📸 Fotos do produto</label>
            <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-slate-700 bg-slate-950/70 px-4 py-3 text-sm text-slate-300 hover:border-orange-500 transition">
              <Upload size={16} /> Selecionar imagens
              <input type="file" accept="image/*" multiple className="hidden" onChange={handleFilesChange} />
            </label>
            {(pendingFiles.length > 0 || gallery.length > 0) && (
              <div className="mt-3 grid gap-3 grid-cols-2 sm:grid-cols-3 md:grid-cols-4">
                {gallery.map((image) => (
                  <div key={image.id} className="rounded-xl border border-slate-800 bg-slate-950/70 p-2">
                    <button type="button" onClick={() => openImageModal(gallery, 0)} className="block w-full">
                      <img src={image.file_url} alt={image.file_name || 'Imagem'} className="h-24 w-full rounded-lg object-cover" />
                    </button>
                    <p className="mt-2 text-xs text-slate-400 truncate">{image.file_name || 'Imagem salva'}</p>
                  </div>
                ))}
                {pendingFiles.map((image, index) => (
                  <div key={index} className="rounded-xl border border-slate-800 bg-slate-950/70 p-2">
                    <img src={image.preview} alt={image.file.name} className="h-24 w-full rounded-lg object-cover" />
                    <div className="mt-2 flex items-center justify-between">
                      <p className="text-xs text-slate-400 truncate">{image.file.name}</p>
                      <button type="button" onClick={() => removePendingFile(index)} className="text-rose-300 hover:text-rose-400"><Trash2 size={14} /></button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex gap-2 md:col-span-2 xl:col-span-1">
            <button type="submit" disabled={uploading} className="flex-1 rounded-xl bg-orange-500 px-4 py-3 font-semibold text-white hover:bg-orange-600 transition disabled:cursor-not-allowed disabled:opacity-60">
              {editingId ? (uploading ? 'Salvando...' : '💾 Salvar') : (uploading ? 'Cadastrando...' : '✅ Cadastrar')}
            </button>
            {editingId && <button type="button" onClick={resetForm} className="rounded-xl border border-slate-700 px-4 py-3 text-slate-300 hover:bg-slate-800 transition">Cancelar</button>}
          </div>
        </form>
      </div>

      {/* LISTAGEM */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
        <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-semibold">📋 Produtos cadastrados</h2>
            <span className="text-sm text-slate-400">({filtered.length})</span>
          </div>
          <div className="flex gap-2 w-full md:w-auto">
            <button onClick={abrirModalBipe} className="flex items-center gap-2 rounded-xl bg-emerald-500/20 px-4 py-2 text-sm font-semibold text-emerald-400 hover:bg-emerald-500/30 transition">
              <QrCode size={16} /> Bipar Produto
            </button>
            <div className="relative flex-1 md:w-80">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por nome, SKU ou categoria" className="w-full rounded-xl border border-slate-700 bg-slate-950 px-10 py-2 text-white placeholder:text-slate-500 focus:border-orange-500 focus:outline-none" />
            </div>
          </div>
        </div>

        {loading ? (
          <p className="text-sm text-slate-500">Carregando...</p>
        ) : filtered.length === 0 ? (
          <p className="rounded-3xl border border-slate-800 bg-slate-950/80 p-6 text-sm text-slate-400">Nenhum produto encontrado para essa busca.</p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {filtered.map((product) => {
              const images = product.images ?? [];
              const firstImage = images[0]?.file_url;
              const imageCount = images.length;
              const stockStatus = getStockStatus(product);
              const StatusIcon = stockStatus.icon;

              return (
                <div key={product.id} className={`rounded-3xl border p-4 shadow-lg shadow-slate-950/10 transition hover:shadow-slate-950/30 ${stockStatus.label === 'Baixo' ? 'border-rose-500/30 bg-rose-500/5' : stockStatus.label === 'Alto' ? 'border-amber-500/30 bg-amber-500/5' : 'border-slate-800 bg-slate-950/80'}`}>
                  <div className="relative overflow-hidden rounded-3xl bg-slate-900 group">
                    {firstImage ? (
                      <button type="button" onClick={() => openImageModal(images, 0)} className="w-full h-52 relative">
                        <img src={firstImage} alt={product.name} className="h-52 w-full object-contain object-center" />
                        {imageCount > 1 && <div className="absolute bottom-2 right-2 bg-black/70 text-white text-xs px-2 py-1 rounded-full flex items-center gap-1"><ImageIcon size={12} />{imageCount}</div>}
                        <div className="absolute inset-0 bg-black/0 hover:bg-black/20 transition-all duration-200 flex items-center justify-center">
                          <span className="bg-black/60 text-white px-3 py-1 rounded-full text-xs opacity-0 group-hover:opacity-100 transition-opacity">{imageCount >1 ? `Ver ${imageCount} fotos` : 'Ver foto'}</span>
                        </div>
                      </button>
                    ) : (
                      <div className="flex h-52 items-center justify-center bg-slate-900 text-slate-500"><ImageIcon size={32} /></div>
                    )}
                    <div className={`absolute top-2 right-2 ${stockStatus.bg} px-2 py-1 rounded-full flex items-center gap-1 text-xs font-semibold ${stockStatus.color}`}>
                      <StatusIcon size={12} /> {stockStatus.label}
                    </div>
                  </div>

                  <div className="mt-4 space-y-2">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="text-lg font-semibold text-slate-100">{product.name || 'Produto sem nome'}</h3>
                        <p className="text-sm text-slate-500">{product.sku ? `SKU ${product.sku}` : 'SKU não informado'}</p>
                      </div>
                      <span className={`rounded-full px-3 py-1 text-xs font-semibold ${product.status === 'ativo' ? 'bg-emerald-500/15 text-emerald-300' : 'bg-slate-500/15 text-slate-400'}`}>{product.status}</span>
                    </div>

                    <div className="grid grid-cols-3 gap-2 text-sm">
                      <div className="rounded-xl bg-slate-900/50 p-2 text-center">
                        <p className="text-xs text-slate-500">Atual</p>
                        <p className={`font-bold ${(product.current_stock ?? 0) < (product.min_stock ?? 0) ? 'text-rose-400' : (product.current_stock ?? 0) > (product.max_stock ?? 99999) ? 'text-amber-400' : 'text-emerald-400'}`}>{product.current_stock ?? 0}</p>
                      </div>
                      <div className="rounded-xl bg-slate-900/50 p-2 text-center">
                        <p className="text-xs text-slate-500">Mínimo</p>
                        <p className="font-bold text-slate-200">{product.min_stock ?? 0}</p>
                      </div>
                      <div className="rounded-xl bg-slate-900/50 p-2 text-center">
                        <p className="text-xs text-slate-500">Máximo</p>
                        <p className="font-bold text-slate-200">{product.max_stock ?? 0}</p>
                      </div>
                    </div>

                    {product.category && <p className="text-sm text-slate-400"><span className="text-slate-500">Categoria:</span> {product.category}</p>}

                    <div className="mt-4 flex flex-wrap gap-2">
                      <button onClick={() => handleEdit(product)} className="rounded-2xl border border-slate-700 bg-slate-900 px-3 py-2 text-xs font-semibold text-slate-200 transition hover:border-orange-500/60 hover:text-orange-300">✏️ Editar</button>
                      <button onClick={() => handleDelete(product.id)} className="rounded-2xl border border-rose-500/30 bg-slate-900 px-3 py-2 text-xs font-semiboldtext-rose-300 transition hover:bg-rose-500/10">🗑️ Excluir</button>
                      <button onClick={async () => { const novaQtd = (product.current_stock ?? 0) + 1; await supabase.from('products').update({ current_stock: novaQtd }).eq('id', product.id); loadProducts(); }} className="rounded-2xl border border-emerald-500/30 bg-slate-900 px-3 py-2 text-xs font-semibold text-emerald-300 transition hover:bg-emerald-500/10"><Plus size={14} className="inline mr-1" />+1</button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* MODAL DE BIPE */}
      {bipeModalOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 p-4">
          <div className={`relative w-full max-w-lg rounded-2xl border-2 p-6 shadow-2xl transition-all duration-300 ${getBipeBgColor()}`}>
            <button onClick={fecharModalBipe} className="absolute top-4 right-4 text-slate-400 hover:text-white transition"><X size={24} /></button>
            
            <div className="text-center mb-6">
              <div className={`inline-flex items-center justify-center w-16 h-16 rounded-full mb-3 transition-all duration-300 ${bipeStatus === 'entrada' ? 'bg-emerald-500/30 text-emerald-400' : bipeStatus === 'saida' ? 'bg-rose-500/30 text-rose-400' : bipeStatus === 'nao-encontrado' ? 'bg-blue-500/30 text-blue-400' : 'bg-emerald-500/20 text-emerald-400'}`}>
                <QrCode size={32} />
              </div>
              <h2 className="text-xl font-bold text-white">📡 Bipar Produto</h2>
              <p className="text-sm text-slate-400">Leia o código de barras ou digite o SKU</p>
              <p className="text-xs text-emerald-400 mt-1">🔄 Leitura automática - não precisa de ENTER</p>
            </div>

            <input
              ref={bipeInputRef}
              type="text"
              className={`w-full rounded-xl border-2 px-4 py-4 text-center text-2xl font-mono text-white placeholder:text-slate-600 focus:outline-none transition-all duration-300 ${bipeStatus === 'entrada' ? 'border-emerald-500 bg-emerald-500/10' : bipeStatus === 'saida' ? 'border-rose-500 bg-rose-500/10' : bipeStatus === 'nao-encontrado' ? 'border-blue-500 bg-blue-500/10' : 'border-orange-500/50 bg-slate-950 focus:border-orange-500'}`}
              placeholder="Digite ou leia o código..."
              value={bipeCode}
              onChange={handleBipeCodeChange}
              autoFocus
            />

            {bipeLoading && <div className="mt-4 text-center text-slate-400"><span className="animate-pulse">Buscando produto...</span></div>}

            {bipeProduct && !bipeLoading && (
              <div className={`mt-4 rounded-xl border p-4 transition-all duration-300 ${bipeStatus === 'entrada' ? 'border-emerald-500/50 bg-emerald-500/10' : bipeStatus === 'saida' ? 'border-rose-500/50 bg-rose-500/10' : 'border-slate-700 bg-slate-950/70'}`}>
                <div className="flex items-center gap-4">
                  {bipeProduct.images && bipeProduct.images.length > 0 ? (
                    <img src={bipeProduct.images[0].file_url} alt={bipeProduct.name} className="w-20 h-20 rounded-xl object-cover" />
                  ) : (
                    <div className="w-20 h-20 rounded-xl bg-slate-800 flex items-center justify-center"><Package size={32} className="text-slate-500" /></div>
                  )}
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-white">{bipeProduct.name}</h3>
                    <p className="text-sm text-slate-400">SKU: {bipeProduct.sku}</p>
                    <div className="mt-1 flex items-center gap-2">
                      <span className="text-sm text-slate-400">Quantidade atual:</span>
                      <span className={`text-xl font-bold ${(bipeProduct.current_stock ?? 0) < (bipeProduct.min_stock ?? 0) ? 'text-rose-400' : 'text-emerald-400'}`}>
                        {bipeProduct.current_stock ?? 0}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="mt-4 flex gap-3">
                  <button
                    onClick={() => confirmarBipe('adicionar')}
                    className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-emerald-500 px-4 py-3 font-semibold text-white hover:bg-emerald-600 transition shadow-lg shadow-emerald-500/30"
                  >
                    <Plus size={18} /> 🟢 Adicionar (+1)
                  </button>
                  <button
                    onClick={() => confirmarBipe('remover')}
                    disabled={(bipeProduct.current_stock ?? 0) <= 0}
                    className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-rose-500 px-4 py-3 font-semibold text-white hover:bg-rose-600 transition disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-rose-500/30"
                  >
                    <Minus size={18} /> 🔴 Remover (-1)
                  </button>
                </div>
              </div>
            )}

            {!bipeProduct && !bipeLoading && bipeCode && bipeStatus === 'nao-encontrado' && (
              <div className="mt-4 rounded-xl border-2 border-blue-500/50 bg-blue-500/10 p-4 text-center transition-all duration-300">
                <AlertTriangle size={24} className="inline mr-2 text-blue-400" />
                <span className="text-blue-400 font-bold">🔵 Produto não encontrado!</span>
                <p className="text-blue-300/70 text-sm mt-1">Verifique o código digitado</p>
              </div>
            )}

            <p className="mt-4 text-center text-xs text-slate-500">🔄 A busca é feita automaticamente após digitar o código</p>
          </div>
        </div>
      )}

      {/* MODAL DE IMAGENS */}
      {modalImage && modalImages.length > 0 && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/95" onClick={closeImageModal}>
          <div className="relative w-full h-full flex items-center justify-center" onClick={(e) => e.stopPropagation()}>
            <button onClick={closeImageModal} className="fixed top-4 right-4 text-white hover:text-orange-400 transition p-2 z-20 bg-black/50 rounded-full hover:bg-black/70"><X size={32} /></button>
            <div className="fixed top-4 left-4 text-white/80 text-sm z-20 font-medium bg-black/50 px-3 py-1 rounded-full">{currentImageIndex + 1} / {modalImages.length}</div>
            <div className="relative w-full max-w-6xl mx-4 flex items-center justify-center">
              <img src={modalImage} alt={`Imagem ${currentImageIndex + 1}`} className="max-h-[85vh] max-w-full object-contain" />
              <button onClick={goToPreviousImage} className="fixed left-4 top-1/2 -translate-y-1/2 bg-black/60 hover:bg-orange-500 text-white p-4 rounded-full transition-all duration-200 hover:scale-110 shadow-lg z-20"><ChevronLeft size={40} /></button>
              <button onClick={goToNextImage} className="fixed right-4 top-1/2 -translate-y-1/2 bg-black/60 hover:bg-orange-500 text-white p-4 rounded-full transition-all duration-200 hover:scale-110 shadow-lg z-20"><ChevronRight size={40} /></button>
            </div>
            {modalImages.length > 1 && (
              <div className="fixed bottom-6 left-1/2 -translate-x-1/2 flex gap-2 overflow-x-auto max-w-[90vw] px-4 py-2 bg-black/50 rounded-xl z-20">
                {modalImages.map((img, index) => (
                  <button key={index} onClick={() => { setCurrentImageIndex(index); setModalImage(img.file_url); }} className={`flex-shrink-0 w-14 h-14 rounded-lg overflow-hidden border-2 transition-all duration-200 ${index === currentImageIndex ? 'border-orange-500 shadow-lg shadow-orange-500/30 scale-110' : 'border-transparent hover:border-slate-500'}`}>
                    <img src={img.file_url} alt={`Miniatura ${index + 1}`} className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TOAST */}
      {message && (message.includes('✅') || message.includes('❌') || message.includes('🗑️') || message.includes('🟢') || message.includes('🔴') || message.includes('🔵')) && (
        <div className={`fixed bottom-4 right-4 z-[9999] px-6 py-4 rounded-xl shadow-2xl border ${message.includes('🟢') ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400' : message.includes('🔴') ? 'border-rose-500/30 bg-rose-500/10 text-rose-400' : message.includes('🔵') ? 'border-blue-500/30 bg-blue-500/10 text-blue-400' : message.includes('✅') || message.includes('🗑️') ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400' : 'border-rose-500/30 bg-rose-500/10 text-rose-400'}`}>
          {message}
        </div>
      )}
    </div>
  );
}
