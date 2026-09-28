//Barra lateral + top usada em todas as telas logadas
import { useEffect, useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet, Image } from "react-native";
import { router, usePathname } from "expo-router";
import { clearSession, getSession } from "../services/authStorage";



const NAV_TELA_INICIAL = { label: "Tela inicial", href: "/tela_inicial", icon: "🏠" };
const NAV_ESTOQUE = { label: "Estoque", href: "/estoque", icon: "📦" };
const NAV_USUARIOS = { label: "Usuários", href: "/usuarios", icon: "👥" };
const NAV_MATERIAIS = { label: "Materiais", href: "/materiais", icon: "🗂️" };
const NAV_MOVIMENTACOES = { label: "Movimentações", href: "/movimentacoes", icon: "🔄" };

export default function AppBar({ children }) {
  const pathname = usePathname();
  const [role, setRole] = useState(null);

  // TODO: trocar por uma contagem real vinda do backend quando existir
  // um endpoint de notificações (ex: itens próximos da validade,
  // avisos de estoque baixo etc).
  const [hasNotifications, setHasNotifications] = useState(false);

  useEffect(() => {
    getSession().then(({ user }) => setRole(user?.role ?? null));
  }, []);

  async function handleLogout() {
    await clearSession();
    router.replace("/");
  }

  // "Materiais" é uma área administrativa: só super_admin e admin
  // (coordenador) enxergam esse item no menu — professor não administra
  // o cadastro de materiais, só movimenta quantidade pela tela de Estoque.
  const isAdminLevel = role === "admin" || role === "super_admin";

  const navItems = [
    NAV_TELA_INICIAL,
    NAV_ESTOQUE,
    // "Usuários" também é exclusivo de admin/super_admin.
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
            onPress={() => router.push("/notificacoes")}
          >
            <Text style={styles.notificationIcon}>🔔</Text>
            {hasNotifications && <View style={styles.notificationDot} />}
          </TouchableOpacity>
          <View style={styles.avatar} />
        </View>
        <title></title>
      </View>



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
                    <Text style={styles.navIcon}>{item.icon}</Text>
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
              <Text style={styles.navIcon}>🚪</Text>
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
  notificationIcon: {
    fontSize: 16,
  },
  notificationDot: {
    position: "absolute",
    top: 6,
    right: 7,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#c62828",
    borderWidth: 1,
    borderColor: "#ffffff",
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
  navIcon: {
    fontSize: 15,
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