import axios from 'axios';

const LOJA_ID = '905589';
const API_BASE_URL = 'https://' + LOJA_ID + '.tray.com.br/api';

async function gerarPrimeiroToken(consumerKey, consumerSecret, codeTemporario) {
  try {
    const response = await axios.post(API_BASE_URL + '/auth', {
      consumer_key: consumerKey,
      consumer_secret: consumerSecret,
      code: codeTemporario
    }, {
      headers: { 'Content-Type': 'application/json' }
    });

    const { access_token, refresh_token } = response.data;
    console.log('? Token Gerado:', access_token);
    return { access_token, refresh_token };
  } catch (error) {
    console.error('? Erro:', error.response?.data || error.message);
  }
}

// Chame a função passando seus dados reais quando tiver em mãos:
// gerarPrimeiroToken('sua_key', 'seu_secret', 'seu_code');
