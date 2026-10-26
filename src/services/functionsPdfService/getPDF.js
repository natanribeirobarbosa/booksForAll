import * as pdfjsLib from 'pdfjs-dist';
import { obterArquivoPdf } from '../functionsBookStorage/getPdfFile';
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { atualizarStatusLivro } from '../functionsBookStorage/searchBooks';
import { listarPaginas } from '../functionsBookStorage/searchPages';
import { juntarParagrafosEntrePaginas} from './concatenate'
import { salvarPagina } from '../functionsBookStorage/searchPages';
import { gerarEGuardarVersoes } from './versions';
import { bugText } from './bugText';
import { comecaComMaiuscula } from './services';
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;


function extrairBlocosDoTexto(conteudo) {
  const itens = conteudo.items
    .filter((item) => item.str?.trim())
    .map((item) => {
      const [, , , escalaY, x, y] = item.transform;

      return {
        texto: item.str.trim(),
        x,
        y,
        largura: item.width || 0,
        tamanho: Math.abs(escalaY) || 18,
      };
    })
    .sort((a, b) => {
      const diferencaY = b.y - a.y;

      return Math.abs(diferencaY) > 3
        ? diferencaY
        : a.x - b.x;
    });

  const linhas = [];

  for (const item of itens) {
    let linha = linhas.find((l) => Math.abs(l.y - item.y) <= 3);

    if (!linha) {
      linha = {
        y: item.y,
        xInicial: item.x,
        xFinal: item.x + item.largura,
        tamanho: item.tamanho,
        itens: [],
      };

      linhas.push(linha);
    }

    linha.itens.push(item);
    linha.xInicial = Math.min(linha.xInicial, item.x);
    linha.xFinal = Math.max(
      linha.xFinal,
      item.x + item.largura
    );
    linha.tamanho = Math.max(linha.tamanho, item.tamanho);
  }

  linhas.sort((a, b) => b.y - a.y);

  if (!linhas.length) return [];

  const frequencias = new Map();

  for (const linha of linhas) {
    const margem = Math.round(linha.xInicial / 3) * 3;

    frequencias.set(
      margem,
      (frequencias.get(margem) || 0) + 1
    );
  }

  const margemPrincipal =
    [...frequencias.entries()]
      .sort((a, b) => b[1] - a[1])[0]?.[0] ?? 0;

  const tamanhoMedio =
    linhas.reduce((soma, linha) => soma + linha.tamanho, 0) /
    linhas.length;

  const toleranciaIndentacao = Math.max(8, tamanhoMedio * 0.8);
  const toleranciaEspacamento = tamanhoMedio * 1.5;

  const blocos = [];
  let paragrafo = null;
  let linhaAnterior = null;

  function salvarParagrafo() {
    if (paragrafo?.texto.trim()) {
      blocos.push({
        texto: paragrafo.texto.trim(),
        tamanho: paragrafo.tamanho,
        titulo: false,
      });
    }

    paragrafo = null;
  }

  for (const linha of linhas) {
    const textoLinha = linha.itens
      .sort((a, b) => a.x - b.x)
      .map((item) => item.texto)
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();

    if (!textoLinha) continue;

    const espacamento = linhaAnterior
      ? linhaAnterior.y - linha.y
      : 0;

    const indentada =
      linha.xInicial >
      margemPrincipal + toleranciaIndentacao;

    const espacamentoGrande =
      Boolean(linhaAnterior) &&
      espacamento >
        Math.max(
          toleranciaEspacamento,
          linhaAnterior.tamanho * 1.5
        );

    const inicioPossivel =
      comecaComMaiuscula(textoLinha) &&
      (indentada || espacamentoGrande);

    if (!paragrafo || (linhaAnterior && inicioPossivel)) {
      salvarParagrafo();

      paragrafo = {
        texto: textoLinha,
        tamanho: linha.tamanho,
      };
    } else {
      paragrafo.texto += ` ${textoLinha}`;
    }

    linhaAnterior = linha;
  }

  salvarParagrafo();

  return blocos;
}




export async function carregarPdf(
  livro,
  onPaginaCarregada,
  dimensoesLeitura = null
) {
  if (!livro?.id) {
    throw new Error('O livro não possui um identificador válido.');
  }

  const dadosPdf = await obterArquivoPdf(livro.id);
  const tarefaDocumento = pdfjsLib.getDocument({ data: dadosPdf });
  const documento = await tarefaDocumento.promise;

  let workerOCR = null;

  try {
    const paginasSalvas = await listarPaginas(livro.id);

    const paginasPorNumero = new Map(
      paginasSalvas.map((pagina) => [pagina.numero, pagina])
    );

    const paginas = [];

    await atualizarStatusLivro(livro.id, 'processando');

    for (let numero = 1; numero <= documento.numPages; numero++) {
      let paginaProcessada = paginasPorNumero.get(numero);

      if (!paginaProcessada) {
        const pagina = await documento.getPage(numero);
        const conteudo = await pagina.getTextContent();

        const textoExtraido = conteudo.items
          .map((item) => item.str || '')
          .join(' ');

        let blocos;

        if (bugText(textoExtraido)) {
          if (!workerOCR) {
            workerOCR = await createWorker('por');
          }

          blocos = await extrairComOCR(pagina, workerOCR);
        } else {
          blocos = extrairBlocosDoTexto(conteudo);
        }

        paginaProcessada = {
          numero,
          largura: pagina.view[2] - pagina.view[0],
          altura: pagina.view[3] - pagina.view[1],
          blocos,
        };

        await salvarPagina(livro.id, paginaProcessada);
      }

      paginas.push(paginaProcessada);

      // Mantém o retorno progressivo das páginas extraídas.
      onPaginaCarregada?.(paginaProcessada);
    }

    // Corrige as quebras artificiais entre páginas originais.
    juntarParagrafosEntrePaginas(paginas);

    // Salva novamente as páginas com os textos corrigidos.
    for (const pagina of paginas) {
      await salvarPagina(livro.id, pagina);
    }

    await gerarEGuardarVersoes(
      livro.id,
      paginas,
      dimensoesLeitura
    );

    await atualizarStatusLivro(livro.id, 'concluido');

    return {
      id: livro.id,
      nome: livro.nome || 'Livro sem título',
      totalPaginas: documento.numPages,
      paginas,
      documento,
    };
  } catch (erro) {
    await atualizarStatusLivro(livro.id, 'erro').catch(
      (erroStatus) =>
        console.error(
          'Não foi possível atualizar o status do livro:',
          erroStatus
        )
    );

    throw erro;
  } finally {
    if (workerOCR) {
      await workerOCR.terminate();
    }
  }
}
