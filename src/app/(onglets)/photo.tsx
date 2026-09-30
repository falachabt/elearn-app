import { EcranVide } from '@/components/EcranVide';
import { useTraduction } from '@/i18n/useTraduction';

export default function EcranPhoto() {
  const { t } = useTraduction();
  return <EcranVide titre={t('onglets.photo')} phrase={t('ecrans.photo')} />;
}
