// src/components/fiscal/NFEmitir.jsx
import React, { useState } from 'react';

export function NFEmitir({ empresa, cliente, produtos, onEmitirSuccess }) {
    const [loading, setLoading] = useState(false);
    const [resultado, setResultado] = useState(null);
    const [erro, setErro] = useState(null);

    const handleEmitir = async () => {
        if (!empresa || !cliente || !produtos || produtos.length === 0) {
            setErro('Preencha todos os dados antes de emitir');
            return;
        }

        setLoading(true);
        setErro(null);
        setResultado(null);

        const body = {
            empresa,
            cliente,
            produtos,
            ambiente: 'homologacao',
            serie: '1',
            empresaId: '1'
        };

        try {
            const response = await fetch('/api/nfe/emitir', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });

            const data = await response.json();

            if (response.ok && data.success) {
                setResultado(data.nfe);
                if (onEmitirSuccess) onEmitirSuccess(data.nfe);
            } else {
                setErro(data.error || 'Erro ao emitir NF-e');
            }
        } catch (error) {
            setErro('Erro: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="space-y-4 p-4 border border-gray-700 rounded-lg bg-gray-800/50">
            <h3 className="text-lg font-semibold text-white">Emissão NF-e</h3>

            {erro && (
                <div className="p-3 bg-red-900/50 text-red-300 rounded">
                    ❌ {erro}
                </div>
            )}

            {resultado && (
                <div className="p-3 bg-green-900/50 text-green-300 rounded">
                    <h4 className="font-semibold">✅ NF-e emitida!</h4>
                    <div className="grid grid-cols-2 gap-2 text-sm mt-2">
                        <span className="text-gray-400">Número:</span>
                        <span className="text-white">{resultado.numero}</span>
                        <span className="text-gray-400">Série:</span>
                        <span className="text-white">{resultado.serie}</span>
                        <span className="text-gray-400">Chave:</span>
                        <span className="text-white text-xs break-all">{resultado.chave}</span>
                        <span className="text-gray-400">Status:</span>
                        <span className="text-green-400 font-semibold">{resultado.status}</span>
                        <span className="text-gray-400">Protocolo:</span>
                        <span className="text-white">{resultado.protocolo}</span>
                    </div>
                    <div className="mt-4 flex gap-2">
                        <button
                            onClick={() => {
                                const blob = new Blob([resultado.xml], { type: 'text/xml' });
                                const url = URL.createObjectURL(blob);
                                const a = document.createElement('a');
                                a.href = url;
                                a.download = 'nfe-' + resultado.numero + '.xml';
                                a.click();
                                URL.revokeObjectURL(url);
                            }}
                            className="px-3 py-1 bg-blue-600 hover:bg-blue-700 rounded text-white text-sm"
                        >
                            📥 Baixar XML
                        </button>
                        <button
                            onClick={() => {
                                window.open('/api/nfe/danfe', '_blank');
                            }}
                            className="px-3 py-1 bg-yellow-600 hover:bg-yellow-700 rounded text-white text-sm"
                        >
                            🖨️ Imprimir DANFE
                        </button>
                    </div>
                </div>
            )}

            <button
                onClick={handleEmitir}
                disabled={loading}
                className={'w-full py-3 rounded text-white font-semibold transition ' +
                    (loading ? 'bg-gray-600 cursor-not-allowed' : 'bg-green-600 hover:bg-green-700')}
            >
                {loading ? '⏳ Emitindo...' : '📄 Emitir NF-e'}
            </button>
        </div>
    );
}
