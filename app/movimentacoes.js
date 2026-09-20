import React, { useCallback, useEffect, useState } from "react";
import {
  View,Text,TextInput,TouchableOpacity,StyleSheet,ScrollView,ActivityIndicator,Modal,Platform,Alert,
} from "react-native";
import { router } from "expo-router";

import AppBar from "../components/AppBar";
import PageHeader from "../components/PageHeader";
import SearchBox from "../components/SearchBox";

import { getSession } from "../services/authStorage";
import { listMovimentacoes } from "../services/movimentacoesApi";
import {
  baixarPdf,
  filtrarPorPeriodo,
  formatarDataBR,
  gerarPdfMovimentacoes,
  interpretarPeriodo,
  mascararData,
} from "../utils/movimentacoesPdf";

// RF004 é um requisito do Professor (não só do Administrador), então
// essa tela não tem checagem de role — qualquer usuário logado acessa.

const FILTROS = [
  { key: "todas", label: "Todas" },
  { key: "entrada", label: "Entradas" },
  { key: "saida", label: "Saídas" },
];

// Atalhos de período no modal "Gerar PDF". `dias` conta o dia de hoje
// (7 = hoje + os 6 dias anteriores); null limpa as datas (todo o período).
const ATALHOS_PERIODO = [
  { label: "Últimos 7 dias", dias: 7 },
  { label: "Últimos 30 dias", dias: 30 },
  { label: "Todo o período", dias: null },
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

  // Gerar PDF: o modal pede um período (datas em DD/MM/AAAA). Campo vazio
  // = sem limite naquele lado; data final vazia significa "até agora".
  const [pdfModalVisible, setPdfModalVisible] = useState(false);
  const [dataInicial, setDataInicial] = useState("");
  const [dataFinal, setDataFinal] = useState("");
  const [pdfGerando, setPdfGerando] = useState(false);
  const [pdfErro, setPdfErro] = useState("");

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

  // ---------------------------------------------------------------
  // GERAR PDF
  //
  // O PDF sai com a lista que está na tela (filtro de tipo + busca) e,
  // por cima disso, aplica o período escolhido no modal.
  // ---------------------------------------------------------------

  const periodo = interpretarPeriodo(dataInicial, dataFinal);
  const movimentacoesParaPdf = periodo.ok
    ? filtrarPorPeriodo(movimentacoesFiltradas, periodo.inicio, periodo.fim)
    : [];
  const podeGerarPdf =
    periodo.ok && movimentacoesParaPdf.length > 0 && !pdfGerando;

  // Só pra explicar no modal o que já está filtrado na tela.
  const buscaAtual = searchTerm.trim();
  const descricaoTipo =
    filtro === "entrada"
      ? "somente entradas"
      : filtro === "saida"
        ? "somente saídas"
        : "todas as movimentações";
  const descricaoFiltros = buscaAtual
    ? `${descricaoTipo}, busca "${buscaAtual}"`
    : descricaoTipo;

  function abrirModalPdf() {
    // Assim como o relatório em Excel do Estoque, o download direto usa
    // o navegador, então por enquanto só existe na versão web.
    if (Platform.OS !== "web") {
      Alert.alert(
        "Disponível só na versão web",
        "Por enquanto, gerar PDF só funciona rodando o app pelo navegador."
      );
      return;
    }

    setPdfErro("");
    setPdfModalVisible(true);
  }

  function fecharModalPdf() {
    if (pdfGerando) return;
    setPdfModalVisible(false);
  }

  // Preenche a data inicial e deixa a final vazia ("até agora").
  function aplicarAtalhoPeriodo(dias) {
    setPdfErro("");
    setDataFinal("");

    if (dias === null) {
      setDataInicial("");
      return;
    }

    const inicio = new Date();
    inicio.setDate(inicio.getDate() - (dias - 1));
    setDataInicial(formatarDataBR(inicio));
  }

  async function handleGerarPdf() {
    if (!podeGerarPdf) return;

    setPdfGerando(true);
    setPdfErro("");

    try {
      // Pausa curtinha só pro botão mostrar o "carregando" antes do
      // trabalho de montar o PDF.
      await new Promise((resolve) => setTimeout(resolve, 50));

      const { doc, nomeArquivo } = gerarPdfMovimentacoes({
        movimentacoes: movimentacoesParaPdf,
        inicio: periodo.inicio,
        fim: periodo.fim,
        tipo: filtro,
        busca: buscaAtual,
        geradoEm: new Date(),
      });

      baixarPdf(doc, nomeArquivo);
      setPdfModalVisible(false);
    } catch (error) {
      console.error("Erro ao gerar PDF:", error);
      setPdfErro("Não foi possível gerar o PDF. Tente novamente.");
    } finally {
      setPdfGerando(false);
    }
  }

  // Sem nada carregado (ainda carregando, erro ou lista vazia) não há o
  // que exportar — o botão fica desativado.
  const semDadosParaPdf = loading || !!listError || movimentacoes.length === 0;

  return (
    <AppBar>
      <PageHeader
        title="Movimentações"
        actions={
          <>
            <TouchableOpacity
              style={[styles.pdfButton, semDadosParaPdf && styles.buttonDisabled]}
              onPress={abrirModalPdf}
              disabled={semDadosParaPdf}
            >
              <Text style={styles.pdfButtonText}>Gerar PDF</Text>
            </TouchableOpacity>

            <SearchBox
              value={searchTerm}
              onChangeText={setSearchTerm}
              placeholder="Buscar material/responsável"
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

      {/* MODAL DE GERAR PDF */}
      <Modal
        visible={pdfModalVisible}
        transparent
        animationType="fade"
        onRequestClose={fecharModalPdf}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.formTitle}>Gerar PDF</Text>

            <Text style={styles.modalIntro}>
              Escolha o período das movimentações. Deixe a data final vazia para
              incluir tudo até agora.
            </Text>

            {/* Atalhos de período */}
            <View style={styles.atalhosRow}>
              {ATALHOS_PERIODO.map((atalho) => (
                <TouchableOpacity
                  key={atalho.label}
                  style={styles.atalhoOption}
                  onPress={() => aplicarAtalhoPeriodo(atalho.dias)}
                  disabled={pdfGerando}
                >
                  <Text style={styles.atalhoOptionText}>{atalho.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.datasRow}>
              <View style={styles.dataCampo}>
                <Text style={styles.dataLabel}>Data inicial</Text>
                <TextInput
                  style={styles.dataInput}
                  placeholder="DD/MM/AAAA"
                  placeholderTextColor="#9aa0a6"
                  value={dataInicial}
                  onChangeText={(texto) => setDataInicial(mascararData(texto))}
                  keyboardType="numeric"
                  maxLength={10}
                  editable={!pdfGerando}
                  onSubmitEditing={handleGerarPdf}
                  autoFocus
                />
              </View>

              <View style={styles.dataCampo}>
                <Text style={styles.dataLabel}>Data final</Text>
                <TextInput
                  style={styles.dataInput}
                  placeholder="Agora"
                  placeholderTextColor="#9aa0a6"
                  value={dataFinal}
                  onChangeText={(texto) => setDataFinal(mascararData(texto))}
                  keyboardType="numeric"
                  maxLength={10}
                  editable={!pdfGerando}
                  onSubmitEditing={handleGerarPdf}
                />
              </View>
            </View>

            {!!periodo.erro && (
              <Text style={styles.modalErrorText}>{periodo.erro}</Text>
            )}

            <Text style={styles.filtrosInfo}>
              Filtros da tela: {descricaoFiltros}.
            </Text>

            {periodo.ok && (
              <Text
                style={
                  movimentacoesParaPdf.length > 0
                    ? styles.resumoOk
                    : styles.resumoVazio
                }
              >
                {movimentacoesParaPdf.length > 0
                  ? `${movimentacoesParaPdf.length} ${
                      movimentacoesParaPdf.length === 1
                        ? "movimentação será incluída"
                        : "movimentações serão incluídas"
                    } no PDF.`
                  : "Nenhuma movimentação encontrada neste período."}
              </Text>
            )}

            {!!pdfErro && <Text style={styles.modalErrorText}>{pdfErro}</Text>}

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.actionButton, styles.modalCancelButton]}
                onPress={fecharModalPdf}
                disabled={pdfGerando}
              >
                <Text style={styles.actionButtonText}>Cancelar</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.saveButton,
                  !podeGerarPdf && styles.buttonDisabled,
                ]}
                onPress={handleGerarPdf}
                disabled={!podeGerarPdf}
              >
                {pdfGerando ? (
                  <ActivityIndicator color="#ffffff" />
                ) : (
                  <Text style={styles.saveButtonText}>Gerar PDF</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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

  // Botão "Gerar PDF" (mesmo visual do "Gerar relatório" do Estoque)
  pdfButton: {
    borderWidth: 1,
    borderColor: "#a9a9a9",
    borderRadius: 4,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: "#ffffff",
  },
  pdfButtonText: {
    fontSize: 13,
    color: "#1a1a1a",
  },
  buttonDisabled: {
    opacity: 0.5,
  },

  // Modal "Gerar PDF" (mesmo visual dos modais do Estoque)
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.4)",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  modalCard: {
    backgroundColor: "#ffffff",
    borderRadius: 10,
    padding: 20,
    width: "100%",
    maxWidth: 400,
  },
  formTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#202124",
    marginBottom: 8,
  },
  modalIntro: {
    fontSize: 13,
    color: "#5f6368",
    marginBottom: 14,
  },
  atalhosRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 14,
  },
  atalhoOption: {
    borderWidth: 1,
    borderColor: "#c9c9c9",
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: "#ffffff",
  },
  atalhoOptionText: {
    fontSize: 12,
    color: "#5f6368",
  },
  datasRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 12,
  },
  dataCampo: {
    flex: 1,
  },
  dataLabel: {
    fontSize: 12,
    color: "#5f6368",
    marginBottom: 4,
  },
  dataInput: {
    borderWidth: 1,
    borderColor: "#c9c9c9",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: "#202124",
    backgroundColor: "#ffffff",
  },
  filtrosInfo: {
    fontSize: 12,
    color: "#5f6368",
    marginBottom: 10,
  },
  resumoOk: {
    fontSize: 13,
    fontWeight: "600",
    color: "#1b4a3b",
    marginBottom: 10,
  },
  resumoVazio: {
    fontSize: 13,
    color: "#5f6368",
    marginBottom: 10,
  },
  modalErrorText: {
    color: "#c62828",
    fontSize: 13,
    marginBottom: 10,
  },
  modalActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 10,
    marginTop: 4,
  },
  actionButton: {
    borderWidth: 1,
    borderColor: "#c9c9c9",
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  actionButtonText: {
    fontSize: 12,
    color: "#1a1a1a",
  },
  modalCancelButton: {
    paddingHorizontal: 16,
    justifyContent: "center",
  },
  saveButton: {
    backgroundColor: "#ed0000",
    borderRadius: 6,
    paddingVertical: 12,
    paddingHorizontal: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  saveButtonText: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "500",
  },
});