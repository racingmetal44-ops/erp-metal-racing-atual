export class NfeSchemaValidatorService {
    validar(xml) {
        const erros = [];
        const exigir = (ok, mensagem) => !ok && erros.push({ bloqueante: true, mensagem });

        const conteudo = String(xml || '');

        exigir(conteudo.includes('<NFe'), 'Elemento raiz NFe ausente.');
        exigir(/<infNFe\b[^>]*\bId="NFe\d{44}"/i.test(conteudo), 'Atributo Id da infNFe inválido ou ausente.');
        exigir(conteudo.includes('<ide>'), 'Grupo ide ausente.');
        exigir(conteudo.includes('<emit>'), 'Grupo emit ausente.');
        exigir(conteudo.includes('<dest>'), 'Grupo dest ausente.');
        exigir(conteudo.includes('<det '), 'Nenhum item de produto encontrado.');
        exigir(conteudo.includes('<total>'), 'Grupo total ausente.');
        exigir(conteudo.includes('<pag>'), 'Grupo pag ausente.');
        exigir(/<tpAmb>[12]<\/tpAmb>/.test(conteudo), 'tpAmb inválido.');

        return {
            valido: erros.length === 0,
            codigo: erros.length === 0 ? 'ESTRUTURAL_OK' : 'ESTRUTURAL_INVALIDO',
            erros
        };
    }
}

export default new NfeSchemaValidatorService();
