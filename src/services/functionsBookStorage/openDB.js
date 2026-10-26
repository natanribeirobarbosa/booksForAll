
const NOME_BANCO = 'booksForAll';
const VERSAO_BANCO = 1;

export function abrirBanco() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(NOME_BANCO, VERSAO_BANCO);

    request.onupgradeneeded = () => {
      const banco = request.result;

      const livros = banco.createObjectStore('livros', {
        keyPath: 'id',
      });

      const paginas = banco.createObjectStore('paginas', {
        keyPath: 'id',
      });

      paginas.createIndex('livroId', 'livroId', {
        unique: false,
      });

      const versoes = banco.createObjectStore('versoes', {
        keyPath: 'id',
      });

      versoes.createIndex('livroId', 'livroId', {
        unique: false,
      });
    };

    request.onblocked = () => {
      console.warn('Feche as outras abas do aplicativo para recriar o banco.');
    };

    request.onsuccess = () => {
      const banco = request.result;
      banco.onversionchange = () => banco.close();
      resolve(banco);
    };

    request.onerror = () => reject(request.error);
  });
}