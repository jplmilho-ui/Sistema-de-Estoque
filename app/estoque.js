import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
// Import direto no build de navegador do exceljs: o pacote também tem uma
// versão pra Node (com fs/stream de verdade) que o Metro não consegue
// empacotar pra web. Esse caminho aponta pro bundle pronto pro navegador.
import ExcelJS from "exceljs/dist/exceljs.min.js";

import AppBar from "../components/AppBar";
import PageHeader from "../components/PageHeader";
import SearchBox from "../components/SearchBox";
import LowStockIndicator from "../components/LowStockIndicator";

import { getSession } from "../services/authStorage";
import { listMaterials, retirarMaterial, devolverMaterial } from "../services/materialApi";
import { isVencido } from "../utils/validade";
import { isEstoqueBaixo, textoEstoqueBaixo } from "../utils/estoque";
import TabelaRolavel from "../components/TabelaRolavel";
import EmprestimosEquipe from "../components/EmprestimosEquipe";
import { gerarPdfRetirada, textoQuantidade } from "../utils/retiradaPdf";
import { baixarPdf } from "../utils/pdfBase";

// Papéis que podem ver e movimentar o Estoque. Diferente da tela de
// Materiais (administrativa), aqui admin, coordenador e professor podem
// todos visualizar e movimentar quantidade — só não administram o
// cadastro dos tipos de material (isso é feito em Materiais).
const PAPEIS_PERMITIDOS = ["admin", "coordenador", "professor"];

// Maior quantidade permitida por retirada/adição (o backend usa o mesmo
// limite). Segura digitação errada, tipo um zero a mais.
const MOVIMENTACAO_QUANTIDADE_MAXIMA = 1000000;

// Define as colunas da tabela (nome, flex de largura).
// Nome e Quantidade têm mais espaço; Validade e Categoria ficam médias e
// C.A. é a menor (guarda só um número curto).
const COLUMNS = [
  { key: "nome", label: "Nome", flex: 2.6 },
  { key: "quantidade", label: "Quantidade", flex: 2.2 },
  { key: "validade", label: "Validade", flex: 1.3 },
  { key: "categoria", label: "Categoria", flex: 1.3 },
  { key: "ca", label: "C.A", flex: 0.7 },
];

// Opções do filtro por categoria (as categorias "EPI" e "Uniforme" são as
// mesmas cadastradas na tela de Materiais). "todas" não filtra nada.
const FILTROS_CATEGORIA = [
  { key: "todas", label: "Todas" },
  { key: "EPI", label: "EPI" },
  { key: "Uniforme", label: "Uniforme" },
];

// Monta o texto exibido na coluna "Quantidade", ex: "4 caixas (200 un.)"
// ou "15 un." quando a unidade de medida já é "Unidade".
function cellValue(material, key) {
  switch (key) {
    case "nome":
      return material.nome;
    case "quantidade": {
      const { unidadeMedida, quantidade, quantidadeTotal } = material;
      if (unidadeMedida === "Unidade") {
        return `${quantidade} un.`;
      }
      const unidadeLower = unidadeMedida.toLowerCase();
      const plural = quantidade === 1 ? unidadeLower : `${unidadeLower}s`;
      return `${quantidade} ${plural} (${quantidadeTotal} un.)`;
    }
    case "validade":
      return material.validade || "—";
    case "categoria":
      return material.categoria;
    case "ca":
      return material.ca || "—";
    default:
      return "";
  }
}

