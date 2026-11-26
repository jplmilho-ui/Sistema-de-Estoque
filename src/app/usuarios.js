import React, { useCallback, useEffect, useState } from "react";
import {
  View,Text,TextInput,TouchableOpacity,StyleSheet,ScrollView,ActivityIndicator,Alert,Modal,} from "react-native";
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
  resetUserPassword,
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

  // ---------------------------------------------------------
  // REDEFINIR A SENHA DE OUTRA PESSOA (janela)
  // (a própria senha é trocada pelo ícone de perfil, no topo)
  // ---------------------------------------------------------

  const [senhaAlvo, setSenhaAlvo] = useState(null); // usuário que terá a senha trocada
  const [novaSenha, setNovaSenha] = useState("");
  const [confirmaNovaSenha, setConfirmaNovaSenha] = useState("");
  const [senhaError, setSenhaError] = useState("");
  const [senhaSaving, setSenhaSaving] = useState(false);
  const [senhaConcluida, setSenhaConcluida] = useState(null); // { nome }


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


  
  // REDEFINIR SENHA

  function openResetSenha(user) {
    setSenhaAlvo(user);
    setNovaSenha("");
    setConfirmaNovaSenha("");
    setSenhaError("");
    setSenhaConcluida(null);
  }

  function closeResetSenha() {
    if (senhaSaving) return; // não fecha no meio da requisição
    setSenhaAlvo(null);
    setSenhaConcluida(null);
  }

  async function handleSaveSenha() {
    if (!senhaAlvo) return;

    if (novaSenha.length < SENHA_MINIMA) {
      setSenhaError(`A nova senha precisa ter pelo menos ${SENHA_MINIMA} caracteres.`);
      return;
    }
    if (novaSenha !== confirmaNovaSenha) {
      setSenhaError("A confirmação não é igual à nova senha.");
      return;
    }

    setSenhaError("");
    setSenhaSaving(true);

    try {
      await resetUserPassword(session.token, senhaAlvo.id, { password: novaSenha });
      setSenhaConcluida({ nome: senhaAlvo.name });
    } catch (error) {
      setSenhaError(error?.message || "Não foi possível redefinir a senha.");
    } finally {
      setSenhaSaving(false);
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
              accessibilityRole="button"
              accessibilityLabel={formOpen ? "Cancelar criação de usuário" : "Novo usuário"}
              accessibilityHint="Abre ou fecha o formulário para cadastrar um novo usuário"
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
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
          <View style={styles.formCard} accessible={false}>
            <Text
              style={styles.formTitle}
              accessibilityRole="header"
              aria-level={2}
            >
              Novo usuário
            </Text>

            <TextInput
              style={styles.input}
              placeholder="Nome"
              value={name}
              onChangeText={setName}
              autoCapitalize="words"
              autoComplete="name"
              editable={!saving}
              accessible={true}
              accessibilityLabel="Nome completo"
              accessibilityHint="Digite o nome completo do novo usuário"
            />

            <TextInput
              style={styles.input}
              placeholder="E-mail"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              textContentType="emailAddress"
              editable={!saving}
              accessible={true}
              accessibilityLabel="E-mail"
              accessibilityHint="Digite o endereço de e-mail de acesso do usuário"
            />

            <TextInput
              style={styles.input}
              placeholder="Senha (mínimo 8 caracteres)"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoComplete="new-password"
              editable={!saving}
              accessible={true}
              accessibilityLabel="Senha"
              accessibilityHint="Digite uma senha com no mínimo 8 caracteres"
            />

            <TextInput
              style={styles.input}
              placeholder="Confirmar senha"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry
              autoComplete="new-password"
              editable={!saving}
              accessible={true}
              accessibilityLabel="Confirmar senha"
              accessibilityHint="Repita a senha digitada anteriormente"
            />

            <Text style={styles.roleLabel} nativeID="tipoContaLabel">Tipo de conta</Text>

            <View
              style={styles.roleToggle}
              accessibilityRole="radiogroup"
              aria-labelledby="tipoContaLabel"
            >
              {roleOptions.map((option) => (
                <TouchableOpacity
                  key={option.value}
                  style={[
                    styles.roleOption,
                    newUserRole === option.value && styles.roleOptionActive,
                  ]}
                  onPress={() => setNewUserRole(option.value)}
                  disabled={saving}
                  accessibilityRole="radio"
                  accessibilityLabel={`Tipo: ${option.label}`}
                  accessibilityState={{ selected: newUserRole === option.value }}
                  hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
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
                accessible={true}
                accessibilityLabel="RM do aluno"
                accessibilityHint={`Digite o registro de matrícula do aluno com até ${RM_MAXIMO} caracteres`}
              />
            )}

            {!!formError && (
              <Text
                style={styles.errorText}
                accessibilityRole="alert"
                accessibilityLiveRegion="assertive"
              >
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
              accessibilityRole="button"
              accessibilityLabel={saving ? "Salvando usuário..." : "Salvar usuário"}
              accessibilityHint="Cadastra o novo usuário no sistema"
              accessibilityState={{ busy: saving, disabled: saving }}
            >
              {saving ? (
                <ActivityIndicator color="#ffffff" accessibilityLabel="Salvando..." />
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
                accessibilityRole="button"
                accessibilityState={{ selected: ativo }}
                accessibilityLabel={`Filtro tipo: ${opcao.label}`}
                accessibilityHint="Filtra a lista de usuários pelo tipo selecionado"
                hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
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
            <Text
              style={styles.contagemText}
              accessibilityRole="summary"
              accessibilityLiveRegion="polite"
            >
              {temFiltroAtivo
                ? `${filteredUsers.length} de ${users.length} usuários`
                : `${users.length} ${users.length === 1 ? "usuário" : "usuários"}`}
            </Text>
          )}
        </View>

        {/* 
            LISTA DE USUÁRIOS
    */}

        <TabelaRolavel larguraMinima={950}>
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
                styles.cellRM,
                styles.headerText,
              ]}
            >
              RM
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
              <ActivityIndicator accessibilityLabel="Carregando lista de usuários..." />
            </View>
          )}

          {/* Erro ao carregar */}
          {!loadingUsers && !!listError && (
            <View style={styles.centerBox}>
              <Text
                style={styles.errorText}
                accessibilityRole="alert"
                accessibilityLiveRegion="assertive"
              >
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
              const isSelf = user.id === session?.user?.id;

              const semPermissaoParaExcluir =
                session?.user?.role === "coordenador" &&
                ["coordenador", "admin"].includes(user.role);

              // Redefinir a senha de OUTRA pessoa: mesma regra de hierarquia da
              // exclusão (o backend confere). A própria senha é trocada no perfil.
              const podeRedefinirSenha = !isSelf && !semPermissaoParaExcluir;

              return (
                <View
                  key={user.id}
                  style={styles.row}
                  accessible={true}
                  accessibilityLabel={`Usuário ${user.name}, RM: ${user.rm || "não possui"}, Email: ${user.email}, Tipo: ${getRoleInfo(user.role).label}`}
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

                  {/* RM (só aluno tem; os demais mostram "—") */}
                  <Text
                    style={[
                      styles.cell,
                      styles.cellRM,
                    ]}
                    numberOfLines={1}
                  >
                    {user.rm || "—"}
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

                  {/* Ações */}
                  <View
                    style={[
                      styles.cell,
                      styles.cellAction,
                    ]}
                  >
                    {/* Redefinir senha */}
                    <TouchableOpacity
                      style={[
                        styles.acaoButton,
                        styles.acaoNeutra,
                        !podeRedefinirSenha && styles.buttonDisabled,
                      ]}
                      onPress={() => openResetSenha(user)}
                      disabled={!podeRedefinirSenha}
                      accessibilityRole="button"
                      accessibilityLabel={`Redefinir senha de ${user.name}`}
                      accessibilityHint="Abre o diálogo para redefinir a senha deste usuário"
                      hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                    >
                      <Text style={[styles.acaoButtonText, styles.acaoNeutraText]}>
                        Senha
                      </Text>
                    </TouchableOpacity>

                    {/* Excluir */}
                    <TouchableOpacity
                      style={[
                        styles.deleteButton,
                        (isSelf || semPermissaoParaExcluir) && styles.buttonDisabled,
                      ]}
                      onPress={() => confirmDelete(user)}
                      disabled={
                        isSelf ||
                        semPermissaoParaExcluir ||
                        deletingId === user.id
                      }
                      accessibilityRole="button"
                      accessibilityLabel={
                        isSelf
                          ? "Sua própria conta (não pode ser excluída)"
                          : `Excluir usuário ${user.name}`
                      }
                      accessibilityHint={isSelf ? "" : "Solicita confirmação para excluir este usuário"}
                      hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                    >
                      {deletingId === user.id ? (
                        <ActivityIndicator
                          size="small"
                          color="#c62828"
                          accessibilityLabel={`Excluindo ${user.name}...`}
                        />
                      ) : (
                        <Text style={styles.deleteButtonText}>
                          {isSelf ? "Você" : "Excluir"}
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

      {/* REDEFINIR SENHA */}
      <Modal
        visible={!!senhaAlvo}
        transparent
        animationType="fade"
        onRequestClose={closeResetSenha}
        accessibilityViewIsModal={true}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard} accessible={false}>
            {senhaConcluida ? (
              <>
                <Text
                  style={styles.formTitle}
                  accessibilityRole="header"
                  aria-level={2}
                >
                  Senha redefinida
                </Text>
                <Text
                  style={styles.modalText}
                  accessibilityRole="alert"
                  accessibilityLiveRegion="polite"
                >
                  {`A senha de ${senhaConcluida.nome} foi redefinida. Passe a nova senha para a pessoa. Os logins antigos dela foram encerrados.`}
                </Text>
                <View style={styles.modalActions}>
                  <TouchableOpacity
                    style={[styles.saveButton, styles.modalSaveButton]}
                    onPress={closeResetSenha}
                    accessibilityRole="button"
                    accessibilityLabel="Fechar janela"
                    accessibilityHint="Fecha este aviso de senha redefinida"
                  >
                    <Text style={styles.saveButtonText}>Fechar</Text>
                  </TouchableOpacity>
                </View>
              </>
            ) : (
              <>
                <Text
                  style={styles.formTitle}
                  accessibilityRole="header"
                  aria-level={2}
                >
                  Redefinir senha
                </Text>
                <Text style={styles.modalText}>
                  Usuário: {senhaAlvo?.name}
                </Text>

                <TextInput
                  style={styles.input}
                  placeholder={`Nova senha (mínimo ${SENHA_MINIMA} caracteres)`}
                  value={novaSenha}
                  onChangeText={(t) => {
                    setNovaSenha(t);
                    if (senhaError) setSenhaError("");
                  }}
                  secureTextEntry
                  autoCapitalize="none"
                  autoComplete="new-password"
                  editable={!senhaSaving}
                  accessible={true}
                  accessibilityLabel="Nova senha"
                  accessibilityHint={`Digite a nova senha com pelo menos ${SENHA_MINIMA} caracteres`}
                />

                <TextInput
                  style={styles.input}
                  placeholder="Repita a nova senha"
                  value={confirmaNovaSenha}
                  onChangeText={(t) => {
                    setConfirmaNovaSenha(t);
                    if (senhaError) setSenhaError("");
                  }}
                  secureTextEntry
                  autoCapitalize="none"
                  autoComplete="new-password"
                  editable={!senhaSaving}
                  onSubmitEditing={handleSaveSenha}
                  accessible={true}
                  accessibilityLabel="Confirmar nova senha"
                  accessibilityHint="Digite a mesma nova senha para confirmação"
                />

                {!!senhaError && (
                  <Text
                    style={styles.errorText}
                    accessibilityRole="alert"
                    accessibilityLiveRegion="assertive"
                  >
                    {senhaError}
                  </Text>
                )}

                <View style={styles.modalActions}>
                  <TouchableOpacity
                    style={styles.modalCancelButton}
                    onPress={closeResetSenha}
                    disabled={senhaSaving}
                    accessibilityRole="button"
                    accessibilityLabel="Cancelar redefinição"
                    accessibilityHint="Descarta as alterações e fecha a janela"
                    hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                  >
                    <Text style={styles.modalCancelText}>Cancelar</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.saveButton,
                      styles.modalSaveButton,
                      senhaSaving && styles.buttonDisabled,
                    ]}
                    onPress={handleSaveSenha}
                    disabled={senhaSaving}
                    accessibilityRole="button"
                    accessibilityLabel={senhaSaving ? "Salvando nova senha..." : "Salvar nova senha"}
                    accessibilityHint="Confirma e salva a nova senha para o usuário"
                    accessibilityState={{ busy: senhaSaving, disabled: senhaSaving }}
                  >
                    {senhaSaving ? (
                      <ActivityIndicator color="#ffffff" accessibilityLabel="Salvando..." />
                    ) : (
                      <Text style={styles.saveButtonText}>Salvar senha</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </>
            )}
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
    color: "#5f6368",
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

  // RM: logo depois do nome (largura fixa mínima, o RM tem até 5 caracteres)
  cellRM: {
    flex: 1,
    minWidth: 70,
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

  // dois botões lado a lado: Senha | Excluir
  cellAction: {
    flex: 3,
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "center",
    gap: 8,
  },

  acaoButton: {
    borderWidth: 1,
    borderRadius: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    minWidth: 64,
    alignItems: "center",
  },
  acaoButtonText: {
    fontSize: 14,
    fontWeight: "600",
  },
  acaoNeutra: { borderColor: "#5f6368" },
  acaoNeutraText: { color: "#3c4043" },
  // janela de redefinir senha
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
    maxWidth: 380,
  },
  modalText: {
    fontSize: 16,
    color: "#3c4043",
    marginBottom: 14,
  },
  modalActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "center",
    gap: 10,
    marginTop: 4,
  },
  modalCancelButton: {
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  modalCancelText: {
    fontSize: 17,
    color: "#5f6368",
    fontWeight: "500",
  },
  modalSaveButton: {
    paddingHorizontal: 18,
    minHeight: 44,
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