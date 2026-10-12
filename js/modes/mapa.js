/*
  Modo Mapa: o jogo pede um país (pelo nome ou pela capital) e você clica nele no mapa.

  - Errou? O jogo mostra onde você clicou, destaca o país certo e aproxima o mapa nele.
  - Países muito pequenos aparecem como pontos no mapa (para dar para clicar).
  - A "Dica" aproxima o mapa da região do país. Acertar com dica não conta como aprendido.
  - Como no modo Capitais, os países que você erra voltam mais vezes.
*/

import { el, listar, lerLocal, gravarLocal, reiniciarAnimacao, confete, bandeira, definirEstatistica } from "../utils.js";
import { registrarResposta, sortearPais, resumoDominio } from "../aprendizado.js";
import { REGIOES_PT, SUBREGIOES_PT } from "../nomes.js";
import { carregarMapa } from "../data.js";
import { criarMapa } from "../mapa-svg.js";

const CHAVE_PROGRESSO = "geo-game:mapa:v1";
const LARGURA_DICA = 2600; // largura da janela do mapa quando se pede uma dica (unidades do mapa)

const REGIOES = { todas: "Todas as regiões", ...REGIOES_PT };

// Cada "pergunta" tem o seu próprio progresso guardado (chaves "mapa" e "mapa-capital")
const PERGUNTAS = {
  nome: {
    rotulo: "Pelo nome do país",
    modo: "mapa",
    texto: "Onde fica…",
    alvo: (p) => [bandeira(p, "bandeira--titulo"), ` ${p.nome}`],
  },
  capital: {
    rotulo: "Pela capital",
    modo: "mapa-capital",
    texto: "Clique no país cuja capital é…",
    alvo: (p) => p.capitais[0],
  },
};

