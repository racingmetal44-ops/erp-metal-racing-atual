// src/backend/services/nfe/NfeXmlService.js

export class NfeXmlService {

    // =========================================================
    // UTILITéRIOS
    // =========================================================

    escapeXml(value) {
        return String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&apos;');
    }

    somenteNumeros(value) {
        return String(value ?? '').replace(/\D/g, '');
    }

    numeroDecimal(value, casas = 2) {
        const numero = Number(value || 0);

        if (!Number.isFinite(numero)) {
            return (0).toFixed(casas);
        }

        return numero.toFixed(casas);
    }

    inteiro(value, pad = 0) {
        return String(Math.trunc(Number(value || 0))).padStart(pad, '0');
    }

    gerarCNF() {
        return String(
            Math.floor(Math.random() * 100000000)
        ).padStart(8, '0');
    }

    // =========================================================
    // DATA NF-e
    // =========================================================

    gerarDataEmissao() {

        const agora =
            new Date();

        const pad =
            value =>
                String(value)
                    .padStart(2, '0');

        const ano =
            agora.getFullYear();

        const mes =
            pad(
                agora.getMonth() + 1
            );

        const dia =
            pad(
                agora.getDate()
            );

        const hora =
            pad(
                agora.getHours()
            );

        const minuto =
            pad(
                agora.getMinutes()
            );

        const segundo =
            pad(
                agora.getSeconds()
            );

        const offsetMinutos =
            -agora.getTimezoneOffset();

        const sinal =
            offsetMinutos >= 0
                ? '+'
                : '-';

        const offsetAbsoluto =
            Math.abs(offsetMinutos);

        const offsetHora =
            pad(
                Math.floor(
                    offsetAbsoluto / 60
                )
            );

        const offsetMinuto =
            pad(
                offsetAbsoluto % 60
            );

        return (
            `${ano}-${mes}-${dia}` +
            `T${hora}:${minuto}:${segundo}` +
            `${sinal}${offsetHora}:${offsetMinuto}`
        );
    }

    // =========================================================
    // CHAVE DE ACESSO
    // =========================================================

    gerarDigitoVerificador(chaveBase) {
        let soma = 0;
        let peso = 2;

        for (let i = chaveBase.length - 1; i >= 0; i--) {
            soma += Number(chaveBase[i]) * peso;

            peso++;

            if (peso > 9) {
                peso = 2;
            }
        }

        const resto = soma % 11;

        return resto === 0 || resto === 1
            ? 0
            : 11 - resto;
    }

    gerarChaveAcesso(
        empresa,
        numero,
        serie,
        cNF,
        dataEmissao = new Date()
    ) {

        const uf = this.somenteNumeros(empresa?.ufCodigo || '42')
            .padStart(2, '0')
            .slice(0, 2);

        const ano = String(dataEmissao.getFullYear()).slice(-2);

        const mes = String(
            dataEmissao.getMonth() + 1
        ).padStart(2, '0');

        const cnpj = this.somenteNumeros(
            empresa?.cnpj
        ).padStart(14, '0');

        const modelo = '55';

        const serieNumero = String(
            this.somenteNumeros(serie || '1')
        ).padStart(3, '0');

        const numeroNF = String(
            this.somenteNumeros(numero)
        ).padStart(9, '0');

        /*
         * 1 = emissão normal
         * 2 = contingéncia FS-IA
         * etc.
         */
        const tpEmis = String(
            empresa?.tpEmis || '1'
        ).padStart(1, '0');

        const codigo = String(cNF)
            .padStart(8, '0')
            .slice(-8);

        const base =
            uf +
            ano +
            mes +
            cnpj +
            modelo +
            serieNumero +
            numeroNF +
            tpEmis +
            codigo;

        if (base.length !== 43) {
            throw new Error(
                `Chave NF-e inválida: base possui ${base.length} dígitos`
            );
        }

        const dv = this.gerarDigitoVerificador(base);

        return base + dv;
    }

    // =========================================================
    // DESTINO
    // =========================================================

