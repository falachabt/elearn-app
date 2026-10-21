import { MiniRevue } from '@/components/certification/MiniRevue';
import { lireDiagnostic } from '@/services/certification/etat';

/** Revue question par question du diagnostic terminé, depuis le résultat (même écran que la revue de l'Examen). */
export default function DiagnosticRevue() {
  return <MiniRevue lire={lireDiagnostic} retourFin="resultat" />;
}
