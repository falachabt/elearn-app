import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';
import { BackHandler } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { fr } from '@/i18n/fr';
import { suivre } from '@/services/analytics';
import { CLE_COPIE_RECAP, CLE_DERNIERE_SEMAINE_VUE } from '@/services/maSemaine';
import { jouerMoment } from '@/services/retours';
import { ThemeProvider } from '@/theme/ThemeProvider';
import { palette, typeContenu } from '@/theme/theme';

import { MaSemaine } from '../MaSemaine';

const t = fr.maSemaine;
const mockRpc = jest.fn();
let mockParams: Record<string, string | undefined> = {};

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: jest.fn(() => true) },
  useLocalSearchParams: () => mockParams,
}));
jest.mock('@/services/analytics', () => ({ suivre: jest.fn() }));
jest.mock('@/services/retours', () => ({ ...jest.requireActual('@/services/retours'), jouerMoment: jest.fn() }));
jest.mock('@/services/supabase', () => ({ getSupabase: () => ({ rpc: (...a: unknown[]) => mockRpc(...a) }) }));
jest.mock('@/session/SessionProvider', () => ({ useSessionPrete: () => 'u1' }));

const BRUT = {
  semaine: '2026-09-28',
  missions: 5,
  missions_par_jour: [1, 1, 0, 1, 1, 1, 0],
  lecons_validees: 14,
  quiz_termines: 6,
  exercices_faits: 9,
  questions_ratees: 12,
  credits_utilises: 38,
  pass_actif: false,
  solde: 27,
  recharge_lundi: 25,
};

const metriques = { frame: { x: 0, y: 0, width: 360, height: 780 }, insets: { top: 0, bottom: 0, left: 0, right: 0 } };
const monter = (reglage: 'clair' | 'sombre' = 'clair') =>
  render(
    <SafeAreaProvider initialMetrics={metriques}>
      <ThemeProvider reglage={reglage}>
        <MaSemaine />
      </ThemeProvider>
    </SafeAreaProvider>,
  );

const reponse = (extra: Record<string, unknown> = {}) => mockRpc.mockResolvedValue({ data: { ...BRUT, ...extra }, error: null });
const erreurReseau = { name: 'TypeError', message: 'Network request failed' };

async function afficher(extra: Record<string, unknown> = {}, reglage: 'clair' | 'sombre' = 'clair') {
  reponse(extra);
  const rendu = await monter(reglage);
  await screen.findByTestId('carte-missions');
  return rendu;
}

const suivant = () => fireEvent.press(screen.getByText(t.suivant));
const valeur = (id: string) => screen.getByTestId(id).props.accessibilityLabel as string;
/** Couleur de fond du bloc coloré qui porte le nombre. */
const fond = (id: string) => {
  const bloc = screen.getByTestId(id).parent;
  const styles: { backgroundColor?: string }[] = [bloc?.props.style].flat(5).filter(Boolean);
  return styles.find((s) => s.backgroundColor)?.backgroundColor;
};
const fonds = (id: string) =>
  screen
    .getAllByTestId(id)
    .map((n) => ([n.props.style].flat(5) as { backgroundColor?: string }[]).find((s) => s?.backgroundColor)?.backgroundColor);
/** Morceaux de texte d'un paragraphe qui mêle texte simple et passages en gras. */
const texteCompose = (id: string) =>
  ([screen.getByTestId(id).props.children] as unknown[])
    .flat()
    .map((c) => (typeof c === 'string' ? c : (c as { props: { children: string } }).props.children))
    .join('');

beforeEach(async () => {
  jest.clearAllMocks();
  await AsyncStorage.clear();
  mockParams = {};
  (router.canGoBack as jest.Mock).mockReturnValue(true);
});

