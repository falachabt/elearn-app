import { router } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useTraduction } from '@/i18n/useTraduction';
import { terminer } from '@/services/certification/diagnostic';
import { lireDiagnostic, type EtatDiagnostic } from '@/services/certification/etat';
import { useTheme } from '@/theme/ThemeProvider';
import { bord, espace, rayon, typo } from '@/theme/theme';

import { Banniere } from '../Banniere';
import { Bouton } from '../Bouton';
import { Ecran } from '../Ecran';
import { EnteteToeic } from './ui';

/**
 * A8 · Fin du diagnostic. Les 20 réponses sont déjà gardées sur l'appareil ; on calcule le résultat en arrière-plan et
 * le bouton le rejoue si le réseau a manqué (idempotent). Relancer l'app ici rouvre A8, pas A6.
 */
export function FinDiagnostic() {
  const { t } = useTraduction();
  const { theme } = useTheme();
  const [etat, setEtat] = useState<EtatDiagnostic | null>(null);
  const [envoi, setEnvoi] = useState(false);
  const [echec, setEchec] = useState(false);
  const deja = useRef(false);

  const envoyer = useCallback(async (e: EtatDiagnostic): Promise<EtatDiagnostic | null> => {
    setEnvoi(true);
    setEchec(false);
    try {
      const suivant = await terminer(e);
      setEtat(suivant);
      return suivant;
    } catch {
      setEchec(true);
      return null;
    } finally {
      setEnvoi(false);
    }
  }, []);

  useEffect(() => {
    let actif = true;
    void lireDiagnostic().then((e) => {
      if (!actif) return;
      if (!e || !e.termine) {
        router.replace('/certification/diagnostic');
        return;
      }
      setEtat(e);
      if (!e.fin && !deja.current) {
        deja.current = true;
        void envoyer(e);
      }
    });
    return () => {
      actif = false;
    };
  }, [envoyer]);

  const voir = async () => {
    if (!etat) return;
    const pret = etat.fin ? etat : await envoyer(etat);
    if (pret?.fin) router.replace('/certification/resultat');
  };

  return (
    <Ecran
      entete={<EnteteToeic titre={t('certification.diagnostic.termineEntete')} />}
      pied={<Bouton libelle={t('certification.diagnostic.voirResultat')} desactive={!etat || envoi} onPress={voir} retour />}
    >
      <View style={[styles.carte, { backgroundColor: theme.accent.soleilDoux, borderColor: theme.bord.fort }]}>
        <Text accessibilityRole="header" style={[typo.h1, { color: theme.texte.surCouleur }]}>{t('certification.diagnostic.termineTitre')}</Text>
        <Text style={[typo.texte, { color: theme.texte.surCouleur }]}>{t('certification.diagnostic.termineTexte')}</Text>
      </View>
      {echec ? <Banniere ton="alerte" titre={t('certification.diagnostic.horsLigneTitre')} texte={t('certification.diagnostic.envoiEchec')} /> : null}
    </Ecran>
  );
}

const styles = StyleSheet.create({
  carte: { gap: espace[3], padding: espace[6], borderWidth: bord.normal, borderRadius: rayon.l },
});
