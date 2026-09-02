//Barra lateral + top usada em todas as telas logadas
import { useEffect, useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { router, usePathname } from "expo-router";
import { clearSession, getSession } from "../services/authStorage";



const BASE_NAV_ITEMS = [
  { label: "Tela inicial", href: "/tela_inicial" },
  { label: "Estoque", href: "/estoque" },
  { label: "Materiais", href: null },
  { label: "Movimentações", href: null },
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
    router.replace("/");
  }

  // "Gerenciar usuários" só entra na lista pra quem é admin.
  const navItems =
    role === "admin"
      ? [
          BASE_NAV_ITEMS[0],
          BASE_NAV_ITEMS[1],
          { label: "Usuários", href: "/usuarios" },
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
        <title></title>
      </View>



      <View style={styles.body}>
        {/* Sidebar */}
        <View style={styles.sidebar}>
          {navItems.map((item) => {
            const active = item.href && pathname === item.href;
            return (
              <View style={styles.side_buttons}>
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
              </View>
            );
            
          })}
          <View style={styles.navSair}>
            <TouchableOpacity style={styles.navItem} onPress={handleLogout}>
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
    backgroundColor: "#6BBE9D"
  },
  sidebarTop: {
    width: 200,
    backgroundColor: "#6BBE9D",
    justifyContent: "center",
    alignItems: "center",
  },
    sidebar: {
    width: 200,
    backgroundColor: "#2D6158",
    paddingTop: 16,
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
  navItem: {
    paddingVertical: 12,
    paddingHorizontal: 10,
    backgroundColor: "#6BBE9D",
    borderRadius: 10,
    width: 160
  },
  navText: {
    fontSize: 16,
    color: "#ffffff",
    textAlign: "center"
  },

  //
  side_buttons: {
  padding: 10,
  paddingHorizontal: 20,
  },
  navSair: {
    padding:10,
     paddingHorizontal: 20,
  },

  //
  navTextActive: {
    fontWeight: "bold",
  },
  content: {
    flex: 1,
  },
});