    determinarIdDest(empresa, cliente) {

        const ufEmitente = String(
            empresa?.uf || ''
        ).toUpperCase();

        const ufDestinatario = String(
            cliente?.uf || ''
        ).toUpperCase();

        if (!ufDestinatario) {
            return '1';
        }

        if (ufEmitente === ufDestinatario) {
            return '1';
        }

        return '2';
    }

    // =========================================================
    // CFOP
    // =========================================================

    determinarCFOP(
        produto,
        empresa,
        cliente
    ) {

        const ufEmpresa =
            String(
                empresa?.uf || ''
            )
                .trim()
                .toUpperCase();

        const ufCliente =
            String(
                cliente?.uf || ''
            )
                .trim()
                .toUpperCase();

        const cfopInterno =
            this.somenteNumeros(
                produto?.cfopInterno || ''
            );

        const cfopInterestadual =
            this.somenteNumeros(
                produto?.cfopInterestadual || ''
            );

        const cfopNaoContribuinte =
            this.somenteNumeros(
                produto?.cfopNaoContribuinte || ''
            );

        if (
            !cfopInterno &&
            !cfopInterestadual
        ) {
            throw new Error(
                `CFOP não configurado para "${produto?.descricao || produto?.codigo || 'produto'}".`
            );
        }

        if (ufEmpresa === ufCliente) {

            if (cfopInterno !== '5101') {
                throw new Error(
                    `CFOP interno inválido para "${produto?.descricao || produto?.codigo || 'produto'}". Esperado: 5101.`
                );
            }

            return cfopInterno;
        }

        const indIEDest =
            String(
                cliente?.indIEDest || ''
            );

        if (indIEDest === '9') {

            if (cfopNaoContribuinte !== '6107') {
                throw new Error(
                    `CFOP interestadual para não contribuinte inválido. Esperado: 6107.`
                );
            }

            return cfopNaoContribuinte;
        }

        if (cfopInterestadual !== '6101') {
            throw new Error(
                `CFOP interestadual para contribuinte inválido. Esperado: 6101.`
            );
        }

        return cfopInterestadual;
    }
    // =========================================================
    // ICMS
    // =========================================================

    // =========================================================
    // ICMS
    // =========================================================
    gerarICMS(
        produto,
        valorProduto,
        empresa
    ) {

        const crt =
            String(
                empresa?.crt ||
                empresa?.regimeTributario ||
                empresa?.regime_tributario ||
                '1'
            );

        if (crt === '1' || crt === '2') {

            const csosn =
                String(
                    produto?.csosn || ''
                );

            if (!/^\d{3}$/.test(csosn)) {
                throw new Error(
                    `CSOSN inválido para o produto "${produto?.descricao || produto?.codigo || 'sem identificação'}".`
                );
            }

            const csosnPermitidos = [
                '101',
                '102',
                '103',
                '201',
                '202',
                '203',
                '300',
                '400',
                '500',
                '900'
            ];

            if (
                !csosnPermitidos.includes(csosn)
            ) {
                throw new Error(
                    `CSOSN ${csosn} não está configurado no gerador fiscal.`
                );
            }

            if (
                csosn === '102' ||
                csosn === '103' ||
                csosn === '300' ||
                csosn === '400'
            ) {

                return `
        <ICMS>
          <ICMSSN${csosn}>
            <orig>${produto?.orig ?? '0'}</orig>
            <CSOSN>${csosn}</CSOSN>
          </ICMSSN${csosn}>
        </ICMS>`;
            }

            throw new Error(
                `CSOSN ${csosn} ainda não possui regra fiscal completa no gerador.`
            );
        }

        const cst =
            String(
                produto?.cst || ''
            );

        if (cst === '00') {

            const aliquota =
                Number(
                    produto?.aliquotaICMS ?? 0
                );

            const base =
                Number(
                    produto?.baseICMS ??
                    valorProduto
                );

            const icms =
                base * aliquota / 100;

            return `
        <ICMS>
          <ICMS00>
            <orig>${produto?.orig ?? '0'}</orig>
            <CST>00</CST>
            <modBC>3</modBC>
            <vBC>${this.numeroDecimal(base)}</vBC>
            <pICMS>${this.numeroDecimal(aliquota)}</pICMS>
            <vICMS>${this.numeroDecimal(icms)}</vICMS>
          </ICMS00>
        </ICMS>`;
        }

        throw new Error(
            `CST ${cst} ainda não está configurado no gerador fiscal para o produto "${produto?.descricao || ''}".`
        );
    }
    // =========================================================
    // PIS
    // =========================================================

