import { router } from 'expo-router';
import { Flag, Share2 } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Share, StyleSheet, Text, View } from 'react-native';

import { useTraduction } from '@/i18n/useTraduction';
import {
  MATIERES_PHOTO, MOTIFS_PHOTO, PROGRESSIONS, blocsDepuisTexte, envoyerPhoto, etatsEtapes, lireMatiere, noterCorrection, preparerImage, retenirMatiere,
  signalerCorrection, texteDePartage, type Cadre, type CorrectionPhoto, type MatierePhoto, type MotifPhoto, type Progression,
} from '@/services/photo';
import { suivre } from '@/services/analytics';
import { texteAvecFormules } from '@/services/blocs';
import { getSupabase } from '@/services/supabase';
import { useCredits } from '@/session/CreditsProvider';
import { useTheme } from '@/theme/ThemeProvider';
import { bord, corrige, espace, matiere as couleursMatiere, rayon, typo } from '@/theme/theme';

import { Appui } from '../Appui';
import { Banniere } from '../Banniere';
import { Bouton } from '../Bouton';
import { Champ } from '../Champ';
import { Ecran } from '../Ecran';
import { EcranErreur } from '../liste/EcranErreur';
import { Puce } from '../liste/Puce';
import { OptionReponse } from '../OptionReponse';
import { BoutonFermer } from '../arrivee/MiniTest';
import { Blocs } from '../reviser/Blocs';
import { useFeedback } from '../useFeedback';
import { FeuilleEpuise, PuceCout } from '../credits';
import { Camera, type PhotoPrise } from './Camera';
import { CadreRecadrage, CADRE_INITIAL } from './CadreRecadrage';

type Etat =
  | { ecran: 'camera' }
  | { ecran: 'recadrage'; photo: PhotoPrise; source: 'camera' | 'galerie' }
  | { ecran: 'analyse'; etapes: Progression[] }
  | { ecran: 'correction'; id: string; correction: CorrectionPhoto; avis?: 'clair' | 'pas_compris' }
  | { ecran: 'signaler'; id: string; correction: CorrectionPhoto }
  | { ecran: 'illisible'; raison: string }
  | { ecran: 'erreur'; type: 'hors-ligne' | 'erreur' }
  | { ecran: 'limite' };

const COULEUR: Record<string, string> = { maths: couleursMatiere.maths, physique: couleursMatiere.physique, chimie: couleursMatiere.physique, svt: couleursMatiere.svt, francais: couleursMatiere.francais, anglais: couleursMatiere.anglais };

