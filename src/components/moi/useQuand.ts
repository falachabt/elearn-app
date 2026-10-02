import { useTraduction } from '@/i18n/useTraduction';
import { joursAvant } from '@/services/quand';

/** « aujourd'hui », « demain », « dans 3 jours ». */
export function useQuand() {
  const { t } = useTraduction();
  return (iso: string) => {
    const n = joursAvant(iso);
    return n === 0 ? t('profil.quand0') : n === 1 ? t('profil.quand1') : t('profil.quandN', { n });
  };
}
