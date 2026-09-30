import { EcranVide } from '@/components/EcranVide';
import { useTraduction } from '@/i18n/useTraduction';

export default function EcranMoi() {
  const { t } = useTraduction();
  return <EcranVide titre={t('onglets.moi')} phrase={t('ecrans.moi')} />;
}
