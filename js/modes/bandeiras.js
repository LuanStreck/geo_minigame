/*
  Modo Bandeiras: reconheça a bandeira de cada país, e o contrário.
  O funcionamento do quiz está em js/quiz.js; aqui só ficam os sentidos.
*/

import { bandeira, listar } from "../utils.js";
import { criarQuiz } from "../quiz.js";

const SENTIDOS = {
  "bandeira-pais": {
    rotulo: "Da bandeira para o país",
    pergunta: "De qual país é esta bandeira?",
    alvo: (p) => bandeira(p, "bandeira--grande"),
    resposta: (p) => p.nome,
  },
  "pais-bandeira": {
    rotulo: "Do país para a bandeira",
    pergunta: "Qual destas é a bandeira de…",
    alvo: (p) => p.nome,
    resposta: (p) => p.id,
    opcao: (p) => bandeira(p, "bandeira--opcao"),
    imagens: true,
    revelar: (p) => p.nome, // depois de responder, cada bandeira mostra de quem é
  },
};

export default {
  iniciar(container, paises) {
    return criarQuiz(container, paises, {
      chaveProgresso: "geo-game:bandeiras:v1",
      sentidos: SENTIDOS,
      sentidoInicial: "bandeira-pais",
      feedback: (p) => `${p.nome}. Capital: ${listar(p.capitais)}.`,
    });
  },
};
