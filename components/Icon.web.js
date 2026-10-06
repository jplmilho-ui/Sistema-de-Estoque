// Ícone de contorno minimalista (versão WEB — o sistema roda no navegador).
//
// Uso:  <Icon name="bell" size={22} color="#ffffff" />
//
// - name: nome do ícone (ver components/iconPaths.js)
// - size: largura/altura em px
// - color: cor do traço (herda a cor do texto se não for informada)
// - strokeWidth: espessura do traço (1.75 deixa o desenho fino, como no YouTube)
//
// Renderiza um <svg> de verdade, então não depende de nenhuma biblioteca
// de ícones nem de fontes externas.
import { createElement } from "react";
import { ICONS } from "./iconPaths";

export default function Icon({ name, size = 18, color = "currentColor", strokeWidth = 1.75 }) {
  const shapes = ICONS[name];
  if (!shapes) return null;

  return createElement(
    "svg",
    {
      width: size,
      height: size,
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: color,
      strokeWidth,
      strokeLinecap: "round",
      strokeLinejoin: "round",
      "aria-hidden": true,
      focusable: false,
      // display:block evita o espaço extra de linha; pointerEvents:none
      // deixa o clique/hover ficar com o botão em volta do ícone.
      style: { display: "block", flexShrink: 0, pointerEvents: "none" },
    },
    shapes.map(([tag, attrs], index) => createElement(tag, { key: index, ...attrs }))
  );
}
