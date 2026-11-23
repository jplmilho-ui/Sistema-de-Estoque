// Tela "Solicitações" — única tela do ALUNO (versão reduzida do sistema).
//
// O aluno pode:
//   - SOLICITAR EPI (passa por aprovação de professor/coordenador/admin);
//   - acompanhar as solicitações pendentes (e cancelar, se desistir);
//   - ver o histórico das já respondidas (aprovadas, recusadas, canceladas).
//
// UNIFORME não pode ser solicitado: o aluno só consegue PEDIR EMPRESTADO.
// Ele informa a data de devolução e o pedido fica PENDENTE até um professor,
// coordenador ou admin confirmar (só então o uniforme sai do estoque e o
// aluno pode retirar). Depois da confirmação ele baixa o termo em PDF pra
// assinar. Os empréstimos e seus prazos aparecem aqui mesmo, e os avisos de
// resposta e de devolução chegam pelo sino de notificações.
//
// Quem aprova ou recusa solicitações são admin, coordenador e professor,
// pelo sino de notificações (ver components/NotificationsPopup.js).
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
} from "react-native";
import { router } from "expo-router";
import AppBar from "../components/AppBar";
import PageHeader from "../components/PageHeader";
import useLayout from "../components/useLayout";
import { CartaoEmprestimoAluno } from "../components/emprestimoComum";
import { confirmAction } from "../utils/confirmAction";
import { getSession } from "../services/authStorage";
import {
  ROTULO_POR_UNIDADE,
  paraUnidades,
  rotuloPorEmbalagem,
  temEmbalagem,
  textoQuantidade,
} from "../utils/quantidade";
import {
  listMateriaisDisponiveis,
  listMinhasSolicitacoes,
  criarSolicitacao,
  cancelarSolicitacao,
} from "../services/solicitacoesApi";
import {
  listUniformesDisponiveis,
  listMeusEmprestimos,
  criarEmprestimo,
  cancelarEmprestimo,
} from "../services/emprestimosApi";
import { diasAte, formatarDataBR, hoje, lerDataBR, mascararData } from "../utils/datas";

const QUANTIDADE_MAX_DIGITOS = 4;
const OBSERVACAO_MAX = 300;
const ATUALIZACAO_MS = 30 * 1000; // o aluno vê as respostas sem precisar recarregar

const PRAZO_MAXIMO_PADRAO = 30;

// Atalhos de data de devolução.
const ATALHOS_PRAZO = [
  { label: "Amanhã", dias: 1 },
  { label: "Em 3 dias", dias: 3 },
  { label: "Em 7 dias", dias: 7 },
];

function dataEmDias(dias) {
  const d = hoje();
  d.setDate(d.getDate() + dias);
  return formatarDataBR(d);
}

function validarDataDevolucao(texto, prazoMaximo) {
  const data = lerDataBR(texto);
  if (!data) return "Informe a data de devolução no formato DD/MM/AAAA.";

  const dias = diasAte(data);
  if (dias < 0) return "A data de devolução não pode ser anterior a hoje.";
  if (dias > prazoMaximo) return `O prazo máximo de empréstimo é de ${prazoMaximo} dias.`;
  return "";
}

// rótulo + estilo de cada status
const STATUS_INFO = {
  pendente: { label: "Pendente", badge: "badgePendente", text: "badgePendenteText" },
  aprovada: { label: "Aprovada", badge: "badgeAprovada", text: "badgeAprovadaText" },
  recusada: { label: "Recusada", badge: "badgeRecusada", text: "badgeRecusadaText" },
  cancelada: { label: "Cancelada", badge: "badgeCancelada", text: "badgeCanceladaText" },
};

function formatarDataHora(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const dia = String(d.getDate()).padStart(2, "0");
  const mes = String(d.getMonth() + 1).padStart(2, "0");
  const hora = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  return `${dia}/${mes}/${d.getFullYear()} ${hora}:${min}`;
}

