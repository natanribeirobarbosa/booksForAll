
const NOME_BANCO = 'booksForAll';
const VERSAO_BANCO = 2;

function abrirBanco() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(NOME_BANCO, VERSAO_BANCO);

    request.onupgradeneeded = () => {
      const banco = request.result;

      if (!banco.objectStoreNames.contains('livros')) {
        banco.createObjectStore('livros', {
          keyPath: 'id',
        });
      }

      if (!banco.objectStoreNames.contains('paginas')) {
        const paginas = banco.createObjectStore('paginas', {
          keyPath: 'id',
        });

        paginas.createIndex('livroId', 'livroId', {
          unique: false,
        });
      }
    };

    request.onblocked = () => {
      console.warn(
        'A atualização do banco está bloqueada por outra conexão aberta.'
      );
    };

    request.onsuccess = () => {
      const banco = request.result;

      banco.onversionchange = () => banco.close();

      resolve(banco);
    };

    request.onerror = () => reject(request.error);
  });
}

// Executa uma transação e aguarda sua conclusão.
async function executarTransacao(stores, modo, operacao) {
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

// Salva o livro e o PDF original.
// livro.arquivo deve conter um Blob, File ou ArrayBuffer.
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
    ['livros', 'paginas'],
    'readwrite',
    (tx) => {
      tx.objectStore('livros').delete(id);

      const indice = tx
        .objectStore('paginas')
        .index('livroId');

      const request = indice.openCursor(
        IDBKeyRange.only(id)
      );

      request.onsuccess = () => {
        const cursor = request.result;

        if (cursor) {
          cursor.delete();
          cursor.continue();
        }
      };

      return request;
    }
  );
}
