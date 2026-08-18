import { useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import AppBar from "../components/AppBar";
import PageHeader from "../components/PageHeader";
import SearchBox from "../components/SearchBox";

const COLUMNS = [
  { key: "nome", label: "Nome", flex: 2 },
  { key: "id", label: "ID", flex: 1 },
  { key: "quantidade", label: "Quantidade", flex: 1 },
  { key: "validade", label: "Validade", flex: 1.2 },
  { key: "categoria", label: "Categoria", flex: 1 },
  { key: "ca", label: "C.A", flex: 1 },
];

const ITENS_INICIAIS = [
  {
    id: "112234",
    nome: "Luvas",
    quantidade: "48",
    validade: "12/05/2026",
    categoria: "EPI",
    ca: "11111",
  },
];

// Linhas vazias só pra manter a grade visual, igual ao wireframe
const LINHAS_VAZIAS = 7;

export default function Itens() {
  const [itens] = useState(ITENS_INICIAIS);

  return (
    <AppShell>
      <PageHeader
        title="Editar itens"
        actions={
          <>
            <TouchableOpacity style={styles.addButton}>
              <Text style={styles.addButtonText}>+ Adicionar item</Text>
            </TouchableOpacity>

            <SearchBox />
          </>
        }
      />

      <View style={styles.tableWrapper}>
        <View style={styles.table}>
          {/* Cabeçalho da tabela */}
          <View style={styles.row}>
            <View style={styles.checkboxColumn} />
            {COLUMNS.map((col) => (
              <Text key={col.key} style={[styles.headerCell, { flex: col.flex }]}>
                {col.label}
              </Text>
            ))}
          </View>

          <View style={styles.headerRule} />

          {/* Itens cadastrados */}
          {itens.map((item) => (
            <View key={item.id} style={styles.row}>
              <View style={styles.checkboxColumn}>
                <View style={styles.checkbox} />
              </View>
              {COLUMNS.map((col) => (
                <Text key={col.key} style={[styles.cell, { flex: col.flex }]}>
                  {item[col.key]}
                </Text>
              ))}
            </View>
          ))}

          {/* Linhas vazias para novos itens */}
          {Array.from({ length: LINHAS_VAZIAS }).map((_, index) => (
            <View key={`vazia-${index}`} style={styles.row}>
              <View style={styles.checkboxColumn}>
                <View style={styles.checkbox} />
              </View>
              {COLUMNS.map((col) => (
                <View key={col.key} style={{ flex: col.flex }} />
              ))}
            </View>
          ))}
        </View>
      </View>
    </AppShell>
  );
}

const styles = StyleSheet.create({
  addButton: {
    borderWidth: 1,
    borderColor: "#999999",
    borderRadius: 4,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: "#ffffff",
  },
  addButtonText: {
    fontSize: 13,
    color: "#1a1a1a",
  },
  tableWrapper: {
    paddingHorizontal: 24,
    paddingTop: 8,
  },
  table: {
    borderWidth: 1,
    borderColor: "#cccccc",
    borderRadius: 4,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#e0e0e0",
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
  headerCell: {
    fontSize: 13,
    fontWeight: "600",
    color: "#1a1a1a",
  },
  headerRule: {
    height: 1,
    backgroundColor: "#999999",
  },
  cell: {
    fontSize: 13,
    color: "#1a1a1a",
  },
});