describe('carte 1 : missions', () => {
  it('affiche la semaine, le titre, le nombre, les jours et la phrase', async () => {
    await afficher();
    expect(screen.getByText('Semaine du 28 sept. au 4 oct.')).toBeTruthy();
    expect(screen.getByText(t.titreRegularite)).toBeTruthy();
    expect(valeur('hero-missions')).toBe('5');
    expect(screen.getByText(t.missionsPlus)).toBeTruthy();
    expect(screen.getByText(t.tesJours)).toBeTruthy();
    expect(screen.getAllByTestId('jour-fait')).toHaveLength(5);
    expect(screen.getAllByTestId('jour-pas-fait')).toHaveLength(2);
    expect(screen.getByTestId('regularite').props.children).toBe(t.regularitePlus.replace('{{n}}', '5'));
  });

  it('les jours sont lisibles sans la couleur : libellé complet', async () => {
    await afficher();
    expect(screen.getAllByTestId('jour-fait')[0].props.accessibilityLabel).toBe(`${t.noms.lun} : ${t.jourFait}`);
    expect(screen.getAllByTestId('jour-pas-fait')[0].props.accessibilityLabel).toBe(`${t.noms.mer} : ${t.jourPasFait}`);
  });

  it.each([
    [0, t.titreAvance],
    [1, t.titreDebut],
    [3, t.titreDebut],
    [4, t.titreRegularite],
    [6, t.titreRegularite],
    [7, t.titrePleine],
  ])('%i mission(s) : « %s »', async (missions, titre) => {
    await afficher({ missions, missions_par_jour: [1, 0, 0, 0, 0, 0, 0] });
    expect(screen.getByText(titre)).toBeTruthy();
    expect(valeur('hero-missions')).toBe(String(missions));
  });

  it('accorde le singulier', async () => {
    await afficher({ missions: 1, missions_par_jour: [0, 1, 0, 0, 0, 0, 0] });
    expect(screen.getByText(t.missionUne)).toBeTruthy();
    expect(screen.getByTestId('regularite').props.children).toBe(t.regulariteUn.replace('{{n}}', '1'));
  });

  it('sans grille de jours, la carte blanche et la phrase sont masquées', async () => {
    await afficher({ missions_par_jour: undefined });
    expect(screen.queryByText(t.tesJours)).toBeNull();
    expect(screen.queryByTestId('regularite')).toBeNull();
    expect(screen.getByTestId('hero-missions')).toBeTruthy();
  });

  it('zéro mission avec des leçons : la carte reste, le zéro est visible', async () => {
    await afficher({ missions: 0, missions_par_jour: [0, 0, 0, 0, 0, 0, 0] });
    expect(screen.getByText(t.titreAvance)).toBeTruthy();
    expect(valeur('hero-missions')).toBe('0');
  });
});