    // =========================================================
    // PIS
    // =========================================================
    gerarPIS(
        produto,
        valorProduto
    ) {

        const cst =
            String(
                produto?.pisCst || ''
            );

        if (!/^\d{2}$/.test(cst)) {
            throw new Error(
                `CST PIS inválido para o produto "${produto?.descricao || produto?.codigo || 'produto'}".`
            );
        }

        // 49 = Outras Operações de Saída.
        if (cst === '49') {

            return `
        <PIS>
          <PISOutr>
            <CST>49</CST>
            <vBC>${this.numeroDecimal(valorProduto)}</vBC>
            <pPIS>0.00</pPIS>
            <vPIS>0.00</vPIS>
          </PISOutr>
        </PIS>`;
        }

        // PISNT aceita apenas CST 04, 05, 06, 07, 08 e 09.
        const cstNaoTributado = [
            '04',
            '05',
            '06',
            '07',
            '08',
            '09'
        ];

        if (
            cstNaoTributado.includes(cst)
        ) {

            return `
        <PIS>
          <PISNT>
            <CST>${cst}</CST>
          </PISNT>
        </PIS>`;
        }

        throw new Error(
            `CST PIS ${cst} ainda não possui regra fiscal implementada.`
        );
    }
    // =========================================================
    // COFINS
    // =========================================================

    // =========================================================
    // COFINS
    // =========================================================
    gerarCOFINS(
        produto,
        valorProduto
    ) {

        const cst =
            String(
                produto?.cofinsCst || ''
            );

        if (!/^\d{2}$/.test(cst)) {
            throw new Error(
                `CST COFINS inválido para o produto "${produto?.descricao || produto?.codigo || 'produto'}".`
            );
        }

        // 49 = Outras Operações de Saída.
        if (cst === '49') {

            return `
        <COFINS>
          <COFINSOutr>
            <CST>49</CST>
            <vBC>${this.numeroDecimal(valorProduto)}</vBC>
            <pCOFINS>0.00</pCOFINS>
            <vCOFINS>0.00</vCOFINS>
          </COFINSOutr>
        </COFINS>`;
        }

        // COFINSNT aceita apenas CST 04, 05, 06, 07, 08 e 09.
        const cstNaoTributado = [
            '04',
            '05',
            '06',
            '07',
            '08',
            '09'
        ];

        if (
            cstNaoTributado.includes(cst)
        ) {

            return `
        <COFINS>
          <COFINSNT>
            <CST>${cst}</CST>
          </COFINSNT>
        </COFINS>`;
        }

        throw new Error(
            `CST COFINS ${cst} ainda não possui regra fiscal implementada.`
        );
    }
    // =========================================================
    // PRODUTOS
    // =========================================================

