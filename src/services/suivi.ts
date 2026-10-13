import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Localization from 'expo-localization';
import * as Notifications from 'expo-notifications';
import { AppState, Platform } from 'react-native';

import { i18n } from '@/i18n';

import {
  analyticsActif,
  definirProprietesGlobales,
  definirProprietesUtilisateur,
  suivre,
  vider,
  type Propriete,
} from './analytics';
import { ecouterConnectivite, lireConnectivite } from './connectivite';
import { lireProfil } from './profil';
import { abonnerModifications } from './reglagesLocaux';
import { lireVersion } from './version';

export const CLE_PREMIER_LANCEMENT = 'analytics.premierLancement';

/** Langue et région du téléphone (pas celles de l'app) : ce que Benny veut savoir pour décider des langues à servir. */
function lirePhone() {
  try {
    const l = Localization.getLocales?.()[0];
    return { langue: l?.languageCode ?? null, region: l?.regionCode ?? null };
  } catch {
    return { langue: null, region: null };
  }
}

/**
 * Propriétés de la personne : classe, statut (élève ou candidat), concours, pays choisi, langues, plateforme, version.
 * Aucune donnée personnelle : pas de nom, d'e-mail ni de numéro. Renvoyées seulement quand elles changent.
 */
export async function synchroniserProprietes(): Promise<void> {
  if (!analyticsActif()) return;
  const profil = await lireProfil().catch(() => null);
  const phone = lirePhone();
  const v = lireVersion();
  const proprietes: Record<string, Propriete> = {
    plateforme: Platform.OS,
    version_app: v.version,
    canal: v.canal,
    langue_telephone: phone.langue,
    region_telephone: phone.region,
    langue_app: i18n.language,
  };
  if (profil) {
    proprietes.statut = profil.type;
    proprietes.classe = profil.type === 'eleve' ? (profil.niveau ?? null) : null;
    proprietes.filiere = profil.type === 'concours' ? (profil.niveau ?? null) : null;
    proprietes.concours = profil.concours?.sigle ?? null;
    proprietes.pays = profil.pays ?? null;
  }
  definirProprietesUtilisateur(proprietes);
  definirProprietesGlobales({ version_app: v.version, canal: v.canal, plateforme: Platform.OS, langue_app: i18n.language, langue_telephone: phone.langue });
}

/**
 * Nom d'un écran d'après les segments de la route (`/cours/lecon`, `/offres/[id]`), jamais l'adresse réelle : aucun
 * identifiant, code de parrainage ni paramètre de recherche ne part dans l'analytics. Les groupes `(onglets)` sont retirés.
 */
export function nomEcran(segments: readonly string[]): string {
  const utiles = segments.filter((s) => !(s.startsWith('(') && s.endsWith(')')));
  return '/' + (utiles.length ? utiles.join('/') : 'index');
}

async function suivrePremierLancement() {
  try {
    if (await AsyncStorage.getItem(CLE_PREMIER_LANCEMENT)) return;
    await AsyncStorage.setItem(CLE_PREMIER_LANCEMENT, new Date().toISOString());
    const phone = lirePhone();
    suivre('app_first_open', { pays: phone.region, langue: phone.langue ?? i18n.language, plateforme: Platform.OS });
  } catch {
    // Au pire, le premier lancement n'est pas compté.
  }
}

const enLigne = () => {
  const e = lireConnectivite();
  return e.connecte && e.backend !== false;
};

/**
 * Démarre le suivi : propriétés, premier lancement, coupures réseau, envoi de la file au retour du réseau et au passage en
 * arrière-plan, notifications reçues, installation de la PWA. Renvoie la fonction d'arrêt.
 */
export function demarrerSuivi(): () => void {
  if (!analyticsActif()) return () => {};
  const arrets: (() => void)[] = [];

  void synchroniserProprietes();
  void suivrePremierLancement();
  arrets.push(abonnerModifications(() => void synchroniserProprietes()));
  const surLangue = () => void synchroniserProprietes();
  i18n.on('languageChanged', surLangue);
  arrets.push(() => i18n.off('languageChanged', surLangue));

  // Coupures du réseau : début et durée. Les évènements pendant la coupure restent dans la file locale (horodatage
  // d'origine) ; au retour, on vide la file tout de suite au lieu d'attendre le prochain lot.
  let precedent = enLigne();
  let coupureDepuis: number | null = precedent ? null : Date.now();
  arrets.push(
    ecouterConnectivite(() => {
      const maintenant = enLigne();
      if (maintenant === precedent) return;
      precedent = maintenant;
      if (!maintenant) {
        coupureDepuis = Date.now();
        suivre('connectivity_lost', {});
      } else {
        const duree = coupureDepuis ? Math.round((Date.now() - coupureDepuis) / 1000) : 0;
        coupureDepuis = null;
        suivre('connectivity_restored', { duree_s: duree });
        void vider();
      }
    }),
  );

  const etatApp = AppState.addEventListener('change', (etat) => {
    if (etat !== 'active') void vider();
  });
  arrets.push(() => etatApp.remove());

  if (Platform.OS !== 'web') {
    try {
      const reception = Notifications.addNotificationReceivedListener((n) => {
        const type = (n.request.content.data as Record<string, unknown> | undefined)?.type;
        suivre('notification_received', { type: typeof type === 'string' ? type : 'inconnu', premier_plan: AppState.currentState === 'active' });
      });
      arrets.push(() => reception.remove());
    } catch {
      // Module de notifications absent : rien à suivre.
    }
  } else if (typeof window !== 'undefined' && window.addEventListener) {
    const propose = () => suivre('pwa_install_prompt', { choix: 'propose' });
    const installee = () => suivre('pwa_installed', {});
    window.addEventListener('beforeinstallprompt', propose);
    window.addEventListener('appinstalled', installee);
    arrets.push(() => {
      window.removeEventListener('beforeinstallprompt', propose);
      window.removeEventListener('appinstalled', installee);
    });
  }

  return () => arrets.forEach((a) => a());
}
