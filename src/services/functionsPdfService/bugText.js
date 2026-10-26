
export function bugText(texto) {
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