// Pop-up do sino de notificações (inspirado no do YouTube):
//   - abre ancorado embaixo do sino, com cabeçalho e "Marcar todas como lidas"
//   - bolinha verde nas não lidas + fundo levemente destacado
//   - ícone redondo à esquerda, título, texto e tempo
//   - fecha clicando fora, no "X" ou ao escolher uma notificação
//   - itens agrupados por assunto; as solicitações de alunos vêm em PRIMEIRO
//   - nas solicitações pendentes, professor/coordenador/admin podem
//     Aprovar ou Recusar (com motivo opcional) direto aqui
//   - o aluno só vê o aviso de solicitação aprovada
import { useState } from "react";
import Icon from "./Icon";
import {
  View,
  Text,
  TextInput,
  Modal,
  Pressable,
  ScrollView,
  ActivityIndicator,
  StyleSheet,
  useWindowDimensions,
} from "react-native";

const TOP_OFFSET = 78; // logo abaixo do sino (a barra superior tem 100 de altura)
const SIDE_MARGIN = 12;

// ícone (contorno) + cores de cada tipo de notificação
const TIPOS = {
  vencido: { icon: "alert-triangle", color: "#c62828", bg: "#fdeceb" },
  proximo: { icon: "clock", color: "#b26a00", bg: "#fff4e0" },
  "sem-estoque": { icon: "inbox", color: "#5f6368", bg: "#eeeeee" },
  entrada: { icon: "arrow-up", color: "#1b6b3a", bg: "#e6f4ea" },
  saida: { icon: "arrow-down", color: "#1a56c4", bg: "#e8f0fe" },
  solicitacao: { icon: "user", color: "#1a56c4", bg: "#e8f0fe" },
  aprovada: { icon: "check-circle", color: "#1b6b3a", bg: "#e6f4ea" },
  recusada: { icon: "x-circle", color: "#c62828", bg: "#fdeceb" },
};

// Ordem dos grupos = ordem de prioridade (solicitações primeiro).
function gruposPara(isAluno) {
  return [
    { key: "solicitacoes", label: isAluno ? "Minhas solicitações" : "Solicitações de alunos" },
    { key: "alertas", label: "Alertas" },
    { key: "movimentacoes", label: "Movimentações recentes" },
  ];
}

const MOTIVO_MAX = 300;

// Botões Aprovar / Recusar de uma solicitação pendente.
function SolicitacaoActions({ item, onRespond, respondendoId, erro }) {
  const [recusando, setRecusando] = useState(false);
  const [motivo, setMotivo] = useState("");

  const ocupado = respondendoId === item.id;
  const bloqueado = respondendoId !== null && respondendoId !== undefined;

  return (
    <View style={styles.actions}>
      {!!erro && <Text style={styles.actionError}>{erro}</Text>}

      {recusando ? (
        <>
          <TextInput
            style={styles.motivoInput}
            placeholder="Motivo da recusa (opcional)"
            value={motivo}
            onChangeText={setMotivo}
            maxLength={MOTIVO_MAX}
            multiline
            editable={!ocupado}
          />
          <View style={styles.actionRow}>
            <Pressable
              style={[styles.actionButton, styles.backButton]}
              onPress={() => setRecusando(false)}
              disabled={ocupado}
            >
              <Text style={styles.backButtonText}>Voltar</Text>
            </Pressable>
            <Pressable
              style={[styles.actionButton, styles.refuseButton, bloqueado && styles.actionDisabled]}
              onPress={() => onRespond(item, "recusar", motivo.trim() || undefined)}
              disabled={bloqueado}
            >
              {ocupado ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <Text style={styles.actionButtonText}>Confirmar recusa</Text>
              )}
            </Pressable>
          </View>
        </>
      ) : (
        <View style={styles.actionRow}>
          <Pressable
            style={[styles.actionButton, styles.refuseButton, bloqueado && styles.actionDisabled]}
            onPress={() => setRecusando(true)}
            disabled={bloqueado}
          >
            <Text style={styles.actionButtonText}>Recusar</Text>
          </Pressable>
          <Pressable
            style={[styles.actionButton, styles.approveButton, bloqueado && styles.actionDisabled]}
            onPress={() => onRespond(item, "aprovar")}
            disabled={bloqueado}
          >
            {ocupado ? (
              <ActivityIndicator size="small" color="#ffffff" />
            ) : (
              <Text style={styles.actionButtonText}>Aprovar</Text>
            )}
          </Pressable>
        </View>
      )}
    </View>
  );
}

