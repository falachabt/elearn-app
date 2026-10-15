import type { SupabaseClient } from '@supabase/supabase-js';

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

/** Lit le calendrier d'une classe. Renvoie une liste vide si la base n'a rien pour ce niveau et ce pays. */
export async function lireCalendrierClasse(client: Pick<SupabaseClient, 'rpc'>, niveau: string, pays: string): Promise<EcheanceClasse[]> {
  const { data, error } = await client.rpc('calendrier_de_ma_classe', { p_niveau: niveau, p_pays: pays });
  if (error) throw error;
  return ((data as LigneCalendrier[] | null) ?? []).map(versEcheance).filter((e): e is EcheanceClasse => e !== null);
}
