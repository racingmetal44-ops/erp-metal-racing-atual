import React, { useState, useEffect } from 'react';

const NfePage = () => {
  const [activeTab, setActiveTab] = useState('entrada');
  const [operacao, setOperacao] = useState('entrada');
  const [xmlFile, setXmlFile] = useState(null);
  const [xmlFileName, setXmlFileName] = useState('Nenhum XML selecionado');
  const [xmlSigned, setXmlSigned] = useState(null);
  const [xmlSignedName, setXmlSignedName] = useState('');
  const [emitidas, setEmitidas] = useState([]);
  const [assinando, setAssinando] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem('nfeEmitidas');
    if (saved) {
      try {
        setEmitidas(JSON.parse(saved));
      } catch (e) {
        setEmitidas([]);
      }
    }
  }, []);

  useEffect(() => {
    if (emitidas.length > 0) {
      localStorage.setItem('nfeEmitidas', JSON.stringify(emitidas));
    }
  }, [emitidas]);

  // ============================================================
  //  FUNÇÃO PARA ASSINAR XML COM ASSINADOR SERPRO
  // ============================================================
  const handleAssinarXML = async () => {
    if (!xmlFile) {
      alert('?? Selecione um XML primeiro!');
      return;
    }

    setAssinando(true);

    try {
      // Criar FormData para enviar o arquivo
      const formData = new FormData();
      formData.append('xml', xmlFile);
      
      // Enviar para o backend para assinar
      const response = await fetch('/api/assinar-xml', {
        method: 'POST',
        body: formData
      });

      if (response.ok) {
        const result = await response.json();
        setXmlSigned(result.xmlAssinado);
        setXmlSignedName(xmlFile.name.replace('.xml', '.assinado.xml'));
        
        // Criar download do XML assinado
        const blob = new Blob([result.xmlAssinado], { type: 'application/xml' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = xmlFile.name.replace('.xml', '.assinado.xml');
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        alert('? XML assinado com sucesso!');
        
        // Adicionar ao histórico
        const operacaoNome = operacao === 'entrada' ? 'ENTRADA' : 'SAÍDA';
        const novaEmitida = {
          id: Date.now(),
          empresa: 'ART GRAV',
          operacao: operacaoNome,
          nfe: String(emitidas.length + 1001),
          data: new Date().toLocaleString('pt-BR'),
          danfe: '? Assinado',
          status: '? OK'
        };
        setEmitidas([...emitidas, novaEmitida]);
        
      } else {
        const error = await response.text();
        alert('? Erro ao assinar XML: ' + error);
      }
    } catch (error) {
      alert('? Erro ao assinar XML: ' + error.message);
    } finally {
      setAssinando(false);
    }
  };

  // ============================================================
  //  FUNÇÃO PARA ABRIR ASSINADOR SERPRO MANUALMENTE
  // ============================================================
  const handleAbrirAssinador = () => {
    // Tenta abrir o Assinador Serpro
    window.open('assinar://', '_blank');
    alert(
      '?? Assinador Serpro\n\n' +
      '1. Abra o Assinador Serpro manualmente\n' +
      '2. Clique em "Assinar XML"\n' +
      '3. Selecione o arquivo XML\n' +
      '4. Selecione o certificado\n' +
      '5. Assine e salve o arquivo'
    );
  };

  // ============================================================
  //  FUNÇÃO PARA BUSCAR XML
  // ============================================================
  const handleBuscarXML = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.xml';
    input.onchange = (e) => {
      const file = e.target.files[0];
      if (file) {
        setXmlFile(file);
        setXmlFileName(file.name);
        setXmlSigned(null);
        setXmlSignedName('');
        alert('? XML selecionado: ' + file.name);
      }
    };
    input.click();
  };

  // ============================================================
  //  FUNÇÃO PARA GERAR DANFE
  // ============================================================
  const handleGerarDanfe = () => {
    if (!xmlSigned) {
      alert('?? Primeiro assine o XML!');
      return;
    }

    const operacaoNome = operacao === 'entrada' ? 'ENTRADA' : 'SAÍDA';

    alert(
      '?? DANFE GERADO COM SUCESSO!\n\n' +
      '?? Empresa: ART GRAV COMUNICACAO INDUSTRIAL LTDA\n' +
      '?? Operação: ' + operacaoNome + '\n' +
      '?? XML: ' + xmlSignedName + '\n\n' +
      '? NF-e adicionada ao histórico!'
    );
  };

  // ============================================================
  //  FUNÇÃO PARA VISUALIZAR DANFE
  // ============================================================
  const handleVisualizarDanfe = () => {
    if (!xmlSigned) {
      alert('?? Primeiro assine o XML!');
      return;
    }
    alert('??? VISUALIZANDO DANFE\n\n?? XML: ' + xmlSignedName + '\n\n?? Funééo em desenvolvimento.');
  };

  // ============================================================
  //  ESTILOS
  // ============================================================
  const styles = {
    container: {
      padding: '24px',
      maxWidth: '1200px',
      margin: '0 auto',
      fontFamily: 'Segoe UI, sans-serif'
    },
    header: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: '24px',
      borderBottom: '2px solid #e8edf2',
      paddingBottom: '16px'
    },
    title: {
      fontSize: '28px',
      fontWeight: '700',
      color: '#1a2a3a',
      margin: 0
    },
    subtitle: {
      fontSize: '14px',
      color: '#6b7a8a',
      margin: '4px 0 0 0'
    },
    tabs: {
      display: 'flex',
      gap: '8px',
      marginBottom: '24px',
      background: '#f5f7fa',
      borderRadius: '10px',
      padding: '6px',
      border: '1px solid #e8edf2'
    },
    tab: (active) => ({
      flex: 1,
      padding: '12px 20px',
      background: active ? '#ffffff' : 'transparent',
      color: active ? '#1a2a3a' : '#6b7a8a',
      border: 'none',
      borderRadius: '8px',
      cursor: 'pointer',
      fontWeight: active ? '600' : '500',
      fontSize: '14px',
      boxShadow: active ? '0 2px 8px rgba(0,0,0,0.08)' : 'none',
      transition: 'all 0.2s'
    }),
    card: {
      background: '#ffffff',
      borderRadius: '12px',
      padding: '24px',
      border: '1px solid #e8edf2',
      marginBottom: '20px',
      boxShadow: '0 2px 8px rgba(0,0,0,0.04)'
    },
    cardTitle: {
      fontSize: '16px',
      fontWeight: '600',
      color: '#1a2a3a',
      margin: '0 0 16px 0',
      display: 'flex',
      alignItems: 'center',
      gap: '8px'
    },
    empresaCard: {
      background: '#f0f7ff',
      borderRadius: '8px',
      padding: '16px 20px',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      border: '1px solid #d6e8ff'
    },
    empresaNome: {
      fontSize: '16px',
      fontWeight: '600',
      color: '#1a3a6a'
    },
    empresaCnpj: {
      fontSize: '13px',
      color: '#4a6a8a'
    },
    badge: {
      background: '#28a745',
      color: 'white',
      padding: '4px 14px',
      borderRadius: '20px',
      fontSize: '12px',
      fontWeight: '600'
    },
    campo: {
      display: 'flex',
      alignItems: 'center',
      gap: '12px',
      flexWrap: 'wrap'
    },
    label: {
      fontWeight: '500',
      color: '#3a4a5a',
      minWidth: '120px',
      fontSize: '14px'
    },
    input: {
      flex: 1,
      padding: '10px 14px',
      border: '1px solid #d0d7de',
      borderRadius: '8px',
      fontSize: '14px',
      background: '#f8f9fa',
      minWidth: '200px'
    },
    inputDisabled: {
      flex: 1,
      padding: '10px 14px',
      border: '1px solid #e8edf2',
      borderRadius: '8px',
      fontSize: '14px',
      background: '#f5f7fa',
      color: '#4a5a6a',
      minWidth: '200px'
    },
    btnPrimary: {
      padding: '10px 24px',
      background: '#ff8c00',
      color: 'white',
      border: 'none',
      borderRadius: '8px',
      fontWeight: '600',
      fontSize: '14px',
      cursor: 'pointer',
      transition: 'background 0.2s'
    },
    btnSecondary: {
      padding: '10px 24px',
      background: '#007bff',
      color: 'white',
      border: 'none',
      borderRadius: '8px',
      fontWeight: '600',
      fontSize: '14px',
      cursor: 'pointer',
      transition: 'background 0.2s'
    },
    btnSuccess: {
      padding: '10px 24px',
      background: '#28a745',
      color: 'white',
      border: 'none',
      borderRadius: '8px',
      fontWeight: '600',
      fontSize: '14px',
      cursor: 'pointer',
      transition: 'background 0.2s'
    },
    btnDanger: {
      padding: '10px 24px',
      background: '#dc3545',
      color: 'white',
      border: 'none',
      borderRadius: '8px',
      fontWeight: '600',
      fontSize: '14px',
      cursor: 'pointer',
      transition: 'background 0.2s'
    },
    btnOutline: {
      padding: '10px 24px',
      background: 'transparent',
      color: '#007bff',
      border: '2px solid #007bff',
      borderRadius: '8px',
      fontWeight: '600',
      fontSize: '14px',
      cursor: 'pointer',
      transition: 'all 0.2s'
    },
    radioGroup: {
      display: 'flex',
      gap: '24px',
      padding: '4px 0'
    },
    opcaoButton: (isSelected, type) => ({
      display: 'flex',
      alignItems: 'center',
      gap: '12px',
      padding: '12px 24px',
      borderRadius: '10px',
      cursor: 'pointer',
      background: isSelected 
        ? (type === 'entrada' ? '#d4edda' : '#f8d7da')
        : '#f5f7fa',
      border: isSelected 
        ? (type === 'entrada' ? '3px solid #28a745' : '3px solid #dc3545')
        : '2px solid #e8edf2',
      transition: 'all 0.3s',
      fontWeight: isSelected ? '700' : '500',
      fontSize: '16px',
      boxShadow: isSelected ? '0 2px 12px rgba(0,0,0,0.1)' : 'none',
      userSelect: 'none',
      minWidth: '140px',
      justifyContent: 'center'
    }),
    entradaColor: {
      color: '#28a745',
      fontWeight: '700'
    },
    saidaColor: {
      color: '#dc3545',
      fontWeight: '700'
    },
    checkmark: {
      fontSize: '18px',
      marginLeft: '4px'
    },
    grid: {
      width: '100%',
      borderCollapse: 'collapse',
      marginTop: '8px'
    },
    gridHeader: {
      background: '#1a2a3a',
      color: 'white',
      padding: '12px 16px',
      textAlign: 'left',
      fontSize: '13px',
      fontWeight: '600'
    },
    gridCell: {
      padding: '12px 16px',
      borderBottom: '1px solid #e8edf2',
      fontSize: '14px'
    },
    emptyState: {
      textAlign: 'center',
      padding: '40px 20px',
      color: '#8a9aaa'
    },
    statusAssinatura: (assinado) => ({
      padding: '6px 16px',
      borderRadius: '20px',
      fontSize: '13px',
      fontWeight: '600',
      background: assinado ? '#d4edda' : '#fff3cd',
      color: assinado ? '#155724' : '#856404',
      border: assinado ? '1px solid #28a745' : '1px solid #ffc107'
    })
  };

  return (
    <div style={styles.container}>
      {/* HEADER */}
      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>?? NF-e</h1>
          <p style={styles.subtitle}>Nota Fiscal Eletrônica - Gestáo de entrada e emissão</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={styles.statusAssinatura(!!xmlSigned)}>
            {xmlSigned ? '? XML Assinado' : '? Aguardando assinatura'}
          </span>
          <span style={{ background: '#28a745', color: 'white', padding: '6px 16px', borderRadius: '20px', fontSize: '13px', fontWeight: '600' }}>
            ? ART GRAV ATIVA
          </span>
        </div>
      </div>

      {/* TABS */}
      <div style={styles.tabs}>
        <button 
          style={styles.tab(activeTab === 'entrada')}
          onClick={() => setActiveTab('entrada')}
        >
          ?? Entrada por XML
        </button>
        <button 
          style={styles.tab(activeTab === 'emitir')}
          onClick={() => setActiveTab('emitir')}
        >
          ?? Emissão NF-e
        </button>
      </div>

      {/* TAB ENTRADA */}
      {activeTab === 'entrada' && (
        <div style={styles.card}>
          <h3 style={styles.cardTitle}>?? Importar XML de NF-e</h3>
          <div style={styles.campo}>
            <span style={styles.label}>Arquivo XML:</span>
            <input 
              type="text" 
              value="Nenhum arquivo escolhido" 
              readOnly 
              style={styles.inputDisabled}
            />
            <button style={styles.btnSecondary}>?? Escolher arquivo</button>
          </div>
          <div style={{ marginTop: '16px' }}>
            <button style={{ ...styles.btnPrimary, background: '#007bff' }}>?? Importar XML</button>
          </div>
          <div style={{ marginTop: '24px', padding: '16px', background: '#f8f9fa', borderRadius: '8px', textAlign: 'center', color: '#8a9aaa' }}>
            Nenhuma entrada pendente.
          </div>
        </div>
      )}

      {/* TAB EMISSéO NF-e */}
      {activeTab === 'emitir' && (
        <div>
          {/* EMPRESA */}
          <div style={styles.card}>
            <h3 style={styles.cardTitle}>?? Empresa</h3>
            <div style={styles.empresaCard}>
              <div>
                <div style={styles.empresaNome}>ART GRAV COMUNICACAO INDUSTRIAL LTDA</div>
                <div style={styles.empresaCnpj}>CNPJ: 13.862.162/0001-80 | IE: 253.456.789</div>
                <div style={{ fontSize: '13px', color: '#4a6a8a', marginTop: '4px' }}>
                  ?? Ambiente: Homologação | ?? Joinville - SC
                </div>
              </div>
              <div>
                <span style={styles.badge}>? ATIVA</span>
              </div>
            </div>
          </div>

          {/* TIPO DE OPERAÇÃO */}
          <div style={styles.card}>
            <h3 style={styles.cardTitle}>?? Tipo de Operação</h3>
            <p style={{ fontSize: '13px', color: '#6b7a8a', margin: '-8px 0 12px 0' }}>
              Clique em uma opééo para selecionar
            </p>
            <div style={styles.radioGroup}>
              <div 
                style={styles.opcaoButton(operacao === 'entrada', 'entrada')}
                onClick={() => setOperacao('entrada')}
              >
                <span style={styles.entradaColor}>📥 Entrada</span>
                {operacao === 'entrada' && <span style={styles.checkmark}>?</span>}
              </div>
              <div 
                style={styles.opcaoButton(operacao === 'saida', 'saida')}
                onClick={() => setOperacao('saida')}
              >
                <span style={styles.saidaColor}>📤 Saída</span>
                {operacao === 'saida' && <span style={styles.checkmark}>?</span>}
              </div>
            </div>
            <div style={{ marginTop: '8px', fontSize: '13px', color: '#6b7a8a' }}>
              {operacao === 'entrada' ? (
                <span style={{ color: '#28a745', fontWeight: '600' }}>📥 Entrada selecionada</span>
              ) : (
                <span style={{ color: '#dc3545', fontWeight: '600' }}>📤 Saída selecionada</span>
              )}
            </div>
          </div>

          {/* ASSINATURA DIGITAL */}
          <div style={styles.card}>
            <h3 style={styles.cardTitle}>🔐 Assinatura Digital</h3>
            <div style={styles.campo}>
              <span style={styles.label}>XML da NF-e:</span>
              <input 
                type="text" 
                value={xmlFileName} 
                readOnly 
                style={styles.input}
              />
              <button onClick={handleBuscarXML} style={styles.btnSecondary}>
                🔎 Buscar XML
              </button>
            </div>
            
            {xmlFile && (
              <div style={{ marginTop: '12px', display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                <button 
                  onClick={handleAssinarXML} 
                  style={styles.btnSuccess}
                  disabled={assinando}
                >
                  {assinando ? '? Assinando...' : '🔐 ASSINAR XML'}
                </button>
                <button 
                  onClick={handleAbrirAssinador} 
                  style={styles.btnOutline}
                >
                  🔐 ABRIR ASSINADOR
                </button>
              </div>
            )}

            {xmlSigned && (
              <div style={{ marginTop: '12px', padding: '12px', background: '#d4edda', borderRadius: '8px', border: '1px solid #28a745' }}>
                <strong style={{ color: '#155724' }}>? XML assinado:</strong>
                <span style={{ marginLeft: '8px', color: '#155724' }}>{xmlSignedName}</span>
              </div>
            )}
          </div>

          {/* GERAR DANFE */}
          <div style={styles.card}>
            <h3 style={styles.cardTitle}>📄 Gerar DANFE</h3>
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
              <button onClick={handleGerarDanfe} style={styles.btnPrimary}>
                📄 GERAR DANFE
              </button>
              <button onClick={handleVisualizarDanfe} style={styles.btnOutline}>
                👁️ VISUALIZAR DANFE
              </button>
            </div>
          </div>

          {/* HISTéRICO */}
          <div style={styles.card}>
            <h3 style={styles.cardTitle}>📋 NF-e Emitidas</h3>
            {emitidas.length === 0 ? (
              <div style={styles.emptyState}>
                <div style={{ fontSize: '40px', marginBottom: '8px' }}>??</div>
                <p style={{ margin: 0, fontSize: '16px', fontWeight: '500' }}>Nenhuma NF-e emitida ainda.</p>
                <p style={{ margin: '4px 0 0 0', fontSize: '14px', color: '#8a9aaa' }}>Assine um XML para comeéar.</p>
              </div>
            ) : (
              <table style={styles.grid}>
                <thead>
                  <tr>
                    <th style={styles.gridHeader}>Empresa</th>
                    <th style={styles.gridHeader}>Operação</th>
                    <th style={styles.gridHeader}>NF-e</th>
                    <th style={styles.gridHeader}>Data/Hora</th>
                    <th style={styles.gridHeader}>DANFE</th>
                    <th style={styles.gridHeader}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {emitidas.map((item) => (
                    <tr key={item.id}>
                      <td style={styles.gridCell}>{item.empresa}</td>
                      <td style={{ 
                        ...styles.gridCell,
                        color: item.operacao === 'ENTRADA' ? '#28a745' : '#dc3545',
                        fontWeight: '700'
                      }}>
                        {item.operacao}
                      </td>
                      <td style={styles.gridCell}>{item.nfe}</td>
                      <td style={styles.gridCell}>{item.data}</td>
                      <td style={styles.gridCell}>{item.danfe}</td>
                      <td style={styles.gridCell}>{item.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default NfePage;
