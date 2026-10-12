/*
  Motor dos quizzes de múltipla escolha (usado pelos modos Capitais e Bandeiras).

  Cada modo só descreve os "sentidos" do quiz. Um sentido diz:
    rotulo      texto do seletor ("Do país para a capital")
    pergunta    frase acima do alvo ("Qual é a capital de…")
    alvo(p)     o que aparece como pergunta (texto, elemento ou lista deles)
    resposta(p) texto que identifica a alternativa certa (também evita alternativas repetidas)
    opcao(p)    (opcional) como desenhar uma alternativa; por padrão é o texto de resposta(p)
    imagens     (opcional) true quando as alternativas são imagens, em grade
    revelar(p)  (opcional) legenda mostrada em cada imagem depois de responder
    equivalentes(p) (opcional) respostas que também estão certas e não podem virar alternativa errada

  Como o jogo ajuda a aprender: os países que você erra voltam mais vezes (aprendizado.js).
*/

import { el, embaralhar, lerLocal, gravarLocal, reiniciarAnimacao, confete, definirEstatistica } from "./utils.js";
import { registrarResposta, sortearPais, resumoDominio } from "./aprendizado.js";
import { REGIOES_PT } from "./nomes.js";

const NUM_OPCOES = 4;
const REGIOES = { todas: "Todas as regiões", ...REGIOES_PT };

// Alternativas erradas: duas da mesma região (mais difíceis, ensinam mais) e o resto de qualquer lugar
function sortearOpcoes(correto, sentido, todos) {
  const certa = sentido.resposta(correto);
  const evitar = new Set(sentido.equivalentes?.(correto) ?? []);

  const outros = todos.filter((p) => p.id !== correto.id);
  const vizinhos = embaralhar(outros.filter((p) => p.regiao === correto.regiao));
  const demais = embaralhar([...vizinhos.slice(2), ...outros.filter((p) => p.regiao !== correto.regiao)]);

  const escolhidos = [correto];
  const usados = new Set([certa]);
  for (const p of [...vizinhos.slice(0, 2), ...demais]) {
    if (escolhidos.length >= NUM_OPCOES) break;
    const rotulo = sentido.resposta(p);
    if (usados.has(rotulo) || evitar.has(rotulo)) continue;
    usados.add(rotulo);
    escolhidos.push(p);
  }
  return embaralhar(escolhidos);
}

