import React, { useCallback, useEffect, useState } from "react";
import {
  View,Text,TextInput,TouchableOpacity,StyleSheet,ScrollView,ActivityIndicator,Alert,} from "react-native";
import { router } from "expo-router";

import AppBar from "../components/AppBar";
import TabelaRolavel from "../components/TabelaRolavel";
import PageHeader from "../components/PageHeader";
import SearchBox from "../components/SearchBox";
import { confirmAction } from "../utils/confirmAction";


import { getSession } from "../services/authStorage";


import {
  listUsers,
  createUser,
  deleteUser,
} from "../services/usersApi";


const SENHA_MINIMA = 8;
const RM_MAXIMO = 5; // o RM do aluno tem no máximo 5 caracteres
const EMAIL_MINIMO = 8;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Rótulo e estilo exibidos na coluna "Tipo" pra cada papel possível.
// Hierarquia: Admin > Coordenador > Professor > Aluno.
const ROLE_INFO = {
  admin: { label: "Admin", style: "roleBadgeSuperAdmin" },
  coordenador: { label: "Coordenador", style: "roleBadgeAdmin" },
  professor: { label: "Professor", style: "roleBadgeProfessor" },
  aluno: { label: "Aluno", style: "roleBadgeAluno" },
};

function getRoleInfo(role) {
  return ROLE_INFO[role] || { label: role, style: "roleBadgeUser" };
}

// Quais papéis aparecem no formulário de criação, dependendo de quem
// está logado. Admin pode criar coordenador também; coordenador não.
const ROLE_OPTIONS_BY_CREATOR = {
  admin: [
    { value: "coordenador", label: "Coordenador" },
    { value: "professor", label: "Professor" },
    { value: "aluno", label: "Aluno" },
  ],
  coordenador: [
    { value: "professor", label: "Professor" },
    { value: "aluno", label: "Aluno" },
  ],
};


// Opções do filtro por tipo de conta (além da pesquisa por texto).
const FILTROS_TIPO = [
  { key: "todos", label: "Todos" },
  { key: "admin", label: "Admin" },
  { key: "coordenador", label: "Coordenador" },
  { key: "professor", label: "Professor" },
  { key: "aluno", label: "Aluno" },
];

