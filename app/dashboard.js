import { View, Text, TextInput, TouchableOpacity, StyleSheet } from "react-native";
import AppBar from "../components/AppBar";
import PageHeader from "../components/PageHeader";
import SearchBox from "../components/SearchBox";

export default function Dashboard() {
  return (
    <AppShell>
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

      <View style={styles.contentArea} />
    </AppShell>
  );
}

const styles = StyleSheet.create({
  retirarButton: {
    borderWidth: 1,
    borderColor: "#999999",
    borderRadius: 4,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: "#ffffff",
  },
  retirarButtonText: {
    fontSize: 13,
    color: "#1a1a1a",
  },
  contentArea: {
    flex: 1,
  },
});
