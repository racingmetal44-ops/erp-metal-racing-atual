import { useEffect, useState } from 'react';
import { Upload, ShieldCheck } from 'lucide-react';
import { consultarCertificadoConfigurado, salvarConfiguracaoCertificado } from '../utils/certificateValidator';

export default function SettingsPage() {
  const [selectedFile, setSelectedFile] = useState(null);
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [certificateName, setCertificateName] = useState('');
  const [certificateConfigured, setCertificateConfigured] = useState(false);

  useEffect(() => {
    const config = consultarCertificadoConfigurado();
    if (config.name) {
      setCertificateName(config.name);
      setCertificateConfigured(config.configured);
      setPassword(config.password || '');
    }
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();

    if (!selectedFile) {
      setMessage('Selecione um arquivo de certificado antes de salvar.');
      return;
    }

    if (!password.trim()) {
      setMessage('Informe a senha do certificado para continuar.');
      return;
    }

    const ok = await salvarConfiguracaoCertificado(selectedFile, password);
    if (ok) {
      setCertificateName(selectedFile.name);
      setCertificateConfigured(true);
      setMessage(`Certificado salvo com sucesso: ${selectedFile.name}`);
    } else {
      setMessage('Não foi possível salvar o certificado. Tente novamente.');
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
        <p className="text-sm text-orange-400">Configurações</p>
        <h1 className="mt-2 text-3xl font-semibold">Todas as configurações</h1>
        <p className="mt-2 text-sm text-slate-400">Centralize aqui as principais configurações do ERP, inclusive o certificado digital.</p>
      </div>

      <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
        <div className="mb-4 inline-flex rounded-full border border-slate-700 bg-slate-800/70 px-3 py-2 text-sm text-slate-300">
          <span className="font-medium">Todas as configurações</span>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-5">
          <div className="flex items-start gap-3">
            <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-2 text-emerald-300">
              <ShieldCheck size={18} />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">Certificado digital</h2>
              <p className="mt-1 text-sm text-slate-400">
                Faça o upload do certificado e informe a senha para que a emissão, impressão e download da NF-e possam usar esse arquivo.
              </p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <label className="flex cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-slate-700 bg-slate-900/70 px-4 py-8 text-center text-sm text-slate-400 transition hover:border-orange-500/60 hover:bg-slate-800/60">
              <Upload size={20} className="mb-2 text-orange-400" />
              <span className="font-medium text-slate-200">
                {selectedFile ? selectedFile.name : 'Clique para selecionar o certificado'}
              </span>
              <span className="mt-1 text-xs">Formatos aceitos: .pfx, .p12, .cer, .crt, .pem</span>
              <input
                type="file"
                accept=".pfx,.p12,.cer,.crt,.pem"
                className="hidden"
                onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
              />
            </label>

            <div>
              <label className="mb-2 block text-sm text-slate-400">Senha do certificado</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Digite a senha"
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-2.5 text-sm text-white outline-none focus:border-orange-500"
              />
            </div>

            <button
              type="submit"
              className="rounded-xl border border-orange-500/40 bg-orange-500/10 px-4 py-2.5 text-sm font-medium text-orange-300 transition hover:bg-orange-500/20"
            >
              Salvar configuração
            </button>
          </form>

          <div className="mt-5 rounded-xl border border-slate-800 bg-slate-900/70 p-4 text-sm text-slate-300">
            <p><span className="text-slate-500">Status:</span> {certificateConfigured ? 'Certificado configurado' : 'Nenhum certificado salvo ainda'}</p>
            <p className="mt-1"><span className="text-slate-500">Arquivo:</span> {certificateName || 'Ainda não selecionado'}</p>
            {message ? <p className="mt-3 text-orange-300">{message}</p> : null}
          </div>
        </div>
      </div>
    </div>
  );
}
