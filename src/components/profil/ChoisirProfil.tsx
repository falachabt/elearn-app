import { router } from 'expo-router';
import { GraduationCap, Trophy } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useTraduction } from '@/i18n/useTraduction';
import { passerAuToeic, revenirAuSecondaire } from '@/services/changementProfil';
import { lireProfil } from '@/services/profil';
import { useTheme } from '@/theme/ThemeProvider';
import { typo } from '@/theme/theme';

import { Bouton } from '../Bouton';
import { Ecran } from '../Ecran';
import { LogoToeic } from '../certification/LogoToeic';
import { EnteteToeic, LigneChoix } from '../certification/ui';
import { FeuilleChangementProfil, type EtatChangement } from './FeuilleChangementProfil';

type Choix = 'secondaire' | 'concours' | 'toeic';
/** Feuille de confirmation posée sur P2 : P4 (passer au TOEIC) ou P5 (revenir au secondaire ou au concours). */
type Feuille = 'passer' | 'revenir';

/** P2 · Choix du profil en trois : secondaire, concours ou TOEIC. Le profil actuel porte la mention « Actuel ». */
export function ChoisirProfil() {
  const { t } = useTraduction();
  const { theme } = useTheme();
  const [actuel, setActuel] = useState<Choix | null>(null);
  const [choix, setChoix] = useState<Choix | null>(null);
  const [feuille, setFeuille] = useState<Feuille | null>(null);
  const [etat, setEtat] = useState<EtatChangement>('repos');

  useEffect(() => {
    let vivant = true;
    lireProfil().then((p) => {
      if (!vivant) return;
      const c: Choix | null = p?.type === 'certification' ? 'toeic' : p?.type === 'concours' ? 'concours' : p ? 'secondaire' : null;
      setActuel(c);
      setChoix(c);
    });
    return () => {
      vivant = false;
    };
  }, []);

  const ouvrirFeuille = (f: Feuille) => {
    setEtat('repos');
    setFeuille(f);
  };
  const fermerFeuille = () => {
    setFeuille(null);
    setEtat('repos');
  };

  const continuer = () => {
    const c = choix ?? 'secondaire';
    // Passer du secondaire ou du concours au TOEIC : la confirmation P4 se pose sur cette page.
    if (c === 'toeic') {
      if (actuel === 'toeic') router.back();
      else ouvrirFeuille('passer');
      return;
    }
    // Revenir du TOEIC : la confirmation P5 se pose sur cette page, puis le choix de classe reprend.
    if (actuel === 'toeic') {
      ouvrirFeuille('revenir');
      return;
    }
    // Secondaire et concours passent par le choix de classe ou de concours existant (M1-01), en mode modification.
    if (c === 'secondaire') router.push({ pathname: '/classe', params: { type: 'eleve', modifier: '1' } });
    else router.push({ pathname: '/classe', params: { type: 'concours', modifier: '1' } });
  };

  const confirmerPasser = async () => {
    setEtat('charge');
    try {
      await passerAuToeic();
      router.dismissAll();
      router.replace('/');
    } catch {
      setEtat('erreur');
    }
  };

  const confirmerRevenir = async () => {
    setEtat('charge');
    try {
      const restaure = choix === 'secondaire' ? await revenirAuSecondaire() : false;
      if (restaure) {
        router.dismissAll();
        router.replace('/');
        return;
      }
      // Pas de secondaire mémorisé, ou concours choisi : le choix de classe ou de concours prend le relais.
      setFeuille(null);
      setEtat('repos');
      router.push({ pathname: '/classe', params: { type: choix === 'concours' ? 'concours' : 'eleve', modifier: '1' } });
    } catch {
      setEtat('erreur');
    }
  };

  const badge = (c: Choix) => (actuel === c ? <Text style={[typo.legende, { color: theme.texte.secondaire }]}>{t('profilChoix.actuel')}</Text> : undefined);

  return (
    <View style={styles.racine}>
      <Ecran
        entete={<EnteteToeic titre={t('profilChoix.titre')} onRetour={() => router.back()} />}
        pied={<Bouton libelle={t('profilChoix.continuer')} onPress={continuer} />}
      >
        <Text style={[typo.petit, { color: theme.texte.principal }]}>{t('profilChoix.intro')}</Text>
        <LigneChoix icone={GraduationCap} titre={t('profilChoix.secondaire')} aide={t('profilChoix.secondaireAide')} radio actif={choix === 'secondaire'} droite={badge('secondaire')} onPress={() => setChoix('secondaire')} />
        <LigneChoix icone={Trophy} titre={t('profilChoix.concours')} aide={t('profilChoix.concoursAide')} radio actif={choix === 'concours'} droite={badge('concours')} onPress={() => setChoix('concours')} />
        <LigneChoix visuel={<LogoToeic />} titre={t('profilChoix.toeic')} aide={t('profilChoix.toeicAide')} radio actif={choix === 'toeic'} droite={badge('toeic')} onPress={() => setChoix('toeic')} />
      </Ecran>
      {feuille ? (
        <View style={styles.voile}>
          <FeuilleChangementProfil
            etat={etat}
            titre={feuille === 'passer' ? t('profilChoix.passerToeicTitre') : t('profilChoix.revenirTitre')}
            confirmer={feuille === 'passer' ? t('profilChoix.passerToeicBouton') : t('profilChoix.revenirBouton')}
            annuler={t('profilChoix.annuler')}
            onConfirmer={() => void (feuille === 'passer' ? confirmerPasser() : confirmerRevenir())}
            onAnnuler={fermerFeuille}
          >
            {feuille === 'passer' ? (
              <LigneChoix
                visuel={<LogoToeic />}
                titre={t('profilChoix.toeicTitre')}
                aide={t('profilChoix.toeicAideSeul')}
                radio
                actif
                onPress={() => undefined}
                droite={actuel === 'toeic' ? <Text style={[typo.legende, { color: theme.texte.secondaire }]}>{t('profilChoix.actuel')}</Text> : undefined}
              />
            ) : null}
          </FeuilleChangementProfil>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  racine: { flex: 1 },
  voile: { ...StyleSheet.absoluteFill, justifyContent: 'flex-end', backgroundColor: 'rgba(10,10,10,0.45)', padding: 16 },
});
