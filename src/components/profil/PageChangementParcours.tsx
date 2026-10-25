import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTraduction } from '@/i18n/useTraduction';
import { lireMemoireProfil, type MemoireProfil } from '@/services/changementProfil';
import { lireProfil, type Profil } from '@/services/profil';
import { useTheme } from '@/theme/ThemeProvider';
import { cibleMin, espace, typo } from '@/theme/theme';

import { BoutonFermer } from '../arrivee/MiniTest';
import { Onglets } from '../Onglets';
import { ChoixConcours } from '../concours/ChoixConcours';
import { ChoixClasseContenu } from '../ParcoursArrivee';
import { OngletCertification } from './OngletCertification';

export type OngletParcours = 'secondaire' | 'concours' | 'certification';

const ONGLETS: OngletParcours[] = ['secondaire', 'concours', 'certification'];

function familleDe(p: Profil | null): OngletParcours {
  return p?.type === 'certification' ? 'certification' : p?.type === 'concours' ? 'concours' : 'secondaire';
}

function estOnglet(v: string | undefined): v is OngletParcours {
  return v === 'secondaire' || v === 'concours' || v === 'certification';
}

/**
 * Page de changement de parcours (issue #125, maquette validée par Benny le 25/10/2026) : une seule page,
 * trois onglets en haut (Secondaire / Concours / Certification), chaque onglet affiche SA liste et on reste
 * sur la page. L'onglet ouvert par défaut est celui de la famille actuelle ; un point soleil marque la
 * famille ACTIVE, distinct de l'onglet consulté. Changer d'onglet ne bascule jamais le profil : changer de
 * famille passe par le bloc d'adoption de l'onglet (conséquences + confirmation).
 * Entrées : le chip de l'accueil (sans paramètre : onglet de la famille actuelle) et Moi → « Mon profil »
 * (paramètre `onglet` du parcours touché, `source=moi` pour le fil d'Ariane).
 */
export function PageChangementParcours() {
  const { t } = useTraduction();
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ onglet?: string; source?: string }>();
  const [profil, setProfil] = useState<Profil | null>(null);
  const [memoire, setMemoire] = useState<MemoireProfil>({});
  const [onglet, setOnglet] = useState<OngletParcours | null>(null);
  const initialise = useRef(false);

  useEffect(() => {
    if (initialise.current) return;
    initialise.current = true;
    let vivant = true;
    Promise.all([lireProfil(), lireMemoireProfil()]).then(([p, m]) => {
      if (!vivant) return;
      setProfil(p);
      setMemoire(m);
      setOnglet(estOnglet(params.onglet) ? params.onglet : familleDe(p));
    });
    return () => {
      vivant = false;
    };
  }, [params.onglet]);

  if (!onglet) return <View style={[styles.page, { backgroundColor: theme.fond.app }]} />;

  const famille = familleDe(profil);
  const retour = () => (router.canGoBack() ? router.back() : router.replace('/'));
  const libelleOnglet = (o: OngletParcours) => t(o === 'secondaire' ? 'profilChoix.typeSecondaire' : o === 'concours' ? 'profilChoix.typeConcours' : 'profilChoix.certificationTitre');
  const memoireConcours = memoire.secondaire?.type === 'concours' ? memoire.secondaire : null;

  return (
    <View style={[styles.page, { backgroundColor: theme.fond.app }]}>
      <View style={[styles.entete, { paddingTop: insets.top + espace[4] }]}>
        <View style={styles.ligneEntete}>
          <BoutonFermer icone="chevron-back" libelle={t('classe.retour')} onPress={retour} />
          {params.source === 'moi' ? (
            <Text style={[typo.legende, { color: theme.texte.secondaire }]}>
              {t('onglets.moi')} › {t('profilChoix.monProfil')} › {libelleOnglet(onglet)}
            </Text>
          ) : null}
        </View>
        <Onglets valeurs={ONGLETS.map((o) => ({ valeur: o, libelle: libelleOnglet(o) }))} valeur={onglet} onChange={setOnglet} marque={famille} />
      </View>
      <View style={styles.contenu}>
        {onglet === 'secondaire' ? (
          <ChoixClasseContenu
            key="secondaire"
            typeInitial="eleve"
            modifier
            dansPage
            prefill={memoire.secondaire?.type === 'eleve' ? memoire.secondaire : null}
            onAnnulerAdoption={() => setOnglet(famille)}
          />
        ) : null}
        {onglet === 'concours' ? (
          <ChoixConcours
            key="concours"
            dansPage
            adoption={famille !== 'concours'}
            filierePrefill={memoireConcours?.niveau ?? null}
            concoursPrefill={memoireConcours?.concours ?? null}
            onAnnulerAdoption={() => setOnglet(famille)}
          />
        ) : null}
        {onglet === 'certification' && profil ? <OngletCertification key="certification" profil={profil} onAnnulerAdoption={() => setOnglet(famille)} /> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1 },
  entete: { paddingHorizontal: espace[6], gap: espace[4], paddingBottom: espace[3] },
  ligneEntete: { flexDirection: 'row', alignItems: 'center', gap: espace[4], minHeight: cibleMin - 6 },
  contenu: { flex: 1 },
});
