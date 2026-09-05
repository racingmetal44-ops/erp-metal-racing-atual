// src/components/fiscal/CertificadoUpload.jsx
import React, { useState } from 'react';

export function CertificadoUpload({ empresaId, onUploadSuccess }) {
    const [file, setFile] = useState(null);
    const [senha, setSenha] = useState('');
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState('');
    const [certInfo, setCertInfo] = useState(null);

    const handleFileChange = (e) => {
        const selected = e.target.files[0];
        if (selected && (selected.name.endsWith('.pfx') || selected.name.endsWith('.p12'))) {
            setFile(selected);
            setMessage('');
        } else {
            setFile(null);
            setMessage('⚠️ Selecione um arquivo .pfx ou .p12');
        }
    };

    const handleUpload = async () => {
        if (!file) {
            setMessage('⚠️ Selecione um arquivo');
            return;
        }
        if (!senha) {
            setMessage('⚠️ Digite a senha do certificado');
            return;
        }

        setLoading(true);
        setMessage('');

        const formData = new FormData();
        formData.append('certificado', file);
        formData.append('senha', senha);

        try {
            const response = await fetch(`/api/empresas/${empresaId}/certificado`, {
                method: 'POST',
                body: formData
            });

            const data = await response.json();

            if (response.ok && data.success) {
                setCertInfo(data.data);
                setMessage('✅ Certificado enviado com sucesso!');
                if (onUploadSuccess) onUploadSuccess(data.data);
            } else {
                setMessage(`❌ Erro: ${data.error || 'Falha no upload'}`);
            }
        } catch (error) {
            setMessage(`❌ Erro: ${error.message}`);
        } finally {
            setLoading(false);
        }
    };

    const handleTest = async () => {
        if (!file) {
            setMessage('⚠️ Selecione um arquivo');
            return;
        }
        if (!senha) {
            setMessage('⚠️ Digite a senha do certificado');
            return;
        }

        setLoading(true);
        setMessage('');

        const formData = new FormData();
        formData.append('certificado', file);
        formData.append('senha', senha);

        try {
            const response = await fetch(`/api/empresas/${empresaId}/certificado/testar`, {
                method: 'POST',
                body: formData
            });

            const data = await response.json();

            if (response.ok && data.valid) {
                setMessage(`✅ ${data.message}`);
            } else {
                setMessage(`❌ ${data.message || 'Certificado inválido'}`);
            }
        } catch (error) {
            setMessage(`❌ Erro: ${error.message}`);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="space-y-4 p-4 border border-gray-700 rounded-lg bg-gray-800/50">
            <h3 className="text-lg font-semibold text-white">Certificado Digital</h3>
            
            <div>
                <label className="block text-sm text-gray-300">Arquivo (.pfx ou .p12)</label>
                <input
                    type="file"
                    accept=".pfx,.p12"
                    onChange={handleFileChange}
                    className="w-full p-2 border border-gray-600 rounded bg-gray-700 text-white"
                />
                {file && <span className="text-sm text-green-400">📄 {file.name}</span>}
            </div>

            <div>
                <label className="block text-sm text-gray-300">Senha</label>
                <input
                    type="password"
                    value={senha}
                    onChange={(e) => setSenha(e.target.value)}
                    className="w-full p-2 border border-gray-600 rounded bg-gray-700 text-white"
                    placeholder="Digite a senha do certificado"
                />
            </div>

            <div className="flex gap-4">
                <button
                    onClick={handleTest}
                    disabled={loading || !file}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded text-white disabled:opacity-50"
                >
                    {loading ? 'Testando...' : '🔍 Testar Certificado'}
                </button>
                <button
                    onClick={handleUpload}
                    disabled={loading || !file}
                    className="px-4 py-2 bg-green-600 hover:bg-green-700 rounded text-white disabled:opacity-50"
                >
                    {loading ? 'Enviando...' : '📤 Enviar Certificado'}
                </button>
            </div>

            {message && (
                <div className={`p-3 rounded ${message.includes('✅') ? 'bg-green-900/50 text-green-300' : 'bg-red-900/50 text-red-300'}`}>
                    {message}
                </div>
            )}

            {certInfo && (
                <div className="p-3 bg-gray-700/50 rounded">
                    <h4 className="font-semibold text-white">Informações do Certificado</h4>
                    <div className="grid grid-cols-2 gap-2 text-sm mt-2">
                        <span className="text-gray-400">Nome:</span>
                        <span className="text-white">{certInfo.nome}</span>
                        <span className="text-gray-400">CNPJ:</span>
                        <span className="text-white">{certInfo.cnpj}</span>
                        <span className="text-gray-400">Emissor:</span>
                        <span className="text-white">{certInfo.emissor}</span>
                        <span className="text-gray-400">Validade:</span>
                        <span className="text-white">
                            {new Date(certInfo.validadeInicial).toLocaleDateString()} até{' '}
                            {new Date(certInfo.validadeFinal).toLocaleDateString()}
                        </span>
                        <span className="text-gray-400">Status:</span>
                        <span className={`font-semibold ${certInfo.status === 'VALIDO' ? 'text-green-400' : 'text-red-400'}`}>
                            {certInfo.status}
                        </span>
                    </div>
                </div>
            )}
        </div>
    );
}
