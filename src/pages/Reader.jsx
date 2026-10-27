
import {
  useEffect,
  useState,
  useRef,
  useMemo,
  useLayoutEffect,
} from 'react';


import { carregarPdf } from '../services/functionsPdfService/getPDF.js';
import {
  buscarVersaoPaginada,
} from '../services/functionsBookStorage/searchPages.js';
import { salvarVersaoPaginada } from '../services/functionsBookStorage/savePages.js';

import './Reader.css';

const TAMANHOS_FONTE = [19, 21, 24];

export default function Reader({ livro, onVoltar }) {
  const [tamanhoFonte, setTamanhoFonte] = useState(19);
  const [paginasCarregadas, setPaginasCarregadas] = useState([]);
  const [paginasVisuais, setPaginasVisuais] = useState([]);
  const [dimensoes, setDimensoes] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [pronto, setPronto] = useState(false);
  const [medirNovamente, setMedirNovamente] = useState(false);

  const areaRef = useRef(null);
  const medidorRef = useRef(null);
  const distanciaRef = useRef(null);
  const versaoAtualRef = useRef(0);

  const nomeLivro = (livro?.nome || 'Livro sem título')
    .replace(/\.pdf$/i, '')
    .replace(/[-_]/g, ' ');

  const blocos = useMemo(
    () =>
      paginasCarregadas.flatMap((pagina) =>
        (pagina.blocos || [])
          .filter((bloco) => bloco.texto?.trim())
          .map((bloco, indice) => ({
            id: `${pagina.numero}-${indice}`,
            texto: bloco.texto,
            titulo: Boolean(bloco.titulo),
          }))
      ),
    [paginasCarregadas]
  );

  // Mede a área disponível antes de processar o PDF.
  useLayoutEffect(() => {
    const area = areaRef.current;
    if (!area) return;

    function atualizarDimensoes() {
      const largura = area.clientWidth;
      const altura = area.clientHeight;

      if (!largura || !altura) return;

      setDimensoes((anterior) => {
        if (
          anterior &&
          anterior.largura === largura &&
          anterior.altura === altura
        ) {
          return anterior;
        }

        return { largura, altura };
      });
    }

    atualizarDimensoes();

    const observador = new ResizeObserver(atualizarDimensoes);
    observador.observe(area);

    return () => observador.disconnect();
  }, []);

  // Carrega o texto extraído do PDF.
  useEffect(() => {
    if (!livro?.id || !dimensoes) return;

    let cancelado = false;

    async function carregar() {
      setCarregando(true);
      setErro('');
      setPronto(false);
      setPaginasCarregadas([]);
      setPaginasVisuais([]);

      try {
        const resultado = await carregarPdf(
          livro,
          (pagina) => {
            if (cancelado) return;

            setPaginasCarregadas((anteriores) => {
              const mapa = new Map(
                anteriores.map((item) => [item.numero, item])
              );

              mapa.set(pagina.numero, pagina);

              return [...mapa.values()].sort(
                (a, b) => a.numero - b.numero
              );
            });
          },
          dimensoes
        );

        if (cancelado) return;

        setPaginasCarregadas((anteriores) => {
          const mapa = new Map(
            anteriores.map((pagina) => [pagina.numero, pagina])
          );

          for (const pagina of resultado.paginas || []) {
            mapa.set(pagina.numero, pagina);
          }

          return [...mapa.values()].sort(
            (a, b) => a.numero - b.numero
          );
        });
      } catch (e) {
        console.error('Erro ao ler PDF:', e);

        if (!cancelado) {
          setErro(e?.message || 'Não foi possível ler este PDF.');
        }
      } finally {
        if (!cancelado) setCarregando(false);
      }
    }

    carregar();

    return () => {
      cancelado = true;
    };
  }, [livro, dimensoes]);

  // Tenta reutilizar a versão salva para fonte e dimensões atuais.
  useEffect(() => {
    if (
      carregando ||
      erro ||
      !blocos.length ||
      !dimensoes
    ) {
      return;
    }

    let cancelado = false;
    const idExecucao = ++versaoAtualRef.current;

    async function prepararVersao() {
      setPronto(false);

      try {
        const salva = await buscarVersaoPaginada(
          livro.id,
          tamanhoFonte
        );

        if (cancelado || idExecucao !== versaoAtualRef.current) {
          return;
        }

        const mesmaDimensao =
          salva?.dimensoes?.largura === dimensoes.largura &&
          salva?.dimensoes?.altura === dimensoes.altura;

        if (
          mesmaDimensao &&
          salva?.versaoPaginacao === 2 &&
          Array.isArray(salva.paginas) &&
          salva.paginas.length > 0
        ) {
          setPaginasVisuais(
            salva.paginas.map((pagina) =>
              pagina.blocos.map((bloco) => ({
                ...bloco,
                id: bloco.id || `${pagina.numero}-${bloco.texto}`,
              }))
            )
          );

          setPronto(true);
          setMedirNovamente(false);
          return;
        }

        setMedirNovamente(true);
      } catch (e) {
        console.warn('Não foi possível reutilizar a paginação salva:', e);
        setMedirNovamente(true);
      }
    }

    prepararVersao();

    return () => {
      cancelado = true;
    };
  }, [livro?.id, blocos, tamanhoFonte, dimensoes, carregando, erro]);

  // Mede a altura real dos parágrafos e monta páginas sem cortar blocos.
  useLayoutEffect(() => {
    if (
      !medirNovamente ||
      carregando ||
      erro ||
      !dimensoes
    ) {
      return;
    }

    const area = areaRef.current;
    const medidor = medidorRef.current;

    if (!area || !medidor) return;

    const estiloArea = getComputedStyle(area);
    const paddingTopo = parseFloat(estiloArea.paddingTop) || 0;
    const paddingBaixo = parseFloat(estiloArea.paddingBottom) || 0;

    const alturaUtil =
      area.clientHeight - paddingTopo - paddingBaixo - 36;

    if (alturaUtil <= 0) return;

    const elementos = [...medidor.querySelectorAll('[data-bloco]')];

    const resultado = [];
    let paginaAtual = [];
    let alturaUsada = 0;

    function fecharPagina() {
      if (paginaAtual.length) resultado.push(paginaAtual);
      paginaAtual = [];
      alturaUsada = 0;
    }

    for (let i = 0; i < elementos.length; i++) {
      const elemento = elementos[i];
      const bloco = blocos[i];

      if (!bloco) continue;

      const estilo = getComputedStyle(elemento);
      const alturaBloco = elemento.getBoundingClientRect().height;
      const margemTopo = parseFloat(estilo.marginTop) || 0;
      const margemBaixo = parseFloat(estilo.marginBottom) || 0;
      const alturaTotal = alturaBloco + margemTopo + margemBaixo;

      if (
        paginaAtual.length > 0 &&
        alturaUsada + alturaTotal > alturaUtil
      ) {
        fecharPagina();
      }

      paginaAtual.push(bloco);
      alturaUsada += alturaTotal;
    }

    fecharPagina();

    setPaginasVisuais(resultado);
    setPronto(true);
    setMedirNovamente(false);

    // Salva a paginação medida para reutilizar depois.
    salvarVersaoPaginada(

      livro.id,
      tamanhoFonte,
      resultado.map((pagina, indice) => ({
        numero: indice + 1,
        blocos: pagina,
      })),
      dimensoes

    ).catch((e) => {
      console.warn('Não foi possível salvar a paginação:', e);
    });
  }, [
    medirNovamente,

    blocos,
    tamanhoFonte,
    dimensoes,
    carregando,
    erro,
    livro?.id,
  ]);

  function alterarFonte(novoTamanho) {
    if (!TAMANHOS_FONTE.includes(novoTamanho)) return;
    setTamanhoFonte(novoTamanho);
  }

  function navegar(direcao) {
    const area = areaRef.current;
    if (!area) return;

    area.scrollBy({
      left: direcao * area.clientWidth,
      behavior: 'smooth',
    });
  }

  function navegarPorToque(event) {
    if (event.target.closest('button')) return;
    if (window.getSelection()?.toString()) return;

    const area = areaRef.current;
    if (!area) return;

    const x = event.clientX - area.getBoundingClientRect().left;

    if (x < area.clientWidth * 0.35) navegar(-1);
    else if (x > area.clientWidth * 0.65) navegar(1);
  }

  function distanciaToque(touches) {
    const dx = touches[0].clientX - touches[1].clientX;
    const dy = touches[0].clientY - touches[1].clientY;
    return Math.sqrt(dx * dx + dy * dy);
  }

  function iniciarPinça(event) {
    if (event.touches.length === 2) {
      distanciaRef.current = distanciaToque(event.touches);
    }
  }

  function moverPinça(event) {
    if (event.touches.length !== 2 || distanciaRef.current === null) {
      return;
    }

    const atual = distanciaToque(event.touches);
    const diferenca = atual - distanciaRef.current;

    if (Math.abs(diferenca) >= 24) {
      const indiceAtual = TAMANHOS_FONTE.indexOf(tamanhoFonte);
      const proximoIndice = Math.max(
        0,
        Math.min(
          TAMANHOS_FONTE.length - 1,
          indiceAtual + (diferenca > 0 ? 1 : -1)
        )
      );

      alterarFonte(TAMANHOS_FONTE[proximoIndice]);
      distanciaRef.current = atual;
    }
  }

  function finalizarPinça() {
    distanciaRef.current = null;
  }

  return (
    <main className="reader">
      <header className="reader-header">
        <button onClick={onVoltar}>← Voltar</button>
        <h1>{nomeLivro}</h1>

        <div className="reader-font-controls">
          {TAMANHOS_FONTE.map((tamanho) => (
            <button
              key={tamanho}
              onClick={() => alterarFonte(tamanho)}
              aria-pressed={tamanhoFonte === tamanho}
            >
              {tamanho}
            </button>
          ))}
        </div>
      </header>

      {erro && <p role="alert">{erro}</p>}

      {!erro && (
        <>
          <section
            ref={areaRef}
            className="reader-content"
            onClick={navegarPorToque}
            onTouchStart={iniciarPinça}
            onTouchMove={moverPinça}
            onTouchEnd={finalizarPinça}
            onTouchCancel={finalizarPinça}
          >
            <article className="reader-page reader-title-page">
              <div className="reader-cover-generated">

                <h2>{nomeLivro}</h2>
                {carregando && <p>Carregando livro...</p>}
              </div>
            </article>

            {!carregando &&
              pronto &&
              paginasVisuais.map((pagina, indice) => (
                <article className="reader-page" key={`pagina-${indice}`}>
                  <div className="reader-page-text">

                    {pagina.map((bloco, blocoIndice) => (
                      <p
                        key={blocoIndice}
                        className={`reader-text ${bloco.continuacao ? 'continuacao' : ''}`}
                        data-continuacao={String(Boolean(bloco.continuacao))}
                        style={{ fontSize: `${tamanhoFonte}px` }}
                      >
                        {bloco.texto}
                      </p>
                    ))}

                  </div>

                  {/*   <span className="reader-page-number">
                    {indice + 1} / {paginasVisuais.length}
                  </span> */}
                </article>
              ))}

            {!carregando && pronto && blocos.length === 0 && (
              <article className="reader-page">
                Este PDF não contém texto extraível.
              </article>
            )}
          </section>

          {!carregando && (
            <div className="reader-measurer" ref={medidorRef}>
              {blocos.map((bloco) => (
                <p
                  key={bloco.id}
                  data-bloco
                  className={
                    bloco.titulo
                      ? 'reader-text reader-title'
                      : 'reader-text'
                  }
                  style={{ fontSize: `${tamanhoFonte}px` }}
                >
                  {bloco.texto.split(/<br\s*\/?>/i).map((parte, i) => (
                    <span key={i}>
                      {i > 0 && <br />}
                      {parte}
                    </span>
                  ))}
                </p>
              ))}
            </div>
          )}
        </>
      )}
    </main>
  );
}
