/**
 * Titres affichés (revue design du 01/10, règle 6 « formatTitle ») : on retire ce qui répète le chapitre,
 * on sort le numéro collé ou en préfixe, on remet les majuscules et les accents des titres saisis en capitales.
 */

const sansAccents = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '');
const cle = (s: string) => sansAccents(s).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

/** Mots courants des titres saisis en capitales : écrits en minuscules accentuées. Les autres mots en capitales sont des noms propres. */
const MOTS: Record<string, string> = {
  sequence: 'séquence', college: 'collège', lycee: 'lycée', prive: 'privé', privee: 'privée', laic: 'laïc', laique: 'laïque', public: 'public', publique: 'publique',
  bilingue: 'bilingue', evaluation: 'évaluation', epreuve: 'épreuve', examen: 'examen', ecole: 'école', concours: 'concours', session: 'session',
  de: 'de', du: 'du', des: 'des', la: 'la', le: 'le', les: 'les', et: 'et', en: 'en', sujet: 'sujet', corrige: 'corrigé', classique: 'classique',
  catholique: 'catholique', protestant: 'protestant', protestante: 'protestante', islamique: 'islamique', trimestre: 'trimestre', devoir: 'devoir',
  harmonise: 'harmonisé', mathematiques: 'mathématiques', physique: 'physique', chimie: 'chimie', francais: 'français', anglais: 'anglais',
};

const SIGLES = new Set(['BAC', 'BEPC', 'CEP', 'GCE', 'BTS', 'IUT', 'ENS', 'ENSP', 'ENSPD', 'ENSET', 'FMSB', 'CAP', 'SVT', 'TP', 'TD', 'QCM', 'PCT', 'TIC', 'ECM']);

const enCapitales = (mot: string) => mot.length > 1 && /\p{L}/u.test(mot) && mot === mot.toUpperCase();
const majuscule = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** « sequence 6 COLLEGE PRIVE LAïC MONGO BETI » → « Séquence 6 · Collège privé laïc Mongo Beti ». Ne touche pas un titre déjà bien écrit. */
export function recaser(titre: string): string {
  const mots = titre.trim().split(/\s+/).filter(Boolean);
  const capitales = mots.filter((m) => enCapitales(m.replace(/[^\p{L}]/gu, '') || '0')).length;
  if (capitales < 2) return majuscule(titre.trim());
  const sortie = mots.map((m) => {
    const base = sansAccents(m).toLowerCase();
    if (MOTS[base]) return MOTS[base];
    if (/^\d/.test(m) || !/\p{L}/u.test(m)) return m;
    if (/^[IVX]+$/.test(m) || /^[A-Z]{1,2}\d*$/.test(m) || SIGLES.has(m.replace(/[^\p{L}]/gu, ''))) return m; // sigles et chiffres romains
    return majuscule(m.toLowerCase());
  });
  let texte = sortie.join(' ');
  texte = texte.replace(/^(\p{L}+ \d+) (\p{L})/u, (_, a: string, b: string) => `${a} · ${b.toUpperCase()}`);
  return majuscule(texte);
}

const NUMERO_QUIZ = /^(?:quiz|qcm)\s*(?:n[°o]\s*)?(\d{1,3})(?:\s*\/\s*\d{1,3})?$/i;
const PREFIXE_NUMERO = /^(\d{1,3})\s*[-.:)]?\s*(?=\p{L})/u;

/** Découpe sur les séparateurs ( - , : , | ) et garde les morceaux qui n'appartiennent pas au contexte. */
function morceaux(titre: string, contexte: string): { reste: string[]; numero?: number } {
  const ctx = cle(contexte);
  let numero: number | undefined;
  const reste: string[] = [];
  for (const brut of titre.split(/\s+[-–—|]\s+|\s*:\s+/)) {
    let m = brut.trim();
    if (!m) continue;
    const debut = /^(?:quiz|qcm)\s*(?:n[°o]\s*)?(\d{1,3})(?:\s*\/\s*\d{1,3})?\s*[-.:]?\s+(.+)$/i.exec(m);
    if (debut) {
      numero ??= Number(debut[1]);
      m = debut[2];
    }
    const seul = NUMERO_QUIZ.exec(m);
    if (seul) {
      numero ??= Number(seul[1]);
      continue;
    }
    const colle = PREFIXE_NUMERO.exec(m);
    if (colle && !reste.length) {
      numero ??= Number(colle[1]);
      m = m.slice(colle[0].length);
    }
    if (/^(?:quiz|qcm)(?: du chapitre)?$/.test(cle(m))) continue;
    const k = cle(m).replace(/^(?:quiz|qcm) /, '');
    if (ctx && k.length >= 4 && ctx.includes(k)) continue;
    reste.push(m);
  }
  return { reste, numero };
}

/** Titre d'un quiz : le numéro et ce qui reste du nom une fois le chapitre retiré (l'écran compose « Quiz 2 · … »). */
export function titreQuiz(nom: string, chapitre: string, numero?: number): { corps: string; numero?: number } {
  const { reste, numero: n } = morceaux(nom, chapitre);
  return { corps: reste.length ? recaser(reste.join(' · ')) : '', numero: n ?? numero };
}

/** Titre d'un exercice : son titre seul, sans le chapitre ; vide s'il ne reste rien (l'écran affiche « Exercice n »). */
export function titreExercice(titre: string, chapitre: string): string {
  const { reste } = morceaux(titre, chapitre);
  return reste.length ? recaser(reste.join(' · ')) : '';
}
