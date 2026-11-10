import AsyncStorage from '@react-native-async-storage/async-storage';
import type { SupabaseClient } from '@supabase/supabase-js';

import { estErreurReseau, serveurJoignable } from './connectivite';

/**
 * Calendrier de la classe de l'élève (issue #65, étape 2 : RPC calendrier_de_ma_classe). Les dates viennent de la base,
 * par pays et par niveau. Un statut « reprise » signifie : date de l'an passé, à confirmer.
 */
export type EcheanceClasse = {
  type: 'examen' | 'fin_de_cours';
  libelle: string;
  dateCible: Date;
  statut: 'reprise' | 'confirmee';
  anneeScolaire: string;
};

type LigneCalendrier = { type: string; libelle: string; date_cible: string; statut: string; annee_scolaire: string };

/** « 2027-06-14 » → minuit, heure locale, de ce jour (pas de décalage de fuseau). */
export function dateLocale(iso: string): Date {
  const [annee, mois, jour] = iso.split('-').map(Number);
  return new Date(annee, mois - 1, jour);
}

export function versEcheance(l: LigneCalendrier): EcheanceClasse | null {
  if (l.type !== 'examen' && l.type !== 'fin_de_cours') return null;
  return {
    type: l.type,
    libelle: l.libelle,
    dateCible: dateLocale(l.date_cible),
    statut: l.statut === 'confirmee' ? 'confirmee' : 'reprise',
    anneeScolaire: l.annee_scolaire,
  };
}

/**
 * La prochaine échéance à afficher : la plus proche date encore à venir. À date égale, l'examen passe avant la fin de cours.
 * Null si rien n'est à venir (l'accueil n'affiche alors pas de compte à rebours).
 */
export function prochaineEcheance(echeances: readonly EcheanceClasse[], maintenant: Date): EcheanceClasse | null {
  const futures = echeances.filter((e) => e.dateCible.getTime() > maintenant.getTime());
  futures.sort((a, b) => a.dateCible.getTime() - b.dateCible.getTime() || (a.type === 'examen' ? -1 : 1) - (b.type === 'examen' ? -1 : 1));
  return futures[0] ?? null;
}

export const CLE_CALENDRIER_CLASSE = (niveau: string, pays: string) => `calendrier.classe.${niveau}.${pays}`;

function versEcheances(lignes: LigneCalendrier[]): EcheanceClasse[] {
  return lignes.map(versEcheance).filter((e): e is EcheanceClasse => e !== null);
}

async function lireCopieCalendrier(niveau: string, pays: string): Promise<EcheanceClasse[] | null> {
  try {
    const brut = await AsyncStorage.getItem(CLE_CALENDRIER_CLASSE(niveau, pays));
    if (!brut) return null;
    const lu: unknown = JSON.parse(brut);
    return Array.isArray(lu) ? versEcheances(lu as LigneCalendrier[]) : null;
  } catch {
    return null;
  }
}

/**
 * Lit le calendrier d'une classe. Renvoie une liste vide si la base n'a rien pour ce niveau et ce pays.
 *
 * La dernière réponse est gardée sur l'appareil (issue #74) : hors ligne, elle est servie à la place. Sans elle,
 * l'accueil cachait le compte à rebours et la carte planning dès que le réseau coupait, alors que le planning,
 * lui, a sa copie. Une erreur qui n'est pas le réseau remonte toujours, copie ou pas.
 */
export async function lireCalendrierClasse(client: Pick<SupabaseClient, 'rpc'>, niveau: string, pays: string): Promise<EcheanceClasse[]> {
  try {
    // Coupure déjà connue : la copie part tout de suite, sans attendre l'échec de la requête. Sans copie,
    // le serveur est tenté quand même : l'état connu peut dater et le réseau être revenu.
    if (!serveurJoignable()) {
      const copie = await lireCopieCalendrier(niveau, pays);
      if (copie) return copie;
    }
    const { data, error } = await client.rpc('calendrier_de_ma_classe', { p_niveau: niveau, p_pays: pays });
    if (error) throw error;
    const lignes = (data as LigneCalendrier[] | null) ?? [];
    try {
      await AsyncStorage.setItem(CLE_CALENDRIER_CLASSE(niveau, pays), JSON.stringify(lignes));
    } catch {
      // Copie facultative.
    }
    return versEcheances(lignes);
  } catch (erreur) {
    if (!estErreurReseau(erreur)) throw erreur;
    const copie = await lireCopieCalendrier(niveau, pays);
    if (copie) return copie;
    throw erreur;
  }
}
