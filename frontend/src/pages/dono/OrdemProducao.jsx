// frontend/src/pages/dono/OrdemProducao.jsx
// Tela de ordem de producao — checklist interativo para o padeiro
// Exporta PDF via jsPDF que pode ser compartilhado pelo WhatsApp

import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { producaoService } from "../../services/api";

function fmt(v)  { return "R$ " + Number(v || 0).toFixed(2).replace(".", ","); }
function fmtData(s) {
  if (!s) return "";
  const [, m, d] = String(s).split("T")[0].split("-");
  const meses = ["jan","fev","mar","abr","mai","jun","jul","ago","set","out","nov","dez"];
  return d + "/" + meses[Number(m) - 1];
}

const CATS = { classicos:"Clássicos", especiais:"Especiais", integrais:"Integrais", doces:"Doces", outros:"Outros" };
const CATS_COR = { classicos:"#854F0B", especiais:"#185FA5", integrais:"#3B6D11", doces:"#993556", outros:"#5F5E5A" };
const CATS_BG  = { classicos:"#FAEEDA", especiais:"#E6F1FB", integrais:"#EAF3DE", doces:"#FBEAF0", outros:"#F1EFE8" };

export default function OrdemProducao() {
  const navigate = useNavigate();

  const [dados,       setDados]       = useState(null);
  const [carregando,  setCarregando]  = useState(true);
  const [concluidos,  setConcluidos]  = useState({});   // { produto_id: true/false }
  const [statusGeral, setStatusGeral] = useState("aguardando"); // aguardando | producao | concluido
  const [abaAtiva,    setAbaAtiva]    = useState("producao");   // producao | deliveries | retiradas
  const [exportando,  setExportando]  = useState(false);
  const [toast,       setToast]       = useState("");

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      const { data } = await producaoService.dia();
      setDados(data);
      // Restaura o checklist salvo localmente (persiste entre recarregamentos)
      const salvo = localStorage.getItem("checklist_producao");
      if (salvo) {
        try { setConcluidos(JSON.parse(salvo)); } catch {}
      }
    } catch (err) {
      console.error("Erro ao carregar producao:", err);
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  function mostrarToast(msg) {
    setToast(msg);
    setTimeout(() => setToast(""), 2500);
  }

  // Marca ou desmarca um produto no checklist
  function toggleConcluido(produtoId) {
    setConcluidos(prev => {
      const novo = { ...prev, [produtoId]: !prev[produtoId] };
      localStorage.setItem("checklist_producao", JSON.stringify(novo));
      return novo;
    });
  }

  // Limpa o checklist (botao de reset)
  function limparChecklist() {
    setConcluidos({});
    localStorage.removeItem("checklist_producao");
    mostrarToast("✅ Checklist resetado");
  }

  // Progresso do checklist
  const totalItens    = dados?.quantitativos?.length || 0;
  const totalConc     = Object.values(concluidos).filter(Boolean).length;
  const pctProgresso  = totalItens > 0 ? Math.round((totalConc / totalItens) * 100) : 0;

  // Exportar PDF com jsPDF carregado via CDN
  async function exportarPDF() {
    if (!dados) return;
    setExportando(true);
    try {
      // Carrega jsPDF dinamicamente — evita adicionar ao bundle
      const script = document.createElement("script");
      script.src = "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js";
      document.head.appendChild(script);
      await new Promise((res, rej) => { script.onload = res; script.onerror = rej; });

      const { jsPDF } = window.jspdf;
      const doc = new jsPDF({ unit: "mm", format: "a4" });
      const W = 210, M = 14, corAmber = [133, 79, 11];

      // Cabecalho
      doc.setFillColor(...corAmber);
      doc.rect(0, 0, W, 30, "F");
      doc.setTextColor(250, 199, 117);
      doc.setFontSize(18).setFont(undefined, "bold");
      doc.text("Padaria do Ze — Ordem de Producao", M, 13);
      doc.setFontSize(9).setFont(undefined, "normal");
      doc.text(
        "Gerada em: " + new Date().toLocaleDateString("pt-BR") +
        " | Pedidos: " + dados.total_pedidos +
        " | Total: " + dados.total_unidades + " unidades",
        M, 22
      );

      // Quantitativos
      let y = 38;
      doc.setTextColor(30, 30, 30);
      doc.setFontSize(11).setFont(undefined, "bold");
      doc.text("ITENS PARA PRODUCAO", M, y); y += 6;
      doc.setLineWidth(0.3);
      doc.setDrawColor(200, 200, 200);
      doc.line(M, y, W - M, y); y += 5;

      dados.quantitativos.forEach((q, i) => {
        if (y > 260) { doc.addPage(); y = 20; }
        if (i % 2 === 0) {
          doc.setFillColor(249, 247, 244);
          doc.rect(M - 2, y - 4, W - M * 2 + 4, 10, "F");
        }
        doc.setFont(undefined, "bold").setFontSize(11).setTextColor(30, 30, 30);
        doc.text(q.emoji + " " + q.nome, M, y);
        doc.setTextColor(...corAmber);
        doc.text(q.quantidade + " " + (q.unidade || "un."), W - M - 10, y, { align: "right" });
        // Caixa de conferencia
        doc.setDrawColor(180, 180, 180);
        doc.rect(W - M - 6, y - 4, 5, 5);
        y += 10;
      });

      // Total
      y += 2;
      doc.setFillColor(250, 238, 218);
      doc.rect(M - 2, y - 4, W - M * 2 + 4, 10, "F");
      doc.setFont(undefined, "bold").setFontSize(11).setTextColor(30, 30, 30);
      doc.text("TOTAL DE UNIDADES", M, y);
      doc.setTextColor(...corAmber);
      doc.text(String(dados.total_unidades) + " unidades", W - M - 10, y, { align: "right" });
      y += 14;

      // Deliveries
      if (dados.deliveries && dados.deliveries.length > 0) {
        if (y > 240) { doc.addPage(); y = 20; }
        doc.setFont(undefined, "bold").setFontSize(11).setTextColor(30, 30, 30);
        doc.text("DELIVERIES — SEPARAR IDENTIFICADOS", M, y); y += 6;
        doc.line(M, y, W - M, y); y += 5;

        dados.deliveries.forEach(d => {
          if (y > 260) { doc.addPage(); y = 20; }
          doc.setFont(undefined, "bold").setFontSize(10).setTextColor(30, 30, 30);
          doc.text(d.cliente_nome + "  —  " + (d.endereco_entrega || "") + (d.bairro_entrega ? ", " + d.bairro_entrega : ""), M, y);
          const pagLbl = d.pag_status === "pago" ? "PAGO" : "COBRAR";
          const cor = d.pag_status === "pago" ? [39, 109, 17] : [133, 79, 11];
          doc.setTextColor(...cor).setFont(undefined, "bold");
          doc.text(pagLbl, W - M - 10, y, { align: "right" });
          doc.setFont(undefined, "normal").setTextColor(100, 100, 100).setFontSize(9);
          const nomes = (d.itens || []).map(i => i.quantidade + "x " + i.nome).join(", ");
          doc.text(nomes, M, y + 5);
          y += 14;
        });
      }

      // Observacoes
      if (dados.observacoes && dados.observacoes.length > 0) {
        if (y > 240) { doc.addPage(); y = 20; }
        y += 4;
        doc.setFont(undefined, "bold").setFontSize(10).setTextColor(30, 30, 30);
        doc.text("OBSERVACOES", M, y); y += 6;
        dados.observacoes.forEach(o => {
          if (y > 270) { doc.addPage(); y = 20; }
          const txt = o.cliente
            ? "• " + o.cliente + ": " + o.produto + " — " + o.alergeno
            : "• " + o.produto + ": " + o.nota;
          doc.setFont(undefined, "normal").setTextColor(80, 80, 80).setFontSize(9);
          doc.text(txt, M, y); y += 6;
        });
      }

      // Rodape
      doc.setFont(undefined, "normal").setFontSize(8).setTextColor(170, 170, 170);
      doc.text("Sistema Padaria do Ze  —  " + new Date().toLocaleDateString("pt-BR"), M, 290);

      // Compartilhar ou baixar
      const nomeArq = "producao-" + new Date().toISOString().split("T")[0] + ".pdf";
      const blob    = doc.output("blob");
      const file    = new File([blob], nomeArq, { type: "application/pdf" });

      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        // Celular Android/iOS — abre menu de compartilhamento (WhatsApp, etc.)
        await navigator.share({ title: "Ordem de Producao", files: [file] });
      } else {
        // Desktop — faz download direto
        doc.save(nomeArq);
      }
      mostrarToast("📄 PDF gerado!");
    } catch (err) {
      if (err.name !== "AbortError") {
        console.error("Erro ao exportar PDF:", err);
        mostrarToast("❌ Erro ao gerar PDF");
      }
    } finally {
      setExportando(false);
    }
  }

  const STATUS_INFO = {
    aguardando: { label:"Aguardando início", cor:"#EF9F27", bg:"#FAEEDA" },
    producao:   { label:"Em produção",       cor:"#185FA5", bg:"#E6F1FB" },
    concluido:  { label:"Produção concluída",cor:"#3B6D11", bg:"#EAF3DE" },
  };
  const PROX_STATUS = { aguardando:"producao", producao:"concluido" };
  const PROX_LBL    = { aguardando:"Iniciar produção", producao:"Concluir produção" };

  const ABAS = [
    { id:"producao",   label:"Checklist (" + totalItens + ")" },
    { id:"deliveries", label:"Deliveries (" + (dados?.deliveries?.length || 0) + ")" },
    { id:"retiradas",  label:"Retiradas (" + (dados?.retiradas?.length || 0) + ")" },
  ];

  if (carregando) return (
    <div style={{ display:"flex", justifyContent:"center", padding:80 }}>
      <div className="spinner" style={{ width:36, height:36 }} />
    </div>
  );

  const st = STATUS_INFO[statusGeral];

  return (
    <div style={{ minHeight:"100dvh", background:"#F9F9F9", paddingBottom:80 }}>
      {toast && <div className="toast success">{toast}</div>}

      {/* Header */}
      <div style={{ background:"white", padding:"14px 16px 0",
                    borderBottom:"0.5px solid #E0DED6", position:"sticky", top:0, zIndex:10 }}>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:10 }}>
          <div style={{ display:"flex", alignItems:"center", gap:10 }}>
            <button onClick={() => navigate("/dono")}
              style={{ background:"none", border:"none", cursor:"pointer", fontSize:20 }}>←</button>
            <div>
              <h2 style={{ fontSize:17, fontWeight:600 }}>Ordem de produção</h2>
              <p style={{ fontSize:11, color:"#888780" }}>
                {dados?.total_pedidos || 0} pedidos · {dados?.total_unidades || 0} unidades
              </p>
            </div>
          </div>
          <button onClick={exportarPDF} disabled={exportando || !dados?.total_pedidos}
            style={{ padding:"7px 13px", borderRadius:20, border:"0.5px solid #E0DED6",
                     background:"#F9F9F9", fontSize:12, cursor:"pointer",
                     color: exportando ? "#888780" : "#1A1A1A", display:"flex",
                     alignItems:"center", gap:5 }}>
            {exportando ? <><span className="spinner" style={{ width:14, height:14 }} /> Gerando...</> : "📄 PDF"}
          </button>
        </div>

        {/* Abas */}
        <div style={{ display:"flex" }}>
          {ABAS.map(a => (
            <button key={a.id} onClick={() => setAbaAtiva(a.id)}
              style={{ flex:1, padding:"9px 4px", fontSize:12, cursor:"pointer", border:"none",
                       background:"transparent", fontWeight: abaAtiva===a.id ? 600 : 400,
                       color: abaAtiva===a.id ? "#854F0B" : "#888780",
                       borderBottom: abaAtiva===a.id ? "2px solid #854F0B" : "2px solid transparent" }}>
              {a.label}
            </button>
          ))}
        </div>
      </div>

      <div style={{ padding:12, display:"flex", flexDirection:"column", gap:10 }}>

        {/* Status e progresso */}
        <div style={{ background:"white", borderRadius:12, border:"0.5px solid #E0DED6", padding:"13px 14px" }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10 }}>
            <div style={{ display:"flex", alignItems:"center", gap:8 }}>
              <div style={{ width:10, height:10, borderRadius:"50%", background:st.cor }} />
              <div>
                <div style={{ fontSize:14, fontWeight:600, color:"#1A1A1A" }}>{st.label}</div>
                <div style={{ fontSize:11, color:"#888780", marginTop:1 }}>
                  {totalConc} de {totalItens} itens conferidos
                </div>
              </div>
            </div>
            {PROX_STATUS[statusGeral] && (
              <button onClick={() => setStatusGeral(PROX_STATUS[statusGeral])}
                style={{ padding:"7px 14px", borderRadius:20, border:"none", fontSize:12,
                         fontWeight:600, cursor:"pointer",
                         background: statusGeral === "aguardando" ? "#854F0B" : "#3B6D11",
                         color: "#FAC775" }}>
                {PROX_LBL[statusGeral]}
              </button>
            )}
          </div>
          {/* Barra de progresso */}
          <div style={{ height:6, background:"#F1EFE8", borderRadius:3, overflow:"hidden" }}>
            <div style={{ height:6, borderRadius:3, background:"#854F0B",
                          width:pctProgresso + "%", transition:"width .4s" }} />
          </div>
          <div style={{ display:"flex", justifyContent:"space-between", marginTop:4 }}>
            <span style={{ fontSize:11, color:"#888780" }}>Progresso</span>
            <span style={{ fontSize:11, fontWeight:600, color:"#854F0B" }}>{pctProgresso}%</span>
          </div>
        </div>

        {/* ── ABA: Checklist de produção ── */}
        {abaAtiva === "producao" && (
          <>
            {!dados?.quantitativos?.length ? (
              <div style={{ textAlign:"center", padding:60, color:"#888780" }}>
                <div style={{ fontSize:48, marginBottom:12 }}>📋</div>
                <p>Nenhum pedido para produzir hoje</p>
              </div>
            ) : (
              <>
                <div className="card">
                  {dados.quantitativos.map((q, i) => {
                    const feito = !!concluidos[q.produto_id];
                    return (
                      <div key={q.produto_id}
                        onClick={() => toggleConcluido(q.produto_id)}
                        style={{ display:"flex", alignItems:"center", gap:12, padding:"12px 14px",
                                 borderBottom: i < dados.quantitativos.length - 1 ? "0.5px solid #E0DED6" : "none",
                                 cursor:"pointer", background: feito ? "#F9F9F9" : "white",
                                 transition:"background .15s" }}>
                        {/* Checkbox */}
                        <div style={{ width:24, height:24, borderRadius:6, flexShrink:0,
                                      border: feito ? "none" : "1.5px solid #E0DED6",
                                      background: feito ? "#3B6D11" : "white",
                                      display:"flex", alignItems:"center", justifyContent:"center",
                                      transition:"all .15s" }}>
                          {feito && <span style={{ color:"white", fontSize:14, fontWeight:700 }}>✓</span>}
                        </div>
                        {/* Emoji e nome */}
                        <div style={{ fontSize:24, width:32, textAlign:"center", flexShrink:0 }}>
                          {q.emoji}
                        </div>
                        <div style={{ flex:1, minWidth:0 }}>
                          <div style={{ fontSize:14, fontWeight:600,
                                        color: feito ? "#888780" : "#1A1A1A",
                                        textDecoration: feito ? "line-through" : "none" }}>
                            {q.nome}
                          </div>
                          <div style={{ display:"flex", gap:6, alignItems:"center", marginTop:3 }}>
                            <span style={{ fontSize:10, padding:"2px 8px", borderRadius:10, fontWeight:600,
                                           background: CATS_BG[q.categoria] || "#F1EFE8",
                                           color: CATS_COR[q.categoria] || "#5F5E5A" }}>
                              {CATS[q.categoria] || q.categoria}
                            </span>
                            {q.alergenos && (
                              <span style={{ fontSize:10, padding:"2px 8px", borderRadius:10,
                                             background:"#FCEBEB", color:"#A32D2D" }}>
                                ⚠️ {q.alergenos}
                              </span>
                            )}
                          </div>
                          {q.nota_producao && (
                            <div style={{ fontSize:11, color:"#888780", marginTop:3, fontStyle:"italic" }}>
                              💡 {q.nota_producao}
                            </div>
                          )}
                        </div>
                        {/* Quantidade */}
                        <div style={{ textAlign:"center", background: feito ? "#F1EFE8" : "#FAEEDA",
                                      borderRadius:8, padding:"5px 10px", flexShrink:0 }}>
                          <div style={{ fontSize:18, fontWeight:700,
                                        color: feito ? "#888780" : "#854F0B", lineHeight:1 }}>
                            {q.quantidade}
                          </div>
                          <div style={{ fontSize:10, color:"#888780" }}>{q.unidade || "un."}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Resumo financeiro */}
                <div className="card" style={{ padding:"12px 14px" }}>
                  <div style={{ fontSize:13, fontWeight:600, color:"#888780", marginBottom:8 }}>
                    Resumo financeiro do dia
                  </div>
                  <div style={{ display:"flex", justifyContent:"space-between", marginBottom:4 }}>
                    <span style={{ fontSize:13, color:"#888780" }}>Total de pedidos</span>
                    <span style={{ fontSize:13, fontWeight:600 }}>{dados.total_pedidos}</span>
                  </div>
                  <div style={{ display:"flex", justifyContent:"space-between", marginBottom:4 }}>
                    <span style={{ fontSize:13, color:"#888780" }}>Total de unidades</span>
                    <span style={{ fontSize:13, fontWeight:600 }}>{dados.total_unidades}</span>
                  </div>
                  <div style={{ borderTop:"0.5px solid #E0DED6", marginTop:6, paddingTop:8,
                                display:"flex", justifyContent:"space-between" }}>
                    <span style={{ fontSize:14, fontWeight:600 }}>Faturamento previsto</span>
                    <span style={{ fontSize:14, fontWeight:600, color:"#854F0B" }}>
                      {fmt(dados.quantitativos.reduce((s, q) => s + q.faturamento, 0))}
                    </span>
                  </div>
                </div>

                {/* Observações de alergenos */}
                {dados.observacoes?.length > 0 && (
                  <div className="card" style={{ padding:"12px 14px" }}>
                    <div style={{ fontSize:13, fontWeight:600, color:"#A32D2D", marginBottom:8 }}>
                      ⚠️ Atenção — Restrições alimentares
                    </div>
                    {dados.observacoes.map((o, i) => (
                      <div key={i} style={{ fontSize:12, color:"#888780", padding:"4px 0",
                                            borderBottom: i < dados.observacoes.length-1 ? "0.5px solid #E0DED6" : "none" }}>
                        {o.cliente
                          ? <><strong style={{ color:"#1A1A1A" }}>{o.cliente}</strong>: {o.produto} — {o.alergeno}</>
                          : <><strong style={{ color:"#1A1A1A" }}>{o.produto}</strong>: {o.nota}</>
                        }
                      </div>
                    ))}
                  </div>
                )}

                <button onClick={limparChecklist}
                  style={{ padding:"10px", borderRadius:10, border:"0.5px solid #E0DED6",
                           background:"#F9F9F9", fontSize:13, color:"#888780", cursor:"pointer" }}>
                  🔄 Resetar checklist
                </button>
              </>
            )}
          </>
        )}

        {/* ── ABA: Deliveries ── */}
        {abaAtiva === "deliveries" && (
          <>
            {!dados?.deliveries?.length ? (
              <div style={{ textAlign:"center", padding:60, color:"#888780" }}>
                <div style={{ fontSize:48, marginBottom:12 }}>🛵</div>
                <p>Nenhum delivery hoje</p>
              </div>
            ) : dados.deliveries.map((d, i) => (
              <div key={d.id} className="card">
                <div style={{ padding:"11px 13px", borderBottom:"0.5px solid #E0DED6",
                              display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
                  <div>
                    <div style={{ fontSize:14, fontWeight:600 }}>
                      #{d.numero} — {d.cliente_nome}
                    </div>
                    <div style={{ fontSize:12, color:"#888780", marginTop:2 }}>
                      📞 {d.cliente_tel}
                    </div>
                  </div>
                  <span style={{ fontSize:10, padding:"3px 9px", borderRadius:10, fontWeight:600,
                                  background: d.pag_status === "pago" ? "#EAF3DE" : "#FAEEDA",
                                  color:      d.pag_status === "pago" ? "#27500A" : "#633806" }}>
                    {d.pag_status === "pago" ? "✅ PIX pago" : "💰 Cobrar na entrega"}
                  </span>
                </div>
                <div style={{ padding:"10px 13px", borderBottom:"0.5px solid #E0DED6" }}>
                  <div style={{ display:"flex", gap:6, marginBottom:6 }}>
                    <span style={{ fontSize:13 }}>📍</span>
                    <div>
                      <div style={{ fontSize:13, fontWeight:500 }}>
                        {d.endereco_entrega}
                        {d.bairro_entrega ? ", " + d.bairro_entrega : ""}
                      </div>
                      <div style={{ fontSize:11, color:"#888780" }}>
                        Entrega: {fmtData(d.data_entrega)}
                      </div>
                    </div>
                  </div>
                  <div style={{ display:"flex", flexWrap:"wrap", gap:4 }}>
                    {(d.itens || []).map((item, j) => (
                      <span key={j} style={{ background:"#F1EFE8", borderRadius:20,
                                              padding:"3px 10px", fontSize:11, color:"#5F5E5A" }}>
                        {item.emoji} {item.quantidade}x {item.nome}
                      </span>
                    ))}
                  </div>
                </div>
                <div style={{ padding:"9px 13px", display:"flex", justifyContent:"space-between" }}>
                  <span style={{ fontSize:13, color:"#888780" }}>Total</span>
                  <span style={{ fontSize:14, fontWeight:600, color:"#854F0B" }}>{fmt(d.total)}</span>
                </div>
              </div>
            ))}
          </>
        )}

        {/* ── ABA: Retiradas ── */}
        {abaAtiva === "retiradas" && (
          <>
            {!dados?.retiradas?.length ? (
              <div style={{ textAlign:"center", padding:60, color:"#888780" }}>
                <div style={{ fontSize:48, marginBottom:12 }}>🏪</div>
                <p>Nenhuma retirada hoje</p>
              </div>
            ) : dados.retiradas.map((r) => (
              <div key={r.id} className="card">
                <div style={{ padding:"11px 13px", borderBottom:"0.5px solid #E0DED6",
                              display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                  <div>
                    <div style={{ fontSize:14, fontWeight:600 }}>#{r.numero} — {r.cliente_nome}</div>
                    <div style={{ fontSize:12, color:"#888780", marginTop:2 }}>📞 {r.cliente_tel}</div>
                  </div>
                  <span style={{ fontSize:10, padding:"3px 9px", borderRadius:10, fontWeight:600,
                                  background: r.pag_status === "pago" ? "#EAF3DE" : "#FAEEDA",
                                  color:      r.pag_status === "pago" ? "#27500A" : "#633806" }}>
                    {r.pag_status === "pago" ? "✅ Pago" : "💰 Cobrar"}
                  </span>
                </div>
                <div style={{ padding:"10px 13px", borderBottom:"0.5px solid #E0DED6" }}>
                  <div style={{ display:"flex", flexWrap:"wrap", gap:4 }}>
                    {(r.itens || []).map((item, j) => (
                      <span key={j} style={{ background:"#F1EFE8", borderRadius:20,
                                              padding:"3px 10px", fontSize:11, color:"#5F5E5A" }}>
                        {item.emoji} {item.quantidade}x {item.nome}
                      </span>
                    ))}
                  </div>
                </div>
                <div style={{ padding:"9px 13px", display:"flex", justifyContent:"space-between" }}>
                  <span style={{ fontSize:13, color:"#888780" }}>Total</span>
                  <span style={{ fontSize:14, fontWeight:600, color:"#854F0B" }}>{fmt(r.total)}</span>
                </div>
              </div>
            ))}
          </>
        )}
      </div>

      {/* Botão de atualizar fixo */}
      <div style={{ position:"fixed", bottom:0, left:"50%", transform:"translateX(-50%)",
                    width:"100%", maxWidth:430, padding:"10px 16px 24px",
                    background:"white", borderTop:"0.5px solid #E0DED6" }}>
        <button onClick={carregar}
          style={{ width:"100%", padding:"12px", borderRadius:10, border:"0.5px solid #E0DED6",
                   background:"#F9F9F9", fontSize:14, cursor:"pointer", color:"#1A1A1A" }}>
          🔄 Atualizar pedidos
        </button>
      </div>
    </div>
  );
}
