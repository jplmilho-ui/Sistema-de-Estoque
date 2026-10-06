// Versão para celular (Android/iOS) do <Icon />.
//
// O sistema roda no navegador (exportação de relatório/PDF, por exemplo,
// só funciona na web), então aqui o ícone só reserva o espaço para o
// layout não quebrar. Para desenhar os ícones também no celular:
//   1) npx expo install react-native-svg
//   2) renderizar ICONS[name] com <Svg>/<Path>/<Line>/<Polyline>/<Circle>
//      (os desenhos de iconPaths.js servem sem mudanças).
import { View } from "react-native";

export default function Icon({ size = 18 }) {
  return <View style={{ width: size, height: size }} />;
}
