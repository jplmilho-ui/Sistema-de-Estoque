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
  Modal,
} from "react-native";
import { router } from "expo-router";

import AppBar from "../components/AppBar";
import PageHeader from "../components/PageHeader";
import SearchBox from "../components/SearchBox";

import { getSession } from "../services/authStorage";
import { listMaterials, retirarMaterial, devolverMaterial } from "../services/materialApi";

// Papéis que podem ver e movimentar o Estoque. Diferente da tela de
// Materiais (administrativa), aqui super_admin, admin e professor podem
// todos visualizar e movimentar quantidade — só não administram o
// cadastro dos tipos de material (isso é feito em Materiais).
const PAPEIS_PERMITIDOS = ["super_admin", "admin", "professor"];

// Define as colunas da tabela (nome, flex de largura).
const COLUMNS = [
  { key: "nome", label: "Nome", flex: 2 },
  { key: "id", label: "ID", flex: 0.6 },
  { key: "quantidade", label: "Quantidade", flex: 1.3 },
  { key: "validade", label: "Validade", flex: 1.1 },
  { key: "categoria", label: "Categoria", flex: 1 },
  { key: "ca", label: "C.A", flex: 0.8 },
];

// Monta o texto exibido na coluna "Quantidade", ex: "4 caixas (200 un.)"
// ou "15 un." quando a unidade de medida já é "Unidade".
function cellValue(material, key) {
  switch (key) {
    case "nome":
      return material.nome;
    case "id":
      return String(material.id);
    case "quantidade": {
      const { unidadeMedida, quantidade, quantidadeTotal } = material;
      if (unidadeMedida === "Unidade") {
        return `${quantidade} un.`;
      }
      const unidadeLower = unidadeMedida.toLowerCase();
      const plural = quantidade === 1 ? unidadeLower : `${unidadeLower}s`;
      return `${quantidade} ${plural} (${quantidadeTotal} un.)`;
    }
    case "validade":
      return material.validade || "—";
    case "categoria":
      return material.categoria;
    case "ca":
      return material.ca || "—";
    default:
      return "";
  }
}

