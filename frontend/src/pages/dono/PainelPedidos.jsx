import React, { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { pedidosService } from "../../services/api";
import { useAuth } from "../../contexts/AuthContext";

function fmt(v) { return "R$ " + Number(v).toFixed(2).replace(".", ","); }

const STATUS_LABEL = { aguardando:"Aguardando", pronto:"Pronto", entregue:"Entregue", cancelado:"Cancelado" };
const STATUS_COR   = { aguardando:"#EF9F27",   pronto:"#3B6D11", entregue:"#888780", cancelado:"#A32D2D" };
const STATUS_BG    = { aguardando:"#FAEEDA",   pronto:"#EAF3DE",  entregue:"#F1EFE8", cancelado:"#FCEBEB" };
const PROXIMO_ST   = { aguardando:"pronto",    pronto:"entregue" };
const PROXIMO_LBL  = { aguardando:"Marcar pronto", pronto:"Confirmar entrega" };
const METODOS      = [
  { id:"cartao_credito", label:"Credito" },
  { id:"cartao_debito",  label:"Debito" },
  { id:"dinheiro",       label:"Dinheiro" },
];

export default function PainelPedidos() {
  const navigate = useNavigate();
  const { usuario, logout } = useAuth();
  const [pedidos,    setPedidos]    = useState([]);
  const [metricas,   setMetricas]   = useState({});
  const [filtro,     setFiltro]     = useState("todos");
  const [carregando, setCarregando] = useState(true);
  const [toast,      setToast]      = useState("");
  const wsRef      = useRef(null);
  const wsAtivo    = useRef(false);

  // Carrega pedidos  chamado na montagem e pelo WebSocket
  const carregar = useCallback(async () => {
    try {
      const params = filtro !== "todos" ? { status: filtro } : {};
      const { data } = await pedidosService.dia(params);
      setPedidos(data.pedidos);
      setMetricas(data.metricas);
    } catch (err) {
      console.error("Erro ao carregar pedidos:", err);
    } finally {
      setCarregando(false);
    }
  }, [filtro]);

  // Recarrega ao mudar o filtro
  useEffect(() => { carregar(); }, [carregar]);

  // Polling de fallback: recarrega a cada 30s caso WebSocket falhe
  // Garante que o dono veja pedidos novos mesmo sem WS
  useEffect(() => {
    const intervalo = setInterval(() => { carregar(); }, 30000);
    return () => clearInterval(intervalo);
  }, [carregar]);

  // WebSocket  conexao opcional, nao bloqueia o painel se falhar
  useEffect(() => {
    let ws = null;
    let tentativas = 0;
    const MAX_TENTATIVAS = 3;

    function conectar() {
      if (tentativas >= MAX_TENTATIVAS) return;
      tentativas++;

      try {
        const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
        const url   = proto + "//" + window.location.host + "/ws";
        ws = new WebSocket(url);
        wsRef.current = ws;

        ws.onopen = () => {
          wsAtivo.current = true;
          ws.send(JSON.stringify({ type: "auth", staffId: usuario?.id }));
        };

        ws.onmessage = (e) => {
          try {
            const msg = JSON.parse(e.data);
            if (msg.type === "novo_pedido") {
              mostrarToast(" Novo pedido #" + msg.pedido.numero + " recebido!");
              carregar();
            }
          } catch {}
        };

        ws.onerror = () => {
          // Silencia o erro  o polling de 30s garante atualizacao
          wsAtivo.current = false;
        };

        ws.onclose = () => {
          wsAtivo.current = false;
          // Tenta reconectar apos 5s se ainda estiver na pagina
          if (tentativas < MAX_TENTATIVAS) {
            setTimeout(conectar, 5000);
          }
        };
      } catch {
        // WebSocket nao disponivel  polling continua funcionando
      }
    }

    // Aguarda 1s para o Vite proxy inicializar antes de conectar
    const timer = setTimeout(conectar, 1000);

    return () => {
      clearTimeout(timer);
      if (ws) {
        ws.onclose = null; // evita tentativa de reconexao no unmount
        ws.close();
      }
    };
  }, [usuario?.id]);

  function mostrarToast(msg) {
    setToast(msg);
    setTimeout(() => setToast(""), 3000);
  }

  async function atualizarStatus(id, novoStatus) {
    try {
      await pedidosService.atualizarStatus(id, novoStatus);
      setPedidos(prev => prev.map(p => p.id === id ? { ...p, status: novoStatus } : p));
      mostrarToast(novoStatus === "pronto" ? " Pedido marcado como pronto" : " Entrega confirmada");
    } catch { mostrarToast(" Erro ao atualizar status"); }
  }

  async function registrarPagto(pedidoId, metodo) {
    try {
      await pedidosService.registrarPagto(pedidoId, metodo);
      setPedidos(prev => prev.map(p =>
        p.id === pedidoId ? { ...p, pag_status: "pago", pag_metodo: metodo } : p
      ));
      mostrarToast(" Pagamento registrado");
    } catch { mostrarToast(" Erro ao registrar pagamento"); }
  }

  const FILTROS = [
    { id:"todos",      label:"Todos" },
    { id:"aguardando", label:"Aguardando" },
    { id:"pronto",     label:"Prontos" },
    { id:"entregue",   label:"Entregues" },
  ];

  return (
    <div style={{ minHeight:"100dvh", background:"#F9F9F9" }}>
      {toast && <div className="toast success">{toast}</div>}

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
            <button onClick={() => carregar()}
              style={{ fontSize:18, background:"none", border:"none", cursor:"pointer" }}
              title="Atualizar pedidos">
              
            </button>
            <button onClick={() => navigate("/dono/produtos")}
              style={{ fontSize:12, color:"#888780", background:"none", border:"none", cursor:"pointer" }}>
              
            </button>
            <button onClick={logout}
              style={{ fontSize:12, color:"#888780", background:"none", border:"none", cursor:"pointer" }}>
              Sair
            </button>
          </div>
        </div>
      </div>

      {/* Metricas */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:8, padding:12 }}>
        {[
          { val: metricas.total_pedidos  || 0,           lbl:"pedidos" },
          { val: metricas.pagos          || 0,           lbl:"pagos",       cor:"#3B6D11" },
          { val: fmt(metricas.total_faturado || 0),      lbl:"faturamento", small:true },
        ].map((m, i) => (
          <div key={i} style={{ background:"#F1EFE8", borderRadius:10, padding:"10px", textAlign:"center" }}>
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
      <div style={{ padding:"0 12px 24px", display:"flex", flexDirection:"column", gap:8 }}>
        {carregando ? (
          <div style={{ display:"flex", justifyContent:"center", padding:40 }}>
            <div className="spinner" style={{ width:32, height:32 }} />
          </div>
        ) : pedidos.length === 0 ? (
          <div style={{ textAlign:"center", padding:60, color:"#888780" }}>
            <p style={{ fontSize:40, marginBottom:12 }}></p>
            <p style={{ fontSize:14 }}>Nenhum pedido {filtro !== "todos" ? '"' + filtro + '"' : ""} hoje</p>
            <button onClick={() => carregar()}
              style={{ marginTop:16, padding:"8px 20px", borderRadius:20, border:"0.5px solid #E0DED6",
                       background:"#F9F9F9", cursor:"pointer", fontSize:13, color:"#888780" }}>
              Verificar novamente
            </button>
          </div>
        ) : pedidos.map(p => (
          <div key={p.id} className="card">
            {/* Cabecalho */}
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start",
                          padding:"11px 13px", borderBottom:"0.5px solid #E0DED6" }}>
              <div>
                <span style={{ fontSize:14, fontWeight:600 }}>Pedido #{p.numero}</span>
                <span style={{ fontSize:11, color:"#888780", marginLeft:8 }}>
                  {new Date(p.created_at).toLocaleTimeString("pt-BR", { hour:"2-digit", minute:"2-digit" })}
                </span>
              </div>
              <div style={{ display:"flex", gap:6, alignItems:"center", flexWrap:"wrap", justifyContent:"flex-end" }}>
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

              {/* Endereco delivery */}
              {p.tipo_entrega === "delivery" && p.endereco_entrega && (
                <div style={{ display:"flex", gap:6, padding:"7px 9px", background:"#F9F9F9",
                              borderRadius:8, marginBottom:8, fontSize:12, color:"#888780" }}>
                   {p.endereco_entrega}{p.bairro_entrega ? ", " + p.bairro_entrega : ""}
                </div>
              )}

              {/* Itens */}
              {p.itens && p.itens.length > 0 && (
                <div style={{ display:"flex", flexWrap:"wrap", gap:4, marginBottom:10 }}>
                  {p.itens.map((item, i) => (
                    <span key={i} style={{ background:"#F1EFE8", borderRadius:20, padding:"3px 10px",
                                           fontSize:11, color:"#5F5E5A" }}>
                      {item.emoji} {item.quantidade}x {item.nome}
                    </span>
                  ))}
                </div>
              )}

              {/* Registrar pagamento */}
              {p.pag_status === "pendente" && p.status !== "cancelado" && (
                <div style={{ display:"flex", gap:4, marginBottom:8, flexWrap:"wrap" }}>
                  {METODOS.map(m => (
                    <button key={m.id} onClick={() => registrarPagto(p.id, m.id)}
                      style={{ fontSize:11, padding:"5px 11px", borderRadius:8,
                               border:"0.5px solid #3B6D11", background:"#EAF3DE",
                               color:"#27500A", cursor:"pointer" }}>
                       {m.label}
                    </button>
                  ))}
                </div>
              )}

              {p.pag_status === "pago" && (
                <div style={{ fontSize:12, color:"#27500A", marginBottom:8 }}>
                   Pago  {p.pag_metodo?.replace("_", " ")}
                </div>
              )}
            </div>

            {/* Footer */}
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center",
                          padding:"9px 13px", background:"#F9F9F9", borderTop:"0.5px solid #E0DED6" }}>
              <span style={{ fontSize:14, fontWeight:600 }}>{fmt(p.total)}</span>
              {PROXIMO_ST[p.status] && (
                <button onClick={() => atualizarStatus(p.id, PROXIMO_ST[p.status])}
                  style={{ padding:"7px 14px", borderRadius:8, fontSize:12, fontWeight:600,
                           background:"#854F0B", color:"#FAC775", border:"none", cursor:"pointer" }}>
                  {PROXIMO_LBL[p.status]}
                </button>
              )}
              {p.status === "entregue" && (
                <span style={{ fontSize:12, color:"#888780" }}>Concluido</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
