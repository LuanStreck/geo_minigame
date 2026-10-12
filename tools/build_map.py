"""
Gera data/map.json: o desenho de cada país, já pronto para virar SVG.

Uso (a partir da pasta geo-game/, depois de rodar build_countries.py):
    python tools/build_map.py

Também gera data/silhuetas.json: o formato de cada país, sem a distorção do mapa
(projeção local centrada no país), para o modo "Adivinhe o país".

Baixa os contornos do pacote npm "world-atlas" (dados Natural Earth, domínio
público), projeta tudo com a projeção Miller (cilíndrica: o mapa "emenda" nas
laterais, então dá para girar o mundo sem corte no Pacífico) e escreve, para cada
país, um caminho SVG com coordenadas inteiras. Assim o navegador não precisa de
nenhuma biblioteca para desenhar o mapa.
"""

import io
import json
import math
import tarfile
import urllib.request
from pathlib import Path

URL_PACOTE = "https://registry.npmjs.org/world-atlas/-/world-atlas-2.0.2.tgz"
LIMITE_DETALHE_KM = 800        # países menores que isto usam os dados 10m (mais detalhados) na silhueta

PASTA = Path(__file__).resolve().parent.parent
ENTRADA_PAISES = PASTA / "data" / "countries.json"
SAIDA = PASTA / "data" / "map.json"
SAIDA_SILHUETAS = PASTA / "data" / "silhuetas.json"

TAMANHO_SILHUETA = 1000        # o lado maior de cada silhueta mede isto (unidades do SVG)
RAIO_TERRA_KM = 6371
PERTO_KM = 600                 # ilhas até esta distância da parte principal entram na silhueta
RAZAO_AREA = 0.05              # partes com pelo menos 5% da área da principal também entram
SEM_REGRA_DE_AREA = {"FRA", "NLD", "GBR"}  # nestes, territórios distantes nunca entram

LARGURA = 10000                # largura do mapa nas unidades do SVG
LAT_MAX, LAT_MIN = 84, -58     # corta o mapa aqui (a Antártida fica de fora)
LIMITE_PONTO = 50              # país cuja maior parte é menor que isto (unidades) vira um ponto clicável
ID_ANTARTIDA = "010"

# Recortes (lon/lat) usados para enquadrar cada região. Em "Oceania" a longitude passa
# de 180 de propósito: o mapa emenda, então Samoa e Tonga aparecem ao lado das Fiji.
VISTAS = {
    "Africa": (-20, -36, 55, 38),
    "Americas": (-170, -57, -30, 73),
    "Asia": (25, -12, 150, 78),
    "Europe": (-25, 34, 45, 72),
    "Oceania": (100, -50, 200, 12),
}

# Países cujos territórios muito distantes não entram no desenho (ficam só de fundo).
# Valor = distância máxima (em unidades) até o centro da parte principal.
# Sem isso, "França" pintaria também a Guiana Francesa, a Reunião, etc.
LIMITE_DISTANCIA = {"FRA": 700, "NLD": 700, "GBR": 700}

# ---------- Projeção Miller ----------

ESCALA = LARGURA / (2 * math.pi)


def miller_y(lat):
    fi = math.radians(lat)
    return 1.25 * math.log(math.tan(math.pi / 4 + 0.4 * fi))


Y_TOPO = miller_y(LAT_MAX)
ALTURA = round(ESCALA * (Y_TOPO - miller_y(LAT_MIN)))


def projetar(lon, lat):
    """Devolve (x, y) em unidades do SVG, com y crescendo para baixo."""
    lat = max(min(lat, 85), -85)
    x = ESCALA * (math.radians(lon) + math.pi)
    y = ESCALA * (Y_TOPO - miller_y(lat))
    return x, min(max(y, 0), ALTURA)


# ---------- TopoJSON ----------