export default function Estoque() {
  // ---------------------------------------------------------
  // CONTROLE DE ACESSO
  // ---------------------------------------------------------
  const [checkingAccess, setCheckingAccess] = useState(true);
  const [session, setSession] = useState(null);

  // ---------------------------------------------------------
  // LISTA DE MATERIAIS ATIVOS (só o que está ativo aparece no Estoque)
  // ---------------------------------------------------------
  const [materials, setMaterials] = useState([]);
  const [loadingList, setLoadingList] = useState(true);
  const [listError, setListError] = useState("");

  // Item selecionado na tabela (checkbox) — é sobre ele que os botões
  // "Adicionar item" / "Retirar item" do cabeçalho vão agir.
  const [selectedId, setSelectedId] = useState(null);

  // ---------------------------------------------------------
  // MODAL DE ADICIONAR / RETIRAR QUANTIDADE
  // ---------------------------------------------------------
  // Quando preenchido, mostra o modal: { tipo: "adicionar" | "retirar" }
  const [movement, setMovement] = useState(null);
  const [movementQuantidade, setMovementQuantidade] = useState("");
  const [movementError, setMovementError] = useState("");
  const [movementSaving, setMovementSaving] = useState(false);

  // VERIFICAÇÃO DE ACESSO

  useEffect(() => {
    async function verifyAccess() {
      try {
        const currentSession = await getSession();

        if (!currentSession?.token) {
          router.replace("/");
          return;
        }

        if (!PAPEIS_PERMITIDOS.includes(currentSession.user?.role)) {
          Alert.alert(
            "Acesso restrito",
            "Essa área é só para super administradores, administradores e professores."
          );
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

  // CARREGAR MATERIAIS ATIVOS
  //
  // Regra de sincronização: o Estoque só mostra material que estiver
  // ATIVO em Materiais. Isso é aplicado no backend via ?ativo=true, não
  // apenas escondido visualmente — quem inativa um material em Materiais
  // faz ele sumir daqui de verdade.

  const loadMaterials = useCallback(async (token) => {
    setLoadingList(true);
    setListError("");

    try {
      const response = await listMaterials(token, { ativo: true });
      setMaterials(response.materials || []);
    } catch (error) {
      console.error("Erro ao carregar estoque:", error);
      setListError(
        error?.message || "Não foi possível carregar o estoque."
      );
    } finally {
      setLoadingList(false);
    }
  }, []);

  useEffect(() => {
    if (session?.token) {
      loadMaterials(session.token);
    }
  }, [session, loadMaterials]);

  // SELECIONAR/DESSELECIONAR UM ITEM (clique no checkbox da linha)

  function toggleSelect(id) {
    setSelectedId((current) => (current === id ? null : id));
  }

  const selectedMaterial = materials.find((item) => item.id === selectedId) || null;

  // ABRIR O MODAL DE ADICIONAR/RETIRAR
  //
  // Os botões "Adicionar item" e "Retirar item" agem sobre o item
  // marcado na tabela — se nada estiver selecionado, avisa o usuário
  // em vez de deixar o botão não fazer nada.

  function openMovement(tipo) {
    if (!selectedMaterial) {
      Alert.alert(
        "Selecione um item",
        "Marque o item na lista (checkbox) antes de adicionar ou retirar quantidade."
      );
      return;
    }
    setMovement({ tipo });
    setMovementQuantidade("");
    setMovementError("");
  }

  function closeMovement() {
    if (movementSaving) return; // não fecha no meio de uma requisição
    setMovement(null);
  }

  // CONFIRMAR ADICIONAR/RETIRAR

  async function handleConfirmMovement() {
    setMovementError("");

    if (!selectedMaterial) {
      setMovementError("Esse item não está mais disponível. Feche e selecione outro.");
      return;
    }

    const quantidade = Number(movementQuantidade);

    if (!movementQuantidade.trim() || Number.isNaN(quantidade) || quantidade <= 0) {
      setMovementError("Informe uma quantidade válida, maior que zero.");
      return;
    }

    setMovementSaving(true);

    try {
      const response =
        movement.tipo === "retirar"
          ? await retirarMaterial(session.token, selectedMaterial.id, quantidade)
          : await devolverMaterial(session.token, selectedMaterial.id, quantidade);

      // Atualiza só esse material na lista, sem recarregar tudo.
      setMaterials((current) =>
        current.map((item) =>
          item.id === selectedMaterial.id ? response.material : item
        )
      );

      setMovement(null);
    } catch (error) {
      setMovementError(
        error?.message ||
          `Não foi possível ${
            movement.tipo === "retirar" ? "retirar" : "adicionar"
          } a quantidade.`
      );
    } finally {
      setMovementSaving(false);
    }
  }

  if (checkingAccess) {
    return null;
  }

  return (
    <AppBar>
      <PageHeader
        title="Estoque"
        actions={
          <>
            <TouchableOpacity
              style={styles.retirarButton}
              onPress={() => openMovement("retirar")}
            >
              <Text style={styles.addButtonText}>Retirar item</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.addButton}
              onPress={() => openMovement("adicionar")}
            >
              <Text style={styles.addButtonText}>+ Adicionar item</Text>
            </TouchableOpacity>

            <SearchBox />
          </>
        }
      />

      <ScrollView style={styles.Space} contentContainerStyle={{ paddingBottom: 30 }}>
        <View style={styles.table}>
          {/* Cabeçalho da tabela */}
          <View style={styles.row}>
            <View style={styles.checkboxColumn} />
            {COLUMNS.map((col) => (
              <Text key={col.key} style={[styles.headerCell, { flex: col.flex }]}>
                {col.label}
              </Text>
            ))}
          </View>

          <View style={styles.headerRule} />

          {loadingList && (
            <View style={styles.centerBox}>
              <ActivityIndicator />
            </View>
          )}

          {!loadingList && !!listError && (
            <View style={styles.centerBox}>
              <Text style={styles.errorText}>{listError}</Text>
            </View>
          )}

          {!loadingList && !listError && materials.length === 0 && (
            <View style={styles.centerBox}>
              <Text style={styles.emptyText}>
                Nenhum material ativo no momento. Cadastre ou reative um
                material em Materiais para ele aparecer aqui.
              </Text>
            </View>
          )}

          {/* Itens em estoque (só materiais ativos) */}
          {!loadingList &&
            !listError &&
            materials.map((material) => {
              const selected = material.id === selectedId;
              return (
                <TouchableOpacity
                  key={material.id}
                  style={styles.row}
                  activeOpacity={0.7}
                  onPress={() => toggleSelect(material.id)}
                >
                  <View style={styles.checkboxColumn}>
                    <View style={[styles.checkbox, selected && styles.checkboxChecked]} />
                  </View>
                  {COLUMNS.map((col) => (
                    <Text
                      key={col.key}
                      style={[styles.cell, { flex: col.flex }]}
                      numberOfLines={1}
                    >
                      {cellValue(material, col.key)}
                    </Text>
                  ))}
                </TouchableOpacity>
              );
            })}
        </View>
      </ScrollView>

      {/* MODAL DE ADICIONAR / RETIRAR QUANTIDADE */}
      <Modal
        visible={!!movement}
        transparent
        animationType="fade"
        onRequestClose={closeMovement}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.formTitle}>
              {movement?.tipo === "retirar" ? "Retirar item" : "Adicionar item"}
            </Text>

            <Text style={styles.modalMaterialNome}>{selectedMaterial?.nome}</Text>

            {movement?.tipo === "retirar" && selectedMaterial && (
              <Text style={styles.helperText}>
                Em estoque: {selectedMaterial.quantidade}{" "}
                {selectedMaterial.unidadeMedida.toLowerCase()}(s)
              </Text>
            )}

            <TextInput
              style={styles.input}
              placeholder={
                selectedMaterial
                  ? `Quantidade de ${selectedMaterial.unidadeMedida.toLowerCase()}(s)`
                  : "Quantidade"
              }
              value={movementQuantidade}
              onChangeText={setMovementQuantidade}
              keyboardType="numeric"
              editable={!movementSaving}
              autoFocus
            />

            {!!movementError && <Text style={styles.errorText}>{movementError}</Text>}

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.actionButton, styles.modalCancelButton]}
                onPress={closeMovement}
                disabled={movementSaving}
              >
                <Text style={styles.actionButtonText}>Cancelar</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.saveButton, movementSaving && styles.buttonDisabled]}
                onPress={handleConfirmMovement}
                disabled={movementSaving}
              >
                {movementSaving ? (
                  <ActivityIndicator color="#ffffff" />
                ) : (
                  <Text style={styles.saveButtonText}>Confirmar</Text>
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
  addButton: {
    borderWidth: 1,
    borderColor: "#a9a9a9",
    borderRadius: 4,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: "#ffffff",
  },
  addButtonText: {
    fontSize: 13,
    color: "#1a1a1a",
  },
  retirarButton: {
    borderWidth: 1,
    borderColor: "#b1b1b1",
    borderRadius: 4,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: "#ffffff",
  },
  Space: {
    paddingHorizontal: 24,
    paddingTop: 8,
  },
  table: {
    borderWidth: 1,
    borderColor: "#cccccc",
    borderRadius: 4,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#e0e0e0",
  },
  checkboxColumn: {
    width: 32,
  },
  checkbox: {
    width: 16,
    height: 16,
    borderWidth: 1,
    borderColor: "#999999",
    borderRadius: 2,
  },
  checkboxChecked: {
    backgroundColor: "#1b4a3b",
    borderColor: "#1b4a3b",
  },
  headerCell: {
    fontSize: 13,
    fontWeight: "600",
    color: "#1a1a1a",
  },
  headerRule: {
    height: 1,
    backgroundColor: "#999999",
  },
  cell: {
    fontSize: 13,
    color: "#1a1a1a",
  },
  centerBox: {
    paddingVertical: 24,
    paddingHorizontal: 16,
    alignItems: "center",
  },
  emptyText: {
    color: "#5f6368",
    fontSize: 14,
    textAlign: "center",
  },
  errorText: {
    color: "#c62828",
    fontSize: 13,
    marginBottom: 12,
    textAlign: "center",
  },
  // Modal
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
    maxWidth: 360,
  },
  formTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#202124",
    marginBottom: 16,
  },
  modalMaterialNome: {
    fontSize: 14,
    fontWeight: "600",
    color: "#202124",
    marginBottom: 4,
  },
  helperText: {
    fontSize: 12,
    color: "#1b4a3b",
    marginBottom: 12,
  },
  input: {
    borderWidth: 1,
    borderColor: "#c9c9c9",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 15,
    color: "#202124",
    marginBottom: 10,
    backgroundColor: "#ffffff",
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
});
