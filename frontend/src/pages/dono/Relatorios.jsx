// frontend/src/pages/dono/Relatorios.jsx
import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { relatoriosService } from "../../services/api";

function fmt(v)  { return "R$ " + Number(v || 0).toFixed(2).replace(".", ","); }
function fmtN(v) { return Number(v || 0).toLocaleString("pt-BR"); }

// Formata "YYYY-MM-DD" → "DD/MM" sem problemas de fuso
function fmtData(s) {
  if (!s) return "";
  const [,m,d] = String(s).split("T")[0].split("-");
  return d + "/" + m;
}

const PERIODOS = [
  { id:"semana",    label:"Semana" },
  { id:"mes",       label:"Mês" },
  { id:"trimestre", label:"Trimestre" },
];

const ABAS = [
  { id:"faturamento",   label:"Faturamento", emoji:"💰" },
  { id:"produtos",      label:"Produtos",    emoji:"🥖" },
  { id:"inadimplencia", label:"Inadimpl.",   emoji:"⚠️" },
  { id:"entregas",      label:"Entregas",    emoji:"🛵" },
];

// Barra horizontal simples usando divs — sem dependência de gráficos
function BarraHorizontal({ valor, maximo, cor = "#854F0B" }) {
  const pct = maximo > 0 ? Math.round((valor / maximo) * 100) : 0;
  return (
    <div style={{ height:6, background:"#F1EFE8", borderRadius:3, overflow:"hidden", flex:1 }}>
      <div style={{ height:6, borderRadius:3, background:cor, width:pct + "%", transition:"width .4s" }} />
    </div>
  );
}