def baixar_topologias():
    """Baixa o pacote uma vez e devolve a versão 50m (mapa) e a 10m (mais detalhada, para países pequenos)."""
    print(f"Baixando {URL_PACOTE} ...")
    with urllib.request.urlopen(URL_PACOTE, timeout=180) as resposta:
        dados = resposta.read()
    with tarfile.open(fileobj=io.BytesIO(dados), mode="r:gz") as pacote:
        return (
            json.load(pacote.extractfile("package/countries-50m.json")),
            json.load(pacote.extractfile("package/countries-10m.json")),
        )


def decodificar_arcos(topo):
    """Os arcos vêm como deslocamentos inteiros; aqui viram pares (lon, lat)."""
    sx, sy = topo["transform"]["scale"]
    tx, ty = topo["transform"]["translate"]
    arcos = []
    for arco in topo["arcs"]:
        x = y = 0
        pontos = []
        for dx, dy in arco:
            x += dx
            y += dy
            pontos.append((x * sx + tx, y * sy + ty))
        arcos.append(pontos)
    return arcos


def montar_anel(indices, arcos):
    pontos = []
    for i in indices:
        trecho = arcos[i] if i >= 0 else arcos[~i][::-1]  # índice negativo = arco ao contrário
        pontos.extend(trecho if not pontos else trecho[1:])
    return pontos


def poligonos(geometria, arcos):
    """Lista de polígonos; cada polígono é uma lista de anéis (o primeiro é o contorno)."""
    if geometria["type"] == "Polygon":
        partes = [geometria["arcs"]]
    elif geometria["type"] == "MultiPolygon":
        partes = geometria["arcs"]
    else:
        return []
    return [[montar_anel(anel, arcos) for anel in poligono] for poligono in partes]


# ---------- Caminhos SVG ----------

def projetar_anel(anel):
    """Projeta e arredonda para inteiros, sem pontos repetidos em sequência."""
    saida = []
    for lon, lat in anel:
        x, y = projetar(lon, lat)
        ponto = (round(x), round(y))
        if not saida or ponto != saida[-1]:
            saida.append(ponto)
    if len(saida) > 1 and saida[0] == saida[-1]:
        saida.pop()  # o "z" do SVG já fecha o anel
    return saida


def caminho_do_anel(pontos):
    """M x y l dx dy dx dy ... z: o primeiro ponto é absoluto e o resto, relativo."""
    if len(pontos) < 3:
        return ""
    x0, y0 = pontos[0]
    texto = ""
    ax, ay = x0, y0
    for x, y in pontos[1:]:
        for delta in (x - ax, y - ay):
            piece = str(delta)
            texto += piece if (delta < 0 or not texto) else " " + piece
        ax, ay = x, y
    return f"M{x0} {y0}l{texto}z"


def caixa(pontos):
    xs = [p[0] for p in pontos]
    ys = [p[1] for p in pontos]
    return [min(xs), min(ys), max(xs), max(ys)]


def area_da_caixa(c):
    return (c[2] - c[0]) * (c[3] - c[1])


def desembrulhar(anel):
    """Quando o anel cruza o meridiano 180, a longitude "pula" de 180 para -180.
    Aqui o anel é contínuo: depois do pulo, soma ou subtrai 360 (ex.: 190 em vez de -170)."""
    saida = []
    deslocamento = 0
    anterior = None
    for lon, lat in anel:
        if anterior is not None:
            if lon - anterior > 180:
                deslocamento -= 360
            elif lon - anterior < -180:
                deslocamento += 360
        anterior = lon
        saida.append((lon + deslocamento, lat))
    return saida


def cortar_vertical(anel, limite, manter_menor):
    """Corta o anel na reta lon = limite e mantém um dos lados (Sutherland-Hodgman)."""
    def dentro(p):
        return p[0] <= limite if manter_menor else p[0] >= limite

    saida = []
    for atual, proximo in zip(anel, anel[1:] + anel[:1]):
        if dentro(atual):
            saida.append(atual)
        if dentro(atual) != dentro(proximo):
            t = (limite - atual[0]) / (proximo[0] - atual[0])
            saida.append((limite, atual[1] + t * (proximo[1] - atual[1])))
    return saida


