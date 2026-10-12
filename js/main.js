import { carregarPaises, carregarMapa } from "./data.js";
import { ICONES } from "./icones.js";

/*
  Lista de modos do jogo. Para adicionar um modo novo:
    1. crie js/modes/<id>.js com:
         export default {
           iniciar(container, paises) { ... }   // desenha o jogo dentro de "container"
         };
       (se precisar limpar algo ao sair do modo, devolva uma função de limpeza)
    2. acrescente o modo aqui embaixo (e um ícone em js/icones.js, se quiser um novo).
*/
const MODOS = [
  {
    id: "capitais",
    titulo: "Capitais",
    descricao: "Descubra a capital de cada país e o país de cada capital.",
    disponivel: true,
  },
  {
    id: "atributos",
    titulo: "Adivinhe o país",
    descricao: "Reconheça o país pelo formato e descubra o secreto com pistas de região, distância e área.",
    disponivel: true,
  },
  {
    id: "mapa",
    titulo: "Mapa",
    descricao: "Ache o país no mapa, pelo nome ou pela capital, com zoom, dicas e treino dos que você erra.",
    disponivel: true,
  },
  {
    id: "bandeiras",
    titulo: "Bandeiras",
    descricao: "Reconheça a bandeira de cada país, e escolha a bandeira certa de cada um.",
    disponivel: true,
  },
];

const NS = "http://www.w3.org/2000/svg";
const app = document.getElementById("app");

let paises = [];
let encerrarModo = null; // função de limpeza do modo aberto, se houver
let navegacao = 0; // contador para ignorar navegações antigas que terminam depois

/* ---------- Telas ---------- */

function criarTile(modo, indice) {
  const conteudo = `
    <span class="tile-icone">${ICONES[modo.id]}</span>
    <h2>${modo.titulo}</h2>
    <p>${modo.descricao}</p>
    <span class="estado">${modo.disponivel ? "Jogar" : "Em breve"}</span>`;

  if (modo.disponivel) {
    return `<a class="tile tile--${modo.id}" style="--i:${indice}" href="#/${modo.id}">${conteudo}</a>`;
  }
  return `<div class="tile tile--${modo.id} tile--em-breve" style="--i:${indice}" aria-disabled="true">${conteudo}</div>`;
}

// O mapa-múndi enfeita o fundo do topo do menu. Carrega por último: se falhar, o menu continua igual.
function desenharMundoDeFundo(dados) {
  const hero = app.querySelector(".hero");
  if (!hero || hero.querySelector(".hero-mundo")) return; // o menu já foi fechado, ou já tem o mundo

  const svg = document.createElementNS(NS, "svg");
  svg.setAttribute("class", "hero-mundo");
  svg.setAttribute("viewBox", `0 0 ${dados.largura} ${dados.altura}`);
  svg.setAttribute("aria-hidden", "true");

  const caminho = document.createElementNS(NS, "path");
  caminho.setAttribute("d", dados.fundo + Object.values(dados.paises).map((p) => p.d).join(""));
  svg.append(caminho);
  hero.prepend(svg);
}

function mostrarMenu() {
  app.innerHTML = `
    <section class="menu">
      <div class="hero">
        <h1>Descubra o mundo, um país de cada vez</h1>
        <p class="intro">${paises.length} países para conhecer pelo mapa, pelo formato, pelas bandeiras e pelas capitais.</p>
      </div>
      <div class="tiles">${MODOS.map((modo, i) => criarTile(modo, i)).join("")}</div>
    </section>`;

  carregarMapa().then(desenharMundoDeFundo).catch(() => {});
}

function mostrarErro(texto, erro) {
  console.error(erro);
  app.innerHTML = `
    <div class="mensagem mensagem--erro">
      <p><strong>${texto}</strong></p>
      <p>${erro.message}</p>
      <p>Se você abriu o <code>index.html</code> direto do arquivo, inicie um servidor local
      na pasta do projeto com <code>python -m http.server</code> e acesse
      <code>http://localhost:8000</code>.</p>
    </div>`;
}

async function abrirModo(modo, minhaNavegacao) {
  app.innerHTML = `
    <section class="modo" data-modo="${modo.id}">
      <a class="voltar" href="#/">${ICONES.voltar}<span>Menu</span></a>
      <header class="modo-cabecalho">
        <span class="modo-icone">${ICONES[modo.id]}</span>
        <div>
          <h1>${modo.titulo}</h1>
          <p>${modo.descricao}</p>
        </div>
      </header>
      <div id="area-jogo"></div>
    </section>`;

  try {
    // Carrega só o arquivo do modo escolhido (js/modes/<id>.js)
    const modulo = await import(`./modes/${modo.id}.js`);
    if (minhaNavegacao !== navegacao) return; // a pessoa já saiu desta tela

    const limpeza = modulo.default.iniciar(document.getElementById("area-jogo"), paises);
    encerrarModo = typeof limpeza === "function" ? limpeza : null;
  } catch (erro) {
    if (minhaNavegacao !== navegacao) return;
    mostrarErro(`Não foi possível abrir o modo ${modo.titulo}.`, erro);
  }
}

/* ---------- Navegação ---------- */
// O endereço manda na tela: "#/" é o menu e "#/capitais" é o modo de capitais.
// Assim o botão voltar do navegador e o F5 funcionam sem código extra.

async function rotear() {
  const minhaNavegacao = ++navegacao;

  if (encerrarModo) {
    encerrarModo();
    encerrarModo = null;
  }

  const id = location.hash.replace(/^#\//, "");
  const modo = MODOS.find((m) => m.id === id && m.disponivel);

  if (modo) {
    await abrirModo(modo, minhaNavegacao);
  } else {
    mostrarMenu();
  }
}

/* ---------- Início ---------- */

async function iniciar() {
  try {
    paises = await carregarPaises();
  } catch (erro) {
    mostrarErro("Não foi possível carregar os países.", erro);
    return;
  }

  window.addEventListener("hashchange", rotear);
  rotear();
}

iniciar();