export function criarQuiz(container, paises, config) {
  const { chaveProgresso, sentidos, sentidoInicial, feedback, notas = {} } = config;

  const progresso = lerLocal(chaveProgresso, {});
  const estado = {
    sentido: sentidoInicial,
    regiao: "todas",
    questao: null, // { pais, opcoes (países), certa (texto) }
    respondida: false,
    acertos: 0,
    total: 0,
    sequencia: 0,
    ultimos: [], // últimos países sorteados, para não repetir em seguida
  };

  container.innerHTML = `
    <div class="quiz">
      <div class="quiz-controles">
        <label>Sentido
          <select data-ref="sentido">
            ${Object.entries(sentidos).map(([id, s]) => `<option value="${id}">${s.rotulo}</option>`).join("")}
          </select>
        </label>
        <label>Região
          <select data-ref="regiao">
            ${Object.entries(REGIOES).map(([id, nome]) => `<option value="${id}">${nome}</option>`).join("")}
          </select>
        </label>
      </div>

      <div class="quiz-placar">
        <span class="stat" data-ref="acertos"></span>
        <span class="stat" data-ref="sequencia"></span>
        <span class="stat" data-ref="aprendidos"></span>
      </div>
      <div class="barra" role="progressbar" aria-label="Países aprendidos"
           aria-valuemin="0" aria-valuemax="100" aria-valuenow="0" data-ref="barra">
        <div class="barra-preenchida" data-ref="preenchimento"></div>
      </div>

      <p class="quiz-pergunta" data-ref="pergunta"></p>
      <h2 class="quiz-alvo" data-ref="alvo"></h2>

      <div class="quiz-opcoes" data-ref="opcoes"></div>
      <div class="quiz-feedback" data-ref="feedback" aria-live="polite"></div>

      <div class="quiz-rodape">
        <button type="button" class="botao" data-ref="proxima" hidden>Próxima</button>
        <button type="button" class="botao-texto" data-ref="zerar">Apagar progresso</button>
      </div>
    </div>`;

  const ref = (nome) => container.querySelector(`[data-ref="${nome}"]`);
  const sentidoAtual = () => sentidos[estado.sentido];

  const poolAtual = () =>
    estado.regiao === "todas" ? paises : paises.filter((p) => p.regiao === estado.regiao);

  function atualizarPlacar() {
    const pool = poolAtual();
    const { aprendidos, porcentagem } = resumoDominio(pool, progresso, estado.sentido);

    definirEstatistica(ref("acertos"), `${estado.acertos}/${estado.total}`, "acertos");
    definirEstatistica(ref("sequencia"), estado.sequencia, "em sequência");
    definirEstatistica(ref("aprendidos"), aprendidos, `aprendidos de ${pool.length}`);

    // A largura da barra anima sozinha por causa do "transition" do CSS
    ref("preenchimento").style.width = `${porcentagem.toFixed(1)}%`;
    ref("barra").setAttribute("aria-valuenow", String(Math.round(porcentagem)));
  }

  function novaQuestao() {
    const pool = poolAtual();
    const s = sentidoAtual();
    const pais = sortearPais(pool, progresso, estado.sentido, estado.ultimos);

    estado.ultimos = [pais.id, ...estado.ultimos].slice(0, Math.min(3, pool.length - 1));
    estado.questao = {
      pais,
      opcoes: sortearOpcoes(pais, s, paises),
      certa: s.resposta(pais),
    };
    estado.respondida = false;

    ref("pergunta").textContent = s.pergunta;
    ref("alvo").replaceChildren(...[].concat(s.alvo(pais)));
    reiniciarAnimacao(ref("pergunta"), "anima-entrar");
    reiniciarAnimacao(ref("alvo"), "anima-entrar");

    const areaOpcoes = ref("opcoes");
    areaOpcoes.classList.toggle("quiz-opcoes--imagens", Boolean(s.imagens));
    areaOpcoes.replaceChildren(
      ...estado.questao.opcoes.map((p, i) => {
        const botao = el("button", "opcao");
        botao.type = "button";
        botao.dataset.rotulo = s.resposta(p);
        botao.style.setProperty("--i", String(i)); // atraso da animação de entrada
        botao.append(
          el("span", "opcao-tecla", String(i + 1)),
          el("span", "opcao-texto"),
        );
        botao.querySelector(".opcao-texto").append(...[].concat(s.opcao ? s.opcao(p) : s.resposta(p)));
        botao.addEventListener("click", () => responder(i));
        return botao;
      })
    );

    ref("feedback").replaceChildren();
    ref("feedback").className = "quiz-feedback";
    ref("proxima").hidden = true;
    atualizarPlacar();
  }

  function responder(indice) {
    if (estado.respondida) return;
    estado.respondida = true;

    const s = sentidoAtual();
    const { pais, opcoes, certa } = estado.questao;
    const acertou = s.resposta(opcoes[indice]) === certa;

    registrarResposta(progresso, estado.sentido, pais, acertou);
    gravarLocal(chaveProgresso, progresso);

    estado.total += 1;
    estado.acertos += acertou ? 1 : 0;
    estado.sequencia = acertou ? estado.sequencia + 1 : 0;

    // Marca as alternativas (a marca ✓/✗ garante que a cor não é a única pista)
    ref("opcoes")
      .querySelectorAll(".opcao")
      .forEach((botao, i) => {
        botao.disabled = true;
        const marca = (classe, simbolo) => {
          botao.classList.add(classe);
          botao.append(el("span", "opcao-marca", simbolo));
        };
        if (s.resposta(opcoes[i]) === certa) marca("opcao--certa", "✓");
        else if (i === indice) marca("opcao--errada", "✗");
        // Em alternativas de imagem, mostra o nome de cada país (aprender o que é o quê)
        if (s.revelar) botao.querySelector(".opcao-texto").append(el("span", "opcao-nome", s.revelar(opcoes[i])));
      });

    const fb = ref("feedback");
    fb.className = `quiz-feedback ${acertou ? "quiz-feedback--certo" : "quiz-feedback--errado"}`;
    const resultado = el("p");
    resultado.append(el("strong", "", acertou ? "Certo! " : "Não foi dessa vez. "), feedback(pais));
    fb.replaceChildren(resultado);
    if (notas[pais.id]) fb.append(el("p", "quiz-nota", notas[pais.id]));

    atualizarPlacar();
    reiniciarAnimacao(ref("acertos"), "pulso");
    if (acertou) {
      reiniciarAnimacao(ref("sequencia"), "pulso");
      // A cada 5 acertos seguidos, uma comemoração
      if (estado.sequencia % 5 === 0) confete(ref("alvo"));
    }
    ref("proxima").hidden = false;
    ref("proxima").focus();
  }

  // Atalhos: 1 a 4 escolhem a alternativa; Enter vai para a próxima pergunta
  function aoTeclar(evento) {
    if (evento.ctrlKey || evento.metaKey || evento.altKey) return;
    if (evento.target.tagName === "SELECT") return;

    if (!estado.respondida && /^[1-9]$/.test(evento.key)) {
      const indice = Number(evento.key) - 1;
      if (indice < estado.questao.opcoes.length) responder(indice);
    } else if (estado.respondida && evento.key === "Enter" && evento.target.tagName !== "BUTTON") {
      novaQuestao();
    }
  }

  ref("sentido").addEventListener("change", (e) => {
    estado.sentido = e.target.value;
    estado.ultimos = [];
    novaQuestao();
  });

  ref("regiao").addEventListener("change", (e) => {
    estado.regiao = e.target.value;
    estado.ultimos = [];
    novaQuestao();
  });

  ref("proxima").addEventListener("click", novaQuestao);

  ref("zerar").addEventListener("click", () => {
    if (!confirm("Apagar tudo o que o jogo já sabe sobre seus acertos e erros?")) return;
    for (const k of Object.keys(progresso)) delete progresso[k];
    gravarLocal(chaveProgresso, progresso);
    atualizarPlacar();
  });

  document.addEventListener("keydown", aoTeclar);
  novaQuestao();

  // Função de limpeza: o main.js chama ao sair do modo
  return () => document.removeEventListener("keydown", aoTeclar);
}
