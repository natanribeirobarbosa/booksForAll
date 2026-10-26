
// Divide o texto em linhas sem cortar palavras.
export function dividirEmLinhas(texto, limite) {
    const palavras = String(texto || '').split(/\s+/).filter(Boolean);
    const linhas = [];
    let linha = '';

    for (const palavra of palavras) {
        if (!linha) {
            linha = palavra;
            continue;
        }

        if (`${linha} ${palavra}`.length <= limite) {
            linha += ` ${palavra}`;
        } else {
            linhas.push(linha);
            linha = palavra;
        }

        // Trata palavras muito longas, como URLs.
        while (linha.length > limite) {
            linhas.push(linha.slice(0, limite));
            linha = linha.slice(limite);
        }
    }

    if (linha) linhas.push(linha);

    return linhas;
}