    gerarProdutos(produtos, empresa, cliente) {

        return produtos.map((produto, index) => {

            const quantidade =
                Number(produto.quantidade || 0);

            const valorUnitario =
                Number(
                    produto.valorUnitario ??
                    produto.valor_unitario ??
                    0
                );

            if (quantidade <= 0) {
                throw new Error(
                    `Quantidade inválida no produto ${produto.descricao || index + 1}.`
                );
            }

            if (valorUnitario < 0) {
                throw new Error(
                    `Valor inválido no produto ${produto.descricao || index + 1}.`
                );
            }

            const valorProduto =
                quantidade * valorUnitario;

            const cfop =
                this.determinarCFOP(
                    produto,
                    empresa,
                    cliente
                );

            const unidade =
                produto.unidade ||
                produto.unidadeComercial ||
                'UN';

            const cEAN =
                produto.cEAN ||
                produto.ean ||
                'SEM GTIN';

            const cEANTrib =
                produto.cEANTrib ||
                produto.eanTrib ||
                cEAN;

            const ncm =
                this.somenteNumeros(
                    produto.ncm || ''
                );

            if (ncm.length !== 8) {
                throw new Error(
                    `NCM inválido no produto "${produto.descricao || ''}". Informe um NCM com 8 dígitos.`
                );
            }

            const imposto = this.gerarICMS(
                produto,
                valorProduto,
                empresa
            );

            const pis =
                this.gerarPIS(
                    produto,
                    valorProduto
                );

            const cofins =
                this.gerarCOFINS(
                    produto,
                    valorProduto
                );

            const cest = produto.cest
                ? `<CEST>${this.somenteNumeros(produto.cest)}</CEST>`
                : '';

            return `
    <det nItem="${index + 1}">
      <prod>
        <cProd>${this.escapeXml(produto.codigo || String(index + 1))}</cProd>
        <cEAN>${this.escapeXml(cEAN)}</cEAN>
        <xProd>${this.escapeXml(produto.descricao)}</xProd>
        <NCM>${ncm}</NCM>
        ${cest}
        <CFOP>${cfop}</CFOP>
        <uCom>${this.escapeXml(unidade)}</uCom>
        <qCom>${this.numeroDecimal(quantidade, 4)}</qCom>
        <vUnCom>${this.numeroDecimal(valorUnitario, 10)}</vUnCom>
        <vProd>${this.numeroDecimal(valorProduto)}</vProd>
        <cEANTrib>${this.escapeXml(cEANTrib)}</cEANTrib>
        <uTrib>${this.escapeXml(produto.unidadeTributavel || unidade)}</uTrib>
        <qTrib>${this.numeroDecimal(produto.quantidadeTributavel ?? quantidade, 4)}</qTrib>
        <vUnTrib>${this.numeroDecimal(produto.valorUnitarioTributavel ?? valorUnitario, 10)}</vUnTrib>
        <indTot>1</indTot>
      </prod>
      <imposto>
        ${imposto}
        ${pis}
        ${cofins}
      </imposto>
    </det>`;
        }).join('');
    }

