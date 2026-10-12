# Geo Game
 
Jogo de navegador para aprender geografia brincando: 194 países, quatro modos de jogo.
Feito com HTML, CSS e JavaScript puros, sem backend e sem biblioteca externa.
 
## Modos
 
- **Capitais**: descubra a capital de cada país e o país de cada capital.
- **Adivinhe o país**: reconheça o país pelo formato e descubra o secreto com pistas de região, distância, área e fronteiras.
- **Mapa**: ache o país no mapa, pelo nome ou pela capital, com zoom e dicas.
- **Bandeiras**: reconheça a bandeira de cada país, e o contrário.
Nos modos de quiz e de mapa, os países que você erra voltam mais vezes. O progresso fica guardado no navegador (`localStorage`).
 
## Como rodar no seu computador
 
Os módulos JavaScript não funcionam abrindo o `index.html` com duplo clique. Use um servidor local, na pasta do projeto:
 
```
python -m http.server
```
 
e acesse `http://localhost:8000`.
 
## Estrutura
 
```
index.html
css/style.css
data/            countries.json, map.json, silhuetas.json e flags/ (gerados pelos scripts de tools/)
js/              main.js, quiz.js, mapa-svg.js, utils.js, ... e modes/ (um arquivo por modo)
tools/           scripts Python que geram os arquivos de data/
```
 
Para adicionar um modo novo, crie `js/modes/<id>.js` (veja `js/main.js`, no topo, para o passo a passo).
 
## Regenerar os dados (opcional)
 
Os arquivos de `data/` já estão prontos. Se quiser refazê-los (precisa de internet e Python 3):
 
```
python tools/build_countries.py   # dados dos países
python tools/build_map.py         # mapa e silhuetas
python tools/build_flags.py       # bandeiras
```
 
Os nomes em português das capitais e dos países ficam em `tools/capitais_pt.json` e `tools/nomes_pt.json`.
 
## Créditos dos dados
 
- Dados dos países: [mledoze/countries](https://github.com/mledoze/countries) (licença ODbL).
- Contornos dos países: [Natural Earth](https://www.naturalearthdata.com/) (domínio público), via o pacote [world-atlas](https://github.com/topojson/world-atlas) (licença ISC).
- Bandeiras: [flag-icons](https://github.com/lipis/flag-icons) (licença MIT).
- Fontes: Bricolage Grotesque e Figtree, pelo Google Fonts.
Confira as licenças nos próprios repositórios antes de redistribuir os dados.
 
