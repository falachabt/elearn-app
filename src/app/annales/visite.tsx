import { router } from 'expo-router';

import { VisiteInteractive } from '@/components/annales/travail/VisiteInteractive';
import { suivre } from '@/services/analytics';
import { marquerVisiteVue } from '@/services/travailSujet';

/** Visite guidée interactive de la prise de photos : vue une fois, « Passer » comptant comme vue. */
export default function EcranVisiteTravail() {
  const fin = (terminee: boolean) => {
    void marquerVisiteVue();
    suivre('annale_visite_vue', { terminee });
    if (router.canGoBack()) router.back();
    else router.replace('/annales/photos');
  };
  return <VisiteInteractive onFin={fin} />;
}
