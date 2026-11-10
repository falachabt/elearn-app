import { router, useLocalSearchParams } from 'expo-router';
import { Check, X } from 'lucide-react-native';
import { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useTraduction } from '@/i18n/useTraduction';
import { suivre } from '@/services/analytics';
import { appliquerResultatMot } from '@/services/certification/certCarnet';
import { chargerCarnet, } from '@/services/certification/revision';
import { jourDe } from '@/services/certification/jours';
import { obtenirReglages } from '@/services/certification/etat';
import type { Reglages } from '@/services/certification/reglages';
import { carteCourante, demarrerSeanceMots, noterCarte, reprendreSeanceMots, retournerCarte, type EtatSeanceMots } from '@/services/certification/seanceMots';
import { propositionsMot } from '@/services/certification/qcmMots';
import { lireProfil } from '@/services/profil';
import { useTheme } from '@/theme/ThemeProvider';
import { bord, espace, rayon, typo } from '@/theme/theme';

import { Appui } from '../Appui';
import { Banniere } from '../Banniere';
import { Bouton } from '../Bouton';
import { Ecran } from '../Ecran';
import { FeuilleQuitter } from './FeuilleQuitter';
import { BarreProgression, EnteteToeic, EncadrePointille } from './ui';
import { BoutonFermer } from '../arrivee/MiniTest';

type Phase = { nom: 'chargement' } | { nom: 'erreur' } | { nom: 'aucun' } | { nom: 'ok' };

