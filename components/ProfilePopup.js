// Pop-up de perfil (ícone de pessoa na barra superior):
//   - abre no CENTRO da tela (centralizado pelo próprio layout, sem conta de
//     pixels) e é RESPONSIVO: ocupa 95% da largura em telas pequenas, até o
//     máximo de 660 px em telas grandes; se o conteúdo for mais alto que a
//     tela, a área do cartão rola
//   - mostra quem é a pessoa (iniciais, nome, tipo de conta, e-mail, RM)
//   - permite trocar o NOME e a SENHA da própria conta
//   - mesmo visual do pop-up de notificações: cabeçalho verde-escuro com
//     "X", clicar fora fecha, botões vermelhos como nos formulários
//   - ao trocar a senha, os logins antigos caem (inclusive este): o app leva
//     a pessoa de volta ao login para entrar com a senha nova
import { useEffect, useState } from "react";
import {
  View,
  Text,
  TextInput,
  Modal,
  Pressable,
  ScrollView,
  ActivityIndicator,
  StyleSheet,
} from "react-native";
import { router } from "expo-router";
import Icon from "./Icon";
import { changeOwnPassword, updateProfile } from "../services/authApi";
import { clearSession, saveSession } from "../services/authStorage";

const SENHA_MINIMA = 8;
const NOME_MINIMO = 2;

// Mesmos rótulos e cores da coluna "Tipo" da tela de Usuários.
const PERFIS = {
  admin: { label: "Admin", bg: "#f3e8fd", color: "#6a1b9a" },
  coordenador: { label: "Coordenador", bg: "#fde8e8", color: "#c62828" },
  professor: { label: "Professor", bg: "#e6f4ea", color: "#1b4a3b" },
  aluno: { label: "Aluno", bg: "#fff4e0", color: "#8a5a00" },
};

// "Ana Maria Lima" -> "AL"
function iniciais(nome) {
  const partes = String(nome || "").trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return "?";
  const primeira = partes[0][0];
  const ultima = partes.length > 1 ? partes[partes.length - 1][0] : "";
  return (primeira + ultima).toUpperCase();
}

function limparNome(texto) {
  return texto.trim().replace(/\s+/g, " ");
}

function Mensagem({ mensagem }) {
  if (!mensagem) return null;
  return (
    <Text style={[styles.mensagem, mensagem.tipo === "ok" ? styles.mensagemOk : styles.mensagemErro]}>
      {mensagem.texto}
    </Text>
  );
}

