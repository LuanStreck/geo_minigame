// Ícones do jogo em SVG (traço simples, herdam a cor do texto).

const icone = (conteudo) =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" ` +
  `stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${conteudo}</svg>`;

export const ICONES = {
  globo: icone('<circle cx="12" cy="12" r="9"/><path d="M3 12h18"/><path d="M12 3c3.2 3 3.2 15 0 18"/><path d="M12 3c-3.2 3-3.2 15 0 18"/>'),
  capitais: icone('<path d="M3 10 12 4l9 6"/><path d="M5.5 10v8M9.8 10v8M14.2 10v8M18.5 10v8"/><path d="M3 20.5h18"/>'),
  atributos: icone('<circle cx="10.5" cy="10.5" r="6.5"/><path d="m15.4 15.4 5.1 5.1"/><path d="M8 9.2 10 8l2.4 1 .9 2-1.4 1.8-2.6.4z"/>'),
  mapa: icone('<path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11z"/><circle cx="12" cy="10" r="2.4"/>'),
  bandeiras: icone('<path d="M5 21V4"/><path d="M5 4.5c4-2 6.5 2 11 0v9c-4.5 2-7-2-11 0"/>'),
  voltar: icone('<path d="m14.5 5.5-6.5 6.5 6.5 6.5"/>'),
};
