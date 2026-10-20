import { router } from 'expo-router';
import { getLocales } from 'expo-localization';
import { Image } from 'expo-image';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useTraduction } from '@/i18n/useTraduction';
import { suivre } from '@/services/analytics';
import { obtenirExamens } from '@/services/certification/etat';
import { formaterDuree } from '@/services/certification/format';
import type { Examen } from '@/services/certification/types';
import { drapeauPays, listerPays, nomPays } from '@/services/pays';
import { enregistrerProfil, lireProfil, paysParDefaut } from '@/services/profil';
import { useTheme } from '@/theme/ThemeProvider';
import { espace, typo } from '@/theme/theme';

import { Banniere } from '../Banniere';
import { Bouton } from '../Bouton';
import { Ecran } from '../Ecran';
import { FeuillePays } from '../pass/FeuillePays';
import { LogoToeic } from './LogoToeic';
import { EnteteToeic, LigneChoix } from './ui';

function regionTelephone(): string | null {
  try {
    return getLocales()[0]?.regionCode ?? null;
  } catch {
    return null;
  }
}

/** A2 · Choix de la certification et du pays (gabarit `ChoixConcours`). */
export function ChoixCertification() {
  const { t, langue } = useTraduction();
  const { theme } = useTheme();
  const [examens, setExamens] = useState<Examen[] | null>(null);
  const [depuisCache, setDepuisCache] = useState(false);
  const [erreur, setErreur] = useState(false);
  const [choisi, setChoisi] = useState<string | null>(null);
  const [pays, setPays] = useState<string>(() => paysParDefaut(regionTelephone()));
  const [feuille, setFeuille] = useState(false);
  const listePays = useMemo(() => listerPays(langue, {}), [langue]);

  const charger = useCallback(() => {
    setErreur(false);
    setExamens(null);
    obtenirExamens()
      .then(({ examens: liste, depuisCache: cache }) => {
        setExamens(liste);
        setDepuisCache(cache);
      })
      .catch(() => setErreur(true));
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    charger();
    // Retour depuis A3 : les choix précédents sont repris.
    lireProfil().then((p) => {
      if (p?.type !== 'certification') return;
      if (p.exam) setChoisi(p.exam);
      if (p.pays) setPays(p.pays.toUpperCase());
    });
  }, [charger]);

  const continuer = async () => {
    if (!choisi) return;
    await enregistrerProfil({ type: 'certification', exam: choisi, pays, termine: false });
    suivre('cert_exam_chosen', { examen: choisi });
    router.push('/certification/objectif');
  };

  const retour = () => (router.canGoBack() ? router.back() : router.replace('/bienvenue'));

  return (
    <Ecran
      entete={<EnteteToeic titre={t('certification.choix.entete')} onRetour={retour} />}
      pied={
        <View style={styles.pied}>
          <Bouton libelle={t('certification.continuer')} desactive={!choisi} onPress={continuer} retour />
          <Text style={[typo.legende, styles.centre, { color: theme.texte.secondaire }]}>{t('certification.marqueExamen')}</Text>
        </View>
      }
    >
      <Text accessibilityRole="header" style={[typo.h1, { color: theme.texte.principal }]}>{t('certification.choix.titre')}</Text>
      {depuisCache ? <Banniere titre={t('certification.choix.horsLigne')} /> : null}
      {erreur ? (
        <View style={styles.groupe}>
          <Text style={[typo.texteFort, { color: theme.texte.principal }]}>{t('certification.choix.erreurTitre')}</Text>
          <Text style={[typo.petit, { color: theme.texte.secondaire }]}>{t('certification.choix.erreurTexte')}</Text>
          <Bouton variante="secondaire" libelle={t('certification.reessayer')} onPress={charger} />
        </View>
      ) : examens === null ? (
        <Text accessibilityLiveRegion="polite" style={[typo.petit, { color: theme.texte.secondaire }]}>{t('certification.choix.chargement')}</Text>
      ) : examens.length === 0 ? (
        <View style={styles.groupe}>
          <Text style={[typo.texteFort, { color: theme.texte.principal }]}>{t('certification.choix.videTitre')}</Text>
          <Text style={[typo.petit, { color: theme.texte.secondaire }]}>{t('certification.choix.videTexte')}</Text>
        </View>
      ) : (
        examens.map((e) => (
          <LigneChoix
            key={e.code}
            visuel={<LogoToeic />}
            radio
            actif={choisi === e.code}
            titre={e.name}
            aide={t('certification.choix.ligneAide', { sous: e.subtitle ?? '', duree: formaterDuree(e.duration_min), questions: e.question_count })}
            onPress={() => setChoisi(e.code)}
          />
        ))
      )}
      <Text style={[typo.etiquette, { color: theme.texte.secondaire }]}>{t('certification.choix.pays')}</Text>
      <LigneSelecteur
        valeur={nomPays(pays, langue)}
        drapeau={drapeauPays(pays)}
        onPress={() => setFeuille(true)}
        libelle={`${t('certification.choix.pays')} : ${nomPays(pays, langue)}`}
      />
      <FeuillePays
        ouverte={feuille}
        pays={listePays}
        choisi={pays}
        onFermer={() => setFeuille(false)}
        onChoisir={(a2) => {
          setPays(a2.toUpperCase());
          setFeuille(false);
        }}
      />
    </Ecran>
  );
}

function LigneSelecteur({ valeur, drapeau, onPress, libelle }: { valeur: string; drapeau: string | null; onPress: () => void; libelle: string }) {
  return (
    <Bouton
      variante="secondaire"
      libelle={valeur}
      accessibilityLabel={libelle}
      icone={drapeau ? <Image source={{ uri: drapeau }} style={styles.drapeau} contentFit="cover" accessibilityIgnoresInvertColors /> : undefined}
      onPress={onPress}
    />
  );
}

const styles = StyleSheet.create({
  pied: { gap: espace[3] },
  centre: { textAlign: 'center' },
  groupe: { gap: espace[3] },
  drapeau: { width: 24, height: 16, borderRadius: 2 },
});