export default function ProfilePopup({ visible, onClose, token, user, onUserChange }) {
  // --- nome ---
  const [nome, setNome] = useState("");
  const [nomeMsg, setNomeMsg] = useState(null); // { tipo: "ok" | "erro", texto }
  const [nomeSaving, setNomeSaving] = useState(false);

  // --- senha ---
  const [senhaAtual, setSenhaAtual] = useState("");
  const [novaSenha, setNovaSenha] = useState("");
  const [confirmaSenha, setConfirmaSenha] = useState("");
  const [senhaMsg, setSenhaMsg] = useState(null);
  const [senhaSaving, setSenhaSaving] = useState(false);
  const [senhaConcluida, setSenhaConcluida] = useState(false);

  // Cada vez que abre, começa do zero (e com o nome atual).
  useEffect(() => {
    if (!visible) return;
    setNome(user?.name || "");
    setNomeMsg(null);
    setSenhaAtual("");
    setNovaSenha("");
    setConfirmaSenha("");
    setSenhaMsg(null);
    setSenhaConcluida(false);
    // só quando abre/fecha; trocar o nome com o pop-up aberto não deve limpar os campos
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const perfil = PERFIS[user?.role] || { label: user?.role || "", bg: "#eeeeee", color: "#3c4043" };
  const nomeAlterado = limparNome(nome) !== (user?.name || "");

  async function irParaLogin() {
    await clearSession();
    onClose();
    router.replace("/");
  }

  function fechar() {
    // A senha mudou: este login não vale mais, então fechar = ir pro login.
    if (senhaConcluida) {
      irParaLogin();
      return;
    }
    if (nomeSaving || senhaSaving) return; // não fecha no meio de uma requisição
    onClose();
  }

  async function handleSalvarNome() {
    if (nomeSaving) return;

    const novo = limparNome(nome);
    if (novo.length < NOME_MINIMO) {
      setNomeMsg({ tipo: "erro", texto: `Informe o seu nome (pelo menos ${NOME_MINIMO} letras).` });
      return;
    }

    setNomeMsg(null);
    setNomeSaving(true);

    try {
      const { user: atualizado } = await updateProfile(token, { name: novo });

      // guarda no aparelho para o resto do app já enxergar o nome novo
      const novoUser = { ...user, ...atualizado };
      await saveSession(token, novoUser);
      onUserChange?.(novoUser);

      setNome(atualizado.name);
      setNomeMsg({ tipo: "ok", texto: "Nome atualizado." });
    } catch (error) {
      setNomeMsg({ tipo: "erro", texto: error?.message || "Não foi possível salvar o nome." });
    } finally {
      setNomeSaving(false);
    }
  }

  async function handleAlterarSenha() {
    if (senhaSaving) return;

    if (!senhaAtual) {
      setSenhaMsg({ tipo: "erro", texto: "Informe a sua senha atual." });
      return;
    }
    if (novaSenha.length < SENHA_MINIMA) {
      setSenhaMsg({ tipo: "erro", texto: `A nova senha precisa ter pelo menos ${SENHA_MINIMA} caracteres.` });
      return;
    }
    if (novaSenha !== confirmaSenha) {
      setSenhaMsg({ tipo: "erro", texto: "A confirmação não é igual à nova senha." });
      return;
    }
    if (novaSenha === senhaAtual) {
      setSenhaMsg({ tipo: "erro", texto: "A nova senha precisa ser diferente da atual." });
      return;
    }

    setSenhaMsg(null);
    setSenhaSaving(true);

    try {
      await changeOwnPassword(token, { senhaAtual, password: novaSenha });
      setSenhaConcluida(true);
    } catch (error) {
      setSenhaMsg({ tipo: "erro", texto: error?.message || "Não foi possível alterar a senha." });
    } finally {
      setSenhaSaving(false);
    }
  }

  function limparMensagemSenha() {
    if (senhaMsg) setSenhaMsg(null);
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={fechar}>
      {/* fundo escurecido: centraliza o cartão na tela */}
      <View style={styles.backdrop}>
        {/* camada atrás do cartão: clicar fora dele fecha o pop-up */}
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={fechar}
          accessibilityLabel="Fechar perfil"
        />

        <View style={styles.card}>
          {/* Cabeçalho */}
          <View style={styles.header}>
            <Text style={styles.title}>Meu perfil</Text>
            <Pressable
              onPress={fechar}
              accessibilityLabel="Fechar perfil"
              style={({ hovered }) => [styles.closeButton, hovered && styles.closeButtonHover]}
            >
              <Icon name="x" size={16} color="#ffffff" />
            </Pressable>
          </View>

          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.body}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.conteudo}>
            {senhaConcluida ? (
              // Senha trocada: só resta entrar de novo com a senha nova.
              <View style={styles.concluidaBox}>
                <View style={styles.concluidaIcone}>
                  <Icon name="check-circle" size={30} color="#1b6b3a" />
                </View>
                <Text style={styles.sectionTitle}>Senha alterada</Text>
                <Text style={styles.concluidaTexto}>
                  Por segurança, você foi desconectado. Entre novamente com a sua nova senha.
                </Text>
                <Pressable style={styles.primaryButton} onPress={irParaLogin}>
                  <Text style={styles.primaryButtonText}>Ir para o login</Text>
                </Pressable>
              </View>
            ) : (
              <>
                {/* Quem sou eu */}
                <View style={styles.identity}>
                  <View style={styles.avatarGrande}>
                    <Text style={styles.avatarGrandeText}>{iniciais(user?.name)}</Text>
                  </View>
                  <View style={styles.identityInfo}>
                    <Text style={styles.identityName} numberOfLines={2}>
                      {user?.name}
                    </Text>
                    <Text style={[styles.badge, { backgroundColor: perfil.bg, color: perfil.color }]}>
                      {perfil.label}
                    </Text>
                    <Text style={styles.identityDetail} numberOfLines={1}>
                      {user?.email}
                    </Text>
                    {!!user?.rm && <Text style={styles.identityDetail}>RM: {user.rm}</Text>}
                  </View>
                </View>

                <View style={styles.sections}>
                  {/* Dados pessoais (logo abaixo de quem sou eu) */}
                  <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Dados pessoais</Text>

                    <Text style={styles.label}>Nome</Text>
                    <TextInput
                      style={styles.input}
                      value={nome}
                      onChangeText={(texto) => {
                        setNome(texto);
                        if (nomeMsg) setNomeMsg(null);
                      }}
                      placeholder="Seu nome"
                      editable={!nomeSaving}
                      maxLength={100}
                      onSubmitEditing={handleSalvarNome}
                      returnKeyType="done"
                    />

                    <Mensagem mensagem={nomeMsg} />

                    <Pressable
                      style={[styles.primaryButton, (!nomeAlterado || nomeSaving) && styles.buttonDisabled]}
                      onPress={handleSalvarNome}
                      disabled={!nomeAlterado || nomeSaving}
                    >
                      {nomeSaving ? (
                        <ActivityIndicator color="#ffffff" />
                      ) : (
                        <Text style={styles.primaryButtonText}>Salvar nome</Text>
                      )}
                    </Pressable>

                    <Text style={styles.ajuda}>
                      O e-mail e o tipo de conta só podem ser alterados pela coordenação.
                    </Text>
                  </View>

                  {/* Senha */}
                  <View style={[styles.section, styles.sectionDivider]}>
                    <Text style={styles.sectionTitle}>Alterar senha</Text>

                    <Text style={styles.label}>Senha atual</Text>
                    <TextInput
                      style={styles.input}
                      value={senhaAtual}
                      onChangeText={(texto) => {
                        setSenhaAtual(texto);
                        limparMensagemSenha();
                      }}
                      secureTextEntry
                      autoCapitalize="none"
                      editable={!senhaSaving}
                    />

                    <Text style={styles.label}>Nova senha</Text>
                    <TextInput
                      style={styles.input}
                      value={novaSenha}
                      onChangeText={(texto) => {
                        setNovaSenha(texto);
                        limparMensagemSenha();
                      }}
                      placeholder={`Mínimo ${SENHA_MINIMA} caracteres`}
                      secureTextEntry
                      autoCapitalize="none"
                      editable={!senhaSaving}
                    />

                    <Text style={styles.label}>Repita a nova senha</Text>
                    <TextInput
                      style={styles.input}
                      value={confirmaSenha}
                      onChangeText={(texto) => {
                        setConfirmaSenha(texto);
                        limparMensagemSenha();
                      }}
                      secureTextEntry
                      autoCapitalize="none"
                      editable={!senhaSaving}
                      onSubmitEditing={handleAlterarSenha}
                      returnKeyType="done"
                    />

                    <Mensagem mensagem={senhaMsg} />

                    <Pressable
                      style={[styles.primaryButton, senhaSaving && styles.buttonDisabled]}
                      onPress={handleAlterarSenha}
                      disabled={senhaSaving}
                    >
                      {senhaSaving ? (
                        <ActivityIndicator color="#ffffff" />
                      ) : (
                        <Text style={styles.primaryButtonText}>Alterar senha</Text>
                      )}
                    </Pressable>

                    <Text style={styles.ajuda}>
                      Depois de alterar, você precisará entrar de novo com a senha nova.
                    </Text>
                  </View>
                </View>
              </>
            )}
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  // fundo escurecido que também centraliza o cartão (horizontal e vertical)
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0, 0, 0, 0.35)",
    justifyContent: "center",
    alignItems: "center",
  },

  // responsivo: 95% da largura em tela pequena, no máximo 660 px em tela grande.
  // maxHeight: nunca passa da tela; se o conteúdo for maior, o ScrollView rola.
  card: {
    width: "95%",
    maxWidth: 660,
    maxHeight: "92%",
    backgroundColor: "#ffffff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e0e0e0",
    overflow: "hidden",
    boxShadow: "0px 8px 24px rgba(0, 0, 0, 0.22)",
    elevation: 12,
  },

  // cabeçalho (igual ao do pop-up de notificações)
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingLeft: 16,
    paddingRight: 8,
    paddingVertical: 10,
    backgroundColor: "#1B4A3B",
  },
  title: {
    fontSize: 18,
    fontWeight: "600",
    color: "#ffffff",
  },
  closeButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  closeButtonHover: {
    backgroundColor: "rgba(255, 255, 255, 0.14)",
  },

  // área rolável (encolhe para caber no cartão e rola quando falta espaço)
  scroll: {
    flexShrink: 1,
  },
  body: {
    padding: 20,
  },

  conteudo: {
    width: "100%",
    maxWidth: 360,
    alignSelf: "center",
    gap: 22,
  },

  // quem sou eu
  identity: {
    flexDirection: "row",
    alignItems: "center",
    gap: 20,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#eeeeee",
  },
  avatarGrande: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: "#2D7A5F",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarGrandeText: {
    color: "#ffffff",
    fontSize: 30,
    fontWeight: "700",
  },
  identityInfo: {
    flex: 1,
    gap: 6,
  },
  identityName: {
    fontSize: 24,
    fontWeight: "600",
    color: "#202124",
  },
  identityDetail: {
    fontSize: 17,
    color: "#5f6368",
  },
  badge: {
    fontSize: 15,
    fontWeight: "600",
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 20,
    overflow: "hidden",
    alignSelf: "flex-start",
  },

  // seções empilhadas: Dados pessoais primeiro, Alterar senha depois
  sections: {
    gap: 24,
  },
  section: {
    width: "100%",
  },
  sectionDivider: {
    paddingTop: 24,
    borderTopWidth: 1,
    borderTopColor: "#eeeeee",
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "600",
    color: "#202124",
    marginBottom: 16,
  },
  label: {
    fontSize: 15,
    fontWeight: "600",
    color: "#5f6368",
    marginBottom: 4,
  },
  input: {
    borderWidth: 1,
    borderColor: "#c9c9c9",
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 14,
    fontSize: 18,
    color: "#202124",
    marginBottom: 14,
    backgroundColor: "#ffffff",
  },
  ajuda: {
    fontSize: 14,
    color: "#5f6368",
    marginTop: 10,
  },
  mensagem: {
    fontSize: 15,
    marginBottom: 12,
  },
  mensagemOk: { color: "#1b6b3a" },
  mensagemErro: { color: "#c62828" },

  primaryButton: {
    backgroundColor: "#ed0000",
    borderRadius: 6,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 46,
  },
  primaryButtonText: {
    color: "#ffffff",
    fontSize: 17,
    fontWeight: "500",
  },
  buttonDisabled: {
    opacity: 0.5,
  },

  // senha trocada
  concluidaBox: {
    alignItems: "center",
    paddingVertical: 24,
    gap: 4,
  },
  concluidaIcone: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "#e6f4ea",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },
  concluidaTexto: {
    fontSize: 16,
    color: "#3c4043",
    textAlign: "center",
    marginBottom: 18,
    maxWidth: 380,
  },
});