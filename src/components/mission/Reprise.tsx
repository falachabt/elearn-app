import { Image } from "expo-image";
import { router, useFocusEffect } from "expo-router";
import { Play } from "lucide-react-native";
import { useCallback, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { useTraduction } from "@/i18n/useTraduction";
import { lireProfil } from "@/services/profil";
import { lireReprise, type ElementReprise } from "@/services/reprise";
import { formaterDuree } from "@/services/videos";
import { garderMemorise, lireMemorise } from "@/services/memoire";
import { lireCours, programmeDu } from "@/services/reviser";
import { getSupabase } from "@/services/supabase";
import { titreExercice } from "@/services/titres";
import { useSessionPrete } from "@/session/SessionProvider";
import { useTheme } from "@/theme/ThemeProvider";
import { bord, espace, ombre, rayon, typo } from "@/theme/theme";

import { Apparition } from "../Apparition";
import { Appui } from "../Appui";
import { libelleQuiz } from "../entrainement/libelles";
import { CarteListe } from "../liste/CarteListe";
import { PastilleType } from "../liste/PastilleType";

/** C1 · Accueil, reprise (M4-09) : sous la mission du jour, jusqu'à 4 cartes (leçon, quiz, exercice, vidéo en cours). Rien si tout est fini. */
export function Reprise() {
  const { t } = useTraduction();
  const { theme } = useTheme();
  const pret = useSessionPrete();
  const [elements, setElements] = useState<ElementReprise[]>(() => lireMemorise('accueil.reprise', []));

  useFocusEffect(
    useCallback(() => {
      let actif = true;
      void (async () => {
        // Les cours (copie locale de moins de 12 h) donnent la matière et le nom du chapitre ; sans eux, la reprise reste possible.
        const cours = pret
          ? await lireCours(
              getSupabase(),
              programmeDu(await lireProfil()),
            ).catch(() => [])
          : [];
        const e = await lireReprise(cours, getSupabase()).catch(() => []);
        garderMemorise('accueil.reprise', e);
        if (actif) setElements(e);
      })();
      return () => {
        actif = false;
      };
    }, [pret]),
  );

  if (!elements.length) return null;
  return (
    <Apparition delai={90}>
      <View style={styles.groupe}>
        <Text
          accessibilityRole="header"
          style={[typo.etiquette, { color: theme.texte.secondaire }]}
        >
          {t("mission.reprendre")}
        </Text>
        {elements.map((e) => {
          const detail = (x: string | null) =>
            [e.matiere, x].filter(Boolean).join(" · ");
          if (e.type === "lecon") {
            const l = e.lecon;
            return (
              <CarteListe
                key="lecon"
                gauche={<PastilleType type="lecon" play />}
                titre={
                  l.numero
                    ? t("mission.repriseLecon", { n: l.numero, nom: l.nom })
                    : l.nom
                }
                sousTitre={detail(
                  l.minutes
                    ? t("mission.repriseMinutes", { n: l.minutes })
                    : null,
                )}
                onPress={() =>
                  router.push({
                    pathname: "/cours/lecon",
                    params: {
                      id: String(l.id),
                      cours: String(l.cours),
                      matiere: e.matiere,
                    },
                  })
                }
              />
            );
          }
          if (e.type === "video") {
            const v = e.video;
            // Carte « lecteur » (retour de Benny, 26/10/2026) : pour une vidéo, la reprise montre le
            // lecteur complet — grande miniature 16:9, bouton lecture au centre, durée en coin et
            // barre de progression de reprise — au lieu d'une ligne de liste qui se confondait avec
            // un exercice ou une leçon. Les autres types gardent leur CarteListe.
            const progression = v.dureeS ? Math.min(1, v.positionS / v.dureeS) : 0;
            const sousTitreVideo = detail(
              [
                t("videos.reprendreA", { temps: formaterDuree(v.positionS) }),
                v.dureeS ? t("videos.reste", { temps: formaterDuree(Math.max(0, v.dureeS - v.positionS)) }) : null,
              ]
                .filter(Boolean)
                .join(" · "),
            );
            return (
              <Appui
                key="video"
                accessibilityRole="button"
                accessibilityLabel={`${t("videos.partie", { n: v.numero })}. ${v.titre}. ${sousTitreVideo}`}
                onPress={() =>
                  router.push({
                    pathname: "/video",
                    params: { cours: String(v.cours), video: v.id, nom: e.chapitre, matiere: e.matiere },
                  })
                }
                rayon={rayon.m}
                ombre={ombre.carte}
                decalage={2}
                couleurOmbre={theme.ombre}
              >
                <View style={[styles.carteVideo, { backgroundColor: theme.fond.surface, borderColor: theme.bord.fort }]}>
                  <View style={styles.visuelVideo}>
                    {v.miniature ? (
                      <Image source={{ uri: v.miniature }} style={styles.visuelVideoImage} contentFit="cover" />
                    ) : (
                      <View style={[styles.visuelVideoImage, { backgroundColor: theme.fond.creux }]} />
                    )}
                    <View style={[styles.boutonLectureVideo, { backgroundColor: theme.marque.principale, borderColor: theme.bord.fort }]}>
                      <Play size={21} strokeWidth={2.5} color={theme.texte.surCouleur} fill={theme.texte.surCouleur} />
                    </View>
                    {v.dureeS ? (
                      <View style={styles.dureeVideo}>
                        <Text style={styles.dureeVideoTexte}>{formaterDuree(v.dureeS)}</Text>
                      </View>
                    ) : null}
                    {progression > 0 ? (
                      <View style={styles.progressionVideoFond}>
                        <View style={[styles.progressionVideo, { width: `${Math.round(progression * 100)}%`, backgroundColor: theme.marque.principale }]} />
                      </View>
                    ) : null}
                  </View>
                  <View style={styles.texteVideo}>
                    <Text style={[typo.etiquette, { color: theme.marque.forte }]}>
                      {t("videos.partie", { n: v.numero })} · {t("videos.aReprendre")}
                    </Text>
                    <Text numberOfLines={2} style={[typo.texteFort, styles.titreVideo, { color: theme.texte.principal }]}>
                      {v.titre}
                    </Text>
                    <Text numberOfLines={1} style={[typo.legende, { color: theme.texte.secondaire }]}>
                      {sousTitreVideo}
                    </Text>
                  </View>
                </View>
              </Appui>
            );
          }
          const d = e.dernier;
          const chapitre = e.chapitre || d.chapitre;
          if (e.type === "quiz") {
            return (
              <CarteListe
                key="quiz"
                gauche={<PastilleType type="quiz" />}
                titre={libelleQuiz(t, d.nom, chapitre, d.numero)}
                sousTitre={detail(
                  d.meilleur !== undefined
                    ? t("mission.repriseMeilleur", { n: d.meilleur })
                    : chapitre,
                )}
                onPress={() =>
                  router.push({
                    pathname: "/entrainement/quiz",
                    params: { id: d.id, cours: String(d.cours), nom: chapitre },
                  })
                }
              />
            );
          }
          return (
            <CarteListe
              key="exercice"
              gauche={<PastilleType type="exercice" />}
              titre={
                titreExercice(d.nom, chapitre) ||
                t("entrainement.exerciceN", { n: d.rang })
              }
              sousTitre={detail(
                t("mission.repriseExercice", { n: d.rang, total: d.total }),
              )}
              onPress={() =>
                router.push({
                  pathname: "/entrainement/exercice",
                  params: { id: d.id, cours: String(d.cours) },
                })
              }
            />
          );
        })}
      </View>
    </Apparition>
  );
}

const styles = StyleSheet.create({
  groupe: { gap: espace[4] },
  carteVideo: { borderWidth: bord.normal, borderRadius: rayon.m, overflow: "hidden" },
  visuelVideo: { width: "100%", aspectRatio: 16 / 9, position: "relative", backgroundColor: "#000" },
  visuelVideoImage: { width: "100%", height: "100%" },
  boutonLectureVideo: { position: "absolute", left: "50%", top: "50%", marginLeft: -25, marginTop: -25, width: 50, height: 50, borderRadius: 25, borderWidth: bord.normal, alignItems: "center", justifyContent: "center" },
  dureeVideo: { position: "absolute", right: espace[2], bottom: espace[2], backgroundColor: "rgba(10,10,10,0.85)", borderRadius: rayon.pilule, paddingHorizontal: espace[2], paddingVertical: 1 },
  dureeVideoTexte: { color: "#FFF7E3", fontSize: 11, fontWeight: "700" },
  progressionVideoFond: { position: "absolute", left: 0, right: 0, bottom: 0, height: 6, backgroundColor: "rgba(10,10,10,0.45)" },
  progressionVideo: { height: "100%" },
  texteVideo: { padding: espace[3], gap: espace[1] },
  titreVideo: { fontSize: 15, lineHeight: 20 },
});