describe('les quatre cartes', () => {
  it('se parcourent avec « Suivant » dans l’ordre de la maquette', async () => {
    await afficher();
    expect(screen.getAllByTestId('segment')).toHaveLength(4);

    await suivant();
    expect(screen.getByTestId('carte-appris')).toBeTruthy();
    expect(screen.getByText(t.apprisTitre)).toBeTruthy();
    expect(valeur('hero-lecons')).toBe('14');
    expect(valeur('hero-quiz')).toBe('6');
    expect(valeur('hero-exercices')).toBe('9');
    expect(screen.getByText(t.leconsPlus)).toBeTruthy();
    expect(screen.getByText(t.quizPlus)).toBeTruthy();
    expect(screen.getByText(t.exercicesPlus)).toBeTruthy();
    expect(screen.getByText(t.apprisTexte)).toBeTruthy();

    await suivant();
    expect(screen.getByTestId('carte-ratees')).toBeTruthy();
    expect(screen.getByText(t.rateesTitre)).toBeTruthy();
    expect(valeur('hero-ratees')).toBe('12');
    expect(screen.getByText(t.reflexeTexte)).toBeTruthy();
    expect(screen.getByText(t.refaireErreurs)).toBeTruthy();

    await suivant();
    expect(screen.getByTestId('carte-credits')).toBeTruthy();
    expect(screen.getByText(t.creditsTitre)).toBeTruthy();
    expect(valeur('hero-credits')).toBe('38');
    expect(screen.getByText(t.allerReviser)).toBeTruthy();
    expect(screen.getByText(t.fermer)).toBeTruthy();
    expect(screen.queryByText(t.suivant)).toBeNull();
  });

  it('carte 2 : une ligne à zéro est masquée', async () => {
    await afficher({ exercices_faits: 0 });
    await suivant();
    expect(screen.queryByTestId('hero-exercices')).toBeNull();
    expect(screen.getByTestId('hero-lecons')).toBeTruthy();
    expect(screen.getByTestId('hero-quiz')).toBeTruthy();
  });

  it('carte 2 : exercices seuls', async () => {
    await afficher({ lecons_validees: 0, quiz_termines: 0, exercices_faits: 3 });
    await suivant();
    expect(valeur('hero-exercices')).toBe('3');
    expect(screen.queryByTestId('hero-lecons')).toBeNull();
    expect(screen.queryByTestId('hero-quiz')).toBeNull();
    expect(screen.getByText(t.exercicesPlus)).toBeTruthy();
  });

  it('carte 2 : un exercice au singulier', async () => {
    await afficher({ lecons_validees: 0, quiz_termines: 0, exercices_faits: 1 });
    await suivant();
    expect(screen.getByText(t.exerciceUn)).toBeTruthy();
  });

  it('couleurs : vert, bleu et orange du design system, texte noir dessus', async () => {
    await afficher();
    await suivant();
    expect(fond('hero-quiz')).toBe(typeContenu.quiz);
    expect(fond('hero-exercices')).toBe(typeContenu.exercice);
    expect(fond('hero-lecons')).toBe(palette.emeraude[500]);
    expect(([screen.getByTestId('hero-quiz').props.style].flat(5) as { color?: string }[]).find((s) => s.color)?.color).toBe(palette.encre[1000]);
  });

  it('en sombre, le vert s’éclaircit mais le texte reste noir', async () => {
    await afficher({}, 'sombre');
    expect(fond('hero-missions')).toBe(palette.emeraude[400]);
    expect(([screen.getByTestId('hero-missions').props.style].flat(5) as { color?: string }[]).find((s) => s.color)?.color).toBe(palette.encre[1000]);
    await suivant();
    expect(fond('hero-quiz')).toBe(typeContenu.quiz);
  });

  it('cartes à zéro sautées : segments et dernière carte suivent', async () => {
    await afficher({ questions_ratees: 0, credits_utilises: 0 });
    expect(screen.getAllByTestId('segment')).toHaveLength(2);
    await suivant();
    expect(screen.getByTestId('carte-appris')).toBeTruthy();
    // Dernière carte : « Suivant » devient « Fermer » (un seul bouton vert).
    expect(screen.queryByText(t.suivant)).toBeNull();
    expect(screen.getByText(t.fermer)).toBeTruthy();
  });

  it('une seule carte quand il n’y a que des missions', async () => {
    await afficher({ lecons_validees: 0, quiz_termines: 0, exercices_faits: 0, questions_ratees: 0, credits_utilises: 0 });
    expect(screen.getAllByTestId('segment')).toHaveLength(1);
    expect(screen.getByText(t.fermer)).toBeTruthy();
    expect(screen.queryByText(t.suivant)).toBeNull();
  });

  it('segments : passés, courante et à venir sont annoncés « Carte n sur total » et colorés', async () => {
    await afficher();
    expect(screen.getAllByTestId('segment').map((s) => s.props.accessibilityLabel)).toEqual(['Carte 1 sur 4', 'Carte 2 sur 4', 'Carte 3 sur 4', 'Carte 4 sur 4']);
    expect(fonds('segment')).toEqual([palette.emeraude[500], palette.papier[100], palette.papier[100], palette.papier[100]]);
    await suivant();
    expect(fonds('segment')).toEqual([palette.encre[1000], palette.emeraude[500], palette.papier[100], palette.papier[100]]);
  });

  it('chaque carte annonce sa position au lecteur d’écran', async () => {
    await afficher();
    await suivant();
    expect(screen.getByLabelText(`${t.apprisSurtitre}. Carte 2 sur 4`)).toBeTruthy();
  });
});

