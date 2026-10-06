//Barra lateral + top usada em todas as telas logadas
import { useEffect, useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet, Image } from "react-native";
import { router, usePathname } from "expo-router";
import { clearSession, getSession } from "../services/authStorage";
import Icon from "./Icon";
import NotificationsPopup from "./NotificationsPopup";
import useNotificacoes from "./useNotificacoes";



const NAV_TELA_INICIAL = { label: "Tela inicial", href: "/tela_inicial", icon: "home" };
const NAV_ESTOQUE = { label: "Estoque", href: "/estoque", icon: "package" };
const NAV_USUARIOS = { label: "Usuários", href: "/usuarios", icon: "users" };
const NAV_MATERIAIS = { label: "Materiais", href: "/materiais", icon: "layers" };
const NAV_MOVIMENTACOES = { label: "Movimentações", href: "/movimentacoes", icon: "repeat" };
const NAV_SOLICITACOES = { label: "Solicitações", href: "/solicitacoes", icon: "file-text" };

export default function AppBar({ children }) {
  const pathname = usePathname();
  const [role, setRole] = useState(null);

  // Sessão usada pelas notificações (token pra buscar os dados e id do
  // usuário pra guardar o que ele já leu).
  const [auth, setAuth] = useState({ token: null, userId: null, role: null });

  // Pop-up de notificações (sino). A lista depende do perfil: solicitações
  // de alunos (prioridade), alertas e movimentações para a equipe; só
  // solicitações aprovadas para o aluno — ver services/notificacoes.js.
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const notifications = useNotificacoes(auth);

  useEffect(() => {
    getSession().then(({ token, user }) => {
      setRole(user?.role ?? null);
      setAuth({ token, userId: user?.id ?? null, role: user?.role ?? null });
    });
  }, []);

  function openNotifications() {
    setNotificationsOpen(true);
    notifications.reload(); // garante dados frescos ao abrir
  }

  function handlePressNotification(item) {
    notifications.markRead(item.id);

    // Notificações sem destino (ex: pedido de aluno aguardando resposta)
    // só são marcadas como lidas — o pop-up continua aberto pra aprovar
    // ou recusar ali mesmo.
    if (!item.href) return;

    setNotificationsOpen(false);
    router.push(item.params ? { pathname: item.href, params: item.params } : item.href);
  }

  async function handleLogout() {
    await clearSession();
    router.replace("/");
  }

  // "Materiais" é uma área administrativa: só admin e coordenador
  // enxergam esse item no menu — professor não administra o cadastro de
  // materiais, só movimenta quantidade pela tela de Estoque.
  const isAdminLevel = role === "admin" || role === "coordenador";

  // O aluno tem uma versão reduzida do sistema: só a tela de Solicitações.
  // Enquanto o papel ainda não carregou, não mostra nenhum item (evita o
  // aluno ver o menu completo por um instante).
  const navItems =
    role === null
      ? []
      : role === "aluno"
      ? [NAV_SOLICITACOES]
      : [
          NAV_TELA_INICIAL,
          NAV_ESTOQUE,
          // "Usuários" também é exclusivo de admin/coordenador.
          ...(isAdminLevel ? [NAV_USUARIOS] : []),
          ...(isAdminLevel ? [NAV_MATERIAIS] : []),
          NAV_MOVIMENTACOES,
        ];

  return (
    <View style={styles.root}>

      {/* Barra superior: sidebar (topo) e avatar/notificações (conteúdo) */}

      <View style={styles.topBar}>
        <View style={styles.sidebarTop}>
          <Image
            source={require("../assets/logo_sece.png")}
            style={styles.logo}
            resizeMode="contain"
          />
        </View>

        <View style={styles.contentTop}>
          <TouchableOpacity
            style={styles.notificationButton}
            onPress={openNotifications}
            accessibilityLabel="Notificações"
          >
            <Icon name="bell" size={24} color="#ffffff" />
            {notifications.unreadCount > 0 && (
              <View style={styles.notificationBadge}>
                <Text style={styles.notificationBadgeText}>
                  {notifications.unreadCount > 9 ? "9+" : notifications.unreadCount}
                </Text>
              </View>
            )}
          </TouchableOpacity>
          <View style={styles.avatar} />
        </View>
        <title></title>
      </View>

      <NotificationsPopup
        visible={notificationsOpen}
        onClose={() => setNotificationsOpen(false)}
        items={notifications.items}
        lidas={notifications.lidas}
        unreadCount={notifications.unreadCount}
        loading={notifications.loading}
        loaded={notifications.loaded}
        error={notifications.error}
        onPressItem={handlePressNotification}
        onMarkAllRead={notifications.markAllRead}
        isAluno={role === "aluno"}
        onRespond={role === "aluno" ? undefined : notifications.responderSolicitacao}
        respondendoId={notifications.respondendoId}
        errosAcao={notifications.errosAcao}
      />



      <View style={styles.body}>
        {/* Sidebar */}
        <View style={styles.sidebar}>
          <View style={styles.navList}>
            {navItems.map((item) => {
              const active = item.href && pathname === item.href;
              return (
                <View key={item.label} style={styles.side_buttons}>
                  <TouchableOpacity
                    style={[styles.navItem, active && styles.navItemActive]}
                    disabled={!item.href}
                    onPress={() => item.href && router.push(item.href)}
                  >
                    <Icon
                      name={item.icon}
                      size={18}
                      color={active ? "#ffffff" : "#cfe3da"}
                    />
                    <Text style={[styles.navText, active && styles.navTextActive]}>
                      {item.label}
                    </Text>
                  </TouchableOpacity>
                </View>
              );
            })}
          </View>

          <View style={styles.sidebarDivider} />

          <View style={styles.navSair}>
            <TouchableOpacity style={styles.navItem} onPress={handleLogout}>
              <Icon name="log-out" size={18} color="#cfe3da" />
              <Text style={styles.navText}>Sair</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Conteúdo da tela */}
        <View style={styles.content}>{children}</View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#ffffff",
  },
  topBar: {
    flexDirection: "row",
    height: 100,
    backgroundColor: "#2D7A5F"
  },
  sidebarTop: {
    width: 200,
    backgroundColor: "#1B4A3B",
    justifyContent: "center",
    alignItems: "center",
  },
  logo: {
    width: 140,
    height: 70,
  },
  sidebar: {
    width: 200,
    backgroundColor: "#1B4A3B",
    paddingTop: 16,
    paddingBottom: 20,
  },
  contentTop: {
    flex: 1,
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "center",
    gap: 18,
    paddingRight: 24,
  },
  notificationButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  // Contador de não lidas (estilo YouTube: bolinha vermelha com número)
  notificationBadge: {
    position: "absolute",
    top: 0,
    right: -2,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    paddingHorizontal: 4,
    backgroundColor: "#c62828",
    borderWidth: 1,
    borderColor: "#2D7A5F",
    alignItems: "center",
    justifyContent: "center",
  },
  notificationBadgeText: {
    color: "#ffffff",
    fontSize: 9,
    fontWeight: "700",
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#1a1a1a",
  },
  divider: {
    height: 1,
    backgroundColor: "#cccccc",
  },
  body: {
    flex: 1,
    flexDirection: "row",
  },
  navList: {
    // lista de itens do menu, no topo da sidebar
  },
  navItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 8,
  },
  navItemActive: {
    backgroundColor: "#2E7D5C",
  },
  navText: {
    fontSize: 14,
    color: "#cfe3da",
  },

  //
  side_buttons: {
    paddingHorizontal: 14,
    paddingVertical: 3,
  },
  sidebarDivider: {
    height: 1,
    backgroundColor: "#2E5C4D",
    marginHorizontal: 14,
    marginVertical: 10,
  },
  navSair: {
    paddingHorizontal: 14,
  },

  //
  navTextActive: {
    color: "#ffffff",
    fontWeight: "bold",
  },
  content: {
    flex: 1,
  },
});