// Tira acentos e maiúsculas pra pesquisa achar "joao" em "João".
function normalizar(texto) {
  return String(texto ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

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

  // Pesquisa (nome, e-mail, RM ou tipo) e filtro por tipo de conta
  const [searchTerm, setSearchTerm] = useState("");
  const [tipoFiltro, setTipoFiltro] = useState("todos");


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

  // Tipo de conta a criar (as opções dependem de quem está logado —
  // ver ROLE_OPTIONS_BY_CREATOR) e RM (só usado quando role === "aluno")
  const [newUserRole, setNewUserRole] = useState("");
  const [rm, setRm] = useState("");

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
          router.replace("/");
          return;
        }

        // Admin e coordenador podem acessar esta tela
        // Aluno só usa a tela de Solicitações.
        if (currentSession.user?.role === "aluno") {
          router.replace("/solicitacoes");
          return;
        }

        if (!["admin", "coordenador"].includes(currentSession.user?.role)) {
          Alert.alert(
            "Acesso restrito",
            "Essa área é só para administradores e coordenadores."
          );

          router.replace("/tela_inicial");
          return;
        }

        // Guarda a sessão para utilizar o token posteriormente
        setSession(currentSession);

      } catch (error) {

        // Caso aconteça algum erro ao recuperar a sessão
        console.error("Erro ao verificar acesso:", error);

        router.replace("/");

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

  // Papéis que a pessoa logada tem permissão de criar, e o valor
  // padrão selecionado no formulário (o primeiro da lista).
  const roleOptions = ROLE_OPTIONS_BY_CREATOR[session?.user?.role] || [];

  useEffect(() => {
    if (session && !newUserRole && roleOptions.length > 0) {
      setNewUserRole(roleOptions[0].value);
    }
  }, [session, roleOptions, newUserRole]);


  // RESETAR FORMULÁRIO


  function resetForm() {

    setName("");
    setEmail("");
    setPassword("");
    setConfirmPassword("");
    setRm("");
    setNewUserRole(roleOptions[0]?.value || "");
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

    // Verifica tamanho mínimo e formato do e-mail
    if (email.trim().length < EMAIL_MINIMO) {
      setFormError(`O e-mail precisa ter pelo menos ${EMAIL_MINIMO} caracteres.`);
      return;
    }
    if (!EMAIL_REGEX.test(email.trim())) {
      setFormError("Informe um e-mail válido.");
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

    // Verifica se um tipo de conta válido foi escolhido
    if (!newUserRole || !roleOptions.some((opt) => opt.value === newUserRole)) {
      setFormError("Escolha o tipo de conta.");
      return;
    }

    // Aluno precisa de RM
    if (newUserRole === "aluno" && !rm.trim()) {
      setFormError("Informe o RM do aluno.");
      return;
    }
    if (newUserRole === "aluno" && rm.trim().length > RM_MAXIMO) {
      setFormError(`O RM do aluno pode ter no máximo ${RM_MAXIMO} caracteres.`);
      return;
    }

    setSaving(true);

    try {

      // Envia os dados para o backend — o backend confere de novo se
      // quem está logado pode mesmo criar esse tipo de conta.
      await createUser(session.token, {
        name: name.trim(),
        email: email.trim(),
        password,
        role: newUserRole,
        rm: newUserRole === "aluno" ? rm.trim() : undefined,
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
  confirmAction({
    title: "Excluir usuário",
    message: `Tem certeza que quer excluir "${user.name}"? Essa ação não pode ser desfeita.`,
    confirmText: "Excluir",
    onConfirm: () => handleDelete(user.id),
  });
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

  // PESQUISA E FILTRO
  //
  // A pesquisa procura em nome, e-mail, RM e no nome do tipo (ex: digitar
  // "coord" acha os coordenadores), sem diferenciar acento nem maiúscula.
  // O filtro por tipo vale junto com a pesquisa.
  const termo = normalizar(searchTerm.trim());

  const filteredUsers = users.filter((user) => {
    if (tipoFiltro !== "todos" && user.role !== tipoFiltro) {
      return false;
    }
    if (!termo) {
      return true;
    }
    return [user.name, user.email, user.rm, getRoleInfo(user.role).label].some(
      (campo) => normalizar(campo).includes(termo)
    );
  });

  const temFiltroAtivo = !!termo || tipoFiltro !== "todos";



  // INTERFACE


  return (
    <AppBar>

      <PageHeader
        title="Usuários"
        subtitle="Gerencie as contas de acesso ao sistema."

        actions={
          <>
            <SearchBox
              value={searchTerm}
              onChangeText={setSearchTerm}
              placeholder="Buscar nome, e-mail ou RM..."
            />

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
          </>
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


            <Text style={styles.roleLabel}>Tipo de conta</Text>

            <View style={styles.roleToggle}>
              {roleOptions.map((option) => (
                <TouchableOpacity
                  key={option.value}
                  style={[
                    styles.roleOption,
                    newUserRole === option.value && styles.roleOptionActive,
                  ]}
                  onPress={() => setNewUserRole(option.value)}
                  disabled={saving}
                >
                  <Text
                    style={[
                      styles.roleOptionText,
                      newUserRole === option.value && styles.roleOptionTextActive,
                    ]}
                  >
                    {option.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {newUserRole === "aluno" && (
              <TextInput
                style={styles.input}
                placeholder={`RM do aluno (máx. ${RM_MAXIMO} caracteres)`}
                value={rm}
                onChangeText={setRm}
                maxLength={RM_MAXIMO}
                editable={!saving}
              />
            )}


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


        {/* Filtro por tipo de conta */}
        <View style={styles.tipoRow}>
          <Text style={styles.tipoLabel}>Tipo:</Text>
          {FILTROS_TIPO.map((opcao) => {
            const ativo = tipoFiltro === opcao.key;
            return (
              <TouchableOpacity
                key={opcao.key}
                style={[styles.tipoChip, ativo && styles.tipoChipActive]}
                onPress={() => setTipoFiltro(opcao.key)}
              >
                <Text
                  style={[styles.tipoChipText, ativo && styles.tipoChipTextActive]}
                >
                  {opcao.label}
                </Text>
              </TouchableOpacity>
            );
          })}

          {!loadingUsers && !listError && users.length > 0 && (
            <Text style={styles.contagemText}>
              {temFiltroAtivo
                ? `${filteredUsers.length} de ${users.length} usuários`
                : `${users.length} ${users.length === 1 ? "usuário" : "usuários"}`}
            </Text>
          )}
        </View>

        {/* 
            LISTA DE USUÁRIOS
    */}

        <TabelaRolavel larguraMinima={820}>
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


          {/* Pesquisa/filtro sem resultado */}
          {!loadingUsers &&
            !listError &&
            users.length > 0 &&
            filteredUsers.length === 0 && (

              <View style={styles.centerBox}>
                <Text style={styles.emptyText}>
                  {searchTerm.trim()
                    ? `Nenhum usuário encontrado para "${searchTerm.trim()}".`
                    : "Nenhum usuário desse tipo."}
                </Text>
              </View>

            )}


          {/* Usuários */}
          {!loadingUsers &&
            !listError &&
            filteredUsers.map((user) => {

              // Verifica se o usuário da linha
              // é o próprio administrador logado.
              const isSelf =
                user.id === session?.user?.id;

              // Coordenador não pode excluir outro coordenador nem o
              // admin — só o admin tem esse alcance.
              // (O backend também barra isso; aqui é só pra nem
              // mostrar o botão como clicável nesses casos.)
              const semPermissaoParaExcluir =
                session?.user?.role === "coordenador" &&
                ["coordenador", "admin"].includes(user.role);


              return (

                <View
                  key={user.id}
                  style={styles.row}
                >

                  {/* Nome (e RM, se for aluno) */}
                  <Text
                    style={[
                      styles.cell,
                      styles.cellName,
                    ]}
                    numberOfLines={1}
                  >
                    {user.name}
                    {user.rm ? ` (RM ${user.rm})` : ""}
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
                        styles[getRoleInfo(user.role).style],
                      ]}
                    >
                      {getRoleInfo(user.role).label}
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
                        // se for o próprio usuário
                        // ou se não tiver permissão.
                        (isSelf || semPermissaoParaExcluir) &&
                          styles.buttonDisabled,
                      ]}

                      onPress={() =>
                        confirmDelete(user)
                      }

                      // Não permite excluir a própria conta
                      // nem quem está fora do alcance da hierarquia.
                      disabled={
                        isSelf ||
                        semPermissaoParaExcluir ||
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
        </TabelaRolavel>

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
    fontSize: 15,
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
    fontSize: 18,
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
    fontSize: 17,
    color: "#202124",
    marginBottom: 10,
    backgroundColor: "#ffffff",
  },

  roleLabel: {
    fontSize: 15,
    color: "#5f6368",
    marginTop: 4,
    marginBottom: 8,
  },
  roleToggle: {
    flexDirection: "row",
    flexWrap: "wrap",
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
    fontSize: 15,
    color: "#5f6368",
  },
  roleOptionTextActive: {
    color: "#ed0000",
    fontWeight: "600",
  },

  // Filtro por tipo de conta
  tipoRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 14,
  },
  tipoLabel: {
    fontSize: 15,
    color: "#5f6368",
    marginRight: 4,
  },
  tipoChip: {
    borderWidth: 1,
    borderColor: "#c9c9c9",
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 6,
    backgroundColor: "#ffffff",
  },
  tipoChipActive: {
    borderColor: "#1B4A3B",
    backgroundColor: "#1B4A3B",
  },
  tipoChipText: {
    fontSize: 15,
    color: "#5f6368",
  },
  tipoChipTextActive: {
    color: "#ffffff",
    fontWeight: "600",
  },
  contagemText: {
    fontSize: 14,
    color: "#80868b",
    marginLeft: "auto",
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
    fontSize: 17,
    fontWeight: "500",
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  errorText: {
    color: "#c62828",
    fontSize: 15,
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
    fontSize: 14,
    fontWeight: "600",
    color: "#5f6368",
    textTransform: "uppercase",
  },
  cell: {
    fontSize: 16,
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
    fontSize: 14,
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

  roleBadgeSuperAdmin: {
    backgroundColor: "#f3e8fd",
    color: "#6a1b9a",
  },

  roleBadgeProfessor: {
    backgroundColor: "#e6f4ea",
    color: "#1b4a3b",
  },

  roleBadgeAluno: {
    backgroundColor: "#fff4e0",
    color: "#8a5a00",
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
    fontSize: 14,
    color: "#ed0000",
    fontWeight: "600",
  },
  centerBox: {
    paddingVertical: 24,
    alignItems: "center",
  },
  emptyText: {
    color: "#5f6368",
    fontSize: 16,
  },
});