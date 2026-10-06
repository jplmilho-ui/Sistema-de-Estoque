// Bolinha laranja de "Estoque baixo" ao lado da quantidade.
// Ao passar o mouse (ou focar), mostra o aviso explicando o motivo.
import { useState } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";

export default function LowStockIndicator({ label, onPress }) {
  const [open, setOpen] = useState(false);

  // largura calculada pelo tamanho do texto: um balão posicionado em
  // absoluto dentro de um elemento de 10 px quebraria o texto palavra
  // por palavra se não tivesse largura própria.
  const tooltipWidth = Math.ceil(label.length * 6.6) + 20;

  return (
    <Pressable
      style={styles.wrap}
      onPress={onPress}
      onHoverIn={() => setOpen(true)}
      onHoverOut={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
      accessibilityRole="text"
      accessibilityLabel={label}
    >
      <View style={styles.dot} />

      {open && (
        <View style={[styles.tooltip, { width: tooltipWidth }]} pointerEvents="none">
          <Text style={styles.tooltipText}>{label}</Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: 18,
    height: 18,
    marginLeft: 6,
    alignItems: "center",
    justifyContent: "center",
  },
  dot: {
    width: 13,
    height: 13,
    borderRadius: 7,
    backgroundColor: "#f08c00",
    // anel branco: mantém a bolinha visível também em linha vencida (vermelha)
    borderWidth: 1.5,
    borderColor: "#ffffff",
  },
  tooltip: {
    position: "absolute",
    left: 22,
    top: -3,
    zIndex: 20,
    backgroundColor: "#202124",
    borderRadius: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    boxShadow: "0px 2px 8px rgba(0, 0, 0, 0.25)",
  },
  tooltipText: {
    fontSize: 11,
    color: "#ffffff",
  },
});
