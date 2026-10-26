import { paginarBlocos } from './paginarBlocos'

const TAMANHOS_FONTE = [19, 21, 24];
// Gera as três versões de paginação para a área de leitura.
export function gerarVersoesPaginadas(
    paginasOriginais,
    largura,
    altura
) {
    if (
        !Array.isArray(paginasOriginais) ||
        !Number.isFinite(largura) ||
        !Number.isFinite(altura) ||
        largura <= 0 ||
        altura <= 0
    ) {
        throw new Error(
            'Informe as páginas do livro e as dimensões válidas da área de leitura.'
        );
    }

    // Marca o último bloco de cada página original com quebraApos.
    // Isso preserva a informação mesmo quando o texto é reunido
    // em uma lista única para a paginação.
    const blocos = paginasOriginais.flatMap((pagina) => {
        const blocosPagina = (pagina.blocos || []).filter(
            (bloco) => String(bloco.texto || '').trim()
        );

        return blocosPagina.map((bloco, indice) => ({
            ...bloco,
            texto: String(bloco.texto || ''),
            quebraApos:
                indice === blocosPagina.length - 1 &&
                Boolean(pagina.quebraApos),
        }));
    });

    return TAMANHOS_FONTE.map((tamanhoFonte) => ({
        tamanhoFonte,
        dimensoes: {
            largura,
            altura,
        },
        paginas: paginarBlocos(
            blocos,
            largura,
            altura,
            tamanhoFonte
        ),
    }));
}
