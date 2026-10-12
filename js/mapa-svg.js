/*
  Mapa-múndi em SVG, com zoom, arrastar e "emenda" nas laterais (dá para girar o
  mundo sem corte no Pacífico).

  Como funciona: o mapa inteiro é desenhado duas vezes, lado a lado. O que a pessoa
  vê é uma janela (o "viewBox" do SVG) que se move e muda de tamanho. Quando a janela
  passa da borda direita, ela volta ao começo, e como as duas cópias são iguais,
  ninguém percebe.

  Quem usa recebe um controle com: marcar(id, classe), limparMarcas(), focarPais(id),
  focarVista(nome), focarPonto(id, largura), enquadrar(caixa) e destruir().
*/

import { el } from "./utils.js";

const NS = "http://www.w3.org/2000/svg";
const LARGURA_MIN = 100; // zoom máximo: a janela nunca fica mais estreita que isto (unidades do mapa)
const RAIO_PONTO_PX = 4.5; // tamanho do ponto que marca os países pequenos, em pixels de tela
const LIMITE_CLIQUE_PX = 6; // arrastou menos que isto = foi um clique

function svgEl(tag, atributos = {}) {
  const e = document.createElementNS(NS, tag);
  for (const [nome, valor] of Object.entries(atributos)) e.setAttribute(nome, valor);
  return e;
}

function limitar(valor, min, max) {
  return Math.min(Math.max(valor, min), max);
}

