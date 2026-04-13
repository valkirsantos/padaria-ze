// frontend/src/pages/dono/PainelPedidos.jsx
import React, { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { pedidosService } from "../../services/api";
import { useAuth } from "../../contexts/AuthContext";

function fmt(v) { return "R$ " + Number(v || 0).toFixed(2).replace(".", ","); }

const STATUS_LABEL = { aguardando:"Aguardando", pronto:"Pronto", entregue:"Entregue", cancelado:"Cancelado" };
const STATUS_COR   = { aguardando:"#EF9F27",    pronto:"#3B6D11", entregue:"#888780",  cancelado:"#A32D2D" };
const STATUS_BG    = { aguardando:"#FAEEDA",    pronto:"#EAF3DE",  entregue:"#F1EFE8",  cancelado:"#FCEBEB" };

// Transições válidas de status (para avançar E voltar)
const PROX_STATUS  = { aguardando:"pronto",    pronto:"entregue" };
const PROX_LBL     = { aguardando:"Marcar pronto", pronto:"Confirmar entrega" };
const ANT_STATUS   = { pronto:"aguardando",    entregue:"pronto" };

const METODOS = [
  { id:"cartao_credito", label:"Crédito"  },
  { id:"cartao_debito",  label:"Débito"   },
  { id:"dinheiro",       label:"Dinheiro" },
];

// ─── Hook de undo com timer ───────────────────────────────────────────────────
// Retorna { agendar, cancelar, UndoToast }
// agendar(msg, onConfirmar, onDesfazer, segundos?)
function useUndo() {
  const [fila,     setFila]     = useState([]);  // pode haver mais de um undo em sequencia
  const timersRef  = useRef({});

  const cancelar = useCallback((id) => {
    clearTimeout(timersRef.current[id]);
    delete timersRef.current[id];
    setFila(prev => prev.filter(i => i.id !== id));
  }, []);

  const agendar = useCallback((msg, onConfirmar, onDesfazer, segundos = 5) => {
    const id = Date.now();
    const expiresAt = Date.now() + segundos * 1000;

    // Agenda a confirmação automática
    timersRef.current[id] = setTimeout(async () => {
      delete timersRef.current[id];
      setFila(prev => prev.filter(i => i.id !== id));
      try { await onConfirmar(); } catch (err) { console.error("Erro ao confirmar ação:", err); }
    }, segundos * 1000);

    setFila(prev => [...prev, { id, msg, expiresAt, onDesfazer, segundos }]);
    return id;
  }, []);

  const desfazer = useCallback(async (id) => {
    cancelar(id);
    const item = fila.find(i => i.id === id);
    if (item?.onDesfazer) {
      try { await item.onDesfazer(); } catch (err) { console.error("Erro ao desfazer:", err); }
    }
  }, [fila, cancelar]);

  // Limpa timers ao desmontar
  useEffect(() => {
    return () => { Object.values(timersRef.current).forEach(clearTimeout); };
  }, []);

  // Componente de toast com contador regressivo
  function UndoToast() {
    const [agora, setAgora] = useState(Date.now());

    // Atualiza o contador a cada 100ms
    useEffect(() => {
      if (fila.length === 0) return;
      const t = setInterval(() => setAgora(Date.now()), 100);
      return () => clearInterval(t);
    }, [fila.length]);

    if (fila.length === 0) return null;

    return (
      <div style={{ position:"fixed", bottom:80, left:"50%", transform:"translateX(-50%)",
                    zIndex:300, display:"flex", flexDirection:"column", gap:6,
                    width:"calc(100% - 32px)", maxWidth:398, pointerEvents:"none" }}>
        {fila.map(item => {
          const restante = Math.max(0, (item.expiresAt - agora) / 1000);
          const pct      = (restante / item.segundos) * 100;
          return (
            <div key={item.id}
              style={{ background:"#1A1A1A", borderRadius:12, overflow:"hidden",
                       boxShadow:"0 4px 16px rgba(0,0,0,0.25)", pointerEvents:"all" }}>
              {/* Barra de progresso */}
              <div style={{ height:3, background:"rgba(255,255,255,0.15)" }}>
                <div style={{ height:3, background:"#EF9F27", width:pct + "%",
                               transition:"width 0.1s linear" }} />
              </div>
              <div style={{ display:"flex", alignItems:"center", gap:10,
                            padding:"10px 14px" }}>
                <span style={{ fontSize:13, color:"white", flex:1, lineHeight:1.3 }}>
                  {item.msg}
                </span>
                <button
                  onClick={() => desfazer(item.id)}
                  style={{ background:"#EF9F27", color:"#1A1A1A", border:"none",
                           borderRadius:8, padding:"6px 14px", fontSize:13,
                           fontWeight:700, cursor:"pointer", flexShrink:0,
                           whiteSpace:"nowrap" }}>
                  Desfazer
                </button>
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  return { agendar, cancelar, UndoToast };
}

// ─── Componente principal ─────────────────────────────────────────────────────
export default function PainelPedidos() {
  const navigate = useNavigate();
  const { usuario, logout } = useAuth();

  const [pedidos,    setPedidos]    = useState([]);
  const [metricas,   setMetricas]   = useState({});
  const [filtro,     setFiltro]     = useState("todos");
  const [carregando, setCarregando] = useState(true);

  const wsRef   = useRef(null);
  const wsAtivo = useRef(false);
  const { agendar, UndoToast } = useUndo();

  // Carrega pedidos do dia
  const carregar = useCallback(async () => {
    try {
      const params = filtro !== "todos" ? { status: filtro } : {};
      const { data } = await pedidosService.dia(params);
      // Ordena: aguardando → pronto → entregue → cancelado
      const ORDEM_STATUS = { aguardando:0, pronto:1, entregue:2, cancelado:3 };
      const ordenados = (data.pedidos || []).sort((a, b) => {
        const oa = ORDEM_STATUS[a.status] ?? 9;
        const ob = ORDEM_STATUS[b.status] ?? 9;
        // Mesmo status: ordena por numero do pedido (mais antigo primeiro)
        return oa !== ob ? oa - ob : (a.numero - b.numero);
      });
      setPedidos(ordenados);
      setMetricas(data.metricas || {});
    } catch (err) {
      console.error("Erro ao carregar pedidos:", err);
    } finally {
      setCarregando(false);
    }
  }, [filtro]);

  useEffect(() => { carregar(); }, [carregar]);

  // Polling de 30s como fallback do WebSocket
  useEffect(() => {
    const t = setInterval(carregar, 30000);
    return () => clearInterval(t);
  }, [carregar]);

  // WebSocket opcional
  useEffect(() => {
    let ws = null;
    let tentativas = 0;

    function conectar() {
      if (tentativas >= 3) return;
      tentativas++;
      try {
        const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
        ws = new WebSocket(proto + "//" + window.location.host + "/ws");
        wsRef.current = ws;

        ws.onopen  = () => {
          wsAtivo.current = true;
          ws.send(JSON.stringify({ type:"auth", staffId: usuario?.id }));
        };
        ws.onmessage = (e) => {
          try {
            const msg = JSON.parse(e.data);
            if (msg.type === "novo_pedido") carregar();
          } catch {}
        };
        ws.onerror  = () => { wsAtivo.current = false; };
        ws.onclose  = () => {
          wsAtivo.current = false;
          if (tentativas < 3) setTimeout(conectar, 5000);
        };
      } catch {}
    }

    const t = setTimeout(conectar, 1000);
    return () => {
      clearTimeout(t);
      if (ws) { ws.onclose = null; ws.close(); }
    };
  }, [usuario?.id]);

  // ── Atualizar status com undo ─────────────────────────────────────────────
  function atualizarStatus(pedido, novoStatus) {
    const statusAnterior = pedido.status;

    // Aplica otimisticamente na UI — o usuário vê a mudança imediatamente
    setPedidos(prev => prev.map(p =>
      p.id === pedido.id ? { ...p, status: novoStatus } : p
    ));

    const labelNovo = STATUS_LABEL[novoStatus] || novoStatus;
    const labelAnt  = STATUS_LABEL[statusAnterior] || statusAnterior;

    agendar(
      // Mensagem do toast
      `Pedido #${pedido.numero} marcado como "${labelNovo}"`,
      // onConfirmar — chamado após 5s se o dono não tocar em Desfazer
      async () => {
        await pedidosService.atualizarStatus(pedido.id, novoStatus);
        carregar(); // sincroniza com o banco
      },
      // onDesfazer — chamado se o dono tocar em Desfazer
      async () => {
        // Reverte na UI imediatamente
        setPedidos(prev => prev.map(p =>
          p.id === pedido.id ? { ...p, status: statusAnterior } : p
        ));
        // Não precisa chamar a API porque a ação ainda não foi persistida
      }
    );
  }

  // ── Registrar pagamento com undo ──────────────────────────────────────────
  function registrarPagto(pedido, metodo) {
    const metodoPrevio = pedido.pag_metodo;
    const statusPrevio = pedido.pag_status;

    const labelMetodo = {
      cartao_credito: "Cartão de crédito",
      cartao_debito:  "Cartão de débito",
      dinheiro:       "Dinheiro",
    }[metodo] || metodo;

    // Aplica otimisticamente
    setPedidos(prev => prev.map(p =>
      p.id === pedido.id ? { ...p, pag_status:"pago", pag_metodo: metodo } : p
    ));

    agendar(
      `Pagamento via ${labelMetodo} registrado — Pedido #${pedido.numero}`,
      async () => {
        await pedidosService.registrarPagto(pedido.id, metodo);
        carregar();
      },
      async () => {
        // Reverte na UI
        setPedidos(prev => prev.map(p =>
          p.id === pedido.id ? { ...p, pag_status: statusPrevio, pag_metodo: metodoPrevio } : p
        ));
      }
    );
  }

  // ── Desfazer status (botão explícito no card) ─────────────────────────────
  // Usado quando o dono quer reverter manualmente DEPOIS do timer já ter expirado
  async function reverterStatus(pedido) {
    const anterior = ANT_STATUS[pedido.status];
    if (!anterior) return;
    try {
      await pedidosService.atualizarStatus(pedido.id, anterior);
      setPedidos(prev => prev.map(p =>
        p.id === pedido.id ? { ...p, status: anterior } : p
      ));
    } catch (err) {
      console.error("Erro ao reverter status:", err);
    }
  }

  async function reverterPagamento(pedido) {
    try {
      // Volta para pendente reenviando como "pendente" — o backend aceita
      await pedidosService.registrarPagto(pedido.id, "pendente");
      setPedidos(prev => prev.map(p =>
        p.id === pedido.id ? { ...p, pag_status:"pendente", pag_metodo:"pendente" } : p
      ));
    } catch (err) {
      console.error("Erro ao reverter pagamento:", err);
    }
  }

  const FILTROS = [
    { id:"todos",      label:"Todos"     },
    { id:"aguardando", label:"Aguardando"},
    { id:"pronto",     label:"Prontos"   },
    { id:"entregue",   label:"Entregues" },
  ];

  return (
    <div style={{ minHeight:"100dvh", background:"#F9F9F9" }}>

      {/* Toast com undo */}
      <UndoToast />

      {/* Top bar */}
      <div style={{ background:"white", padding:"14px 16px 10px",
                    borderBottom:"0.5px solid #E0DED6", position:"sticky", top:0, zIndex:10 }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
          <div>
            <h1 style={{ fontSize:18, fontWeight:600 }}>Pedidos do dia</h1>
            <p style={{ fontSize:12, color:"#888780" }}>
              {new Date().toLocaleDateString("pt-BR", { weekday:"long", day:"2-digit", month:"long" })}
            </p>
          </div>
          <div style={{ display:"flex", gap:8, alignItems:"center" }}>
            <button onClick={carregar} title="Atualizar"
              style={{ fontSize:18, background:"none", border:"none", cursor:"pointer" }}>🔄</button>
            <button onClick={() => navigate("/dono/producao")}
              style={{ fontSize:12, color:"#888780", background:"none", border:"none", cursor:"pointer" }}>🥖</button>
            <button onClick={() => navigate("/dono/produtos")}
              style={{ fontSize:12, color:"#888780", background:"none", border:"none", cursor:"pointer" }}>📦</button>
            <button onClick={() => navigate("/dono/relatorios")}
              style={{ fontSize:12, color:"#888780", background:"none", border:"none", cursor:"pointer" }}>📊</button>
            <button onClick={() => navigate("/dono/configuracoes")}
              style={{ fontSize:12, color:"#888780", background:"none", border:"none", cursor:"pointer" }}>⚙️</button>
          </div>
        </div>
      </div>

      {/* Métricas */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:8, padding:12 }}>
        {[
          { val: metricas.total_pedidos  || 0,                  lbl:"pedidos"     },
          { val: metricas.pagos          || 0,                  lbl:"pagos",       cor:"#3B6D11" },
          { val: fmt(metricas.total_faturado || 0),             lbl:"faturamento", small:true },
        ].map((m,i) => (
          <div key={i} style={{ background:"#F1EFE8", borderRadius:10, padding:10, textAlign:"center" }}>
            <div style={{ fontSize:m.small?13:22, fontWeight:600, color:m.cor||"#1A1A1A" }}>{m.val}</div>
            <div style={{ fontSize:10, color:"#888780", marginTop:2 }}>{m.lbl}</div>
          </div>
        ))}
      </div>

      {/* Filtros */}
      <div className="scroll-x" style={{ display:"flex", gap:6, padding:"0 12px 10px" }}>
        {FILTROS.map(f => (
          <button key={f.id} onClick={() => setFiltro(f.id)}
            style={{ flexShrink:0, padding:"5px 13px", borderRadius:20, fontSize:12,
                     cursor:"pointer", border:"0.5px solid",
                     background:  filtro===f.id ? "#854F0B" : "#F9F9F9",
                     borderColor: filtro===f.id ? "#854F0B" : "#E0DED6",
                     color:       filtro===f.id ? "#FAC775" : "#888780" }}>
            {f.label}
          </button>
        ))}
      </div>

      {/* Lista */}
      <div style={{ padding:"0 12px 100px", display:"flex", flexDirection:"column", gap:8 }}>
        {carregando ? (
          <div style={{ display:"flex", justifyContent:"center", padding:40 }}>
            <div className="spinner" style={{ width:32, height:32 }} />
          </div>
        ) : pedidos.length === 0 ? (
          <div style={{ textAlign:"center", padding:60, color:"#888780" }}>
            <p style={{ fontSize:40, marginBottom:12 }}>📋</p>
            <p style={{ fontSize:14 }}>Nenhum pedido {filtro!=="todos" ? `"${filtro}"` : ""} hoje</p>
            <button onClick={carregar}
              style={{ marginTop:16, padding:"8px 20px", borderRadius:20,
                       border:"0.5px solid #E0DED6", background:"#F9F9F9",
                       cursor:"pointer", fontSize:13, color:"#888780" }}>
              Verificar novamente
            </button>
          </div>
        ) : pedidos.map(p => (
          <div key={p.id} className="card"
            style={{ opacity: p.status==="entregue" ? 0.7 : 1, transition:"opacity .2s" }}>

            {/* Cabeçalho */}
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start",
                          padding:"11px 13px", borderBottom:"0.5px solid #E0DED6" }}>
              <div>
                <span style={{ fontSize:14, fontWeight:600 }}>Pedido #{p.numero}</span>
                <span style={{ fontSize:11, color:"#888780", marginLeft:8 }}>
                  {new Date(p.created_at).toLocaleTimeString("pt-BR",{ hour:"2-digit", minute:"2-digit" })}
                </span>
              </div>
              <div style={{ display:"flex", gap:6, flexWrap:"wrap", justifyContent:"flex-end" }}>
                <span style={{ fontSize:10, padding:"3px 8px", borderRadius:10, fontWeight:600,
                                background: p.tipo_entrega==="delivery" ? "#FAEEDA" : "#EEEDFE",
                                color:      p.tipo_entrega==="delivery" ? "#633806" : "#3C3489" }}>
                  {p.tipo_entrega === "delivery" ? "Delivery" : "Retirada"}
                </span>
                <span style={{ fontSize:10, padding:"3px 8px", borderRadius:10, fontWeight:600,
                                background: STATUS_BG[p.status], color: STATUS_COR[p.status] }}>
                  {STATUS_LABEL[p.status]}
                </span>
              </div>
            </div>

            {/* Corpo */}
            <div style={{ padding:"10px 13px" }}>
              {/* Cliente */}
              <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:8 }}>
                <div style={{ width:28, height:28, borderRadius:"50%", background:"#FAEEDA",
                              display:"flex", alignItems:"center", justifyContent:"center",
                              fontSize:12, fontWeight:600, color:"#854F0B", flexShrink:0 }}>
                  {p.cliente_nome?.charAt(0).toUpperCase()}
                </div>
                <div>
                  <div style={{ fontSize:13, fontWeight:600 }}>{p.cliente_nome}</div>
                  <div style={{ fontSize:11, color:"#888780" }}>{p.cliente_tel}</div>
                </div>
              </div>

              {/* Endereço delivery */}
              {p.tipo_entrega === "delivery" && p.endereco_entrega && (
                <div style={{ display:"flex", gap:6, padding:"7px 9px", background:"#F9F9F9",
                              borderRadius:8, marginBottom:8, fontSize:12, color:"#888780" }}>
                  📍 {p.endereco_entrega}{p.bairro_entrega ? ", " + p.bairro_entrega : ""}
                </div>
              )}

              {/* Itens */}
              {p.itens?.length > 0 && (
                <div style={{ display:"flex", flexWrap:"wrap", gap:4, marginBottom:10 }}>
                  {p.itens.map((item, i) => (
                    <span key={i} style={{ background:"#F1EFE8", borderRadius:20,
                                           padding:"3px 10px", fontSize:11, color:"#5F5E5A" }}>
                      {item.emoji} {item.quantidade}x {item.nome}
                    </span>
                  ))}
                </div>
              )}

              {/* ── Pagamento ── */}
              {p.pag_status === "pendente" && p.status !== "cancelado" && (
                <div style={{ marginBottom:8 }}>
                  <div style={{ fontSize:11, color:"#888780", marginBottom:5 }}>
                    Registrar pagamento:
                  </div>
                  <div style={{ display:"flex", gap:5, flexWrap:"wrap" }}>
                    {METODOS.map(m => (
                      <button key={m.id} onClick={() => registrarPagto(p, m.id)}
                        style={{ fontSize:12, padding:"5px 12px", borderRadius:8,
                                 border:"0.5px solid #3B6D11", background:"#EAF3DE",
                                 color:"#27500A", cursor:"pointer", fontWeight:500 }}>
                        💰 {m.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Pago — com botão de reverter */}
              {p.pag_status === "pago" && (
                <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between",
                              marginBottom:8, padding:"6px 10px", background:"#EAF3DE",
                              borderRadius:8 }}>
                  <span style={{ fontSize:12, color:"#27500A", fontWeight:500 }}>
                    ✅ Pago — {p.pag_metodo?.replace(/_/g," ")}
                  </span>
                  <button onClick={() => reverterPagamento(p)}
                    title="Desfazer pagamento"
                    style={{ fontSize:11, padding:"3px 9px", borderRadius:8,
                             border:"0.5px solid #3B6D11", background:"white",
                             color:"#3B6D11", cursor:"pointer" }}>
                    ↩ Desfazer
                  </button>
                </div>
              )}
            </div>

            {/* Footer: total + ações de status */}
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center",
                          padding:"9px 13px", background:"#F9F9F9",
                          borderTop:"0.5px solid #E0DED6", gap:6, flexWrap:"wrap" }}>
              <span style={{ fontSize:14, fontWeight:600 }}>{fmt(p.total)}</span>

              <div style={{ display:"flex", gap:6, alignItems:"center" }}>
                {/* Botão de reverter status (mostrado quando há estado anterior) */}
                {ANT_STATUS[p.status] && (
                  <button onClick={() => reverterStatus(p)}
                    title={"Voltar para " + STATUS_LABEL[ANT_STATUS[p.status]]}
                    style={{ fontSize:11, padding:"5px 10px", borderRadius:8,
                             border:"0.5px solid #E0DED6", background:"white",
                             color:"#888780", cursor:"pointer" }}>
                    ↩ {STATUS_LABEL[ANT_STATUS[p.status]]}
                  </button>
                )}

                {/* Botão de avançar status */}
                {PROX_STATUS[p.status] && (
                  <button onClick={() => atualizarStatus(p, PROX_STATUS[p.status])}
                    style={{ padding:"6px 14px", borderRadius:8, fontSize:12, fontWeight:600,
                             border:"none", cursor:"pointer",
                             background: p.status==="aguardando" ? "#854F0B" : "#3B6D11",
                             color: "#FAC775" }}>
                    {PROX_LBL[p.status]}
                  </button>
                )}

                {p.status === "entregue" && (
                  <span style={{ fontSize:12, color:"#888780" }}>Concluído</span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
