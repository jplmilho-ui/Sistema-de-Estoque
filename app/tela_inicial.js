import { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
} from "react-native";
import { router, useFocusEffect } from "expo-router";
import AppBar from "../components/AppBar";
import PageHeader from "../components/PageHeader";
import Icon from "../components/Icon";
import useLayout from "../components/useLayout";
import { getSession } from "../services/authStorage";
import { getResumo, listMaterials } from "../services/materialApi";
import { listMovimentacoes } from "../services/movimentacoesApi";
import { isVencido } from "../utils/validade";

// Quantas movimentações aparecem no painel "Últimas movimentações".
const MAX_ULTIMAS_MOVIMENTACOES = 5;

// Ícone, rótulo, sinal e cor de cada tipo de movimentação. A devolução de
// um uniforme emprestado aumenta o estoque (+), mas tem visual próprio.
const TIPOS_MOV = {
  entrada: { label: "Entrada", sinal: "+", icon: "arrow-up", cor: "#1B4A3B", fundo: "#d9ede4" },
  saida: { label: "Saída", sinal: "-", icon: "arrow-down", cor: "#c62828", fundo: "#f7dedb" },
  devolucao: { label: "Devolução", sinal: "+", icon: "repeat", cor: "#1a56c4", fundo: "#e8f0fe" },
};

// Altura máxima das barras do gráfico (px). Pequena de propósito: o gráfico
// e as últimas movimentações precisam caber na tela sem rolar a página.
const ALTURA_MAX_BARRA = 110;

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
  const { compacto, celular } = useLayout();
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

  // Histórico de entradas, saídas e devoluções (vem de GET /movimentacoes, já do mais
  // novo pro mais antigo). Alimenta o card "Movimentações" (total) e o
  // painel "Últimas movimentações" (as mais recentes).
  const [movimentacoes, setMovimentacoes] = useState([]);
  const [loadingMovimentacoes, setLoadingMovimentacoes] = useState(true);
  const [movimentacoesError, setMovimentacoesError] = useState("");

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

  const loadMovimentacoes = useCallback(async (token) => {
    setLoadingMovimentacoes(true);
    setMovimentacoesError("");
    try {
      const response = await listMovimentacoes(token);
      setMovimentacoes(response.movimentacoes || []);
    } catch (error) {
      console.error("Erro ao carregar movimentações:", error);
      setMovimentacoesError(
        error?.message || "Não foi possível carregar as movimentações."
      );
    } finally {
      setLoadingMovimentacoes(false);
    }
  }, []);

  // Carrega os dados quando a sessão fica pronta e TAMBÉM toda vez que a
  // pessoa volta pra esta tela (ex: retirou um item no Estoque e voltou):
  // sem isso, os números ficariam parados no que foi buscado na 1ª vez.
  useFocusEffect(
    useCallback(() => {
      if (session?.token) {
        loadResumo(session.token);
        loadMaterials(session.token);
        loadMovimentacoes(session.token);
      }
    }, [session, loadResumo, loadMaterials, loadMovimentacoes])
  );

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
      icon: "package",
      label: "Itens em estoque",
      value: loadingMaterials ? null : totalCadastrados,
      variant: "default",
    },
    {
      key: "materiais",
      icon: "layers",
      label: "Materiais cadastrados",
      value: loadingMaterials ? null : tiposCadastrados,
      variant: "default",
    },
    {
      key: "vencidos",
      icon: "alert-triangle",
      label: "Produtos vencidos",
      value: loadingMaterials ? null : vencidosCount,
      variant: "danger",
      onPress: () => router.push({ pathname: "/estoque", params: { filtro: "vencidos" } }),
    },
    {
      key: "movimentacoes",
      icon: "repeat",
      label: "Movimentações",
      // se a busca falhar, mostra "—" em vez de um 0 que pareceria real
      value: loadingMovimentacoes ? null : movimentacoesError ? "—" : movimentacoes.length,
      variant: "default",
      onPress: () => router.push("/movimentacoes"),
    },
  ];

  const ultimasMovimentacoes = movimentacoes.slice(0, MAX_ULTIMAS_MOVIMENTACOES);

  return (
    <AppBar>
      <PageHeader title="Tela Inicial"/>
      <ScrollView
        style={styles.Space}
        contentContainerStyle={{ flexGrow: 1 }}
      >
        <View style={[styles.contentArea, celular && styles.contentAreaCelular]}>

          {/* Saudação */}
          <View style={styles.greetingRow}>
            <View>
              <Text style={styles.greetingTitle}>Olá!</Text>
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
                    <Icon
                      name={card.icon}
                      size={18}
                      color={card.variant === "danger" ? "#c62828" : "#1B4A3B"}
                    />
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
          <View style={[styles.panelsRow, compacto && styles.panelsRowCompacto]}>

            {/* Produtos Cadastrados — gráfico por categoria */}
            <View style={[styles.chartPanel, compacto && styles.panelCompacto]}>
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
                          { height: Math.max((quantidade / maxCategoriaCount) * ALTURA_MAX_BARRA, 6) },
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
            <View style={[styles.movPanel, compacto && styles.panelCompacto]}>
              <View style={styles.panelHeaderRow}>
                <Text style={styles.panelTitle}>Últimas movimentações</Text>
                <TouchableOpacity
                  style={styles.verTodasRow}
                  onPress={() => router.push("/movimentacoes")}
                >
                  <Text style={styles.verTodasText}>Ver todas</Text>
                  <Icon name="arrow-right" size={14} color="#1B4A3B" />
                </TouchableOpacity>
              </View>

              {loadingMovimentacoes ? (
                <ActivityIndicator style={{ marginTop: 24 }} />
              ) : movimentacoesError ? (
                <Text style={styles.errorText}>{movimentacoesError}</Text>
              ) : ultimasMovimentacoes.length === 0 ? (
                <Text style={styles.emptyMovText}>
                  Nenhuma movimentação registrada ainda.
                </Text>
              ) : (
                ultimasMovimentacoes.map((mov) => {
                  const tipo = TIPOS_MOV[mov.tipo] || TIPOS_MOV.saida;
                  return (
                    <View key={mov.id} style={styles.movRow}>
                      <View style={[styles.movIconCircle, { backgroundColor: tipo.fundo }]}>
                        <Icon name={tipo.icon} size={14} color={tipo.cor} />
                      </View>
                      <View style={styles.movInfo}>
                        <Text style={styles.movNome} numberOfLines={1}>
                          {mov.materialNome}
                        </Text>
                        <Text style={[styles.movTipo, { color: tipo.cor }]} numberOfLines={1}>
                          {tipo.label}
                          {mov.responsavel ? ` · ${mov.responsavel}` : ""}
                        </Text>
                      </View>
                      <View style={styles.movRight}>
                        <Text style={[styles.movQuantidade, { color: tipo.cor }]}>
                          {tipo.sinal} {mov.quantidade}
                        </Text>
                        <Text style={styles.movData}>{mov.data}</Text>
                      </View>
                    </View>
                  );
                })
              )}
            </View>

          </View>

        </View>
      </ScrollView>
    </AppBar>
  );
}

