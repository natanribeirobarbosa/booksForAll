import { executarTransacao } from "./executeDeal";
const TAMANHOS_FONTE = [19, 21, 24];

// Salva uma versão paginada do livro.
export function salvarVersaoPaginada(
  livroId,
  tamanhoFonte,
  paginas,
  dimensoes
) {
  if (!livroId || !TAMANHOS_FONTE.includes(tamanhoFonte)) {
    return Promise.reject(
      new Error('Livro ou tamanho de fonte inválido.')
    );
  }

  const id = `${livroId}_${tamanhoFonte}`;

  return executarTransacao('versoes', 'readwrite', (tx) =>
    tx.objectStore('versoes').put({
      id,
      versaoPaginacao: 2,
      livroId,
      tamanhoFonte,
      paginas,
      dimensoes,
      atualizadoEm: Date.now(),
    })
  );
}