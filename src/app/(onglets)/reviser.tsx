import { EcranVide } from '@/components/EcranVide';
import { useTraduction } from '@/i18n/useTraduction';

export default function EcranReviser() {
  const { t } = useTraduction();
  return <EcranVide titre={t('onglets.reviser')} phrase={t('ecrans.reviser')} />;
}
