const MARGEM_HORIZONTAL = 32;
/*
*/

export function estimarCaracteresPorLinha(largura, tamanhoFonte) {
    const larguraUtil = Math.max(100, largura - MARGEM_HORIZONTAL);
    const larguraMediaCaractere = tamanhoFonte * 0.4;

    return Math.max(
        10,
        Math.floor(larguraUtil / larguraMediaCaractere)
    );
}