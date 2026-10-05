import { useCallback, useEffect, useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from "react-native";
import { router } from "expo-router";
import AppBar from "../components/AppBar";
import PageHeader from "../components/PageHeader";
import { getSession } from "../services/authStorage";
import { getResumo, listMaterials } from "../services/materialApi";
// TODO: quando existir o endpoint de movimentações, importar aqui, ex:
// import { listMovimentacoes } from "../services/movimentacaoApi";
import { isVencido } from "../utils/validade";

// Mesmas categorias usadas no cadastro de Materiais — fixas, pra o
// gráfico sempre mostrar as três colunas, mesmo com contagem zero.
const CATEGORIAS = ["EPI", "Uniforme", "Outro"];

const DATA_LABEL = new Date().toLocaleDateString("pt-BR", {
  weekday: "short",
  day: "2-digit",
  month: "long",
  year: "numeric",
});

export default function tela_inicial() {
  const [checkingSession, setCheckingSession] = useState(true);
  const [session, setSession] = useState(null);

  // Número de "itens próximos da validade" pro aviso no topo (continua
  // vindo do getResumo, sem mudanças nessa parte).
  const [resumo, setResumo] = useState(null);
  const [loadingResumo, setLoadingResumo] = useState(true);
  const [resumoError, setResumoError] = useState("");

  // Lista de materiais ativos — usada pro gráfico por categoria, pro
  // card "Materiais cadastrados" e pra contar quantos estão vencidos.
  const [materials, setMaterials] = useState([]);
  const [loadingMaterials, setLoadingMaterials] = useState(true);
  const [materialsError, setMaterialsError] = useState("");

  // TODO: ligar numa API real de movimentações. Por enquanto fica
  // como placeholder pra tela não quebrar antes do endpoint existir.
  const [movimentacoes, setMovimentacoes] = useState([]);
  const [loadingMovimentacoes, setLoadingMovimentacoes] = useState(false);

  useEffect(() => {
    async function verifySession() {
      const currentSession = await getSession();
      if (!currentSession?.token) {
        router.replace("/");
        return;
      }
      // Aluno só usa a tela de Solicitações.
      if (currentSession.user?.role === "aluno") {
        router.replace("/solicitacoes");
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
      // TODO: loadMovimentacoes(session.token) quando o endpoint existir.
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

  // "Tipos" distintos de material cadastrados (nomes únicos), pro card
  // "Materiais cadastrados" — ajuste aqui se o backend já expuser essa
  // contagem pronta em getResumo().
  const tiposCadastrados = new Set(materials.map((m) => m.nome)).size;

  // Quantos materiais ativos já passaram da validade.
  const vencidosCount = materials.filter((material) => isVencido(material.validade)).length;

  const statCards = [
    {
      key: "produtos",
      icon: "📦",
      label: "Itens em estoque",
      value: loadingMaterials ? null : totalCadastrados,
      variant: "default",
    },
    {
      key: "materiais",
      icon: "💉",
      label: "Materiais cadastrados",
      value: loadingMaterials ? null : tiposCadastrados,
      variant: "default",
    },
    {
      key: "vencidos",
      icon: "⚠️",
      label: "Produtos vencidos",
      value: loadingMaterials ? null : vencidosCount,
      variant: "danger",
      onPress: () => router.push({ pathname: "/estoque", params: { filtro: "vencidos" } }),
    },
    {
      key: "movimentacoes",
      icon: "🔁",
      label: "Movimentações",
      value: loadingMovimentacoes ? null : movimentacoes.length,
      variant: "default",
    },
  ];

  return (
    <AppBar>
      <PageHeader title="Tela Inicial"/>
      <View style={styles.Space}>
        <View style={styles.contentArea}>

          {/* Saudação */}
          <View style={styles.greetingRow}>
            <View>
              <Text style={styles.greetingTitle}>Olá! 👋</Text>
              <Text style={styles.greetingSubtitle}>
                Bem-vindo ao Sistema de Estoque do Curso de Enfermagem.
              </Text>
            </View>
            <View style={styles.dateBadge}>
              <Text style={styles.dateBadgeText}>{DATA_LABEL}</Text>
            </View>
          </View>

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

          <Text style={styles.sectionTitle}>Visão geral do estoque</Text>

          {/* Cards de resumo */}
          <View style={styles.statsRow}>
            {statCards.map((card) => {
              const CardWrapper = card.onPress ? TouchableOpacity : View;
              return (
                <CardWrapper
                  key={card.key}
                  style={[
                    styles.statCard,
                    card.variant === "danger" && styles.statCardDanger,
                  ]}
                  activeOpacity={card.onPress ? 0.85 : 1}
                  onPress={card.onPress}
                >
                  <View
                    style={[
                      styles.statIconCircle,
                      card.variant === "danger" && styles.statIconCircleDanger,
                    ]}
                  >
                    <Text style={styles.statIcon}>{card.icon}</Text>
                  </View>
                  <View style={styles.statTextArea}>
                    <Text style={styles.statLabel}>{card.label}</Text>
                    {card.value === null ? (
                      <ActivityIndicator size="small" />
                    ) : (
                      <Text style={styles.statValue}>{card.value}</Text>
                    )}
                  </View>
                </CardWrapper>
              );
            })}
          </View>

          {/* Gráfico + últimas movimentações */}
          <View style={styles.panelsRow}>

            {/* Produtos Cadastrados — gráfico por categoria */}
            <View style={styles.chartPanel}>
              <View style={styles.panelHeaderRow}>
                <View>
                  <Text style={styles.panelTitle}>Produtos Cadastrados</Text>
                  <Text style={styles.panelSubtitle}>Quantidade por categoria</Text>
                </View>
              </View>

              {loadingMaterials ? (
                <ActivityIndicator style={{ marginTop: 24 }} />
              ) : materialsError ? (
                <Text style={styles.errorText}>{materialsError}</Text>
              ) : (
                <View style={styles.barChartContainer}>
                  {categoriaCounts.map(({ categoria, quantidade }) => (
                    <View key={categoria} style={styles.barColumn}>
                      <Text style={styles.barValue}>{quantidade}</Text>
                      <View
                        style={[
                          styles.bar,
                          { height: Math.max((quantidade / maxCategoriaCount) * 220, 6) },
                        ]}
                      />
                      <Text style={styles.barLabel} numberOfLines={1}>
                        {categoria}
                      </Text>
                    </View>
                  ))}
                </View>
              )}
            </View>

            {/* Últimas movimentações */}
            <View style={styles.movPanel}>
              <View style={styles.panelHeaderRow}>
                <Text style={styles.panelTitle}>Últimas movimentações</Text>
                <TouchableOpacity onPress={() => router.push("/movimentacoes")}>
                  <Text style={styles.verTodasText}>Ver todas →</Text>
                </TouchableOpacity>
              </View>

              {loadingMovimentacoes ? (
                <ActivityIndicator style={{ marginTop: 24 }} />
              ) : movimentacoes.length === 0 ? (
                <Text style={styles.emptyMovText}>
                  Nenhuma movimentação registrada ainda.
                </Text>
              ) : (
                movimentacoes.map((mov) => (
                  <View key={mov.id} style={styles.movRow}>
                    <View
                      style={[
                        styles.movIconCircle,
                        mov.tipo === "entrada" ? styles.movIconEntrada : styles.movIconSaida,
                      ]}
                    >
                      <Text style={styles.movIconText}>
                        {mov.tipo === "entrada" ? "↑" : "↓"}
                      </Text>
                    </View>
                    <View style={styles.movInfo}>
                      <Text style={styles.movNome}>{mov.nome}</Text>
                      <Text
                        style={[
                          styles.movTipo,
                          mov.tipo === "entrada" ? styles.movTipoEntrada : styles.movTipoSaida,
                        ]}
                      >
                        {mov.tipo === "entrada" ? "Entrada" : "Saída"}
                      </Text>
                    </View>
                    <View style={styles.movRight}>
                      <Text
                        style={[
                          styles.movQuantidade,
                          mov.tipo === "entrada" ? styles.movTipoEntrada : styles.movTipoSaida,
                        ]}
                      >
                        {mov.tipo === "entrada" ? "+" : "-"} {mov.quantidade} un.
                      </Text>
                      <Text style={styles.movData}>{mov.data}</Text>
                    </View>
                  </View>
                ))
              )}
            </View>

          </View>

        </View>
      </View>
    </AppBar>
  );
}

const styles = StyleSheet.create({
  Space: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 16,
  },

  contentArea: {
    flex: 1,
    backgroundColor: "#f7f7f7",
    borderRadius: 7,
    padding: 22,
  },

  greetingRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 18,
  },

  greetingTitle: {
    fontSize: 22,
    fontWeight: "bold",
    color: "#0ba572",
    marginBottom: 4,
  },

  greetingSubtitle: {
    fontSize: 13,
    color: "#5f6368",
  },

  dateBadge: {
    borderWidth: 1,
    borderColor: "#c9c9c9",
    borderRadius: 6,
    backgroundColor: "#ffffff",
    paddingHorizontal: 12,
    paddingVertical: 6,
  },

  dateBadgeText: {
    fontSize: 12,
    color: "#1a1a1a",
  },

  validationRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 20,
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

  sectionTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#4a4b4a",
    marginBottom: 12,
  },

  // Cards de resumo (linha com 4 cards)
  statsRow: {
    flexDirection: "row",
    gap: 16,
    marginBottom: 20,
  },

  statCard: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ffffff",
    borderRadius: 8,
    padding: 16,
    gap: 12,
  },

  statCardDanger: {
    backgroundColor: "#f7dedb",
  },

  statIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#d9ede4",
    alignItems: "center",
    justifyContent: "center",
  },

  statIconCircleDanger: {
    backgroundColor: "#f1bdb6",
  },

  statIcon: {
    fontSize: 18,
  },

  statTextArea: {
    flex: 1,
  },

  statLabel: {
    fontSize: 12,
    color: "#5f6368",
    marginBottom: 4,
  },

  statValue: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#1a1a1a",
  },

  // Painéis (gráfico + movimentações)
  panelsRow: {
    flexDirection: "row",
    gap: 20,
    flex: 1,
  },

  chartPanel: {
    flex: 1.4,
    backgroundColor: "#ffffff",
    borderRadius: 8,
    padding: 20,
  },

  movPanel: {
    flex: 1,
    backgroundColor: "#ffffff",
    borderRadius: 8,
    padding: 20,
  },

  panelHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },

  panelTitle: {
    fontSize: 15,
    fontWeight: "bold",
    color: "#1a1a1a",
  },

  panelSubtitle: {
    fontSize: 12,
    color: "#5f6368",
    marginTop: 2,
  },

  verTodasText: {
    fontSize: 12,
    color: "#1B4A3B",
    fontWeight: "600",
  },

  // Gráfico de barras por categoria — agora ocupa o espaço restante
  // do painel, com as barras encostadas embaixo, maiores e mais
  // espaçadas entre si.
  barChartContainer: {
    flex: 1,
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "center",
    gap: 40,
    marginTop: 10,
    paddingBottom: 8,
  },

  barColumn: {
    alignItems: "center",
    justifyContent: "flex-end",
    width: 56,
  },

  barValue: {
    fontSize: 12,
    fontWeight: "600",
    color: "#1a1a1a",
    marginBottom: 6,
  },

  bar: {
    width: 34,
    backgroundColor: "#1b4a3b",
    borderRadius: 4,
  },

  barLabel: {
    fontSize: 11,
    color: "#5f6368",
    marginTop: 8,
    textAlign: "center",
  },

  // Lista de últimas movimentações
  emptyMovText: {
    fontSize: 12,
    color: "#8a8a8a",
    marginTop: 12,
  },

  movRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
    gap: 10,
  },

  movIconCircle: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
  },

  movIconEntrada: {
    backgroundColor: "#d9ede4",
  },

  movIconSaida: {
    backgroundColor: "#f7dedb",
  },

  movIconText: {
    fontSize: 13,
    fontWeight: "bold",
    color: "#1a1a1a",
  },

  movInfo: {
    flex: 1,
  },

  movNome: {
    fontSize: 13,
    color: "#1a1a1a",
  },

  movTipo: {
    fontSize: 11,
    marginTop: 2,
  },

  movTipoEntrada: {
    color: "#1B4A3B",
  },

  movTipoSaida: {
    color: "#c62828",
  },

  movRight: {
    alignItems: "flex-end",
  },

  movQuantidade: {
    fontSize: 12,
    fontWeight: "600",
  },

  movData: {
    fontSize: 10,
    color: "#8a8a8a",
    marginTop: 2,
  },
});