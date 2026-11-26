//Cabeçalho de página (título, subtítulo opcional e ações à direita)
import { View, Text, StyleSheet } from "react-native";
import useLayout from "./useLayout";

export default function PageHeader({ title, subtitle, actions }) {
  const { celular } = useLayout();
  const recuo = celular ? 16 : 24;

  return (
    <>
      <View style={[styles.header, { paddingHorizontal: recuo }]}>
        <View style={styles.titleBlock}>
          <Text
            style={[styles.headerTitle, celular && styles.headerTitleCelular]}
            accessibilityRole="header"
            aria-level={1}
          >
            {title}
          </Text>
          {!!subtitle && <Text style={styles.headerSubtitle}>{subtitle}</Text>}
        </View>

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
    // em telas estreitas as ações descem para a linha de baixo em vez de
    // estourar o cabeçalho
    flexWrap: "wrap",
    gap: 12,
    paddingVertical: 16,
  },
  titleBlock: {
    flexShrink: 1,
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: "600",
    color: "#1a1a1a",
  },
  headerTitleCelular: {
    fontSize: 22,
  },
  headerSubtitle: {
    fontSize: 15,
    color: "#5f6368",
    marginTop: 2,
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 12,
  },
  headerDivider: {
    height: 1,
    backgroundColor: "#cccccc",
  },
});
