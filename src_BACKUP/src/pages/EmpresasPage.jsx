import React, { useState, useEffect } from 'react';

const Empresas = () => {
  // Dados fixos com ART GRAV e Xcompetition
  const [empresas, setEmpresas] = useState([
    {
      id: '1',
      nome: 'ART GRAV COMUNICACAO INDUSTRIAL LTDA',
      cnpj: '13.862.162/0001-80',
      razao_social: 'ART GRAV COMUNICACAO INDUSTRIAL LTDA',
      nome_fantasia: 'METAL RACING ACESSÓRIOS AUTOMOTIVO',
      ie: '253.456.789',
      regime_tributario: 'Lucro Presumido',
      cidade: 'Joinville',
      uf: 'SC',
      status: 'ativo',
      ambiente: 'Homologação',
      certificado: '? Válido',
      pronto_para_faturar: false
    },
    {
      id: '2',
      nome: 'Xcompetition Motorsport',
      cnpj: '13.862.162/0003-42',
      razao_social: 'XCOMPETITION MOTORSPORT LTDA',
      nome_fantasia: 'Xcompetition Motorsport',
      ie: '253.456.790',
      regime_tributario: 'Lucro Presumido',
      cidade: 'Joinville',
      uf: 'SC',
      status: 'ativo',
      ambiente: 'Homologação',
      certificado: '? Válido',
      pronto_para_faturar: true
    }
  ]);

  const [searchTerm, setSearchTerm] = useState('');

  const empresasFiltradas = empresas.filter(emp => 
    emp.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
    emp.cnpj.includes(searchTerm)
  );

  return (
    <div style={{ padding: '20px', maxWidth: '1200px', margin: '0 auto' }}>
      <h1 style={{ fontSize: '24px', fontWeight: '700', color: '#1a2a3a' }}>?? Empresas</h1>
      <p style={{ color: '#6b7a8a', marginBottom: '24px' }}>
        Central de cadastro, certificado digital e configuração fiscal.
      </p>

      {/* Status Cards */}
      <div style={{ display: 'flex', gap: '16px', marginBottom: '24px', flexWrap: 'wrap' }}>
        <div style={{ background: '#fff3cd', padding: '12px 20px', borderRadius: '8px', border: '1px solid #ffc107', flex: 1, minWidth: '150px' }}>
          <strong>STATUS</strong><br />
          <span style={{ color: '#856404' }}>?? Configuração incompleta</span>
        </div>
        <div style={{ background: '#f8d7da', padding: '12px 20px', borderRadius: '8px', border: '1px solid #dc3545', flex: 1, minWidth: '150px' }}>
          <strong>CERTIFICADO</strong><br />
          <span style={{ color: '#721c24' }}>? Não enviado</span>
        </div>
        <div style={{ background: '#d4edda', padding: '12px 20px', borderRadius: '8px', border: '1px solid #28a745', flex: 1, minWidth: '150px' }}>
          <strong>NF-E</strong><br />
          <span style={{ color: '#155724' }}>? Configurada</span>
        </div>
        <div style={{ background: '#cce5ff', padding: '12px 20px', borderRadius: '8px', border: '1px solid #007bff', flex: 1, minWidth: '150px' }}>
          <strong>Ambiente</strong><br />
          <span style={{ color: '#004085' }}>?? Homologação</span>
        </div>
      </div>

      {/* Busca */}
      <div style={{ marginBottom: '20px' }}>
        <input
          type="text"
          placeholder="Buscar por nome, CNPJ ou razão social"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={{
            width: '100%',
            maxWidth: '500px',
            padding: '10px 16px',
            border: '1px solid #d0d7de',
            borderRadius: '8px',
            fontSize: '14px'
          }}
        />
      </div>

      {/* Lista de Empresas */}
      <div style={{ display: 'grid', gap: '16px' }}>
        {empresasFiltradas.map((empresa) => (
          <div
            key={empresa.id}
            style={{
              background: '#ffffff',
              padding: '20px',
              borderRadius: '12px',
              border: '1px solid #e8edf2',
              boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap'
            }}
          >
            <div>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '600' }}>
                {empresa.nome}
              </h3>
              <p style={{ margin: '4px 0', color: '#6b7a8a', fontSize: '14px' }}>
                <strong>CNPJ:</strong> {empresa.cnpj}
              </p>
              <p style={{ margin: '4px 0', color: '#6b7a8a', fontSize: '14px' }}>
                <strong>Ambiente:</strong> {empresa.ambiente}
              </p>
              <p style={{ margin: '4px 0', color: '#6b7a8a', fontSize: '14px' }}>
                <strong>Certificado:</strong> {empresa.certificado}
              </p>
              <p style={{ margin: '4px 0', fontSize: '14px' }}>
                <strong>Status:</strong>{' '}
                <span style={{ 
                  color: empresa.status === 'ativo' ? '#28a745' : '#dc3545',
                  fontWeight: '600'
                }}>
                  {empresa.status === 'ativo' ? '? Ativo' : '? Inativo'}
                </span>
                {empresa.pronto_para_faturar && (
                  <span style={{ 
                    background: '#28a745', 
                    color: 'white', 
                    padding: '2px 10px', 
                    borderRadius: '12px',
                    fontSize: '11px',
                    marginLeft: '8px'
                  }}>
                    PRONTO
                  </span>
                )}
              </p>
            </div>
            <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
              <button style={{
                padding: '6px 16px',
                background: '#007bff',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '13px'
              }}>
                Editar
              </button>
              <button style={{
                padding: '6px 16px',
                background: '#dc3545',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '13px'
              }}>
                Inativar
              </button>
            </div>
          </div>
        ))}
      </div>

      {empresasFiltradas.length === 0 && (
        <div style={{ textAlign: 'center', padding: '40px', color: '#8a9aaa' }}>
          Nenhuma empresa encontrada.
        </div>
      )}

      {/* Botão Cadastrar */}
      <div style={{ marginTop: '24px' }}>
        <button style={{
          padding: '10px 24px',
          background: '#28a745',
          color: 'white',
          border: 'none',
          borderRadius: '8px',
          fontWeight: '600',
          cursor: 'pointer',
          fontSize: '14px'
        }}>
          + Cadastrar empresa
        </button>
      </div>
    </div>
  );
};

export default Empresas;
