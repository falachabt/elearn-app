import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { PuceCout } from '@/components/credits/PuceCout';
import { useDepenseCredits } from '@/components/credits/useDepenseCredits';
import { useTraduction } from '@/i18n/useTraduction';
import { suivre } from '@/services/analytics';
import { obtenirApi } from '@/services/certification/api';
import { titreAffiche } from '@/services/certification/titre';
import type { MotCle, QuestionServie, ResultatReponse } from '@/services/certification/types';
import { useCredits } from '@/session/CreditsProvider';
import { useTheme } from '@/theme/ThemeProvider';
import { bord, cibleMin, espace, ombre, rayon, typo } from '@/theme/theme';

import { Appui } from '../Appui';
import { Banniere } from '../Banniere';
import { Bouton } from '../Bouton';
import { Carte } from '../Carte';
import { FeuilleExplication } from './FeuilleExplication';
import { PourquoiRate } from './PourquoiRate';

type Props = {
  question: QuestionServie;
  resultat: ResultatReponse;
  /** Option choisie par l'élève ; `null` = question passée. */
  choix: number | null;
  motsAjoutes: MotCle[];
  onAjouterMot: (mot: MotCle) => Promise<void>;
};

/**
 * B9 · Explication allégée (v31) : l'option juste est déjà en vert dans la question ; ici seulement le lien discret
 * « Voir la justification », qui déplie la justification avec « Revoir la notion » et « Explication détaillée ».
 * Le bouton « Question suivante » est dans le pied de l'écran (Serie). Gratuit : résultat, bonne réponse, notion, piège, « Revoir la notion ». Payant : seule l'explication
 * détaillée rédigée (`cert_explanation`), derrière la feuille de coût X1 hors Pass (D-09, D-15).
 */
