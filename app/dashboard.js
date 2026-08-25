import { useEffect, useState } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from "react-native";
import { router } from "expo-router";
import AppBar from "../components/AppBar";
import PageHeader from "../components/PageHeader";
import SearchBox from "../components/SearchBox";
import { getSession } from "../services/authStorage";

export default function Dashboard() {
  const [checkingSession, setCheckingSession] = useState(true);

  useEffect(() => {
    async function verifySession() {
      const { token } = await getSession();
      if (!token) {
        router.replace("/login");
        return;
      }
      setCheckingSession(false);
    }
    verifySession();
  }, []);

  if (checkingSession) {
    return null;
  }

  return (
    <AppBar>
      <PageHeader
        title="Dashboard"
        actions={
          <>
          
            <TouchableOpacity style={styles.retirarButton}>
              <Text style={styles.retirarButtonText}>Retirar Item</Text>
            </TouchableOpacity>

            <SearchBox />
          </>
        }
      />
      <View style={styles.Space}>
  <View style={styles.contentArea}>

    {/* Aviso de validação */}
    <View style={styles.validationRow}>
      <View style={styles.validationMessage}>
        <Text style={styles.validationText}>
          Você possui 3 itens próximos da validação!
        </Text>
      </View>

      <TouchableOpacity style={styles.verificarButton}>
        <Text style={styles.verificarText}>Verificar</Text>
      </TouchableOpacity>
    </View>

    {/* Cards */}
    <View style={styles.cardsContainer}>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Produtos Cadastrados</Text>
        <Text style={styles.cardNumber}>5</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Itens Auditados</Text>
        <Text style={styles.cardNumber}>3</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Divergências</Text>
        <Text style={styles.cardNumber}>1</Text>
      </View>

    </View>

  </View>
</View>   
     
          
      

      
    </AppBar>
  );
}

const styles = StyleSheet.create({
  retirarButton: {
    borderWidth: 1,
    borderColor: "#b1b1b1",
    borderRadius: 4,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: "#ffffff",
  },

  retirarButtonText: {
    fontSize: 13,
    color: "#1a1a1a",
  },

  Space: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 16,
  },

  contentArea: {
    flex: 1,
    backgroundColor: "#e0e0e0",
    borderRadius: 7,
    padding: 22,
  },

  validationRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 24,
  },

  validationMessage: {
    backgroundColor: "#ffffff",
    borderRadius: 6,
    paddingHorizontal: 18,
    paddingVertical: 10,
  },

  validationText: {
    fontSize: 14,
    color: "#1a1a1a",
  },

  verificarButton: {
    borderWidth: 1,
    borderColor: "#888888",
    borderRadius: 4,
    backgroundColor: "#ffffff",
    paddingHorizontal: 22,
    paddingVertical: 7,
  },

  verificarText: {
    fontSize: 12,
    color: "#1a1a1a",
  },

  cardsContainer: {
    flexDirection: "row",
    gap: 20,
  },

  card: {
    flex: 1,
    height: 200,
    backgroundColor: "#ffffff",
    borderRadius: 6,
    alignItems: "center",
    justifyContent: "center",
  },

  cardTitle: {
    fontSize: 16,
    color: "#222222",
    marginBottom: 8,
  },


  cardNumber: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#000000",
  },
});
