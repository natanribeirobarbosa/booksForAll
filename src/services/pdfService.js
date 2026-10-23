
import * as pdfjsLib from 'pdfjs-dist';
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

function textoPareceCorrompido(texto) {
    if (!texto.trim()) return true;

    const caracteresEstranhos = (
        texto.match(/[�□]/g) || []
    ).length;

    return caracteresEstranhos / texto.length > 0.05;
}

export async function carregarPdf(livro) {
    let fonte;

    // Caso o seletor tenha fornecido um objeto File do navegador.
    if (livro.file instanceof File) {
        fonte = { data: await livro.file.arrayBuffer() };
    } else {
        // webPath é preferível para arquivos selecionados por um plugin.
        const caminho = livro.webPath || livro.caminho || livro.path;

        if (!caminho) {
            throw new Error('O caminho do PDF não foi informado.');
        }

        const resposta = await fetch(caminho);

        if (!resposta.ok) {
            throw new Error('Não foi possível carregar o arquivo PDF.');
        }

        fonte = { data: await resposta.arrayBuffer() };
    }

    const documento = await pdfjsLib.getDocument(fonte).promise;
    const paginas = [];

    for (let numero = 1; numero <= documento.numPages; numero++) {
        const pagina = await documento.getPage(numero);
        const conteudo = await pagina.getTextContent();

        const textoExtraido = conteudo.items
            .map((item) => item.str)
            .join(' ');

        if (textoPareceCorrompido(textoExtraido)) {
            console.warn(
                `A página ${numero} pode ter problemas de extração de texto.`
            );
        }
        console.log(
            'Texto extraído:',
            conteudo.items.map((item) => item.str).join(' ')
        );

        const itens = conteudo.items
            .filter((item) => item.str?.trim())
            .map((item) => {
                const tamanho = Math.hypot(
                    item.transform[2],
                    item.transform[3]
                );

                return {
                    texto: item.str,
                    tamanho: Math.max(8, Math.round(tamanho)),
                    x: item.transform[4],
                    y: item.transform[5],
                    largura: item.width,
                };
            });

        // Agrupa os textos que estão aproximadamente na mesma linha.
        const linhas = [];

        for (const item of itens) {
            let linha = linhas.find(
                (l) => Math.abs(l.y - item.y) <= 3
            );

            if (!linha) {
                linha = { y: item.y, itens: [] };
                linhas.push(linha);
            }

            linha.itens.push(item);
        }

        linhas.sort((a, b) => b.y - a.y);

        const blocos = linhas.map((linha) => {
            linha.itens.sort((a, b) => a.x - b.x);

            const texto = linha.itens
                .map((item) => item.texto)
                .join(' ')
                .trim();

            const tamanhoMedio =
                linha.itens.reduce((total, item) => total + item.tamanho, 0) /
                linha.itens.length;

            return {
                texto,
                tamanho: Math.round(tamanhoMedio),
                titulo: tamanhoMedio >= 18,
            };
        });

        paginas.push({
            numero,
            largura: pagina.view[2] - pagina.view[0],
            altura: pagina.view[3] - pagina.view[1],
            blocos,
        });
    }

    return {
        nome: livro.nome || 'Livro sem título',
        totalPaginas: documento.numPages,
        paginas,
        documento,
    };
}
