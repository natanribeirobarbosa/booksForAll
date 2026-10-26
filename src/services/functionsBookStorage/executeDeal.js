import { abrirBanco } from './openDB'


// Executa uma transação e aguarda sua conclusão.
export async function executarTransacao(stores, modo, operacao) {
  const banco = await abrirBanco();

  try {
    return await new Promise((resolve, reject) => {
      const transacao = banco.transaction(stores, modo);
      let resultado;

      try {
        resultado = operacao(transacao);
      } catch (erro) {
        transacao.abort();
        reject(erro);
        return;
      }

      transacao.oncomplete = () => {
        resolve(resultado?.result);
      };

      transacao.onerror = () => {
        reject(transacao.error || new Error('Erro no banco de dados.'));
      };

      transacao.onabort = () => {
        reject(
          transacao.error || new Error('Transação cancelada.')
        );
      };
    });
  } finally {
    banco.close();
  }
}