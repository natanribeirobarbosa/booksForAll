
import { estimarCaracteresPorLinha } from "./howMuchChar";
import { dividirEmLinhas } from "./divideInLines";

const MARGEM_VERTICAL = 40;
const ALTURA_LINHA = 1.7;
const ESPACO_PARAGRAFO = 18;

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
        const texto = String(bloco.texto || "").trim();

        if (!texto) {
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
        let continuacao = Boolean(bloco.continuacao);

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
            const continuaNaProximaPagina =
                linhasRestantes.length > 0;

            blocosPagina.push({
                titulo: ehTitulo,
                texto: linhasParte.join(" "),
                continuacao,
                continuaNaProximaPagina,
            });

            alturaUsada +=
                quantidade * tamanhoBloco + espacoBloco;

            if (continuaNaProximaPagina) {
                novaPagina();
                continuacao = true;
            }
        }

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
