import { listarVersoesPaginadas } from "../functionsBookStorage/searchPages";
import { gerarVersoesPaginadas } from "../functionsPaginationService.js/makePageVersions";
import { salvarVersaoPaginada } from "../functionsBookStorage/savePages";
const TAMANHOS_FONTE = [19, 21, 24];



export async function gerarEGuardarVersoes(
  livroId,
  paginas,
  dimensoesLeitura
) {
  if (
    !Number.isFinite(dimensoesLeitura?.largura) ||
    !Number.isFinite(dimensoesLeitura?.altura) ||
    dimensoesLeitura.largura <= 0 ||
    dimensoesLeitura.altura <= 0
  ) {
    return;
  }

  const versoesExistentes = await listarVersoesPaginadas(livroId);

  const versoesCompativeis = versoesExistentes.filter(
    (versao) =>
      versao.dimensoes?.largura === dimensoesLeitura.largura &&
      versao.dimensoes?.altura === dimensoesLeitura.altura &&
      TAMANHOS_FONTE.includes(versao.tamanhoFonte)
  );

  const faltamVersoes = TAMANHOS_FONTE.some(
    (tamanho) =>
      !versoesCompativeis.some(
        (versao) => versao.tamanhoFonte === tamanho
      )
  );

  if (!faltamVersoes) return;

  const versoes = gerarVersoesPaginadas(
    paginas,
    dimensoesLeitura.largura,
    dimensoesLeitura.altura
  );

  console.log('Livro ID:', livroId);
console.log('Versões geradas:', versoes);
console.log('Dimensões de leitura:', dimensoesLeitura);

  await Promise.all(
    versoes.map((versao) =>
      salvarVersaoPaginada(
        livroId,
        versao.tamanhoFonte,
        versao.paginas,
        versao.dimensoes
      )
    )
  );
}
