// Tamanho da tela em categorias simples, pra todas as telas decidirem o
// layout do mesmo jeito:
//   compacto -> menos de 900 px (celular e tablet em pé): menu vira gaveta
//   celular  -> menos de 600 px
import { useWindowDimensions } from "react-native";

export const LARGURA_COMPACTO = 900;
export const LARGURA_CELULAR = 600;

export default function useLayout() {
  const { width, height } = useWindowDimensions();
  return {
    width,
    height,
    compacto: width < LARGURA_COMPACTO,
    celular: width < LARGURA_CELULAR,
  };
}
