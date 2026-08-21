import { NfeXmlService } from "./src/backend/services/nfe/NfeXmlService.js";

const service = new NfeXmlService();

const empresa = {
    razaoSocial: "ART GRAV COMUNICACAO",
    nomeFantasia: "ART GRAV",
    cnpj: "00000000000000",
    ie: "ISENTO",
    uf: "SC",
    cep: "89200000",
    logradouro: "RUA TESTE",
    numero: "100",
    bairro: "CENTRO",
    municipio: "JOINVILLE",
    cidade: "JOINVILLE"
};

const cliente = {
    nome: "CLIENTE TESTE",
    cpfCnpj: "00000000000",
    ie: "",
    uf: "SC",
    cep: "89200000",
    logradouro: "RUA TESTE",
    numero: "100",
    bairro: "CENTRO",
    municipio: "JOINVILLE",
    cidade: "JOINVILLE"
};

const produtos = [];

try {
    const xml = service.gerarXml(
        empresa,
        cliente,
        produtos,
        "homologacao",
        "1",
        1
    );

    console.log("XML_GERADO_OK");
    console.log("TAMANHO:", xml.length);
    console.log(xml.substring(0, 500));

} catch (error) {
    console.error("ERRO_XML:", error);
    process.exit(1);
}
