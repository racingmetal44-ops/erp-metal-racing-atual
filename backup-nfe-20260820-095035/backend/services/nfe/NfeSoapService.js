// src/backend/services/nfe/NfeSoapService.js
import axios from 'axios';
import fs from 'fs-extra';
import path from 'path';
import forge from 'node-forge';
import { SEFAZ_CONFIG } from '../../config/sefaz.js';

export class NfeSoapService {
    constructor() {
        this.timeout = 30000;
    }

    async enviar(xmlAssinado, empresaId, ambiente = 'homologacao') {
        try {
            // 1. Carregar certificado
            const certPath = path.join(process.cwd(), 'certificados', `empresa_${empresaId}.pfx`);
            if (!await fs.pathExists(certPath)) {
                throw new Error('Certificado não encontrado');
            }

            // 2. URL do WebService
            const url = SEFAZ_CONFIG.SC[ambiente].NfeAutorizacao;
            console.log('📡 Enviando para:', url);

            // 3. Montar SOAP
            const soapBody = this.montarSoap(xmlAssinado);

            // 4. Enviar com certificado (simulado por enquanto)
            // Em produção, usar axios com httpsAgent configurado com o certificado
            const response = await axios.post(url, soapBody, {
                headers: {
                    'Content-Type': 'application/soap+xml; charset=utf-8',
                    'SOAPAction': 'http://www.portalfiscal.inf.br/nfe/wsdl/NfeAutorizacao'
                },
                timeout: this.timeout
            });

            // 5. Interpretar resposta
            const resultado = this.interpretarResposta(response.data);
            return resultado;
        } catch (error) {
            console.error('❌ Erro no envio SOAP:', error.message);
            throw error;
        }
    }

    montarSoap(xmlAssinado) {
        return `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://www.w3.org/2003/05/soap-envelope">
    <soap:Header>
        <nfeCabecMsg xmlns="http://www.portalfiscal.inf.br/nfe/wsdl/NfeAutorizacao">
            <cUF>42</cUF>
            <versaoDados>4.00</versaoDados>
        </nfeCabecMsg>
    </soap:Header>
    <soap:Body>
        <nfeDadosMsg xmlns="http://www.portalfiscal.inf.br/nfe/wsdl/NfeAutorizacao">
            ${xmlAssinado}
        </nfeDadosMsg>
    </soap:Body>
</soap:Envelope>`;
    }

    interpretarResposta(xmlResponse) {
        // Extrair cStat, xMotivo, nProt, etc.
        // Simulação
        return {
            success: true,
            cStat: 100,
            xMotivo: 'Autorizado o uso da NF-e',
            nProt: Date.now().toString().padStart(15, '0'),
            dhRecbto: new Date().toISOString()
        };
    }
}
