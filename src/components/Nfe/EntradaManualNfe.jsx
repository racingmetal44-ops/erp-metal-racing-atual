import React, { useState } from 'react';

export default function EntradaManualNfe({ onClose }) {
  const [formData, setFormData] = useState({
    tipoSaida: '', serie: '1', numero: '', loja: '', unidadeNegocio: '',
    naturezaOperacao: '', dataEmissao: '', horaEmissao: '', dataSaida: '', horaSaida: '',
    regimeTributario: '', finalidade: '', indicadorPresenca: '',
    nomeContato: '', tipoPessoa: 'Jurídica', cnpj: '', vendedor: '',
    cep: '', uf: '', municipio: '', bairro: '', endereco: '', numeroEnd: '', complemento: '', foneFax: '', email: ''
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const inputClass = "w-full border border-slate-700 bg-slate-950 rounded p-2 text-sm text-white focus:outline-none focus:border-blue-500";
  const labelClass = "block text-xs font-semibold text-slate-400 mb-1";

  return (
    <div className="bg-slate-900 border border-slate-800 p-6 rounded-lg shadow-xl w-full max-w-6xl mx-auto my-8 overflow-y-auto max-h-[90vh]">
      <div className="flex justify-between items-center mb-6 border-b border-slate-800 pb-4">
        <h2 className="text-xl font-bold text-white">Entrada Manual de NF-e</h2>
        <div className="flex gap-3">
          <button onClick={onClose} className="px-4 py-2 border border-slate-700 rounded text-slate-300 hover:bg-slate-800">Cancelar</button>
          <button className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700">Salvar</button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-6">
        <div><label className={labelClass}>Tipo de Saída *</label><select name="tipoSaida" className={inputClass} onChange={handleChange}><option value="">Emissão Própria</option></select></div>
        <div><label className={labelClass}>Série *</label><input type="text" name="serie" value={formData.serie} className={inputClass} onChange={handleChange} /></div>
        <div><label className={labelClass}>Número *</label><input type="text" name="numero" className={inputClass} onChange={handleChange} /></div>
        <div><label className={labelClass}>Loja</label><select name="loja" className={inputClass} onChange={handleChange}><option value="">Todas as lojas</option></select></div>
        <div><label className={labelClass}>Unidade de negócio</label><select name="unidadeNegocio" className={inputClass} onChange={handleChange}><option value="">Nenhuma unidade</option></select></div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-6">
        <div className="lg:col-span-2"><label className={labelClass}>Natureza de operação *</label><input type="text" name="naturezaOperacao" className={inputClass} onChange={handleChange} placeholder="Venda prod do estabelecimento" /></div>
        <div><label className={labelClass}>Data de emissão *</label><input type="date" name="dataEmissao" className={inputClass} onChange={handleChange} /></div>
        <div><label className={labelClass}>Hora de emissão *</label><input type="time" name="horaEmissao" className={inputClass} onChange={handleChange} /></div>
        <div><label className={labelClass}>Data saída</label><input type="date" name="dataSaida" className={inputClass} onChange={handleChange} /></div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-8">
        <div><label className={labelClass}>Código do regime tributário *</label><select name="regimeTributario" className={inputClass} onChange={handleChange}><option value="">Simples nacional</option></select></div>
        <div><label className={labelClass}>Finalidade *</label><select name="finalidade" className={inputClass} onChange={handleChange}><option value="">NF-e normal</option></select></div>
        <div className="lg:col-span-2"><label className={labelClass}>Indicador de presença *</label><select name="indicadorPresenca" className={inputClass} onChange={handleChange}><option value="">9 - Operação não presencial, outros</option></select></div>
      </div>

      <h3 className="text-lg font-bold text-white mb-3 border-b border-slate-800 pb-2">Destinatário</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="lg:col-span-2"><label className={labelClass}>Nome do contato *</label><input type="text" name="nomeContato" className={inputClass} onChange={handleChange} /></div>
        <div><label className={labelClass}>Tipo da pessoa *</label><select name="tipoPessoa" className={inputClass} onChange={handleChange}><option value="Jurídica">Jurídica</option><option value="Física">Física</option></select></div>
        <div><label className={labelClass}>CNPJ</label><input type="text" name="cnpj" className={inputClass} onChange={handleChange} /></div>
        <div><label className={labelClass}>Vendedor</label><input type="text" name="vendedor" className={inputClass} onChange={handleChange} /></div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
        <div><label className={labelClass}>CEP</label><input type="text" name="cep" className={inputClass} onChange={handleChange} /></div>
        <div><label className={labelClass}>UF</label><input type="text" name="uf" className={inputClass} onChange={handleChange} /></div>
        <div className="lg:col-span-2"><label className={labelClass}>Município</label><input type="text" name="municipio" className={inputClass} onChange={handleChange} /></div>
        <div className="lg:col-span-2"><label className={labelClass}>Bairro</label><input type="text" name="bairro" className={inputClass} onChange={handleChange} /></div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
        <div className="lg:col-span-3"><label className={labelClass}>Endereço</label><input type="text" name="endereco" className={inputClass} onChange={handleChange} /></div>
        <div><label className={labelClass}>Número</label><input type="text" name="numeroEnd" className={inputClass} onChange={handleChange} /></div>
        <div className="lg:col-span-2"><label className={labelClass}>Complemento</label><input type="text" name="complemento" className={inputClass} onChange={handleChange} /></div>
        <div className="lg:col-span-2"><label className={labelClass}>Fone/FAX</label><input type="text" name="foneFax" className={inputClass} onChange={handleChange} /></div>
        <div className="lg:col-span-4"><label className={labelClass}>E-mail</label><input type="email" name="email" className={inputClass} onChange={handleChange} /></div>
      </div>

      <h3 className="text-lg font-bold text-white mb-3 border-b border-slate-800 pb-2">Itens da nota fiscal</h3>
      <div className="overflow-x-auto mb-6">
        <table className="w-full text-sm text-left border border-slate-700">
          <thead className="bg-slate-800 text-slate-300 font-semibold">
            <tr>
              <th className="p-2 border-b border-slate-700">Produto ou serviço</th>
              <th className="p-2 border-b border-slate-700">Código</th>
              <th className="p-2 border-b border-slate-700">UN</th>
              <th className="p-2 border-b border-slate-700">Qtde</th>
              <th className="p-2 border-b border-slate-700">Preço un</th>
              <th className="p-2 border-b border-slate-700">Preço total</th>
              <th className="p-2 border-b border-slate-700">NCM</th>
              <th className="p-2 border-b border-slate-700 w-10"></th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="p-2"><input type="text" className="w-full border border-slate-700 bg-slate-950 rounded p-1 text-white" placeholder="Digite parte do nome ou código do item" /></td>
              <td className="p-2"><input type="text" className="w-full border border-slate-700 bg-slate-950 rounded p-1 text-white" /></td>
              <td className="p-2"><input type="text" className="w-full border border-slate-700 bg-slate-950 rounded p-1 text-white" /></td>
              <td className="p-2"><input type="number" className="w-full border border-slate-700 bg-slate-950 rounded p-1 text-white" /></td>
              <td className="p-2"><input type="number" className="w-full border border-slate-700 bg-slate-950 rounded p-1 text-white" /></td>
              <td className="p-2"><input type="number" className="w-full border border-slate-700 bg-slate-950 rounded p-1 text-white" /></td>
              <td className="p-2"><input type="text" className="w-full border border-slate-700 bg-slate-950 rounded p-1 text-white" /></td>
              <td className="p-2 text-center text-red-500 cursor-pointer">🗑️</td>
            </tr>
          </tbody>
        </table>
        <button className="mt-2 text-blue-400 text-sm font-semibold hover:underline">+ Adicionar outro item (Alt+Z)</button>
      </div>

      <h3 className="text-lg font-bold text-white mb-3 border-b border-slate-800 pb-2">Cálculo de imposto</h3>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <div><label className={labelClass}>Total dos Produtos (R$)</label><input type="text" className="w-full border border-slate-700 bg-slate-800 rounded p-2 text-white" readOnly /></div>
        <div><label className={labelClass}>Valor do Frete (R$)</label><input type="text" className="w-full border border-slate-700 bg-slate-950 rounded p-2 text-white" /></div>
        <div><label className={labelClass}>Valor do Seguro (R$)</label><input type="text" className="w-full border border-slate-700 bg-slate-950 rounded p-2 text-white" /></div>
        <div><label className={labelClass}>Outras Despesas (R$)</label><input type="text" className="w-full border border-slate-700 bg-slate-950 rounded p-2 text-white" /></div>
        <div><label className={labelClass}>Desconto (R$)</label><input type="text" className="w-full border border-slate-700 bg-slate-950 rounded p-2 text-white" /></div>
        <div><label className={labelClass}>Total da Nota (R$)</label><input type="text" className="w-full border border-slate-700 bg-slate-800 rounded p-2 text-white font-bold" readOnly /></div>
      </div>
    </div>
  );
}
