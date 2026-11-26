// Peças compartilhadas pelo empréstimo de uniforme (Solicitações do aluno e
// aba "Empréstimos" do Estoque): selo de prazo, textos e download do termo em PDF.
import { Alert, Platform, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { gerarPdfEmprestimo } from "../utils/emprestimoPdf";
import { baixarPdf } from "../utils/pdfBase";
import { formatarDataHoraBR } from "../utils/datas";

// Como o empréstimo aparece: texto + tom do selo.
//   pendente  -> laranja     "Aguardando confirmação"
//   recusado  -> vermelho    "Recusado"
//   cancelado -> cinza       "Cancelado"
//   atrasado  -> vermelho    "Atrasado há 3 dias"
//   breve     -> laranja     "Vence amanhã"
//   ok        -> verde       "Devolver até 20/10/2026"
//   devolvido -> cinza       "Devolvido"
export function infoPrazo(e) {
  if (e.status === "pendente") {
    return { tom: "pendente", label: "Aguardando confirmação" };
  }
  if (e.status === "recusado") {
    return { tom: "recusado", label: "Recusado" };
  }
  if (e.status === "cancelado") {
    return { tom: "cancelado", label: "Cancelado" };
  }
  if (e.status === "devolvido") {
    return { tom: "devolvido", label: "Devolvido" };
  }

  const dias = e.diasParaDevolucao;
  if (e.atrasado) {
    const n = Math.abs(dias);
    return { tom: "atrasado", label: `Atrasado há ${n} ${n === 1 ? "dia" : "dias"}` };
  }
  if (dias === 0) return { tom: "breve", label: "Vence hoje" };
  if (dias === 1) return { tom: "breve", label: "Vence amanhã" };
  if (e.venceEmBreve) return { tom: "breve", label: `Vence em ${dias} dias` };
  return { tom: "ok", label: `Devolver até ${e.dataDevolucao}` };
}

export function PrazoBadge({ emprestimo }) {
  const { tom, label } = infoPrazo(emprestimo);
  return (
    <View style={[styles.badge, styles[`badge_${tom}`]]}>
      <Text style={[styles.badgeText, styles[`badgeText_${tom}`]]}>{label}</Text>
    </View>
  );
}

export function textoDevolvido(e) {
  if (e.status !== "devolvido" || !e.devolvidoEm) return "";
  const quem = e.recebidoPorNome ? ` por ${e.recebidoPorNome}` : "";
  return `Devolvido em ${formatarDataHoraBR(e.devolvidoEm)}${quem}`;
}

// "Recusado por Fulano em 07/10/2026 14:30" (vazio se não foi recusado).
export function textoRecusado(e) {
  if (e.status !== "recusado" || !e.respondidoEm) return "";
  const quem = e.respondidoPorNome ? ` por ${e.respondidoPorNome}` : "";
  return `Recusado${quem} em ${formatarDataHoraBR(e.respondidoEm)}`;
}

// "Confirmado por Fulano em 07/10/2026 14:30" (vazio se ainda não foi confirmado).
export function textoConfirmado(e) {
  if (!["emprestado", "devolvido"].includes(e.status) || !e.respondidoEm) return "";
  const quem = e.respondidoPorNome ? ` por ${e.respondidoPorNome}` : "";
  return `Confirmado${quem} em ${formatarDataHoraBR(e.respondidoEm)}`;
}

// Gera o termo de empréstimo (PDF pra imprimir e assinar) e baixa no
// navegador. Como nos outros relatórios, o download só funciona na versão web.
export function baixarTermoEmprestimo(emprestimo) {
  if (Platform.OS !== "web") {
    Alert.alert(
      "Disponível só na versão web",
      "Por enquanto, gerar o termo em PDF só funciona rodando o app pelo navegador."
    );
    return;
  }

  try {
    const { doc, nomeArquivo } = gerarPdfEmprestimo({ emprestimo });
    baixarPdf(doc, nomeArquivo);
  } catch (error) {
    console.error("Erro ao gerar termo de empréstimo:", error);
    Alert.alert("Erro", "Não foi possível gerar o termo em PDF.");
  }
}

// Cartão de um empréstimo na tela do ALUNO (Solicitações): uniforme,
// quantidade, situação do pedido e prazo. O termo em PDF só aparece depois
// que a equipe confirmou o empréstimo; enquanto está pendente, o aluno pode
// cancelar (`onCancelar`).
export function CartaoEmprestimoAluno({ emprestimo: e, onCancelar, cancelando = false }) {
  const confirmado = e.status === "emprestado" || e.status === "devolvido";

  return (
    <View style={styles.card}>
      <View style={styles.cardTop}>
        <View style={styles.cardMain}>
          <Text style={styles.cardTitle}>{e.materialNome}</Text>
          <Text style={styles.cardMeta}>{e.quantidadeTexto} · Empréstimo</Text>
        </View>
        <PrazoBadge emprestimo={e} />
      </View>

      <Text style={styles.cardDate}>
        {e.status === "pendente" || e.status === "recusado" || e.status === "cancelado"
          ? `Devolução pedida para ${e.dataDevolucao}`
          : `Devolução até ${e.dataDevolucao}`}
        {e.status === "devolvido" ? ` · ${textoDevolvido(e)}` : ""}
      </Text>

      {confirmado && !!textoConfirmado(e) && (
        <Text style={styles.cardConfirmado}>{textoConfirmado(e)}</Text>
      )}

      {e.status === "recusado" && (
        <>
          <Text style={styles.cardRecusado}>{textoRecusado(e)}</Text>
          {!!e.motivoRecusa && <Text style={styles.cardNote}>Motivo: {e.motivoRecusa}</Text>}
        </>
      )}

      {!!e.observacao && <Text style={styles.cardNote}>Observação: {e.observacao}</Text>}

      {e.status === "pendente" && (
        <View style={styles.pendenteRow}>
          <Text style={styles.pendenteText}>
            Aguarde a confirmação de um professor ou coordenador para retirar o uniforme.
          </Text>
          {!!onCancelar && (
            <TouchableOpacity
              style={[styles.cancelButton, cancelando && styles.buttonDisabled]}
              onPress={() => onCancelar(e)}
              disabled={cancelando}
            >
              <Text style={styles.cancelButtonText}>Cancelar pedido</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {confirmado && (
        <TouchableOpacity style={styles.pdfButton} onPress={() => baixarTermoEmprestimo(e)}>
          <Text style={styles.pdfButtonText}>Baixar termo (PDF)</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#ffffff",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#e6e6e6",
    padding: 16,
    marginBottom: 12,
    maxWidth: 720,
  },
  cardTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: 10,
  },
  cardMain: { flex: 1, minWidth: 180 },
  cardTitle: { fontSize: 17, fontWeight: "600", color: "#202124" },
  cardMeta: { fontSize: 15, color: "#5f6368", marginTop: 2 },
  cardDate: { fontSize: 15, color: "#5f6368", marginTop: 10 },
  cardNote: { fontSize: 15, color: "#3c3c3c", marginTop: 6 },
  cardConfirmado: { fontSize: 15, color: "#1b6b3a", marginTop: 6 },
  cardRecusado: { fontSize: 15, color: "#c62828", marginTop: 6 },
  pendenteRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    marginTop: 12,
  },
  pendenteText: { flex: 1, minWidth: 180, fontSize: 14, color: "#80868b", fontStyle: "italic" },
  cancelButton: {
    borderWidth: 1,
    borderColor: "#495057",
    borderRadius: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: "#ffffff",
  },
  cancelButtonText: { fontSize: 14, color: "#495057", fontWeight: "600" },
  buttonDisabled: { opacity: 0.5 },
  pdfButton: {
    alignSelf: "flex-start",
    borderWidth: 1,
    borderColor: "#495057",
    borderRadius: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    minHeight: 44,
    justifyContent: "center",
    marginTop: 14,
    backgroundColor: "#ffffff",
  },
  pdfButtonText: { fontSize: 15, color: "#495057", fontWeight: "600" },
  badge: {
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 5,
    alignSelf: "flex-start",
  },
  badgeText: {
    fontSize: 14,
    fontWeight: "600",
  },
  badge_atrasado: { backgroundColor: "#fdeceb" },
  badgeText_atrasado: { color: "#c62828" },
  badge_breve: { backgroundColor: "#fff4e0" },
  badgeText_breve: { color: "#b26a00" },
  badge_ok: { backgroundColor: "#e6f4ea" },
  badgeText_ok: { color: "#1b6b3a" },
  badge_devolvido: { backgroundColor: "#eeeeee" },
  badgeText_devolvido: { color: "#5f6368" },
  badge_pendente: { backgroundColor: "#fff4e0" },
  badgeText_pendente: { color: "#b26a00" },
  badge_recusado: { backgroundColor: "#fdeceb" },
  badgeText_recusado: { color: "#c62828" },
  badge_cancelado: { backgroundColor: "#eeeeee" },
  badgeText_cancelado: { color: "#5f6368" },
});
