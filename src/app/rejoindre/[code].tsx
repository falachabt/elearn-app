import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';

import { Ecran } from '@/components/Ecran';
import { Feuille } from '@/components/Feuille';
import { useTraduction } from '@/i18n/useTraduction';
import { conserverCode } from '@/services/parrainage';
import { getSupabase } from '@/services/supabase';

export default function Rejoindre() {
  const { code } = useLocalSearchParams<{ code?: string }>();
  const router = useRouter();
  const { t } = useTraduction();

  const [etat, setEtat] = useState<'chargement' | 'succes' | 'deja_connecte' | 'fini'>('chargement');
  const [email, setEmail] = useState('');
  const [codeValide, setCodeValide] = useState('');
  const [estInvite, setEstInvite] = useState(true);

  useEffect(() => {
    let actif = true;
    (async () => {
      try {
        const client = getSupabase();
        const { data } = await client.auth.getSession();
        const invite = !data.session?.user || data.session.user.is_anonymous === true;
        
        if (code) {
          const resCode = await conserverCode(String(code), 'lien');
          if (actif && resCode) {
            setCodeValide(resCode);
            setEstInvite(invite);
            if (invite) {
              setEtat('succes');
            } else {
              setEmail(data.session?.user.email ?? '');
              setEtat('deja_connecte');
            }
            return; // on attend que l'utilisateur ferme la feuille
          }
        }
      } catch {
        // Erreur réseau, on continue
      } finally {
        if (actif && etat === 'chargement') setEtat('fini');
      }
    })();

    return () => {
      actif = false;
    };
  }, [code, etat]);

  if (etat === 'chargement') return <Ecran defilement={false}><></></Ecran>;
  if (etat === 'fini') return <Redirect href={estInvite ? "/compte/creer" : "/"} />;

  return (
    <Ecran defilement={false}>
      <Feuille
        ouverte={etat === 'succes'}
        titre={t('lienParrainage.succesTitre')}
        texte={t('lienParrainage.succesTexte', { code: codeValide })}
        icone="gift"
        actions={[
          {
            libelle: t('lienParrainage.creerCompte'),
            onPress: () => {
              setEtat('fini');
              router.replace('/compte/creer');
            },
          },
        ]}
        onFermer={() => {
          setEtat('fini');
          router.replace('/');
        }}
      />
      <Feuille
        ouverte={etat === 'deja_connecte'}
        titre={t('lienParrainage.dejaTitre')}
        texte={t('lienParrainage.dejaTexte', { email })}
        icone="information-circle"
        actions={[
          {
            libelle: t('lienParrainage.continuer'),
            onPress: () => {
              setEtat('fini');
              router.replace('/');
            },
          },
        ]}
        onFermer={() => {
          setEtat('fini');
          router.replace('/');
        }}
      />
    </Ecran>
  );
}