def partes_sem_cruzar(anel):
    """Devolve o anel em pedaços que cabem entre -180 e 180 (um só, se ele não cruza)."""
    continuo = desembrulhar(anel)
    lons = [p[0] for p in continuo]
    if min(lons) >= -180 and max(lons) <= 180:
        return [continuo]

    pedacos = []
    for k in (-1, 0, 1):  # janelas [-540,-180], [-180,180] e [180,540]
        recorte = cortar_vertical(continuo, -180 + 360 * k, manter_menor=False)
        if recorte:
            recorte = cortar_vertical(recorte, 180 + 360 * k, manter_menor=True)
        if len(recorte) >= 3:
            pedacos.append([(lon - 360 * k, lat) for lon, lat in recorte])
    return pedacos


def converter_geometria(geometria, arcos, estat):
    """Devolve uma lista de partes: (caminho SVG, caixa) de cada polígono."""
    partes = []
    for poligono in poligonos(geometria, arcos):
        exterior, buracos = poligono[0], poligono[1:]
        pedacos = partes_sem_cruzar(exterior)
        if len(pedacos) > 1:
            estat["cortes"] += 1
            if buracos:
                estat["buracos_perdidos"] += len(buracos)
            buracos = []  # buracos em polígonos cortados não ocorrem nos dados atuais

        for pedaco in pedacos:
            aneis = [projetar_anel(pedaco)] + [projetar_anel(b) for b in buracos]
            if len(aneis[0]) < 3:
                continue
            caminho = "".join(caminho_do_anel(a) for a in aneis)
            partes.append((caminho, caixa(aneis[0])))
    return partes


def distancia(a, b):
    return math.hypot(a[0] - b[0], a[1] - b[1])


# ---------- Silhuetas (projeção azimutal de Lambert, centrada no país) ----------

def projetar_local(lon, lat, lon0, lat0):
    """Projeção que mantém o formato do país parecido com o real, em km, com y para cima."""
    fi, fi0 = math.radians(lat), math.radians(lat0)
    dl = math.radians(((lon - lon0 + 540) % 360) - 180)
    cos_c = math.sin(fi0) * math.sin(fi) + math.cos(fi0) * math.cos(fi) * math.cos(dl)
    k = math.sqrt(2 / max(1e-9, 1 + cos_c))
    x = RAIO_TERRA_KM * k * math.cos(fi) * math.sin(dl)
    y = RAIO_TERRA_KM * k * (math.cos(fi0) * math.sin(fi) - math.sin(fi0) * math.cos(fi) * math.cos(dl))
    return x, y


def distancia_ate_caixa(ponto, c):
    dx = max(c[0] - ponto[0], 0, ponto[0] - c[2])
    dy = max(c[1] - ponto[1], 0, ponto[1] - c[3])
    return math.hypot(dx, dy)


