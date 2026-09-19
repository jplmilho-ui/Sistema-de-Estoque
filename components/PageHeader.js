//Cabeçalho de página (Título,ações)
import { View, Text, StyleSheet } from "react-native";

export default function PageHeader({ title, actions }) {
  return (
    <>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{title}</Text>

        {actions ? <View style={styles.headerActions}>{actions}</View> : null}
      </View>

      <View style={styles.headerDivider} />
    </>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 24,
    paddingVertical: 14,
  },
  headerTitle: {
    fontSize: 14,
    color: "#1a1a1a",
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  headerDivider: {
    height: 1,
    backgroundColor: "#cccccc",
  },
});
