
import { useEffect, useState } from 'react';
import { FilePicker } from '@capawesome/capacitor-file-picker';
import BookCard from '../components/BookCard';
import {
  salvarLivro,
  listarLivros,
} from '../services/bookStorage';

function converterParaBlob(data) {
  if (data instanceof Blob) {
    return data;
  }

  if (data instanceof ArrayBuffer) {
    return new Blob([data], { type: 'application/pdf' });
  }

  if (data instanceof Uint8Array) {
    return new Blob([data], { type: 'application/pdf' });
  }

  if (typeof data === 'string' && data.length > 0) {
    const base64 = data.includes(',')
      ? data.slice(data.indexOf(',') + 1)
      : data;

    const binario = atob(base64);
    const bytes = new Uint8Array(binario.length);

    for (let i = 0; i < binario.length; i++) {
      bytes[i] = binario.charCodeAt(i);
    }

    return new Blob([bytes], { type: 'application/pdf' });
  }

  throw new Error(
    'O seletor não retornou os dados do PDF. Não foi possível salvar o arquivo.'
  );
}

export default function Home({ onAbrirLivro }) {
  const [livros, setLivros] = useState([]);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState('');

  useEffect(() => {
    async function carregarLivrosSalvos() {
      try {
        const livrosSalvos = await listarLivros();

        const livrosValidos = (livrosSalvos || []).filter(
          (livro) => livro.arquivo instanceof Blob && livro.arquivo.size > 0
        );

        setLivros(livrosValidos);
      } catch (erroCarregamento) {
        console.error('Erro ao carregar livros:', erroCarregamento);
        setErro('Não foi possível carregar a biblioteca salva.');
      }
    }

    carregarLivrosSalvos();
  }, []);

  async function importarLivros() {
    try {
      setCarregando(true);
      setErro('');

      const resultado = await FilePicker.pickFiles({
        types: ['application/pdf'],
        limit: 0,
        readData: true,
      });

      const arquivos = resultado.files || [];

      // Atualiza a lista local para evitar duplicatas nesta importação.
      const livrosAtuais = await listarLivros();
      const nomesExistentes = new Set(
        (livrosAtuais || []).map((livro) => livro.nome)
      );

      const novosLivros = [];

      for (const arquivo of arquivos) {
        if (nomesExistentes.has(arquivo.name)) {
          continue;
        }

        // O conteúdo é obrigatório: não salvamos apenas uma URL temporária.
        const pdfBlob = converterParaBlob(arquivo.data);

        if (pdfBlob.size === 0) {
          throw new Error(`O PDF "${arquivo.name}" está vazio.`);
        }

        const novoLivro = {
          id: crypto.randomUUID(),
          nome: arquivo.name,
          arquivo: pdfBlob,
          tamanho: pdfBlob.size,
          adicionadoEm: Date.now(),
          statusProcessamento: 'pendente',
        };

        await salvarLivro(novoLivro);

        novosLivros.push(novoLivro);
        nomesExistentes.add(arquivo.name);
      }

      if (novosLivros.length > 0) {
        setLivros((anteriores) => [...anteriores, ...novosLivros]);
      }
    } catch (erroImportacao) {
      console.error('Erro ao importar PDFs:', erroImportacao);

      setErro(
        erroImportacao?.message ||
        'Não foi possível selecionar ou salvar os PDFs.'
      );
    } finally {
      setCarregando(false);
    }
  }

  return (
    <main>
      <h1>Books for All</h1>
      <p>Seus livros em PDF</p>

      <button onClick={importarLivros} disabled={carregando}>
        {carregando ? 'Importando...' : 'Adicionar PDFs'}
      </button>

      {erro && <p role="alert">{erro}</p>}

      {livros.length === 0 ? (
        <p>Nenhum livro adicionado ainda.</p>
      ) : (
        <section className="book-list">
          {livros.map((livro) => (
            <BookCard
              key={livro.id}
              livro={livro}
              onAbrir={() => onAbrirLivro?.(livro)}
            />
          ))}
        </section>
      )}
    </main>
  );
}
