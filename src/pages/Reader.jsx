
import { useEffect, useState, useRef } from 'react';
import { carregarPdf } from '../services/pdfService';
import './Reader.css';


export default function Reader({ livro, onVoltar }) {
  const [escalaFonte, setEscalaFonte] = useState(1);
  const [paginasCarregadas, setPaginasCarregadas] = useState([]);
  const [totalPaginas, setTotalPaginas] = useState(0);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const distanciaInicial = useRef(null);
  const ultimaDistancia = useRef(null);

  function distanciaToque(touches) {
    const dx = touches[0].clientX - touches[1].clientX;
    const dy = touches[0].clientY - touches[1].clientY;

    return Math.sqrt(dx * dx + dy * dy);
  }


  function navegarPorToque(event) {
    // Não troca de página se o usuário estiver selecionando texto.
    if (window.getSelection()?.toString()) return;

    const area = event.currentTarget;
    const largura = area.clientWidth;
    const posicaoX = event.clientX - area.getBoundingClientRect().left;

    // Ignora o toque se ele estiver muito próximo do centro.
    if (posicaoX > largura * 0.35 && posicaoX < largura * 0.65) {
      return;
    }

    area.scrollBy({
      left: posicaoX >= largura * 0.65 ? largura : -largura,
      behavior: 'smooth',
    });
  }


  function iniciarPinça(event) {
    if (event.touches.length === 2) {
      const distancia = distanciaToque(event.touches);

      distanciaInicial.current = distancia;
      ultimaDistancia.current = distancia;
    }
  }

  function moverPinça(event) {
    if (event.touches.length !== 2 || ultimaDistancia.current === null) {
      return;
    }

    const distanciaAtual = distanciaToque(event.touches);
    const diferenca = distanciaAtual - ultimaDistancia.current;

    // Evita alterações excessivas com movimentos pequenos.
    if (Math.abs(diferenca) >= 12) {
      setEscalaFonte((atual) => {
        const novaEscala = atual + (diferenca > 0 ? 0.05 : -0.05);
        return Math.min(2.5, Math.max(0.7, novaEscala));
      });

      ultimaDistancia.current = distanciaAtual;
    }
  }

  function finalizarPinça() {
    distanciaInicial.current = null;
    ultimaDistancia.current = null;
  }


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


      </header>

      <div className="reader-controls">




      </div>



      {erro && <p role="alert">{erro}</p>}

      {!erro && (
        <>



          <section
            className="reader-content"
            onTouchStart={iniciarPinça}
            onTouchMove={moverPinça}
            onTouchEnd={finalizarPinça}
            onTouchCancel={finalizarPinça}
            onClick={navegarPorToque}
          >

            <div className="reader-page reader-title-page">
              <div className="reader-cover-generated">
                <span className="cover-brand">BOOKS FOR ALL</span>
                <h2>{nomeLivro}</h2>

              </div>
            </div>

            {paginasCarregadas.map((pagina) => {

              const blocos = pagina.blocos || [];

              const grupos = blocos.map((bloco) => ({
                tipo: bloco.titulo ? 'titulo' : 'paragrafo',
                texto: bloco.texto,
              }));


              return (
                <div className="reader-page" key={pagina.numero}>


                  {grupos.length === 0 ? (
                    <p>Esta página não contém texto extraível.</p>
                  ) : (
                    grupos.map((grupo, indice) => (
                      <p
                        key={`${pagina.numero}-${indice}`}
                        className={
                          grupo.tipo === 'titulo'
                            ? 'reader-text reader-title'
                            : 'reader-text'
                        }
                        style={{
                          fontSize: `${18 * escalaFonte}px`,
                        }}
                      >
                        {grupo.texto.split(/<br\s*\/?>/i).map((parte, indice) => (
                          <span key={`${pagina.numero}-${indice}`}>
                            {indice > 0 && <br />}
                            {parte}
                          </span>
                        ))}
                      </p>
                    ))
                  )}
                  <p className="reader-page-number">
                    Página {pagina.numero}
                  </p>
                </div>
              );
            })}

          </section>
        </>
      )}
    </main>
  );
}
