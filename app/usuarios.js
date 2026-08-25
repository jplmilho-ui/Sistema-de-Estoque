import React, { useCallback, useEffect, useState } from "react";
import {
  View,Text,TextInput,TouchableOpacity,StyleSheet,ScrollView,ActivityIndicator,Alert,} from "react-native";
import { router } from "expo-router";

// Componentes reutilizáveis da aplicação
import AppBar from "../components/AppBar";
import PageHeader from "../components/PageHeader";

// Função responsável por recuperar a sessão salva
import { getSession } from "../services/authStorage";

// Funções responsáveis pela comunicação com o backend
import {
  listUsers,
  createUser,
  deleteUser,
} from "../services/usersApi";


// Quantidade mínima de caracteres da senha
const SENHA_MINIMA = 8;


export default function Usuarios() {


  // CONTROLE DE ACESSO
 

  // Indica se ainda estamos verificando a sessão do usuário
  const [checkingAccess, setCheckingAccess] = useState(true);

  // Guarda os dados da sessão atual
  const [session, setSession] = useState(null);


  // ---------------------------------------------------------
  // LISTA DE USUÁRIOS
  // ---------------------------------------------------------

  // Lista dos usuários retornados pelo backend
  const [users, setUsers] = useState([]);

  // Indica se a lista está sendo carregada
  const [loadingUsers, setLoadingUsers] = useState(true);

  // Guarda possíveis erros ao carregar os usuários
  const [listError, setListError] = useState("");


  // ---------------------------------------------------------
  // FORMULÁRIO DE NOVO USUÁRIO
  // ---------------------------------------------------------

  // Controla se o formulário está aberto ou fechado
  const [formOpen, setFormOpen] = useState(false);

  // Campos do formulário
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // Função do usuário: user ou admin
  const [role, setRole] = useState("user");

  // Erro específico do formulário
  const [formError, setFormError] = useState("");

  // Indica se o formulário está salvando
  const [saving, setSaving] = useState(false);


  // ---------------------------------------------------------
  // EXCLUSÃO
  // ---------------------------------------------------------

  // Guarda o ID do usuário que está sendo excluído.
  // Isso permite mostrar o ActivityIndicator somente naquele botão.
  const [deletingId, setDeletingId] = useState(null);


  // VERIFICAÇÃO DE ACESSO

  useEffect(() => {
    async function verifyAccess() {
      try {
        // Recupera a sessão armazenada no dispositivo
        const currentSession = await getSession();

        // Se não existir token, o usuário não está logado
        if (!currentSession?.token) {
          router.replace("/login");
          return;
        }

        // Somente administradores podem acessar esta tela
        if (currentSession.user?.role !== "admin") {
          Alert.alert(
            "Acesso restrito",
            "Essa área é só para administradores."
          );

          router.replace("/dashboard");
          return;
        }

        // Guarda a sessão para utilizar o token posteriormente
        setSession(currentSession);

      } catch (error) {

        // Caso aconteça algum erro ao recuperar a sessão
        console.error("Erro ao verificar acesso:", error);

        router.replace("/login");

      } finally {

        // Terminou a verificação
        setCheckingAccess(false);
      }
    }

    verifyAccess();
  }, []);


 
  // CARREGAR USUÁRIOS


  const loadUsers = useCallback(async (token) => {

    setLoadingUsers(true);
    setListError("");

    try {

      // Busca os usuários no backend
      const response = await listUsers(token);

      // Guarda a lista recebida
      setUsers(response.users || []);

    } catch (error) {

      console.error("Erro ao carregar usuários:", error);

      setListError(
        error?.message || "Não foi possível carregar os usuários."
      );

    } finally {

      setLoadingUsers(false);
    }

  }, []);


  // Sempre que a sessão estiver disponível,
  // carregamos os usuários.
  useEffect(() => {

    if (session?.token) {
      loadUsers(session.token);
    }

  }, [session, loadUsers]);


  // RESETAR FORMULÁRIO


  function resetForm() {

    setName("");
    setEmail("");
    setPassword("");
    setConfirmPassword("");
    setRole("user");
    setFormError("");
  }



  // CRIAR USUÁRIO


  async function handleCreateUser() {

    setFormError("");

    // Verifica campos obrigatórios
    if (!name.trim() || !email.trim() || !password || !confirmPassword) {
      setFormError("Preencha todos os campos.");
      return;
    }

    // Verifica tamanho mínimo da senha
    if (password.length < SENHA_MINIMA) {
      setFormError(
        `A senha precisa ter pelo menos ${SENHA_MINIMA} caracteres.`
      );
      return;
    }

    // Verifica confirmação da senha
    if (password !== confirmPassword) {
      setFormError("A confirmação precisa ser igual à senha.");
      return;
    }

    setSaving(true);

    try {

      // Envia os dados para o backend
      await createUser(session.token, {
        name: name.trim(),
        email: email.trim(),
        password,
        role,
      });

      // Limpa o formulário
      resetForm();

      // Fecha o formulário
      setFormOpen(false);

      // Atualiza a lista
      await loadUsers(session.token);

    } catch (error) {

      setFormError(
        error?.message || "Não foi possível criar o usuário."
      );

    } finally {

      setSaving(false);
    }
  }


  
  // CONFIRMAR EXCLUSÃO


  function confirmDelete(user) {

    Alert.alert(
      "Excluir usuário",

      `Tem certeza que quer excluir "${user.name}"? Essa ação não pode ser desfeita.`,

      [
        // Botão cancelar
        {
          text: "Cancelar",
          style: "cancel",
        },

        // Botão excluir
        {
          text: "Excluir",
          style: "destructive",

          // Só executa a exclusão depois da confirmação
          onPress: () => handleDelete(user.id),
        },
      ]
    );
  }



  // EXCLUIR USUÁRIO


  async function handleDelete(id) {

    // Impede múltiplas exclusões simultâneas
    setDeletingId(id);

    try {

      // Chama o backend para excluir o usuário
      await deleteUser(session.token, id);

      // Remove imediatamente da tela.
      //
      // Isso evita depender de uma nova requisição apenas
      // para atualizar visualmente a lista.
      setUsers((currentUsers) =>
        currentUsers.filter((user) => user.id !== id)
      );

    } catch (error) {

      console.error("Erro ao excluir usuário:", error);

      Alert.alert(
        "Erro ao excluir",
        error?.message || "Não foi possível excluir o usuário."
      );

    } finally {

      // Libera o botão novamente
      setDeletingId(null);
    }
  }


  // Enquanto verificamos o acesso,
  // não renderizamos a tela.
  if (checkingAccess) {
    return null;
  }



  // INTERFACE


  return (
    <AppBar>

      <PageHeader
        title="Gerenciar usuários"

        actions={
          <TouchableOpacity
            style={styles.newButton}

            onPress={() => {

              // Abre ou fecha o formulário
              setFormOpen((open) => !open);

              // Limpa mensagens de erro
              setFormError("");
            }}
          >
            <Text style={styles.newButtonText}>
              {formOpen ? "Cancelar" : "Novo usuário"}
            </Text>
          </TouchableOpacity>
        }
      />


      <ScrollView
        style={styles.space}
        contentContainerStyle={{
          paddingBottom: 30,
        }}
      >




        {formOpen && (

          <View style={styles.formCard}>

            <Text style={styles.formTitle}>
              Novo usuário
            </Text>


            <TextInput
              style={styles.input}
              placeholder="Nome"
              value={name}
              onChangeText={setName}
              autoCapitalize="words"
              editable={!saving}
            />


            <TextInput
              style={styles.input}
              placeholder="E-mail"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              editable={!saving}
            />


            <TextInput
              style={styles.input}
              placeholder="Senha (mínimo 8 caracteres)"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              editable={!saving}
            />


            <TextInput
              style={styles.input}
              placeholder="Confirmar senha"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry
              editable={!saving}
            />


            <Text style={styles.roleLabel}>
              Tipo de conta
            </Text>


            <View style={styles.roleToggle}>

              <TouchableOpacity
                style={[
                  styles.roleOption,
                  role === "user" && styles.roleOptionActive,
                ]}
                onPress={() => setRole("user")}
                disabled={saving}
              >
                <Text
                  style={[
                    styles.roleOptionText,
                    role === "user" &&
                      styles.roleOptionTextActive,
                  ]}
                >
                  Usuário
                </Text>
              </TouchableOpacity>


              <TouchableOpacity
                style={[
                  styles.roleOption,
                  role === "admin" && styles.roleOptionActive,
                ]}
                onPress={() => setRole("admin")}
                disabled={saving}
              >
                <Text
                  style={[
                    styles.roleOptionText,
                    role === "admin" &&
                      styles.roleOptionTextActive,
                  ]}
                >
                  Administrador
                </Text>
              </TouchableOpacity>

            </View>


            {!!formError && (
              <Text style={styles.errorText}>
                {formError}
              </Text>
            )}


            <TouchableOpacity
              style={[
                styles.saveButton,
                saving && styles.buttonDisabled,
              ]}
              onPress={handleCreateUser}
              disabled={saving}
            >

              {saving ? (

                <ActivityIndicator color="#ffffff" />

              ) : (

                <Text style={styles.saveButtonText}>
                  Salvar usuário
                </Text>

              )}

            </TouchableOpacity>

          </View>
        )}


        {/* 
            LISTA DE USUÁRIOS
    */}

        <View style={styles.listCard}>

          {/* Cabeçalho da tabela */}
          <View
            style={[
              styles.row,
              styles.rowHeader,
            ]}
          >

            <Text
              style={[
                styles.cell,
                styles.cellName,
                styles.headerText,
              ]}
            >
              Nome
            </Text>


            <Text
              style={[
                styles.cell,
                styles.cellEmail,
                styles.headerText,
              ]}
            >
              E-mail
            </Text>
            <Text
              style={[
                styles.cell,
                styles.cellRole,
                styles.headerText,
              ]}
            >
              Tipo
            </Text>


            <Text
              style={[
                styles.cell,
                styles.cellAction,
                styles.headerText,
              ]}
            />

          </View>


          {/* Carregando usuários */}
          {loadingUsers && (

            <View style={styles.centerBox}>
              <ActivityIndicator />
            </View>

          )}


          {/* Erro ao carregar */}
          {!loadingUsers && !!listError && (

            <View style={styles.centerBox}>
              <Text style={styles.errorText}>
                {listError}
              </Text>
            </View>

          )}


          {/* Lista vazia */}
          {!loadingUsers &&
            !listError &&
            users.length === 0 && (

              <View style={styles.centerBox}>
                <Text style={styles.emptyText}>
                  Nenhum usuário cadastrado ainda.
                </Text>
              </View>

            )}


          {/* Usuários */}
          {!loadingUsers &&
            !listError &&
            users.map((user) => {

              // Verifica se o usuário da linha
              // é o próprio administrador logado.
              const isSelf =
                user.id === session?.user?.id;


              return (

                <View
                  key={user.id}
                  style={styles.row}
                >

                  {/* Nome */}
                  <Text
                    style={[
                      styles.cell,
                      styles.cellName,
                    ]}
                    numberOfLines={1}
                  >
                    {user.name}
                  </Text>


                  {/* E-mail */}
                  <Text
                    style={[
                      styles.cell,
                      styles.cellEmail,
                    ]}
                    numberOfLines={1}
                  >
                    {user.email}
                  </Text>


                  {/* Tipo */}
                  <View
                    style={[
                      styles.cell,
                      styles.cellRole,
                    ]}
                  >

                    <Text
                      style={[
                        styles.roleBadge,

                        user.role === "admin"
                          ? styles.roleBadgeAdmin
                          : styles.roleBadgeUser,
                      ]}
                    >
                      {user.role === "admin"
                        ? "Administrador"
                        : "Usuário"}
                    </Text>

                  </View>


                  {/* Ação */}
                  <View
                    style={[
                      styles.cell,
                      styles.cellAction,
                    ]}
                  >

                    <TouchableOpacity
                      style={[
                        styles.deleteButton,

                        // Desabilita visualmente
                        // se for o próprio usuário.
                        isSelf &&
                          styles.buttonDisabled,
                      ]}

                      onPress={() =>
                        confirmDelete(user)
                      }

                      // Não permite excluir a própria conta
                      disabled={
                        isSelf ||
                        deletingId === user.id
                      }
                    >

                      {deletingId === user.id ? (

                        // Mostra carregamento enquanto o backend exclui
                        <ActivityIndicator
                          size="small"
                          color="#ed0000"
                        />

                      ) : (

                        <Text
                          style={
                            styles.deleteButtonText
                          }
                        >
                          {isSelf
                            ? "Você"
                            : "Excluir"}
                        </Text>

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

  roleLabel: {
    fontSize: 13,
    color: "#5f6368",
    marginTop: 4,
    marginBottom: 8,
  },
  roleToggle: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 16,
  },
  roleOption: {
    borderWidth: 1,
    borderColor: "#c9c9c9",
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 16,
    backgroundColor: "#ffffff",
  },

  roleOptionActive: {
    borderColor: "#ed0000",
    backgroundColor: "#fff0f0",
  },

  roleOptionText: {
    fontSize: 13,
    color: "#5f6368",
  },

  roleOptionTextActive: {
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
    fontSize: 14,
    color: "#202124",
  },

  cellName: {
    flex: 2,
    paddingRight: 8,
  },

  cellEmail: {
    flex: 3,
    paddingRight: 8,
    color: "#5f6368",
  },

  cellRole: {
    flex: 2,
  },

  cellAction: {
    flex: 1,
    alignItems: "flex-end",
  },

  roleBadge: {
    fontSize: 12,
    fontWeight: "600",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    overflow: "hidden",
    alignSelf: "flex-start",
  },
  roleBadgeAdmin: {
    backgroundColor: "#fde8e8",
    color: "#c62828",
  },

  roleBadgeUser: {
    backgroundColor: "#e8f0fe",
    color: "#1a56c4",
  },
  deleteButton: {
    borderWidth: 1,
    borderColor: "#ed0000",
    borderRadius: 4,
    paddingHorizontal: 10,
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