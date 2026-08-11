const certServerUrl = import.meta.env.VITE_CERT_SERVER_URL;
const STORAGE_KEYS = {
    certificateFile: 'erp_certificate_file',
    certificatePassword: 'erp_certificate_password',
    certificateName: 'erp_certificate_name'
};

export async function salvarConfiguracaoCertificado(file, password) {
    if (typeof window === 'undefined' || !file) {
        return false;
    }

    try {
        const base64 = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });

        window.localStorage.setItem(STORAGE_KEYS.certificateFile, base64);
        window.localStorage.setItem(STORAGE_KEYS.certificatePassword, password || '');
        window.localStorage.setItem(STORAGE_KEYS.certificateName, file.name || 'certificado');
        return true;
    } catch (erro) {
        console.error('❌ Erro ao salvar certificado:', erro);
        return false;
    }
}

export function consultarCertificadoConfigurado() {
    if (typeof window === 'undefined') {
        return { configured: false, name: '', password: '' };
    }

    return {
        configured: Boolean(window.localStorage.getItem(STORAGE_KEYS.certificateFile) && window.localStorage.getItem(STORAGE_KEYS.certificatePassword)),
        name: window.localStorage.getItem(STORAGE_KEYS.certificateName) || '',
        password: window.localStorage.getItem(STORAGE_KEYS.certificatePassword) || ''
    };
}

export async function validarCertificadoAntesDeEmitir() {
    const localConfig = consultarCertificadoConfigurado();
    if (localConfig.configured) {
        console.log('✅ Certificado local carregado. Pode emitir a NF-e.');
        return true;
    }

    if (!certServerUrl) {
        console.error('❌ VITE_CERT_SERVER_URL não configurado.');
        return false;
    }

    try {
        const resposta = await fetch(`${certServerUrl.replace(/\/$/, '')}/api/status`);
        const dados = await resposta.json();

        if (resposta.ok && (dados.certificado === 'Carregado' || dados.status === 'ok')) {
            console.log('✅ Certificado validado! Pode emitir a NF-e.');
            return true;
        }

        console.error('❌ Certificado não está carregado no servidor.');
        return false;
    } catch (erro) {
        console.error('❌ Servidor de certificados não está respondendo:', erro);
        return false;
    }
}
