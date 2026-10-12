"""
Gera data/countries.json para o jogo de geografia.

Uso (a partir da pasta geo-game/):
    python tools/build_countries.py

Baixa o dataset aberto mledoze/countries (JSON estático no GitHub, sem chave
de API) e converte para um formato menor, só com o que o jogo usa.
As capitais em português vêm de tools/capitais_pt.json e as correções de nomes
de países (o dataset usa grafia de Portugal em alguns) vêm de tools/nomes_pt.json.
Para corrigir um nome, edite lá e rode o script de novo.
"""

import json
import urllib.request
from pathlib import Path

URL = "https://raw.githubusercontent.com/mledoze/countries/master/countries.json"
PASTA_TOOLS = Path(__file__).resolve().parent
SAIDA = PASTA_TOOLS.parent / "data" / "countries.json"
ARQUIVO_CAPITAIS_PT = PASTA_TOOLS / "capitais_pt.json"
ARQUIVO_NOMES_PT = PASTA_TOOLS / "nomes_pt.json"


def baixar():
    print(f"Baixando {URL} ...")
    with urllib.request.urlopen(URL, timeout=30) as resposta:
        return json.load(resposta)


def carregar_capitais_pt():
    with open(ARQUIVO_CAPITAIS_PT, encoding="utf-8") as f:
        bruto = json.load(f)
    # Aceita "Brasília" ou ["Pretória", "Cidade do Cabo"]; guarda sempre como lista
    return {id_: ([v] if isinstance(v, str) else v) for id_, v in bruto.items()}


def carregar_nomes_pt():
    with open(ARQUIVO_NOMES_PT, encoding="utf-8") as f:
        return json.load(f)


def converter(brutos):
    capitais_pt = carregar_capitais_pt()
    nomes_pt = carregar_nomes_pt()

    # Só países independentes (os territórios ficam de fora do jogo)
    independentes = [c for c in brutos if c.get("independent")]
    codigos = {c["cca3"] for c in independentes}

    # Avisos para você perceber se o dataset mudou e o arquivo ficou desatualizado
    faltando = sorted(codigos - capitais_pt.keys())
    sobrando = sorted(capitais_pt.keys() - codigos)
    if faltando:
        print(f"ATENÇÃO: sem capital em português para {faltando} (usando o nome em inglês)")
    if sobrando:
        print(f"ATENÇÃO: capitais_pt.json tem ids que não estão no dataset: {sobrando}")
    desconhecidos = sorted(nomes_pt.keys() - codigos)
    if desconhecidos:
        print(f"ATENÇÃO: nomes_pt.json tem ids que não estão no dataset: {desconhecidos}")

    paises = []
    for c in independentes:
        traducao_pt = c.get("translations", {}).get("por", {})
        latlng = c.get("latlng") or [None, None]

        paises.append({
            "id": c["cca3"],                                   # ex.: "BRA"
            "iso2": c["cca2"],                                 # ex.: "BR" (útil p/ bandeiras)
            "ccn3": c.get("ccn3", ""),                         # código numérico, liga o país ao desenho do mapa
            "nome": nomes_pt.get(c["cca3"], traducao_pt.get("common", c["name"]["common"])),
            "nomeEn": c["name"]["common"],
            "capitais": capitais_pt.get(c["cca3"], c.get("capital", [])),  # em português; lista (alguns países têm mais de uma)
            "capitaisEn": c.get("capital", []),                # original em inglês
            "regiao": c.get("region", ""),                     # continente
            "subregiao": c.get("subregion", ""),
            "lat": latlng[0],
            "lng": latlng[1],
            "area": c.get("area"),                             # km²
            "semSaidaParaOMar": c.get("landlocked", False),
            "idiomas": sorted(c.get("languages", {}).values()),
            "fronteiras": [b for b in c.get("borders", []) if b in codigos],
            "bandeira": c.get("flag", ""),                     # emoji
        })

    # Fronteira por terra precisa valer dos dois lados. O dataset lista, por exemplo,
    # a Índia como vizinha do Sri Lanka (é uma ligação marítima), então descartamos
    # as relações que o outro país não confirma.
    vizinhos = {p["id"]: set(p["fronteiras"]) for p in paises}
    for p in paises:
        p["fronteiras"] = [b for b in p["fronteiras"] if p["id"] in vizinhos.get(b, set())]

    paises.sort(key=lambda p: p["nome"])
    return paises


def main():
    paises = converter(baixar())
    SAIDA.parent.mkdir(parents=True, exist_ok=True)
    with open(SAIDA, "w", encoding="utf-8") as f:
        json.dump(paises, f, ensure_ascii=False, indent=1)
    print(f"{len(paises)} países salvos em {SAIDA}")


if __name__ == "__main__":
    main()
