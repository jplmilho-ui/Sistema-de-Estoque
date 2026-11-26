// Aba "Empréstimos" da tela de ESTOQUE (admin, coordenador, professor):
//   - pedidos de empréstimo AGUARDANDO CONFIRMAÇÃO: confirmar (o uniforme sai
//     do estoque e a saída aparece em Movimentações) ou recusar;
//   - todos os uniformes emprestados e os prazos, com os ATRASADOS no topo;
//   - registrar a devolução (o uniforme volta ao estoque sozinho e a
//     devolução aparece em Movimentações);
//   - baixar o termo em PDF de qualquer empréstimo confirmado.
// O aviso de "item não devolvido" chega no sino de notificações (ver
// services/notificacoes.js) e leva direto para o filtro "Atrasados".
import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
  TextInput,
} from "react-native";
import { useLocalSearchParams } from "expo-router";
import SearchBox from "./SearchBox";
import useLayout from "./useLayout";
import {
  PrazoBadge,
  baixarTermoEmprestimo,
  textoConfirmado,
  textoDevolvido,
} from "./emprestimoComum";
import {
  listEmprestimos,
  devolverEmprestimo,
  aprovarEmprestimo,
  recusarEmprestimo,
} from "../services/emprestimosApi";
import { confirmAction } from "../utils/confirmAction";
import { formatarDataHoraBR } from "../utils/datas";

const ATUALIZACAO_MS = 30 * 1000;

const MOTIVO_MAX = 300;

const FILTROS = [
  { key: "pendentes", label: "Aguardando confirmação" },
  { key: "abertos", label: "Em aberto" },
  { key: "atrasados", label: "Atrasados" },
  { key: "devolvidos", label: "Devolvidos" },
];

function passaFiltro(e, filtro) {
  if (filtro === "pendentes") return e.status === "pendente";
  if (filtro === "abertos") return e.status === "emprestado";
  if (filtro === "atrasados") return e.status === "emprestado" && e.atrasado;
  return e.status === "devolvido";
}

