import { Redirect } from 'expo-router';

import { ChatInteractif } from '@/components/labo/ChatInteractif';
import { modeDeveloppement } from '@/services/developpement';

/**
 * Labo « chat interactif » : prototype d'assistant qui explique avec des rendus interactifs (simulation, graphe)
 * dans la discussion. Même garde que la page développeur : développement et canal preview uniquement, jamais
 * en production. Réponses de démonstration locales, aucun appel réseau.
 */
export default function LaboChat() {
  if (!modeDeveloppement()) return <Redirect href="/" />;
  return <ChatInteractif />;
}
