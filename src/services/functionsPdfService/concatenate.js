import { comecaComMinuscula } from "./services";

export function juntarParagrafosEntrePaginas(paginas) {

  for (let i = 1; i < paginas.length; i++) {
    const paginaAnterior = paginas[i - 1];
    const paginaAtual = paginas[i];

    if (!paginaAnterior?.blocos?.length || !paginaAtual?.blocos?.length) {
      continue;
    }

    const ultimoBloco =
      paginaAnterior.blocos[paginaAnterior.blocos.length - 1];

    const primeiroBloco = paginaAtual.blocos[0];

    const textoInicial = String(primeiroBloco.texto || '').trimStart();

    if (!textoInicial) continue;

    if (comecaComMinuscula(textoInicial)) {
      ultimoBloco.texto =
        `${String(ultimoBloco.texto || '').trimEnd()} ${textoInicial}`;

      // O texto já foi incorporado ao parágrafo anterior.
      paginaAtual.blocos.shift();
    }
  }

  return paginas;
}
