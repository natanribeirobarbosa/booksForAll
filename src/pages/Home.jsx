
import { useState } from 'react';
import { FilePicker } from '@capawesome/capacitor-file-picker';
import BookCard from '../components/BookCard';


export default function Home({ onAbrirLivro }) {
  const [livros, setLivros] = useState([]);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState('');

  async function importarLivros() {
    try {
      setCarregando(true);
      setErro('');

      const resultado = await FilePicker.pickFiles({
        types: ['application/pdf'],
        limit: 0,
        readData: false,
      });

      const novosLivros = resultado.files.map((arquivo, indice) => ({
        id: `${arquivo.name}-${indice}-${Date.now()}`,
        nome: arquivo.name,
        caminho: arquivo.path,
        webPath: arquivo.webPath,
        tamanho: arquivo.size,
      }));

      setLivros((anteriores) => {
        const nomesExistentes = new Set(
          anteriores.map((livro) => livro.nome)
        );

        return [
          ...anteriores,
          ...novosLivros.filter(
            (livro) => !nomesExistentes.has(livro.nome)
          ),
        ];
      });
    } catch (erroImportacao) {
      console.error(erroImportacao);
      setErro('Não foi possível selecionar os PDFs.');
    } finally {
      setCarregando(false);
    }
  }

  return (
    <main>
      <h1>Books for All</h1>
      <p>Seus livros em PDF</p>

      <button onClick={importarLivros} disabled={carregando}>
        {carregando ? 'Selecionando...' : 'Adicionar PDFs'}
      </button>

      {erro && <p role="alert">{erro}</p>}

      {livros.length === 0 ? (
        <p>Nenhum livro adicionado ainda.</p>
      ) : (
        <section className="book-list">
          {livros.map((livro, indice) => (
            <BookCard
              key={livro.id || livro.uri || livro.caminho || indice}
              livro={livro}
              onAbrir={() => onAbrirLivro?.(livro)}
            />
          ))}
        </section>
      )}
    </main>
  );
}