export default function Solicitacoes() {
  const { celular } = useLayout();

  // CONTROLE DE ACESSO: só o aluno usa esta tela.
  const [checkingAccess, setCheckingAccess] = useState(true);
  const [session, setSession] = useState(null);

  // lista de pedidos do aluno
  const [solicitacoes, setSolicitacoes] = useState([]);
  const [loadingList, setLoadingList] = useState(true);
  const [listError, setListError] = useState("");

  // formulário de nova solicitação
  const [formOpen, setFormOpen] = useState(false);
  const [materiais, setMateriais] = useState([]);
  const [loadingMateriais, setLoadingMateriais] = useState(false);
  const [materialId, setMaterialId] = useState(null);
  const [quantidade, setQuantidade] = useState("");
  // Em que unidade o aluno digita: "embalagem" (ex: caixas) ou "unidade".
  const [unidadeEntrada, setUnidadeEntrada] = useState("embalagem");
  const [observacao, setObservacao] = useState("");
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);

  // O que o aluno quer fazer:
  //   "solicitar"  -> pedir um EPI (precisa de aprovação)
  //   "emprestimo" -> pedir um uniforme emprestado (também precisa de
  //                   confirmação de um professor/coordenador)
  // Uniforme só existe no modo "emprestimo"; EPI só no modo "solicitar".
  const [emprestimos, setEmprestimos] = useState([]);
  const [modo, setModo] = useState("solicitar");
  const [dataTexto, setDataTexto] = useState("");
  const [prazoMaximo, setPrazoMaximo] = useState(PRAZO_MAXIMO_PADRAO);
  // uniformes que podem ser emprestados agora (ativos e com estoque)
  const [uniformes, setUniformes] = useState([]);
  // último pedido de empréstimo enviado (mostra o aviso de "aguardando")
  const [criado, setCriado] = useState(null);
  // id do pedido de empréstimo que está sendo cancelado
  const [cancelingEmprestimoId, setCancelingEmprestimoId] = useState(null);

  // id do pedido que está sendo cancelado
  const [cancelingId, setCancelingId] = useState(null);

  useEffect(() => {
    async function verifyAccess() {
      try {
        const currentSession = await getSession();

        if (!currentSession?.token) {
          router.replace("/");
          return;
        }

        if (currentSession.user?.role !== "aluno") {
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

  const loadSolicitacoes = useCallback(async (token, { silencioso = false } = {}) => {
    if (!silencioso) setLoadingList(true);
    try {
      const data = await listMinhasSolicitacoes(token);
      setSolicitacoes(data.solicitacoes || []);
      setListError("");
    } catch (error) {
      // numa atualização automática, não troca a lista por uma mensagem de erro
      if (!silencioso) setListError(error.message);
    } finally {
      if (!silencioso) setLoadingList(false);
    }
  }, []);

  // Empréstimos do aluno. Erro aqui não derruba a tela: a lista de
  // solicitações já mostra a mensagem de falha de conexão.
  const loadEmprestimos = useCallback(async (token) => {
    try {
      const data = await listMeusEmprestimos(token);
      setEmprestimos(data.emprestimos || []);
    } catch (error) {
      // mantém o que já estava na tela
    }
  }, []);

  useEffect(() => {
    if (!session?.token) return;
    loadSolicitacoes(session.token);
    loadEmprestimos(session.token);
    const timer = setInterval(() => {
      loadSolicitacoes(session.token, { silencioso: true });
      loadEmprestimos(session.token);
    }, ATUALIZACAO_MS);
    return () => clearInterval(timer);
  }, [session, loadSolicitacoes, loadEmprestimos]);

  async function loadMateriais() {
    setLoadingMateriais(true);
    try {
      const data = await listMateriaisDisponiveis(session.token);
      setMateriais(data.materiais || []);
    } catch (error) {
      setFormError(error.message);
    } finally {
      setLoadingMateriais(false);
    }

    // Quais uniformes podem ser emprestados agora, e o prazo máximo.
    try {
      const unif = await listUniformesDisponiveis(session.token);
      setUniformes(unif.materiais || []);
      if (unif.regras?.prazoMaximoDias) setPrazoMaximo(unif.regras.prazoMaximoDias);
    } catch (error) {
      setUniformes([]); // sem a lista, não há uniforme pra emprestar
    }
  }

  function resetForm() {
    setMaterialId(null);
    setQuantidade("");
    setUnidadeEntrada("embalagem");
    setObservacao("");
    setModo("solicitar");
    setDataTexto("");
    setFormError("");
  }

  function toggleForm() {
    if (formOpen) {
      setFormOpen(false);
      resetForm();
      return;
    }
    setCriado(null);
    setFormOpen(true);
    resetForm();
    loadMateriais(); // sempre busca a lista fresca ao abrir
  }

  const emprestando = modo === "emprestimo";

  // Lista mostrada no formulário: uniformes (empréstimo) ou EPIs (pedido).
  // O filtro por categoria é uma segunda barreira: o backend já só devolve
  // EPI em /solicitacoes/materiais-disponiveis.
  const materiaisVisiveis = emprestando
    ? uniformes
    : materiais.filter((m) => m.categoria === "EPI");

  const materialSelecionado =
    materiaisVisiveis.find((m) => m.id === materialId) || null;

  // Saldo disponível, sempre em UNIDADES.
  const disponivelEmUnidades = materialSelecionado?.quantidadeTotal || 0;

  // Item que vem em caixa/pacote: o aluno só escolhe entre embalagem e
  // unidade se o material permitir (permiteFracionar). Se não
  // permitir, o pedido é sempre por embalagem fechada.
  const materialComEmbalagem = !!materialSelecionado && temEmbalagem(materialSelecionado);
  const podeEscolherUnidade =
    materialComEmbalagem && materialSelecionado.permiteFracionar !== false;
  const entradaEfetiva = podeEscolherUnidade ? unidadeEntrada : "embalagem";

  // Rótulo do campo de quantidade: "caixa(s)" (embalagem fechada) ou "unidades".
  const rotuloUnidade = !materialSelecionado
    ? ""
    : materialComEmbalagem && entradaEfetiva === "embalagem"
    ? `${materialSelecionado.unidadeMedida.toLowerCase()}(s)`
    : "unidades";

  function trocarModo(novoModo) {
    if (novoModo === modo) return;
    setModo(novoModo);
    setMaterialId(null); // a lista muda: a escolha anterior não vale mais
    setUnidadeEntrada("embalagem");
    setFormError("");
  }
  async function handleSubmit() {
    setFormError("");

    if (!materialSelecionado) {
      setFormError(
        emprestando
          ? "Escolha o uniforme que você quer pegar emprestado."
          : "Escolha o EPI que você precisa."
      );
      return;
    }

    const qtd = Number(quantidade);
    if (!Number.isInteger(qtd) || qtd <= 0) {
      setFormError("Informe uma quantidade válida, maior que zero.");
      return;
    }

    // Tudo é comparado em UNIDADES (o servidor confere de novo).
    const unidadesPedidas = paraUnidades(qtd, entradaEfetiva, materialSelecionado);
    if (unidadesPedidas > disponivelEmUnidades) {
      setFormError(
        `Quantidade indisponível. Disponível: ${textoQuantidade(disponivelEmUnidades, materialSelecionado)}.`
      );
      return;
    }

    if (emprestando) {
      const erroData = validarDataDevolucao(dataTexto, prazoMaximo);
      if (erroData) {
        setFormError(erroData);
        return;
      }

      setSaving(true);
      try {
        const { emprestimo } = await criarEmprestimo(session.token, {
          materialId: materialSelecionado.id,
          quantidade: qtd,
          unidade: entradaEfetiva,
          dataDevolucao: dataTexto,
          observacao: observacao.trim() || undefined,
        });

        setFormOpen(false);
        resetForm();
        setCriado(emprestimo);
        await loadEmprestimos(session.token);
      } catch (error) {
        setFormError(error.message);
      } finally {
        setSaving(false);
      }
      return;
    }

    setSaving(true);
    try {
      await criarSolicitacao(session.token, {
        materialId: materialSelecionado.id,
        quantidade: qtd,
        unidade: entradaEfetiva,
        observacao: observacao.trim() || undefined,
      });

      setFormOpen(false);
      resetForm();
      await loadSolicitacoes(session.token, { silencioso: true });
    } catch (error) {
      setFormError(error.message);
    } finally {
      setSaving(false);
    }
  }

  function handleCancelEmprestimo(emprestimo) {
    confirmAction({
      title: "Cancelar pedido de empréstimo",
      message: `Deseja cancelar o pedido de ${emprestimo.quantidadeTexto} de "${emprestimo.materialNome}"?`,
      confirmText: "Cancelar pedido",
      cancelText: "Voltar",
      onConfirm: async () => {
        setCancelingEmprestimoId(emprestimo.id);
        try {
          await cancelarEmprestimo(session.token, emprestimo.id);
        } catch (error) {
          Alert.alert("Não foi possível cancelar", error.message);
        } finally {
          setCancelingEmprestimoId(null);
          loadEmprestimos(session.token);
        }
      },
    });
  }

  function handleCancel(solicitacao) {
    confirmAction({
      title: "Cancelar solicitação",
      message: `Deseja cancelar o pedido de ${solicitacao.quantidadeTexto} de "${solicitacao.materialNome}"?`,
      confirmText: "Cancelar pedido",
      cancelText: "Voltar",
      onConfirm: async () => {
        setCancelingId(solicitacao.id);
        try {
          await cancelarSolicitacao(session.token, solicitacao.id);
        } catch (error) {
          Alert.alert("Não foi possível cancelar", error.message);
        } finally {
          setCancelingId(null);
          loadSolicitacoes(session.token, { silencioso: true });
        }
      },
    });
  }

  if (checkingAccess) {
    return null;
  }

  const pendentes = solicitacoes.filter((s) => s.status === "pendente");
  const historico = solicitacoes.filter((s) => s.status !== "pendente");
  // Empréstimos por situação:
  //   pendente              -> aguardando confirmação (vai em "Em andamento")
  //   emprestado            -> confirmado, aluno precisa devolver
  //   devolvido/recusado/
  //   cancelado             -> encerrados (vão no "Histórico")
  const emprestimosPendentes = emprestimos.filter((e) => e.status === "pendente");
  const emprestadosAbertos = emprestimos.filter((e) => e.status === "emprestado");
  const emprestimosEncerrados = emprestimos.filter((e) =>
    ["devolvido", "recusado", "cancelado"].includes(e.status)
  );
  const totalPendentes = pendentes.length + emprestimosPendentes.length;

  function renderCard(solicitacao) {
    const info = STATUS_INFO[solicitacao.status] || STATUS_INFO.pendente;

    return (
      <View
        key={solicitacao.id}
        style={styles.requestCard}
        accessible={true}
        accessibilityLabel={`Solicitação de ${solicitacao.materialNome}, quantidade: ${solicitacao.quantidadeTexto}, status: ${info.label}, solicitada em ${formatarDataHora(solicitacao.criadoEm)}${solicitacao.observacao ? `, observação: ${solicitacao.observacao}` : ""}${solicitacao.status === "aprovada" ? `, aprovada por ${solicitacao.respondidoPorNome}` : ""}${solicitacao.status === "recusada" ? `, recusada por ${solicitacao.respondidoPorNome}${solicitacao.motivoRecusa ? `, motivo: ${solicitacao.motivoRecusa}` : ""}` : ""}`}
      >
        <View style={styles.requestTop}>
          <View style={styles.requestMain}>
            <Text style={styles.requestTitle}>{solicitacao.materialNome}</Text>
            <Text style={styles.requestMeta}>
              {solicitacao.quantidadeTexto} · {solicitacao.categoria}
            </Text>
          </View>

          <View style={[styles.badge, styles[info.badge]]}>
            <Text style={[styles.badgeText, styles[info.text]]}>{info.label}</Text>
          </View>
        </View>

        <Text style={styles.requestDate}>
          Solicitada em {formatarDataHora(solicitacao.criadoEm)}
        </Text>

        {!!solicitacao.observacao && (
          <Text style={styles.requestNote}>Observação: {solicitacao.observacao}</Text>
        )}

        {solicitacao.status === "aprovada" && (
          <Text style={styles.requestResult}>
            Aprovada por {solicitacao.respondidoPorNome} em{" "}
            {formatarDataHora(solicitacao.respondidoEm)}
          </Text>
        )}

        {solicitacao.status === "recusada" && (
          <>
            <Text style={styles.requestResultRecusada}>
              Recusada por {solicitacao.respondidoPorNome} em{" "}
              {formatarDataHora(solicitacao.respondidoEm)}
            </Text>
            {!!solicitacao.motivoRecusa && (
              <Text style={styles.requestNote}>Motivo: {solicitacao.motivoRecusa}</Text>
            )}
          </>
        )}

        {solicitacao.status === "pendente" && (
          <View style={styles.requestActions}>
            <Text style={styles.waitingText}>Aguardando resposta…</Text>
            <TouchableOpacity
              style={[styles.cancelButton, cancelingId === solicitacao.id && styles.buttonDisabled]}
              onPress={() => handleCancel(solicitacao)}
              disabled={cancelingId === solicitacao.id}
              accessibilityRole="button"
              accessibilityLabel={`Cancelar pedido de ${solicitacao.quantidadeTexto} de ${solicitacao.materialNome}`}
              accessibilityHint="Cancela esta solicitação pendente"
              hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
            >
              <Text style={styles.cancelButtonText}>Cancelar pedido</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  }

  return (
    <AppBar>
      <PageHeader
        title="Solicitações"
        subtitle="Peça EPIs, pegue uniformes emprestados e acompanhe seus pedidos."
        actions={
          <TouchableOpacity
            style={styles.newButton}
            onPress={toggleForm}
            accessibilityRole="button"
            accessibilityLabel={formOpen ? "Cancelar solicitação" : "Nova solicitação"}
            accessibilityHint="Abre ou fecha o formulário para fazer um pedido de EPI ou empréstimo de uniforme"
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text style={styles.newButtonText}>
              {formOpen ? "Cancelar" : "Nova solicitação"}
            </Text>
          </TouchableOpacity>
        }
      />

      <ScrollView
        style={styles.space}
        contentContainerStyle={[styles.spaceContent, celular && styles.spaceContentCelular]}
      >
        {/* AVISO DE PEDIDO DE EMPRÉSTIMO ENVIADO */}
        {!!criado && (
          <View
            style={styles.successCard}
            accessibilityRole="alert"
            accessibilityLiveRegion="polite"
          >
            <Text style={styles.successTitle}>Pedido de empréstimo enviado</Text>
            <Text style={styles.successText}>
              Seu pedido de {criado.quantidadeTexto} de "{criado.materialNome}" está aguardando a
              confirmação de um professor ou coordenador. Você só pode retirar o uniforme depois
              da confirmação, e deve devolver até {criado.dataDevolucao}. Você será avisado pelo
              sino de notificações.
            </Text>
            <View style={styles.successActions}>
              <TouchableOpacity
                style={styles.ghostButton}
                onPress={() => setCriado(null)}
                accessibilityRole="button"
                accessibilityLabel="Fechar aviso de confirmação"
              >
                <Text style={styles.ghostButtonText}>Fechar</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* FORMULÁRIO */}
        {formOpen && (
          <View style={styles.formCard} accessible={false}>
            <Text
              style={styles.formTitle}
              accessibilityRole="header"
              aria-level={2}
            >
              {emprestando ? "Pedido de empréstimo de uniforme" : "Solicitação de EPI"}
            </Text>

            <Text style={styles.fieldLabel} nativeID="modoLabel">O que você quer fazer?</Text>
            <View
              style={styles.chipRow}
              accessibilityRole="radiogroup"
              aria-labelledby="modoLabel"
            >
              <TouchableOpacity
                style={[styles.chip, !emprestando && styles.chipActive]}
                onPress={() => trocarModo("solicitar")}
                accessibilityRole="radio"
                accessibilityLabel="Solicitar EPI"
                accessibilityState={{ selected: !emprestando }}
                hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
              >
                <Text style={[styles.chipText, !emprestando && styles.chipTextActive]}>
                  Solicitar EPI
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.chip, emprestando && styles.chipActive]}
                onPress={() => trocarModo("emprestimo")}
                accessibilityRole="radio"
                accessibilityLabel="Emprestar uniforme"
                accessibilityState={{ selected: emprestando }}
                hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
              >
                <Text style={[styles.chipText, emprestando && styles.chipTextActive]}>
                  Emprestar uniforme
                </Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.fieldHelp}>
              {emprestando
                ? "O pedido precisa ser confirmado por um professor ou coordenador. Você só retira o uniforme depois da confirmação e precisa devolver na data escolhida."
                : "O pedido de EPI precisa ser aprovado por um professor ou coordenador."}
            </Text>

            <Text style={styles.fieldLabel}>{emprestando ? "Uniforme" : "EPI"}</Text>

            <View style={styles.materialList}>
              {loadingMateriais && (
                <View style={styles.centerBox}>
                  <ActivityIndicator color="#1B4A3B" accessibilityLabel="Carregando materiais..." />
                </View>
              )}

              {!loadingMateriais && materiaisVisiveis.length === 0 && (
                <View style={styles.centerBox}>
                  <Text style={styles.emptyText}>
                    {emprestando
                      ? "Nenhum uniforme disponível para empréstimo no momento."
                      : "Nenhum EPI disponível para solicitação no momento."}
                  </Text>
                </View>
              )}

              {!loadingMateriais && materiaisVisiveis.length > 0 && (
                <ScrollView style={styles.materialScroll} nestedScrollEnabled>
                  {materiaisVisiveis.map((material) => {
                    const ativo = material.id === materialId;
                    return (
                      <TouchableOpacity
                        key={material.id}
                        style={[styles.materialOption, ativo && styles.materialOptionActive]}
                        onPress={() => {
                          setMaterialId(material.id);
                          setUnidadeEntrada("embalagem");
                          if (formError) setFormError("");
                        }}
                        accessibilityRole="radio"
                        accessibilityLabel={`${material.nome}, categoria: ${material.categoria}`}
                        accessibilityState={{ selected: ativo }}
                      >
                        <Text
                          style={[styles.materialName, ativo && styles.materialNameActive]}
                        >
                          {material.nome}
                        </Text>
                        <Text style={styles.materialCategory}>{material.categoria}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              )}
            </View>

            {podeEscolherUnidade && (
              <>
                <Text style={styles.fieldLabel} nativeID="unidadeLabel">Pedir por</Text>
                <View
                  style={styles.chipRow}
                  accessibilityRole="radiogroup"
                  aria-labelledby="unidadeLabel"
                >
                  {[
                    { key: "embalagem", label: rotuloPorEmbalagem(materialSelecionado) },
                    { key: "unidade", label: ROTULO_POR_UNIDADE },
                  ].map((opcao) => {
                    const ativo = unidadeEntrada === opcao.key;
                    return (
                      <TouchableOpacity
                        key={opcao.key}
                        style={[styles.chip, ativo && styles.chipActive]}
                        onPress={() => setUnidadeEntrada(opcao.key)}
                        disabled={saving}
                        accessibilityRole="radio"
                        accessibilityLabel={`Pedir por ${opcao.label}`}
                        accessibilityState={{ selected: ativo }}
                        hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                      >
                        <Text style={[styles.chipText, ativo && styles.chipTextActive]}>
                          {opcao.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </>
            )}

            <Text style={styles.fieldLabel}>
              Quantidade{rotuloUnidade ? ` (em ${rotuloUnidade})` : ""}
            </Text>
            <TextInput
              style={styles.input}
              placeholder="Ex: 2"
              value={quantidade}
              onChangeText={(texto) => setQuantidade(texto.replace(/\D/g, ""))}
              keyboardType="numeric"
              maxLength={QUANTIDADE_MAX_DIGITOS}
              editable={!saving}
              accessible={true}
              accessibilityLabel={`Quantidade desejada${rotuloUnidade ? ` em ${rotuloUnidade}` : ""}`}
              accessibilityHint="Digite a quantidade a ser solicitada"
            />
            {!!materialSelecionado && (
              <Text style={styles.fieldHelp}>
                Disponível: {textoQuantidade(disponivelEmUnidades, materialSelecionado)}.
                {materialComEmbalagem && !podeEscolherUnidade
                  ? " Este item só é entregue por embalagem fechada."
                  : ""}
              </Text>
            )}

            {emprestando && (
              <>
                <Text style={styles.fieldLabel} nativeID="atalhoPrazoLabel">Data de devolução</Text>
                <View
                  style={styles.chipRow}
                  accessibilityRole="radiogroup"
                  aria-labelledby="atalhoPrazoLabel"
                >
                  {ATALHOS_PRAZO.map((atalho) => {
                    const valor = dataEmDias(atalho.dias);
                    const ativo = dataTexto === valor;
                    return (
                      <TouchableOpacity
                        key={atalho.label}
                        style={[styles.chip, ativo && styles.chipActive]}
                        onPress={() => setDataTexto(valor)}
                        disabled={saving}
                        accessibilityRole="button"
                        accessibilityLabel={`Prazo: ${atalho.label} (${valor})`}
                        accessibilityState={{ selected: ativo }}
                        hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                      >
                        <Text style={[styles.chipText, ativo && styles.chipTextActive]}>
                          {atalho.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
                <TextInput
                  style={styles.input}
                  placeholder="DD/MM/AAAA"
                  value={dataTexto}
                  onChangeText={(texto) => setDataTexto(mascararData(texto))}
                  keyboardType="numeric"
                  maxLength={10}
                  editable={!saving}
                  accessible={true}
                  accessibilityLabel="Data de devolução"
                  accessibilityHint="Digite a data de devolução no formato dia, mês e ano DD/MM/AAAA"
                />
                <Text style={styles.fieldHelp}>
                  Prazo máximo: {prazoMaximo} dias a partir de hoje.
                </Text>
              </>
            )}

            <Text style={styles.fieldLabel}>Observação (opcional)</Text>
            <TextInput
              style={[styles.input, styles.inputMultiline]}
              placeholder="Ex: para a aula prática de quinta-feira"
              value={observacao}
              onChangeText={setObservacao}
              multiline
              maxLength={OBSERVACAO_MAX}
              editable={!saving}
              accessible={true}
              accessibilityLabel="Observação"
              accessibilityHint="Campo opcional para justificativa ou detalhes do pedido"
            />

            {!!formError && (
              <Text
                style={styles.errorText}
                accessibilityRole="alert"
                accessibilityLiveRegion="assertive"
              >
                {formError}
              </Text>
            )}

            <TouchableOpacity
              style={[styles.saveButton, saving && styles.buttonDisabled]}
              onPress={handleSubmit}
              disabled={saving}
              accessibilityRole="button"
              accessibilityLabel={
                saving
                  ? "Enviando..."
                  : emprestando
                  ? "Enviar pedido de empréstimo"
                  : "Enviar solicitação"
              }
              accessibilityHint="Envia a solicitação para aprovação"
              accessibilityState={{ busy: saving, disabled: saving }}
            >
              {saving ? (
                <ActivityIndicator color="#ffffff" accessibilityLabel="Enviando..." />
              ) : (
                <Text style={styles.saveButtonText}>
                  {emprestando ? "Enviar pedido de empréstimo" : "Enviar solicitação"}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        )}

        {loadingList && (
          <View style={styles.centerBox}>
            <ActivityIndicator color="#1B4A3B" accessibilityLabel="Carregando solicitações..." />
          </View>
        )}

        {!loadingList && !!listError && (
          <View style={styles.centerBox}>
            <Text
              style={styles.errorText}
              accessibilityRole="alert"
              accessibilityLiveRegion="assertive"
            >
              {listError}
            </Text>
            <TouchableOpacity
              onPress={() => loadSolicitacoes(session.token)}
              accessibilityRole="button"
              accessibilityLabel="Tentar carregar solicitações novamente"
            >
              <Text style={styles.retryText}>Tentar novamente</Text>
            </TouchableOpacity>
          </View>
        )}

        {!loadingList && !listError && (
          <>
            {/* UNIFORMES EMPRESTADOS (com prazo de devolução) */}
            {emprestadosAbertos.length > 0 && (
              <>
                <Text
                  style={styles.sectionTitle}
                  accessibilityRole="header"
                  aria-level={2}
                >
                  Uniformes para devolver ({emprestadosAbertos.length})
                </Text>
                {emprestadosAbertos.map((e) => (
                  <CartaoEmprestimoAluno key={`emp-${e.id}`} emprestimo={e} />
                ))}
              </>
            )}

            {/* EM ANDAMENTO: solicitações de EPI e pedidos de empréstimo
                aguardando confirmação */}
            <Text
              style={styles.sectionTitle}
              accessibilityRole="header"
              aria-level={2}
            >
              Em andamento{totalPendentes > 0 ? ` (${totalPendentes})` : ""}
            </Text>
            {totalPendentes === 0 ? (
              <Text style={styles.sectionEmpty}>
                Você não tem pedidos aguardando resposta.
              </Text>
            ) : (
              <>
                {pendentes.map(renderCard)}
                {emprestimosPendentes.map((e) => (
                  <CartaoEmprestimoAluno
                    key={`emp-${e.id}`}
                    emprestimo={e}
                    onCancelar={handleCancelEmprestimo}
                    cancelando={cancelingEmprestimoId === e.id}
                  />
                ))}
              </>
            )}

            {/* HISTÓRICO */}
            <Text
              style={styles.sectionTitle}
              accessibilityRole="header"
              aria-level={2}
            >
              Histórico
            </Text>
            {historico.length === 0 && emprestimosEncerrados.length === 0 ? (
              <Text style={styles.sectionEmpty}>
                Seus pedidos respondidos e uniformes devolvidos aparecem aqui.
              </Text>
            ) : (
              <>
                {historico.map(renderCard)}
                {emprestimosEncerrados.map((e) => (
                  <CartaoEmprestimoAluno key={`emp-${e.id}`} emprestimo={e} />
                ))}
              </>
            )}
          </>
        )}
      </ScrollView>
    </AppBar>
  );
}

const styles = StyleSheet.create({
  space: {
    flex: 1,
  },
  spaceContent: {
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 40,
  },
  spaceContentCelular: {
    paddingHorizontal: 16,
  },

  // aviso de empréstimo registrado
  successCard: {
    backgroundColor: "#e6f4ea",
    borderRadius: 10,
    padding: 18,
    marginBottom: 24,
    maxWidth: 720,
  },
  successTitle: { fontSize: 18, fontWeight: "600", color: "#1b6b3a", marginBottom: 6 },
  successText: { fontSize: 16, color: "#202124", lineHeight: 23, marginBottom: 14 },
  successActions: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  saveButtonInline: {
    backgroundColor: "#ed0000",
    borderRadius: 6,
    paddingVertical: 13,
    paddingHorizontal: 18,
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
  },
  ghostButton: {
    borderWidth: 1,
    borderColor: "#495057",
    borderRadius: 6,
    paddingVertical: 13,
    paddingHorizontal: 18,
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#ffffff",
  },
  ghostButtonText: { fontSize: 17, color: "#495057", fontWeight: "500" },
  fieldHelp: { fontSize: 14, color: "#5f6368", marginBottom: 16, lineHeight: 20 },

  // botão do cabeçalho (mesmo padrão de "Novo usuário"/"Novo material")
  newButton: {
    borderWidth: 1,
    borderColor: "#ed0000",
    borderRadius: 4,
    paddingHorizontal: 16,
    paddingVertical: 10,
    minHeight: 44,
    justifyContent: "center",
    backgroundColor: "#ffffff",
  },
  newButtonText: {
    fontSize: 15,
    color: "#ed0000",
    fontWeight: "600",
  },

  // formulário
  formCard: {
    backgroundColor: "#f5f5f5",
    borderRadius: 10,
    padding: 20,
    marginBottom: 24,
    maxWidth: 520,
  },
  formTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#202124",
    marginBottom: 16,
  },
  fieldLabel: {
    fontSize: 15,
    color: "#5f6368",
    marginBottom: 8,
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 10,
  },
  chip: {
    borderWidth: 1,
    borderColor: "#c9c9c9",
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 6,
    backgroundColor: "#ffffff",
  },
  chipActive: {
    borderColor: "#1B4A3B",
    backgroundColor: "#1B4A3B",
  },
  chipText: {
    fontSize: 15,
    color: "#5f6368",
  },
  chipTextActive: {
    color: "#ffffff",
    fontWeight: "600",
  },
  materialList: {
    borderWidth: 1,
    borderColor: "#c9c9c9",
    borderRadius: 8,
    backgroundColor: "#ffffff",
    marginBottom: 16,
    overflow: "hidden",
  },
  materialScroll: {
    maxHeight: 220,
  },
  materialOption: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderBottomColor: "#eeeeee",
  },
  materialOptionActive: {
    backgroundColor: "#e3efe9",
  },
  materialName: {
    flex: 1,
    fontSize: 16,
    color: "#202124",
    paddingRight: 8,
  },
  materialNameActive: {
    fontWeight: "600",
    color: "#1B4A3B",
  },
  materialCategory: {
    fontSize: 14,
    color: "#5f6368",
  },
  input: {
    borderWidth: 1,
    borderColor: "#c9c9c9",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 17,
    color: "#202124",
    marginBottom: 16,
    backgroundColor: "#ffffff",
  },
  inputMultiline: {
    minHeight: 72,
    textAlignVertical: "top",
  },
  saveButton: {
    backgroundColor: "#ed0000",
    borderRadius: 6,
    paddingVertical: 12,
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
  errorText: {
    color: "#c62828",
    fontSize: 15,
    marginBottom: 12,
  },
  retryText: {
    color: "#1B4A3B",
    fontSize: 15,
    fontWeight: "600",
  },

  // seções
  sectionTitle: {
    fontSize: 17,
    fontWeight: "600",
    color: "#202124",
    marginTop: 8,
    marginBottom: 12,
  },
  sectionEmpty: {
    fontSize: 16,
    color: "#5f6368",
    marginBottom: 24,
  },
  centerBox: {
    paddingVertical: 24,
    alignItems: "center",
  },
  emptyText: {
    color: "#5f6368",
    fontSize: 16,
    textAlign: "center",
  },

  // cartão de cada solicitação
  requestCard: {
    backgroundColor: "#ffffff",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#e6e6e6",
    padding: 16,
    marginBottom: 12,
    maxWidth: 720,
  },
  requestTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
  },
  requestMain: {
    flex: 1,
  },
  requestTitle: {
    fontSize: 17,
    fontWeight: "600",
    color: "#202124",
  },
  requestMeta: {
    fontSize: 15,
    color: "#5f6368",
    marginTop: 2,
  },
  requestDate: {
    fontSize: 14,
    color: "#5f6368",
    marginTop: 8,
  },
  requestNote: {
    fontSize: 15,
    color: "#3c3c3c",
    marginTop: 6,
  },
  requestResult: {
    fontSize: 15,
    color: "#1b6b3a",
    marginTop: 6,
  },
  requestResultRecusada: {
    fontSize: 15,
    color: "#c62828",
    marginTop: 6,
  },
  requestActions: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 12,
  },
  waitingText: {
    fontSize: 14,
    color: "#5f6368",
    fontStyle: "italic",
  },
  cancelButton: {
    borderWidth: 1,
    borderColor: "#495057",
    borderRadius: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: "#ffffff",
  },
  cancelButtonText: {
    fontSize: 14,
    color: "#495057",
    fontWeight: "600",
  },

  // selos de status
  badge: {
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  badgeText: {
    fontSize: 14,
    fontWeight: "600",
  },
  badgePendente: { backgroundColor: "#fff4e0" },
  badgePendenteText: { color: "#8a5200" },
  badgeAprovada: { backgroundColor: "#e6f4ea" },
  badgeAprovadaText: { color: "#1b6b3a" },
  badgeRecusada: { backgroundColor: "#fdeceb" },
  badgeRecusadaText: { color: "#c62828" },
  badgeCancelada: { backgroundColor: "#eeeeee" },
  badgeCanceladaText: { color: "#5f6368" },
});
