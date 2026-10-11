import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';

import {
  appliquerEvenement,
  compterNonLues,
  garderNotifications,
  lireNotifications,
  lireNotificationsGardees,
  marquerLue as marquerLueServeur,
  suivreNotifications,
  toutMarquerLu,
  type Notification,
} from '@/services/notifications';
import { getSupabase } from '@/services/supabase';

import { useSession } from './SessionProvider';

type Notifications = {
  /** Nombre de non lues (pastille de la cloche) ; 0 tant que rien n'est chargé. */
  nonLues: number;
  /** null tant que la liste n'est ni chargée ni lue depuis l'appareil. */
  notifications: Notification[] | null;
  /** Vrai quand le serveur n'a pas répondu : la liste affichée est la dernière connue sur l'appareil. */
  horsLigne: boolean;
  /** Vrai quand la dernière lecture a échoué sans copie locale à montrer. */
  erreur: boolean;
  rafraichir: () => Promise<void>;
  marquerLue: (id: string) => Promise<void>;
  toutLire: () => Promise<void>;
};

const ContexteNotifications = createContext<Notifications>({
  nonLues: 0,
  notifications: null,
  horsLigne: false,
  erreur: false,
  rafraichir: async () => {},
  marquerLue: async () => {},
  toutLire: async () => {},
});

type Etat = { pour: string; liste: Notification[] | null; nonLues: number; horsLigne: boolean; erreur: boolean };

/**
 * Un seul abonnement temps réel aux notifications pour toute l'app (N0, N1). Réservé aux comptes : un invité n'a
 * pas de notifications liées à un compte, rien n'est lu ni écouté pour lui.
 */
export function NotificationsProvider({ children }: { children: ReactNode }) {
  const { session } = useSession();
  const utilisateur = session?.user.id ?? null;
  const invite = session?.user.is_anonymous ?? true;
  const actif = !!utilisateur && !invite;
  // L'état est rangé avec son propriétaire : à un changement de compte, l'ancien ne s'affiche plus.
  const [etat, setEtat] = useState<Etat | null>(null);
  const courant = etat && etat.pour === utilisateur ? etat : null;

  const majListe = useCallback(
    (pour: string, f: (liste: Notification[]) => Notification[]) =>
      setEtat((e) => {
        if (!e || e.pour !== pour) return e;
        const liste = f(e.liste ?? []);
        void garderNotifications(pour, liste);
        return { ...e, liste };
      }),
    [],
  );

  const rafraichir = useCallback(async () => {
    if (!utilisateur || !actif) return;
    const client = getSupabase();
    try {
      const [liste, nonLues] = await Promise.all([lireNotifications(client), compterNonLues(client)]);
      setEtat({ pour: utilisateur, liste, nonLues, horsLigne: false, erreur: false });
      void garderNotifications(utilisateur, liste);
    } catch {
      // Hors ligne : la dernière liste connue de cet élève, la pastille se déduit de ses non lues.
      const gardee = await lireNotificationsGardees(utilisateur);
      setEtat((e) => {
        const liste = gardee ?? (e && e.pour === utilisateur ? e.liste : null);
        return { pour: utilisateur, liste, nonLues: (liste ?? []).filter((n) => !n.lue).length, horsLigne: !!gardee, erreur: !gardee };
      });
    }
  }, [utilisateur, actif]);

  useEffect(() => {
    if (!utilisateur || !actif) return;
    // Lecture de départ hors du corps de l'effet : l'état se met à jour quand le serveur répond.
    void Promise.resolve().then(rafraichir);
    // Le nombre de non lues se relit après chaque évènement : la liste est tronquée, le serveur compte tout.
    return suivreNotifications(getSupabase(), utilisateur, (e) => {
      majListe(utilisateur, (liste) => appliquerEvenement(liste, e));
      compterNonLues(getSupabase())
        .then((n) => setEtat((s) => (s && s.pour === utilisateur ? { ...s, nonLues: n, horsLigne: false } : s)))
        .catch(() => {});
    });
  }, [utilisateur, actif, rafraichir, majListe]);

  // Retour dans l'app : une notification a pu arriver sans que le temps réel ne passe.
  useEffect(() => {
    if (!utilisateur || !actif) return;
    const abonnement = AppState.addEventListener('change', (s) => {
      if (s === 'active') void rafraichir();
    });
    return () => abonnement.remove();
  }, [utilisateur, actif, rafraichir]);

  const marquerLue = useCallback(
    async (id: string) => {
      if (!utilisateur) return;
      const cible = courant?.liste?.find((n) => n.id === id);
      // Déjà lue : rien à écrire ni à décompter.
      if (cible?.lue) return;
      majListe(utilisateur, (liste) => liste.map((n) => (n.id === id ? { ...n, lue: true } : n)));
      if (cible) setEtat((s) => (s && s.pour === utilisateur ? { ...s, nonLues: Math.max(0, s.nonLues - 1) } : s));
      try {
        await marquerLueServeur(getSupabase(), id);
      } catch {
        // Le serveur n'a pas pris le changement : on revient à ce qu'il dit (ou à la copie locale).
        await rafraichir();
      }
    },
    [utilisateur, courant, majListe, rafraichir],
  );

  const toutLire = useCallback(async () => {
    if (!utilisateur) return;
    majListe(utilisateur, (liste) => liste.map((n) => ({ ...n, lue: true })));
    setEtat((s) => (s && s.pour === utilisateur ? { ...s, nonLues: 0 } : s));
    try {
      await toutMarquerLu(getSupabase());
    } catch {
      await rafraichir();
    }
  }, [utilisateur, majListe, rafraichir]);

  const valeur = useMemo(
    () => ({
      nonLues: courant?.nonLues ?? 0,
      notifications: courant?.liste ?? null,
      horsLigne: courant?.horsLigne ?? false,
      erreur: courant?.erreur ?? false,
      rafraichir,
      marquerLue,
      toutLire,
    }),
    [courant, rafraichir, marquerLue, toutLire],
  );
  return <ContexteNotifications.Provider value={valeur}>{children}</ContexteNotifications.Provider>;
}

export const useNotifications = () => useContext(ContexteNotifications);
