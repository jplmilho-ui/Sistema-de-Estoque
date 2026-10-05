// Tela "Solicitações" — única tela do ALUNO (versão reduzida do sistema).
//
// O aluno pode:
//   - criar uma nova solicitação de material/EPI/uniforme;
//   - acompanhar as solicitações pendentes (e cancelar, se desistir);
//   - ver o histórico das já respondidas (aprovadas, recusadas, canceladas).
//
// Quem aprova ou recusa são admin, coordenador e professor, pelo sino de
// notificações (ver components/NotificationsPopup.js).
import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
} from "react-native";
import { router } from "expo-router";
import AppBar from "../components/AppBar";
import PageHeader from "../components/PageHeader";
import { confirmAction } from "../utils/confirmAction";
import { getSession } from "../services/authStorage";
import {
  listMateriaisDisponiveis,
  listMinhasSolicitacoes,
  criarSolicitacao,
  cancelarSolicitacao,
} from "../services/solicitacoesApi";

const QUANTIDADE_MAX_DIGITOS = 4;
const OBSERVACAO_MAX = 300;
const ATUALIZACAO_MS = 30 * 1000; // o aluno vê as respostas sem precisar recarregar

const FILTROS_CATEGORIA = [
  { key: "todas", label: "Todas" },
  { key: "EPI", label: "EPI" },
  { key: "Uniforme", label: "Uniforme" },
];

// rótulo + estilo de cada status
const STATUS_INFO = {
  pendente: { label: "Pendente", badge: "badgePendente", text: "badgePendenteText" },
  aprovada: { label: "Aprovada", badge: "badgeAprovada", text: "badgeAprovadaText" },
  recusada: { label: "Recusada", badge: "badgeRecusada", text: "badgeRecusadaText" },
  cancelada: { label: "Cancelada", badge: "badgeCancelada", text: "badgeCanceladaText" },
};

function formatarDataHora(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const dia = String(d.getDate()).padStart(2, "0");
  const mes = String(d.getMonth() + 1).padStart(2, "0");
  const hora = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  return `${dia}/${mes}/${d.getFullYear()} ${hora}:${min}`;
}

