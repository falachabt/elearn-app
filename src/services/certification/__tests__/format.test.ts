import { afficherJour, analyserDateSaisie, analyserObjectif, formaterDuree, masquerDate } from '../format';
import { formaterTemps, etatInitial, reduireLecteur } from '../lecteur';
import { HOTE_MEDIAS_PUBLIC, urlMedia } from '../media';

describe('formats', () => {
  it('durée de l’examen', () => {
    expect(formaterDuree(120)).toBe('2 h');
    expect(formaterDuree(45)).toBe('45 min');
    expect(formaterDuree(90)).toBe('1 h 30');
  });
  it('objectif : entier dans les bornes du serveur (AC-A3-3)', () => {
    expect(analyserObjectif('820', 10, 990)).toBe(820);
    expect(analyserObjectif('9', 10, 990)).toBeNull();
    expect(analyserObjectif('991', 10, 990)).toBeNull();
    expect(analyserObjectif('10', 10, 990)).toBe(10);
    expect(analyserObjectif('990', 10, 990)).toBe(990);
    expect(analyserObjectif('', 10, 990)).toBeNull();
    expect(analyserObjectif('8a0', 10, 990)).toBeNull();
  });
  it('date du test : facultative, format strict, jamais passée (AC-A3-5)', () => {
    const aujourdhui = '2026-10-15';
    expect(analyserDateSaisie('', aujourdhui)).toEqual({ ok: true, jour: null });
    expect(analyserDateSaisie('20/12/2026', aujourdhui)).toEqual({ ok: true, jour: '2026-12-20' });
    expect(analyserDateSaisie('15/10/2026', aujourdhui)).toEqual({ ok: true, jour: '2026-10-15' });
    expect(analyserDateSaisie('14/10/2026', aujourdhui)).toEqual({ ok: false, erreur: 'passe' });
    expect(analyserDateSaisie('31/02/2027', aujourdhui)).toEqual({ ok: false, erreur: 'format' });
    expect(analyserDateSaisie('demain', aujourdhui)).toEqual({ ok: false, erreur: 'format' });
    expect(afficherJour('2026-12-20')).toBe('20/12/2026');
  });
});

describe('adresse des médias', () => {
  it('préfixe l’hôte configuré, sans double barre', () => {
    expect(urlMedia('toeic/audio/p1_1.mp3', 'https://media.example/')).toBe('https://media.example/toeic/audio/p1_1.mp3');
    expect(urlMedia('/toeic/img/a.jpg', 'https://media.example')).toBe('https://media.example/toeic/img/a.jpg');
  });
  it('sans configuration : l’hôte public du bucket par défaut (bundle construit à la main)', () => {
    expect(urlMedia('toeic/audio/p1_1.mp3')).toBe(`${HOTE_MEDIAS_PUBLIC}/toeic/audio/p1_1.mp3`);
    expect(HOTE_MEDIAS_PUBLIC.startsWith('https://')).toBe(true);
  });
  it('sans hôte ou sans chemin : indisponible, jamais une adresse inventée', () => {
    expect(urlMedia('toeic/audio/p1_1.mp3', '')).toBeNull();
    expect(urlMedia(null, 'https://media.example')).toBeNull();
    expect(urlMedia('https://autre.example/a.mp3', '')).toBe('https://autre.example/a.mp3');
  });
});

describe('lecteur audio (B8)', () => {
  const statut = (p: Partial<{ chargee: boolean; enLecture: boolean; position: number; duree: number; termine: boolean }> = {}) => ({ type: 'statut' as const, chargee: true, enLecture: false, position: 0, duree: 60, termine: false, ...p });
  it('lecture, pause, reprise', () => {
    let e = reduireLecteur(etatInitial, { type: 'jouer' }, false);
    expect(e.phase).toBe('chargement');
    e = reduireLecteur(e, statut({ enLecture: true, position: 3 }), false);
    expect(e).toMatchObject({ phase: 'lecture', position: 3 });
    e = reduireLecteur(e, { type: 'pause' }, false);
    expect(e.phase).toBe('pause');
    e = reduireLecteur(e, { type: 'jouer' }, false);
    expect(e.phase).toBe('lecture');
  });
  it('écoute unique : après la fin, plus de lecture (AC-A6, une seule écoute)', () => {
    let e = reduireLecteur(etatInitial, { type: 'jouer' }, true);
    e = reduireLecteur(e, statut({ termine: true }), true);
    expect(e).toMatchObject({ phase: 'fini', jouee: true });
    expect(reduireLecteur(e, { type: 'jouer' }, true)).toBe(e);
    // En entraînement, la réécoute est libre.
    expect(reduireLecteur(e, { type: 'jouer' }, false).phase).toBe('lecture');
  });
  it('erreur : la position est gardée pour reprendre à ±1 s', () => {
    let e = reduireLecteur(etatInitial, { type: 'jouer' }, true);
    e = reduireLecteur(e, statut({ enLecture: true, position: 18 }), true);
    e = reduireLecteur(e, { type: 'erreur' }, true);
    expect(e).toMatchObject({ phase: 'erreur', position: 18 });
    expect(reduireLecteur(e, { type: 'reprendre' }, true).phase).toBe('chargement');
  });
  it('formate le temps', () => {
    expect(formaterTemps(18.4)).toBe('0:18');
    expect(formaterTemps(75)).toBe('1:15');
  });
});

describe('masque de date JJ/MM/AAAA', () => {
  it('ajoute les barres obliques toutes seules pendant la frappe', () => {
    expect(masquerDate('', '1')).toBe('1');
    expect(masquerDate('1', '15')).toBe('15');
    expect(masquerDate('15', '150')).toBe('15/0');
    expect(masquerDate('15/0', '15/05')).toBe('15/05');
    expect(masquerDate('15/05', '15/052')).toBe('15/05/2');
    expect(masquerDate('15/05/202', '15/05/2026')).toBe('15/05/2026');
  });
  it('ignore les caractères non numériques et borne à huit chiffres', () => {
    expect(masquerDate('', '15-05.2026')).toBe('15/05/2026');
    expect(masquerDate('15/05/2026', '15/05/20261')).toBe('15/05/2026');
  });
  it('effacer la barre de fin efface le chiffre d’avant, le masque ne la remet pas', () => {
    expect(masquerDate('15/', '15')).toBe('1');
    expect(masquerDate('15/05/', '15/05')).toBe('15/0');
  });
});
