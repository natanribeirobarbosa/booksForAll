import { buscarLivro } from './searchBooks'
import { executarTransacao } from './executeDeal';

export async function salvarLivro(livro) {
  if (!livro?.id) {
    throw new Error('O livro precisa ter um identificador.');
  }

  if (
    livro.arquivo != null &&
    !(livro.arquivo instanceof Blob) &&
    !(livro.arquivo instanceof ArrayBuffer) &&
    !(livro.arquivo instanceof Uint8Array)
  ) {
    throw new Error('Formato do arquivo PDF não suportado.');
  }

  const livroExistente = await buscarLivro(livro.id);

  const registro = {
    ...livroExistente,
    ...livro,
    adicionadoEm:
      livro.adicionadoEm ||
      livroExistente?.adicionadoEm ||
      Date.now(),
    statusProcessamento:
      livro.statusProcessamento ||
      livroExistente?.statusProcessamento ||
      'pendente',
  };

  return executarTransacao('livros', 'readwrite', (tx) =>
    tx.objectStore('livros').put(registro)
  );
}