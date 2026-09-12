export class NfePreValidationService {
    numeros(valor) {
        return String(valor ?? '').replace(/\D/g, '');
    }

    validar(empresa, cliente, produtos, opcoes = {}) {
        const erros = [];
        const exigir = (ok, campo, mensagem) => {
            if (!ok) {
                erros.push({ campo, mensagem, bloqueante: true });
            }
        };

        const ie = this.numeros(empresa?.inscricaoEstadual || empresa?.ie);
        const rt = empresa?.responsavelTecnico;

        exigir(this.numeros(empresa?.cnpj).length === 14, 'empresa.cnpj', 'CNPJ do emitente deve ter 14 dígitos.');
        exigir(ie.length >= 2, 'empresa.ie', 'IE do emitente é obrigatória.');
        exigir(['1', '2', '3'].includes(String(empresa?.crt || empresa?.CRT || '')), 'empresa.crt', 'CRT deve ser informado.');
        exigir(empresa?.uf && (empresa?.codigoIbge || empresa?.codigo_ibge), 'empresa.endereco', 'UF e código IBGE do emitente são obrigatórios.');

        exigir(
            opcoes.serie !== undefined &&
            opcoes.serie !== null &&
            String(opcoes.serie).trim() !== '',
            'serie',
            'Série da NF-e é obrigatória.'
        );
        exigir(
            rt?.cnpj && rt?.xContato && rt?.email && rt?.fone,
            'empresa.responsavelTecnico',
            'Configure o responsável técnico (CNPJ, contato, e-mail e telefone) antes de transmitir.'
        );
        exigir(
            [11, 14].includes(this.numeros(cliente?.cnpj || cliente?.cpf).length),
            'cliente.documento',
            'CPF ou CNPJ do destinatário é obrigatório.'
        );
        exigir(cliente?.nome, 'cliente.nome', 'Nome/razão social do destinatário é obrigatório.');
        exigir(
            cliente?.uf && (cliente?.codigoIbge || cliente?.codigo_ibge),
            'cliente.endereco',
            'UF e código IBGE do destinatário são obrigatórios.'
        );

        if (String(cliente?.indIEDest) === '9') {
            exigir(
                String(cliente?.indFinal) === '1',
                'cliente.indFinal',
                'Não contribuinte exige indFinal=1 para esta operação.'
            );
        }

        exigir(Array.isArray(produtos) && produtos.length > 0, 'produtos', 'Informe ao menos um produto.');

        (produtos || []).forEach((produto, index) => {
            const campo = `produtos[${index}]`;
            const cfop =
                produto?.cfop ||
                produto?.cfopInterno ||
                produto?.cfopInterestadual ||
                produto?.cfopNaoContribuinte;

            exigir(produto?.descricao || produto?.xProd, `${campo}.descricao`, 'Descrição do produto é obrigatória.');
            exigir(/^\d{8}$/.test(this.numeros(produto?.ncm)), `${campo}.ncm`, 'NCM deve ter 8 dígitos.');
            exigir(/^\d{4}$/.test(this.numeros(cfop)), `${campo}.cfop`, 'CFOP deve ter 4 dígitos ou ser derivado da regra fiscal.');
            exigir(Number(produto?.quantidade) > 0, `${campo}.quantidade`, 'Quantidade deve ser maior que zero.');
            exigir(
                produto?.csosn || produto?.cstIcms || produto?.cst_icms,
                `${campo}.tributacao`,
                'CSOSN/CST ICMS deve ser definido pela regra fiscal.'
            );
        });

        if (opcoes.ambiente === 'producao') {
            exigir(
                empresa?.producaoLiberada === true,
                'empresa.producaoLiberada',
                'Produção bloqueada até validação cadastral, credenciamento e certificado.'
            );
        }

        return { valido: erros.length === 0, erros, avisos: [] };
    }
}

export default new NfePreValidationService();
