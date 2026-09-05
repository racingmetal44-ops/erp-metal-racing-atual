import 'dotenv/config';
import fs from 'fs';
import { NfeXmlService } from './src/backend/services/nfe/NfeXmlService.js';
import NfeSignatureService from './src/backend/services/nfe/NfeSignatureService.js';

// DADOS DA EMPRESA
const empresa = {
    razaoSocial: "ART GRAV COMUNICAééO INDUSTRIAL LTDA",
    cnpj: "13.862.162/0001-80",
    endereco: "Rua Teresópolis, 1180",
    bairro: "Guanabara",
    cidade: "Joinville",
    uf: "SC",
    cep: "89207-500",
    codigoIbge: "4209102",
    inscricaoEstadual: "",
    crt: "3",
    telefone: "",
    nomeFantasia: "ART GRAV"
};

// DADOS DO CLIENTE
const cliente = {
    nome: "Cliente Teste",
    cnpj: "12.345.678/0001-99",
    endereco: "Rua Teste, 123",
    bairro: "Centro",
    cidade: "Florianépolis",
    uf: "SC",
    cep: "88000-000",
    codigoIbge: "4205407",
    inscricaoEstadual: "",
    email: "teste@cliente.com"
};

// DADOS DO PRODUTO
const produtos = [{
    codigo: "001",
    descricao: "Produto Teste",
    ncm: "83023000",
    cest: "0102600",
    unidade: "UN",
    quantidade: 10,
    valorUnitario: 25.90,
    ufDestino: "SC"
}];

const ambiente = "homologacao";
const serie = "1";
const numero = Math.floor(Math.random() * 999999) + 1;
const empresaId = "1";

console.log('?? GERANDO NF-e...');
console.log('?? Empresa:', empresa.razaoSocial);
console.log('?? Cliente:', cliente.nome);
console.log('?? Produtos:', produtos.length);

try {
    // 1. CRIAR O XML
    const xmlService = new NfeXmlService();
    console.log('? NfeXmlService instanciado');
    
    const xml = xmlService.gerarXml(empresa, cliente, produtos, ambiente, serie, numero);
    const chave = xmlService.gerarChaveAcesso(empresa, numero, serie);
    console.log('? XML gerado! Chave:', chave);
    console.log('?? XML:', xml.substring(0, 200) + '...');

    // 2. ASSINAR O XML
    console.log('?? Assinando XML...');
    const xmlAssinado = await NfeSignatureService.assinarXml(xml, empresaId);
    console.log('? XML assinado com sucesso!');

    // 3. VALIDAR A ASSINATURA
    const validacao = await NfeSignatureService.validarAssinatura(xmlAssinado);
    console.log('? Validação da assinatura:', validacao);

    // 4. SALVAR O XML
    const nomeArquivo = `nfe_${String(numero).padStart(9, '0')}.xml`;
    fs.writeFileSync(nomeArquivo, xmlAssinado);
    console.log(`? XML salvo em: ${nomeArquivo}`);

    // 5. RESULTADO FINAL
    console.log('========================================');
    console.log('? NF-e emitida com sucesso!');
    console.log('  Chave:', chave);
    console.log('  Número:', String(numero).padStart(9, '0'));
    console.log('  Série:', serie);
    console.log('========================================');

} catch (error) {
    console.error('? ERRO:', error.message);
    console.error('Detalhes:', error.stack);
    process.exit(1);
}