export function criarMapa(container, dados, aoClicar) {
  const L = dados.largura;
  const A = dados.altura;
  const movimentoReduzido = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------- Desenho ---------- */

  const raiz = el("div", "mapa");
  const svg = svgEl("svg", {
    class: "mapa-svg",
    tabindex: "0",
    role: "application",
    "aria-label": "Mapa-múndi. Arraste para mover; roda do mouse, gesto de pinça ou teclas + e − para o zoom.",
  });

  const copia = svgEl("g", { class: "mapa-copia" });
  const paisesGrupo = svgEl("g");
  const pontosGrupo = svgEl("g");
  copia.append(svgEl("path", { class: "fundo", d: dados.fundo }), paisesGrupo, pontosGrupo);

  for (const [id, info] of Object.entries(dados.paises)) {
    if (info.d) paisesGrupo.append(svgEl("path", { class: "pais", "data-id": id, d: info.d }));
  }
  // Países pequenos ganham um ponto (desenhado por cima) para dar para clicar neles
  for (const [id, info] of Object.entries(dados.paises)) {
    if (info.ponto) {
      pontosGrupo.append(
        svgEl("circle", { class: "ponto", "data-id": id, cx: info.centro[0], cy: info.centro[1], r: 5 })
      );
    }
  }

  const copia2 = copia.cloneNode(true);
  copia2.setAttribute("transform", `translate(${L} 0)`);
  svg.append(copia, copia2);

  const botoes = el("div", "mapa-controles");
  const criarBotao = (texto, rotulo, aoPressionar) => {
    const b = el("button", "mapa-botao", texto);
    b.type = "button";
    b.setAttribute("aria-label", rotulo);
    b.addEventListener("click", aoPressionar);
    return b;
  };

  raiz.append(svg, botoes);
  container.replaceChildren(raiz);
  const circulos = [...svg.querySelectorAll(".ponto")];

  /* ---------- A janela (viewBox) ---------- */

  const v = { x: 0, y: 0, w: L, h: A };
  let animacao = null;

  function aspecto() {
    const r = svg.getBoundingClientRect();
    return r.width > 0 && r.height > 0 ? r.width / r.height : 2;
  }

  function aplicar() {
    v.w = limitar(v.w, LARGURA_MIN, L);
    v.h = v.w / aspecto();
    v.y = v.h >= A ? (A - v.h) / 2 : limitar(v.y, 0, A - v.h); // se sobra espaço, centraliza
    v.x = ((v.x % L) + L) % L; // dá a volta no mundo

    svg.setAttribute("viewBox", `${v.x} ${v.y} ${v.w} ${v.h}`);
    copia2.style.display = v.x + v.w > L ? "" : "none"; // só desenha a segunda cópia se ela aparece

    // Os pontos têm tamanho fixo em pixels: convertemos para unidades do mapa
    const largura = svg.getBoundingClientRect().width || 1;
    const raio = (RAIO_PONTO_PX * v.w) / largura;
    for (const c of circulos) c.setAttribute("r", raio);
  }

  function cancelarAnimacao() {
    if (animacao !== null) cancelAnimationFrame(animacao);
    animacao = null;
  }

  // Move a janela até o centro (cx, cy) com largura w, com uma animação suave
  function irPara({ cx, cy, w }, duracao = 700) {
    cancelarAnimacao();
    w = limitar(w, LARGURA_MIN, L);

    // Escolhe a cópia do mundo mais próxima, para girar pelo caminho mais curto
    const cxAtual = v.x + v.w / 2;
    cx += Math.round((cxAtual - cx) / L) * L;

    if (duracao === 0 || movimentoReduzido()) {
      v.w = w;
      v.h = w / aspecto();
      v.x = cx - w / 2;
      v.y = cy - v.h / 2;
      aplicar();
      return;
    }

    const inicio = { cx: cxAtual, cy: v.y + v.h / 2, w: v.w };
    const t0 = performance.now();
    const passo = (agora) => {
      const t = Math.min(1, (agora - t0) / duracao);
      const suave = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

      v.w = inicio.w * Math.pow(w / inicio.w, suave); // o zoom cresce de forma proporcional
      v.h = v.w / aspecto();
      v.x = inicio.cx + (cx - inicio.cx) * suave - v.w / 2;
      v.y = inicio.cy + (cy - inicio.cy) * suave - v.h / 2;
      aplicar();

      animacao = t < 1 ? requestAnimationFrame(passo) : null;
    };
    animacao = requestAnimationFrame(passo);
  }

  // Zoom mantendo o ponto sob o cursor no mesmo lugar
  function zoomEm(clienteX, clienteY, fator) {
    const r = svg.getBoundingClientRect();
    const fx = (clienteX - r.left) / r.width;
    const fy = (clienteY - r.top) / r.height;
    const px = v.x + fx * v.w;
    const py = v.y + fy * v.h;

    const novaLargura = limitar(v.w * fator, LARGURA_MIN, L);
    const novaAltura = novaLargura / aspecto();
    v.x = px - fx * novaLargura;
    v.y = py - fy * novaAltura;
    v.w = novaLargura;
    aplicar();
  }

  function moverPx(dx, dy) {
    const r = svg.getBoundingClientRect();
    v.x -= (dx / r.width) * v.w;
    v.y -= (dy / r.height) * v.h;
    aplicar();
  }

  function zoomBotao(fator) {
    irPara({ cx: v.x + v.w / 2, cy: v.y + v.h / 2, w: v.w * fator }, 250);
  }

  /* ---------- Enquadramentos ---------- */

  // Enquadra uma caixa [x0, y0, x1, y1] (unidades do mapa)
  function enquadrar(caixa, { margem = 1.15, larguraMin = 0, animar = true } = {}) {
    const bw = caixa[2] - caixa[0];
    const bh = caixa[3] - caixa[1];
    const w = Math.max(bw * margem, bh * margem * aspecto(), larguraMin);
    irPara({ cx: (caixa[0] + caixa[2]) / 2, cy: (caixa[1] + caixa[3]) / 2, w }, animar ? 700 : 0);
  }

  // Mostra o país com folga ao redor (e uma largura mínima, para os pequenos aparecerem com contexto)
  function focarPais(id, opcoes = {}) {
    enquadrar(dados.paises[id].caixa, { margem: 2.2, larguraMin: 500, ...opcoes });
  }

  function focarVista(nome, opcoes = {}) {
    enquadrar(dados.vistas[nome], { margem: 1.04, ...opcoes });
  }

  // Centraliza no país com uma largura fixa de janela (usado nas dicas)
  function focarPonto(id, largura, { animar = true } = {}) {
    const [cx, cy] = dados.paises[id].centro;
    irPara({ cx, cy, w: largura }, animar ? 700 : 0);
  }

  /* ---------- Marcações ---------- */

  function marcar(id, ...classes) {
    for (const e of svg.querySelectorAll(`[data-id="${id}"]`)) e.classList.add(...classes);
  }

  function limparMarcas() {
    for (const e of svg.querySelectorAll(".pais--certo, .pais--errado, .pais--alvo")) {
      e.classList.remove("pais--certo", "pais--errado", "pais--alvo");
    }
  }

  /* ---------- Mouse, toque e teclado ---------- */

  const ponteiros = new Map(); // dedos / mouse apoiados agora
  let arrasto = null; // { x, y, moveu } do primeiro ponteiro
  let distanciaPinca = 0;

  const distanciaEntrePonteiros = () => {
    const [a, b] = [...ponteiros.values()];
    return Math.hypot(a.x - b.x, a.y - b.y);
  };

  svg.addEventListener("pointerdown", (e) => {
    cancelarAnimacao();
    try {
      svg.setPointerCapture(e.pointerId);
    } catch {
      // alguns navegadores recusam a captura; o arrasto continua funcionando dentro do mapa
    }
    ponteiros.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (ponteiros.size === 1) {
      arrasto = { x: e.clientX, y: e.clientY, moveu: false };
    } else if (ponteiros.size === 2) {
      if (arrasto) arrasto.moveu = true; // com dois dedos não é clique
      distanciaPinca = distanciaEntrePonteiros();
    }
  });

  svg.addEventListener("pointermove", (e) => {
    const anterior = ponteiros.get(e.pointerId);
    if (!anterior) return;
    ponteiros.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (ponteiros.size >= 2) {
      // Pinça: afastar os dedos aproxima o mapa
      const [a, b] = [...ponteiros.values()];
      const nova = distanciaEntrePonteiros();
      if (distanciaPinca > 0 && nova > 0) zoomEm((a.x + b.x) / 2, (a.y + b.y) / 2, distanciaPinca / nova);
      distanciaPinca = nova;
    } else if (arrasto) {
      if (!arrasto.moveu && Math.hypot(e.clientX - arrasto.x, e.clientY - arrasto.y) > LIMITE_CLIQUE_PX) {
        arrasto.moveu = true;
        svg.classList.add("arrastando");
      }
      if (arrasto.moveu) moverPx(e.clientX - anterior.x, e.clientY - anterior.y);
    }
  });

  function soltar(e, cancelado) {
    const eraUnico = ponteiros.size === 1;
    ponteiros.delete(e.pointerId);

    if (eraUnico && arrasto && !arrasto.moveu && !cancelado) {
      // Foi um clique: descobre qual país está sob o dedo
      const alvo = document.elementFromPoint(e.clientX, e.clientY)?.closest?.("[data-id]");
      aoClicar(alvo ? alvo.getAttribute("data-id") : null);
    }
    if (ponteiros.size === 0) {
      arrasto = null;
      svg.classList.remove("arrastando");
    }
    distanciaPinca = ponteiros.size === 2 ? distanciaEntrePonteiros() : 0;
  }
  svg.addEventListener("pointerup", (e) => soltar(e, false));
  svg.addEventListener("pointercancel", (e) => soltar(e, true));

  svg.addEventListener(
    "wheel",
    (e) => {
      e.preventDefault();
      cancelarAnimacao();
      zoomEm(e.clientX, e.clientY, Math.exp(e.deltaY * 0.0015));
    },
    { passive: false }
  );

  svg.addEventListener("keydown", (e) => {
    const passo = { ArrowLeft: [1, 0], ArrowRight: [-1, 0], ArrowUp: [0, 1], ArrowDown: [0, -1] }[e.key];
    if (passo) {
      const r = svg.getBoundingClientRect();
      moverPx(passo[0] * r.width * 0.1, passo[1] * r.height * 0.1);
    } else if (e.key === "+" || e.key === "=") {
      zoomBotao(0.7);
    } else if (e.key === "-" || e.key === "_") {
      zoomBotao(1 / 0.7);
    } else if (e.key === "0") {
      focarVista("todas");
    } else {
      return;
    }
    e.preventDefault();
  });

  botoes.append(
    criarBotao("+", "Aproximar", () => zoomBotao(0.6)),
    criarBotao("−", "Afastar", () => zoomBotao(1 / 0.6)),
    criarBotao("Mundo", "Ver o mundo inteiro", () => focarVista("todas"))
  );

  // Se o tamanho da caixa do mapa mudar (girar o celular, redimensionar), mantém o centro
  const observador = new ResizeObserver(() => {
    const cx = v.x + v.w / 2;
    const cy = v.y + v.h / 2;
    v.h = v.w / aspecto();
    v.x = cx - v.w / 2;
    v.y = cy - v.h / 2;
    aplicar();
  });
  observador.observe(svg);

  aplicar();

  return {
    marcar,
    limparMarcas,
    enquadrar,
    focarPais,
    focarVista,
    focarPonto,
    destruir() {
      cancelarAnimacao();
      observador.disconnect();
    },
  };
}
