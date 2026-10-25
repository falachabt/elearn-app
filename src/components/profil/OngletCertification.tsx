import { router } from 'expo-router';
import { Image } from 'expo-image';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useTraduction } from '@/i18n/useTraduction';
import { suivre } from '@/services/analytics';
import { adopterProfil, passerAuToeic } from '@/services/changementProfil';
import { obtenirExamens } from '@/services/certification/etat';
import { formaterDuree } from '@/services/certification/format';
import type { Examen } from '@/services/certification/types';
import { drapeauPays, listerPays, nomPays } from '@/services/pays';
import { enregistrerProfil, lireProfil, type Profil } from '@/services/profil';
import { useTheme } from '@/theme/ThemeProvider';
import { espace, typo } from '@/theme/theme';

import { Banniere } from '../Banniere';
import { Bouton } from '../Bouton';
import { Ecran } from '../Ecran';
import { LogoToeic } from '../certification/LogoToeic';
import { EncadrePointille, LigneChoix } from '../certification/ui';
import { FeuillePays } from '../pass/FeuillePays';
import { BlocChangementProfil, type EtatChangement } from './BlocChangementProfil';

/**
 * Onglet Certification de la page de changement (issue #125) : il absorbe l'ancien écran orphelin
 * `/profil/certification`. Dans sa famille (profil certification) : la liste des examens et le pays
 * s'enregistrent comme un changement ordinaire. Depuis une autre famille : choisir un examen puis
 * « Continuer » affiche le bloc d'adoption (conséquences + confirmation) — jamais de bascule directe.
 * Le TOEIC est le seul examen actuel : ses textes de conséquences sont ceux de l'ancien écran.
 */
export function OngletCertification({ profil, onAnnulerAdoption }: { profil: Profil; onAnnulerAdoption?: () => void }) {
  const { t, langue } = useTraduction();
  const { theme } = useTheme();
  const estCertification = profil.type === 'certification';
  const [examens, setExamens] = useState<Examen[] | null>(null);
  const [depuisCache, setDepuisCache] = useState(false);
  const [erreur, setErreur] = useState(false);
  const [choisi, setChoisi] = useState<string | null>(estCertification ? profil.exam ?? null : null);
  const [pays, setPays] = useState<string>((profil.pays ?? 'CM').toUpperCase());
  const [feuille, setFeuille] = useState(false);
  const [adoption, setAdoption] = useState(false);
  const [etat, setEtat] = useState<EtatChangement>('repos');
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
  }, [charger]);

  const examenChoisi = examens?.find((e) => e.code === choisi) ?? null;
  const aideExamen = (e: Examen) => t('certification.choix.ligneAide', { sous: e.subtitle ?? '', duree: formaterDuree(e.duration_min), questions: e.question_count });

  /** Changement dans sa famille : enregistrer l'examen et le pays, comme un changement de classe ordinaire. */
  const enregistrer = async () => {
    const exam = choisi ?? profil.exam;
    if (exam === profil.exam && pays === (profil.pays ?? '').toUpperCase()) {
      router.back();
      return;
    }
    await enregistrerProfil({ ...profil, exam, pays, termine: true });
    router.dismissAll();
    router.replace('/');
  };

  /** Adoption depuis une autre famille : confirmation explicite, profil quitté gardé en mémoire. */
  const confirmerAdoption = async () => {
    if (!choisi) return;
    setEtat('charge');
    try {
      // Le TOEIC garde son chemin historique (profil secondaire mémorisé tel quel) ; un futur autre examen
      // passerait par l'adoption générique.
      if (choisi === 'toeic') await passerAuToeic();
      else await adopterProfil({ type: 'certification', exam: choisi, pays, termine: true });
      // Le pays choisi dans l'onglet s'applique aussi (passerAuToeic conserve celui du profil d'origine).
      if (pays !== (profil.pays ?? '').toUpperCase()) {
        const p = await lireProfil();
        if (p) await enregistrerProfil({ ...p, pays });
      }
      suivre('cert_exam_chosen', { examen: choisi });
      router.dismissAll();
      router.replace('/');
    } catch {
      setEtat('erreur');
    }
  };

  const pied = adoption ? undefined : estCertification ? (
    <Bouton libelle={t('classe.enregistrer')} onPress={() => void enregistrer()} retour />
  ) : (
    <Bouton libelle={t('certification.continuer')} desactive={!choisi} onPress={() => setAdoption(true)} />
  );

  return (
    <Ecran insetHaut={false} pied={pied}>
      {adoption && examenChoisi ? (
        <BlocChangementProfil
          etat={etat}
          titre={t('profilChoix.passerToeicTitre')}
          texte={t('profilChoix.passerToeicTexte')}
          confirmer={t('profilChoix.passerToeicBouton')}
          annuler={t('profilChoix.annuler')}
          onConfirmer={() => void confirmerAdoption()}
          onAnnuler={() => {
            if (etat === 'erreur') {
              setEtat('repos');
              setAdoption(false);
              onAnnulerAdoption?.();
            } else {
              setAdoption(false);
            }
          }}
        >
          <LigneChoix visuel={<LogoToeic />} titre={examenChoisi.name} aide={aideExamen(examenChoisi)} radio actif onPress={() => undefined} />
        </BlocChangementProfil>
      ) : (
        <>
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
            <>
              {examens.map((e) => (
                <LigneChoix
                  key={e.code}
                  visuel={<LogoToeic />}
                  radio
                  actif={choisi === e.code}
                  titre={e.name}
                  aide={aideExamen(e)}
                  onPress={() => setChoisi(e.code)}
                  droite={estCertification && profil.exam === e.code ? <Text style={[typo.legende, { color: theme.texte.secondaire }]}>{t('profilChoix.actuel')}</Text> : undefined}
                />
              ))}
              <EncadrePointille texte={t('certification.choix.autresAVenir')} />
            </>
          )}
          <Text style={[typo.etiquette, { color: theme.texte.secondaire }]}>{t('certification.choix.pays')}</Text>
          <Bouton
            variante="secondaire"
            libelle={nomPays(pays, langue)}
            accessibilityLabel={`${t('certification.choix.pays')} : ${nomPays(pays, langue)}`}
            icone={drapeauPays(pays) ? <Image source={{ uri: drapeauPays(pays) as string }} style={styles.drapeau} contentFit="cover" accessibilityIgnoresInvertColors /> : undefined}
            onPress={() => setFeuille(true)}
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
        </>
      )}
    </Ecran>
  );
}

const styles = StyleSheet.create({
  groupe: { gap: espace[3] },
  drapeau: { width: 24, height: 16, borderRadius: 2 },
});
