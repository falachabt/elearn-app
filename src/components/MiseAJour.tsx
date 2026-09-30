import { useMiseAJour } from '@/services/miseAJour';

import { FeuilleMiseAJour } from './FeuilleMiseAJour';

/** À monter une fois dans les providers : branche le hook sur la feuille. Ne rend rien sans mise à jour. */
export function MiseAJour() {
  const { etat, obligatoire, visible, installer, plusTard } = useMiseAJour();
  return <FeuilleMiseAJour etat={visible ? etat : 'aucune'} obligatoire={obligatoire} onInstaller={installer} onPlusTard={plusTard} />;
}
