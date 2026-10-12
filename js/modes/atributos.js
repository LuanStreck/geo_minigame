/*
  Modo "Adivinhe o país": existe um país secreto, e o formato dele aparece em destaque.
  Se você reconhece o formato, acerta de primeira. Se não, chute países: cada chute mostra
  pistas comparando o seu chute com o secreto (✓ quer dizer "o secreto também é assim",
  ✗ quer dizer "o secreto não é") e a direção aponta de onde você chutou para o secreto.

  Para aprender, o jogo revela a capital do secreto depois de alguns chutes e, no fim,
  mostra uma ficha do país. O interruptor "Mostrar o formato" liga e desliga a silhueta
  (desligada, o jogo fica bem mais difícil).
*/

import {
  el,
  listar,
  lerLocal,
  gravarLocal,
  normalizar,
  formatarNumero,
  distanciaKm,
  rumo,
  reiniciarAnimacao,
  confete,
  bandeira,
  definirEstatistica,
} from "../utils.js";
import { REGIOES_PT, SUBREGIOES_PT } from "../nomes.js";
import { carregarSilhuetas } from "../data.js";

const CHAVE = "geo-game:atributos:v1";
const NS = "http://www.w3.org/2000/svg";

// Depois de quantos chutes cada dica aparece
const DICA_CAPITAL = 5;
const DICA_LETRA = 8;

// Índice = rumo arredondado para múltiplos de 45° (0 = norte, 1 = nordeste, ...)
const DIRECOES = [
  { nome: "Norte", seta: "↑" },
  { nome: "Nordeste", seta: "↗" },
  { nome: "Leste", seta: "→" },
  { nome: "Sudeste", seta: "↘" },
  { nome: "Sul", seta: "↓" },
  { nome: "Sudoeste", seta: "↙" },
  { nome: "Oeste", seta: "←" },
  { nome: "Noroeste", seta: "↖" },
];

/* ---------- Comparação entre o chute e o país secreto ---------- */

function chipCombina(rotulo, valor, combina) {
  return { rotulo, valor, status: combina ? "certo" : "errado", marca: combina ? "✓" : "✗" };
}

function formatarVezes(razao) {
  if (razao < 10) return `${formatarNumero(razao, 1)}×`;
  if (razao < 1000) return `${formatarNumero(Math.round(razao))}×`;
  return "mais de 1.000×";
}

export function formatarArea(km2) {
  return km2 < 10 ? formatarNumero(km2, 2) : formatarNumero(Math.round(km2));
}

// Devolve a lista de pistas de um chute. Exportada para poder ser testada.
export function compararChute(chute, secreto) {
  const chips = [];

  chips.push(chipCombina("Região", REGIOES_PT[chute.regiao] ?? chute.regiao, chute.regiao === secreto.regiao));
  chips.push(
    chipCombina(
      "Sub-região",
      SUBREGIOES_PT[chute.subregiao] ?? chute.subregiao,
      chute.subregiao === secreto.subregiao
    )
  );

  // Distância entre os centros dos países, e para onde fica o secreto
  const km = distanciaKm(chute, secreto);
  const direcao = DIRECOES[Math.round(rumo(chute, secreto) / 45) % 8];
  const faixa = km < 1500 ? "perto" : km < 5000 ? "medio" : "longe";
  // Proximidade como no Worldle: 100% = mesmo lugar, 0% = lado oposto do planeta
  const proximidade = Math.max(0, Math.min(100, Math.round((1 - km / 20000) * 100)));

  chips.push({
    rotulo: "Distância",
    valor: `${formatarNumero(Math.max(10, Math.round(km / 10) * 10))} km`,
    status: faixa,
    marca: "",
  });
  chips.push({ rotulo: "Proximidade", valor: `${proximidade}%`, status: faixa, marca: "" });
  chips.push({ rotulo: "Direção", valor: `${direcao.seta} ${direcao.nome}`, status: faixa, marca: "" });

  // Área: o que importa é se o secreto é maior ou menor que o chute
  const razao = secreto.area / chute.area;
  if (razao >= 0.8 && razao <= 1.25) {
    chips.push({ rotulo: "Área", valor: "Parecida com a do secreto", status: "parcial", marca: "≈" });
  } else if (razao > 1.25) {
    chips.push({ rotulo: "Área", valor: `O secreto é ${formatarVezes(razao)} maior`, status: "errado", marca: "▲" });
  } else {
    chips.push({ rotulo: "Área", valor: `O secreto é ${formatarVezes(1 / razao)} menor`, status: "errado", marca: "▼" });
  }

  const fazFronteira = chute.fronteiras.includes(secreto.id);
  chips.push(chipCombina("Fronteira", fazFronteira ? "Faz fronteira" : "Não faz fronteira", fazFronteira));

  chips.push(
    chipCombina(
      "Litoral",
      chute.semSaidaParaOMar ? "Sem litoral" : "Com litoral",
      chute.semSaidaParaOMar === secreto.semSaidaParaOMar
    )
  );

  const idiomaComum = chute.idiomas.some((i) => secreto.idiomas.includes(i));
  chips.push(chipCombina("Idioma", idiomaComum ? "Idioma em comum" : "Sem idioma em comum", idiomaComum));

  return chips;
}

