//Barra lateral + top usada em todas as telas logadas.
//
// Responsivo:
//   - telas largas (>= 900 px): barra lateral fixa à esquerda;
//   - telas estreitas (celular/tablet em pé): a barra lateral vira uma
//     "gaveta" que abre pelo botão de menu (três linhas) no topo.
import { useEffect, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Pressable,
  Modal,
  StyleSheet,
  Image,
} from "react-native";
import { router, usePathname } from "expo-router";
import { clearSession, getSession } from "../services/authStorage";
import Icon from "./Icon";
import NotificationsPopup from "./NotificationsPopup";
import useNotificacoes from "./useNotificacoes";
import useLayout from "./useLayout";

const NAV_TELA_INICIAL = { label: "Tela inicial", href: "/tela_inicial", icon: "home" };
const NAV_ESTOQUE = { label: "Estoque", href: "/estoque", icon: "package" };
const NAV_USUARIOS = { label: "Usuários", href: "/usuarios", icon: "users" };
const NAV_MATERIAIS = { label: "Materiais", href: "/materiais", icon: "layers" };
const NAV_MOVIMENTACOES = { label: "Movimentações", href: "/movimentacoes", icon: "repeat" };
const NAV_SOLICITACOES = { label: "Solicitações", href: "/solicitacoes", icon: "file-text" };

