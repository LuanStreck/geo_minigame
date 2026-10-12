/*
  Modo Capitais: múltipla escolha, nos dois sentidos (país para capital e o contrário).
  O funcionamento do quiz está em js/quiz.js; aqui só ficam os sentidos e as curiosidades.
*/

import { bandeira, listar } from "../utils.js";
import { criarQuiz } from "../quiz.js";

const SENTIDOS = {
  "pais-capital": {
    rotulo: "Do país para a capital",
    pergunta: "Qual é a capital de…",
    alvo: (p) => [bandeira(p, "bandeira--titulo"), ` ${p.nome}`],
    resposta: (p) => p.capitais[0],
    equivalentes: (p) => p.capitais, // outra capital do mesmo país não pode virar alternativa errada
  },
  "capital-pais": {
    rotulo: "Da capital para o país",
    pergunta: "De qual país é capital…",
    alvo: (p) => p.capitais[0],
    resposta: (p) => p.nome,
  },
};

// Curiosidades mostradas depois de responder (só para os casos que costumam confundir)
const NOTAS = {
  AUS: "A capital é Camberra, e não Sydney, que é a maior cidade.",
  BEN: "Porto-Novo é a capital oficial, mas o governo funciona em Cotonou.",
  BOL: "Sucre é a capital constitucional; La Paz é a sede do governo.",
  BRA: "Brasília é a capital desde 1960. Antes, era o Rio de Janeiro.",
  CAN: "Ottawa é a capital; Toronto é a maior cidade.",
  CHE: "Berna é a sede do governo; a maior cidade é Zurique.",
  CIV: "Yamoussoukro é a capital oficial; Abidjan é a maior cidade e sede do governo.",
  MMR: "Naypyidaw é a capital desde 2006. Antes, era Yangon.",
  NGA: "Abuja é a capital desde 1991; Lagos é a maior cidade.",
  NLD: "Amsterdã é a capital, mas o governo e o parlamento ficam em Haia.",
  NZL: "A capital é Wellington, e não Auckland, que é a maior cidade.",
  SWZ: "Mbabane é a capital administrativa; Lobamba é a capital legislativa e real.",
  TUR: "Ancara é a capital; Istambul é a maior cidade.",
  TZA: "Dodoma é a capital; Dar es Salaam é a maior cidade.",
  USA: "Washington, D.C. é a capital; Nova York é a maior cidade.",
  ZAF: "Cada capital sedia um poder: Pretória o executivo, Bloemfontein o judiciário e Cidade do Cabo o legislativo.",
};

export default {
  iniciar(container, paises) {
    return criarQuiz(container, paises, {
      chaveProgresso: "geo-game:capitais:v1", // a mesma de antes: o progresso salvo continua valendo
      sentidos: SENTIDOS,
      sentidoInicial: "pais-capital",
      feedback: (p) => `${p.nome}: ${listar(p.capitais)}.`,
      notas: NOTAS,
    });
  },
};
