
import * as pdfjsLib from 'pdfjs-dist';
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { createWorker } from 'tesseract.js';
import {
  obterArquivoPdf,
  salvarPagina,
  listarPaginas,
  atualizarStatusLivro,
} from './bookStorage';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

function textoPareceCorrompido(texto) {
  const limpo = texto.trim();

  if (limpo.length < 20) return true;

  const caracteres = [...limpo.replace(/\s/g, '')];
  if (!caracteres.length) return true;

  const letras = caracteres.filter((char) =>
    /[\p{L}\p{N}]/u.test(char)
  ).length;

  return letras / caracteres.length < 0.65;
}

async function extrairComOCR(pagina, worker) {
  const viewport = pagina.getViewport({ scale: 2 });
  const canvas = document.createElement('canvas');
  const contexto = canvas.getContext('2d');

  if (!contexto) {
    throw new Error('Não foi possível criar o canvas para o OCR.');
  }

  canvas.width = Math.ceil(viewport.width);
  canvas.height = Math.ceil(viewport.height);

  try {
    await pagina.render({
      canvasContext: contexto,
      viewport,
    }).promise;

    const resultado = await worker.recognize(canvas);

    return resultado.data.text
      .split(/\n\s*\n/)
      .map((texto) => texto.replace(/\s*\n\s*/g, ' ').trim())
      .filter(Boolean)
      .map((texto) => ({
        texto,
        tamanho: 16,
        titulo: texto.length < 80 && !/[.!?,;:]$/.test(texto),
      }));
  } finally {
    canvas.width = 0;
    canvas.height = 0;
  }
}

function extrairBlocosDoTexto(conteudo) {
  const itens = conteudo.items
    .filter((item) => item.str?.trim())
    .map((item) => {
      const [, , , escalaY, x, y] = item.transform;

      return {
        texto: item.str,
        x,
        y,
        tamanho: Math.abs(escalaY) || 18,
      };
    })
    .sort((a, b) => {
      // Ordena de cima para baixo e, na mesma linha, da esquerda para a direita.
      const diferencaY = b.y - a.y;

      if (Math.abs(diferencaY) > 3) {
        return diferencaY;
      }

      return a.x - b.x;
    });

  const linhas = [];

  for (const item of itens) {
    let linha = linhas.find(
      (l) => Math.abs(l.y - item.y) <= 3
    );

    if (!linha) {
      linha = {
        y: item.y,
        xInicial: item.x,
        tamanho: item.tamanho,
        itens: [],
      };

      linhas.push(linha);
    }

    linha.itens.push(item);
    linha.xInicial = Math.min(linha.xInicial, item.x);
    linha.tamanho = Math.max(linha.tamanho, item.tamanho);
  }

  linhas.sort((a, b) => b.y - a.y);

  const linhasFormatadas = linhas.map((linha) => ({
    texto: linha.itens
      .sort((a, b) => a.x - b.x)
      .map((item) => item.texto)
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim(),
    xInicial: linha.xInicial,
    y: linha.y,
    tamanho: linha.tamanho,
  }));

  // Usa a margem esquerda predominante como referência.
  const frequencias = new Map();

  for (const linha of linhasFormatadas) {
    const margem = Math.round(linha.xInicial / 3) * 3;
    frequencias.set(margem, (frequencias.get(margem) || 0) + 1);
  }

  const margemPrincipal = [...frequencias.entries()]
    .sort((a, b) => b[1] - a[1])[0]?.[0] ?? 0;

  const tolerancia = Math.max(
    8,
    (linhasFormatadas[0]?.tamanho || 18) * 0.8
  );

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

  for (const linha of linhasFormatadas) {
    if (!linha.texto) continue;

    const indentada = linha.xInicial > margemPrincipal + tolerancia;

    // Uma linha indentada pode indicar o começo de um novo parágrafo.
    const comecaParagrafo =
      !paragrafo ||
      (indentada && linhaAnterior && !linhaAnterior.terminaLinha);

    if (comecaParagrafo) {
      salvarParagrafo();

      paragrafo = {
        texto: linha.texto,
        tamanho: linha.tamanho,
      };
    } else {
      paragrafo.texto += ` ${linha.texto}`;
    }

    linhaAnterior = {
      terminaLinha: /[.!?:…]["')\]]?$/.test(linha.texto),
    };
  }

  salvarParagrafo();

  return blocos;
}


export async function carregarPdf(livro, onPaginaCarregada) {
  if (!livro?.id) {
    throw new Error('O livro não possui um identificador válido.');
  }

  // O PDF é lido do IndexedDB, sem depender de URLs temporárias.
  const dadosPdf = await obterArquivoPdf(livro.id);

  const documento = await pdfjsLib.getDocument({
    data: dadosPdf,
  }).promise;

  let workerOCR = null;

  try {
    const paginasSalvas = await listarPaginas(livro.id);
    const paginasPorNumero = new Map(
      paginasSalvas.map((pagina) => [pagina.numero, pagina])
    );

    const paginas = [];

    await atualizarStatusLivro(livro.id, 'processando');

    for (let numero = 1; numero <= documento.numPages; numero++) {
      // Reutiliza o texto já extraído, quando disponível.
      let paginaProcessada = paginasPorNumero.get(numero);

      if (!paginaProcessada) {
        const pagina = await documento.getPage(numero);
        const conteudo = await pagina.getTextContent();

        const textoExtraido = conteudo.items
          .map((item) => item.str || '')
          .join(' ');

        let blocos;

        if (textoPareceCorrompido(textoExtraido)) {
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

        // Persiste a página assim que termina o processamento.
        await salvarPagina(livro.id, paginaProcessada);
      }

      paginas.push(paginaProcessada);

      // Permite mostrar páginas progressivamente na interface.
      onPaginaCarregada?.(paginaProcessada);
    }

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
      (erroStatus) => console.error(
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