/* ---------- O modo ---------- */

export default {
  iniciar(container, paises) {
    let ativo = true; // vira false ao sair do modo (os formatos podem ainda estar carregando)

    container.replaceChildren(el("p", "mensagem", "Carregando os formatos…"));

    carregarSilhuetas()
      .then((silhuetas) => {
        if (ativo) montar(silhuetas);
      })
      .catch((erro) => {
        if (!ativo) return;
        console.error(erro);
        container.replaceChildren(el("p", "mensagem mensagem--erro", `Não foi possível carregar os formatos: ${erro.message}`));
      });

    function montar(silhuetas) {
      const porId = new Map(paises.map((p) => [p.id, p]));
      const nomesOrdenados = [...paises].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));

      // Aceita o nome em português ou em inglês, sem se importar com acentos e maiúsculas
      const indiceNomes = new Map();
      for (const p of paises) {
        indiceNomes.set(normalizar(p.nome), p);
        indiceNomes.set(normalizar(p.nomeEn), p);
      }

      function encontrarPais(texto) {
        const busca = normalizar(texto);
        if (!busca) return null;
        if (indiceNomes.has(busca)) return indiceNomes.get(busca);

        // Se o começo do que foi digitado só combina com um país, aceita
        const candidatos = paises.filter((p) => normalizar(p.nome).startsWith(busca));
        return candidatos.length === 1 ? candidatos[0] : null;
      }

      const stats = { jogos: 0, vitorias: 0, melhor: null, formato: true, ...lerLocal(CHAVE, {}) };
      let segredo = null;
      let palpites = [];
      let terminou = false;
      let venceu = false;
      let ultimoSegredoId = null;

      container.innerHTML = `
        <div class="adv">
          <div class="silhueta" data-ref="palco">
            <svg class="silhueta-svg" data-ref="silhueta" role="img" aria-label="Formato do país secreto"></svg>
            <span class="silhueta-oculta" data-ref="oculta" aria-hidden="true">?</span>
            <label class="chave">
              <input type="checkbox" data-ref="formato">
              <span class="chave-trilho" aria-hidden="true"></span>
              <span>Mostrar o formato</span>
            </label>
          </div>

          <p class="adv-instrucao">
            Que país tem esse formato? Chute abaixo: cada chute mostra pistas, onde
            <strong>✓</strong> quer dizer que o secreto também é assim e <strong>✗</strong> que não é.
            A direção aponta de onde você chutou para onde está o secreto.
          </p>

          <div class="quiz-placar">
            <span class="stat" data-ref="vitorias"></span>
            <span class="stat" data-ref="melhor"></span>
          </div>

          <form class="adv-form" data-ref="form" autocomplete="off">
            <label class="visualmente-oculto" for="adv-entrada">Nome do país</label>
            <input id="adv-entrada" data-ref="entrada" list="adv-paises" type="text"
                   placeholder="Digite o nome de um país" autocapitalize="off" spellcheck="false">
            <datalist id="adv-paises">
              ${nomesOrdenados.map((p) => `<option value="${p.nome}"></option>`).join("")}
            </datalist>
            <button type="submit" class="botao" data-ref="chutar">Chutar</button>
          </form>

          <p class="adv-aviso" data-ref="aviso" aria-live="polite"></p>
          <p class="adv-contador" data-ref="contador"></p>
          <div class="adv-dicas" data-ref="dicas"></div>

          <ol class="adv-chutes" data-ref="chutes"></ol>
          <div data-ref="final"></div>

          <div class="quiz-rodape">
            <button type="button" class="botao" data-ref="novo" hidden>Novo jogo</button>
            <button type="button" class="botao-texto" data-ref="desistir">Desistir e ver a resposta</button>
          </div>
        </div>`;

      const ref = (nome) => container.querySelector(`[data-ref="${nome}"]`);

      /* ----- O palco do formato ----- */

      function desenharSilhueta() {
        const s = silhuetas[segredo.id];
        const margem = s.g;
        const svg = ref("silhueta");

        const caminho = document.createElementNS(NS, "path");
        caminho.setAttribute("d", s.d);
        caminho.setAttribute("stroke-width", String(s.g)); // contorno mais grosso nos países de ilhotas
        svg.replaceChildren(caminho);
        svg.setAttribute("viewBox", `${-margem} ${-margem} ${s.w + 2 * margem} ${s.h + 2 * margem}`);
        reiniciarAnimacao(svg, "anima-surgir");
      }

      function atualizarPalco() {
        const palco = ref("palco");
        palco.classList.toggle("silhueta--oculta", !stats.formato && !terminou);
        palco.classList.toggle("silhueta--certa", terminou && venceu);
        palco.classList.toggle("silhueta--revelada", terminou && !venceu);
        ref("silhueta").setAttribute(
          "aria-label",
          terminou ? `Formato de ${segredo.nome}` : "Formato do país secreto"
        );
      }

      function atualizarPlacar() {
        definirEstatistica(ref("vitorias"), `${stats.vitorias}/${stats.jogos}`, "vitórias");
        definirEstatistica(ref("melhor"), stats.melhor ?? "–", "melhor (chutes)");
      }

      function atualizarContador() {
        const n = palpites.length;
        ref("contador").textContent = n === 0 ? "Faça o seu primeiro chute." : `Chutes: ${n}`;
      }

      function atualizarDicas() {
        const n = palpites.length;
        const dicas = [];
        if (n >= DICA_CAPITAL) dicas.push(`Dica: a capital do país secreto é ${segredo.capitais[0]}.`);
        if (n >= DICA_LETRA) dicas.push(`Dica: o nome do país começa com “${segredo.nome[0]}”.`);

        // Só acrescenta as dicas novas, para as antigas não animarem de novo
        const area = ref("dicas");
        for (const texto of dicas.slice(area.children.length)) {
          area.append(el("p", "mensagem", texto));
        }
      }

      function criarCartao(numero, chute) {
        const cartao = el("li", "adv-chute");
        const titulo = el("p", "adv-chute-titulo");
        titulo.append(
          el("span", "adv-chute-n", String(numero)),
          bandeira(chute, "bandeira--titulo"),
          el("span", "", chute.nome)
        );
        cartao.append(titulo);

        if (chute.id === segredo.id) {
          cartao.classList.add("adv-chute--certo");
          cartao.append(el("p", "adv-acertou", "É este! ✓"));
          return cartao;
        }

        const lista = el("ul", "adv-chips");
        for (const [indice, pista] of compararChute(chute, segredo).entries()) {
          const chip = el("li", `chip chip--${pista.status}`);
          chip.style.setProperty("--i", String(indice)); // cada pista "vira" um pouco depois da anterior
          chip.append(el("span", "chip-rotulo", pista.rotulo), el("span", "chip-valor", pista.valor));
          if (pista.marca) chip.append(el("span", "chip-marca", pista.marca));
          lista.append(chip);
        }
        cartao.append(lista);
        return cartao;
      }

      function mostrarFicha() {
        const n = palpites.length;
        const painel = el("div", `adv-final ${venceu ? "adv-final--venceu" : "adv-final--perdeu"}`);

        const nome = el("p", "adv-final-nome");
        nome.append(bandeira(segredo, "bandeira--titulo"), ` ${segredo.nome}`);
        painel.append(
          el("h3", "adv-final-titulo", venceu ? `Acertou em ${n} ${n === 1 ? "chute" : "chutes"}!` : "O país secreto era…"),
          nome
        );

        const vizinhos = segredo.fronteiras.map((id) => porId.get(id)?.nome).filter(Boolean);
        const ficha = el("dl", "adv-ficha");
        const linhas = [
          [segredo.capitais.length > 1 ? "Capitais" : "Capital", listar(segredo.capitais)],
          [
            "Região",
            `${REGIOES_PT[segredo.regiao] ?? segredo.regiao}, ${SUBREGIOES_PT[segredo.subregiao] ?? segredo.subregiao}`,
          ],
          ["Área", `${formatarArea(segredo.area)} km²`],
          ["Fronteiras", vizinhos.length > 0 ? listar(vizinhos) : "nenhuma por terra"],
        ];
        for (const [rotulo, valor] of linhas) {
          ficha.append(el("dt", "", rotulo), el("dd", "", valor));
        }
        painel.append(ficha);
        ref("final").replaceChildren(painel);
      }

      function terminar(acertou) {
        terminou = true;
        venceu = acertou;

        stats.jogos += 1;
        if (venceu) {
          stats.vitorias += 1;
          stats.melhor = stats.melhor === null ? palpites.length : Math.min(stats.melhor, palpites.length);
        }
        gravarLocal(CHAVE, stats);

        ref("entrada").disabled = true;
        ref("chutar").disabled = true;
        ref("desistir").hidden = true;
        ref("novo").hidden = false;
        ref("aviso").textContent = "";
        ref("dicas").replaceChildren();

        mostrarFicha();
        atualizarPalco();
        if (venceu) confete(ref("palco"));
        atualizarPlacar();
        ref("novo").focus();
      }

      function novoJogo() {
        const opcoes = paises.filter((p) => p.id !== ultimoSegredoId && silhuetas[p.id]);
        segredo = opcoes[Math.floor(Math.random() * opcoes.length)];
        ultimoSegredoId = segredo.id;
        palpites = [];
        terminou = false;
        venceu = false;

        ref("chutes").replaceChildren();
        ref("final").replaceChildren();
        ref("dicas").replaceChildren();
        ref("aviso").textContent = "";
        ref("entrada").value = "";
        ref("entrada").disabled = false;
        ref("chutar").disabled = false;
        ref("desistir").hidden = false;
        ref("novo").hidden = true;

        desenharSilhueta();
        atualizarPalco();
        atualizarContador();
        atualizarPlacar();
        ref("entrada").focus();
      }

      function chutar(evento) {
        evento.preventDefault();
        if (terminou) return;

        const pais = encontrarPais(ref("entrada").value);
        if (!pais) {
          ref("aviso").textContent = "Não encontrei esse país. Escolha um da lista de sugestões.";
          reiniciarAnimacao(ref("entrada"), "tremer");
          return;
        }
        if (palpites.some((p) => p.id === pais.id)) {
          ref("aviso").textContent = "Você já chutou esse país.";
          reiniciarAnimacao(ref("entrada"), "tremer");
          return;
        }

        ref("aviso").textContent = "";
        palpites.push(pais);
        ref("chutes").prepend(criarCartao(palpites.length, pais)); // o mais recente fica no topo
        ref("entrada").value = "";

        if (pais.id === segredo.id) {
          terminar(true);
          return;
        }
        atualizarContador();
        atualizarDicas();
        ref("entrada").focus();
      }

      ref("formato").checked = stats.formato;
      ref("formato").addEventListener("change", (e) => {
        stats.formato = e.target.checked;
        gravarLocal(CHAVE, stats);
        atualizarPalco();
      });
      ref("form").addEventListener("submit", chutar);
      ref("desistir").addEventListener("click", () => {
        if (!terminou) terminar(false);
      });
      ref("novo").addEventListener("click", novoJogo);

      novoJogo();
    }

    return () => {
      ativo = false;
    };
  },
};
