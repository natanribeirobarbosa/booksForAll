
import { useEffect, useRef, useState } from 'react';
import { carregarPdf } from '../services/pdfService';
import './Reader.css';

export default function Reader({ livro, onVoltar }) {
  const [escalaFonte, setEscalaFonte] = useState(1);
  const [dados, setDados] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const capaRef = useRef(null);

  useEffect(() => {
    let cancelado = false;

    async function carregar() {
      try {
        setCarregando(true);
        setErro('');
        setDados(null);

        const resultado = await carregarPdf(livro);

        if (!cancelado) {
          setDados(resultado);
        }
      } catch (e) {
        console.error('Erro ao ler PDF:', e);

        if (!cancelado) {
          setErro(
            'Não foi possível ler este PDF. Verifique se o arquivo pode ser acessado.'
          );
        }
      } finally {
        if (!cancelado) {
          setCarregando(false);
        }
      }
    }

    carregar();

    return () => {
      cancelado = true;
    };
  }, [livro]);

  useEffect(() => {
    if (!dados || !capaRef.current) return;

    let cancelado = false;

    async function desenharCapa() {
      try {
        const pagina = await dados.documento.getPage(1);
        const escala = 1.5;
        const viewport = pagina.getViewport({ scale: escala });
        const canvas = capaRef.current;

        if (!canvas || cancelado) return;

        const contexto = canvas.getContext('2d');

        canvas.width = viewport.width;
        canvas.height = viewport.height;

        await pagina.render({
          canvasContext: contexto,
          viewport,
        }).promise;
      } catch (e) {
        console.error('Erro ao renderizar a capa:', e);
      }
    }

    desenharCapa();

    return () => {
      cancelado = true;
    };
  }, [dados]);

  if (carregando) {
    return (
      <main className="reader">
        <button onClick={onVoltar}>← Voltar</button>
        <p>Carregando livro...</p>
      </main>
    );
  }

  if (erro || !dados) {
    return (
      <main className="reader">
        <button onClick={onVoltar}>← Voltar</button>
        <p role="alert">{erro || 'Não foi possível abrir o livro.'}</p>
      </main>
    );
  }

  return (
    <main className="reader">
      <div className="reader-controls">
        <button onClick={() => setEscalaFonte((v) => Math.max(0.7, v - 0.1))}>
          A-
        </button>

        <span>{Math.round(escalaFonte * 100)}%</span>

        <button onClick={() => setEscalaFonte((v) => Math.min(2.5, v + 0.1))}>
          A+
        </button>
      </div>
      <header className="reader-header">
        <button onClick={onVoltar}>← Voltar</button>
        <h1>{dados.nome.replace(/\.pdf$/i, '')}</h1>
        <p>{dados.totalPaginas} páginas</p>
      </header>

      <section className="reader-cover-generated">
        <span className="cover-brand">BOOKS FOR ALL</span>

        <h1>{dados.titulo || dados.nome.replace(/\.pdf$/i, '')}</h1>

        {dados.autor && <p>{dados.autor}</p>}

        <span className="cover-footer">LIVRO DIGITAL</span>
      </section>
      <section className="reader-content">
        {dados.paginas.map((pagina) => (
          <article
            className="reader-page"
            key={pagina.numero}
          >
            <p className="reader-page-number">
              Página {pagina.numero}
            </p>

            {pagina.blocos.length === 0 ? (
              <p>
                Esta página não contém texto extraível.
              </p>
            ) : (
              pagina.blocos.map((bloco, indice) => (
                <p
                  key={`${pagina.numero}-${indice}`}
                  className={
                    bloco.titulo
                      ? 'reader-text reader-title'
                      : 'reader-text'
                  }
                  style={{
                    fontSize: `${Math.min(
                      90,
                      Math.max(16, bloco.tamanho * escalaFonte)
                    )}px`,
                  }}
                >

                  
                  {bloco.texto}
                </p>
              ))
            )}
          </article>
        ))}
      </section>
    </main>
  );
}
