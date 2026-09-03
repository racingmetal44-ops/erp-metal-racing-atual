import assert from 'node:assert/strict';
import NfeSoapService from '../src/backend/services/nfe/NfeSoapService.js';

const rejeitada = NfeSoapService.parseSefazResponse(
    '<retEnviNFe><cStat>104</cStat><xMotivo>Lote processado</xMotivo><protNFe><infProt><tpAmb>2</tpAmb><chNFe>42260813862162000180550010000181281123456789</chNFe><cStat>231</cStat><xMotivo>Rejeicao: IE do emitente nao vinculada ao CNPJ</xMotivo></infProt></protNFe></retEnviNFe>'
);

assert.equal(rejeitada.success, false);
assert.equal(rejeitada.cStatLote, '104');
assert.equal(rejeitada.cStatNFe, '231');
assert.equal(rejeitada.cStat, '231');
assert.equal(
    rejeitada.xMotivoNFe,
    'Rejeicao: IE do emitente nao vinculada ao CNPJ'
);

const autorizada = NfeSoapService.parseSefazResponse(
    '<retEnviNFe><cStat>104</cStat><xMotivo>Lote processado</xMotivo><protNFe><infProt><cStat>100</cStat><xMotivo>Autorizado o uso da NF-e</xMotivo><nProt>142260000000001</nProt></infProt></protNFe></retEnviNFe>'
);

assert.equal(autorizada.success, true);
assert.equal(autorizada.cStatLote, '104');
assert.equal(autorizada.cStatNFe, '100');
assert.equal(autorizada.cStat, '100');
assert.equal(autorizada.nProt, '142260000000001');
assert.equal(
    autorizada.xMotivoNFe,
    'Autorizado o uso da NF-e'
);

console.log('NfeSoapService response parsing: OK');
