import React, { useEffect, useState } from 'react';
import { validarCertificadoAntesDeEmitir } from '../utils/certificateValidator';
import { supabase } from '../lib/supabase';

const NfePage = () => {
  const [checkingCertificate, setCheckingCertificate] = useState(true);
  const [certificateReady, setCertificateReady] = useState(false);
  const [certificateMessage, setCertificateMessage] = useState('Validando certificado digital...');
  const [showEmitModal, setShowEmitModal] = useState(false);

  const nota = {
    numero: '000123',
    serie: '1',
    cliente: 'Cliente Exemplo',
    valor: 1250.9,
    data: '07/08/2026',
    cnpj: '12.345.678/0001-99'
  };

  useEffect(() => {
    void verificarCertificado();
  }, []);

  async function verificarCertificado() {
    setCheckingCertificate(true);
    const valido = await validarCertificadoAntesDeEmitir();
    setCertificateReady(valido);
    setCertificateMessage(
      valido
        ? 'Certificado digital OK. Impressão e download liberados.'
        : 'Certificado digital indisponível ou inválido. Ação bloqueada.'
    );
    setCheckingCertificate(false);
    return valido;
  }

  function buildPrintableHtml() {
    return `<!DOCTYPE html>
      <html lang="pt-BR">
        <head>
          <meta charset="utf-8" />
          <title>NF-e ${nota.serie}-${nota.numero}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 24px; color: #111827; }
            .box { border: 1px solid #d1d5db; border-radius: 8px; padding: 16px; margin-bottom: 16px; }
            h1 { font-size: 20px; margin: 0 0 8px; }
            p { margin: 4px 0; }
          </style>
        </head>
        <body>
          <div class="box">
            <h1>Nota Fiscal Eletrônica</h1>
            <p><strong>Série/Número:</strong> ${nota.serie} - ${nota.numero}</p>
            <p><strong>Cliente:</strong> ${nota.cliente}</p>
            <p><strong>CNPJ:</strong> ${nota.cnpj}</p>
            <p><strong>Valor:</strong> R$ ${nota.valor.toFixed(2)}</p>
            <p><strong>Data:</strong> ${nota.data}</p>
          </div>
          <p>Documento emitido com base no certificado digital configurado.</p>
        </body>
      </html>`;
  }

  async function handlePrint() {
    const valido = await verificarCertificado();
    if (!valido) return;

    const printWindow = window.open('', '_blank', 'width=900,height=700');
    if (!printWindow) {
      alert('Bloqueador de pop-up ativado. Permita a abertura da janela de impressão.');
      return;
    }

    printWindow.document.write(buildPrintableHtml());
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
    }, 300);
  }

  async function handleDownload() {
    const valido = await verificarCertificado();
    if (!valido) return;

    const blob = new Blob([buildPrintableHtml()], { type: 'text/html;charset=utf-8' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `nf-e-${nota.serie}-${nota.numero}.html`;
    link.click();
    window.URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6 p-6">
      <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
        <p className="text-sm text-orange-400">NF-e</p>
        <h1 className="mt-2 text-3xl font-semibold">Emissão e visualização</h1>
        <p className="mt-2 text-sm text-slate-400">
          A impressão e o download só são liberados quando o certificado digital estiver disponível.
        </p>
      </div>

      <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm text-slate-400">Status do certificado</p>
            <p className={`font-semibold ${certificateReady ? 'text-emerald-400' : 'text-rose-400'}`}>
              {checkingCertificate ? 'Validando...' : certificateMessage}
            </p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={handlePrint}
              className="rounded-xl border border-slate-700 bg-slate-800 px-4 py-2 text-sm text-white transition hover:bg-slate-700"
            >
              Imprimir
            </button>
            <button
              onClick={handleDownload}
              className="rounded-xl border border-orange-500/40 bg-orange-500/10 px-4 py-2 text-sm text-orange-300 transition hover:bg-orange-500/20"
            >
              Download
            </button>
            <button
              onClick={() => setShowEmitModal(true)}
              className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-2 text-sm text-emerald-300 transition hover:bg-emerald-500/20"
            >
              + Emitir NF-e
            </button>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
        <h2 className="text-lg font-semibold text-white">Pré-visualização da NF-e</h2>
        <div className="mt-4 space-y-2 rounded-xl border border-slate-800 bg-slate-950/50 p-4 text-sm text-slate-300">
          <p><span className="text-slate-500">Série/Número:</span> {nota.serie} - {nota.numero}</p>
          <p><span className="text-slate-500">Cliente:</span> {nota.cliente}</p>
          <p><span className="text-slate-500">CNPJ:</span> {nota.cnpj}</p>
          <p><span className="text-slate-500">Valor:</span> R$ {nota.valor.toFixed(2)}</p>
          <p><span className="text-slate-500">Data:</span> {nota.data}</p>
        </div>
      </div>
      {showEmitModal && <EmitModal onClose={() => setShowEmitModal(false)} />}
    </div>
  );
};

export default NfePage;

function EmitModal({ onClose }) {
  const [companies, setCompanies] = useState([]);
  const [companyId, setCompanyId] = useState('');
  const [customer, setCustomer] = useState('');
  const [items, setItems] = useState([{ sku: '', description: '', quantity: 1, unit_price: 0 }] );

  useEffect(() => {
    supabase.from('companies').select('*').then(({ data }) => setCompanies(data ?? []));
  }, []);

  async function handleEmit() {
    const payload = { company_id: companyId, customer, items, created_at: new Date().toISOString() };
    const res = await fetch('/api/nfe/emit', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    const json = await res.json();
    if (json.ok) {
      alert('Solicitação de emissão registrada. ID: ' + (json.job?.id || json.job?.id));
      onClose();
    } else {
      alert('Falha: ' + (json.error || ''));
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-2xl rounded-2xl border border-slate-800 bg-slate-900/80 p-6">
        <h2 className="text-lg font-semibold">Emitir NF-e</h2>
        <div className="mt-4 grid gap-3">
          <select value={companyId} onChange={(e) => setCompanyId(e.target.value)} className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3">
            <option value="">Selecione a empresa emissora</option>
            {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <input value={customer} onChange={(e) => setCustomer(e.target.value)} placeholder="Cliente (nome / CNPJ)" className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3" />
          <div className="space-y-2">
            {items.map((it, idx) => (
              <div key={idx} className="grid gap-2 md:grid-cols-4">
                <input value={it.sku} onChange={(e) => { const next = [...items]; next[idx].sku = e.target.value; setItems(next); }} placeholder="SKU" className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2" />
                <input value={it.description} onChange={(e) => { const next = [...items]; next[idx].description = e.target.value; setItems(next); }} placeholder="Descrição" className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2" />
                <input type="number" value={it.quantity} onChange={(e) => { const next = [...items]; next[idx].quantity = Number(e.target.value); setItems(next); }} placeholder="Quantidade" className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2" />
                <input type="number" value={it.unit_price} onChange={(e) => { const next = [...items]; next[idx].unit_price = Number(e.target.value); setItems(next); }} placeholder="Preço unitário" className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2" />
              </div>
            ))}
            <button onClick={() => setItems((s) => [...s, { sku: '', description: '', quantity: 1, unit_price: 0 } ])} className="rounded-xl border border-slate-700 px-3 py-2 text-sm">Adicionar item</button>
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <button onClick={onClose} className="rounded-xl border border-slate-700 px-4 py-2">Cancelar</button>
            <button onClick={handleEmit} className="rounded-xl bg-emerald-500 px-4 py-2 text-white">Transmitir NF-e</button>
          </div>
        </div>
      </div>
    </div>
  );
}
