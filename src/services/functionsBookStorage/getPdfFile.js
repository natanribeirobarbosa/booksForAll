import { buscarLivro } from '../functionsBookStorage/searchBooks';

// Lê os bytes do PDF armazenado, sem usar URL temporária.
export async function obterArquivoPdf(id) {
  const livro = await buscarLivro(id);

  if (!livro?.arquivo) {
    throw new Error(
      'O PDF original não está salvo. Importe o arquivo novamente.'
    );
  }

  if (livro.arquivo instanceof Blob) {
    return new Uint8Array(await livro.arquivo.arrayBuffer());
  }

  if (livro.arquivo instanceof ArrayBuffer) {
    return new Uint8Array(livro.arquivo);
  }

  if (livro.arquivo instanceof Uint8Array) {
    return livro.arquivo;
  }

  throw new Error('Não foi possível ler o PDF salvo.');
}