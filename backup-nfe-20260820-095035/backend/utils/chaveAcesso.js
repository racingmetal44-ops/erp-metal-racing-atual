// src/backend/utils/chaveAcesso.js

export function calcularDigitoVerificador(chave) {
  const numeros = chave.replace(/[^\\d]/g, '').split('').map(Number);
  let soma = 0;
  let peso = 2;
  
  for (let i = numeros.length - 1; i >= 0; i--) {
    soma += numeros[i] * peso;
    peso = peso === 9 ? 2 : peso + 1;
  }
  
  const resto = soma % 11;
  return resto < 2 ? 0 : 11 - resto;
}

export function gerarChaveAcesso(params) {
  const uf = params.uf;
  const aamm = params.aamm;
  const cnpj = params.cnpj;
  const modelo = params.modelo;
  const serie = params.serie;
  const numero = params.numero;
  const formEmissao = params.formEmissao;
  const codigoNumerico = params.codigoNumerico;
  
  const cleanCNPJ = cnpj.replace(/[^\\d]/g, '');
  
  const chaveBase = uf + aamm + cleanCNPJ + modelo + serie.padStart(3, '0') + numero.padStart(9, '0') + formEmissao + codigoNumerico;
  const dv = calcularDigitoVerificador(chaveBase);
  
  return chaveBase + dv;
}

export function validarChaveAcesso(chave) {
  if (!chave || chave.length !== 44) return false;
  if (!/^\\d{44}$/.test(chave)) return false;
  
  const chaveBase = chave.substring(0, 43);
  const dvInformed = parseInt(chave.charAt(43));
  
  return calcularDigitoVerificador(chaveBase) === dvInformed;
}
