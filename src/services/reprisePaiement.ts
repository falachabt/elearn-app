import AsyncStorage from '@react-native-async-storage/async-storage';

const CLE_PAIEMENT_ATTENTE = 'paiement.attente';

export type PaiementEnAttente = {
  commande: string;
  offre: string;
  pays: string;
  telephone: string;
  operateur: string;
  devise?: string;
  montant?: number;
  timestamp: number;
};

export async function sauverPaiementAttente(p: Omit<PaiementEnAttente, 'timestamp'>) {
  await AsyncStorage.setItem(CLE_PAIEMENT_ATTENTE, JSON.stringify({ ...p, timestamp: Date.now() }));
}

export async function lirePaiementAttente(): Promise<PaiementEnAttente | null> {
  const json = await AsyncStorage.getItem(CLE_PAIEMENT_ATTENTE);
  if (!json) return null;
  try {
    const data = JSON.parse(json) as PaiementEnAttente;
    // Considérer comme expiré localement après 15 minutes
    if (Date.now() - data.timestamp > 15 * 60 * 1000) {
      await effacerPaiementAttente();
      return null;
    }
    return data;
  } catch {
    return null;
  }
}

export async function effacerPaiementAttente() {
  await AsyncStorage.removeItem(CLE_PAIEMENT_ATTENTE);
}
