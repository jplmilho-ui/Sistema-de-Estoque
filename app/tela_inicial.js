import { useCallback, useEffect, useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from "react-native";
import { router } from "expo-router";
import AppBar from "../components/AppBar";
import PageHeader from "../components/PageHeader";
import { getSession } from "../services/authStorage";
import { getResumo } from "../services/materialApi";

export default function tela_inicial() {
  const [checkingSession, setCheckingSession] = useState(true);
  const [session, setSession] = useState(null);

  // Números reais do resumo (antes eram fixos: 5, 3, 1).
  const [resumo, setResumo] = useState(null);
  const [loadingResumo, setLoadingResumo] = useState(true);
  const [resumoError, setResumoError] = useState("");

  useEffect(() => {
    async function verifySession() {
      const currentSession = await getSession();
      if (!currentSession?.token) {
        router.replace("/");
        return;
      }
      setSession(currentSession);
      setCheckingSession(false);
    }
    verifySession();
  }, []);

  const loadResumo = useCallback(async (token) => {
    setLoadingResumo(true);
    setResumoError("");
    try {
      const data = await getResumo(token);
      setResumo(data);
    } catch (error) {
      console.error("Erro ao carregar resumo:", error);
      setResumoError(error?.message || "Não foi possível carregar os números.");
    } finally {
      setLoadingResumo(false);
    }
  }, []);

  useEffect(() => {
    if (session?.token) {
      loadResumo(session.token);
    }
  }, [session, loadResumo]);

  if (checkingSession) {
    return null;
  }

  const proximosDaValidade = resumo?.proximosDaValidade ?? 0;

  return (
    <AppBar>
      <PageHeader title="Tela Inicial" />
      <View style={styles.Space}>
        <View style={styles.contentArea}>

          {/* Aviso de validação */}
          {!loadingResumo && !resumoError && proximosDaValidade > 0 && (
            <View style={styles.validationRow}>
              <View style={styles.validationMessage}>
                <Text style={styles.validationText}>
                  Você possui {proximosDaValidade}{" "}
                  {proximosDaValidade === 1 ? "item" : "itens"} próximos da validade!
                </Text>
              </View>

              <TouchableOpacity
                style={styles.verificarButton}
                onPress={() => router.push("/estoque")}
              >
                <Text style={styles.verificarText}>Verificar</Text>
              </TouchableOpacity>
            </View>
          )}

          {!!resumoError && (
            <View style={styles.validationRow}>
              <Text style={styles.errorText}>{resumoError}</Text>
            </View>
          )}

          {/* Cards */}
          <View style={styles.cardsContainer}>

            <View style={styles.card}>
              <Text style={styles.cardTitle}>Produtos Cadastrados</Text>
              {loadingResumo ? (
                <ActivityIndicator />
              ) : (
                <Text style={styles.cardNumber}>{resumo?.totalCadastrados ?? "—"}</Text>
              )}
            </View>

            <View style={styles.card}>
              <Text style={styles.cardTitle}>Itens Auditados</Text>
              {loadingResumo ? (
                <ActivityIndicator />
              ) : (
                <Text style={styles.cardNumber}>{resumo?.auditados ?? "—"}</Text>
              )}
            </View>

            <View style={[styles.card, { backgroundColor: "#C86756" }]}>
              <Text style={styles.cardTitle}>Divergências</Text>
              {loadingResumo ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <Text style={styles.cardNumber}>{resumo?.divergencias ?? "—"}</Text>
              )}
            </View>

          </View>

        </View>
      </View>
    </AppBar>
  );
}

const styles = StyleSheet.create({
  retirarButton: {
    borderWidth: 1,
    borderColor: "#b1b1b1",
    borderRadius: 4,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: "#ffffff",
  },

  retirarButtonText: {
    fontSize: 13,
    color: "#1a1a1a",
  },

  Space: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 16,
  },

  contentArea: {
    flex: 1,
    backgroundColor: "#e0e0e0",
    borderRadius: 7,
    padding: 22,
  },

  validationRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 24,
  },

  validationMessage: {
    backgroundColor: "#ffffff",
    borderRadius: 6,
    paddingHorizontal: 18,
    paddingVertical: 10,
  },

  validationText: {
    fontSize: 14,
    color: "#1a1a1a",
  },

  errorText: {
    fontSize: 13,
    color: "#c62828",
  },

  verificarButton: {
    borderWidth: 1,
    borderRadius: 4,
    backgroundColor: "#1B4A3B",
    paddingHorizontal: 22,
    paddingVertical: 7,
  },

  verificarText: {
    fontSize: 12,
    color: "#ffffff",
  },

  cardsContainer: {
    flexDirection: "row",
    gap: 20,
  },

  card: {
    flex: 1,
    height: 200,
    backgroundColor: "#ffffff",
    borderRadius: 6,
    alignItems: "center",
    justifyContent: "center",
  },

  cardTitle: {
    fontSize: 16,
    color: "#222222",
    marginBottom: 8,
  },


  cardNumber: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#000000",
  },
});
