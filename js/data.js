// Carrega o countries.json uma única vez e reaproveita nas próximas chamadas.

let cache = null;

export async function carregarPaises() {
  if (cache) return cache;

  const resposta = await fetch("data/countries.json");
  if (!resposta.ok) {
    throw new Error(`Falha ao carregar data/countries.json (HTTP ${resposta.status}).`);
  }

  cache = await resposta.json();
  return cache;
}

// Desenho dos países (gerado por tools/build_map.py), usado pelos modos de mapa.
let cacheMapa = null;

export async function carregarMapa() {
  if (cacheMapa) return cacheMapa;

  const resposta = await fetch("data/map.json");
  if (!resposta.ok) {
    throw new Error(`Falha ao carregar data/map.json (HTTP ${resposta.status}).`);
  }

  cacheMapa = await resposta.json();
  return cacheMapa;
}

// Formato (silhueta) de cada país (gerado por tools/build_map.py), usado no modo "Adivinhe o país".
let cacheSilhuetas = null;

export async function carregarSilhuetas() {
  if (cacheSilhuetas) return cacheSilhuetas;

  const resposta = await fetch("data/silhuetas.json");
  if (!resposta.ok) {
    throw new Error(`Falha ao carregar data/silhuetas.json (HTTP ${resposta.status}).`);
  }

  cacheSilhuetas = await resposta.json();
  return cacheSilhuetas;
}