export default function EmprestimosEquipe({ session }) {
  const { celular } = useLayout();
  const recuo = celular ? 16 : 24;
  const params = useLocalSearchParams();

  const [emprestimos, setEmprestimos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState("");
  const [filtro, setFiltro] = useState("abertos");
  const [filtroInicialDefinido, setFiltroInicialDefinido] = useState(false);
  const [busca, setBusca] = useState("");
  const [devolvendoId, setDevolvendoId] = useState(null);

  // pedido que está sendo confirmado/recusado, e o rascunho de recusa aberto
  const [respondendoId, setRespondendoId] = useState(null);
  const [recusandoId, setRecusandoId] = useState(null);
  const [motivo, setMotivo] = useState("");

  // Veio do aviso do sino ("fulano não devolveu..." / "fulano pediu...") ->
  // já abre no filtro certo.
  useEffect(() => {
    if (params.filtro === "atrasados" || params.filtro === "pendentes") {
      setFiltro(params.filtro);
      setFiltroInicialDefinido(true);
    }
  }, [params.filtro]);

  const load = useCallback(
    async ({ silencioso = false } = {}) => {
      if (!silencioso) setLoading(true);
      try {
        const data = await listEmprestimos(session.token);
        setEmprestimos(data.emprestimos || []);
        setListError("");
      } catch (error) {
        if (!silencioso) setListError(error.message);
      } finally {
        if (!silencioso) setLoading(false);
      }
    },
    [session.token]
  );

  // Sem filtro vindo do sino, abre em "Aguardando confirmação" quando houver
  // pedidos esperando (é o que a equipe precisa resolver primeiro).
  useEffect(() => {
    if (filtroInicialDefinido || loading) return;
    setFiltroInicialDefinido(true);
    if (emprestimos.some((e) => e.status === "pendente")) setFiltro("pendentes");
  }, [loading, emprestimos, filtroInicialDefinido]);

  useEffect(() => {
    load();
    const timer = setInterval(() => load({ silencioso: true }), ATUALIZACAO_MS);
    return () => clearInterval(timer);
  }, [load]);

  // Confirma o pedido: o uniforme sai do estoque.
  function handleAprovar(e) {
    confirmAction({
      title: "Confirmar empréstimo",
      message: `Confirmar o empréstimo de ${e.quantidadeTexto} de "${e.materialNome}" para ${e.alunoNome}? O item sai do estoque agora.`,
      confirmText: "Confirmar empréstimo",
      cancelText: "Voltar",
      onConfirm: async () => {
        setRespondendoId(e.id);
        try {
          await aprovarEmprestimo(session.token, e.id);
        } catch (error) {
          Alert.alert("Não foi possível confirmar", error.message);
        } finally {
          setRespondendoId(null);
          load({ silencioso: true });
        }
      },
    });
  }

  async function handleRecusar(e) {
    setRespondendoId(e.id);
    try {
      await recusarEmprestimo(session.token, e.id, motivo.trim() || undefined);
      setRecusandoId(null);
      setMotivo("");
    } catch (error) {
      Alert.alert("Não foi possível recusar", error.message);
    } finally {
      setRespondendoId(null);
      load({ silencioso: true });
    }
  }

  function handleDevolver(e) {
    confirmAction({
      title: "Registrar devolução",
      message: `${e.alunoNome} devolveu ${e.quantidadeTexto} de "${e.materialNome}"? O item volta para o estoque.`,
      confirmText: "Registrar devolução",
      cancelText: "Voltar",
      onConfirm: async () => {
        setDevolvendoId(e.id);
        try {
          await devolverEmprestimo(session.token, e.id);
        } catch (error) {
          Alert.alert("Não foi possível registrar", error.message);
        } finally {
          setDevolvendoId(null);
          load({ silencioso: true });
        }
      },
    });
  }

  const contagem = {
    pendentes: emprestimos.filter((e) => passaFiltro(e, "pendentes")).length,
    abertos: emprestimos.filter((e) => passaFiltro(e, "abertos")).length,
    atrasados: emprestimos.filter((e) => passaFiltro(e, "atrasados")).length,
    devolvidos: emprestimos.filter((e) => passaFiltro(e, "devolvidos")).length,
  };

  const termo = busca.trim().toLowerCase();
  const visiveis = emprestimos
    .filter((e) => passaFiltro(e, filtro))
    .filter(
      (e) =>
        !termo ||
        [e.alunoNome, e.alunoRm, e.materialNome]
          .filter(Boolean)
          .some((campo) => String(campo).toLowerCase().includes(termo))
    );

  function textoVazio() {
    if (termo) return `Nenhum empréstimo encontrado para "${busca}".`;
    if (filtro === "pendentes") return "Nenhum pedido aguardando confirmação.";
    if (filtro === "atrasados") return "Nenhum uniforme atrasado. Tudo em dia.";
    if (filtro === "devolvidos") return "Nenhuma devolução nos últimos 7 dias.";
    return "Nenhum uniforme emprestado no momento.";
  }

  return (
    <>
      <View style={[styles.filterRow, { paddingHorizontal: recuo }]}>
        {FILTROS.map((opcao) => {
          const ativo = filtro === opcao.key;
          const alerta =
            (opcao.key === "atrasados" || opcao.key === "pendentes") && contagem[opcao.key] > 0;
          return (
            <TouchableOpacity
              key={opcao.key}
              style={[styles.chip, ativo && styles.chipActive]}
              onPress={() => setFiltro(opcao.key)}
            >
              <Text style={[styles.chipText, ativo && styles.chipTextActive]}>{opcao.label}</Text>
              <View
                style={[
                  styles.count,
                  ativo && styles.countActive,
                  alerta && !ativo && styles.countAlerta,
                ]}
              >
                <Text
                  style={[
                    styles.countText,
                    ativo && styles.countTextActive,
                    alerta && !ativo && styles.countTextAlerta,
                  ]}
                >
                  {contagem[opcao.key]}
                </Text>
              </View>
            </TouchableOpacity>
          );
        })}

        <SearchBox
          value={busca}
          onChangeText={setBusca}
          placeholder="Buscar aluno, RM ou uniforme..."
        />
      </View>

      <ScrollView
        style={styles.space}
        contentContainerStyle={{ paddingHorizontal: recuo, paddingBottom: 40 }}
      >
        {loading && (
          <View style={styles.centerBox}>
            <ActivityIndicator color="#1B4A3B" />
          </View>
        )}

        {!loading && !!listError && (
          <View style={styles.centerBox}>
            <Text style={styles.errorText}>{listError}</Text>
            <TouchableOpacity onPress={() => load()}>
              <Text style={styles.retryText}>Tentar novamente</Text>
            </TouchableOpacity>
          </View>
        )}

        {!loading && !listError && visiveis.length === 0 && (
          <View style={styles.centerBox}>
            <Text style={styles.emptyText}>{textoVazio()}</Text>
          </View>
        )}

        {!loading &&
          !listError &&
          visiveis.map((e) => {
            const devolvido = e.status === "devolvido";
            const pendente = e.status === "pendente";
            const ocupado = respondendoId === e.id;
            return (
              <View key={e.id} style={[styles.card, e.atrasado && styles.cardAtrasado]}>
                <View style={styles.cardTop}>
                  <View style={styles.cardMain}>
                    <Text style={styles.cardTitle}>{e.materialNome}</Text>
                    <Text style={styles.cardMeta}>{e.quantidadeTexto}</Text>
                  </View>
                  <PrazoBadge emprestimo={e} />
                </View>

                <Text style={styles.cardAluno}>
                  {e.alunoNome}
                  {e.alunoRm ? ` · RM ${e.alunoRm}` : ""}
                </Text>
                <Text style={styles.cardDate}>
                  {pendente
                    ? `Pedido em ${formatarDataHoraBR(e.criadoEm)} · devolução pedida para ${e.dataDevolucao}`
                    : `Pedido em ${formatarDataHoraBR(e.criadoEm)} · devolver até ${e.dataDevolucao}`}
                </Text>
                {!!textoConfirmado(e) && <Text style={styles.cardDate}>{textoConfirmado(e)}</Text>}
                {devolvido && <Text style={styles.cardDate}>{textoDevolvido(e)}</Text>}
                {!!e.observacao && (
                  <Text style={styles.cardNote}>Observação: {e.observacao}</Text>
                )}

                {pendente && recusandoId === e.id && (
                  <TextInput
                    style={styles.motivoInput}
                    placeholder="Motivo da recusa (opcional)"
                    value={motivo}
                    onChangeText={setMotivo}
                    maxLength={MOTIVO_MAX}
                    multiline
                    editable={!ocupado}
                  />
                )}

                <View style={styles.cardActions}>
                  {pendente && recusandoId === e.id && (
                    <>
                      <TouchableOpacity
                        style={styles.ghostButton}
                        onPress={() => {
                          setRecusandoId(null);
                          setMotivo("");
                        }}
                        disabled={ocupado}
                      >
                        <Text style={styles.ghostButtonText}>Voltar</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.refuseButton, ocupado && styles.buttonDisabled]}
                        onPress={() => handleRecusar(e)}
                        disabled={ocupado}
                      >
                        {ocupado ? (
                          <ActivityIndicator color="#ffffff" />
                        ) : (
                          <Text style={styles.primaryButtonText}>Confirmar recusa</Text>
                        )}
                      </TouchableOpacity>
                    </>
                  )}

                  {pendente && recusandoId !== e.id && (
                    <>
                      <TouchableOpacity
                        style={[styles.refuseButton, ocupado && styles.buttonDisabled]}
                        onPress={() => {
                          setRecusandoId(e.id);
                          setMotivo("");
                        }}
                        disabled={ocupado}
                      >
                        <Text style={styles.primaryButtonText}>Recusar</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.primaryButton, ocupado && styles.buttonDisabled]}
                        onPress={() => handleAprovar(e)}
                        disabled={ocupado}
                      >
                        {ocupado ? (
                          <ActivityIndicator color="#ffffff" />
                        ) : (
                          <Text style={styles.primaryButtonText}>Confirmar empréstimo</Text>
                        )}
                      </TouchableOpacity>
                    </>
                  )}

                  {!devolvido && !pendente && (
                    <TouchableOpacity
                      style={[styles.primaryButton, devolvendoId === e.id && styles.buttonDisabled]}
                      onPress={() => handleDevolver(e)}
                      disabled={devolvendoId === e.id}
                    >
                      {devolvendoId === e.id ? (
                        <ActivityIndicator color="#ffffff" />
                      ) : (
                        <Text style={styles.primaryButtonText}>Registrar devolução</Text>
                      )}
                    </TouchableOpacity>
                  )}

                  {!pendente && (
                    <TouchableOpacity
                      style={styles.ghostButton}
                      onPress={() => baixarTermoEmprestimo(e)}
                    >
                      <Text style={styles.ghostButtonText}>Termo (PDF)</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            );
          })}
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  space: { flex: 1 },

  filterRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 8,
    paddingTop: 16,
    paddingBottom: 16,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderColor: "#c9c9c9",
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingVertical: 9,
    minHeight: 44,
    backgroundColor: "#ffffff",
  },
  chipActive: { borderColor: "#1B4A3B", backgroundColor: "#1B4A3B" },
  chipText: { fontSize: 16, color: "#5f6368" },
  chipTextActive: { color: "#ffffff", fontWeight: "600" },
  count: {
    minWidth: 26,
    minHeight: 24,
    borderRadius: 12,
    paddingHorizontal: 6,
    backgroundColor: "#eeeeee",
    alignItems: "center",
    justifyContent: "center",
  },
  countActive: { backgroundColor: "rgba(255, 255, 255, 0.22)" },
  countAlerta: { backgroundColor: "#fdeceb" },
  countText: { fontSize: 14, fontWeight: "600", color: "#5f6368" },
  countTextActive: { color: "#ffffff" },
  countTextAlerta: { color: "#c62828" },

  centerBox: { paddingVertical: 32, alignItems: "center" },
  emptyText: { color: "#5f6368", fontSize: 16, textAlign: "center" },
  errorText: { color: "#c62828", fontSize: 15, marginBottom: 12 },
  retryText: { color: "#1B4A3B", fontSize: 15, fontWeight: "600" },

  card: {
    backgroundColor: "#ffffff",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#e6e6e6",
    padding: 16,
    marginBottom: 12,
    maxWidth: 820,
  },
  cardAtrasado: { borderColor: "#e8a5a0", borderLeftWidth: 4, borderLeftColor: "#c62828" },
  cardTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: 10,
  },
  cardMain: { flex: 1, minWidth: 180 },
  cardTitle: { fontSize: 17, fontWeight: "600", color: "#202124" },
  cardMeta: { fontSize: 15, color: "#5f6368", marginTop: 2 },
  cardAluno: { fontSize: 16, color: "#202124", marginTop: 10, fontWeight: "500" },
  cardDate: { fontSize: 15, color: "#5f6368", marginTop: 4 },
  cardNote: { fontSize: 15, color: "#3c3c3c", marginTop: 6 },
  cardActions: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 14 },

  primaryButton: {
    backgroundColor: "#1B4A3B",
    borderRadius: 6,
    paddingHorizontal: 16,
    paddingVertical: 11,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryButtonText: { color: "#ffffff", fontSize: 15, fontWeight: "600" },
  refuseButton: {
    backgroundColor: "#c62828",
    borderRadius: 6,
    paddingHorizontal: 16,
    paddingVertical: 11,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  motivoInput: {
    borderWidth: 1,
    borderColor: "#c9c9c9",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: "#202124",
    marginTop: 12,
    minHeight: 60,
    textAlignVertical: "top",
    backgroundColor: "#ffffff",
  },
  ghostButton: {
    borderWidth: 1,
    borderColor: "#495057",
    borderRadius: 6,
    paddingHorizontal: 16,
    paddingVertical: 11,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#ffffff",
  },
  ghostButtonText: { fontSize: 15, color: "#495057", fontWeight: "600" },
  buttonDisabled: { opacity: 0.5 },
});
