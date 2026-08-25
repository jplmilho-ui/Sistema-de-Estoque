import { useEffect, useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { router, usePathname } from "expo-router";
import { clearSession, getSession } from "../services/authStorage";

const BASE_NAV_ITEMS = [
  { label: "Workspace", href: null },
  { label: "Dashboard", href: "/dashboard" },
  { label: "Gerenciar itens", href: "/itens" },
  { label: "Histórico", href: null },
];

export default function AppBar({ children }) {
  const pathname = usePathname();
  const [role, setRole] = useState(null);

  useEffect(() => {
    getSession().then(({ user }) => setRole(user?.role ?? null));
  }, []);

  async function handleLogout() {
    await clearSession();
    router.replace("/login");
  }

  // "Gerenciar usuários" só entra na lista pra quem é admin.
  const navItems =
    role === "admin"
      ? [
          BASE_NAV_ITEMS[0],
          BASE_NAV_ITEMS[1],
          { label: "Gerenciar usuários", href: "/usuarios" },
          ...BASE_NAV_ITEMS.slice(2),
        ]
      : BASE_NAV_ITEMS;

  return (
    <View style={styles.root}>

      {/* Barra superior: logo (sidebar) e avatar (conteúdo) */}

      <View style={styles.topBar}>
        <View style={styles.sidebarTop}>
          <View style={styles.logoPlaceholder}>
          </View>
        </View>

        <View style={styles.contentTop}>
          <View style={styles.avatar} />
        </View>
      </View>



      <View style={styles.body}>
        {/* Sidebar */}
        <View style={styles.sidebar}>
          {navItems.map((item) => {
            const active = item.href && pathname === item.href;
            return (
              <TouchableOpacity
                key={item.label}
                style={styles.navItem}
                disabled={!item.href}
                onPress={() => item.href && router.push(item.href)}
              >
                <Text style={[styles.navText, active && styles.navTextActive]}>
                  {item.label}
                </Text>
              </TouchableOpacity>
            );
          })}
          <TouchableOpacity style={styles.navItem} onPress={handleLogout}>
            <Text style={styles.navText}>Sair</Text>
          </TouchableOpacity>
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
  },
  sidebarTop: {
    width: 200,
    backgroundColor: "#fff4f4",
    justifyContent: "center",
    alignItems: "center",
  },
  logoPlaceholder: {
    width: 80,
    height: 60,
    borderWidth: 1,
    borderColor: "#383838",
    backgroundColor: "#ffffff",
  },
  contentTop: {
    flex: 1,
    justifyContent: "center",
    alignItems: "flex-end",
    paddingRight: 24,
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
  sidebar: {
    width: 200,
    backgroundColor: "#e6e6e6",
    paddingTop: 16,
  },
  navItem: {
    paddingVertical: 12,
    paddingHorizontal: 20,
  },
  navText: {
    fontSize: 14,
    color: "#1a1a1a",
  },
  navTextActive: {
    fontWeight: "bold",
  },
  content: {
    flex: 1,
  },
});
