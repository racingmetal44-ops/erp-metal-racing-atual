import React, { useState, useEffect } from 'react';
import { CertificadoUpload } from '../components/fiscal/CertificadoUpload';
import { NFEmitir } from '../components/fiscal/NFEmitir';

const NfePage = () => {
    const [empresaId, setEmpresaId] = useState('1');
    const [empresa, setEmpresa] = useState(null);
    const [cliente, setCliente] = useState(null);
    const [produtos, setProdutos] = useState([]);
    const [nfeList, setNfeList] = useState([]);
    const [loading, setLoading] = useState(false);
    const [resultado, setResultado] = useState(null);

    // Buscar NF-e emitidas
    const buscarNfe = async () => {
        try {
            const response = await fetch('/api/nfe/consultar/lista');
            const data = await response.json();
            if (data.success) {
                setNfeList(data.nfes || []);
            }
        } catch (error) {
            console.error('Erro ao buscar NF-e:', error);
        }
    };

    useEffect(() => {
        buscarNfe();
    }, []);

    const handleEmitirSuccess = (nfe) => {
        setResultado(nfe);
        buscarNfe();
    };

    const handleCancelar = async (chave) => {
        if (!window.confirm('Deseja realmente cancelar esta NF-e?')) return;
        
        const justificativa = window.prompt('Informe a justificativa para o cancelamento:');
        if (!justificativa || justificativa.length < 15) {
            alert('Justificativa deve ter no mínimo 15 caracteres');
            return;
        }

        try {
            const response = await fetch('/api/nfe/cancelar', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ chave, justificativa })
            });
            const data = await response.json();
            if (data.success) {
                alert('NF-e cancelada com sucesso!');
                buscarNfe();
            } else {
                alert('Erro ao cancelar: ' + data.error);
            }
        } catch (error) {
            alert('Erro: ' + error.message);
        }
    };

    const handleDownloadXml = (nfe) => {
        const blob = new Blob([nfe.xml], { type: 'text/xml' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `nfe-${nfe.numero}.xml`;
        a.click();
        URL.revokeObjectURL(url);
    };

    return (
        <div className="p-6 space-y-6">
            <h1 className="text-3xl font-bold text-white">NF-e - Nota Fiscal Eletrônica</h1>
            
            {/* Certificado Digital */}
            <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700">
                <CertificadoUpload 
                    empresaId={empresaId} 
                    onUploadSuccess={(info) => console.log('Certificado enviado:', info)}
                />
            </div>

            {/* Emissão NF-e */}
            <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700">
                <NFEmitir 
                    empresa={empresa}
                    cliente={cliente}
                    produtos={produtos}
                    onEmitirSuccess={handleEmitirSuccess}
                />
            </div>

            {/* Resultado da Emissão */}
            {resultado && (
                <div className="bg-green-900/30 border border-green-700 rounded-lg p-4">
                    <h3 className="text-green-400 font-semibold">✅ NF-e Emitida com Sucesso!</h3>
                    <div className="grid grid-cols-2 gap-2 mt-2 text-sm">
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
                            onClick={() => handleDownloadXml(resultado)}
                            className="px-3 py-1 bg-blue-600 hover:bg-blue-700 rounded text-white text-sm"
                        >
                            📥 Baixar XML
                        </button>
                        <button
                            onClick={() => window.open('/api/nfe/danfe', '_blank')}
                            className="px-3 py-1 bg-yellow-600 hover:bg-yellow-700 rounded text-white text-sm"
                        >
                            🖨️ DANFE
                        </button>
                    </div>
                </div>
            )}

            {/* Lista de NF-e */}
            <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700">
                <h3 className="text-lg font-semibold text-white mb-4">📋 NF-e Emitidas</h3>
                {nfeList.length === 0 ? (
                    <p className="text-gray-400">Nenhuma NF-e emitida ainda.</p>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-gray-700">
                                    <th className="text-left py-2 text-gray-400">Número</th>
                                    <th className="text-left py-2 text-gray-400">Série</th>
                                    <th className="text-left py-2 text-gray-400">Chave</th>
                                    <th className="text-left py-2 text-gray-400">Status</th>
                                    <th className="text-left py-2 text-gray-400">Ações</th>
                                </tr>
                            </thead>
                            <tbody>
                                {nfeList.map((nfe, index) => (
                                    <tr key={index} className="border-b border-gray-700/50">
                                        <td className="py-2 text-white">{nfe.numero}</td>
                                        <td className="py-2 text-white">{nfe.serie}</td>
                                        <td className="py-2 text-white text-xs break-all">{nfe.chave}</td>
                                        <td className="py-2">
                                            <span className={`px-2 py-1 rounded text-xs ${
                                                nfe.status === 'AUTORIZADA' ? 'bg-green-900/50 text-green-400' :
                                                nfe.status === 'CANCELADA' ? 'bg-red-900/50 text-red-400' :
                                                'bg-yellow-900/50 text-yellow-400'
                                            }`}>
                                                {nfe.status}
                                            </span>
                                        </td>
                                        <td className="py-2">
                                            <button
                                                onClick={() => handleDownloadXml(nfe)}
                                                className="text-blue-400 hover:text-blue-300 text-xs mr-2"
                                            >
                                                📥 XML
                                            </button>
                                            {nfe.status === 'AUTORIZADA' && (
                                                <button
                                                    onClick={() => handleCancelar(nfe.chave)}
                                                    className="text-red-400 hover:text-red-300 text-xs"
                                                >
                                                    ❌ Cancelar
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
};

export default NfePage;