describe('carte 4 : crédits', () => {
  const aLaQuatrieme = async () => {
    await suivant();
    await suivant();
    await suivant();
  };

  it('sans Pass : crédits utilisés, solde et recharge lus dans les données', async () => {
    await afficher({ solde: 27, recharge_lundi: 25 });
    await aLaQuatrieme();
    expect(texteCompose('pour-la-suite')).toBe('Il te reste 27 crédits. Lundi, tu recevras 25 crédits de recharge.');
  });

  it('les montants viennent de la configuration, jamais d’une valeur écrite dans l’app', async () => {
    await afficher({ solde: 3, recharge_lundi: 40 });
    await aLaQuatrieme();
    expect(texteCompose('pour-la-suite')).toBe('Il te reste 3 crédits. Lundi, tu recevras 40 crédits de recharge.');
  });

  it('solde à zéro et singulier', async () => {
    await afficher({ solde: 0, recharge_lundi: 1, credits_utilises: 1 });
    await aLaQuatrieme();
    expect(screen.getByText(t.creditUn)).toBeTruthy();
    expect(texteCompose('pour-la-suite')).toBe('Il te reste 0 crédit. Lundi, tu recevras 1 crédit de recharge.');
  });

  it('avec un Pass actif : « Crédits illimités » et titre « Tout est ouvert. »', async () => {
    await afficher({ pass_actif: true, credits_utilises: 0 });
    await aLaQuatrieme();
    expect(screen.getByText(t.creditsTitrePass)).toBeTruthy();
    expect(screen.getByTestId('credits-illimites').props.children).toBe(t.illimites);
    expect(screen.getByText(t.avecPass)).toBeTruthy();
    expect(screen.getByText(t.passTexte)).toBeTruthy();
    expect(screen.queryByTestId('pour-la-suite')).toBeNull();
  });

  it('« Aller réviser » ouvre Réviser ; « Fermer » ferme', async () => {
    mockParams = { source: 'push' };
    await afficher();
    await aLaQuatrieme();
    await fireEvent.press(screen.getByText(t.allerReviser));
    expect(router.replace).toHaveBeenCalledWith('/reviser');
    expect(suivre).toHaveBeenCalledWith('week_recap_cta', { cta: 'aller_reviser', semaine: '2026-09-28' });
    await fireEvent.press(screen.getByText(t.fermer));
    expect(router.back).toHaveBeenCalled();
    expect(suivre).toHaveBeenCalledWith('week_recap_cta', { cta: 'fermer', semaine: '2026-09-28' });
    expect(suivre).toHaveBeenCalledWith('week_recap_closed', { derniere_carte: 4, semaine: '2026-09-28' });
  });
});

describe('carte 3 : à rattraper', () => {
  it('« Refaire mes erreurs » ouvre le parcours des erreurs, « Suivant » passe à la suite', async () => {
    await afficher();
    await suivant();
    await suivant();
    await fireEvent.press(screen.getByText(t.refaireErreurs));
    expect(router.push).toHaveBeenCalledWith('/mission/erreurs');
    expect(suivre).toHaveBeenCalledWith('week_recap_cta', { cta: 'refaire_erreurs', semaine: '2026-09-28' });
    await suivant();
    expect(screen.getByTestId('carte-credits')).toBeTruthy();
  });

  it('singulier', async () => {
    await afficher({ questions_ratees: 1 });
    await suivant();
    await suivant();
    expect(screen.getByText(t.rateeUne)).toBeTruthy();
  });

  it('dernière carte : « Suivant » devient « Fermer », « Refaire mes erreurs » reste', async () => {
    await afficher({ credits_utilises: 0 });
    await suivant();
    await suivant();
    expect(screen.queryByText(t.suivant)).toBeNull();
    expect(screen.getByText(t.refaireErreurs)).toBeTruthy();
    expect(screen.getByText(t.fermer)).toBeTruthy();
  });
});

