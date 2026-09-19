import { useCallback, useEffect, useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from "react-native";
import { router } from "expo-router";
import AppBar from "../components/AppBar";
import PageHeader from "../components/PageHeader";
import { getSession } from "../services/authStorage";
import { getResumo, listMaterials } from "../services/materialApi";
import { isVencido } from "../utils/validade";

// Mesmas categorias usadas no cadastro de Materiais — fixas, pra o
// gráfico sempre mostrar as três colunas, mesmo com contagem zero.
const CATEGORIAS = ["EPI", "Uniforme", "Outro"];

export default function tela_inicial() {
  const [checkingSession, setCheckingSession] = useState(true);
  const [session, setSession] = useState(null);

  // Número de "itens próximos da validade" pro aviso no topo (continua
  // vindo do getResumo, sem mudanças nessa parte).
  const [resumo, setResumo] = useState(null);
  const [loadingResumo, setLoadingResumo] = useState(true);
  const [resumoError, setResumoError] = useState("");

  // Lista de materiais ativos — usada pro gráfico por categoria e pra
  // contar quantos estão vencidos.
  const [materials, setMaterials] = useState([]);
  const [loadingMaterials, setLoadingMaterials] = useState(true);
  const [materialsError, setMaterialsError] = useState("");

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

  const loadMaterials = useCallback(async (token) => {
    setLoadingMaterials(true);
    setMaterialsError("");
    try {
      const response = await listMaterials(token, { ativo: true });
      setMaterials(response.materials || []);
    } catch (error) {
      console.error("Erro ao carregar materiais:", error);
      setMaterialsError(error?.message || "Não foi possível carregar os materiais.");
    } finally {
      setLoadingMaterials(false);
    }
  }, []);

  useEffect(() => {
    if (session?.token) {
      loadResumo(session.token);
      loadMaterials(session.token);
    }
  }, [session, loadResumo, loadMaterials]);

  if (checkingSession) {
    return null;
  }

  const proximosDaValidade = resumo?.proximosDaValidade ?? 0;

  // Contagem por categoria, pro gráfico de barras.
  const categoriaCounts = CATEGORIAS.map((categoria) => ({
    categoria,
    quantidade: materials.filter((material) => material.categoria === categoria).length,
  }));
  const maxCategoriaCount = Math.max(1, ...categoriaCounts.map((c) => c.quantidade));
  const totalCadastrados = materials.length;

  // Quantos materiais ativos já passaram da validade.
  const vencidosCount = materials.filter((material) => isVencido(material.validade)).length;

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

            {/* Produtos cadastrados, agora como gráfico por categoria */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Produtos Cadastrados</Text>

              {loadingMaterials ? (
                <ActivityIndicator />
              ) : materialsError ? (
                <Text style={styles.errorText}>{materialsError}</Text>
              ) : (
                <>
                  <Text style={styles.cardSubtitle}>{totalCadastrados} no total</Text>

                  <View style={styles.barChartContainer}>
                    {categoriaCounts.map(({ categoria, quantidade }) => (
                      <View key={categoria} style={styles.barColumn}>
                        <Text style={styles.barValue}>{quantidade}</Text>
                        <View
                          style={[
                            styles.bar,
                            { height: Math.max((quantidade / maxCategoriaCount) * 90, 4) },
                          ]}
                        />
                        <Text style={styles.barLabel} numberOfLines={1}>
                          {categoria}
                        </Text>
                      </View>
                    ))}
                  </View>
                </>
              )}
            </View>

            {/* Vencidos — clicável, leva pro Estoque já filtrado */}
            <TouchableOpacity
              style={[styles.card, { backgroundColor: "#C86756" }]}
              activeOpacity={0.85}
              onPress={() =>
                router.push({ pathname: "/estoque", params: { filtro: "vencidos" } })
              }
            >
              <Text style={[styles.cardTitle, { color: 'white' }]}>Vencidos</Text>
              {loadingMaterials ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <Text style={[styles.cardNumber, { color: 'white' }]}>{vencidosCount}</Text>
              )}
            </TouchableOpacity>

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
    backgroundColor: "#e7e7e7d2",
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

  cardSubtitle: {
    fontSize: 12,
    color: "#5f6368",
    marginBottom: 10,
  },

  cardNumber: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#000000",
  },

  // Gráfico de barras por categoria
  barChartContainer: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "center",
    gap: 18,
    height: 110,
  },

  barColumn: {
    alignItems: "center",
    justifyContent: "flex-end",
    width: 44,
  },

  barValue: {
    fontSize: 11,
    fontWeight: "600",
    color: "#1a1a1a",
    marginBottom: 4,
  },

  bar: {
    width: 26,
    backgroundColor: "#1b4a3b",
    borderRadius: 4,
  },

  barLabel: {
    fontSize: 10,
    color: "#5f6368",
    marginTop: 6,
    textAlign: "center",
  },
});