export function ExplicationCert({ question, resultat, motsAjoutes, onAjouterMot }: Props) {
  const { t } = useTraduction();
  const { theme } = useTheme();
  const { solde, couts } = useCredits();
  const { lancer, feuilles } = useDepenseCredits();
  const [feuille, setFeuille] = useState(false);
  const [enCours, setEnCours] = useState(false);
  const [detail, setDetail] = useState<{ explication: string | null; piege: string | null } | null>(null);
  const [echecMot, setEchecMot] = useState(false);
  const [pourquoi, setPourquoi] = useState(false);
  const [ouverte, setOuverte] = useState(false);
  const cout = couts.cert_explanation ?? 0;
  const gratuit = !!solde?.illimite || cout === 0;
  const bonne = resultat.correct_index;
  const piege = resultat.trap;
  const mots = resultat.words ?? [];

  const revoirNotion = () => {
    const notion = resultat.notion;
    if (!notion) return;
    setFeuille(false);
    router.push({ pathname: '/certification/notion/[id]', params: { id: notion.id, source: 'explication' } } as never);
  };

  /** X2 : point d'entrée discret sous la correction (le cahier ne le dessine pas, il le place en B9). */
  const signaler = () => {
    const params: Record<string, string> = { question: question.id, partie: String(question.part) };
    if (question.number !== null) params.numero = String(question.number);
    if (resultat.notion) params.notion = titreAffiche(resultat.notion.title);
    router.push({ pathname: '/certification/signaler', params } as never);
  };

  const acheter = async () => {
    setFeuille(false);
    if (enCours) return;
    setEnCours(true);
    try {
      const api = obtenirApi();
      let contenu: { explanation: string | null; trap: string | null } | null = null;
      if (api.acheterExplication) {
        contenu = (await api.acheterExplication(question.id)).contenu;
      } else {
        const r = await lancer<{ explanation: string | null; trap: string | null }>('cert_explanation', question.id, { deja: true });
        if (r?.statut === 'spent') suivre('cert_credit_spent', { action: 'cert_explanation', cout: r.cout });
        contenu = r?.contenu ?? null;
      }
      if (contenu) setDetail({ explication: contenu.explanation, piege: contenu.trap });
    } finally {
      setEnCours(false);
    }
  };

  const ouvrirDetail = () => {
    if (gratuit) {
      void acheter();
      return;
    }
    suivre('cert_credit_gate_viewed', { action: 'cert_explanation' });
    setFeuille(true);
  };

  /** B10 : chaque raison fait l'action qui existe déjà ; la raison elle-même n'est pas enregistrée. */
  const choisirRaison = (raison: 'mot' | 'regle' | 'lu' | 'vite') => {
    setPourquoi(false);
    if (raison === 'mot') {
      const restant = mots.find((m) => !motsAjoutes.some((a) => a.id === m.id));
      if (restant) void ajouter(restant);
    } else if (raison === 'regle') revoirNotion();
  };

  const ajouter = async (mot: MotCle) => {
    setEchecMot(false);
    try {
      await onAjouterMot(mot);
    } catch {
      setEchecMot(true);
    }
  };

  if (!ouverte) {
    return (
      <View style={styles.colonne}>
        <Appui accessibilityRole="button" accessibilityLabel={t('certification.explication.voirJustification')} onPress={() => setOuverte(true)} decalage={0} rayon={rayon.s}>
          <View style={styles.lien}>
            <Text style={[typo.boutonPetit, styles.lienTexte, { color: theme.texte.lien }]}>{t('certification.explication.voirJustification')}</Text>
          </View>
        </Appui>
        <PourquoiRate ouverte={false} onFermer={() => undefined} onChoisir={choisirRaison} />
        <FeuilleExplication ouverte={feuille} cout={cout} onVoir={() => void acheter()} onPlusTard={() => setFeuille(false)} onRevoirNotion={revoirNotion} />
        {feuilles}
      </View>
    );
  }

  return (
    <View style={styles.colonne}>
      <Carte style={{ gap: espace[3] }}>
        <Text accessibilityRole="header" style={[typo.texteFort, { color: theme.texte.principal }]}>{t('certification.explication.justification')}</Text>
        {resultat.notion ? <Text style={[typo.texte, { color: theme.texte.principal }]}>{t('certification.explication.notion', { titre: titreAffiche(resultat.notion.title) })}</Text> : null}
        {piege ? <Text style={[typo.texte, { color: theme.texte.principal }]}>{t('certification.explication.piege', { texte: piege })}</Text> : null}
        {detail ? <Text style={[typo.texte, { color: theme.texte.principal }]}>{detail.explication ?? t('certification.explication.detailVide')}</Text> : null}
        {!resultat.notion && !piege && !detail ? <Text style={[typo.texte, { color: theme.texte.secondaire }]}>{t('certification.explication.justificationVide')}</Text> : null}
        {mots.length > 0 ? (
          <View style={styles.colonneSerree}>
            <Text style={[typo.etiquette, { color: theme.texte.secondaire }]}>{t('certification.explication.motsCles')}</Text>
            <View style={styles.puces}>
              {mots.map((m, i) => {
                const ajoute = motsAjoutes.some((x) => x.id === m.id);
                return (
                  <Appui
                    key={`${m.id}-${i}`}
                    accessibilityRole="button"
                    accessibilityState={{ disabled: ajoute }}
                    accessibilityLabel={ajoute ? t('certification.explication.ajoute', { mot: m.word }) : t('certification.explication.ajouter', { mot: m.word })}
                    onPress={ajoute ? undefined : () => void ajouter(m)}
                    decalage={0}
                    rayon={rayon.pilule}
                  >
                    <View style={[styles.puce, { backgroundColor: ajoute ? theme.marque.douce : theme.fond.surface, borderColor: theme.bord.fort }]}>
                      <Text style={[typo.legende, { color: theme.texte.principal }]}>{ajoute ? t('certification.explication.ajoute', { mot: m.word }) : t('certification.explication.ajouter', { mot: m.word })}</Text>
                    </View>
                  </Appui>
                );
              })}
            </View>
            {echecMot ? <Banniere ton="alerte" titre={t('certification.explication.ajoutEchec')} /> : null}
          </View>
        ) : null}
        <View style={styles.colonneSerree}>
          {resultat.notion ? <Bouton variante="secondaire" libelle={t('certification.explication.revoir')} onPress={revoirNotion} /> : null}
          {detail ? null : (
            <Appui accessibilityRole="button" accessibilityState={{ busy: enCours }} accessibilityLabel={t('certification.explication.detail')} onPress={ouvrirDetail} disabled={enCours} ombre={ombre.s} decalage={2} couleurOmbre={theme.ombre} rayon={rayon.m} retour>
              <View style={[styles.detail, { backgroundColor: theme.fond.surface, borderColor: theme.bord.fort }]}>
                <Text style={[typo.boutonPetit, { color: theme.texte.principal }]}>{t('certification.explication.detail')}</Text>
                {enCours ? <ActivityIndicator size="small" color={theme.texte.principal} /> : gratuit ? null : <PuceCout cout={cout} />}
              </View>
            </Appui>
          )}
          {resultat.correct ? null : <Bouton variante="secondaire" libelle={t('certification.explication.pourquoi')} onPress={() => setPourquoi(true)} />}
          <Bouton variante="texte" libelle={t('certification.signaler.lien')} onPress={signaler} />
        </View>
      </Carte>
      <PourquoiRate ouverte={pourquoi} onFermer={() => setPourquoi(false)} onChoisir={choisirRaison} />
      <FeuilleExplication ouverte={feuille} cout={cout} onVoir={() => void acheter()} onPlusTard={() => setFeuille(false)} onRevoirNotion={revoirNotion} />
      {feuilles}
    </View>
  );
}

const styles = StyleSheet.create({
  colonne: { gap: espace[4] },
  colonneSerree: { gap: espace[3] },
  lien: { minHeight: cibleMin, alignItems: 'center', justifyContent: 'center' },
  lienTexte: { textDecorationLine: 'underline' },
  puces: { flexDirection: 'row', flexWrap: 'wrap', gap: espace[3] },
  puce: { minHeight: 36, paddingHorizontal: espace[4], justifyContent: 'center', borderWidth: bord.normal, borderRadius: rayon.pilule },
  detail: { minHeight: cibleMin, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: espace[3], paddingHorizontal: espace[4], borderWidth: bord.normal, borderRadius: rayon.m },
});
