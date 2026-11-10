import { router } from 'expo-router';
import { useEffect, useState } from 'react';

import { useTraduction } from '@/i18n/useTraduction';
import { suivre } from '@/services/analytics';
import { lireDiagnostic } from '@/services/certification/etat';

import { Bouton } from '../Bouton';
import { Ecran } from '../Ecran';
import { EnteteToeic } from './ui';
import { PreparationDiagnostic } from './PreparationDiagnostic';

/** A5 · Arrivée sur le profil TOEIC, avant le diagnostic : aucun chiffre de performance (profil neuf). */
export function ArriveeToeic() {
  const { t } = useTraduction();
  const [reprise, setReprise] = useState(false);

  useEffect(() => {
    let actif = true;
    lireDiagnostic().then((d) => actif && setReprise(!!d && !d.fin));
    return () => {
      actif = false;
    };
  }, []);

  const commencer = () => {
    suivre('cert_diagnostic_started', {});
    router.push('/certification/diagnostic');
  };

  return (
    <Ecran entete={<EnteteToeic titre={t('certification.arrivee.entete')} />} pied={<Bouton libelle={t(reprise ? 'certification.arrivee.reprendre' : 'certification.arrivee.commencer')} onPress={commencer} retour />}>
      <PreparationDiagnostic />
    </Ecran>
  );
}
