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

import { getSession } from "../services/authStorage";

import {
  listMaterials,
  createMaterial,
  updateMaterial,
  setMaterialActive,
  deleteMaterial,
} from "../services/materialApi";

const CATEGORIAS = ["EPI", "Uniforme", "Outro"];

// Unidades de medida disponíveis no formulário. "Outro" libera um campo
// de texto livre pra digitar uma unidade que não está na lista (ex: "Rolo").
const UNIDADES = ["Unidade", "Caixa", "Pacote", "Outro"];

export default function Materiais() {
  // CONTROLE DE ACESSO
  // (RF011-RF014 são requisitos do Administrador, então só admin entra aqui)

  const [checkingAccess, setCheckingAccess] = useState(true);
  const [session, setSession] = useState(null);

  // ---------------------------------------------------------
  // LISTA DE MATERIAIS
  // ---------------------------------------------------------

  const [materials, setMaterials] = useState([]);
  const [loadingList, setLoadingList] = useState(true);
  const [listError, setListError] = useState("");

  // ---------------------------------------------------------
  // FORMULÁRIO (serve tanto para criar quanto para editar)
  // ---------------------------------------------------------

  const [formOpen, setFormOpen] = useState(false);

  // Se editingId estiver preenchido, o formulário está em modo edição
  const [editingId, setEditingId] = useState(null);

  const [nome, setNome] = useState("");
  const [categoria, setCategoria] = useState(CATEGORIAS[0]);

  // Unidade de medida escolhida no toggle, e o texto livre caso seja "Outro"
  const [unidadeMedida, setUnidadeMedida] = useState(UNIDADES[0]);
  const [unidadeCustom, setUnidadeCustom] = useState("");

  // Quantas unidades individuais tem em 1 "unidadeMedida"
  // (ex: 1 caixa = 50 unidades -> fatorConversao = "50")
  const [fatorConversao, setFatorConversao] = useState("1");

  // Quantas "unidadeMedida" existem em estoque (ex: 4 caixas)
  const [quantidade, setQuantidade] = useState("");

  const [validade, setValidade] = useState("");
  const [ca, setCa] = useState("");

  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);

  // ---------------------------------------------------------
  // AÇÕES POR LINHA (inativar/reativar e excluir)
  // ---------------------------------------------------------

  const [updatingId, setUpdatingId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);

  // VERIFICAÇÃO DE ACESSO

  useEffect(() => {
    async function verifyAccess() {
      try {
        const currentSession = await getSession();

        if (!currentSession?.token) {
          router.replace("/login");
          return;
        }

        if (currentSession.user?.role !== "admin") {
          Alert.alert(
            "Acesso restrito",
            "Essa área é só para administradores."
          );
          router.replace("/tela_inicial");
          return;
        }

        setSession(currentSession);
      } catch (error) {
        console.error("Erro ao verificar acesso:", error);
        router.replace("/login");
      } finally {
        setCheckingAccess(false);
      }
    }

    verifyAccess();
  }, []);

  // CARREGAR MATERIAIS

  const loadMaterials = useCallback(async (token) => {
    setLoadingList(true);
    setListError("");

    try {
      const response = await listMaterials(token);
      setMaterials(response.materials || []);
    } catch (error) {
      console.error("Erro ao carregar materiais:", error);
      setListError(
        error?.message || "Não foi possível carregar os materiais."
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

  // Nome da unidade "final" (resolve o caso de "Outro")
  function unidadeFinal() {
    return unidadeMedida === "Outro" ? unidadeCustom.trim() : unidadeMedida;
  }

  // RESETAR FORMULÁRIO

  function resetForm() {
    setEditingId(null);
    setNome("");
    setCategoria(CATEGORIAS[0]);
    setUnidadeMedida(UNIDADES[0]);
    setUnidadeCustom("");
    setFatorConversao("1");
    setQuantidade("");
    setValidade("");
    setCa("");
    setFormError("");
  }

  // ABRIR FORMULÁRIO EM MODO EDIÇÃO, já preenchido

  function startEdit(material) {
    setEditingId(material.id);
    setNome(material.nome);
    setCategoria(material.categoria);

    if (UNIDADES.includes(material.unidadeMedida)) {
      setUnidadeMedida(material.unidadeMedida);
      setUnidadeCustom("");
    } else {
      // Unidade customizada que não está na lista padrão
      setUnidadeMedida("Outro");
      setUnidadeCustom(material.unidadeMedida);
    }

    setFatorConversao(String(material.fatorConversao));
    setQuantidade(String(material.quantidade));
    setValidade(material.validade || "");
    setCa(material.ca || "");
    setFormError("");
    setFormOpen(true);
  }

  // VALIDAÇÃO DO FORMULÁRIO

  function validateForm() {
    if (!nome.trim() || !categoria) {
      return "Preencha nome e categoria.";
    }

    const unidade = unidadeFinal();
    if (!unidade) {
      return "Informe a unidade de medida.";
    }

    if (
      !quantidade.trim() ||
      Number.isNaN(Number(quantidade)) ||
      Number(quantidade) < 0
    ) {
      return "Quantidade precisa ser um número válido.";
    }

    if (unidadeMedida !== "Unidade") {
      if (
        !fatorConversao.trim() ||
        Number.isNaN(Number(fatorConversao)) ||
        Number(fatorConversao) <= 0
      ) {
        return `Informe quantas unidades tem em cada ${unidade.toLowerCase()}.`;
      }
    }

    return null;
  }

  // SALVAR (CRIA UM NOVO OU ATUALIZA O QUE ESTIVER EM EDIÇÃO)

  async function handleSave() {
    setFormError("");

    const validationError = validateForm();
    if (validationError) {
      setFormError(validationError);
      return;
    }

    setSaving(true);

    try {
      const payload = {
        nome,
        categoria,
        unidadeMedida: unidadeFinal(),
        fatorConversao,
        quantidade,
        validade,
        ca,
      };

      if (editingId) {
        // RF006 - Editar material
        await updateMaterial(session.token, editingId, payload);
      } else {
        // RF011 - Cadastrar material
        await createMaterial(session.token, payload);
      }

      resetForm();
      setFormOpen(false);
      await loadMaterials(session.token);
    } catch (error) {
      setFormError(
        error?.message || "Não foi possível salvar o material."
      );
    } finally {
      setSaving(false);
    }
  }

  // RF007 - INATIVAR / REATIVAR MATERIAL

  async function toggleActive(material) {
    setUpdatingId(material.id);

    try {
      await setMaterialActive(session.token, material.id, !material.ativo);

      // Atualiza direto na tela, sem precisar recarregar a lista inteira
      setMaterials((current) =>
        current.map((item) =>
          item.id === material.id ? { ...item, ativo: !item.ativo } : item
        )
      );
    } catch (error) {
      console.error("Erro ao atualizar status do material:", error);
      Alert.alert(
        "Erro",
        error?.message || "Não foi possível atualizar o status."
      );
    } finally {
      setUpdatingId(null);
    }
  }

  // RF012 - EXCLUIR MATERIAL (permanente)

  function confirmDelete(material) {
    Alert.alert(
      "Excluir material",
      `Tem certeza que quer excluir "${material.nome}"? Essa ação não pode ser desfeita.`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Excluir",
          style: "destructive",
          onPress: () => handleDelete(material.id),
        },
      ]
    );
  }

  async function handleDelete(id) {
    setDeletingId(id);

    try {
      await deleteMaterial(session.token, id);
      setMaterials((current) => current.filter((item) => item.id !== id));
    } catch (error) {
      console.error("Erro ao excluir material:", error);
      Alert.alert(
        "Erro ao excluir",
        error?.message || "Não foi possível excluir o material."
      );
    } finally {
      setDeletingId(null);
    }
  }

  // Formata a coluna de quantidade da tabela.
  // Ex: unidadeMedida "Caixa" -> principal "4 caixas", detalhe "= 200 un."
  //     unidadeMedida "Unidade" -> principal "15 un.", sem detalhe
  function formatQuantidade(material) {
    const { unidadeMedida: unidade, quantidade: qtd, quantidadeTotal } =
      material;

    if (unidade === "Unidade") {
      return { principal: `${qtd} un.`, detalhe: null };
    }

    // Pluralização simples (não cobre casos irregulares em português,
    // mas funciona bem para "caixa/caixas", "pacote/pacotes" etc.)
    const unidadeLower = unidade.toLowerCase();
    const plural = qtd === 1 ? unidadeLower : `${unidadeLower}s`;

    return {
      principal: `${qtd} ${plural}`,
      detalhe: `= ${quantidadeTotal} un.`,
    };
  }

  // Enquanto verificamos o acesso, não renderiza nada
  if (checkingAccess) {
    return null;
  }

  const unidadeSelecionada = unidadeFinal();
  const totalCalculado =
    (Number(quantidade) || 0) *
    (unidadeMedida === "Unidade" ? 1 : Number(fatorConversao) || 0);

  // INTERFACE

  return (
    <AppBar>
      <PageHeader
        title="Materiais"
        actions={
          <TouchableOpacity
            style={styles.newButton}
            onPress={() => {
              if (formOpen) {
                resetForm();
              }
              setFormOpen((open) => !open);
            }}
          >
            <Text style={styles.newButtonText}>
              {formOpen ? "Cancelar" : "+ Novo material"}
            </Text>
          </TouchableOpacity>
        }
      />

      <ScrollView
        style={styles.space}
        contentContainerStyle={{ paddingBottom: 30 }}
      >
        {formOpen && (
          <View style={styles.formCard}>
            <Text style={styles.formTitle}>
              {editingId ? "Editar material" : "Novo material"}
            </Text>

            <TextInput
              style={styles.input}
              placeholder="Nome do material"
              value={nome}
              onChangeText={setNome}
              editable={!saving}
            />

            <Text style={styles.fieldLabel}>Categoria</Text>
            <View style={styles.toggleRow}>
              {CATEGORIAS.map((opt) => (
                <TouchableOpacity
                  key={opt}
                  style={[
                    styles.toggleOption,
                    categoria === opt && styles.toggleOptionActive,
                  ]}
                  onPress={() => setCategoria(opt)}
                  disabled={saving}
                >
                  <Text
                    style={[
                      styles.toggleOptionText,
                      categoria === opt && styles.toggleOptionTextActive,
                    ]}
                  >
                    {opt}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.fieldLabel}>Unidade de medida</Text>
            <View style={styles.toggleRow}>
              {UNIDADES.map((opt) => (
                <TouchableOpacity
                  key={opt}
                  style={[
                    styles.toggleOption,
                    unidadeMedida === opt && styles.toggleOptionActive,
                  ]}
                  onPress={() => setUnidadeMedida(opt)}
                  disabled={saving}
                >
                  <Text
                    style={[
                      styles.toggleOptionText,
                      unidadeMedida === opt && styles.toggleOptionTextActive,
                    ]}
                  >
                    {opt}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {unidadeMedida === "Outro" && (
              <TextInput
                style={styles.input}
                placeholder="Nome da unidade (ex: Rolo, Frasco)"
                value={unidadeCustom}
                onChangeText={setUnidadeCustom}
                editable={!saving}
              />
            )}

            {unidadeMedida !== "Unidade" && (
              <TextInput
                style={styles.input}
                placeholder={`Quantas unidades tem em 1 ${
                  (unidadeSelecionada || "embalagem").toLowerCase()
                }? (ex: 50)`}
                value={fatorConversao}
                onChangeText={setFatorConversao}
                keyboardType="numeric"
                editable={!saving}
              />
            )}

            <TextInput
              style={styles.input}
              placeholder={
                unidadeMedida === "Unidade"
                  ? "Quantidade (em unidades)"
                  : `Quantidade de ${
                      (unidadeSelecionada || "embalagens").toLowerCase()
                    }s em estoque`
              }
              value={quantidade}
              onChangeText={setQuantidade}
              keyboardType="numeric"
              editable={!saving}
            />

            {unidadeMedida !== "Unidade" && (
              <Text style={styles.helperText}>
                Total em estoque: {totalCalculado} unidades
              </Text>
            )}

            <TextInput
              style={styles.input}
              placeholder="Data de validade (opcional)"
              value={validade}
              onChangeText={setValidade}
              editable={!saving}
            />

            <TextInput
              style={styles.input}
              placeholder="C.A. (opcional, para EPIs)"
              value={ca}
              onChangeText={setCa}
              editable={!saving}
            />

            {!!formError && (
              <Text style={styles.errorText}>{formError}</Text>
            )}

            <TouchableOpacity
              style={[styles.saveButton, saving && styles.buttonDisabled]}
              onPress={handleSave}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <Text style={styles.saveButtonText}>
                  {editingId ? "Salvar alterações" : "Salvar material"}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        )}

        {/* LISTA DE MATERIAIS */}

        <View style={styles.listCard}>
          <View style={[styles.row, styles.rowHeader]}>
            <Text style={[styles.cell, styles.cellNome, styles.headerText]}>
              Nome
            </Text>
            <Text style={[styles.cell, styles.cellCategoria, styles.headerText]}>
              Categoria
            </Text>
            <Text style={[styles.cell, styles.cellQtd, styles.headerText]}>
              Quantidade
            </Text>
            <Text style={[styles.cell, styles.cellValidade, styles.headerText]}>
              Validade
            </Text>
            <Text style={[styles.cell, styles.cellCa, styles.headerText]}>
              C.A.
            </Text>
            <Text style={[styles.cell, styles.cellStatus, styles.headerText]}>
              Status
            </Text>
            <Text style={[styles.cell, styles.cellActions, styles.headerText]} />
          </View>

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
                Nenhum material cadastrado ainda.
              </Text>
            </View>
          )}

          {!loadingList &&
            !listError &&
            materials.map((material) => {
              const { principal, detalhe } = formatQuantidade(material);

              return (
                <View key={material.id} style={styles.row}>
                  <Text style={[styles.cell, styles.cellNome]} numberOfLines={1}>
                    {material.nome}
                  </Text>

                  <Text
                    style={[styles.cell, styles.cellCategoria]}
                    numberOfLines={1}
                  >
                    {material.categoria}
                  </Text>

                  <View style={[styles.cell, styles.cellQtd]}>
                    <Text style={styles.qtdPrincipal} numberOfLines={1}>
                      {principal}
                    </Text>
                    {!!detalhe && (
                      <Text style={styles.qtdDetalhe} numberOfLines={1}>
                        {detalhe}
                      </Text>
                    )}
                  </View>

                  <Text
                    style={[styles.cell, styles.cellValidade]}
                    numberOfLines={1}
                  >
                    {material.validade || "—"}
                  </Text>

                  <Text style={[styles.cell, styles.cellCa]} numberOfLines={1}>
                    {material.ca || "—"}
                  </Text>

                  <View style={[styles.cell, styles.cellStatus]}>
                    <Text
                      style={[
                        styles.statusBadge,
                        material.ativo
                          ? styles.statusBadgeAtivo
                          : styles.statusBadgeInativo,
                      ]}
                    >
                      {material.ativo ? "Ativo" : "Inativo"}
                    </Text>
                  </View>

                  <View style={[styles.cell, styles.cellActions]}>
                    <TouchableOpacity
                      style={styles.actionButton}
                      onPress={() => startEdit(material)}
                    >
                      <Text style={styles.actionButtonText}>Editar</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.actionButton}
                      onPress={() => toggleActive(material)}
                      disabled={updatingId === material.id}
                    >
                      {updatingId === material.id ? (
                        <ActivityIndicator size="small" color="#5f6368" />
                      ) : (
                        <Text style={styles.actionButtonText}>
                          {material.ativo ? "Inativar" : "Reativar"}
                        </Text>
                      )}
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.deleteButton}
                      onPress={() => confirmDelete(material)}
                      disabled={deletingId === material.id}
                    >
                      {deletingId === material.id ? (
                        <ActivityIndicator size="small" color="#ed0000" />
                      ) : (
                        <Text style={styles.deleteButtonText}>Excluir</Text>
                      )}
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })}
        </View>
      </ScrollView>
    </AppBar>
  );
}

const styles = StyleSheet.create({
  space: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 24,
  },
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
  formCard: {
    backgroundColor: "#f5f5f5",
    borderRadius: 10,
    padding: 20,
    marginBottom: 24,
    maxWidth: 420,
  },
  formTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#202124",
    marginBottom: 16,
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
  fieldLabel: {
    fontSize: 13,
    color: "#5f6368",
    marginTop: 4,
    marginBottom: 8,
  },
  helperText: {
    fontSize: 12,
    color: "#1b4a3b",
    marginTop: -4,
    marginBottom: 12,
  },
  toggleRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: 16,
  },
  toggleOption: {
    borderWidth: 1,
    borderColor: "#c9c9c9",
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 16,
    backgroundColor: "#ffffff",
  },
  toggleOptionActive: {
    borderColor: "#ed0000",
    backgroundColor: "#fff0f0",
  },
  toggleOptionText: {
    fontSize: 13,
    color: "#5f6368",
  },
  toggleOptionTextActive: {
    color: "#ed0000",
    fontWeight: "600",
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
  cellNome: {
    flex: 1.8,
    paddingRight: 8,
  },
  cellCategoria: {
    flex: 1.1,
    paddingRight: 8,
    color: "#5f6368",
  },
  cellQtd: {
    flex: 1.5,
  },
  qtdPrincipal: {
    fontSize: 13,
    color: "#202124",
  },
  qtdDetalhe: {
    fontSize: 11,
    color: "#5f6368",
    marginTop: 2,
  },
  cellValidade: {
    flex: 1.1,
    color: "#5f6368",
  },
  cellCa: {
    flex: 0.7,
    color: "#5f6368",
  },
  cellStatus: {
    flex: 1,
  },
  cellActions: {
    flex: 2.2,
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 6,
  },
  statusBadge: {
    fontSize: 12,
    fontWeight: "600",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    overflow: "hidden",
    alignSelf: "flex-start",
  },
  statusBadgeAtivo: {
    backgroundColor: "#e6f4ea",
    color: "#1b4a3b",
  },
  statusBadgeInativo: {
    backgroundColor: "#f1f1f1",
    color: "#5f6368",
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
  deleteButton: {
    borderWidth: 1,
    borderColor: "#ed0000",
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  deleteButtonText: {
    fontSize: 12,
    color: "#ed0000",
    fontWeight: "600",
  },
  centerBox: {
    paddingVertical: 24,
    alignItems: "center",
  },
  emptyText: {
    color: "#5f6368",
    fontSize: 14,
  },
});