const styles = StyleSheet.create({
  Space: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 10,
  },

  contentArea: {
    flex: 1,
    backgroundColor: "#f7f7f7",
    borderRadius: 7,
    padding: 14,
  },
  contentAreaCelular: {
    padding: 12,
  },

  greetingRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },

  greetingTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#0ba572",
    marginBottom: 2,
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
    paddingHorizontal: 10,
    paddingVertical: 4,
  },

  dateBadgeText: {
    fontSize: 13,
    color: "#1a1a1a",
  },

  validationRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },

  validationMessage: {
    backgroundColor: "#ffffff",
    borderRadius: 6,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },

  validationText: {
    fontSize: 14,
    color: "#1a1a1a",
  },

  errorText: {
    fontSize: 15,
    color: "#c62828",
  },

  verificarButton: {
    borderWidth: 1,
    borderRadius: 4,
    backgroundColor: "#1B4A3B",
    paddingHorizontal: 18,
    paddingVertical: 5,
  },

  verificarText: {
    fontSize: 13,
    color: "#ffffff",
  },

  sectionTitle: {
    fontSize: 15,
    fontWeight: "bold",
    color: "#4a4b4a",
    marginBottom: 8,
  },

  // Cards de resumo (linha com 4 cards)
  statsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    marginBottom: 12,
  },

  statCard: {
    flex: 1,
    minWidth: 180,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ffffff",
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    gap: 10,
  },

  statCardDanger: {
    backgroundColor: "#f7dedb",
  },

  statIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#d9ede4",
    alignItems: "center",
    justifyContent: "center",
  },

  statIconCircleDanger: {
    backgroundColor: "#f1bdb6",
  },

  statTextArea: {
    flex: 1,
  },

  statLabel: {
    fontSize: 12,
    color: "#5f6368",
    marginBottom: 2,
  },

  statValue: {
    fontSize: 22,
    fontWeight: "bold",
    color: "#1a1a1a",
  },

  // Painéis (gráfico + movimentações)
  panelsRow: {
    flexDirection: "row",
    gap: 12,
    flex: 1,
  },
  // telas estreitas: um painel embaixo do outro, cada um com altura própria
  panelsRowCompacto: {
    flexDirection: "column",
    flex: 0,
  },

  chartPanel: {
    flex: 1.2,
    backgroundColor: "#ffffff",
    borderRadius: 8,
    padding: 14,
  },

  panelCompacto: {
    flex: 0,
    minHeight: 220,
  },

  movPanel: {
    flex: 1,
    backgroundColor: "#ffffff",
    borderRadius: 8,
    padding: 14,
  },

  panelHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
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

  verTodasRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },

  verTodasText: {
    fontSize: 13,
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
    gap: 36,
    marginTop: 4,
    paddingBottom: 4,
  },

  barColumn: {
    alignItems: "center",
    justifyContent: "flex-end",
    width: 52,
  },

  barValue: {
    fontSize: 13,
    fontWeight: "600",
    color: "#1a1a1a",
    marginBottom: 4,
  },

  bar: {
    width: 30,
    backgroundColor: "#1b4a3b",
    borderRadius: 4,
  },

  barLabel: {
    fontSize: 12,
    color: "#5f6368",
    marginTop: 6,
    textAlign: "center",
  },

  // Lista de últimas movimentações
  emptyMovText: {
    fontSize: 13,
    color: "#8a8a8a",
    marginTop: 8,
  },

  movRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
    gap: 8,
  },

  movIconCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
  },

  movInfo: {
    flex: 1,
    minWidth: 0,
  },

  movNome: {
    fontSize: 13,
    color: "#1a1a1a",
  },

  movTipo: {
    fontSize: 12,
    marginTop: 1,
  },

  movRight: {
    alignItems: "flex-end",
    flexShrink: 0,
    maxWidth: "50%",
  },

  // a quantidade já vem pronta do backend ("2 caixas (100 un.)" / "5 un.")
  movQuantidade: {
    fontSize: 12,
    fontWeight: "600",
    textAlign: "right",
  },

  movData: {
    fontSize: 11,
    color: "#8a8a8a",
    marginTop: 1,
  },
});