"""
Copia as bandeiras (SVG) dos 194 países para data/flags/.

Uso (a partir da pasta geo-game/, depois de rodar build_countries.py):
    python tools/build_flags.py

Baixa o pacote npm "flag-icons" (licença MIT) e guarda só as bandeiras 4:3 dos
países do jogo, com o nome em minúsculas do código de 2 letras (ex.: data/flags/br.svg).
As imagens ficam no projeto, então o jogo funciona sem internet.
"""

import io
import json
import tarfile
import urllib.request
from pathlib import Path

URL_PACOTE = "https://registry.npmjs.org/flag-icons/-/flag-icons-7.5.0.tgz"

PASTA = Path(__file__).resolve().parent.parent
ENTRADA_PAISES = PASTA / "data" / "countries.json"
SAIDA = PASTA / "data" / "flags"


def main():
    paises = json.load(open(ENTRADA_PAISES, encoding="utf-8"))
    codigos = {p["iso2"].lower() for p in paises}

    print(f"Baixando {URL_PACOTE} ...")
    with urllib.request.urlopen(URL_PACOTE, timeout=180) as resposta:
        dados = resposta.read()

    SAIDA.mkdir(parents=True, exist_ok=True)
    salvas = set()
    with tarfile.open(fileobj=io.BytesIO(dados), mode="r:gz") as pacote:
        for item in pacote.getmembers():
            if "/flags/4x3/" not in item.name or not item.name.endswith(".svg"):
                continue
            codigo = Path(item.name).stem
            if codigo in codigos:
                (SAIDA / f"{codigo}.svg").write_bytes(pacote.extractfile(item).read())
                salvas.add(codigo)

    faltando = sorted(codigos - salvas)
    total = sum(f.stat().st_size for f in SAIDA.glob("*.svg")) / 1024
    print(f"{len(salvas)} bandeiras salvas em {SAIDA} ({total:.0f} KB)")
    if faltando:
        print(f"ATENÇÃO: sem bandeira para {faltando}")


if __name__ == "__main__":
    main()
