// src/components/MiniEtiqueta.jsx
import React from 'react';

const MiniEtiqueta = ({ dados }) => {
  const imprimir = () => {
    const sku = dados?.product_sku || dados?.sku || '10095';
    const nome = dados?.product_name || dados?.nome || 'A5';

    // HTML PURO - SEM REACT, SEM CACHE
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
          font-family:Arial;
        }
        .e {
          <width:49></width:49>mm;
          <height:28></height:28>mm;
          border:1px solid black;
          display:flex;
          flex-direction:column;
          justify-content:center;
          align-items:center;
          text-align:center;
          background:white;
        }
        .e .n { font-size:8pt; font-weight:bold; text-transform:uppercase; }
        .e .c { font-size:14pt; font-weight:bold; }
        @page { size:50mm 25mm; margin:0; }
        @media print { body { margin:0; padding:0; } }
      </style>
    </head>
    <body>
      <div class="e">
        <div class="n">${nome}</div>
        <div class="c">${sku}</div>
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
        background: '#22c55e',
        color: 'white',
        border: '2px solid #16a34a',
        padding: '8px 16px',
        borderRadius: '8px',
        fontSize: '14px',
        fontWeight: 'bold',
        cursor: 'pointer'
      }}
    >
      🏷️ ETIQUETA 5x2.5
    </button>
  );
};

export default MiniEtiqueta;