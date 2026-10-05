// Estado das notificações do sino: lista, lidas/não lidas, atualização
// automática (ao montar, a cada 30 s e sempre que o pop-up é aberto) e as
// ações de aprovar/recusar solicitações de alunos.
import { useCallback, useEffect, useRef, useState } from "react";
import { carregarNotificacoes, getLidas, saveLidas } from "../services/notificacoes";
import { aprovarSolicitacao, recusarSolicitacao } from "../services/solicitacoesApi";

const INTERVALO_ATUALIZACAO_MS = 30 * 1000;

// notificação "já resolvida por padrão" (ex: pedido que outra pessoa já respondeu)
const estaLida = (item, lidas) => item.lidaPorPadrao || lidas.has(item.id);

export default function useNotificacoes({ token, userId, role }) {
  const [items, setItems] = useState([]);
  const [lidas, setLidas] = useState(new Set());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [loaded, setLoaded] = useState(false);

  // aprovar/recusar: qual item está em andamento e erros por item
  const [respondendoId, setRespondendoId] = useState(null);
  const [errosAcao, setErrosAcao] = useState({});

  // evita que uma resposta antiga sobrescreva uma mais nova
  const requestId = useRef(0);

  const reload = useCallback(async () => {
    if (!token || userId == null) return;

    const current = ++requestId.current;
    setLoading(true);

    try {
      const [resultado, lidasSalvas] = await Promise.all([
        carregarNotificacoes(token, role),
        getLidas(userId),
      ]);
      if (current !== requestId.current) return;

      if (resultado.falhou) {
        setError("Não foi possível carregar as notificações.");
        return;
      }

      let lidasAtuais = lidasSalvas;

      // Só limpa do histórico o que não existe mais (ex: material
      // reabastecido) quando todas as buscas deram certo — assim, se o
      // alerta voltar a acontecer, ele aparece como novo de novo.
      if (resultado.completo) {
        const idsAtuais = new Set(resultado.items.map((item) => item.id));
        const filtradas = new Set([...lidasSalvas].filter((id) => idsAtuais.has(id)));
        if (filtradas.size !== lidasSalvas.size) {
          lidasAtuais = filtradas;
          saveLidas(userId, filtradas);
        }
      }

      setItems(resultado.items);
      setLidas(lidasAtuais);
      setError("");
    } catch (e) {
      if (current === requestId.current) {
        setError("Não foi possível carregar as notificações.");
      }
    } finally {
      if (current === requestId.current) {
        setLoading(false);
        setLoaded(true);
      }
    }
  }, [token, userId, role]);

  useEffect(() => {
    reload();
    const timer = setInterval(reload, INTERVALO_ATUALIZACAO_MS);
    return () => clearInterval(timer);
  }, [reload]);

  const markRead = useCallback(
    (id) => {
      setLidas((current) => {
        if (current.has(id)) return current;
        const next = new Set(current);
        next.add(id);
        saveLidas(userId, next);
        return next;
      });
    },
    [userId]
  );

  const markAllRead = useCallback(() => {
    setLidas((current) => {
      const next = new Set(current);
      items.forEach((item) => next.add(item.id));
      saveLidas(userId, next);
      return next;
    });
  }, [items, userId]);

  // Aprova ou recusa uma solicitação de aluno. Devolve true se deu certo.
  // Em caso de erro (ex: estoque insuficiente), a mensagem fica no item.
  const responderSolicitacao = useCallback(
    async (item, acao, motivo) => {
      if (!token || !item.solicitacaoId) return false;

      setRespondendoId(item.id);
      setErrosAcao((atual) => ({ ...atual, [item.id]: "" }));

      let sucesso = false;
      try {
        if (acao === "aprovar") {
          await aprovarSolicitacao(token, item.solicitacaoId);
        } else {
          await recusarSolicitacao(token, item.solicitacaoId, motivo);
        }
        sucesso = true;
      } catch (e) {
        setErrosAcao((atual) => ({ ...atual, [item.id]: e.message }));
      } finally {
        setRespondendoId(null);
      }

      // Recarrega sempre: se outra pessoa respondeu antes, o item já
      // aparece atualizado ("Aprovado por Fulano").
      await reload();
      return sucesso;
    },
    [token, reload]
  );

  const unreadCount = items.filter((item) => !estaLida(item, lidas)).length;

  return {
    items,
    lidas,
    unreadCount,
    loading,
    loaded,
    error,
    reload,
    markRead,
    markAllRead,
    responderSolicitacao,
    respondendoId,
    errosAcao,
  };
}
