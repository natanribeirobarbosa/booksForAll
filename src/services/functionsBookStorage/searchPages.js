import { executarTransacao } from "./executeDeal";


// Busca uma versão específica pela fonte utilizada.
export function buscarVersaoPaginada(livroId, tamanhoFonte) {
  const id = `${livroId}_${tamanhoFonte}`;

  return executarTransacao('versoes', 'readonly', (tx) =>
    tx.objectStore('versoes').get(id)
  );
}

// Lista todas as versões paginadas de um livro.
export function listarVersoesPaginadas(livroId) {
  return executarTransacao('versoes', 'readonly', (tx) =>
    tx.objectStore('versoes').index('livroId').getAll(livroId)
  );
}



// Salva ou atualiza uma página processada.
export function salvarPagina(livroId, pagina) {
  if (!livroId || !Number.isInteger(pagina?.numero)) {
    return Promise.reject(
      new Error('Identificador do livro ou número da página inválido.')
    );
  }

  return executarTransacao('paginas', 'readwrite', (tx) =>
    tx.objectStore('paginas').put({
      ...pagina,
      id: `${livroId}_${pagina.numero}`,
      livroId,
    })
  );
}

// Recupera as páginas processadas em ordem.
export async function listarPaginas(livroId) {
  const paginas = await executarTransacao(
    'paginas',
    'readonly',
    (tx) => tx.objectStore('paginas')
      .index('livroId')
      .getAll(livroId)
  );

  return (paginas || []).sort((a, b) => a.numero - b.numero);
}