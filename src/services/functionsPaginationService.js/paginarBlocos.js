import { estimarCaracteresPorLinha } from "./howMuchChar";
import { dividirEmLinhas } from "./divideInLines";

const MARGEM_VERTICAL = 40;
const ALTURA_LINHA = 1.7;
const ESPACO_PARAGRAFO = 18;


// Gera páginas respeitando os blocos e as quebras do PDF original.
export function paginarBlocos(blocos, largura, altura, tamanhoFonte) {
    const limiteCaracteres = estimarCaracteresPorLinha(
        largura,
        tamanhoFonte
    );

    const alturaUtil = Math.max(150, altura - MARGEM_VERTICAL);
    const alturaLinha = tamanhoFonte * ALTURA_LINHA;

    const paginas = [];
    let blocosPagina = [];
    let alturaUsada = 0;

    function novaPagina() {
        if (blocosPagina.length > 0) {
            paginas.push({ blocos: blocosPagina });
        }

        blocosPagina = [];
        alturaUsada = 0;
    }

    for (const bloco of blocos || []) {
        const texto = String(bloco.texto || '').trim();

        if (!texto) {
            // Mesmo um bloco vazio não deve impedir uma quebra solicitada
            // pelo último bloco da página original.
            if (bloco.quebraApos) novaPagina();
            continue;
        }

        const partes = texto.split(/<br\s*\/?>/i);
        const linhasBloco = [];

        for (const parte of partes) {
            linhasBloco.push(
                ...dividirEmLinhas(parte, limiteCaracteres)
            );
        }

        if (linhasBloco.length === 0) {
            if (bloco.quebraApos) novaPagina();
            continue;
        }

        const ehTitulo = Boolean(bloco.titulo);
        const tamanhoBloco = ehTitulo
            ? tamanhoFonte * 1.4
            : alturaLinha;

        const espacoBloco = ehTitulo ? 12 : ESPACO_PARAGRAFO;
        let linhasRestantes = [...linhasBloco];

        while (linhasRestantes.length > 0) {
            const espacoRestante = alturaUtil - alturaUsada;
            const linhasDisponiveis = Math.floor(
                (espacoRestante - espacoBloco) / tamanhoBloco
            );

            if (linhasDisponiveis <= 0) {
                novaPagina();
                continue;
            }

            const quantidade = Math.min(
                linhasDisponiveis,
                linhasRestantes.length
            );

            const linhasParte = linhasRestantes.splice(0, quantidade);

            blocosPagina.push({
                titulo: ehTitulo,
                texto: linhasParte.join(' '),
            });

            alturaUsada +=
                quantidade * tamanhoBloco + espacoBloco;

            // Se o bloco ainda não terminou, continua na próxima página.
            if (linhasRestantes.length > 0) {
                novaPagina();
            }
        }

        // Só quebra depois que o bloco inteiro terminou.
        // Assim, um parágrafo dividido por falta de espaço não provoca
        // uma quebra extra antes de terminar.
        if (bloco.quebraApos) {
            novaPagina();
        }
    }

    if (blocosPagina.length > 0) {
        paginas.push({ blocos: blocosPagina });
    }

    return paginas.map((pagina, indice) => ({
        numero: indice + 1,
        blocos: pagina.blocos,
    }));
}