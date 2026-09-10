import fs from 'fs';
import { XMLParser } from 'fast-xml-parser';

const arquivo = process.argv[2];

const xml = fs.readFileSync(arquivo, 'utf8');

const parser = new XMLParser({
    ignoreAttributes: false,
    removeNSPrefix: false
});

const doc = parser.parse(xml);

const envelope = doc['soap12:Envelope'];
const header = envelope?.['soap12:Header'];
const body = envelope?.['soap12:Body'];

const cabec = header?.nfeCabecMsg;
const dados = body?.nfeDadosMsg;

const env = dados?.envEvento;
const evento = env?.evento;
const inf = evento?.infEvento;
const det = inf?.detEvento;

console.log('\n========== VALIDAÇÃO ==========');

console.log('Envelope:', !!envelope);
console.log('Header:', !!header);
console.log('Body:', !!body);
console.log('nfeCabecMsg:', !!cabec);
console.log('nfeDadosMsg:', !!dados);
console.log('envEvento:', !!env);
console.log('evento:', !!evento);
console.log('infEvento:', !!inf);
console.log('detEvento:', !!det);

console.log('\n--- CAMPOS ---');

console.log('cUF:', cabec?.cUF);
console.log('versaoDados:', cabec?.versaoDados);
console.log('versao envEvento:', env?.['@_versao']);
console.log('idLote:', env?.idLote);
console.log('Id:', inf?.['@_Id']);
console.log('tpAmb:', inf?.tpAmb);
console.log('CNPJ:', inf?.CNPJ);
console.log('chNFe:', inf?.chNFe);
console.log('dhEvento:', inf?.dhEvento);
console.log('tpEvento:', inf?.tpEvento);
console.log('nSeqEvento:', inf?.nSeqEvento);
console.log('verEvento:', inf?.verEvento);

console.log('\n--- DETALHE ---');

console.log('atributo versao:', det?.['@_versao']);
console.log('atributo versaoEvento:', det?.['@_versaoEvento']);
console.log('descEvento:', det?.descEvento);
console.log('xJust:', det?.xJust);

console.log('\n================================');
