/*
  Treino com repetição dos erros, compartilhado pelos modos.

  Cada país tem um "peso" guardado no navegador. Errar aumenta o peso e o país
  volta mais vezes; acertar diminui, e ele aparece cada vez menos. O "modo" é só
  um prefixo para separar o progresso de cada jogo (ex.: "pais-capital", "mapa").
*/

export const PESO_INICIAL = 3;
const PESO_MINIMO = 0.5;
const PESO_MAXIMO = 12;
export const LIMITE_APRENDIDO = 1; // peso até este valor conta como "aprendido"

export function chave(modo, pais) {
  return `${modo}:${pais.id}`;
}

function novoPeso(peso, acertou) {
  return acertou
    ? Math.max(PESO_MINIMO, peso * 0.6)
    : Math.min(PESO_MAXIMO, peso * 2 + 1);
}

// Atualiza o progresso de um país depois de uma resposta (altera o objeto "progresso")
export function registrarResposta(progresso, modo, pais, acertou) {
  const k = chave(modo, pais);
  const atual = progresso[k] ?? { peso: PESO_INICIAL, acertos: 0, erros: 0 };
  progresso[k] = {
    peso: novoPeso(atual.peso, acertou),
    acertos: atual.acertos + (acertou ? 1 : 0),
    erros: atual.erros + (acertou ? 0 : 1),
  };
}

// Sorteio ponderado: quanto maior o peso, maior a chance de sair.
// "ultimos" são ids que acabaram de sair e não devem repetir em seguida.
export function sortearPais(pool, progresso, modo, ultimos) {
  const candidatos = pool.filter((p) => !ultimos.includes(p.id));
  const lista = candidatos.length > 0 ? candidatos : pool;

  const pesos = lista.map((p) => progresso[chave(modo, p)]?.peso ?? PESO_INICIAL);
  let sorteio = Math.random() * pesos.reduce((soma, peso) => soma + peso, 0);

  for (let i = 0; i < lista.length; i++) {
    sorteio -= pesos[i];
    if (sorteio <= 0) return lista[i];
  }
  return lista.at(-1);
}

// Quantos países do "pool" já foram aprendidos e quanto falta (de 0 a 100).
// Cada país vale de 0 (nunca acertado) a 1 (aprendido), então a porcentagem
// anda a cada acerto, e não só quando um país vira "aprendido".
export function resumoDominio(pool, progresso, modo) {
  let aprendidos = 0;
  let dominio = 0;
  for (const p of pool) {
    const peso = progresso[chave(modo, p)]?.peso ?? PESO_INICIAL;
    if (peso <= LIMITE_APRENDIDO) aprendidos += 1;
    const parte = (PESO_INICIAL - peso) / (PESO_INICIAL - LIMITE_APRENDIDO);
    dominio += Math.min(1, Math.max(0, parte));
  }
  return { aprendidos, porcentagem: pool.length ? (dominio / pool.length) * 100 : 0 };
}
