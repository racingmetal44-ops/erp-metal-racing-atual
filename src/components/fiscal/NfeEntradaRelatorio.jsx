import { useState } from 'react';
import * as XLSX from 'xlsx';
import html2pdf from 'html2pdf.js';

const emptyFilters = {
  dataInicial: '',
  dataFinal: '',
  fornecedor: '',
  cnpj: '',
  numero: '',
  statusNfe: '',
  situacaoFinanceira: '',
};

const money = (value) => Number(value || 0).toLocaleString('pt-BR', {
  style: 'currency',
  currency: 'BRL',
});

const csvValue = (value) => {
  const text = value === null || value === undefined ? '' : String(value);
  return `"${text.replace(/"/g, '""')}"`;
};

const download = (content, filename, type) => {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
};

export default function NfeEntradaRelatorio({ onClose }) {
  const [filters, setFilters] = useState(emptyFilters);
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [pdfMessage, setPdfMessage] = useState('');

  const updateFilter = (key, value) => setFilters((current) => ({ ...current, [key]: value }));

  async function generateReport() {
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/financeiro/relatorios/nfe-financeiro', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(filters),
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.error || 'Não foi possível gerar o relatório.');
      setReport(data);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }

  function exportCsv() {
    if (!report) return;
    const headers = ['NF-e', 'Série', 'Chave', 'Emissão', 'Entrada', 'Fornecedor', 'CNPJ', 'Status', 'Total', 'Títulos', 'Pago', 'Pendente'];
    const rows = report.nfe.map((nfe) => {
      const titles = report.financeiro.filter((item) => item.nfe_chave === nfe.chave);
      return [nfe.numero, nfe.serie, nfe.chave, nfe.data_emissao, nfe.data_entrada, nfe.emitente, nfe.fornecedor_cnpj, nfe.status, nfe.total, titles.reduce((sum, item) => sum + Number(item.valor || 0), 0), titles.reduce((sum, item) => sum + Number(item.valor_pago || 0), 0), titles.reduce((sum, item) => sum + Math.max(Number(item.valor || 0) - Number(item.valor_pago || 0), 0), 0)];
    });
    const csv = [headers, ...rows].map((row) => row.map(csvValue).join(';')).join('\r\n');
    download(`\uFEFF${csv}`, 'relatorio-nfe-entrada.csv', 'text/csv;charset=utf-8');
  }

  function exportExcel() {
    if (!report) return;
    const workbook = XLSX.utils.book_new();
    const sheets = {
      'NF-e': report.nfe,
      Produtos: report.produtos,
      Financeiro: report.financeiro,
      Resumo: [report.resumo],
      Impostos: report.impostos,
    };
    Object.entries(sheets).forEach(([name, rows]) => {
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(rows), name);
    });
    XLSX.writeFile(workbook, 'relatorio-nfe-entrada.xlsx');
  }

  function exportPdf() {
    if (!report) return;
    setPdfMessage('');
    const rows = report.nfe.map((nfe) => `<tr><td>${nfe.numero}</td><td>${nfe.serie}</td><td>${nfe.emitente}</td><td>${nfe.data_entrada || nfe.data_emissao}</td><td>${nfe.status}</td><td>${money(nfe.total)}</td></tr>`).join('');
    const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Relatório de NF-e de entrada</title><style>body{font-family:Arial,sans-serif;color:#172033;padding:24px}h1{margin-bottom:4px}p{color:#475569}.summary{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin:20px 0}.card{border:1px solid #cbd5e1;padding:10px;border-radius:6px}.card strong{display:block;font-size:18px;margin-top:4px}table{border-collapse:collapse;width:100%;font-size:11px}th,td{border:1px solid #cbd5e1;padding:7px;text-align:left}th{background:#e2e8f0}@media print{button{display:none}}</style></head><body><h1>Relatório de NF-e de entrada</h1><p>Documentos confirmados no ERP</p><div class="summary"><div class="card">NF-e<strong>${report.resumo.quantidade_nfe}</strong></div><div class="card">Valor total<strong>${money(report.resumo.valor_total_nfe)}</strong></div><div class="card">Pago<strong>${money(report.resumo.total_pago)}</strong></div><div class="card">Pendente<strong>${money(report.resumo.total_pendente)}</strong></div></div><table><thead><tr><th>NF-e</th><th>Série</th><th>Fornecedor</th><th>Entrada</th><th>Status</th><th>Total</th></tr></thead><tbody>${rows}</tbody></table><button onclick="window.print()">Imprimir / Salvar em PDF</button></body></html>`;
    const container = document.createElement('div');
    container.innerHTML = html;
    container.style.position = 'fixed';
    container.style.left = '-100000px';
    container.style.top = '0';
    container.style.width = '1100px';
    document.body.appendChild(container);
    html2pdf()
      .set({
        margin: 10,
        filename: 'relatorio-nfe-entrada.pdf',
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true, backgroundColor: '#ffffff' },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'landscape' },
      })
      .from(container)
      .save()
      .then(() => setPdfMessage('PDF gerado e baixado com sucesso.'))
      .catch(() => setPdfMessage('Não foi possível gerar o PDF. Tente novamente.'))
      .finally(() => container.remove());
  }

  return (
    <section className="space-y-4 rounded-xl border border-slate-700 bg-slate-900/70 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-white">Relatório de NF-e de entrada</h2>
          <p className="text-sm text-slate-400">Considera somente documentos confirmados no estoque.</p>
        </div>
        <button type="button" onClick={onClose} className="rounded-lg border border-slate-600 px-3 py-2 text-sm text-slate-300">Fechar</button>
      </div>

      <div className="grid gap-2 md:grid-cols-4">
        <input type="date" value={filters.dataInicial} onChange={(event) => updateFilter('dataInicial', event.target.value)} className="rounded-lg border border-slate-700 bg-slate-950 p-2 text-white" />
        <input type="date" value={filters.dataFinal} onChange={(event) => updateFilter('dataFinal', event.target.value)} className="rounded-lg border border-slate-700 bg-slate-950 p-2 text-white" />
        <input placeholder="Fornecedor" value={filters.fornecedor} onChange={(event) => updateFilter('fornecedor', event.target.value)} className="rounded-lg border border-slate-700 bg-slate-950 p-2 text-white" />
        <input placeholder="CNPJ" value={filters.cnpj} onChange={(event) => updateFilter('cnpj', event.target.value)} className="rounded-lg border border-slate-700 bg-slate-950 p-2 text-white" />
        <input placeholder="Número da NF-e" value={filters.numero} onChange={(event) => updateFilter('numero', event.target.value)} className="rounded-lg border border-slate-700 bg-slate-950 p-2 text-white" />
        <select value={filters.statusNfe} onChange={(event) => updateFilter('statusNfe', event.target.value)} className="rounded-lg border border-slate-700 bg-slate-950 p-2 text-white"><option value="">Todos os status fiscais</option><option value="CONFIRMADA">NF-e autorizadas</option><option value="CONFERENCIA">Em conferência</option><option value="CANCELADA">Canceladas</option></select>
        <select value={filters.situacaoFinanceira} onChange={(event) => updateFilter('situacaoFinanceira', event.target.value)} className="rounded-lg border border-slate-700 bg-slate-950 p-2 text-white"><option value="">Toda situação financeira</option><option value="PAGO">Pagos</option><option value="PENDENTE">Pendentes</option><option value="VENCIDO">Vencidos</option></select>
        <button type="button" onClick={generateReport} disabled={loading} className="rounded-lg bg-orange-500 px-3 py-2 font-semibold text-white disabled:opacity-50">{loading ? 'Gerando...' : 'Gerar relatório'}</button>
      </div>

      {error && <div className="rounded-lg border border-red-700 bg-red-900/30 p-3 text-sm text-red-300">{error}</div>}
      {report && <>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <div className="rounded-lg border border-slate-700 p-3"><span className="text-xs text-slate-400">NF-e</span><strong className="block text-lg text-white">{report.resumo.quantidade_nfe}</strong></div>
          <div className="rounded-lg border border-slate-700 p-3"><span className="text-xs text-slate-400">Valor total</span><strong className="block text-lg text-white">{money(report.resumo.valor_total_nfe)}</strong></div>
          <div className="rounded-lg border border-slate-700 p-3"><span className="text-xs text-slate-400">Financeiro</span><strong className="block text-lg text-white">{money(report.resumo.total_financeiro)}</strong></div>
          <div className="rounded-lg border border-slate-700 p-3"><span className="text-xs text-slate-400">Pago</span><strong className="block text-lg text-emerald-300">{money(report.resumo.total_pago)}</strong></div>
          <div className="rounded-lg border border-slate-700 p-3"><span className="text-xs text-slate-400">Pendente</span><strong className="block text-lg text-amber-300">{money(report.resumo.total_pendente)}</strong></div>
        </div>
        <div className="flex flex-wrap items-center gap-2"><button type="button" onClick={exportPdf} className="rounded-lg border border-slate-600 px-3 py-2 text-sm text-slate-200">PDF</button><button type="button" onClick={exportExcel} className="rounded-lg border border-emerald-600 px-3 py-2 text-sm text-emerald-300">Excel</button><button type="button" onClick={exportCsv} className="rounded-lg border border-blue-600 px-3 py-2 text-sm text-blue-300">CSV</button>{pdfMessage && <span className="text-sm text-amber-300">{pdfMessage}</span>}</div>
        <div className="overflow-x-auto"><table className="w-full min-w-[850px] text-left text-sm"><thead className="border-b border-slate-700 text-slate-400"><tr><th className="p-2">NF-e</th><th className="p-2">Fornecedor</th><th className="p-2">Entrada</th><th className="p-2">Status</th><th className="p-2">Total</th></tr></thead><tbody>{report.nfe.map((nfe) => <tr key={nfe.id || nfe.chave} className="border-b border-slate-800"><td className="p-2 text-white">{nfe.numero}/{nfe.serie}</td><td className="p-2 text-slate-300">{nfe.emitente}</td><td className="p-2 text-slate-300">{nfe.data_entrada || nfe.data_emissao || '-'}</td><td className="p-2 text-slate-300">{nfe.status}</td><td className="p-2 text-white">{money(nfe.total)}</td></tr>)}</tbody></table></div>
      </>}
    </section>
  );
}