    // =========================================================
    // VALIDAééO FISCAL ANTES DA GERAééO
    // =========================================================
    validarDadosFiscais(
        empresa,
        cliente,
        produtos
    ) {

        const erros = [];

        const ufEmpresa =
            String(
                empresa?.uf || ''
            )
                .trim()
                .toUpperCase();

        const ufCliente =
            String(
                cliente?.uf || ''
            )
                .trim()
                .toUpperCase();

        if (!ufEmpresa) {
            erros.push(
                'UF do emitente não informada.'
            );
        }

        if (!ufCliente) {
            erros.push(
                'UF do destinatário não informada.'
            );
        }

        const ie =
            this.somenteNumeros(
                empresa?.inscricaoEstadual ||
                empresa?.inscricao_estadual ||
                empresa?.ie ||
                ''
            );

        if (ie.length === 0) {
            erros.push(
                'Inscrição Estadual do emitente não informada.'
            );
        }

        const codigoIbge =
            this.somenteNumeros(
                empresa?.codigoIbge ||
                empresa?.codigo_ibge ||
                ''
            );

        if (!/^[0-9]{7}$/.test(codigoIbge)) {
            erros.push(
                'Código IBGE do município do emitente deve possuir 7 dígitos.'
            );
        }

        if (
            !Array.isArray(produtos) ||
            produtos.length === 0
        ) {
            erros.push(
                'Nenhum produto informado.'
            );
        }

        produtos.forEach(
            (produto, index) => {

                const identificacao =
                    produto?.descricao ||
                    produto?.codigo ||
                    `produto ${index + 1}`;

                const ncm =
                    this.somenteNumeros(
                        produto?.ncm || ''
                    );

                if (ncm.length !== 8) {
                    erros.push(
                        `${identificacao}: NCM deve possuir exatamente 8 dígitos.`
                    );
                }

                const origem =
                    String(
                        produto?.orig ??
                        produto?.origem ??
                        ''
                    );

                if (!/^[0-8]$/.test(origem)) {
                    erros.push(
                        `${identificacao}: origem da mercadoria inválida.`
                    );
                }

                const csosn =
                    String(
                        produto?.csosn || ''
                    );

                if (!/^\d{3}$/.test(csosn)) {
                    erros.push(
                        `${identificacao}: CSOSN inválido ou não informado.`
                    );
                }

                const pisCst =
                    String(
                        produto?.pisCst || ''
                    );

                if (!/^\d{2}$/.test(pisCst)) {
                    erros.push(
                        `${identificacao}: CST PIS inválido ou não informado.`
                    );
                }

                const cofinsCst =
                    String(
                        produto?.cofinsCst || ''
                    );

                if (!/^\d{2}$/.test(cofinsCst)) {
                    erros.push(
                        `${identificacao}: CST COFINS inválido ou não informado.`
                    );
                }

                if (produto?.cest) {

                    const cest =
                        this.somenteNumeros(
                            produto.cest
                        );

                    if (cest.length !== 7) {
                        erros.push(
                            `${identificacao}: CEST deve possuir 7 dígitos.`
                        );
                    }
                }

                const cfopInterno =
                    this.somenteNumeros(
                        produto?.cfopInterno || ''
                    );

                const cfopInterestadual =
                    this.somenteNumeros(
                        produto?.cfopInterestadual || ''
                    );

                if (
                    ufEmpresa &&
                    ufCliente &&
                    ufEmpresa === ufCliente
                ) {

                    if (cfopInterno !== '5101') {
                        erros.push(
                            `${identificacao}: para produção prépria dentro de SC, o CFOP esperado é 5101.`
                        );
                    }

                } else if (
                    ufEmpresa &&
                    ufCliente &&
                    ufEmpresa !== ufCliente
                ) {

                    const indIEDest =
                        String(
                            cliente?.indIEDest || ''
                        );

                    if (indIEDest === '9') {

                        if (
                            cfopInterestadual !== '6107'
                        ) {
                            erros.push(
                                `${identificacao}: para destinatário não contribuinte fora de SC, o CFOP esperado é 6107.`
                            );
                        }

                    } else {

                        if (
                            cfopInterestadual !== '6101'
                        ) {
                            erros.push(
                                `${identificacao}: para destinatário contribuinte fora de SC, o CFOP esperado é 6101.`
                            );
                        }
                    }
                }
            }
        );

        if (erros.length > 0) {

            const erro =
                new Error(
                    'NF-e BLOQUEADA: dados fiscais inconsistentes.'
                );

            erro.codigo =
                'VALIDACAO_FISCAL';

            erro.detalhes =
                erros;

            throw erro;
        }

        return true;
    }
    // =========================================================
    // GERAR XML
    // =========================================================