def montar_silhueta(poligonos_do_pais, pais):
    partes = []
    for poligono in poligonos_do_pais:
        aneis = [[projetar_local(lon, lat, pais["lng"], pais["lat"]) for lon, lat in anel] for anel in poligono]
        c = caixa(aneis[0])
        partes.append({"aneis": aneis, "caixa": c, "area": area_da_caixa(c)})
    if not partes:
        return None, 0

    principal = max(partes, key=lambda parte: parte["area"])
    escolhidas = []
    for parte in partes:
        centro = ((parte["caixa"][0] + parte["caixa"][2]) / 2, (parte["caixa"][1] + parte["caixa"][3]) / 2)
        perto = distancia_ate_caixa(centro, principal["caixa"]) <= PERTO_KM
        grande = pais["id"] not in SEM_REGRA_DE_AREA and parte["area"] >= RAZAO_AREA * principal["area"]
        if parte is principal or perto or grande:
            escolhidas.append(parte)

    xs = [v for parte in escolhidas for v in (parte["caixa"][0], parte["caixa"][2])]
    ys = [v for parte in escolhidas for v in (parte["caixa"][1], parte["caixa"][3])]
    x0, x1, y0, y1 = min(xs), max(xs), min(ys), max(ys)
    escala = TAMANHO_SILHUETA / max(x1 - x0, y1 - y0, 1e-6)

    caminho = ""
    area_total = 0
    for parte in escolhidas:
        for i, anel in enumerate(parte["aneis"]):
            pontos = []
            for x, y in anel:
                ponto = (round((x - x0) * escala), round((y1 - y) * escala))
                if not pontos or ponto != pontos[-1]:
                    pontos.append(ponto)
            if len(pontos) > 1 and pontos[0] == pontos[-1]:
                pontos.pop()
            caminho += caminho_do_anel(pontos)
            if i == 0 and len(pontos) >= 3:  # área do contorno (fórmula do cadarço)
                area_total += abs(sum(a[0] * b[1] - b[0] * a[1] for a, b in zip(pontos, pontos[1:] + pontos[:1]))) / 2

    largura = round((x1 - x0) * escala)
    altura = round((y1 - y0) * escala)
    # Países feitos de ilhotas minúsculas (Maldivas, Kiribati...) ocupam quase nada da caixa:
    # ganham um contorno mais grosso para as ilhas aparecerem como pontos visíveis
    ocupacao = area_total / max(1, largura * altura)
    grossura = 16 if ocupacao < 0.01 else 9 if ocupacao < 0.04 else 3

    return {"d": caminho, "w": largura, "h": altura, "g": grossura}, max(x1 - x0, y1 - y0)


def poligonos_por_pais(topo, arcos, por_ccn3):
    """Agrupa os polígonos por país (um país pode aparecer em mais de uma geometria)."""
    grupos = {}
    for geometria in topo["objects"]["countries"]["geometries"]:
        if geometria.get("id") is None:
            continue
        pais = por_ccn3.get(str(geometria["id"]).zfill(3))
        if pais is not None:
            grupos.setdefault(pais["id"], []).extend(poligonos(geometria, arcos))
    return grupos


def construir_silhuetas(topo50, arcos50, topo10, arcos10, paises):
    por_ccn3 = {p["ccn3"]: p for p in paises}
    por_id = {p["id"]: p for p in paises}
    grupos50 = poligonos_por_pais(topo50, arcos50, por_ccn3)
    grupos10 = poligonos_por_pais(topo10, arcos10, por_ccn3)

    silhuetas = {}
    for pais_id, pais in por_id.items():
        resultado, tamanho_km = montar_silhueta(grupos50.get(pais_id, []), pais)
        # País pequeno: o desenho 50m fica anguloso, então refaz com o 10m
        if (resultado is None or tamanho_km < LIMITE_DETALHE_KM) and pais_id in grupos10:
            detalhado, _ = montar_silhueta(grupos10[pais_id], pais)
            if detalhado and detalhado["d"]:
                resultado = detalhado
        if resultado and resultado["d"]:
            silhuetas[pais_id] = resultado
    return dict(sorted(silhuetas.items()))


# ---------- Montagem ----------