describe('navigation', () => {
  const toucherA = async (x: number, y = 300, duree = 80) => {
    const corps = screen.getByTestId('recap-corps');
    await fireEvent(corps, 'touchStart', { nativeEvent: { pageX: x, pageY: y, timestamp: 1000 } });
    await fireEvent(corps, 'touchEnd', { nativeEvent: { pageX: x, pageY: y, timestamp: 1000 + duree } });
  };
  const glisser = async (de: number, a: number, y1 = 300, y2 = 300) => {
    const corps = screen.getByTestId('recap-corps');
    await fireEvent(corps, 'touchStart', { nativeEvent: { pageX: de, pageY: y1, timestamp: 1000 } });
    await fireEvent(corps, 'touchEnd', { nativeEvent: { pageX: a, pageY: y2, timestamp: 1200 } });
  };

  it('appui sur le tiers droit : carte suivante ; tiers gauche : précédente ; milieu : rien', async () => {
    await afficher();
    await toucherA(700);
    expect(screen.getByTestId('carte-appris')).toBeTruthy();
    await toucherA(375);
    expect(screen.getByTestId('carte-appris')).toBeTruthy();
    await toucherA(30);
    expect(screen.getByTestId('carte-missions')).toBeTruthy();
  });

  it('ne dépasse jamais les bornes', async () => {
    await afficher();
    await toucherA(30);
    expect(screen.getByTestId('carte-missions')).toBeTruthy();
    for (let i = 0; i < 6; i++) await toucherA(700);
    expect(screen.getByTestId('carte-credits')).toBeTruthy();
  });

  it('un appui long ou un doigt qui bouge n’est pas un appui sur un tiers', async () => {
    await afficher();
    await toucherA(700, 300, 900);
    expect(screen.getByTestId('carte-missions')).toBeTruthy();
    await glisser(700, 690, 300, 330);
    expect(screen.getByTestId('carte-missions')).toBeTruthy();
  });

  it('balayage horizontal : gauche pour avancer, droite pour revenir', async () => {
    await afficher();
    await glisser(500, 200);
    expect(screen.getByTestId('carte-appris')).toBeTruthy();
    await glisser(200, 500);
    expect(screen.getByTestId('carte-missions')).toBeTruthy();
  });

  it('un défilement vertical ne change pas de carte', async () => {
    await afficher();
    await glisser(400, 380, 600, 200);
    expect(screen.getByTestId('carte-missions')).toBeTruthy();
  });

  it('bouton retour Android : carte précédente, puis fermeture par défaut', async () => {
    const ecouteurs: (() => boolean)[] = [];
    const espion = jest.spyOn(BackHandler, 'addEventListener').mockImplementation(((_: string, f: () => boolean) => {
      ecouteurs.push(f);
      return { remove: jest.fn() };
    }) as never);
    await afficher();
    await suivant();
    await suivant();
    expect(screen.getByTestId('carte-ratees')).toBeTruthy();
    const dernier = () => ecouteurs[ecouteurs.length - 1];
    let pris = false;
    await act(async () => {
      pris = dernier()();
    });
    expect(pris).toBe(true);
    expect(screen.getByTestId('carte-appris')).toBeTruthy();
    await act(async () => {
      dernier()();
    });
    expect(screen.getByTestId('carte-missions')).toBeTruthy();
    // Première carte : le retour n'est pas pris, Android ferme la page.
    await act(async () => {
      pris = dernier()();
    });
    expect(pris).toBe(false);
    espion.mockRestore();
  });

  it('la croix ferme à tout moment', async () => {
    await afficher();
    await suivant();
    await fireEvent.press(screen.getByLabelText(t.fermer));
    expect(router.back).toHaveBeenCalled();
    expect(suivre).toHaveBeenCalledWith('week_recap_closed', { derniere_carte: 2, semaine: '2026-09-28' });
  });

  it('sans historique, la fermeture revient à l’accueil', async () => {
    (router.canGoBack as jest.Mock).mockReturnValue(false);
    await afficher();
    await fireEvent.press(screen.getByLabelText(t.fermer));
    expect(router.replace).toHaveBeenCalledWith('/');
  });
});

describe('ouverture, semaine vue, évènements et retours', () => {
  it('à l’affichage de la carte 1 : semaine marquée vue, évènement, son « arrive »', async () => {
    mockParams = { source: 'auto', semaine: '2026-09-28' };
    await afficher();
    expect(mockRpc).toHaveBeenCalledWith('my_week_recap', { p_semaine: '2026-09-28' });
    expect(suivre).toHaveBeenCalledWith('week_recap_shown', { source: 'auto', semaine: '2026-09-28' });
    expect(suivre).toHaveBeenCalledWith('week_recap_card_viewed', { index: 1, semaine: '2026-09-28' });
    expect(jouerMoment).toHaveBeenCalledWith('arrive');
    expect(jouerMoment).not.toHaveBeenCalledWith('streak');
    await waitFor(async () => expect(await AsyncStorage.getItem(CLE_DERNIERE_SEMAINE_VUE)).toBe('2026-09-28'));
  });

  it('chaque carte est comptée une fois à l’affichage', async () => {
    await afficher();
    await suivant();
    await suivant();
    expect((suivre as jest.Mock).mock.calls.filter((c) => c[0] === 'week_recap_card_viewed').map((c) => c[1].index)).toEqual([1, 2, 3]);
    expect((suivre as jest.Mock).mock.calls.filter((c) => c[0] === 'week_recap_shown')).toHaveLength(1);
  });

  it('source par défaut : push ; centre de notifications : inbox', async () => {
    await afficher();
    expect(suivre).toHaveBeenCalledWith('week_recap_shown', expect.objectContaining({ source: 'push' }));
    await screen.unmount();
    jest.clearAllMocks();
    mockParams = { source: 'inbox' };
    await monter();
    await waitFor(() => expect(suivre).toHaveBeenCalledWith('week_recap_shown', expect.objectContaining({ source: 'inbox' })));
  });

  it('sept missions sur sept : le son « série » s’ajoute', async () => {
    await afficher({ missions: 7, missions_par_jour: [1, 1, 1, 1, 1, 1, 1] });
    expect(jouerMoment).toHaveBeenCalledWith('arrive');
    expect(jouerMoment).toHaveBeenCalledWith('streak');
  });

  it('une semaine ancienne rouverte ne rend pas la récente « non vue »', async () => {
    await AsyncStorage.setItem(CLE_DERNIERE_SEMAINE_VUE, '2026-10-05');
    mockParams = { semaine: '2026-09-28', source: 'inbox' };
    await afficher();
    await waitFor(() => expect(suivre).toHaveBeenCalledWith('week_recap_shown', expect.anything()));
    expect(await AsyncStorage.getItem(CLE_DERNIERE_SEMAINE_VUE)).toBe('2026-10-05');
  });

  it('les nombres montent de 0 à leur valeur', async () => {
    jest.useFakeTimers();
    try {
      reponse();
      await monter();
      await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
      });
      expect(screen.getByTestId('hero-missions').props.children).toBeLessThan(5);
      await act(async () => {
        jest.advanceTimersByTime(900);
      });
      expect(screen.getByTestId('hero-missions').props.children).toBe(5);
    } finally {
      jest.useRealTimers();
    }
  });
});