    gerarXml(
        empresa,
        cliente,
        produtos,
        ambiente,
        serie,
        numero,
        opcoes = {}
    ) {

        if (!empresa) {
            throw new Error('Empresa não informada.');
        }

        if (!cliente) {
            throw new Error('Destinatério não informado.');
        }

        if (!Array.isArray(produtos) || produtos.length === 0) {
            throw new Error('Nenhum produto informado.');
        }

        this.validarDadosFiscais(
            empresa,
            cliente,
            produtos
        );

        const cnpjEmitente =
            this.somenteNumeros(empresa.cnpj);

        if (cnpjEmitente.length !== 14) {
            throw new Error(
                'CNPJ do emitente deve possuir 14 dígitos.'
            );
        }

        const documentoDestinatario =
            this.somenteNumeros(
                cliente.cnpj || cliente.cpf
            );

        if (
            documentoDestinatario.length !== 11 &&
            documentoDestinatario.length !== 14
        ) {
            throw new Error(
                'CPF/CNPJ do destinatário inválido.'
            );
        }

        const dataEmissaoDate = new Date();

        const dhEmi =
            this.gerarDataEmissao();

        const cNF =
            opcoes.cNF ||
            this.gerarCNF();

        const numeroNF =
            String(numero || 1);

        const serieNF =
            String(serie || 1);

        const chave =
            this.gerarChaveAcesso(
                empresa,
                numeroNF,
                serieNF,
                cNF,
                dataEmissaoDate
            );

        const totalProdutos =
            produtos.reduce(
                (total, produto) => {

                    const quantidade =
                        Number(produto.quantidade || 0);

                    const valor =
                        Number(
                            produto.valorUnitario ??
                            produto.valor_unitario ??
                            0
                        );

                    return total +
                        quantidade * valor;

                },
                0
            );

        const idDest =
            this.determinarIdDest(
                empresa,
                cliente
            );

        const tpAmb =
            ambiente === 'producao'
                ? '1'
                : '2';

        const crt =
            String(
                empresa.crt ||
                empresa.regimeTributario ||
                '1'
            );

        const natOp =
            opcoes.naturezaOperacao ||
            empresa.naturezaOperacao ||
            'VENDA DE MERCADORIA';

        const produtosXml =
            this.gerarProdutos(
                produtos,
                empresa,
                cliente
            );

        const enderecoEmpresa = `
      <enderEmit>
        <xLgr>${this.escapeXml(empresa.endereco)}</xLgr>
        <nro>${this.escapeXml(empresa.numero || 'S/N')}</nro>
        ${empresa.complemento ? `<xCpl>${this.escapeXml(empresa.complemento)}</xCpl>` : ''}
        <xBairro>${this.escapeXml(empresa.bairro)}</xBairro>
        <cMun>${this.somenteNumeros(empresa.codigoIbge || empresa.codigo_ibge)}</cMun>
        <xMun>${this.escapeXml(empresa.cidade)}</xMun>
        <UF>${this.escapeXml(empresa.uf)}</UF>
        <CEP>${this.somenteNumeros(empresa.cep)}</CEP>
        <cPais>1058</cPais>
        <xPais>BRASIL</xPais>
        ${empresa.telefone ? `<fone>${this.somenteNumeros(empresa.telefone)}</fone>` : ''}
      </enderEmit>`;

        const enderecoCliente = `
      <enderDest>
        <xLgr>${this.escapeXml(cliente.endereco)}</xLgr>
        <nro>${this.escapeXml(cliente.numero || 'S/N')}</nro>
        ${cliente.complemento ? `<xCpl>${this.escapeXml(cliente.complemento)}</xCpl>` : ''}
        <xBairro>${this.escapeXml(cliente.bairro)}</xBairro>
        <cMun>${this.somenteNumeros(cliente.codigoIbge)}</cMun>
        <xMun>${this.escapeXml(cliente.cidade)}</xMun>
        <UF>${this.escapeXml(cliente.uf)}</UF>
        <CEP>${this.somenteNumeros(cliente.cep)}</CEP>
        <cPais>1058</cPais>
        <xPais>BRASIL</xPais>
        ${cliente.telefone ? `<fone>${this.somenteNumeros(cliente.telefone)}</fone>` : ''}
      </enderDest>`;

        const documentoDestinatarioXml =
            documentoDestinatario.length === 14
                ? `<CNPJ>${documentoDestinatario}</CNPJ>`
                : `<CPF>${documentoDestinatario}</CPF>`;

        const ieDest =
            cliente.indIEDest
                ? `
      <indIEDest>${cliente.indIEDest}</indIEDest>
      ${cliente.inscricaoEstadual
          ? `<IE>${this.somenteNumeros(cliente.inscricaoEstadual)}</IE>`
          : ''}`
                : '';

        const pagamento =
            opcoes.pagamento || {
                tPag: '01',
                vPag: totalProdutos
            };

        const vPag =
            Number(pagamento.vPag ?? totalProdutos);

        const informacoesAdicionais =
            opcoes.observacao ||
            empresa.observacaoNF ||
            'NF-e emitida pelo ERP Metal Racing';

        return `<?xml version="1.0" encoding="UTF-8"?>
<NFe xmlns="http://www.portalfiscal.inf.br/nfe">
  <infNFe versao="4.00" Id="NFe${chave}">
    <ide>
      <cUF>${this.somenteNumeros(empresa.ufCodigo || '42')}</cUF>
      <cNF>${cNF}</cNF>
      <natOp>${this.escapeXml(natOp)}</natOp>
      <mod>55</mod>
      <serie>${this.somenteNumeros(serieNF)}</serie>
      <nNF>${this.somenteNumeros(numeroNF)}</nNF>
      <dhEmi>${dhEmi}</dhEmi>
      <tpNF>1</tpNF>
      <idDest>${idDest}</idDest>
      <cMunFG>${this.somenteNumeros(empresa.codigoIbge || empresa.codigo_ibge)}</cMunFG>
      <tpImp>1</tpImp>
      <tpEmis>1</tpEmis>
      <cDV>${chave.slice(-1)}</cDV>
      <tpAmb>${tpAmb}</tpAmb>
      <finNFe>1</finNFe>
      <indFinal>${cliente.indFinal ?? '0'}</indFinal>
      <indPres>${cliente.indPres ?? '0'}</indPres>
      <procEmi>0</procEmi>
      <verProc>ERP Metal Racing</verProc>
    </ide>

    <emit>
      <CNPJ>${cnpjEmitente}</CNPJ>
      <xNome>${this.escapeXml(empresa.razaoSocial)}</xNome>
      <xFant>${this.escapeXml(empresa.nomeFantasia || empresa.razaoSocial)}</xFant>
      ${enderecoEmpresa}
      <IE>${this.somenteNumeros(empresa.inscricaoEstadual || empresa.ie)}</IE>
      <CRT>${crt}</CRT>
    </emit>

    <dest>
      ${documentoDestinatarioXml}
      <xNome>${this.escapeXml(cliente.nome)}</xNome>
      ${enderecoCliente}
      ${ieDest}
      ${cliente.email ? `<email>${this.escapeXml(cliente.email)}</email>` : ''}
    </dest>

    ${produtosXml}

    <total>
      <ICMSTot>
        <vBC>0.00</vBC>
        <vICMS>0.00</vICMS>
        <vICMSDeson>0.00</vICMSDeson>
        <vFCP>0.00</vFCP>
        <vBCST>0.00</vBCST>
        <vST>0.00</vST>
        <vFCPST>0.00</vFCPST>
        <vFCPSTRet>0.00</vFCPSTRet>
        <vProd>${this.numeroDecimal(totalProdutos)}</vProd>
        <vFrete>0.00</vFrete>
        <vSeg>0.00</vSeg>
        <vDesc>0.00</vDesc>
        <vII>0.00</vII>
        <vIPI>0.00</vIPI>
        <vIPIDevol>0.00</vIPIDevol>
        <vPIS>0.00</vPIS>
        <vCOFINS>0.00</vCOFINS>
        <vOutro>0.00</vOutro>
        <vNF>${this.numeroDecimal(totalProdutos)}</vNF>
        <vTotTrib>0.00</vTotTrib>
      </ICMSTot>
    </total>

    <transp>
      <modFrete>${opcoes.modFrete ?? '9'}</modFrete>
    </transp>

    <pag>
      <detPag>
        <tPag>${this.escapeXml(pagamento.tPag || '01')}</tPag>
        <vPag>${this.numeroDecimal(vPag)}</vPag>
      </detPag>
    </pag>

    <infAdic>
      <infCpl>${this.escapeXml(informacoesAdicionais)}</infCpl>
    </infAdic>

    ${this.gerarResponsavelTecnicoXml(opcoes.responsavelTecnico || empresa.responsavelTecnico)}

  </infNFe>
</NFe>`;
    }

    gerarResponsavelTecnicoXml(responsavelTecnico) {
        const rt = responsavelTecnico || {};
        if (!rt.cnpj || !rt.xContato || !rt.email || !rt.fone) return '';
        // CSRT is generated only when both fields were provided by the issuer.
        const csrt = rt.csrt && rt.idCsrt
            ? `<idCSRT>${this.escapeXml(rt.idCsrt)}</idCSRT><hashCSRT>${this.escapeXml(rt.csrt)}</hashCSRT>`
            : '';
        return `<infRespTec><CNPJ>${this.somenteNumeros(rt.cnpj)}</CNPJ><xContato>${this.escapeXml(rt.xContato)}</xContato><email>${this.escapeXml(rt.email)}</email><fone>${this.somenteNumeros(rt.fone)}</fone>${csrt}</infRespTec>`;
    }
}

export default new NfeXmlService();