export default function Estoque() {
  // Se a pessoa chegou aqui pelo card "Vencidos" da Tela Inicial
  // (link /estoque?filtro=vencidos), já abre filtrado.
  const params = useLocalSearchParams();
  const [mostrarSoVencidos, setMostrarSoVencidos] = useState(false);

  // Abas da tela: "materiais" (tabela do estoque) ou "emprestimos"
  // (uniformes emprestados aos alunos). O aviso de "uniforme não devolvido"
  // do sino abre direto a aba de empréstimos (/estoque?aba=emprestimos).
  const [aba, setAba] = useState("materiais");

  useEffect(() => {
    if (params.filtro === "vencidos") {
      setMostrarSoVencidos(true);
    }
    if (params.aba === "emprestimos") {
      setAba("emprestimos");
    }
  }, [params.filtro, params.aba]);

  // ---------------------------------------------------------
  // CONTROLE DE ACESSO
  // ---------------------------------------------------------
  const [checkingAccess, setCheckingAccess] = useState(true);
  const [session, setSession] = useState(null);

  // ---------------------------------------------------------
  // LISTA DE MATERIAIS ATIVOS (só o que está ativo aparece no Estoque)
  // ---------------------------------------------------------
  const [materials, setMaterials] = useState([]);
  const [loadingList, setLoadingList] = useState(true);
  const [listError, setListError] = useState("");

  // Item selecionado na tabela (checkbox) — é sobre ele que os botões
  // "Adicionar item" / "Retirar item" do cabeçalho vão agir.
  const [selectedId, setSelectedId] = useState(null);

  // ---------------------------------------------------------
  // BUSCA (filtra a lista pelo nome, categoria ou C.A digitado)
  // ---------------------------------------------------------
  const [searchTerm, setSearchTerm] = useState("");

  // Filtro por categoria: "todas" | "EPI" | "Uniforme"
  const [categoriaFiltro, setCategoriaFiltro] = useState("todas");

  // ---------------------------------------------------------
  // MODAL DE ADICIONAR / RETIRAR QUANTIDADE
  // ---------------------------------------------------------
  // Quando preenchido, mostra o modal: { tipo: "adicionar" | "retirar" }
  const [movement, setMovement] = useState(null);
  const [movementQuantidade, setMovementQuantidade] = useState("");
  const [movementError, setMovementError] = useState("");
  const [movementSaving, setMovementSaving] = useState(false);

  // TERMO DE RETIRADA (PDF pra assinar): guarda o que foi retirado nesta
  // sessão e ainda não entrou em um termo. `retiradaFeita` abre o aviso
  // logo após cada retirada, com o botão de gerar o PDF.
  const [retiradasTermo, setRetiradasTermo] = useState([]);
  const [retiradaFeita, setRetiradaFeita] = useState(null);

  // VERIFICAÇÃO DE ACESSO

  useEffect(() => {
    async function verifyAccess() {
      try {
        const currentSession = await getSession();

        if (!currentSession?.token) {
          router.replace("/");
          return;
        }

        // Aluno só usa a tela de Solicitações.
        if (currentSession.user?.role === "aluno") {
          router.replace("/solicitacoes");
          return;
        }

        if (!PAPEIS_PERMITIDOS.includes(currentSession.user?.role)) {
          Alert.alert(
            "Acesso restrito",
            "Essa área é só para administradores, coordenadores e professores."
          );
          router.replace("/tela_inicial");
          return;
        }

        setSession(currentSession);
      } catch (error) {
        console.error("Erro ao verificar acesso:", error);
        router.replace("/");
      } finally {
        setCheckingAccess(false);
      }
    }

    verifyAccess();
  }, []);

  // CARREGAR MATERIAIS ATIVOS
  //
  // Regra de sincronização: o Estoque só mostra material que estiver
  // ATIVO em Materiais. Isso é aplicado no backend via ?ativo=true, não
  // apenas escondido visualmente — quem inativa um material em Materiais
  // faz ele sumir daqui de verdade.

  const loadMaterials = useCallback(async (token) => {
    setLoadingList(true);
    setListError("");

    try {
      const response = await listMaterials(token, { ativo: true });
      setMaterials(response.materials || []);
    } catch (error) {
      console.error("Erro ao carregar estoque:", error);
      setListError(
        error?.message || "Não foi possível carregar o estoque."
      );
    } finally {
      setLoadingList(false);
    }
  }, []);

  useEffect(() => {
    if (session?.token) {
      loadMaterials(session.token);
    }
  }, [session, loadMaterials]);

  // SELECIONAR/DESSELECIONAR UM ITEM (clique no checkbox da linha)

  function toggleSelect(id) {
    setSelectedId((current) => (current === id ? null : id));
  }

  // Filtra por nome, categoria ou C.A — sem diferenciar maiúsculas/minúsculas.
  const termoBusca = searchTerm.trim().toLowerCase();
  const materialsAposBusca = termoBusca
    ? materials.filter((material) =>
        [material.nome, material.categoria, material.ca]
          .filter(Boolean)
          .some((campo) => campo.toLowerCase().includes(termoBusca))
      )
    : materials;

  // Se o filtro "só vencidos" estiver ativo, aplica por cima da busca.
  const materialsBase = mostrarSoVencidos
    ? materialsAposBusca.filter((material) => isVencido(material.validade))
    : materialsAposBusca;

  // Quantidade de itens de cada categoria dentro do que a busca (e o
  // filtro de vencidos) já deixou passar — é exatamente o número de
  // linhas que aparece ao clicar naquela opção.
  const contagemPorCategoria = {
    todas: materialsBase.length,
    EPI: materialsBase.filter((material) => material.categoria === "EPI").length,
    Uniforme: materialsBase.filter((material) => material.categoria === "Uniforme").length,
  };

  // Filtro por categoria (EPI / Uniforme), aplicado por último.
  const filteredMaterials =
    categoriaFiltro === "todas"
      ? materialsBase
      : materialsBase.filter((material) => material.categoria === categoriaFiltro);

  // O item selecionado só vale enquanto estiver visível na lista — assim,
  // ao trocar o filtro ou a busca, "Adicionar/Retirar item" nunca age
  // num item escondido.
  const selectedMaterial =
    filteredMaterials.find((item) => item.id === selectedId) || null;

  // GERAR RELATÓRIO (.xlsx)
  //
  // Exporta a lista de materiais que está sendo exibida (respeita a
  // busca e o filtro de categoria) para uma planilha Excel com título, cabeçalho
  // colorido e largura de coluna ajustada ao conteúdo — evita aquele
  // texto cortado no limite da célula. Por enquanto funciona só
  // rodando o app pelo navegador (web). Dá pra estender pro app nativo
  // depois (com expo-file-system + expo-sharing) se precisarem gerar
  // relatório direto no celular.

  const CORES = {
    verdeEscuro: "FF1B4A3B", // mesmo verde do botão "Verificar" da Tela Inicial
    branco: "FFFFFFFF",
    cinzaTexto: "FF5F6368",
    linhaAlternada: "FFF3F6F4",
    bordaClara: "FFE6E6E6",
    vermelho: "FFC62828", // mesmo vermelho de erro usado no resto do app
  };

  async function handleGerarRelatorio() {
    if (filteredMaterials.length === 0) {
      Alert.alert(
        "Nada para exportar",
        "Não há itens na lista para gerar o relatório."
      );
      return;
    }

    if (Platform.OS !== "web") {
      Alert.alert(
        "Disponível só na versão web",
        "Por enquanto, gerar relatório em .xlsx só funciona rodando o app pelo navegador."
      );
      return;
    }

    try {
      const agora = new Date();

      // Colunas do relatório — separadas (não um texto só) pra dar pra
      // ordenar/filtrar de verdade depois de aberto no Excel.
      const colunas = [
        { header: "Nome", key: "nome", numerica: false },
        { header: "Categoria", key: "categoria", numerica: false },
        { header: "Quantidade", key: "quantidade", numerica: true },
        { header: "Unidade de medida", key: "unidadeMedida", numerica: false },
        { header: "Total (un.)", key: "total", numerica: true },
        { header: "Validade", key: "validade", numerica: false },
        { header: "C.A.", key: "ca", numerica: false },
      ];

      const linhas = filteredMaterials.map((material) => ({
        nome: material.nome,
        categoria: material.categoria,
        quantidade: material.quantidade,
        unidadeMedida: material.unidadeMedida,
        total: material.quantidadeTotal,
        validade: material.validade || "—",
        ca: material.ca || "—",
        vencido: isVencido(material.validade),
      }));

      const totalColunas = colunas.length;

      const workbook = new ExcelJS.Workbook();
      workbook.creator = "Sistema de Estoque";
      workbook.created = agora;

      const worksheet = workbook.addWorksheet("Estoque");

      // Linha 1: título, mesclado ao longo de todas as colunas
      worksheet.mergeCells(1, 1, 1, totalColunas);
      const tituloCell = worksheet.getCell(1, 1);
      tituloCell.value = "Relatório de Estoque";
      tituloCell.font = { size: 16, bold: true, color: { argb: CORES.verdeEscuro } };
      tituloCell.alignment = { vertical: "middle" };
      worksheet.getRow(1).height = 26;

      // Linha 2: subtítulo com data/hora e quantidade de itens
      worksheet.mergeCells(2, 1, 2, totalColunas);
      const subtituloCell = worksheet.getCell(2, 1);
      const horaFormatada = agora.toLocaleTimeString("pt-BR", {
        hour: "2-digit",
        minute: "2-digit",
      });
      subtituloCell.value = `Gerado em ${agora.toLocaleDateString("pt-BR")} às ${horaFormatada} — ${linhas.length} ${linhas.length === 1 ? "item" : "itens"}`;
      subtituloCell.font = { size: 10, italic: true, color: { argb: CORES.cinzaTexto } };

      // Linha 3: espaço em branco só pra dar um respiro visual
      worksheet.getRow(3).height = 8;

      // Linha 4: cabeçalho da tabela
      const headerRowIndex = 4;
      const headerRow = worksheet.getRow(headerRowIndex);
      colunas.forEach((coluna, index) => {
        const cell = headerRow.getCell(index + 1);
        cell.value = coluna.header;
        cell.font = { bold: true, color: { argb: CORES.branco } };
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: CORES.verdeEscuro },
        };
        cell.alignment = { vertical: "middle", horizontal: "center" };
      });
      headerRow.height = 22;

      // Linhas de dados: tudo centralizado, com listras alternadas pra
      // facilitar a leitura — e fundo vermelho/texto branco nos itens
      // com validade vencida (isso se sobrepõe à listra normal).
      linhas.forEach((linha, index) => {
        const row = worksheet.getRow(headerRowIndex + 1 + index);
        colunas.forEach((coluna, colIndex) => {
          const cell = row.getCell(colIndex + 1);
          cell.value = linha[coluna.key];
          cell.alignment = { vertical: "middle", horizontal: "center" };
          cell.border = {
            bottom: { style: "thin", color: { argb: CORES.bordaClara } },
          };

          if (linha.vencido) {
            cell.font = { color: { argb: CORES.branco } };
            cell.fill = {
              type: "pattern",
              pattern: "solid",
              fgColor: { argb: CORES.vermelho },
            };
          } else if (index % 2 === 1) {
            cell.fill = {
              type: "pattern",
              pattern: "solid",
              fgColor: { argb: CORES.linhaAlternada },
            };
          }
        });
      });

      // Largura de cada coluna calculada pelo maior texto que ela recebe,
      // pra nenhum conteúdo ficar cortado no limite da célula.
      colunas.forEach((coluna, index) => {
        const textos = [coluna.header, ...linhas.map((l) => String(l[coluna.key] ?? ""))];
        const maiorTexto = textos.reduce((max, texto) => Math.max(max, texto.length), 0);
        worksheet.getColumn(index + 1).width = Math.min(Math.max(maiorTexto + 4, 12), 40);
      });

      // Mantém título e cabeçalho visíveis ao rolar a planilha
      worksheet.views = [{ state: "frozen", ySplit: headerRowIndex }];

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });

      const dataArquivo = agora.toLocaleDateString("pt-BR").split("/").join("-");
      const nomeArquivo = `relatorio-estoque-${dataArquivo}.xlsx`;

      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = nomeArquivo;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Erro ao gerar relatório:", error);
      Alert.alert("Erro", "Não foi possível gerar o relatório.");
    }
  }

  // ABRIR O MODAL DE ADICIONAR/RETIRAR
  //
  // Os botões "Adicionar item" e "Retirar item" agem sobre o item
  // marcado na tabela — se nada estiver selecionado, avisa o usuário
  // em vez de deixar o botão não fazer nada.

  function openMovement(tipo) {
    if (!selectedMaterial) {
      Alert.alert(
        "Selecione um item",
        "Marque o item na lista (checkbox) antes de adicionar ou retirar quantidade."
      );
      return;
    }
    setMovement({ tipo });
    setMovementQuantidade("");
    setMovementError("");
  }

  function closeMovement() {
    if (movementSaving) return; // não fecha no meio de uma requisição
    setMovement(null);
  }

  // CONFIRMAR ADICIONAR/RETIRAR

  async function handleConfirmMovement() {
    if (movementSaving) return; // evita enviar duas vezes (ex: Enter + clique)

    setMovementError("");

    if (!selectedMaterial) {
      setMovementError("Esse item não está mais disponível. Feche e selecione outro.");
      return;
    }

    // Só número inteiro maior que zero (nada de "2,5", "1e3" ou texto).
    const texto = movementQuantidade.trim();

    if (!/^\d+$/.test(texto) || Number(texto) <= 0) {
      setMovementError("Informe uma quantidade válida: um número inteiro maior que zero.");
      return;
    }

    const quantidade = Number(texto);

    if (quantidade > MOVIMENTACAO_QUANTIDADE_MAXIMA) {
      setMovementError(`A quantidade máxima por operação é ${MOVIMENTACAO_QUANTIDADE_MAXIMA}.`);
      return;
    }

    // Avisa antes de ir ao servidor (o backend confere de novo).
    if (movement.tipo === "retirar" && quantidade > selectedMaterial.quantidade) {
      setMovementError(
        `Estoque insuficiente. Disponível: ${selectedMaterial.quantidade} ${selectedMaterial.unidadeMedida.toLowerCase()}(s).`
      );
      return;
    }

    setMovementSaving(true);

    try {
      const response =
        movement.tipo === "retirar"
          ? await retirarMaterial(session.token, selectedMaterial.id, quantidade)
          : await devolverMaterial(session.token, selectedMaterial.id, quantidade);

      // Atualiza só esse material na lista, sem recarregar tudo.
      setMaterials((current) =>
        current.map((item) =>
          item.id === selectedMaterial.id ? response.material : item
        )
      );

      if (movement.tipo === "retirar") {
        const itemRetirado = {
          nome: selectedMaterial.nome,
          categoria: selectedMaterial.categoria,
          ca: selectedMaterial.ca,
          quantidadeTexto: textoQuantidade(quantidade, selectedMaterial),
          quando: new Date(),
        };
        setRetiradasTermo((atual) => [...atual, itemRetirado]);
        setRetiradaFeita(itemRetirado);
      }

      setMovement(null);
    } catch (error) {
      setMovementError(
        error?.message ||
          `Não foi possível ${
            movement.tipo === "retirar" ? "retirar" : "adicionar"
          } a quantidade.`
      );

      // Se o servidor recusou, a lista na tela pode estar desatualizada
      // (outra pessoa mexeu no estoque). Atualiza os números por baixo,
      // sem fechar o modal nem piscar a tabela.
      listMaterials(session.token, { ativo: true })
        .then((response) => setMaterials(response.materials || []))
        .catch(() => {});
    } finally {
      setMovementSaving(false);
    }
  }

  // GERAR TERMO DE RETIRADA (.pdf)
  //
  // PDF pra imprimir com TODOS os itens retirados desde o último termo.
  // O nome de quem retira sai preenchido com o da conta logada; há campo
  // de assinatura para essa pessoa e para a coordenação.
  function handleGerarTermo() {
    if (retiradasTermo.length === 0) {
      Alert.alert("Nada para o termo", "Retire um item do estoque primeiro.");
      return;
    }

    if (Platform.OS !== "web") {
      Alert.alert(
        "Disponível só na versão web",
        "Por enquanto, gerar o termo em PDF só funciona rodando o app pelo navegador."
      );
      return;
    }

    try {
      const { doc, nomeArquivo } = gerarPdfRetirada({
        itens: retiradasTermo,
        retirante: {
          nome: session?.user?.name || "",
          role: session?.user?.role,
        },
      });
      baixarPdf(doc, nomeArquivo);
      setRetiradasTermo([]);
      setRetiradaFeita(null);
    } catch (error) {
      console.error("Erro ao gerar termo de retirada:", error);
      Alert.alert("Erro", "Não foi possível gerar o termo em PDF.");
    }
  }

  if (checkingAccess) {
    return null;
  }

  return (
    <AppBar>
      <PageHeader
        title="Estoque"
        subtitle="Gerencie os materiais disponíveis no laboratório."
        actions={
          aba !== "materiais" ? null : (
          <>
            <TouchableOpacity
              style={styles.reportButton}
              onPress={handleGerarRelatorio}
            >
              <Text style={styles.reportButtonText}>Gerar relatório</Text>
            </TouchableOpacity>

            {retiradasTermo.length > 0 && (
              <TouchableOpacity style={styles.termoButton} onPress={handleGerarTermo}>
                <Text style={styles.termoButtonText}>
                  Termo de retirada ({retiradasTermo.length})
                </Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={styles.retirarButton}
              onPress={() => openMovement("retirar")}
            >
              <Text style={styles.retirarButtonText}>Retirar item</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.addButton}
              onPress={() => openMovement("adicionar")}
            >
              <Text style={styles.addButtonText}>+ Adicionar item</Text>
            </TouchableOpacity>

            <SearchBox
              value={searchTerm}
              onChangeText={setSearchTerm}
              placeholder="Buscar material..."
            />
          </>
          )
        }
      />

      {/* Abas: materiais x empréstimos de uniforme */}
      <View style={styles.abaRow}>
        {[
          { key: "materiais", label: "Materiais" },
          { key: "emprestimos", label: "Empréstimos de uniforme" },
        ].map((opcao) => {
          const ativa = aba === opcao.key;
          return (
            <TouchableOpacity
              key={opcao.key}
              style={[styles.abaButton, ativa && styles.abaButtonActive]}
              onPress={() => setAba(opcao.key)}
            >
              <Text style={[styles.abaText, ativa && styles.abaTextActive]}>{opcao.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {aba === "emprestimos" ? (
        <EmprestimosEquipe session={session} />
      ) : (
        <>

      {/* Filtro por categoria */}
      <View style={styles.categoriaRow}>
        <Text style={styles.categoriaLabel}>Categoria:</Text>
        {FILTROS_CATEGORIA.map((opcao) => {
          const ativo = categoriaFiltro === opcao.key;
          return (
            <TouchableOpacity
              key={opcao.key}
              style={[styles.categoriaChip, ativo && styles.categoriaChipActive]}
              onPress={() => setCategoriaFiltro(opcao.key)}
            >
              <Text
                style={[styles.categoriaChipText, ativo && styles.categoriaChipTextActive]}
              >
                {opcao.label}
              </Text>
              <View style={[styles.categoriaCount, ativo && styles.categoriaCountActive]}>
                <Text
                  style={[
                    styles.categoriaCountText,
                    ativo && styles.categoriaCountTextActive,
                  ]}
                >
                  {contagemPorCategoria[opcao.key]}
                </Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>

      {mostrarSoVencidos && (
        <View style={styles.filtroChip}>
          <Text style={styles.filtroChipText}>Mostrando só itens vencidos</Text>
          <TouchableOpacity onPress={() => setMostrarSoVencidos(false)}>
            <Text style={styles.filtroChipClose}>Ver todos</Text>
          </TouchableOpacity>
        </View>
      )}

      <ScrollView style={styles.Space} contentContainerStyle={{ paddingBottom: 30 }}>
        <TabelaRolavel larguraMinima={700}>
        <View style={styles.table}>
          {/* Cabeçalho da tabela (fundo cinza, texto em maiúsculas) */}
          <View style={styles.headerRow}>
            <View style={styles.checkboxColumn} />
            {COLUMNS.map((col) => (
              <Text key={col.key} style={[styles.headerCell, { flex: col.flex }]}>
                {col.label}
              </Text>
            ))}
          </View>

          <View style={styles.headerRule} />

          {loadingList && (
            <View style={styles.centerBox}>
              <ActivityIndicator />
            </View>
          )}

          {!loadingList && !!listError && (
            <View style={styles.centerBox}>
              <Text style={styles.errorText}>{listError}</Text>
            </View>
          )}

          {!loadingList && !listError && materials.length === 0 && (
            <View style={styles.centerBox}>
              <Text style={styles.emptyText}>
                Nenhum material ativo no momento. Cadastre ou reative um
                material em Materiais para ele aparecer aqui.
              </Text>
            </View>
          )}

          {!loadingList &&
            !listError &&
            materials.length > 0 &&
            filteredMaterials.length === 0 && (
              <View style={styles.centerBox}>
                <Text style={styles.emptyText}>
                  {searchTerm
                    ? `Nenhum material encontrado para "${searchTerm}".`
                    : mostrarSoVencidos
                    ? categoriaFiltro === "todas"
                      ? "Nenhum item vencido no momento."
                      : `Nenhum item vencido na categoria ${categoriaFiltro}.`
                    : `Nenhum material na categoria ${categoriaFiltro}.`}
                </Text>
              </View>
            )}

          {/* Itens em estoque (só materiais ativos, filtrados pela busca) */}
          {!loadingList &&
            !listError &&
            filteredMaterials.map((material) => {
              const selected = material.id === selectedId;
              const vencido = isVencido(material.validade);
              const estoqueBaixo = isEstoqueBaixo(material);
              return (
                <TouchableOpacity
                  key={material.id}
                  style={[styles.row, vencido && styles.rowVencido]}
                  activeOpacity={0.7}
                  onPress={() => toggleSelect(material.id)}
                >
                  <View style={styles.checkboxColumn}>
                    <View
                      style={[
                        styles.checkbox,
                        vencido && styles.checkboxVencido,
                        selected && styles.checkboxChecked,
                      ]}
                    />
                  </View>
                  {COLUMNS.map((col) =>
                    col.key === "quantidade" && estoqueBaixo ? (
                      // Quantidade + bolinha laranja de "Estoque baixo" (o
                      // aviso aparece ao passar o mouse). Vem do estoque
                      // mínimo cadastrado em Materiais.
                      <View key={col.key} style={[styles.cellWithIndicator, { flex: col.flex }]}>
                        <Text
                          style={[styles.cellInline, vencido && styles.cellVencido]}
                          numberOfLines={1}
                        >
                          {cellValue(material, col.key)}
                        </Text>
                        <LowStockIndicator
                          label={textoEstoqueBaixo(material)}
                          onPress={() => toggleSelect(material.id)}
                        />
                      </View>
                    ) : (
                      <Text
                        key={col.key}
                        style={[styles.cell, { flex: col.flex }, vencido && styles.cellVencido]}
                        numberOfLines={1}
                      >
                        {cellValue(material, col.key)}
                      </Text>
                    )
                  )}
                </TouchableOpacity>
              );
            })}
        </View>
        </TabelaRolavel>
      </ScrollView>
        </>
      )}

      {/* MODAL DE ADICIONAR / RETIRAR QUANTIDADE */}
      <Modal
        visible={!!movement}
        transparent
        animationType="fade"
        onRequestClose={closeMovement}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.formTitle}>
              {movement?.tipo === "retirar" ? "Retirar item" : "Adicionar item"}
            </Text>

            <Text style={styles.modalMaterialNome}>{selectedMaterial?.nome}</Text>

            {movement?.tipo === "retirar" && selectedMaterial && (
              <Text style={styles.helperText}>
                Em estoque: {selectedMaterial.quantidade}{" "}
                {selectedMaterial.unidadeMedida.toLowerCase()}(s)
              </Text>
            )}

            <TextInput
              style={styles.input}
              placeholder={
                selectedMaterial
                  ? `Quantidade de ${selectedMaterial.unidadeMedida.toLowerCase()}(s)`
                  : "Quantidade"
              }
              value={movementQuantidade}
              onChangeText={(texto) => {
                // só dígitos; some o erro antigo assim que a pessoa corrige
                setMovementQuantidade(texto.replace(/\D/g, ""));
                if (movementError) setMovementError("");
              }}
              keyboardType="numeric"
              maxLength={7}
              editable={!movementSaving}
              onSubmitEditing={handleConfirmMovement}
              autoFocus
            />

            {!!movementError && <Text style={styles.errorText}>{movementError}</Text>}

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.actionButton, styles.modalCancelButton]}
                onPress={closeMovement}
                disabled={movementSaving}
              >
                <Text style={styles.actionButtonText}>Cancelar</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.saveButton, movementSaving && styles.buttonDisabled]}
                onPress={handleConfirmMovement}
                disabled={movementSaving}
              >
                {movementSaving ? (
                  <ActivityIndicator color="#ffffff" />
                ) : (
                  <Text style={styles.saveButtonText}>Confirmar</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
      {/* AVISO APÓS RETIRAR: oferece o termo em PDF para assinar */}
      <Modal
        visible={!!retiradaFeita}
        transparent
        animationType="fade"
        onRequestClose={() => setRetiradaFeita(null)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.formTitle}>Retirada registrada</Text>
            <Text style={styles.modalMaterialNome}>
              {retiradaFeita?.quantidadeTexto} de {retiradaFeita?.nome}
            </Text>
            <Text style={styles.helperText}>
              Gere o termo em PDF para imprimir e assinar. Ele inclui{" "}
              {retiradasTermo.length === 1
                ? "este item"
                : `os ${retiradasTermo.length} itens retirados`}
              , o seu nome e o campo de assinatura da coordenação.
            </Text>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.actionButton, styles.modalCancelButton]}
                onPress={() => setRetiradaFeita(null)}
              >
                <Text style={styles.actionButtonText}>Agora não</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.saveButton} onPress={handleGerarTermo}>
                <Text style={styles.saveButtonText}>Gerar termo (PDF)</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </AppBar>
  );
}

const styles = StyleSheet.create({
  // "+ Adicionar item": verde escuro do sistema (#1B4A3B)
  addButton: {
    borderWidth: 1,
    borderColor: "#1B4A3B",
    borderRadius: 4,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: "#1B4A3B",
  },
  addButtonText: {
    fontSize: 15,
    color: "#ffffff",
    fontWeight: "600",
  },
  // abas Materiais / Empréstimos
  abaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: 16,
    paddingTop: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#e0e0e0",
  },
  abaButton: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    minHeight: 44,
    justifyContent: "center",
    borderBottomWidth: 3,
    borderBottomColor: "transparent",
  },
  abaButtonActive: {
    borderBottomColor: "#1B4A3B",
  },
  abaText: {
    fontSize: 16,
    color: "#5f6368",
  },
  abaTextActive: {
    color: "#1B4A3B",
    fontWeight: "700",
  },

  // "Termo de retirada (N)": aparece depois de retirar itens
  termoButton: {
    borderWidth: 1,
    borderColor: "#1B4A3B",
    borderRadius: 4,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: "#e3efe9",
  },
  termoButtonText: {
    fontSize: 15,
    color: "#1B4A3B",
    fontWeight: "600",
  },
  // "Retirar item": fundo branco com borda cinza escura (#495057) — o
  // verde fica reservado só para a ação principal ("Adicionar item").
  retirarButton: {
    borderWidth: 1,
    borderColor: "#495057",
    borderRadius: 4,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: "#ffffff",
  },
  retirarButtonText: {
    fontSize: 15,
    color: "#495057",
    fontWeight: "600",
  },
  // "Gerar relatório": mesmas cores do botão "Novo material" (Materiais)
  reportButton: {
    borderWidth: 1,
    borderColor: "#ed0000",
    borderRadius: 4,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: "#ffffff",
  },
  reportButtonText: {
    fontSize: 15,
    color: "#ed0000",
    fontWeight: "600",
  },
  // Filtro por categoria
  categoriaRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 8,
    paddingHorizontal: 24,
    paddingTop: 12,
  },
  categoriaLabel: {
    fontSize: 15,
    color: "#5f6368",
    marginRight: 4,
  },
  categoriaChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderColor: "#c9c9c9",
    borderRadius: 16,
    paddingLeft: 14,
    paddingRight: 8,
    paddingVertical: 5,
    backgroundColor: "#ffffff",
  },
  categoriaChipActive: {
    borderColor: "#1B4A3B",
    backgroundColor: "#1B4A3B",
  },
  categoriaChipText: {
    fontSize: 15,
    color: "#5f6368",
  },
  categoriaChipTextActive: {
    color: "#ffffff",
    fontWeight: "600",
  },
  // contador de itens dentro do chip ("Todas 4")
  categoriaCount: {
    minWidth: 26,
    minHeight: 24,
    borderRadius: 12,
    paddingHorizontal: 6,
    backgroundColor: "#eeeeee",
    alignItems: "center",
    justifyContent: "center",
  },
  categoriaCountActive: {
    backgroundColor: "rgba(255, 255, 255, 0.22)",
  },
  categoriaCountText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#5f6368",
  },
  categoriaCountTextActive: {
    color: "#ffffff",
  },
  Space: {
    paddingHorizontal: 24,
    paddingTop: 24,
  },
  filtroChip: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#fdeceb",
    borderWidth: 1,
    borderColor: "#f3c8c4",
    borderRadius: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginHorizontal: 24,
    marginTop: 12,
  },
  filtroChipText: {
    fontSize: 15,
    color: "#c62828",
  },
  filtroChipClose: {
    fontSize: 14,
    color: "#c62828",
    fontWeight: "600",
    textDecorationLine: "underline",
  },
  // Tabela ocupa toda a largura disponível (igual à tela de Materiais),
  // com cantos arredondados e borda clara. O overflow "hidden" faz o
  // fundo cinza do cabeçalho respeitar o arredondamento.
  table: {
    width: "100%",
    borderWidth: 1,
    borderColor: "#e6e6e6",
    borderRadius: 8,
    overflow: "hidden",
    backgroundColor: "#ffffff",
  },
  // Cabeçalho: fundo cinza claro como na tela de Materiais
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: "#f5f6f6",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 18,
    borderBottomWidth: 1,
    borderBottomColor: "#ececec",
  },
  checkboxColumn: {
    width: 32,
  },
  checkbox: {
    width: 16,
    height: 16,
    borderWidth: 1,
    borderColor: "#999999",
    borderRadius: 2,
  },
  checkboxChecked: {
    backgroundColor: "#1b4a3b",
    borderColor: "#1b4a3b",
  },
  rowVencido: {
    backgroundColor: "#ce2f3c",
  },
  cellVencido: {
    color: "#ffffff",
  },
  checkboxVencido: {
    borderColor: "#ffffff",
  },
  headerCell: {
    fontSize: 14,
    fontWeight: "600",
    color: "#5f6368",
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  headerRule: {
    height: 1,
    backgroundColor: "#e6e6e6",
  },
  cell: {
    fontSize: 16,
    color: "#1a1a1a",
  },
  // célula da quantidade quando há bolinha de "Estoque baixo" ao lado
  cellWithIndicator: {
    flexDirection: "row",
    alignItems: "center",
    minWidth: 0,
  },
  cellInline: {
    fontSize: 16,
    color: "#1a1a1a",
    flexShrink: 1,
  },
  centerBox: {
    paddingVertical: 24,
    paddingHorizontal: 16,
    alignItems: "center",
  },
  emptyText: {
    color: "#5f6368",
    fontSize: 16,
    textAlign: "center",
  },
  errorText: {
    color: "#c62828",
    fontSize: 15,
    marginBottom: 12,
    textAlign: "center",
  },
  // Modal
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.4)",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  modalCard: {
    backgroundColor: "#ffffff",
    borderRadius: 10,
    padding: 20,
    width: "100%",
    maxWidth: 360,
  },
  formTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#202124",
    marginBottom: 16,
  },
  modalMaterialNome: {
    fontSize: 16,
    fontWeight: "600",
    color: "#202124",
    marginBottom: 4,
  },
  helperText: {
    fontSize: 14,
    color: "#1b4a3b",
    marginBottom: 12,
  },
  input: {
    borderWidth: 1,
    borderColor: "#c9c9c9",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 17,
    color: "#202124",
    marginBottom: 10,
    backgroundColor: "#ffffff",
  },
  modalActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "flex-end",
    gap: 10,
    marginTop: 4,
  },
  actionButton: {
    borderWidth: 1,
    borderColor: "#c9c9c9",
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 10,
    minHeight: 44,
  },
  actionButtonText: {
    fontSize: 16,
    color: "#1a1a1a",
  },
  modalCancelButton: {
    paddingHorizontal: 16,
    justifyContent: "center",
  },
  saveButton: {
    backgroundColor: "#ed0000",
    borderRadius: 6,
    paddingVertical: 12,
    paddingHorizontal: 16,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  saveButtonText: {
    color: "#ffffff",
    fontSize: 17,
    fontWeight: "500",
  },
  buttonDisabled: {
    opacity: 0.5,
  },
});