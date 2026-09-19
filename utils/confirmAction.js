import { Platform, Alert } from "react-native";

export function confirmAction({
  title,
  message,
  confirmText = "Confirmar",
  cancelText = "Cancelar",
  onConfirm,
}) {
  if (Platform.OS === "web") {
    const confirmado = window.confirm(`${title}\n\n${message}`);
    if (confirmado) {
      onConfirm();
    }
    return;
  }

  Alert.alert(title, message, [
    { text: cancelText, style: "cancel" },
    { text: confirmText, style: "destructive", onPress: onConfirm },
  ]);
}