/** Aide par photo (M3, parcours B) : appareil photo → recadrage → analyse → correction pas à pas, signalement, limites. */
export function Photo() {
  const { t } = useTraduction();
  const { theme, sombre } = useTheme();
  const { declencher } = useFeedback();
  const [etat, setEtat] = useState<Etat>({ ecran: 'camera' });
  const [cadre, setCadre] = useState<Cadre>(CADRE_INITIAL);
  const [matiere, setMatiere] = useState<MatierePhoto>('maths');
  const { solde, couts, rafraichir } = useCredits();
  const [epuise, setEpuise] = useState(false);
  const derniereRecadrage = useRef<PhotoPrise | null>(null);
  const derniere = useRef<{ base64: string; source: 'camera' | 'galerie' } | null>(null);
  const annule = useRef<AbortController | null>(null);
  const [motif, setMotif] = useState<MotifPhoto | null>(null);
  const [details, setDetails] = useState('');
  const [occupe, setOccupe] = useState(false);
  const [signaleErreur, setSignaleErreur] = useState(false);
  const [signale, setSignale] = useState<Set<string>>(new Set());

  useEffect(() => {
    void lireMatiere().then(setMatiere);
  }, []);
  useEffect(() => () => annule.current?.abort(), []);

  const quitter = () => (router.canGoBack() ? router.back() : router.replace('/'));
  const recommencer = () => setEtat({ ecran: 'camera' });

  const lancer = async (image: { base64: string; source: 'camera' | 'galerie' }) => {
    derniere.current = image;
    const debut = Date.now();
    const ctrl = new AbortController();
    annule.current = ctrl;
    setEtat({ ecran: 'analyse', etapes: [] });
    suivre('photo_sent', { matiere, source: image.source });
    try {
      const issue = await envoyerPhoto(getSupabase(), {
        image: image.base64,
        matiere,
        signal: ctrl.signal,
        surEtape: (e) => setEtat((s) => (s.ecran === 'analyse' && !s.etapes.includes(e) ? { ecran: 'analyse', etapes: [...s.etapes, e] } : s)),
      });
      void rafraichir();
      if (issue.type === 'fin') {
        declencher('arrive');
        suivre('photo_corrected', { matiere: issue.correction.matiere, duree_s: Math.round((Date.now() - debut) / 1000), etapes: issue.correction.etapes.length });
        setEtat({ ecran: 'correction', id: issue.id, correction: issue.correction });
      } else if (issue.type === 'illisible') {
        suivre('photo_unreadable', {});
        setEtat({ ecran: 'illisible', raison: issue.raison });
      } else if (issue.type === 'credits') {
        declencher('problem');
        setEpuise(true);
        setEtat({ ecran: 'recadrage', photo: derniereRecadrage.current!, source: image.source });
      } else if (issue.type === 'quota') {
        declencher('problem');
        setEtat({ ecran: 'limite' });
      } else {
        declencher('error');
        suivre('photo_failed', { type: issue.type });
        setEtat({ ecran: 'erreur', type: issue.type });
      }
    } catch {
      // Annulé par l'élève : retour au recadrage géré par annuler().
    }
  };

  const envoyer = async (photo: PhotoPrise, source: 'camera' | 'galerie') => {
    derniereRecadrage.current = photo;
    setOccupe(true);
    try {
      const prep = await preparerImage(photo.uri, cadre, photo.largeur, photo.hauteur);
      setOccupe(false);
      await lancer({ base64: prep.base64, source });
    } catch {
      setOccupe(false);
      setEtat({ ecran: 'erreur', type: 'erreur' });
    }
  };

  const annuler = () => {
    annule.current?.abort();
    recommencer();
  };

  const noter = async (id: string, correction: CorrectionPhoto, avis: 'clair' | 'pas_compris') => {
    setEtat({ ecran: 'correction', id, correction, avis });
    suivre('photo_rated', { avis });
    void noterCorrection(getSupabase(), id, avis).catch(() => {});
    if (avis === 'pas_compris') setEtat({ ecran: 'signaler', id, correction });
  };

  const partager = async (c: CorrectionPhoto) => {
    suivre('photo_shared', {});
    await Share.share({
      message: texteDePartage(c, { cherche: t('photo.chercheEtiquette'), methode: t('photo.methodeEtiquette'), resultat: t('photo.resultat'), retenir: t('photo.retenir'), signature: t('photo.partageSignature') }),
    }).catch(() => {});
  };

  const envoyerSignalement = async (id: string, correction: CorrectionPhoto) => {
    if (!motif || occupe) return;
    setOccupe(true);
    setSignaleErreur(false);
    try {
      await signalerCorrection(getSupabase(), id, motif, details);
      suivre('photo_reported', { motif });
      setSignale((s) => new Set(s).add(id));
      setMotif(null);
      setDetails('');
      setEtat({ ecran: 'correction', id, correction, avis: 'pas_compris' });
    } catch {
      setSignaleErreur(true);
    } finally {
      setOccupe(false);
    }
  };

  // ---- B1 appareil photo
  if (etat.ecran === 'camera') return <Camera onPhoto={(p) => { setEtat({ ecran: 'recadrage', photo: p, source: 'camera' }); setCadre(CADRE_INITIAL); }} />;

  // ---- B2 recadrage
  if (etat.ecran === 'recadrage') {
    const { photo, source } = etat;
    return (
      <Ecran
        insetBas={false}
        defilement={false}
        retourHaut={false}
        entete={
          <>
            <BoutonFermer icone="chevron-back" libelle={t('photo.retour')} onPress={recommencer} />
            <Text accessibilityRole="header" style={[typo.h3, { color: theme.texte.principal }]}>{t('photo.recadrer')}</Text>
          </>
        }
        pied={<BoutonEnvoi libelle={t('photo.demanderIa')} cout={couts.ai_question} illimite={!!solde?.illimite} desactive={occupe} onPress={() => void envoyer(photo, source)} />}
      >
        <CadreRecadrage uri={photo.uri} largeur={photo.largeur} hauteur={photo.hauteur} onChange={setCadre} />
        <Text style={[typo.legende, { color: theme.texte.secondaire }]}>{t('photo.matiereDevinee')}</Text>
        <View style={styles.puces}>
          {MATIERES_PHOTO.map((m) => (
            <Puce key={m} libelle={t(`photo.matieres.${m}`)} choisie={matiere === m} pastille={COULEUR[m]} onPress={() => { setMatiere(m); void retenirMatiere(m); }} />
          ))}
        </View>
        {occupe ? <ActivityIndicator color={theme.marque.principale} /> : null}
        <FeuilleEpuise ouverte={epuise} onFermer={() => setEpuise(false)} />
      </Ecran>
    );
  }

  // ---- B3 analyse
  if (etat.ecran === 'analyse') {
    const noms: Record<Progression, string> = { enonce: t('photo.etapeEnonce'), methode: t('photo.etapeMethode'), redaction: t('photo.etapeRedaction'), resultat: t('photo.etapeResultat') };
    const etats = etatsEtapes(etat.etapes);
    return (
      <Ecran
        insetBas={false}
        entete={
          <>
            <BoutonFermer libelle={t('photo.annuler')} onPress={annuler} />
            <Text accessibilityRole="header" style={[typo.h3, { color: theme.texte.principal }]}>{t('photo.analyse')}</Text>
          </>
        }
      >
        <View accessibilityLiveRegion="polite" style={[styles.carteJaune, { backgroundColor: theme.accent.soleilDoux, borderColor: theme.bord.fort }]}>
          <Text style={[typo.h2, { color: theme.texte.principal }]}>{t('photo.analyseTitre')}</Text>
          {PROGRESSIONS.map((p, i) => {
            const fait = etats[i] === 'fait';
            const enCours = etats[i] === 'en_cours';
            return (
              <View key={p} accessibilityLabel={`${noms[p]}${fait ? `, ${t('photo.etapeFaite')}` : enCours ? `, ${t('photo.etapeEnCours')}` : ''}`} style={styles.ligneEtape}>
                <View style={[styles.coche, { borderColor: theme.bord.fort, backgroundColor: fait ? theme.etat.succes : 'transparent' }]}>
                  {enCours ? <ActivityIndicator size="small" color={theme.marque.principale} /> : <Text style={[typo.etiquette, { color: theme.texte.surCouleur }]}>{fait ? '✓' : ''}</Text>}
                </View>
                <Text style={[typo.texteFort, { color: theme.texte.principal, opacity: fait || enCours ? 1 : 0.55 }]}>{noms[p]}</Text>
              </View>
            );
          })}
        </View>
        {[0, 1, 2].map((i) => (
          <View key={i} style={[styles.squelette, { backgroundColor: theme.fond.creux, borderColor: theme.bord.doux }]} />
        ))}
        <Text style={[typo.legende, styles.centre, { color: theme.texte.secondaire }]}>{t('photo.analyseNote')}</Text>
      </Ecran>
    );
  }

  // ---- B4 correction
  if (etat.ecran === 'correction') {
    const { id, correction: c, avis } = etat;
    const k = sombre ? corrige.dark : corrige.light;
    const deja = signale.has(id);
    return (
      <Ecran
        insetBas={false}
        entete={
          <>
            <BoutonFermer icone="chevron-back" libelle={t('photo.retour')} onPress={quitter} />
            <Text accessibilityRole="header" numberOfLines={1} style={[typo.h3, styles.flex, { color: theme.texte.principal }]}>{t('photo.analyse')}</Text>
            <Appui accessibilityRole="button" accessibilityLabel={t('photo.partager')} onPress={() => void partager(c)} decalage={0} rayon={rayon.m}>
              <View style={[styles.iconeBouton, { backgroundColor: theme.fond.surface, borderColor: theme.bord.fort }]}><Share2 size={18} strokeWidth={2.25} color={theme.texte.principal} /></View>
            </Appui>
            <Appui accessibilityRole="button" accessibilityLabel={t('photo.signaler')} onPress={() => setEtat({ ecran: 'signaler', id, correction: c })} decalage={0} rayon={rayon.m}>
              <View style={[styles.iconeBouton, { backgroundColor: theme.fond.surface, borderColor: theme.bord.fort }]}><Flag size={18} strokeWidth={2.25} color={theme.texte.principal} /></View>
            </Appui>
          </>
        }
        pied={
          avis ? (
            <Bouton libelle={t('photo.nouvelle')} onPress={recommencer} />
          ) : (
            <View style={styles.avis}>
              <View style={styles.flex}><Bouton variante="secondaire" libelle={t('photo.pasCompris')} onPress={() => void noter(id, c, 'pas_compris')} /></View>
              <View style={styles.flex}><Bouton libelle={t('photo.cestClair')} onPress={() => void noter(id, c, 'clair')} /></View>
            </View>
          )
        }
      >
        <View style={[styles.carte, { backgroundColor: theme.fond.creux, borderColor: theme.bord.fort }]}>
          <Text style={[typo.etiquette, { color: theme.texte.secondaire }]}>{t('photo.chercheEtiquette')}</Text>
          <Blocs blocs={blocsDepuisTexte(c.enonce)} />
        </View>
        {c.methode ? (
          <View style={[styles.carte, { backgroundColor: theme.fond.surface, borderColor: theme.bord.fort }]}>
            <View style={[styles.etiquetteJaune, { backgroundColor: theme.accent.soleil, borderColor: theme.bord.fort }]}><Text style={[typo.etiquette, { color: theme.texte.surCouleur }]}>{t('photo.methodeEtiquette')}</Text></View>
            <Blocs blocs={blocsDepuisTexte(c.methode)} />
          </View>
        ) : null}
        <View style={[styles.carte, { backgroundColor: theme.fond.surface, borderColor: theme.bord.fort }]}>
          {c.etapes.map((e, i) => (
            <View key={i} style={styles.etape}>
              <View style={[styles.numero, { backgroundColor: theme.fond.inverse }]}><Text style={[typo.boutonPetit, { color: theme.texte.inverse }]}>{i + 1}</Text></View>
              <View style={styles.flex}>
                <Text style={[typo.texteFort, { color: theme.texte.principal }]}>{texteAvecFormules(e.titre)}</Text>
                {e.detail ? <Blocs blocs={blocsDepuisTexte(e.detail)} /> : null}
              </View>
            </View>
          ))}
        </View>
        <View style={[styles.resultat, { backgroundColor: theme.marque.principale, borderColor: theme.bord.fort }]}>
          <Text style={[typo.etiquette, { color: theme.texte.surCouleur }]}>{t('photo.resultat')}</Text>
          <Blocs surCouleur blocs={blocsDepuisTexte(c.resultat)} />
        </View>
        {c.a_retenir ? (
          <View style={[styles.carte, { backgroundColor: k.fond, borderColor: theme.bord.fort }]}>
            <Text style={[typo.etiquette, { color: k.note }]}>{t('photo.retenir')}</Text>
            <Blocs surJaune blocs={blocsDepuisTexte(c.a_retenir)} />
          </View>
        ) : null}
        {deja ? <Banniere ton="succes" titre={t('photo.signalementEnvoye')} /> : avis === 'clair' ? <Banniere ton="succes" titre={t('photo.merciAvis')} /> : null}
      </Ecran>
    );
  }

  // ---- B5 signaler
  if (etat.ecran === 'signaler') {
    const { id, correction } = etat;
    return (
      <Ecran
        insetBas={false}
        entete={
          <>
            <BoutonFermer icone="chevron-back" libelle={t('photo.retour')} onPress={() => setEtat({ ecran: 'correction', id, correction })} />
            <Text accessibilityRole="header" style={[typo.h3, { color: theme.texte.principal }]}>{t('photo.signalerTitre')}</Text>
          </>
        }
        pied={<Bouton libelle={t('photo.signalerEnvoyer')} desactive={!motif || occupe} onPress={() => void envoyerSignalement(id, correction)} />}
      >
        <View style={styles.options}>
          {MOTIFS_PHOTO.map((m, i) => (
            <OptionReponse key={m} lettre={String.fromCharCode(65 + i)} texte={t(`photo.motif.${m}`)} etat={motif === m ? 'choisie' : 'neutre'} onPress={() => setMotif(m)} />
          ))}
        </View>
        <Champ libelle={t('photo.precisions')} placeholder={t('photo.precisionsExemple')} value={details} onChangeText={setDetails} maxLength={500} multiline />
        <Text style={[typo.legende, { color: theme.texte.secondaire }]}>{t('photo.signalerNote')}</Text>
        {signaleErreur ? <Banniere ton="erreur" titre={t('photo.signalementErreur')} /> : null}
      </Ecran>
    );
  }

  // ---- états d'erreur et de limite
  const reprendre = () => (derniere.current ? void lancer(derniere.current) : recommencer());
  if (etat.ecran === 'illisible') {
    return (
      <Ecran insetBas={false}>
        <EcranErreur titre={t('photo.illisibleTitre')} phrase={`${etat.raison} ${t('photo.illisibleConseil')}`.trim()} reessayer={t('photo.reprendre')} onReessayer={recommencer} />
      </Ecran>
    );
  }
  if (etat.ecran === 'erreur') {
    const hors = etat.type === 'hors-ligne';
    return (
      <Ecran insetBas={false}>
        <EcranErreur titre={t(hors ? 'photo.horsLigneTitre' : 'photo.erreurTitre')} phrase={t(hors ? 'photo.horsLignePhrase' : 'photo.erreurPhrase')} reessayer={t('photo.reessayer')} onReessayer={reprendre} secours={{ libelle: t('photo.nouvelle'), onPress: recommencer }} />
      </Ecran>
    );
  }
  // B6 : limite du jour du pass (garde-fou), sans blocage agressif
  return (
    <Ecran
        insetBas={false}
      entete={
        <>
          <BoutonFermer icone="chevron-back" libelle={t('photo.retour')} onPress={recommencer} />
          <Text accessibilityRole="header" style={[typo.h3, { color: theme.texte.principal }]}>{t('onglets.photo')}</Text>
        </>
      }
      pied={<Bouton libelle={t('photo.faireMission')} onPress={() => router.replace('/')} />}
    >
      <View style={[styles.carteJaune, { backgroundColor: theme.accent.soleil, borderColor: theme.bord.fort }]}>
        <Text style={[typo.h2, { color: theme.texte.surCouleur }]}>{t('photo.limiteTitre')}</Text>
      </View>
      <Text style={[typo.texte, { color: theme.texte.secondaire }]}>{t('photo.limitePhrase')}</Text>
    </Ecran>
  );
}

