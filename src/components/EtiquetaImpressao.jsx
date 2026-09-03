// src/components/MiniEtiqueta.jsx
import React from 'react';

const MiniEtiqueta = ({ dados }) => {
  const imprimir = () => {
    const sku = dados?.product_sku || dados?.sku || 'S-084';
    const nome = dados?.product_name || dados?.nome || 'CHEVETTE';

    // HTML LIMPO - SEM METAL RACING, SEM DATA, SEM LOTE, SEM SKU duplicado
    const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>Etiqueta</title>
      <style>
        * { margin:0; padding:0; }
        body { 
          display:flex; 
          justify-content:center; 
          align-items:center; 
          height:100vh; 
          background:white;
          font-family:Arial, sans-serif;
        }
        .etiqueta {
          width:50mm;
          height:25mm;
          border:0.5px solid #000;
          display:flex;
          flex-direction:column;
          justify-content:center;
          align-items:center;
          text-align:center;
          background:white;
        }
        .etiqueta .nome {
          font-size:8pt;
          font-weight:bold;
          text-transform:uppercase;
        }
        .etiqueta .codigo {
          font-size:14pt;
          font-weight:bold;
          letter-spacing:0.5px;
        }
        @page {
          size:50mm 25mm;
          margin:0;
        }
        @media print {
          body { margin:0; padding:0; }
          .etiqueta { border:0.5px solid #000; }
        }
      </style>
    </head>
    <body>
      <div class="etiqueta">
        <div class="nome">${nome}</div>
        <div class="codigo">${sku}</div>
      </div>
      <script>
        window.onload = function() {
          setTimeout(function() {
            window.print();
            setTimeout(window.close, 500);
          }, 300);
        };
      <\/script>
    </body>
    </html>
    `;

    const win = window.open('', '_blank', 'width=200,height=150');
    if (win) {
      win.document.write(html);
      win.document.close();
    }
  };

  return (
    <button
      onClick={imprimir}
      style={{
        background: '#2563eb',
        color: 'white',
        border: 'none',
        padding: '8px 16px',
        borderRadius: '6px',
        fontSize: '14px',
        fontWeight: 'bold',
        cursor: 'pointer'
      }}
    >
      🏷️ Imprimir Etiqueta
    </button>
  );
};

export default MiniEtiqueta;