export default {
  iniciar(container, paises) {
    let ativo = true; // vira false ao sair do modo (o mapa pode ainda estar carregando)
    let mapa = null;

    container.replaceChildren(el("p", "mensagem", "Carregando o mapa…"));

    carregarMapa()
      .then((dados) => {
        if (ativo) montar(dados);
      })
      .catch((erro) => {
        if (!ativo) return;
        console.error(erro);
        container.replaceChildren(el("p", "mensagem mensagem--erro", `Não foi possível carregar o mapa: ${erro.message}`));
      });

    function montar(dados) {
      const porId = new Map(paises.map((p) => [p.id, p]));
      const progresso = lerLocal(CHAVE_PROGRESSO, {});
      const estado = {
        pergunta: "nome",
        regiao: "todas",
        pais: null,
        respondida: false,
        usouDica: false,
        acertos: 0,
        total: 0,
        sequencia: 0,
        ultimos: [],
      };

      container.innerHTML = `
        <div class="mapa-modo">
          <div class="mapa-cabecalho">
            <div class="mapa-selecoes">
              <label><span class="visualmente-oculto">Perguntar</span>
                <select data-ref="pergunta">
                  ${Object.entries(PERGUNTAS).map(([id, p]) => `<option value="${id}">${p.rotulo}</option>`).join("")}
                </select>
              </label>
              <label><span class="visualmente-oculto">Região</span>
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
          </div>
          <div class="barra" role="progressbar" aria-label="Países aprendidos"
               aria-valuemin="0" aria-valuemax="100" aria-valuenow="0" data-ref="barra">
            <div class="barra-preenchida" data-ref="preenchimento"></div>
          </div>

          <div class="mapa-topo">
            <div>
              <p class="quiz-pergunta" data-ref="texto"></p>
              <h2 class="quiz-alvo" data-ref="alvo"></h2>
            </div>
            <div class="quiz-feedback mapa-feedback" data-ref="feedback" aria-live="polite"></div>
            <div class="mapa-acoes">
              <button type="button" class="botao-texto" data-ref="dica">Dica</button>
              <button type="button" class="botao" data-ref="proxima" hidden>Próxima</button>
            </div>
          </div>
          <div class="mapa-area" data-ref="area"></div>
          <p class="mapa-explorar" data-ref="explorar" aria-live="polite"></p>
          <p class="mapa-ajuda">
            Clique no país pedido. Arraste para mover o mapa e use a roda do mouse, os dois dedos
            ou os botões para o zoom. Países muito pequenos aparecem como pontos.
          </p>

          <div class="quiz-rodape">
            <button type="button" class="botao-texto" data-ref="zerar">Apagar progresso</button>
          </div>
        </div>`;

      const ref = (nome) => container.querySelector(`[data-ref="${nome}"]`);

      mapa = criarMapa(ref("area"), dados, aoClicar);

      const modo = () => PERGUNTAS[estado.pergunta].modo;
      const poolAtual = () =>
        estado.regiao === "todas" ? paises : paises.filter((p) => p.regiao === estado.regiao);
      const vistaAtual = () => (estado.regiao === "todas" ? "todas" : estado.regiao);

      function atualizarPlacar() {
        const pool = poolAtual();
        const { aprendidos, porcentagem } = resumoDominio(pool, progresso, modo());
        definirEstatistica(ref("acertos"), `${estado.acertos}/${estado.total}`, "acertos");
        definirEstatistica(ref("sequencia"), estado.sequencia, "em sequência");
        definirEstatistica(ref("aprendidos"), aprendidos, `aprendidos de ${pool.length}`);
        ref("preenchimento").style.width = `${porcentagem.toFixed(1)}%`;
        ref("barra").setAttribute("aria-valuenow", String(Math.round(porcentagem)));
      }

      function mostrarFeedback(classe, ...partes) {
        const feedback = ref("feedback");
        feedback.className = `quiz-feedback mapa-feedback ${classe}`;
        const linha = el("p");
        linha.append(...partes);
        feedback.replaceChildren(linha);
      }

      function novaQuestao({ animar = true } = {}) {
        const pool = poolAtual();
        const pais = sortearPais(pool, progresso, modo(), estado.ultimos);
        const pergunta = PERGUNTAS[estado.pergunta];

        estado.ultimos = [pais.id, ...estado.ultimos].slice(0, Math.min(3, pool.length - 1));
        estado.pais = pais;
        estado.respondida = false;
        estado.usouDica = false;

        mapa.limparMarcas();
        mapa.focarVista(vistaAtual(), { animar });

        ref("texto").textContent = pergunta.texto;
        ref("alvo").replaceChildren(...[].concat(pergunta.alvo(pais)));
        reiniciarAnimacao(ref("alvo"), "anima-entrar");
        ref("feedback").replaceChildren();
        ref("feedback").className = "quiz-feedback mapa-feedback";
        ref("explorar").replaceChildren();
        ref("proxima").hidden = true;
        ref("dica").hidden = false;
        ref("dica").disabled = false;
        atualizarPlacar();
      }

      function usarDica() {
        if (estado.respondida || estado.usouDica) return;
        estado.usouDica = true;

        const pais = estado.pais;
        const area = SUBREGIOES_PT[pais.subregiao] ?? REGIOES_PT[pais.regiao] ?? "";
        mapa.focarPonto(pais.id, LARGURA_DICA);
        mostrarFeedback("", el("strong", "", "Dica: "), `fica em ${area}. Acertar com dica não conta como aprendido.`);
        ref("dica").disabled = true;
      }

      function responder(idClicado) {
        estado.respondida = true;

        const alvo = estado.pais;
        const clicado = porId.get(idClicado);
        const lugarCerto = idClicado === alvo.id;
        const acertou = lugarCerto && !estado.usouDica;

        registrarResposta(progresso, modo(), alvo, acertou);
        gravarLocal(CHAVE_PROGRESSO, progresso);

        estado.total += 1;
        estado.acertos += acertou ? 1 : 0;
        estado.sequencia = acertou ? estado.sequencia + 1 : 0;

        // Marca o mapa e aproxima
        mapa.marcar(alvo.id, "pais--certo");
        if (lugarCerto) {
          mapa.focarPais(alvo.id);
        } else {
          mapa.marcar(idClicado, "pais--errado");
          mapa.marcar(alvo.id, "pais--alvo");

          // Mostra os dois países juntos, se não ficarem muito longe um do outro
          const a = dados.paises[alvo.id].caixa;
          const c = dados.paises[idClicado].caixa;
          const uniao = [Math.min(a[0], c[0]), Math.min(a[1], c[1]), Math.max(a[2], c[2]), Math.max(a[3], c[3])];
          if (uniao[2] - uniao[0] < dados.largura * 0.5) {
            mapa.enquadrar(uniao, { margem: 1.5, larguraMin: 500 });
          } else {
            mapa.focarPais(alvo.id);
          }
        }

        const detalhe = `${alvo.nome}. Capital: ${listar(alvo.capitais)}.`;
        if (acertou) {
          mostrarFeedback("quiz-feedback--certo", el("strong", "", "Certo! "), detalhe);
        } else if (lugarCerto) {
          mostrarFeedback(
            "quiz-feedback--certo",
            el("strong", "", "Achou! "),
            `Com a dica, então ${alvo.nome} ainda vai voltar para treinar. Capital: ${listar(alvo.capitais)}.`
          );
        } else {
          mostrarFeedback(
            "quiz-feedback--errado",
            el("strong", "", "Não foi dessa vez. "),
            `Você clicou em ${clicado?.nome ?? "outro país"}; ${alvo.nome} está destacado no mapa. Capital: ${listar(alvo.capitais)}.`
          );
        }

        atualizarPlacar();
        reiniciarAnimacao(ref("acertos"), "pulso");
        if (acertou) {
          reiniciarAnimacao(ref("sequencia"), "pulso");
          if (estado.sequencia % 5 === 0) confete(ref("alvo"));
        }

        ref("dica").hidden = true;
        ref("proxima").hidden = false;
        ref("proxima").focus();
      }

      // Depois de responder, clicar em qualquer país mostra o nome e a capital dele (para explorar)
      function explorar(id) {
        const pais = id ? porId.get(id) : null;
        if (!pais) {
          ref("explorar").replaceChildren();
          return;
        }
        ref("explorar").replaceChildren(bandeira(pais, "bandeira--mini"), ` ${pais.nome}. Capital: ${listar(pais.capitais)}.`);
      }

      function aoClicar(id) {
        if (estado.respondida) {
          explorar(id);
        } else if (!id) {
          ref("explorar").textContent = "Aí não tem país. Clique em um país (os pequenos aparecem como pontos).";
        } else {
          ref("explorar").replaceChildren();
          responder(id);
        }
      }

      ref("pergunta").addEventListener("change", (e) => {
        estado.pergunta = e.target.value;
        estado.ultimos = [];
        novaQuestao();
      });
      ref("regiao").addEventListener("change", (e) => {
        estado.regiao = e.target.value;
        estado.ultimos = [];
        novaQuestao();
      });
      ref("dica").addEventListener("click", usarDica);
      ref("proxima").addEventListener("click", () => novaQuestao());
      ref("zerar").addEventListener("click", () => {
        if (!confirm("Apagar tudo o que o jogo já sabe sobre seus acertos e erros no mapa?")) return;
        for (const k of Object.keys(progresso)) delete progresso[k];
        gravarLocal(CHAVE_PROGRESSO, progresso);
        atualizarPlacar();
      });

      novaQuestao({ animar: false });
    }

    // Função de limpeza: o main.js chama ao sair do modo
    return () => {
      ativo = false;
      mapa?.destruir();
    };
  },
};
