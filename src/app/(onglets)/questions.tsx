import { EcranVide } from '@/components/EcranVide';
import { useTraduction } from '@/i18n/useTraduction';

export default function EcranQuestions() {
  const { t } = useTraduction();
  return <EcranVide titre={t('onglets.questions')} phrase={t('ecrans.questions')} />;
}
