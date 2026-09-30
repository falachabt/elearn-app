import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useMemo, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";

import { useTraduction } from "@/i18n/useTraduction";
import {
  filtrer,
  optionsFiltres,
  type Sujet,
} from "@/services/annales";
import { useTheme } from "@/theme/ThemeProvider";
import { bord, espace, matiere as couleurs, rayon, typo } from "@/theme/theme";

import { Appui } from "../Appui";
import { Banniere } from "../Banniere";
import { Bouton } from "../Bouton";

export function Puce({
  libelle,
  choisie,
  onPress,
}: {
  libelle: string;
  choisie: boolean;
  onPress: () => void;
}) {
  const { theme } = useTheme();
  return (
    <Appui
      accessibilityRole="button"
      accessibilityState={{ selected: choisie }}
      accessibilityLabel={libelle}
      onPress={onPress}
      rayon={rayon.pilule}
      decalage={0}
    >
      <View
        style={[
          styles.puce,
          {
            borderColor: theme.bord.fort,
            backgroundColor: choisie
              ? theme.texte.principal
              : theme.fond.surface,
          },
        ]}
      >
        <Text
          style={[
            typo.boutonPetit,
            { color: choisie ? theme.fond.app : theme.texte.principal },
          ]}
        >
          {libelle}
        </Text>
      </View>
    </Appui>
  );
}

/** Sujets d'un concours (M6-01, M6-02) : filtre par année, un sujet gratuit par concours, les autres avec le pass. */
export function ListeSujets({ sujets }: { sujets: Sujet[] }) {
  const { t } = useTraduction();
  const { theme } = useTheme();
  const [annee, setAnnee] = useState<number | null>(null);
  const options = useMemo(() => optionsFiltres(sujets), [sujets]);
  const liste = useMemo(() => filtrer(sujets, { annee }), [sujets, annee]);

  return (
    <View style={styles.groupe}>
      {options.annees.length > 1 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.puces}
        >
          <Puce
            libelle={t("annales.tous")}
            choisie={!annee}
            onPress={() => setAnnee(null)}
          />
          {options.annees.map((a) => (
            <Puce
              key={a}
              libelle={String(a)}
              choisie={annee === a}
              onPress={() => setAnnee(a)}
            />
          ))}
        </ScrollView>
      ) : null}
      {!liste.length ? <Banniere ton="info" titre={t("annales.vide")} /> : null}
      {liste.map((s) => {
        const entete = s.annee ? `${s.annee} · ${s.titre}` : s.titre;
        const details = [
          s.corrige ? t("annales.sujetCorrige") : t("annales.sujetSeul"),
          s.dureeMin ? t("annales.duree", { n: s.dureeMin }) : null,
        ]
          .filter(Boolean)
          .join(" · ");
        return (
          <Appui
            key={s.id}
            accessibilityRole="button"
            accessibilityLabel={`${entete}. ${details}. ${s.gratuit ? t("annales.gratuit") : t("annales.pass")}`}
            onPress={() =>
              router.push({
                pathname: "/annales/sujet",
                params: { id: String(s.id) },
              })
            }
            rayon={rayon.l}
            ombre={4}
            decalage={3}
            couleurOmbre={theme.ombre}
          >
            <View
              style={[
                styles.carte,
                {
                  backgroundColor: theme.fond.surface,
                  borderColor: theme.bord.fort,
                },
              ]}
            >
              <View
                style={[
                  styles.icone,
                  {
                    backgroundColor: couleurs.maths,
                    borderColor: theme.bord.fort,
                  },
                ]}
              >
                <Ionicons
                  name="document-text-outline"
                  size={18}
                  color={theme.texte.surCouleur}
                />
              </View>
              <View style={styles.flex}>
                <Text
                  style={[typo.texteFort, { color: theme.texte.principal }]}
                >{entete}</Text>
                <Text style={[typo.legende, { color: theme.texte.secondaire }]}>
                  {details}
                </Text>
              </View>
              <View
                style={[
                  styles.badge,
                  {
                    borderColor: theme.bord.fort,
                    backgroundColor: s.gratuit
                      ? theme.marque.principale
                      : theme.accent.soleil,
                  },
                ]}
              >
                {s.gratuit ? null : (
                  <Ionicons
                    name="lock-closed"
                    size={11}
                    color={theme.texte.surCouleur}
                  />
                )}
                <Text
                  style={[typo.etiquette, { color: theme.texte.surCouleur }]}
                >
                  {s.gratuit ? t("annales.gratuit") : t("annales.pass")}
                </Text>
              </View>
            </View>
          </Appui>
        );
      })}
      <Bouton
        variante="texte"
        libelle={t("annales.voirPass")}
        onPress={() =>
          router.push({
            pathname: "/offres",
            params: { declencheur: "limite" },
          })
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  groupe: { gap: espace[4] },
  puces: { gap: espace[3], paddingRight: espace[4] },
  puce: {
    paddingHorizontal: espace[5],
    paddingVertical: espace[3],
    borderWidth: bord.normal,
    borderRadius: rayon.pilule,
  },
  carte: {
    flexDirection: "row",
    alignItems: "center",
    gap: espace[4],
    padding: espace[5],
    borderWidth: bord.normal,
    borderRadius: rayon.l,
  },
  icone: {
    width: 36,
    height: 36,
    borderRadius: rayon.m,
    borderWidth: bord.normal,
    alignItems: "center",
    justifyContent: "center",
  },
  flex: { flex: 1 },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: espace[1],
    paddingHorizontal: espace[3],
    paddingVertical: espace[1],
    borderWidth: bord.normal,
    borderRadius: rayon.s,
  },
});
