import { Redirect } from 'expo-router';

import { ChatInteractif } from '@/components/labo/ChatInteractif';
import { modeDeveloppement } from '@/services/developpement';

/**
 * Labo « chat interactif » : prototype d'assistant qui explique avec des rendus interactifs (simulation, graphe)
 * dans la discussion. Même garde que la page développeur : développement et canal preview uniquement, jamais
 * en production. Réponses du vrai moteur (fonction serveur « conversation », Gemma 4) ; démonstration locale
 * en repli seulement si le moteur est injoignable.
 */
export default function LaboChat() {
  if (!modeDeveloppement()) return <Redirect href="/" />;
  return <ChatInteractif />;
}