export default function Solicitacoes() {
  // CONTROLE DE ACESSO: só o aluno usa esta tela.
  const [checkingAccess, setCheckingAccess] = useState(true);
  const [session, setSession] = useState(null);

  // lista de pedidos do aluno
  const [solicitacoes, setSolicitacoes] = useState([]);
  const [loadingList, setLoadingList] = useState(true);
  const [listError, setListError] = useState("");

  // formulário de nova solicitação
  const [formOpen, setFormOpen] = useState(false);
  const [materiais, setMateriais] = useState([]);
  const [loadingMateriais, setLoadingMateriais] = useState(false);
  const [categoriaFiltro, setCategoriaFiltro] = useState("todas");
  const [materialId, setMaterialId] = useState(null);
  const [quantidade, setQuantidade] = useState("");
  const [observacao, setObservacao] = useState("");
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);

  // id do pedido que está sendo cancelado
  const [cancelingId, setCancelingId] = useState(null);

  useEffect(() => {
    async function verifyAccess() {
      try {
        const currentSession = await getSession();

        if (!currentSession?.token) {
          router.replace("/");
          return;
        }

        if (currentSession.user?.role !== "aluno") {
          router.replace("/tela_inicial");
          return;
        }

        setSession(currentSession);
      } catch (error) {
        console.error("Erro ao verificar acesso:", error);
        router.replace("/");
      } finally {
        setCheckingAccess(false);
      }
    }

    verifyAccess();
  }, []);

  const loadSolicitacoes = useCallback(async (token, { silencioso = false } = {}) => {
    if (!silencioso) setLoadingList(true);
    try {
      const data = await listMinhasSolicitacoes(token);
      setSolicitacoes(data.solicitacoes || []);
      setListError("");
    } catch (error) {
      // numa atualização automática, não troca a lista por uma mensagem de erro
      if (!silencioso) setListError(error.message);
    } finally {
      if (!silencioso) setLoadingList(false);
    }
  }, []);

  useEffect(() => {
    if (!session?.token) return;
    loadSolicitacoes(session.token);
    const timer = setInterval(
      () => loadSolicitacoes(session.token, { silencioso: true }),
      ATUALIZACAO_MS
    );
    return () => clearInterval(timer);
  }, [session, loadSolicitacoes]);

  async function loadMateriais() {
    setLoadingMateriais(true);
    try {
      const data = await listMateriaisDisponiveis(session.token);
      setMateriais(data.materiais || []);
    } catch (error) {
      setFormError(error.message);
    } finally {
      setLoadingMateriais(false);
    }
  }

  function resetForm() {
    setMaterialId(null);
    setQuantidade("");
    setObservacao("");
    setCategoriaFiltro("todas");
    setFormError("");
  }

  function toggleForm() {
    if (formOpen) {
      setFormOpen(false);
      resetForm();
      return;
    }
    setFormOpen(true);
    resetForm();
    loadMateriais(); // sempre busca a lista fresca ao abrir
  }

  const materialSelecionado = materiais.find((m) => m.id === materialId) || null;

  const materiaisVisiveis =
    categoriaFiltro === "todas"
      ? materiais
      : materiais.filter((m) => m.categoria === categoriaFiltro);

  async function handleSubmit() {
    setFormError("");

    if (!materialSelecionado) {
      setFormError("Escolha o material que você precisa.");
      return;
    }

    const qtd = Number(quantidade);
    if (!Number.isInteger(qtd) || qtd <= 0) {
      setFormError("Informe uma quantidade válida, maior que zero.");
      return;
    }

    setSaving(true);
    try {
      await criarSolicitacao(session.token, {
        materialId: materialSelecionado.id,
        quantidade: qtd,
        observacao: observacao.trim() || undefined,
      });

      setFormOpen(false);
      resetForm();
      await loadSolicitacoes(session.token, { silencioso: true });
    } catch (error) {
      setFormError(error.message);
    } finally {
      setSaving(false);
    }
  }

  function handleCancel(solicitacao) {
    confirmAction({
      title: "Cancelar solicitação",
      message: `Deseja cancelar o pedido de ${solicitacao.quantidadeTexto} de "${solicitacao.materialNome}"?`,
      confirmText: "Cancelar pedido",
      cancelText: "Voltar",
      onConfirm: async () => {
        setCancelingId(solicitacao.id);
        try {
          await cancelarSolicitacao(session.token, solicitacao.id);
        } catch (error) {
          Alert.alert("Não foi possível cancelar", error.message);
        } finally {
          setCancelingId(null);
          loadSolicitacoes(session.token, { silencioso: true });
        }
      },
    });
  }

  if (checkingAccess) {
    return null;
  }

  const pendentes = solicitacoes.filter((s) => s.status === "pendente");
  const historico = solicitacoes.filter((s) => s.status !== "pendente");

  function renderCard(solicitacao) {
    const info = STATUS_INFO[solicitacao.status] || STATUS_INFO.pendente;

    return (
      <View key={solicitacao.id} style={styles.requestCard}>
        <View style={styles.requestTop}>
          <View style={styles.requestMain}>
            <Text style={styles.requestTitle}>{solicitacao.materialNome}</Text>
            <Text style={styles.requestMeta}>
              {solicitacao.quantidadeTexto} · {solicitacao.categoria}
            </Text>
          </View>

          <View style={[styles.badge, styles[info.badge]]}>
            <Text style={[styles.badgeText, styles[info.text]]}>{info.label}</Text>
          </View>
        </View>

        <Text style={styles.requestDate}>
          Solicitada em {formatarDataHora(solicitacao.criadoEm)}
        </Text>

        {!!solicitacao.observacao && (
          <Text style={styles.requestNote}>Observação: {solicitacao.observacao}</Text>
        )}

        {solicitacao.status === "aprovada" && (
          <Text style={styles.requestResult}>
            Aprovada por {solicitacao.respondidoPorNome} em{" "}
            {formatarDataHora(solicitacao.respondidoEm)}
          </Text>
        )}

        {solicitacao.status === "recusada" && (
          <>
            <Text style={styles.requestResultRecusada}>
              Recusada por {solicitacao.respondidoPorNome} em{" "}
              {formatarDataHora(solicitacao.respondidoEm)}
            </Text>
            {!!solicitacao.motivoRecusa && (
              <Text style={styles.requestNote}>Motivo: {solicitacao.motivoRecusa}</Text>
            )}
          </>
        )}

        {solicitacao.status === "pendente" && (
          <View style={styles.requestActions}>
            <Text style={styles.waitingText}>Aguardando resposta…</Text>
            <TouchableOpacity
              style={[styles.cancelButton, cancelingId === solicitacao.id && styles.buttonDisabled]}
              onPress={() => handleCancel(solicitacao)}
              disabled={cancelingId === solicitacao.id}
            >
              <Text style={styles.cancelButtonText}>Cancelar pedido</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  }

  return (
    <AppBar>
      <PageHeader
        title="Solicitações"
        actions={
          <TouchableOpacity style={styles.newButton} onPress={toggleForm}>
            <Text style={styles.newButtonText}>
              {formOpen ? "Cancelar" : "Nova solicitação"}
            </Text>
          </TouchableOpacity>
        }
      />

      <ScrollView style={styles.space} contentContainerStyle={styles.spaceContent}>
        {/* FORMULÁRIO */}
        {formOpen && (
          <View style={styles.formCard}>
            <Text style={styles.formTitle}>Nova solicitação</Text>

            <Text style={styles.fieldLabel}>Material</Text>

            <View style={styles.chipRow}>
              {FILTROS_CATEGORIA.map((opcao) => {
                const ativo = categoriaFiltro === opcao.key;
                return (
                  <TouchableOpacity
                    key={opcao.key}
                    style={[styles.chip, ativo && styles.chipActive]}
                    onPress={() => setCategoriaFiltro(opcao.key)}
                  >
                    <Text style={[styles.chipText, ativo && styles.chipTextActive]}>
                      {opcao.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <View style={styles.materialList}>
              {loadingMateriais && (
                <View style={styles.centerBox}>
                  <ActivityIndicator color="#1B4A3B" />
                </View>
              )}

              {!loadingMateriais && materiaisVisiveis.length === 0 && (
                <View style={styles.centerBox}>
                  <Text style={styles.emptyText}>
                    {materiais.length === 0
                      ? "Nenhum material disponível para solicitação no momento."
                      : `Nenhum material disponível na categoria ${categoriaFiltro}.`}
                  </Text>
                </View>
              )}

              {!loadingMateriais && materiaisVisiveis.length > 0 && (
                <ScrollView style={styles.materialScroll} nestedScrollEnabled>
                  {materiaisVisiveis.map((material) => {
                    const ativo = material.id === materialId;
                    return (
                      <TouchableOpacity
                        key={material.id}
                        style={[styles.materialOption, ativo && styles.materialOptionActive]}
                        onPress={() => setMaterialId(material.id)}
                      >
                        <Text
                          style={[styles.materialName, ativo && styles.materialNameActive]}
                        >
                          {material.nome}
                        </Text>
                        <Text style={styles.materialCategory}>{material.categoria}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              )}
            </View>

            <Text style={styles.fieldLabel}>
              Quantidade
              {materialSelecionado
                ? ` (em ${materialSelecionado.unidadeMedida.toLowerCase()}${
                    materialSelecionado.unidadeMedida === "Unidade" ? "s" : "(s)"
                  })`
                : ""}
            </Text>
            <TextInput
              style={styles.input}
              placeholder="Ex: 2"
              value={quantidade}
              onChangeText={(texto) => setQuantidade(texto.replace(/\D/g, ""))}
              keyboardType="numeric"
              maxLength={QUANTIDADE_MAX_DIGITOS}
              editable={!saving}
            />

            <Text style={styles.fieldLabel}>Observação (opcional)</Text>
            <TextInput
              style={[styles.input, styles.inputMultiline]}
              placeholder="Ex: para a aula prática de quinta-feira"
              value={observacao}
              onChangeText={setObservacao}
              multiline
              maxLength={OBSERVACAO_MAX}
              editable={!saving}
            />

            {!!formError && <Text style={styles.errorText}>{formError}</Text>}

            <TouchableOpacity
              style={[styles.saveButton, saving && styles.buttonDisabled]}
              onPress={handleSubmit}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <Text style={styles.saveButtonText}>Enviar solicitação</Text>
              )}
            </TouchableOpacity>
          </View>
        )}

        {loadingList && (
          <View style={styles.centerBox}>
            <ActivityIndicator color="#1B4A3B" />
          </View>
        )}

        {!loadingList && !!listError && (
          <View style={styles.centerBox}>
            <Text style={styles.errorText}>{listError}</Text>
            <TouchableOpacity onPress={() => loadSolicitacoes(session.token)}>
              <Text style={styles.retryText}>Tentar novamente</Text>
            </TouchableOpacity>
          </View>
        )}

        {!loadingList && !listError && (
          <>
            {/* EM ANDAMENTO */}
            <Text style={styles.sectionTitle}>
              Em andamento{pendentes.length > 0 ? ` (${pendentes.length})` : ""}
            </Text>
            {pendentes.length === 0 ? (
              <Text style={styles.sectionEmpty}>Você não tem solicitações pendentes.</Text>
            ) : (
              pendentes.map(renderCard)
            )}

            {/* HISTÓRICO */}
            <Text style={styles.sectionTitle}>Histórico</Text>
            {historico.length === 0 ? (
              <Text style={styles.sectionEmpty}>
                Suas solicitações respondidas aparecem aqui.
              </Text>
            ) : (
              historico.map(renderCard)
            )}
          </>
        )}
      </ScrollView>
    </AppBar>
  );
}

const styles = StyleSheet.create({
  space: {
    flex: 1,
  },
  spaceContent: {
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 40,
  },

  // botão do cabeçalho (mesmo padrão de "Novo usuário"/"Novo material")
  newButton: {
    borderWidth: 1,
    borderColor: "#ed0000",
    borderRadius: 4,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: "#ffffff",
  },
  newButtonText: {
    fontSize: 13,
    color: "#ed0000",
    fontWeight: "600",
  },

  // formulário
  formCard: {
    backgroundColor: "#f5f5f5",
    borderRadius: 10,
    padding: 20,
    marginBottom: 24,
    maxWidth: 520,
  },
  formTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#202124",
    marginBottom: 16,
  },
  fieldLabel: {
    fontSize: 13,
    color: "#5f6368",
    marginBottom: 8,
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 10,
  },
  chip: {
    borderWidth: 1,
    borderColor: "#c9c9c9",
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 6,
    backgroundColor: "#ffffff",
  },
  chipActive: {
    borderColor: "#1B4A3B",
    backgroundColor: "#1B4A3B",
  },
  chipText: {
    fontSize: 13,
    color: "#5f6368",
  },
  chipTextActive: {
    color: "#ffffff",
    fontWeight: "600",
  },
  materialList: {
    borderWidth: 1,
    borderColor: "#c9c9c9",
    borderRadius: 8,
    backgroundColor: "#ffffff",
    marginBottom: 16,
    overflow: "hidden",
  },
  materialScroll: {
    maxHeight: 220,
  },
  materialOption: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderBottomColor: "#eeeeee",
  },
  materialOptionActive: {
    backgroundColor: "#e3efe9",
  },
  materialName: {
    flex: 1,
    fontSize: 14,
    color: "#202124",
    paddingRight: 8,
  },
  materialNameActive: {
    fontWeight: "600",
    color: "#1B4A3B",
  },
  materialCategory: {
    fontSize: 12,
    color: "#80868b",
  },
  input: {
    borderWidth: 1,
    borderColor: "#c9c9c9",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 15,
    color: "#202124",
    marginBottom: 16,
    backgroundColor: "#ffffff",
  },
  inputMultiline: {
    minHeight: 72,
    textAlignVertical: "top",
  },
  saveButton: {
    backgroundColor: "#ed0000",
    borderRadius: 6,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  saveButtonText: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "500",
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  errorText: {
    color: "#c62828",
    fontSize: 13,
    marginBottom: 12,
  },
  retryText: {
    color: "#1B4A3B",
    fontSize: 13,
    fontWeight: "600",
  },

  // seções
  sectionTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: "#202124",
    marginTop: 8,
    marginBottom: 12,
  },
  sectionEmpty: {
    fontSize: 14,
    color: "#5f6368",
    marginBottom: 24,
  },
  centerBox: {
    paddingVertical: 24,
    alignItems: "center",
  },
  emptyText: {
    color: "#5f6368",
    fontSize: 14,
    textAlign: "center",
  },

  // cartão de cada solicitação
  requestCard: {
    backgroundColor: "#ffffff",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#e6e6e6",
    padding: 16,
    marginBottom: 12,
    maxWidth: 720,
  },
  requestTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
  },
  requestMain: {
    flex: 1,
  },
  requestTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: "#202124",
  },
  requestMeta: {
    fontSize: 13,
    color: "#5f6368",
    marginTop: 2,
  },
  requestDate: {
    fontSize: 12,
    color: "#80868b",
    marginTop: 8,
  },
  requestNote: {
    fontSize: 13,
    color: "#3c3c3c",
    marginTop: 6,
  },
  requestResult: {
    fontSize: 13,
    color: "#1b6b3a",
    marginTop: 6,
  },
  requestResultRecusada: {
    fontSize: 13,
    color: "#c62828",
    marginTop: 6,
  },
  requestActions: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 12,
  },
  waitingText: {
    fontSize: 12,
    color: "#80868b",
    fontStyle: "italic",
  },
  cancelButton: {
    borderWidth: 1,
    borderColor: "#495057",
    borderRadius: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: "#ffffff",
  },
  cancelButtonText: {
    fontSize: 12,
    color: "#495057",
    fontWeight: "600",
  },

  // selos de status
  badge: {
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: "600",
  },
  badgePendente: { backgroundColor: "#fff4e0" },
  badgePendenteText: { color: "#b26a00" },
  badgeAprovada: { backgroundColor: "#e6f4ea" },
  badgeAprovadaText: { color: "#1b6b3a" },
  badgeRecusada: { backgroundColor: "#fdeceb" },
  badgeRecusadaText: { color: "#c62828" },
  badgeCancelada: { backgroundColor: "#eeeeee" },
  badgeCanceladaText: { color: "#5f6368" },
});
