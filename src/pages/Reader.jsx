
import { useEffect, useState } from 'react';
import { carregarPdf } from '../services/pdfService';
import './Reader.css';

export default function Reader({ livro, onVoltar }) {
  const [escalaFonte, setEscalaFonte] = useState(1);
  const [paginasCarregadas, setPaginasCarregadas] = useState([]);
  const [totalPaginas, setTotalPaginas] = useState(0);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');

  const nomeLivro = (livro?.nome || 'Livro sem título')
    .replace(/\.pdf$/i, '')
    .replace(/[-_]/g, ' ');

  useEffect(() => {
    let cancelado = false;

    async function carregar() {
      setCarregando(true);
      setErro('');
      setPaginasCarregadas([]);
      setTotalPaginas(0);

      if (!livro?.id) {
        setErro('Não foi possível identificar o livro selecionado.');
        setCarregando(false);
        return;
      }

      try {
        const resultado = await carregarPdf(livro, (pagina) => {
          if (cancelado) return;

          setPaginasCarregadas((anteriores) => {
            const existe = anteriores.some(
              (item) => item.numero === pagina.numero
            );

            if (existe) {
              return anteriores.map((item) =>
                item.numero === pagina.numero ? pagina : item
              );
            }

            return [...anteriores, pagina].sort(
              (a, b) => a.numero - b.numero
            );
          });
        });

        if (!cancelado) {
          setTotalPaginas(resultado.totalPaginas);

          // Garante que todas as páginas retornadas estejam no leitor.
          setPaginasCarregadas((anteriores) => {
            const porNumero = new Map(
              anteriores.map((pagina) => [pagina.numero, pagina])
            );

            for (const pagina of resultado.paginas || []) {
              porNumero.set(pagina.numero, pagina);
            }

            return [...porNumero.values()].sort(
              (a, b) => a.numero - b.numero
            );
          });
        }
      } catch (e) {
        console.error('Erro ao ler PDF:', e);

        if (!cancelado) {
          setErro(
            e?.message ||
              'Não foi possível ler este PDF. Tente importá-lo novamente.'
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

  function alterarEscala(valor) {
    setEscalaFonte((atual) =>
      Math.min(2.5, Math.max(0.7, Number((atual + valor).toFixed(1))))
    );
  }

  return (
    <main className="reader">
      <header className="reader-header">
        <button onClick={onVoltar}>← Voltar</button>

        <h1>{nomeLivro}</h1>

        <p>
          {totalPaginas > 0
            ? `${paginasCarregadas.length} de ${totalPaginas} páginas`
            : carregando
              ? 'Preparando leitura...'
              : 'Leitura'}
        </p>
      </header>

      <div className="reader-controls">
        <button
          onClick={() => alterarEscala(-0.1)}
          disabled={escalaFonte <= 0.7}
          aria-label="Diminuir tamanho do texto"
        >
          A-
        </button>

        <span>{Math.round(escalaFonte * 100)}%</span>

        <button
          onClick={() => alterarEscala(0.1)}
          disabled={escalaFonte >= 2.5}
          aria-label="Aumentar tamanho do texto"
        >
          A+
        </button>
      </div>

      {carregando && (
        <p role="status">
          Processando o PDF. As páginas aparecerão conforme ficarem prontas.
        </p>
      )}

      {erro && <p role="alert">{erro}</p>}

      {!erro && (
        <>
          <section className="reader-cover-generated">
            <span className="cover-brand">BOOKS FOR ALL</span>
            <h2>{nomeLivro}</h2>
            <span className="cover-footer">LIVRO DIGITAL</span>
          </section>

          <section className="reader-content">
            {paginasCarregadas.map((pagina) => {
              const blocos = pagina.blocos || [];

              return (
                <article className="reader-page" key={pagina.numero}>
                  <p className="reader-page-number">
                    Página {pagina.numero}
                  </p>

                  {blocos.length === 0 ? (
                    <p>
                      Esta página não contém texto extraível.
                    </p>
                  ) : (
                    blocos.map((bloco, indice) => {
                      const tamanhoBase = Number(bloco.tamanho) || 16;
                      const tamanhoFinal = Math.min(
                        90,
                        Math.max(11, tamanhoBase * escalaFonte)
                      );

                      return (
                        <p
                          key={`${pagina.numero}-${indice}`}
                          className={
                            bloco.titulo
                              ? 'reader-text reader-title'
                              : 'reader-text'
                          }
                          style={{ fontSize: `${tamanhoFinal}px` }}
                        >
                          {bloco.texto}
                        </p>
                      );
                    })
                  )}
                </article>
              );
            })}
          </section>
        </>
      )}
    </main>
  );
}