describe('états', () => {
  it('chargement : squelettes, la croix reste active', async () => {
    mockRpc.mockReturnValue(new Promise(() => {}));
    await monter();
    expect(screen.getByTestId('recap-chargement')).toBeTruthy();
    expect(screen.getByLabelText(t.chargement)).toBeTruthy();
    await fireEvent.press(screen.getByLabelText(t.fermer));
    expect(router.back).toHaveBeenCalled();
  });

  it('récap vide : message et boutons', async () => {
    mockRpc.mockResolvedValue({ data: null, error: null });
    await monter();
    expect(await screen.findByText(t.videTitre)).toBeTruthy();
    expect(screen.getByText(t.videTexte)).toBeTruthy();
    expect(screen.queryByTestId('segment')).toBeNull();
    await fireEvent.press(screen.getByText(t.faireMission));
    expect(router.replace).toHaveBeenCalledWith('/');
    expect(suivre).toHaveBeenCalledWith('week_recap_cta', { cta: 'faire_mission', semaine: '' });
    await fireEvent.press(screen.getByText(t.fermer));
    expect(router.back).toHaveBeenCalled();
  });

  it('semaine sans activité : même état vide', async () => {
    reponse({ missions: 0, lecons_validees: 0, quiz_termines: 0, exercices_faits: 0 });
    await monter();
    expect(await screen.findByText(t.videTitre)).toBeTruthy();
  });

  it('hors ligne sans copie : « Pas de réseau », puis « Réessayer » charge le récap', async () => {
    mockRpc.mockResolvedValueOnce({ data: null, error: erreurReseau });
    await monter();
    expect(await screen.findByText(t.pasReseauTitre)).toBeTruthy();
    expect(screen.getByText(t.pasReseauTexte)).toBeTruthy();
    reponse();
    await fireEvent.press(screen.getByText(t.reessayer));
    expect(await screen.findByTestId('carte-missions')).toBeTruthy();
    expect(suivre).toHaveBeenCalledWith('week_recap_cta', { cta: 'reessayer', semaine: '' });
  });

  it('hors ligne avec copie : bande orange et cartes normales', async () => {
    await AsyncStorage.setItem(CLE_COPIE_RECAP('2026-09-28'), JSON.stringify(BRUT));
    mockParams = { semaine: '2026-09-28' };
    mockRpc.mockResolvedValue({ data: null, error: erreurReseau });
    await monter();
    expect(await screen.findByTestId('carte-missions')).toBeTruthy();
    expect(screen.getByText(t.horsLigne)).toBeTruthy();
    expect(valeur('hero-missions')).toBe('5');
  });

  it('en ligne, pas de bande hors ligne', async () => {
    await afficher();
    expect(screen.queryByText(t.horsLigne)).toBeNull();
  });

  it('une erreur du serveur donne aussi l’état « Pas de réseau » avec Réessayer', async () => {
    mockRpc.mockResolvedValueOnce({ data: null, error: { name: 'PostgrestError', message: 'boom' } });
    await monter();
    expect(await screen.findByText(t.pasReseauTitre)).toBeTruthy();
  });

  it('thème sombre : état vide lisible', async () => {
    mockRpc.mockResolvedValue({ data: null, error: null });
    await monter('sombre');
    expect(await screen.findByText(t.videTitre)).toBeTruthy();
  });
});
