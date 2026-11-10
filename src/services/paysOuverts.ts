import AsyncStorage from '@react-native-async-storage/async-storage';
import type { SupabaseClient } from '@supabase/supabase-js';
import { useEffect, useState } from 'react';

import { getSupabase } from './supabase';

/**
 * Pays ouverts par configuration serveur (M14-03, issue elearn-supabase #108).
 *
 * La table `pays_config` porte la décision d'ouvrir ou de fermer un pays : l'app la lit et retire les pays
 * fermés de ses listes (arrivée, paiement du Pass). Sémantique « fermeture explicite » : seuls les pays
 * présents avec `ouvert = false` sont fermés ; un pays absent de la table reste disponible, comme avant.
 *
 * Repli strict : si la lecture échoue (hors ligne, table pas encore déployée, erreur quelconque) et qu'aucun
 * cache n'est connu, l'ensemble des pays fermés est vide — donc aucun filtrage, et les listes restent celles
 * d'aujourd'hui. La configuration ne peut jamais bloquer l'arrivée ni le paiement.
 *
 * Cache : la dernière liste connue est gardée en mémoire (une lecture réseau par lancement au plus) et dans
 * AsyncStorage, pour qu'un pays fermé le reste d'un lancement à l'autre, même hors ligne. La clé ci-dessous
 * est un réglage, pas du contenu : elle n'est pas soumise à l'expiration du §16 bis des AGENTS.
 */
export const CLE_PAYS_FERMES = 'pays.config.fermes';

type Client = Pick<SupabaseClient, 'from'>;

const ENSEMBLE_VIDE: ReadonlySet<string> = new Set<string>();

let fermesEnMemoire: ReadonlySet<string> | null = null;
let chargement: Promise<ReadonlySet<string>> | null = null;
const auditeurs = new Set<(fermes: ReadonlySet<string>) => void>();

function memesCodes(a: ReadonlySet<string>, b: ReadonlySet<string>): boolean {
  if (a.size !== b.size) return false;
  for (const code of a) if (!b.has(code)) return false;
  return true;
}

function definir(fermes: ReadonlySet<string>, persisterCache: boolean): void {
  if (fermesEnMemoire && memesCodes(fermesEnMemoire, fermes)) return;
  fermesEnMemoire = fermes;
  auditeurs.forEach((rappel) => rappel(fermes));
  if (persisterCache) {
    AsyncStorage.setItem(CLE_PAYS_FERMES, JSON.stringify([...fermes])).catch(() => {
      // Cache illisible ou plein : la mémoire suffit pour ce lancement.
    });
  }
}

async function lireCacheLocal(): Promise<ReadonlySet<string> | null> {
  try {
    const brut = await AsyncStorage.getItem(CLE_PAYS_FERMES);
    if (!brut) return null;
    const codes = JSON.parse(brut) as unknown;
    if (!Array.isArray(codes)) return null;
    return new Set(codes.filter((c): c is string => typeof c === 'string').map((c) => c.toUpperCase()));
  } catch {
    return null;
  }
}

/**
 * Pays fermés selon le serveur, ou `null` si la lecture échoue. On ne demande que les lignes fermées :
 * la réponse tient en quelques codes. Une table vide (ou sans aucun pays fermé) donne un ensemble vide,
 * jamais une erreur.
 */
export async function lirePaysFermesServeur(client?: Client): Promise<ReadonlySet<string> | null> {
  try {
    const c = client ?? getSupabase();
    const { data, error } = await c.from('pays_config').select('code').eq('ouvert', false);
    if (error || !data) return null;
    const lignes = data as { code: string }[];
    return new Set(lignes.map((l) => String(l.code).toUpperCase()));
  } catch {
    return null;
  }
}

/**
 * Charge les pays fermés : cache local d'abord (connu dès le premier lancement suivant), puis lecture
 * serveur qui met à jour mémoire, cache et abonnés. Ne rejette jamais ; sans source disponible, aucun
 * pays fermé (aucun filtrage).
 */
export function chargerPaysFermes(client?: Client): Promise<ReadonlySet<string>> {
  if (chargement) return chargement;
  chargement = (async () => {
    const local = await lireCacheLocal();
    if (local) definir(local, false);
    const reseau = await lirePaysFermesServeur(client);
    if (reseau) definir(reseau, true);
    return fermesEnMemoire ?? ENSEMBLE_VIDE;
  })().catch(() => fermesEnMemoire ?? ENSEMBLE_VIDE);
  return chargement;
}

/** Le pays est-il fermé par la configuration ? Un code inconnu ou absent n'est jamais fermé. */
export function estPaysFerme(code: string | null | undefined, fermes: ReadonlySet<string>): boolean {
  return !!code && fermes.has(code.toUpperCase());
}

/** Retire les pays fermés d'une liste de pays (arrivée, paiement). Sans pays fermé, la liste est inchangée. */
export function filtrerPaysOuverts<T extends { alpha2: string }>(liste: readonly T[], fermes: ReadonlySet<string>): T[] {
  if (fermes.size === 0) return [...liste];
  return liste.filter((p) => !estPaysFerme(p.alpha2, fermes));
}

/**
 * Pays fermés pour un écran : ensemble vide au premier rendu (aucun filtrage, donc aucun pays ne clignote
 * ni ne disparaît par erreur), puis la liste connue dès qu'elle arrive (cache ou serveur).
 */
export function usePaysFermes(): ReadonlySet<string> {
  const [fermes, setFermes] = useState<ReadonlySet<string>>(() => fermesEnMemoire ?? ENSEMBLE_VIDE);
  useEffect(() => {
    auditeurs.add(setFermes);
    void chargerPaysFermes().then((f) => setFermes(f));
    return () => {
      auditeurs.delete(setFermes);
    };
  }, []);
  return fermes;
}

/** Pour les tests uniquement. */
export function reinitialiserPaysOuvertsPourTests(): void {
  fermesEnMemoire = null;
  chargement = null;
  auditeurs.clear();
}