/** C8 · Séance de mots : une carte à la fois, recto puis verso, « Je ne savais pas » ou « Je savais ». */
export function SeanceMots() {
  const { t } = useTraduction();
  const { theme } = useTheme();
  const params = useLocalSearchParams<{ origine?: string; nombre?: string }>();
  const origine = params.origine === 'seance' ? 'seance' : 'carnet';
  const nombre = params.nombre ? Number(params.nombre) : undefined;
  const [phase, setPhase] = useState<Phase>({ nom: 'chargement' });
  const [etat, setEtat] = useState<EtatSeanceMots | null>(null);
  const [reglages, setReglages] = useState<Reglages | null>(null);
  const [quitter, setQuitter] = useState(false);
  const occupe = useRef(false);
  /** Choix du QCM pour la carte affichée : index de la proposition cochée, `null` avant le choix. */
  const [choix, setChoix] = useState<{ carte: string; index: number } | null>(null);

  const charger = useCallback(async () => {
    setPhase({ nom: 'chargement' });
    try {
      const [profil, r] = await Promise.all([lireProfil(), obtenirReglages()]);
      const exam = profil?.exam ?? 'toeic';
      setReglages(r);
      let e = await reprendreSeanceMots(exam, origine);
      if (!e) {
        const { valeur } = await chargerCarnet(exam);
        e = await demarrerSeanceMots(exam, valeur, { taille: r.tailleSeanceMots, origine, nombre: nombre && !Number.isNaN(nombre) ? nombre : undefined });
      }
      if (!e) {
        setPhase({ nom: 'aucun' });
        return;
      }
      setEtat(e);
      setPhase({ nom: 'ok' });
    } catch {
      setPhase({ nom: 'erreur' });
    }
  }, [origine, nombre]);

  useEffect(() => {
    // Chargement initial : l'état de chargement est posé par `charger` lui-même.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void charger();
  }, [charger]);

  const retourner = async () => {
    if (!etat || etat.retourne || occupe.current) return;
    occupe.current = true;
    try {
      setEtat(await retournerCarte(etat));
    } finally {
      occupe.current = false;
    }
  };

  /** QCM (v32) : le choix révèle la réponse (recto et verso), puis « Suivant » note la carte. */
  const choisir = async (index: number) => {
    if (!etat || etat.retourne || occupe.current) return;
    occupe.current = true;
    try {
      setChoix({ carte: carteCourante(etat)?.id ?? '', index });
      setEtat(await retournerCarte(etat));
    } finally {
      occupe.current = false;
    }
  };

  const noter = async (connu: boolean) => {
    if (!etat || !etat.retourne || occupe.current || !reglages) return;
    const carte = carteCourante(etat);
    if (!carte) return;
    occupe.current = true;
    try {
      const apres = appliquerResultatMot({ motId: carte.id, boite: carte.boite, prochaineRevue: carte.prochaineRevue, vus: carte.vus, bons: carte.bons, mauvais: carte.mauvais }, connu, jourDe(new Date()), reglages);
      suivre('cert_word_state_changed', { mot: carte.id, boite_avant: carte.boite, boite_apres: apres.boite });
      const suivant = await noterCarte(etat, connu);
      setEtat(suivant);
      if (suivant.termine) router.replace('/certification/mots-fin' as never);
    } finally {
      occupe.current = false;
    }
  };

  const sortir = () => {
    setQuitter(false);
    if (origine === 'seance') router.replace('/certification/seance' as never);
    else router.replace({ pathname: '/reviser', params: { onglet: 'carnet' } } as never);
  };

  const carte = etat ? carteCourante(etat) : null;
  const total = etat?.cartes.length ?? 0;
  const delai = reglages?.delaisBoitesJours[0] ?? 1;

  return (
    <Ecran insetBas={false} entete={<EnteteToeic titre={etat && carte ? t('certification.seanceMots.entete', { k: etat.index + 1, n: total }) : t('certification.carnet.entete')} droite={<BoutonFermer icone="close" libelle={t('certification.seanceMots.quitterTitre')} onPress={() => (etat && !etat.termine ? setQuitter(true) : sortir())} />} />}>
      {phase.nom === 'chargement' ? <Text style={[typo.petit, { color: theme.texte.secondaire }]}>{t('certification.carnet.chargement')}</Text> : null}
      {phase.nom === 'erreur' ? (
        <View style={styles.groupe}>
          <Banniere ton="erreur" titre={t('certification.carnet.erreurTitre')} texte={t('certification.carnet.erreurTexte')} />
          <Bouton libelle={t('certification.reessayer')} onPress={() => void charger()} />
        </View>
      ) : null}
      {phase.nom === 'aucun' ? (
        <View style={styles.groupe}>
          <EncadrePointille texte={`${t('certification.seanceMots.aucunTitre')}. ${t('certification.seanceMots.aucunTexte')}`} />
          <Bouton libelle={t('certification.seanceMots.retour')} onPress={sortir} />
        </View>
      ) : null}
      {phase.nom === 'ok' && etat && carte ? (
        <View style={styles.groupe}>
          <BarreProgression pourcent={(etat.index / total) * 100} libelle={t('certification.seanceMots.entete', { k: etat.index + 1, n: total })} />
          <View style={[styles.carte, { backgroundColor: theme.fond.surface, borderColor: theme.bord.fort }]}>
            <Text style={[typo.etiquette, { color: theme.texte.secondaire }]}>{t('certification.seanceMots.choisis')}</Text>
            <Text style={[typo.h1, { color: theme.texte.principal, textAlign: 'center' }]}>{carte.mot}</Text>
          </View>
          <View style={styles.groupe}>
            {propositionsMot(carte, etat.cartes).map((p, i) => {
              const choisie = choix?.carte === carte.id && choix.index === i;
              const repondu = etat.retourne;
              const fond = !repondu ? theme.fond.surface : p.juste ? theme.etat.succesDoux : choisie ? theme.etat.erreurDoux : theme.fond.surface;
              const etiquetteReponse = !repondu ? null : p.juste ? t('certification.seanceMots.bonneReponse') : choisie ? t('certification.seanceMots.taReponse') : null;
              return (
                <Appui
                  key={`${carte.id}-${i}`}
                  accessibilityRole="button"
                  accessibilityLabel={`${String.fromCharCode(65 + i)}. ${p.texte}`}
                  accessibilityState={{ disabled: repondu }}
                  disabled={repondu}
                  onPress={() => void choisir(i)}
                  decalage={repondu ? 0 : 2}
                  rayon={rayon.m}
                  retour={!repondu}
                >
                  <View style={[styles.option, { backgroundColor: fond, borderColor: theme.bord.fort, borderWidth: choisie ? bord.epais : bord.normal }]}>
                    <View style={[styles.lettre, { borderColor: theme.bord.fort }]}>
                      <Text style={[typo.legende, { color: theme.texte.principal }]}>{String.fromCharCode(65 + i)}</Text>
                    </View>
                    <Text style={[typo.texte, { color: theme.texte.principal, flex: 1 }]}>{p.texte}</Text>
                    {etiquetteReponse ? (
                      <View style={styles.etiquette}>
                        {p.juste ? <Check size={16} color={theme.texte.principal} strokeWidth={2} /> : <X size={16} color={theme.texte.principal} strokeWidth={2} />}
                        <Text style={[typo.etiquette, { color: theme.texte.principal }]}>{etiquetteReponse}</Text>
                      </View>
                    ) : null}
                  </View>
                </Appui>
              );
            })}
          </View>
          {etat.retourne && choix?.carte === carte.id ? (
            <Text style={[typo.petit, { color: theme.texte.secondaire, textAlign: 'center' }]}>
              {choix.index !== propositionsMot(carte, etat.cartes).findIndex((p) => p.juste)
                ? (delai === 1 ? t('certification.seanceMots.motRevoir', { n: delai }) : t('certification.seanceMots.motRevoirPluriel', { n: delai }))
                : t('certification.seanceMots.motJuste')}
            </Text>
          ) : null}
          {etat.enAttente.length > 0 ? <Banniere ton="info" titre={t('certification.seanceMots.attente')} /> : null}
          <Bouton
            libelle={t('certification.seanceMots.suivant')}
            desactive={!etat.retourne || choix?.carte !== carte.id}
            onPress={() => void noter(choix?.index === propositionsMot(carte, etat.cartes).findIndex((p) => p.juste))}
          />
        </View>
      ) : null}
      <FeuilleQuitter mots ouverte={quitter} onReprendre={() => setQuitter(false)} onQuitter={sortir} />
    </Ecran>
  );
}

const styles = StyleSheet.create({
  groupe: { gap: espace[3] },
  carte: { borderWidth: bord.epais, borderRadius: rayon.l, padding: espace[5], minHeight: 160, alignItems: 'center', justifyContent: 'center', gap: espace[3] },
  option: { minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: espace[3], paddingHorizontal: espace[3], paddingVertical: espace[2], borderRadius: rayon.m },
  lettre: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center', borderWidth: bord.normal, borderRadius: rayon.s },
  etiquette: { flexDirection: 'row', alignItems: 'center', gap: espace[1] },
});