// Itens do menu (lista + "Sair"). Usado na barra lateral e na gaveta.
function Menu({ navItems, pathname, onNavigate, onLogout }) {
  return (
    <>
      <View>
        {navItems.map((item) => {
          const active = item.href && pathname === item.href;
          return (
            <View key={item.label} style={styles.side_buttons}>
              <TouchableOpacity
                style={[styles.navItem, active && styles.navItemActive]}
                disabled={!item.href}
                onPress={() => item.href && onNavigate(item.href)}
              >
                <Icon name={item.icon} size={20} color={active ? "#ffffff" : "#cfe3da"} />
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
        <TouchableOpacity style={styles.navItem} onPress={onLogout}>
          <Icon name="log-out" size={20} color="#cfe3da" />
          <Text style={styles.navText}>Sair</Text>
        </TouchableOpacity>
      </View>
    </>
  );
}

export default function AppBar({ children }) {
  const pathname = usePathname();
  const { compacto } = useLayout();
  const [role, setRole] = useState(null);
  const [menuOpen, setMenuOpen] = useState(false);

  // Sessão usada pelas notificações (token pra buscar os dados e id do
  // usuário pra guardar o que ele já leu).
  const [auth, setAuth] = useState({ token: null, userId: null, role: null });

  // Pop-up de notificações (sino). A lista depende do perfil — ver
  // services/notificacoes.js.
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
    setMenuOpen(false);
    await clearSession();
    router.replace("/");
  }

  function handleNavigate(href) {
    setMenuOpen(false);
    router.push(href);
  }

  // "Materiais" é uma área administrativa: só admin e coordenador
  // enxergam esse item no menu — professor não administra o cadastro de
  // materiais, só movimenta quantidade pela tela de Estoque.
  const isAdminLevel = role === "admin" || role === "coordenador";

  // O aluno tem uma versão reduzida do sistema: só Solicitações (que também
  // inclui o empréstimo de uniformes).
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

  const alturaTopo = compacto ? 64 : 100;

  return (
    <View style={styles.root}>
      {/* Barra superior */}
      <View style={[styles.topBar, { height: alturaTopo }]}>
        {compacto ? (
          <View style={styles.topLeftCompact}>
            <TouchableOpacity
              style={styles.iconButton}
              onPress={() => setMenuOpen(true)}
              accessibilityLabel="Abrir menu"
            >
              <Icon name="menu" size={26} color="#ffffff" />
            </TouchableOpacity>
            <Image
              source={require("../assets/logo_sece.png")}
              style={styles.logoCompact}
              resizeMode="contain"
            />
          </View>
        ) : (
          <View style={styles.sidebarTop}>
            <Image
              source={require("../assets/logo_sece.png")}
              style={styles.logo}
              resizeMode="contain"
            />
          </View>
        )}

        <View style={styles.contentTop}>
          <TouchableOpacity
            style={styles.iconButton}
            onPress={openNotifications}
            accessibilityLabel="Notificações"
          >
            <Icon name="bell" size={26} color="#ffffff" />
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
      </View>

      <NotificationsPopup
        visible={notificationsOpen}
        onClose={() => setNotificationsOpen(false)}
        topOffset={alturaTopo - 22}
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

      {/* Gaveta do menu (só em telas estreitas) */}
      {compacto && (
        <Modal
          visible={menuOpen}
          transparent
          animationType="fade"
          onRequestClose={() => setMenuOpen(false)}
        >
          <View style={styles.drawerRoot}>
            <View style={styles.drawer}>
              <View style={styles.drawerTop}>
                <Image
                  source={require("../assets/logo_sece.png")}
                  style={styles.logo}
                  resizeMode="contain"
                />
              </View>
              <Menu
                navItems={navItems}
                pathname={pathname}
                onNavigate={handleNavigate}
                onLogout={handleLogout}
              />
            </View>
            {/* clicar fora da gaveta fecha */}
            <Pressable
              style={styles.drawerBackdrop}
              onPress={() => setMenuOpen(false)}
              accessibilityLabel="Fechar menu"
            />
          </View>
        </Modal>
      )}

      <View style={styles.body}>
        {/* Sidebar fixa (telas largas) */}
        {!compacto && (
          <View style={styles.sidebar}>
            <Menu
              navItems={navItems}
              pathname={pathname}
              onNavigate={handleNavigate}
              onLogout={handleLogout}
            />
          </View>
        )}

        {/* Conteúdo da tela */}
        <View style={styles.content}>{children}</View>
      </View>
    </View>
  );
}

const SIDEBAR_LARGURA = 232;

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#ffffff",
  },
  topBar: {
    flexDirection: "row",
    backgroundColor: "#2D7A5F",
  },
  sidebarTop: {
    width: SIDEBAR_LARGURA,
    backgroundColor: "#1B4A3B",
    justifyContent: "center",
    alignItems: "center",
  },
  topLeftCompact: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingLeft: 10,
    flexShrink: 1,
  },
  logo: {
    width: 140,
    height: 70,
  },
  logoCompact: {
    width: 100,
    height: 48,
  },
  sidebar: {
    width: SIDEBAR_LARGURA,
    backgroundColor: "#1B4A3B",
    paddingTop: 16,
    paddingBottom: 20,
  },
  contentTop: {
    flex: 1,
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "center",
    gap: 14,
    paddingRight: 16,
  },
  // botões redondos do topo (menu e sino): 44 px, área boa pra tocar
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  // Contador de não lidas (bolinha vermelha com número)
  notificationBadge: {
    position: "absolute",
    top: 0,
    right: -2,
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    paddingHorizontal: 5,
    backgroundColor: "#c62828",
    borderWidth: 1,
    borderColor: "#2D7A5F",
    alignItems: "center",
    justifyContent: "center",
  },
  notificationBadgeText: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "700",
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#1a1a1a",
  },
  body: {
    flex: 1,
    flexDirection: "row",
  },
  navItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: 8,
  },
  navItemActive: {
    backgroundColor: "#2E7D5C",
  },
  navText: {
    fontSize: 16,
    color: "#cfe3da",
  },
  navTextActive: {
    color: "#ffffff",
    fontWeight: "bold",
  },
  side_buttons: {
    paddingHorizontal: 12,
    paddingVertical: 3,
  },
  sidebarDivider: {
    height: 1,
    backgroundColor: "#2E5C4D",
    marginHorizontal: 14,
    marginVertical: 10,
  },
  navSair: {
    paddingHorizontal: 12,
  },
  content: {
    flex: 1,
  },

  // gaveta (telas estreitas)
  drawerRoot: {
    flex: 1,
    flexDirection: "row",
  },
  drawer: {
    width: 280,
    maxWidth: "85%",
    backgroundColor: "#1B4A3B",
    paddingBottom: 20,
  },
  drawerTop: {
    height: 96,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  drawerBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.45)",
  },
});
