import { executarTransacao } from './executeDeal.js'
import { salvarLivro } from './saveBook.js';

// Recupera um livro pelo identificador.
export function buscarLivro(id) {
  return executarTransacao('livros', 'readonly', (tx) =>
    tx.objectStore('livros').get(id)
  );
}

// Lista os livros da biblioteca.
export function listarLivros() {
  return executarTransacao('livros', 'readonly', (tx) =>
    tx.objectStore('livros').getAll()
  );
}


// Atualiza o estado do processamento.
export async function atualizarStatusLivro(id, status) {
  const livro = await buscarLivro(id);

  if (!livro) {
    throw new Error('Livro não encontrado na biblioteca.');
  }

  return salvarLivro({
    ...livro,
    statusProcessamento: status,
  });
}

// Remove o livro e todas as páginas associadas.
export function removerLivro(id) {
  return executarTransacao(
    ['livros', 'paginas', 'versoes'],
    'readwrite',
    (tx) => {
      tx.objectStore('livros').delete(id);

      for (const nomeStore of ['paginas', 'versoes']) {
        const store = tx.objectStore(nomeStore);
        const indice = store.index('livroId');
        const request = indice.openCursor(IDBKeyRange.only(id));

        request.onsuccess = () => {
          const cursor = request.result;

          if (cursor) {
            cursor.delete();
            cursor.continue();
          }
        };
      }
    }
  );
}