const ABAS = [
  { key: "todas", label: "Todas" },
  { key: "naoLidas", label: "Não lidas" },
];

export default function NotificationsPopup({
  visible,
  onClose,
  items,
  lidas,
  unreadCount,
  loading,
  loaded,
  error,
  onPressItem,
  onMarkAllRead,
  isAluno = false,
  onRespond,
  respondendoId,
  errosAcao = {},
}) {
  const { width, height } = useWindowDimensions();
  const [aba, setAba] = useState("todas");

  const cardWidth = Math.min(420, width - SIDE_MARGIN * 2);
  const cardMaxHeight = Math.max(240, height - TOP_OFFSET - SIDE_MARGIN);

  const estaLida = (item) => item.lidaPorPadrao || lidas.has(item.id);

  const visiveis = aba === "naoLidas" ? items.filter((item) => !estaLida(item)) : items;

  const GRUPOS = gruposPara(isAluno);

  const primeiraCarga = loading && !loaded;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      {/* clicar fora do cartão fecha o pop-up */}
      <Pressable style={styles.backdrop} onPress={onClose} />

      <View style={[styles.card, { width: cardWidth, maxHeight: cardMaxHeight }]}>
        {/* Cabeçalho */}
        <View style={styles.header}>
          <Text style={styles.title}>Notificações</Text>

          <View style={styles.headerActions}>
            {unreadCount > 0 && (
              <Pressable
                onPress={onMarkAllRead}
                style={({ hovered }) => [styles.markAll, hovered && styles.markAllHover]}
              >
                <Text style={styles.markAllText}>Marcar todas como lidas</Text>
              </Pressable>
            )}

            <Pressable
              onPress={onClose}
              accessibilityLabel="Fechar notificações"
              style={({ hovered }) => [styles.closeButton, hovered && styles.closeButtonHover]}
            >
              <Icon name="x" size={16} color="#ffffff" />
            </Pressable>
          </View>
        </View>

        {/* Abas */}
        <View style={styles.tabs}>
          {ABAS.map((opcao) => {
            const ativa = aba === opcao.key;
            return (
              <Pressable
                key={opcao.key}
                onPress={() => setAba(opcao.key)}
                style={[styles.tab, ativa && styles.tabActive]}
              >
                <Text style={[styles.tabText, ativa && styles.tabTextActive]}>
                  {opcao.label}
                  {opcao.key === "naoLidas" && unreadCount > 0 ? ` (${unreadCount})` : ""}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* Lista */}
        <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
          {primeiraCarga && (
            <View style={styles.centerBox}>
              <ActivityIndicator color="#1B4A3B" />
            </View>
          )}

          {!primeiraCarga && !!error && items.length === 0 && (
            <View style={styles.centerBox}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          {!primeiraCarga && !error && visiveis.length === 0 && (
            <View style={styles.centerBox}>
              <View style={styles.emptyIcon}>
                <Icon name="bell" size={32} color="#9aa0a6" />
              </View>
              <Text style={styles.emptyTitle}>
                {aba === "naoLidas" ? "Tudo em dia" : "Nenhuma notificação"}
              </Text>
              <Text style={styles.emptyText}>
                {aba === "naoLidas"
                  ? "Você não tem notificações não lidas."
                  : isAluno
                  ? "Você será avisado aqui quando uma solicitação sua for aprovada."
                  : "Quando houver solicitações de alunos, itens vencidos ou novas movimentações, elas aparecem aqui."}
              </Text>
            </View>
          )}

          {!primeiraCarga &&
            GRUPOS.map((grupo) => {
              const doGrupo = visiveis.filter((item) => item.grupo === grupo.key);
              if (doGrupo.length === 0) return null;

              return (
                <View key={grupo.key}>
                  <Text style={styles.groupLabel}>{grupo.label}</Text>

                  {doGrupo.map((item) => {
                    const lida = estaLida(item);
                    const tipo = TIPOS[item.tipo] || TIPOS.proximo;
                    const comAcoes = item.tipo === "solicitacao" && !!onRespond;

                    return (
                      <View key={item.id} style={!lida && styles.itemUnread}>
                        <Pressable
                          onPress={() => onPressItem(item)}
                          style={({ hovered, pressed }) => [
                            styles.item,
                            (hovered || pressed) && styles.itemHover,
                          ]}
                        >
                          <View style={styles.dotColumn}>
                            {!lida && <View style={styles.unreadDot} />}
                          </View>

                          <View style={[styles.iconCircle, { backgroundColor: tipo.bg }]}>
                            <Icon name={tipo.icon} size={20} color={tipo.color} />
                          </View>

                          <View style={styles.itemBody}>
                            <Text
                              style={[styles.itemTitle, !lida && styles.itemTitleUnread]}
                              numberOfLines={2}
                            >
                              {item.title}
                            </Text>
                            <Text style={styles.itemMessage} numberOfLines={comAcoes ? 4 : 2}>
                              {item.message}
                            </Text>
                            <Text style={styles.itemTime}>{item.timeLabel}</Text>
                          </View>
                        </Pressable>

                        {comAcoes && (
                          <SolicitacaoActions
                            item={item}
                            onRespond={onRespond}
                            respondendoId={respondendoId}
                            erro={errosAcao[item.id]}
                          />
                        )}
                      </View>
                    );
                  })}
                </View>
              );
            })}
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0, 0, 0, 0.12)",
  },
  card: {
    position: "absolute",
    top: TOP_OFFSET,
    right: SIDE_MARGIN,
    backgroundColor: "#ffffff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e0e0e0",
    overflow: "hidden",
    boxShadow: "0px 8px 24px rgba(0, 0, 0, 0.22)",
    elevation: 12,
  },

  // cabeçalho
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
    fontSize: 16,
    fontWeight: "600",
    color: "#ffffff",
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  markAll: {
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 6,
  },
  markAllHover: {
    backgroundColor: "rgba(255, 255, 255, 0.14)",
  },
  markAllText: {
    fontSize: 12,
    color: "#cfe3da",
    fontWeight: "600",
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

  // abas
  tabs: {
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#eeeeee",
  },
  tab: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: "#f1f1f1",
  },
  tabActive: {
    backgroundColor: "#1B4A3B",
  },
  tabText: {
    fontSize: 12,
    color: "#5f6368",
    fontWeight: "500",
  },
  tabTextActive: {
    color: "#ffffff",
  },

  // lista
  list: {
    flexGrow: 0,
  },
  listContent: {
    paddingBottom: 8,
  },
  groupLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: "#5f6368",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 6,
  },
  item: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingVertical: 10,
    paddingRight: 16,
  },
  itemUnread: {
    backgroundColor: "#f0f7f3",
  },

  // Aprovar / Recusar
  actions: {
    paddingLeft: 68, // alinha com o texto (bolinha + ícone)
    paddingRight: 16,
    paddingBottom: 12,
    marginTop: -2,
  },
  actionRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 8,
  },
  actionButton: {
    minWidth: 84,
    height: 32,
    paddingHorizontal: 14,
    borderRadius: 4,
    alignItems: "center",
    justifyContent: "center",
  },
  approveButton: {
    backgroundColor: "#1B4A3B",
  },
  refuseButton: {
    backgroundColor: "#495057",
  },
  backButton: {
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#495057",
  },
  actionDisabled: {
    opacity: 0.5,
  },
  actionButtonText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#ffffff",
  },
  backButtonText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#495057",
  },
  actionError: {
    fontSize: 12,
    color: "#c62828",
    marginBottom: 8,
  },
  motivoInput: {
    borderWidth: 1,
    borderColor: "#c9c9c9",
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 12,
    color: "#202124",
    backgroundColor: "#ffffff",
    minHeight: 48,
    marginBottom: 8,
    textAlignVertical: "top",
  },
  itemHover: {
    backgroundColor: "#e3efe9",
  },
  dotColumn: {
    width: 16,
    alignItems: "center",
    paddingTop: 16,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#2E7D5C",
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  itemBody: {
    flex: 1,
    minWidth: 0,
  },
  itemTitle: {
    fontSize: 13,
    color: "#202124",
    lineHeight: 18,
  },
  itemTitleUnread: {
    fontWeight: "600",
  },
  itemMessage: {
    fontSize: 12,
    color: "#5f6368",
    marginTop: 2,
    lineHeight: 16,
  },
  itemTime: {
    fontSize: 11,
    color: "#80868b",
    marginTop: 4,
  },

  // estados vazio / erro / carregando
  centerBox: {
    alignItems: "center",
    paddingVertical: 36,
    paddingHorizontal: 24,
  },
  emptyIcon: {
    marginBottom: 8,
  },
  emptyTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#202124",
    marginBottom: 4,
  },
  emptyText: {
    fontSize: 12,
    color: "#5f6368",
    textAlign: "center",
  },
  errorText: {
    fontSize: 13,
    color: "#c62828",
    textAlign: "center",
  },
});
