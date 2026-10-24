"""Catalogue visuel des scènes (16:9) : une carte par scène, deux variantes chacune, numéro visible.

Sortie : catalogue.html (ouvrable dans un navigateur) puis, via rendre_catalogue.py, la vidéo.
Les aperçus sont schématiques : le rendu final de chaque scène viendra de son gabarit.
"""
import json
import pathlib

from scenes_catalogue import FAMILLES, SCENES

ICI = pathlib.Path(__file__).resolve().parent
RESSOURCES = "../gabarits/ressources"

MODELE = """<!doctype html>
<html lang="fr"><head><meta charset="utf-8">
<link rel="stylesheet" href="{res}/node_modules/katex/dist/katex.min.css">
<script src="{res}/node_modules/katex/dist/katex.min.js"></script>
<style>
@font-face{{font-family:"Archivo Black";src:url({res}/node_modules/@fontsource/archivo-black/files/archivo-black-latin-400-normal.woff2) format("woff2")}}
@font-face{{font-family:"Space Grotesk";font-weight:500;src:url({res}/node_modules/@fontsource/space-grotesk/files/space-grotesk-latin-500-normal.woff2) format("woff2")}}
@font-face{{font-family:"Space Grotesk";font-weight:700;src:url({res}/node_modules/@fontsource/space-grotesk/files/space-grotesk-latin-700-normal.woff2) format("woff2")}}
html,body{{margin:0;width:1920px;height:1080px;background:#FFF7E3}}
#cadre{{position:relative;width:1920px;height:1080px;overflow:hidden;background:#FFF7E3;color:#0A0A0A;font-family:"Space Grotesk",sans-serif}}
.entete{{position:absolute;top:60px;left:90px;right:90px;display:flex;justify-content:space-between;align-items:flex-end}}
.num{{font-family:"Archivo Black";font-size:150px;line-height:.9;color:#10B981;-webkit-text-stroke:0}}
.famille{{font-size:30px;font-weight:700;letter-spacing:.04em;text-transform:uppercase}}
h1{{font-family:"Archivo Black";font-weight:400;font-size:76px;margin:10px 0 0;line-height:1}}
.badges{{display:flex;gap:18px;margin-top:18px}}
.badge{{border:3px solid #0A0A0A;border-radius:10px;padding:8px 18px;font-size:26px;font-weight:700;background:#FFFFFF;box-shadow:4px 4px 0 #0A0A0A}}
.badge.jaune{{background:#FFD83D}}
.badge.vert{{background:#10B981}}
.variantes{{position:absolute;top:370px;left:90px;right:90px;bottom:90px;display:grid;grid-template-columns:1fr 1fr;gap:48px}}
.carte{{border:3px solid #0A0A0A;border-radius:14px;background:#FFFFFF;box-shadow:6px 6px 0 #0A0A0A;padding:34px 40px;display:flex;flex-direction:column;gap:22px}}
.carte .etiq{{font-family:"Archivo Black";font-size:34px}}
.carte .texte{{font-size:36px;line-height:1.3}}
.carte .aperçu{{flex:1;border:3px dashed #0A0A0A;border-radius:10px;display:flex;align-items:center;justify-content:center;background:#FFF7E3}}
.carte .aperçu svg{{width:320px;height:200px}}
.note{{position:absolute;left:90px;bottom:34px;font-size:24px;color:#5B5B55}}
.pied{{position:absolute;right:90px;bottom:34px;font-size:24px;font-weight:700}}
.grand{{position:absolute;inset:0;display:flex;flex-direction:column;justify-content:center;padding:0 120px}}
.grand h1{{font-size:120px}}
.grand p{{font-size:40px;line-height:1.35;max-width:1500px}}
</style></head>
<body><div id="cadre"></div>
<script>
const FAMILLES = {familles};
const SCENES = {scenes};
const TOTAL = SCENES.length;
const PICTO = {{
  texte: '<rect x="40" y="40" width="240" height="30" fill="#0A0A0A"/><rect x="40" y="90" width="200" height="22" fill="#10B981"/><rect x="40" y="128" width="230" height="22" fill="#0A0A0A" opacity=".35"/>',
  formules: '<text x="160" y="125" text-anchor="middle" font-family="Archivo Black" font-size="64" fill="#0A0A0A">x² = 2</text>',
  tableaux: '<rect x="60" y="30" width="200" height="140" fill="none" stroke="#0A0A0A" stroke-width="4"/><line x1="60" y1="75" x2="260" y2="75" stroke="#0A0A0A" stroke-width="4"/><line x1="160" y1="30" x2="160" y2="170" stroke="#0A0A0A" stroke-width="4"/><rect x="60" y="75" width="200" height="30" fill="#FFD83D"/>',
  schemas: '<circle cx="90" cy="100" r="40" fill="#10B981" stroke="#0A0A0A" stroke-width="4"/><line x1="130" y1="100" x2="260" y2="60" stroke="#0A0A0A" stroke-width="4"/><circle cx="260" cy="60" r="14" fill="#FFD83D" stroke="#0A0A0A" stroke-width="4"/>',
  maths: '<line x1="40" y1="170" x2="290" y2="170" stroke="#0A0A0A" stroke-width="4"/><line x1="60" y1="190" x2="60" y2="20" stroke="#0A0A0A" stroke-width="4"/><path d="M60 40 Q160 200 270 40" fill="none" stroke="#10B981" stroke-width="7"/>',
  physique: '<circle cx="160" cy="40" r="20" fill="#FFD83D" stroke="#0A0A0A" stroke-width="4"/><path d="M160 60 L160 180" stroke="#0A0A0A" stroke-width="4" stroke-dasharray="10 8"/><polygon points="160,190 148,168 172,168" fill="#0A0A0A"/>',
  chimie: '<circle cx="110" cy="100" r="46" fill="#10B981" stroke="#0A0A0A" stroke-width="4"/><circle cx="210" cy="100" r="46" fill="#FFD83D" stroke="#0A0A0A" stroke-width="4"/><line x1="156" y1="100" x2="164" y2="100" stroke="#0A0A0A" stroke-width="6"/>',
  vivant: '<circle cx="160" cy="100" r="78" fill="none" stroke="#0A0A0A" stroke-width="4" stroke-dasharray="20 10"/><circle cx="160" cy="22" r="14" fill="#10B981" stroke="#0A0A0A" stroke-width="4"/>',
  langues: '<rect x="30" y="40" width="160" height="60" rx="14" fill="#FFFFFF" stroke="#0A0A0A" stroke-width="4"/><rect x="130" y="110" width="160" height="60" rx="14" fill="#10B981" stroke="#0A0A0A" stroke-width="4"/>',
  secours: '<rect x="40" y="30" width="110" height="110" fill="#10B981" stroke="#0A0A0A" stroke-width="4"/><rect x="170" y="40" width="110" height="18" fill="#0A0A0A"/><rect x="170" y="72" width="100" height="14" fill="#0A0A0A" opacity=".4"/><rect x="170" y="100" width="90" height="14" fill="#0A0A0A" opacity=".4"/>',
}};
const $ = s => document.getElementById(s);
function carteVariante(lettre, texte) {{
  return `<div class="carte"><div class="etiq">Variante ${{lettre}}</div><div class="texte">${{texte}}</div></div>`;
}}
function apercu(id, famille) {{
  return `<svg viewBox="0 0 320 200" xmlns="http://www.w3.org/2000/svg">${{PICTO[famille]}}</svg>`;
}}
window.intro = () => {{
  $('cadre').innerHTML = `<div class="grand"><div class="famille">Elearn Prépa · Catalogue des scènes</div><h1>${{TOTAL}} scènes</h1>
    <p>Chaque scène est présentée avec son numéro et deux variantes. Dites « valide 12 » ou « refais 14 ».</p></div>`;
}};
window.scene = i => {{
  const s = SCENES[i];
  const fam = FAMILLES[s.famille];
  const classe = s.statut.startsWith('fait') ? 'vert' : 'jaune';
  $('cadre').innerHTML = `
    <div class="entete"><div><div class="num">${{String(i + 1).padStart(2, '0')}}</div></div>
      <div style="text-align:right"><div class="famille">${{fam}}</div>
      <h1>${{s.titre}}</h1>
      <div class="badges" style="justify-content:flex-end">
        <span class="badge ${{classe}}">${{s.statut}}</span>
        <span class="badge">Automatisable : ${{s.auto}}</span>
        <span class="badge">Difficulté : ${{s.difficulte}}</span></div></div></div>
    <div class="variantes">
      <div class="carte"><div class="etiq">A</div><div class="texte">${{s.varA}}</div><div class="aperçu">${{apercu(s.id, s.famille)}}</div></div>
      <div class="carte"><div class="etiq">B</div><div class="texte">${{s.varB}}</div><div class="aperçu">${{apercu(s.id, s.famille)}}</div></div>
    </div>
    <div class="note">Identifiant : ${{s.id}}</div><div class="pied">${{i + 1}} / ${{TOTAL}}</div>`;
}};
window.outro = () => {{
  $('cadre').innerHTML = `<div class="grand"><div class="famille">Fin du catalogue</div><h1>Valider</h1>
    <p>Répondez par numéro : « valide 12 », « refais 14 ». Un aperçu schématique n'est pas le rendu final : le rendu vient du gabarit de chaque scène.</p></div>`;
}};
</script></body></html>
"""


def generer(sortie=ICI / "catalogue.html"):
    scenes = []
    for id_, famille, titre, statut, auto, difficulte, a, b in SCENES:
        scenes.append({"id": id_, "famille": famille, "titre": titre, "statut": statut,
                       "auto": auto, "difficulte": difficulte, "varA": a, "varB": b})
    html = MODELE.format(
        res=RESSOURCES,
        familles=json.dumps(FAMILLES, ensure_ascii=False),
        scenes=json.dumps(scenes, ensure_ascii=False),
    )
    sortie.write_text(html, encoding="utf-8")
    return sortie, len(scenes)


if __name__ == "__main__":
    chemin, n = generer()
    print(f"{chemin} : {n} scènes")
