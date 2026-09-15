import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { router } from "expo-router";

import AppBar from "../components/AppBar";
import PageHeader from "../components/PageHeader";
import SearchBox from "../components/SearchBox";

import { getSession } from "../services/authStorage";
import { listMovimentacoes } from "../services/movimentacoesApi";

// RF004 é um requisito do Professor (não só do Administrador), então
// essa tela não tem checagem de role — qualquer usuário logado acessa.

const FILTROS = [
  { key: "todas", label: "Todas" },
  { key: "entrada", label: "Entradas" },
  { key: "saida", label: "Saídas" },
];

export default function Movimentacoes() {
  const [checkingSession, setCheckingSession] = useState(true);
  const [session, setSession] = useState(null);

  const [movimentacoes, setMovimentacoes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState("");

  const [filtro, setFiltro] = useState("todas");

  // Busca por nome do material ou responsável.
  const [searchTerm, setSearchTerm] = useState("");

  // Garante que existe uma sessão ativa antes de mostrar a tela
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

  const loadMovimentacoes = useCallback(async (token) => {
    setLoading(true);
    setListError("");

    try {
      const response = await listMovimentacoes(token);
      setMovimentacoes(response.movimentacoes || []);
    } catch (error) {
      console.error("Erro ao carregar movimentações:", error);
      setListError(
        error?.message || "Não foi possível carregar as movimentações."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (session?.token) {
      loadMovimentacoes(session.token);
    }
  }, [session, loadMovimentacoes]);

  if (checkingSession) {
    return null;
  }

  const movimentacoesPorTipo =
    filtro === "todas"
      ? movimentacoes
      : movimentacoes.filter((item) => item.tipo === filtro);

  const termoBusca = searchTerm.trim().toLowerCase();
  const movimentacoesFiltradas = termoBusca
    ? movimentacoesPorTipo.filter((item) =>
        [item.materialNome, item.responsavel]
          .filter(Boolean)
          .some((campo) => campo.toLowerCase().includes(termoBusca))
      )
    : movimentacoesPorTipo;

  return (
    <AppBar>
      <PageHeader
        title="Movimentações"
        actions={
          <>
            <SearchBox
              value={searchTerm}
              onChangeText={setSearchTerm}
              placeholder="Buscar por material ou responsável..."
            />
          </>
        }
      />

      <View style={styles.space}>
        {/* Filtro por tipo de movimentação */}
        <View style={styles.filterRow}>
          {FILTROS.map((opt) => (
            <TouchableOpacity
              key={opt.key}
              style={[
                styles.filterOption,
                filtro === opt.key && styles.filterOptionActive,
              ]}
              onPress={() => setFiltro(opt.key)}
            >
              <Text
                style={[
                  styles.filterOptionText,
                  filtro === opt.key && styles.filterOptionTextActive,
                ]}
              >
                {opt.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <ScrollView
          style={styles.listWrapper}
          contentContainerStyle={{ paddingBottom: 30 }}
        >
          <View style={styles.listCard}>
            {/* Cabeçalho da tabela */}
            <View style={[styles.row, styles.rowHeader]}>
              <Text style={[styles.cell, styles.cellData, styles.headerText]}>
                Data
              </Text>
              <Text
                style={[styles.cell, styles.cellMaterial, styles.headerText]}
              >
                Material
              </Text>
              <Text style={[styles.cell, styles.cellTipo, styles.headerText]}>
                Tipo
              </Text>
              <Text style={[styles.cell, styles.cellQtd, styles.headerText]}>
                Quantidade
              </Text>
              <Text style={[styles.cell, styles.cellResp, styles.headerText]}>
                Responsável
              </Text>
            </View>

            {loading && (
              <View style={styles.centerBox}>
                <ActivityIndicator />
              </View>
            )}

            {!loading && !!listError && (
              <View style={styles.centerBox}>
                <Text style={styles.errorText}>{listError}</Text>
              </View>
            )}

            {!loading &&
              !listError &&
              movimentacoesFiltradas.length === 0 && (
                <View style={styles.centerBox}>
                  <Text style={styles.emptyText}>
                    {searchTerm.trim()
                      ? `Nenhuma movimentação encontrada para "${searchTerm}".`
                      : "Nenhuma movimentação encontrada."}
                  </Text>
                </View>
              )}

            {!loading &&
              !listError &&
              movimentacoesFiltradas.map((item) => (
                <View key={item.id} style={styles.row}>
                  <Text
                    style={[styles.cell, styles.cellData]}
                    numberOfLines={1}
                  >
                    {item.data}
                  </Text>

                  <Text
                    style={[styles.cell, styles.cellMaterial]}
                    numberOfLines={1}
                  >
                    {item.materialNome}
                  </Text>

                  <View style={[styles.cell, styles.cellTipo]}>
                    <Text
                      style={[
                        styles.tipoBadge,
                        item.tipo === "entrada"
                          ? styles.tipoBadgeEntrada
                          : styles.tipoBadgeSaida,
                      ]}
                    >
                      {item.tipo === "entrada" ? "Entrada" : "Saída"}
                    </Text>
                  </View>

                  <Text
                    style={[styles.cell, styles.cellQtd]}
                    numberOfLines={1}
                  >
                    {item.quantidade}
                  </Text>

                  <Text
                    style={[styles.cell, styles.cellResp]}
                    numberOfLines={1}
                  >
                    {item.responsavel}
                  </Text>
                </View>
              ))}
          </View>
        </ScrollView>
      </View>
    </AppBar>
  );
}

const styles = StyleSheet.create({
  space: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 20,
  },
  filterRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 16,
  },
  filterOption: {
    borderWidth: 1,
    borderColor: "#c9c9c9",
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: "#ffffff",
  },
  filterOptionActive: {
    borderColor: "#1b4a3b",
    backgroundColor: "#e6f4ea",
  },
  filterOptionText: {
    fontSize: 13,
    color: "#5f6368",
  },
  filterOptionTextActive: {
    color: "#1b4a3b",
    fontWeight: "600",
  },
  listWrapper: {
    flex: 1,
  },
  listCard: {
    backgroundColor: "#ffffff",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#e6e6e6",
    overflow: "hidden",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#eeeeee",
  },
  rowHeader: {
    backgroundColor: "#f5f5f5",
  },
  headerText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#5f6368",
    textTransform: "uppercase",
  },
  cell: {
    fontSize: 13,
    color: "#202124",
  },
  cellData: {
    flex: 1.3,
    color: "#5f6368",
  },
  cellMaterial: {
    flex: 1.8,
    paddingRight: 8,
  },
  cellTipo: {
    flex: 1,
  },
  cellQtd: {
    flex: 1.4,
  },
  cellResp: {
    flex: 1.5,
    color: "#5f6368",
  },
  tipoBadge: {
    fontSize: 12,
    fontWeight: "600",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    overflow: "hidden",
    alignSelf: "flex-start",
  },
  tipoBadgeEntrada: {
    backgroundColor: "#e6f4ea",
    color: "#1b4a3b",
  },
  tipoBadgeSaida: {
    backgroundColor: "#fdeee6",
    color: "#c86756",
  },
  centerBox: {
    paddingVertical: 24,
    alignItems: "center",
  },
  emptyText: {
    color: "#5f6368",
    fontSize: 14,
  },
  errorText: {
    color: "#c62828",
    fontSize: 13,
  },
});