export default function Relatorios() {
  const navigate = useNavigate();
  const [aba,        setAba]        = useState("faturamento");
  const [periodo,    setPeriodo]    = useState("mes");
  const [dados,      setDados]      = useState({});
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    setCarregando(true);
    const promessas = [
      relatoriosService.faturamento(periodo),
      relatoriosService.produtos(periodo),
      relatoriosService.inadimplencia(),
      relatoriosService.entregas(periodo),
    ];
    Promise.all(promessas)
      .then(([fat, prod, inad, entr]) => {
        setDados({
          faturamento:   fat.data,
          produtos:      prod.data,
          inadimplencia: inad.data,
          entregas:      entr.data,
        });
      })
      .catch(err => console.error("Erro ao buscar relatórios:", err))
      .finally(() => setCarregando(false));
  }, [periodo]);

  // ── Aba faturamento ──────────────────────────────────────────────────────
  function renderFaturamento() {
    const d = dados.faturamento || {};
    const t = d.totais || {};
    const porDia = d.porDia || [];
    const maxDia = Math.max(...porDia.map(x => Number(x.faturamento || 0)), 1);
    const pagamentos = d.pagamentos || [];

    return (
      <>
        {/* Métricas */}
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginBottom:10 }}>
          {[
            { lbl:"Faturamento total", val:fmt(t.faturamento_total) },
            { lbl:"Ticket médio",      val:fmt(t.ticket_medio) },
            { lbl:"Total de pedidos",  val:fmtN(t.total_pedidos) },
            { lbl:"Clientes únicos",   val:fmtN(t.clientes_unicos) },
          ].map((m,i) => (
            <div key={i} style={{ background:"#F1EFE8", borderRadius:10, padding:"11px 12px" }}>
              <div style={{ fontSize:11, color:"#888780" }}>{m.lbl}</div>
              <div style={{ fontSize:18, fontWeight:600, color:"#1A1A1A", marginTop:3 }}>{m.val}</div>
            </div>
          ))}
        </div>

        {/* Faturamento por dia */}
        {porDia.length > 0 && (
          <div className="card" style={{ marginBottom:10 }}>
            <div style={{ padding:"11px 13px 9px", borderBottom:"0.5px solid #E0DED6",
                          fontSize:13, fontWeight:600, color:"#888780" }}>
              Faturamento por dia
            </div>
            <div style={{ padding:"10px 13px", display:"flex", flexDirection:"column", gap:8 }}>
              {porDia.map((d, i) => (
                <div key={i} style={{ display:"flex", alignItems:"center", gap:10 }}>
                  <div style={{ fontSize:11, color:"#888780", minWidth:34 }}>{fmtData(d.data_entrega)}</div>
                  <BarraHorizontal valor={Number(d.faturamento)} maximo={maxDia} />
                  <div style={{ fontSize:12, fontWeight:600, color:"#854F0B", minWidth:60, textAlign:"right" }}>
                    {fmt(d.faturamento)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Formas de pagamento */}
        {pagamentos.length > 0 && (
          <div className="card">
            <div style={{ padding:"11px 13px 9px", borderBottom:"0.5px solid #E0DED6",
                          fontSize:13, fontWeight:600, color:"#888780" }}>
              Forma de pagamento
            </div>
            {pagamentos.map((p, i) => (
              <div key={i} style={{ display:"flex", justifyContent:"space-between",
                                     padding:"10px 13px", borderBottom:"0.5px solid #E0DED6" }}>
                <span style={{ fontSize:13, color:"#1A1A1A", textTransform:"capitalize" }}>
                  {String(p.metodo || "").replace("_", " ") || "—"}
                </span>
                <div style={{ textAlign:"right" }}>
                  <div style={{ fontSize:13, fontWeight:600, color:"#854F0B" }}>{fmt(p.valor)}</div>
                  <div style={{ fontSize:11, color:"#888780" }}>{fmtN(p.qtd)} pedidos</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </>
    );
  }

  // ── Aba produtos ─────────────────────────────────────────────────────────
  function renderProdutos() {
    const ranking = dados.produtos?.ranking || [];
    const maxUn   = Math.max(...ranking.map(r => Number(r.total_unidades || 0)), 1);

    return (
      <>
        {ranking.length === 0 ? (
          <div style={{ textAlign:"center", padding:40, color:"#888780", fontSize:14 }}>
            Nenhum dado neste período
          </div>
        ) : (
          <div className="card">
            <div style={{ padding:"11px 13px 9px", borderBottom:"0.5px solid #E0DED6",
                          fontSize:13, fontWeight:600, color:"#888780" }}>
              Ranking de vendas
            </div>
            {ranking.map((r, i) => (
              <div key={i} style={{ display:"flex", alignItems:"center", gap:10,
                                     padding:"10px 13px", borderBottom:"0.5px solid #E0DED6" }}>
                <div style={{ fontSize:12, color:"#888780", fontWeight:600, minWidth:18 }}>
                  {i + 1}
                </div>
                <div style={{ fontSize:20, width:28, textAlign:"center" }}>{r.emoji}</div>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:13, fontWeight:600, color:"#1A1A1A" }}>{r.nome}</div>
                  <div style={{ display:"flex", alignItems:"center", gap:8, marginTop:4 }}>
                    <BarraHorizontal valor={Number(r.total_unidades)} maximo={maxUn} />
                    <span style={{ fontSize:11, color:"#888780", minWidth:40 }}>
                      {fmtN(r.total_unidades)} un.
                    </span>
                  </div>
                </div>
                <div style={{ fontSize:13, fontWeight:600, color:"#854F0B", minWidth:64, textAlign:"right" }}>
                  {fmt(r.faturamento)}
                </div>
              </div>
            ))}
          </div>
        )}
      </>
    );
  }

  // ── Aba inadimplência ────────────────────────────────────────────────────
  function renderInadimplencia() {
    const d     = dados.inadimplencia || {};
    const lista = d.inadimplentes || [];

    function diasAtraso(dataStr) {
      if (!dataStr) return 0;
      const dt   = new Date(String(dataStr).split("T")[0] + "T12:00:00");
      const diff = Date.now() - dt.getTime();
      return Math.max(0, Math.floor(diff / (1000 * 60 * 60 * 24)));
    }

    return (
      <>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginBottom:10 }}>
          <div style={{ background:"#FCEBEB", borderRadius:10, padding:"11px 12px" }}>
            <div style={{ fontSize:11, color:"#888780" }}>Valor em aberto</div>
            <div style={{ fontSize:18, fontWeight:600, color:"#A32D2D", marginTop:3 }}>
              {fmt(d.total_aberto)}
            </div>
          </div>
          <div style={{ background:"#F1EFE8", borderRadius:10, padding:"11px 12px" }}>
            <div style={{ fontSize:11, color:"#888780" }}>Clientes devedores</div>
            <div style={{ fontSize:18, fontWeight:600, color:"#1A1A1A", marginTop:3 }}>
              {lista.length}
            </div>
          </div>
        </div>

        {lista.length === 0 ? (
          <div style={{ textAlign:"center", padding:40, background:"#EAF3DE",
                        borderRadius:12, color:"#27500A", fontSize:14, fontWeight:500 }}>
            ✅ Nenhum pagamento pendente!
          </div>
        ) : (
          <div className="card">
            <div style={{ padding:"11px 13px 9px", borderBottom:"0.5px solid #E0DED6",
                          fontSize:13, fontWeight:600, color:"#888780" }}>
              Pagamentos pendentes (últimos 30 dias)
            </div>
            {lista.map((p, i) => {
              const dias = diasAtraso(p.data_entrega);
              return (
                <div key={i} style={{ display:"flex", alignItems:"center", padding:"10px 13px",
                                       borderBottom:"0.5px solid #E0DED6", gap:10 }}>
                  <div style={{ width:30, height:30, borderRadius:"50%", background:"#FAEEDA",
                                display:"flex", alignItems:"center", justifyContent:"center",
                                fontSize:12, fontWeight:600, color:"#854F0B", flexShrink:0 }}>
                    {p.cliente_nome?.charAt(0).toUpperCase()}
                  </div>
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:13, fontWeight:600 }}>{p.cliente_nome}</div>
                    <div style={{ fontSize:11, color:"#888780" }}>
                      Pedido #{p.numero} · há {dias} dia{dias !== 1 ? "s" : ""}
                    </div>
                  </div>
                  <div style={{ fontSize:14, fontWeight:600,
                                color: dias >= 7 ? "#A32D2D" : "#BA7517" }}>
                    {fmt(p.total)}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </>
    );
  }

  // ── Aba entregas ─────────────────────────────────────────────────────────
  function renderEntregas() {
    const d      = dados.entregas || {};
    const porTipo = d.porTipo || [];
    const porDia  = d.porDia  || [];

    const totalRetirada = porTipo.find(x => x.tipo_entrega === "retirada")?.qtd || 0;
    const totalDelivery = porTipo.find(x => x.tipo_entrega === "delivery")?.qtd || 0;
    const totalGeral    = Number(totalRetirada) + Number(totalDelivery);
    const pctDelivery   = totalGeral > 0 ? Math.round((Number(totalDelivery) / totalGeral) * 100) : 0;
    const pctRetirada   = 100 - pctDelivery;

    return (
      <>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginBottom:10 }}>
          <div style={{ background:"#F1EFE8", borderRadius:10, padding:"11px 12px" }}>
            <div style={{ fontSize:11, color:"#888780" }}>Retirada</div>
            <div style={{ fontSize:22, fontWeight:600, color:"#1A1A1A", marginTop:3 }}>
              {fmtN(totalRetirada)}
            </div>
            <div style={{ fontSize:11, color:"#888780" }}>{pctRetirada}% do total</div>
          </div>
          <div style={{ background:"#FAEEDA", borderRadius:10, padding:"11px 12px" }}>
            <div style={{ fontSize:11, color:"#888780" }}>Delivery</div>
            <div style={{ fontSize:22, fontWeight:600, color:"#854F0B", marginTop:3 }}>
              {fmtN(totalDelivery)}
            </div>
            <div style={{ fontSize:11, color:"#888780" }}>{pctDelivery}% do total</div>
          </div>
        </div>

        {porDia.length > 0 && (
          <div className="card">
            <div style={{ padding:"11px 13px 9px", borderBottom:"0.5px solid #E0DED6",
                          fontSize:13, fontWeight:600, color:"#888780" }}>
              Retirada vs Delivery por dia
            </div>
            <div style={{ padding:"10px 13px", display:"flex", flexDirection:"column", gap:8 }}>
              {porDia.map((d, i) => {
                const ret = Number(d.retiradas || 0);
                const del = Number(d.deliveries || 0);
                const tot = ret + del;
                const pRet = tot > 0 ? Math.round(ret / tot * 100) : 50;
                const pDel = 100 - pRet;
                return (
                  <div key={i} style={{ display:"flex", alignItems:"center", gap:10 }}>
                    <div style={{ fontSize:11, color:"#888780", minWidth:34 }}>
                      {fmtData(d.data_entrega)}
                    </div>
                    <div style={{ flex:1, height:8, borderRadius:4, overflow:"hidden",
                                   display:"flex", background:"#F1EFE8" }}>
                      <div style={{ width:pRet+"%", height:"100%", background:"#854F0B" }} />
                      <div style={{ width:pDel+"%", height:"100%", background:"#EF9F27" }} />
                    </div>
                    <div style={{ fontSize:11, color:"#888780", minWidth:60, textAlign:"right" }}>
                      {ret} / {del}
                    </div>
                  </div>
                );
              })}
            </div>
            <div style={{ display:"flex", gap:16, padding:"8px 13px 12px", fontSize:11, color:"#888780" }}>
              <span><span style={{ display:"inline-block", width:10, height:10, borderRadius:2,
                                   background:"#854F0B", marginRight:4 }} />Retirada</span>
              <span><span style={{ display:"inline-block", width:10, height:10, borderRadius:2,
                                   background:"#EF9F27", marginRight:4 }} />Delivery</span>
            </div>
          </div>
        )}
      </>
    );
  }

  return (
    <div style={{ minHeight:"100dvh", background:"#F9F9F9" }}>
      {/* Header */}
      <div style={{ background:"white", padding:"14px 16px 0",
                    borderBottom:"0.5px solid #E0DED6", position:"sticky", top:0, zIndex:10 }}>
        <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:10 }}>
          <button onClick={() => navigate("/dono")}
            style={{ background:"none", border:"none", cursor:"pointer", fontSize:20 }}>←</button>
          <h2 style={{ fontSize:17, fontWeight:600 }}>Relatórios</h2>
        </div>

        {/* Seletor de período */}
        <div style={{ display:"flex", gap:6, marginBottom:10 }}>
          {PERIODOS.map(p => (
            <button key={p.id} onClick={() => setPeriodo(p.id)}
              style={{ flex:1, padding:"6px 4px", borderRadius:8, fontSize:12, cursor:"pointer",
                       border: periodo===p.id ? "none" : "0.5px solid #E0DED6",
                       background: periodo===p.id ? "#854F0B" : "#F9F9F9",
                       color:      periodo===p.id ? "#FAC775" : "#888780",
                       fontWeight: periodo===p.id ? 600 : 400 }}>
              {p.label}
            </button>
          ))}
        </div>

        {/* Abas */}
        <div style={{ display:"flex", borderTop:"0.5px solid #E0DED6" }}>
          {ABAS.map(a => (
            <button key={a.id} onClick={() => setAba(a.id)}
              style={{ flex:1, padding:"9px 4px", fontSize:11, cursor:"pointer", border:"none",
                       background:"transparent", borderBottom: aba===a.id ? "2px solid #854F0B" : "2px solid transparent",
                       color: aba===a.id ? "#854F0B" : "#888780", fontWeight: aba===a.id ? 600 : 400 }}>
              {a.emoji} {a.label}
            </button>
          ))}
        </div>
      </div>

      {/* Conteúdo */}
      <div style={{ padding:12 }}>
        {carregando ? (
          <div style={{ display:"flex", justifyContent:"center", padding:60 }}>
            <div className="spinner" style={{ width:32, height:32 }} />
          </div>
        ) : (
          <>
            {aba === "faturamento"   && renderFaturamento()}
            {aba === "produtos"      && renderProdutos()}
            {aba === "inadimplencia" && renderInadimplencia()}
            {aba === "entregas"      && renderEntregas()}
          </>
        )}
      </div>
    </div>
  );
}