def construir():
    paises = json.load(open(ENTRADA_PAISES, encoding="utf-8"))
    por_ccn3 = {p["ccn3"]: p for p in paises}

    topo, topo10 = baixar_topologias()
    arcos = decodificar_arcos(topo)
    arcos10 = decodificar_arcos(topo10)
    estat = {"cortes": 0, "buracos_perdidos": 0}

    # 1) agrupa as partes por país (a Austrália, por exemplo, aparece em duas geometrias)
    partes_por_pais = {}
    fundo = ""
    for geometria in topo["objects"]["countries"]["geometries"]:
        codigo = str(geometria.get("id", "")).zfill(3) if geometria.get("id") is not None else ""
        if codigo == ID_ANTARTIDA:
            continue
        partes = converter_geometria(geometria, arcos, estat)
        pais = por_ccn3.get(codigo)
        if pais is None:
            fundo += "".join(c for c, _ in partes)  # territórios e áreas disputadas: só decoração
        else:
            partes_por_pais.setdefault(pais["id"], []).extend(partes)

    # 2) monta o desenho de cada país
    mapa_paises = {}
    por_id = {p["id"]: p for p in paises}
    for pais_id, partes in partes_por_pais.items():
        if not partes:
            continue
        principal = max(partes, key=lambda parte: area_da_caixa(parte[1]))[1]
        centro = ((principal[0] + principal[2]) / 2, (principal[1] + principal[3]) / 2)
        limite = LIMITE_DISTANCIA.get(pais_id)

        caminho = ""
        for c, cx in partes:
            longe = limite and distancia(centro, ((cx[0] + cx[2]) / 2, (cx[1] + cx[3]) / 2)) > limite
            if longe:
                fundo += c
            else:
                caminho += c

        largura = principal[2] - principal[0]
        altura = principal[3] - principal[1]
        mapa_paises[pais_id] = {
            "d": caminho,
            "caixa": principal,
            "ponto": max(largura, altura) < LIMITE_PONTO,
        }

    # Países sem desenho (ex.: Tuvalu): vira só um ponto, na posição do país
    sem_desenho = []
    for p in paises:
        if p["id"] not in mapa_paises:
            x, y = projetar(p["lng"], p["lat"])
            x, y = round(x), round(y)
            mapa_paises[p["id"]] = {"d": "", "caixa": [x - 6, y - 6, x + 6, y + 6], "ponto": True}
            sem_desenho.append(p["nome"])

    vistas = {"todas": [0, 0, LARGURA, ALTURA]}
    for regiao, (lon0, lat0, lon1, lat1) in VISTAS.items():
        x0, y1 = projetar(lon0, lat0)
        x1, y0 = projetar(lon1, lat1)
        vistas[regiao] = [round(x0), round(y0), round(x1), round(y1)]

    # Para cada país, o centro da parte principal (usado para o ponto clicável e o zoom)
    for info in mapa_paises.values():
        c = info["caixa"]
        info["centro"] = [round((c[0] + c[2]) / 2), round((c[1] + c[3]) / 2)]

    resultado = {
        "largura": LARGURA,
        "altura": ALTURA,
        "vistas": vistas,
        "fundo": fundo,
        "paises": dict(sorted(mapa_paises.items())),
    }
    return resultado, sem_desenho, estat, paises, (topo, arcos, topo10, arcos10)


def main():
    resultado, sem_desenho, estat, paises, (topo, arcos, topo10, arcos10) = construir()
    with open(SAIDA, "w", encoding="utf-8") as f:
        json.dump(resultado, f, ensure_ascii=False, separators=(",", ":"))

    silhuetas = construir_silhuetas(topo, arcos, topo10, arcos10, paises)
    with open(SAIDA_SILHUETAS, "w", encoding="utf-8") as f:
        json.dump(silhuetas, f, ensure_ascii=False, separators=(",", ":"))
    sem_silhueta = [p["nome"] for p in paises if p["id"] not in silhuetas]
    print(f"{len(silhuetas)} silhuetas, {SAIDA_SILHUETAS.stat().st_size / 1024:.0f} KB em {SAIDA_SILHUETAS}")
    print(f"Sem silhueta: {sem_silhueta}")

    nomes = {p["id"]: p["nome"] for p in paises}
    pontos = [nomes[i] for i, v in resultado["paises"].items() if v["ponto"]]
    tamanho = SAIDA.stat().st_size / 1024
    print(f"{len(resultado['paises'])} países, mapa {LARGURA}x{resultado['altura']}, {tamanho:.0f} KB em {SAIDA}")
    print(f"Sem desenho (só ponto): {sem_desenho}")
    print(f"{len(pontos)} países viram ponto clicável: {pontos}")
    print(f"{estat['cortes']} contorno(s) cortado(s) no meridiano 180")
    if estat["buracos_perdidos"]:
        print(f"ATENÇÃO: {estat['buracos_perdidos']} buraco(s) descartado(s) em contornos cortados")


if __name__ == "__main__":
    main()