/** K2b : « Demander à l'IA » avec la puce du coût à droite (inclus avec un pass). La dépense se fait côté serveur à l'envoi. */
function BoutonEnvoi({ libelle, cout, illimite, desactive, onPress }: { libelle: string; cout?: number; illimite: boolean; desactive?: boolean; onPress: () => void }) {
  const { theme } = useTheme();
  return (
    <Appui accessibilityRole="button" accessibilityState={{ disabled: !!desactive }} disabled={desactive} onPress={onPress} decalage={4} ombre={4} couleurOmbre={theme.ombre} rayon={rayon.m}>
      <View style={[styles.envoi, { backgroundColor: desactive ? theme.fond.creux : theme.marque.principale, borderColor: theme.bord.fort }]}>
        <Text style={[typo.bouton, { color: theme.texte.surCouleur }]}>{libelle}</Text>
        {illimite ? <PuceCout cout={0} etat="inclus" /> : cout ? <PuceCout cout={cout} /> : null}
      </View>
    </Appui>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  centre: { textAlign: 'center' },
  puces: { flexDirection: 'row', flexWrap: 'wrap', gap: espace[3] },
  carteJaune: { borderWidth: bord.normal, borderRadius: rayon.l, padding: espace[5], gap: espace[4] },
  ligneEtape: { flexDirection: 'row', alignItems: 'center', gap: espace[4] },
  coche: { width: 24, height: 24, borderRadius: 12, borderWidth: bord.normal, alignItems: 'center', justifyContent: 'center' },
  squelette: { height: 64, borderWidth: bord.fin, borderRadius: rayon.m },
  carte: { borderWidth: bord.normal, borderRadius: rayon.l, padding: espace[5], gap: espace[4] },
  etiquetteJaune: { alignSelf: 'flex-start', borderWidth: bord.fin, borderRadius: rayon.s, paddingHorizontal: espace[3], paddingVertical: espace[1] },
  etape: { flexDirection: 'row', gap: espace[4] },
  numero: { width: 28, height: 28, borderRadius: rayon.s, alignItems: 'center', justifyContent: 'center' },
  resultat: { borderWidth: bord.normal, borderRadius: rayon.l, padding: espace[5], gap: espace[3] },
  avis: { flexDirection: 'row', gap: espace[4] },
  options: { gap: espace[3] },
  envoi: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: espace[4], minHeight: 52, borderWidth: bord.normal, borderRadius: rayon.m, paddingHorizontal: 20 },
  iconeBouton: { width: 40, height: 40, borderWidth: bord.normal, borderRadius: rayon.m, alignItems: 'center', justifyContent: 'center' },
});
