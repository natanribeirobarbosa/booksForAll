export function comecaComMaiuscula(texto) {
  return /^\p{Lu}/u.test(texto.trimStart());
}

export function comecaComMinuscula(texto) {
  return /^\p{Ll}/u.test(texto.trimStart());
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
