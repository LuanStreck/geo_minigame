// Funções compartilhadas pelos modos de jogo.

/* ---------- DOM ---------- */

// Cria um elemento: el("p", "classe", "texto")
export function el(tag, classe, texto) {
  const e = document.createElement(tag);
  if (classe) e.className = classe;
  if (texto !== undefined) e.textContent = texto;
  return e;
}

/* ---------- Listas e texto ---------- */

export function embaralhar(lista) {
  const copia = [...lista];
  for (let i = copia.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copia[i], copia[j]] = [copia[j], copia[i]];
  }
  return copia;
}

// ["A", "B", "C"] vira "A, B e C"
export function listar(itens) {
  if (itens.length <= 1) return itens.join("");
  return `${itens.slice(0, -1).join(", ")} e ${itens.at(-1)}`;
}

// Para comparar o que a pessoa digitou: tira acentos, pontuação e maiúsculas
// ("São Tomé e Príncipe" e "sao tome e principe" ficam iguais)
export function normalizar(texto) {
  return texto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

// 1234567.8 vira "1.234.568" (e com casas = 1, "1.234.567,8")
export function formatarNumero(numero, casas = 0) {
  return numero.toLocaleString("pt-BR", {
    minimumFractionDigits: casas,
    maximumFractionDigits: casas,
  });
}

/* ---------- Armazenamento (localStorage) ---------- */

export function lerLocal(chave, padrao) {
  try {
    const bruto = localStorage.getItem(chave);
    return bruto === null ? padrao : (JSON.parse(bruto) ?? padrao);
  } catch {
    return padrao; // sem localStorage ou dado corrompido: usa o padrão
  }
}

export function gravarLocal(chave, valor) {
  try {
    localStorage.setItem(chave, JSON.stringify(valor));
  } catch {
    // sem localStorage: o jogo continua, só não guarda o progresso
  }
}

/* ---------- Geografia ---------- */

const RAIO_TERRA_KM = 6371;
const paraRadianos = (graus) => (graus * Math.PI) / 180;

// Distância em km entre dois pontos { lat, lng } (fórmula de Haversine)
export function distanciaKm(a, b) {
  const dLat = paraRadianos(b.lat - a.lat);
  const dLng = paraRadianos(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(paraRadianos(a.lat)) * Math.cos(paraRadianos(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * RAIO_TERRA_KM * Math.asin(Math.sqrt(h));
}

// Rumo inicial para ir de a até b, em graus (0 = norte, 90 = leste, 180 = sul)
export function rumo(a, b) {
  const dLng = paraRadianos(b.lng - a.lng);
  const y = Math.sin(dLng) * Math.cos(paraRadianos(b.lat));
  const x =
    Math.cos(paraRadianos(a.lat)) * Math.sin(paraRadianos(b.lat)) -
    Math.sin(paraRadianos(a.lat)) * Math.cos(paraRadianos(b.lat)) * Math.cos(dLng);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

/* ---------- Animações ---------- */

// Faz uma animação de CSS rodar de novo no mesmo elemento.
// Sem isso, trocar só o texto não repete a animação: o navegador acha que nada mudou.
export function reiniciarAnimacao(elemento, classe) {
  elemento.classList.remove(classe);
  void elemento.offsetWidth; // força o navegador a "esquecer" a animação anterior
  elemento.classList.add(classe);
}

const CORES_CONFETE = ["#f2b632", "#8cc084", "#5b9bd0", "#b7a6e6", "#e07a5f"];

// Solta confete a partir do centro de um elemento (some sozinho em ~2 segundos).
// Quem pediu movimento reduzido no sistema não vê nada.
export function confete(origem, quantidade = 40) {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  const caixa = origem.getBoundingClientRect();
  const x = caixa.left + caixa.width / 2;
  const y = caixa.top + caixa.height / 2;

  const camada = el("div", "confete");
  camada.setAttribute("aria-hidden", "true");

  for (let i = 0; i < quantidade; i++) {
    const peca = el("span", "confete-peca");
    peca.style.left = `${x}px`;
    peca.style.top = `${y}px`;
    peca.style.background = CORES_CONFETE[i % CORES_CONFETE.length];
    // O CSS usa estas variáveis: a peça sobe até "sobe", depois cai até "cai"
    peca.style.setProperty("--dx", `${(Math.random() - 0.5) * 360}px`);
    peca.style.setProperty("--sobe", `${-(60 + Math.random() * 140)}px`);
    peca.style.setProperty("--cai", `${80 + Math.random() * 220}px`);
    peca.style.setProperty("--giro", `${(Math.random() - 0.5) * 900}deg`);
    peca.style.animationDelay = `${Math.random() * 120}ms`;
    camada.append(peca);
  }

  document.body.append(camada);
  setTimeout(() => camada.remove(), 1800);
}

/* ---------- Bandeiras e placar ---------- */

// Bandeira como imagem (os emojis de bandeira não aparecem no Windows).
// Os arquivos vêm de data/flags/, gerados por tools/build_flags.py.
export function bandeira(pais, classe = "") {
  const img = document.createElement("img");
  img.className = `bandeira ${classe}`.trim();
  img.src = `data/flags/${pais.iso2.toLowerCase()}.svg`;
  img.alt = ""; // decorativa: o nome do país sempre aparece em texto ao lado
  img.decoding = "async";
  return img;
}

// Preenche uma estatística do placar: número grande em cima e rótulo embaixo
export function definirEstatistica(elemento, valor, rotulo) {
  elemento.replaceChildren(el("strong", "", String(valor)), el("small", "", rotulo));
}
