// frontend/src/pages/dono/Produtos.jsx
// Lista todos os produtos da padaria com acoes: toggle disponibilidade,
// editar, desativar/reativar e criar novo

import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { produtosService } from "../../services/api";

const CATS = [
  { id:"classicos",  label:"Clássicos" },
  { id:"especiais",  label:"Especiais" },
  { id:"doces",      label:"Doces"     },
  { id:"integrais",  label:"Integrais" },
  { id:"hamburguers",     label:"Hamburguers"    },
  { id:"outros",     label:"Outros"    },
];
const CAT_COR = { classicos:"#854F0B", especiais:"#185FA5", integrais:"#3B6D11", doces:"#993556", outros:"#5F5E5A" };
const CAT_BG  = { classicos:"#FAEEDA", especiais:"#E6F1FB", integrais:"#EAF3DE", doces:"#FBEAF0", outros:"#F1EFE8" };

const EMOJIS = ["🥖","🧀","🥐","🍞","🌾","🍯","🧁","🍕","🥨","🫓","🍰","🧇","🍩","🥧","🫔"];

const FORM_VAZIO = {
  nome:"", descricao:"", emoji:"🥖", categoria:"classicos",
  unidade:"unidade", preco:"", estoque_max:"100",
  ativo:true, disponivel_hoje:true, permite_delivery:true,
  alergenos:"", nota_producao:"", badge:"",
};

export default function Produtos() {
  const navigate = useNavigate();

  const [produtos,    setProdutos]    = useState([]);
  const [carregando,  setCarregando]  = useState(true);
  const [catFiltro,   setCatFiltro]   = useState("todos");
  const [busca,       setBusca]       = useState("");
  const [toast,       setToast]       = useState("");

  // Controle do formulario lateral (drawer)
  const [drawerAberto, setDrawerAberto] = useState(false);
  const [editandoId,   setEditandoId]   = useState(null); // null = novo produto
  const [form,         setForm]         = useState(FORM_VAZIO);
  const [salvando,     setSalvando]     = useState(false);
  const [erros,        setErros]        = useState({});

  // Modal de confirmacao de exclusao
  const [confirmarExcluir, setConfirmarExcluir] = useState(null); // produto ou null

  function mostrarToast(msg, tipo = "success") {
    setToast({ msg, tipo });
    setTimeout(() => setToast(""), 2500);
  }

  // Carrega lista de produtos
  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      const params = {};
      if (catFiltro !== "todos") params.categoria = catFiltro;
      if (busca.trim()) params.busca = busca.trim();
      const { data } = await produtosService.admin(params);
      setProdutos(data.produtos || []);
    } catch (err) {
      console.error("Erro ao carregar produtos:", err);
    } finally {
      setCarregando(false);
    }
  }, [catFiltro, busca]);

  useEffect(() => { carregar(); }, [catFiltro]);

  // Busca com debounce
  useEffect(() => {
    const t = setTimeout(carregar, 400);
    return () => clearTimeout(t);
  }, [busca]);

  // ── Drawer: abrir para novo produto ──────────────────────────────────────
  function abrirNovo() {
    setEditandoId(null);
    setForm(FORM_VAZIO);
    setErros({});
    setDrawerAberto(true);
  }

  // ── Drawer: abrir para editar produto existente ───────────────────────────
  function abrirEditar(produto) {
    setEditandoId(produto.id);
    setForm({
      nome:             produto.nome            || "",
      descricao:        produto.descricao       || "",
      emoji:            produto.emoji           || "🥖",
      categoria:        produto.categoria       || "classicos",
      unidade:          produto.unidade         || "unidade",
      preco:            String(produto.preco    || ""),
      estoque_max:      String(produto.estoque_max || "100"),
      ativo:            produto.ativo           ?? true,
      disponivel_hoje:  produto.disponivel_hoje ?? true,
      permite_delivery: produto.permite_delivery ?? true,
      alergenos:        produto.alergenos       || "",
      nota_producao:    produto.nota_producao   || "",
      badge:            produto.badge           || "",
    });
    setErros({});
    setDrawerAberto(true);
  }

  function fecharDrawer() {
    setDrawerAberto(false);
    setEditandoId(null);
    setErros({});
  }

  // ── Validar formulario ────────────────────────────────────────────────────
  function validar() {
    const e = {};
    if (!form.nome.trim())              e.nome  = "Nome é obrigatório";
    if (!form.preco || Number(form.preco) <= 0) e.preco = "Informe um preço válido";
    setErros(e);
    return Object.keys(e).length === 0;
  }

  // ── Salvar (criar ou editar) ──────────────────────────────────────────────
  async function salvar() {
    if (!validar()) return;
    setSalvando(true);
    try {
      const payload = {
        ...form,
        preco:       Number(form.preco),
        estoque_max: Number(form.estoque_max) || 100,
        badge:       form.badge || null,
        alergenos:   form.alergenos   || null,
        nota_producao: form.nota_producao || null,
      };

      if (editandoId) {
        await produtosService.editar(editandoId, payload);
        mostrarToast("✅ Produto atualizado!");
      } else {
        await produtosService.criar(payload);
        mostrarToast("✅ Produto criado!");
      }
      fecharDrawer();
      carregar();
    } catch (err) {
      const msg = err.response?.data?.error || "Erro ao salvar produto";
      mostrarToast("❌ " + msg, "error");
    } finally {
      setSalvando(false);
    }
  }

  // ── Toggle disponivel hoje ────────────────────────────────────────────────
  async function toggleDisp(produto) {
    const novo = !produto.disponivel_hoje;
    try {
      await produtosService.toggleDisp(produto.id, novo);
      setProdutos(prev =>
        prev.map(p => p.id === produto.id ? { ...p, disponivel_hoje: novo } : p)
      );
      mostrarToast(novo ? "✅ Disponível hoje" : "⏸️ Pausado para hoje");
    } catch {
      mostrarToast("❌ Erro ao atualizar", "error");
    }
  }

  // ── Desativar / reativar produto ──────────────────────────────────────────
  async function toggleAtivo(produto) {
    try {
      if (produto.ativo) {
        // Desativar via DELETE (soft delete)
        await produtosService.desativar(produto.id);
        mostrarToast("🗑️ Produto desativado");
      } else {
        // Reativar via PUT
        await produtosService.editar(produto.id, { ativo: true, disponivel_hoje: true });
        mostrarToast("✅ Produto reativado");
      }
      setConfirmarExcluir(null);
      carregar();
    } catch {
      mostrarToast("❌ Erro ao alterar produto", "error");
    }
  }

  function setF(campo, valor) {
    setForm(prev => ({ ...prev, [campo]: valor }));
    if (erros[campo]) setErros(prev => ({ ...prev, [campo]: "" }));
  }

  const produtosFiltrados = produtos; // filtro já vem da API

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight:"100dvh", background:"#F9F9F9" }}>
      {toast && (
        <div className={"toast " + (toast.tipo || "success")}>{toast.msg}</div>
      )}

      {/* Modal de confirmação de desativação */}
      {confirmarExcluir && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.45)",
                      display:"flex", alignItems:"center", justifyContent:"center",
                      zIndex:200, padding:20 }}>
          <div style={{ background:"white", borderRadius:16, padding:24,
                        maxWidth:320, width:"100%" }}>
            <div style={{ fontSize:36, textAlign:"center", marginBottom:12 }}>
              {confirmarExcluir.ativo ? "🗑️" : "✅"}
            </div>
            <h3 style={{ textAlign:"center", fontSize:16, marginBottom:8 }}>
              {confirmarExcluir.ativo ? "Desativar produto?" : "Reativar produto?"}
            </h3>
            <p style={{ textAlign:"center", fontSize:13, color:"#888780", marginBottom:20 }}>
              {confirmarExcluir.ativo
                ? `"${confirmarExcluir.nome}" ficará oculto no catálogo. O histórico de pedidos é mantido.`
                : `"${confirmarExcluir.nome}" voltará a aparecer no catálogo.`}
            </p>
            <div style={{ display:"flex", gap:8 }}>
              <button onClick={() => setConfirmarExcluir(null)}
                style={{ flex:1, padding:12, borderRadius:10, border:"0.5px solid #E0DED6",
                         background:"#F9F9F9", fontSize:14, cursor:"pointer" }}>
                Cancelar
              </button>
              <button onClick={() => toggleAtivo(confirmarExcluir)}
                style={{ flex:1, padding:12, borderRadius:10, border:"none", fontSize:14,
                         fontWeight:600, cursor:"pointer",
                         background: confirmarExcluir.ativo ? "#A32D2D" : "#3B6D11",
                         color:"white" }}>
                {confirmarExcluir.ativo ? "Desativar" : "Reativar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div style={{ background:"white", padding:"14px 16px 0",
                    borderBottom:"0.5px solid #E0DED6", position:"sticky", top:0, zIndex:10 }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10 }}>
          <div style={{ display:"flex", alignItems:"center", gap:10 }}>
            <button onClick={() => navigate("/dono")}
              style={{ background:"none", border:"none", cursor:"pointer", fontSize:20 }}>←</button>
            <h2 style={{ fontSize:17, fontWeight:600 }}>Produtos</h2>
            <span style={{ fontSize:12, color:"#888780", background:"#F1EFE8",
                           padding:"2px 8px", borderRadius:10 }}>
              {produtos.length}
            </span>
          </div>
          <button onClick={abrirNovo}
            style={{ background:"#854F0B", color:"#FAC775", border:"none",
                     borderRadius:20, padding:"7px 16px", fontSize:13,
                     fontWeight:600, cursor:"pointer" }}>
            + Novo produto
          </button>
        </div>

        {/* Busca */}
        <div style={{ marginBottom:8 }}>
          <input className="input" placeholder="Buscar produto..."
            value={busca} onChange={e => setBusca(e.target.value)} />
        </div>

        {/* Filtros de categoria */}
        <div className="scroll-x" style={{ display:"flex", gap:6, paddingBottom:10 }}>
          <button onClick={() => setCatFiltro("todos")}
            style={{ flexShrink:0, padding:"5px 13px", borderRadius:20, fontSize:12,
                     cursor:"pointer", border:"0.5px solid",
                     background:  catFiltro==="todos" ? "#854F0B" : "#F9F9F9",
                     borderColor: catFiltro==="todos" ? "#854F0B" : "#E0DED6",
                     color:       catFiltro==="todos" ? "#FAC775" : "#888780" }}>
            Todos
          </button>
          {CATS.map(c => (
            <button key={c.id} onClick={() => setCatFiltro(c.id)}
              style={{ flexShrink:0, padding:"5px 13px", borderRadius:20, fontSize:12,
                       cursor:"pointer", border:"0.5px solid",
                       background:  catFiltro===c.id ? "#854F0B" : "#F9F9F9",
                       borderColor: catFiltro===c.id ? "#854F0B" : "#E0DED6",
                       color:       catFiltro===c.id ? "#FAC775" : "#888780" }}>
              {c.label}
            </button>
          ))}
        </div>
      </div>

      {/* Lista de produtos */}
      <div style={{ padding:12, display:"flex", flexDirection:"column", gap:8 }}>
        {carregando ? (
          <div style={{ display:"flex", justifyContent:"center", padding:40 }}>
            <div className="spinner" style={{ width:32, height:32 }} />
          </div>
        ) : produtosFiltrados.length === 0 ? (
          <div style={{ textAlign:"center", padding:60 }}>
            <div style={{ fontSize:48, marginBottom:12 }}>🥖</div>
            <p style={{ color:"#888780", fontSize:14 }}>Nenhum produto encontrado</p>
            <button onClick={abrirNovo}
              style={{ marginTop:16, padding:"10px 24px", borderRadius:20,
                       background:"#854F0B", color:"#FAC775", border:"none",
                       fontSize:13, fontWeight:600, cursor:"pointer" }}>
              Criar primeiro produto
            </button>
          </div>
        ) : produtosFiltrados.map(p => (
          <div key={p.id} className="card"
            style={{ opacity: p.ativo ? 1 : 0.55 }}>
            <div style={{ display:"flex", alignItems:"center", gap:10, padding:"11px 13px" }}>
              {/* Emoji */}
              <div style={{ fontSize:28, width:38, height:38, borderRadius:10,
                            background:"#F9F9F9", display:"flex", alignItems:"center",
                            justifyContent:"center", flexShrink:0 }}>
                {p.emoji}
              </div>

              {/* Infos */}
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ display:"flex", alignItems:"center", gap:6, flexWrap:"wrap" }}>
                  <span style={{ fontSize:14, fontWeight:600,
                                  color: p.ativo ? "#1A1A1A" : "#888780",
                                  textDecoration: p.ativo ? "none" : "line-through" }}>
                    {p.nome}
                  </span>
                  {!p.ativo && (
                    <span style={{ fontSize:10, padding:"2px 7px", borderRadius:10,
                                   background:"#F1EFE8", color:"#5F5E5A" }}>
                      Inativo
                    </span>
                  )}
                  {p.badge && (
                    <span style={{ fontSize:10, padding:"2px 7px", borderRadius:10,
                                   background: p.badge==="esgotado" ? "#FCEBEB" : p.badge==="novo" ? "#EAF3DE" : "#FAEEDA",
                                   color:      p.badge==="esgotado" ? "#791F1F" : p.badge==="novo" ? "#27500A" : "#633806" }}>
                      {p.badge}
                    </span>
                  )}
                </div>
                <div style={{ fontSize:12, color:"#888780", marginTop:2 }}>
                  <span style={{ padding:"1px 7px", borderRadius:8, fontSize:10,
                                  background: CAT_BG[p.categoria] || "#F1EFE8",
                                  color:      CAT_COR[p.categoria] || "#5F5E5A",
                                  marginRight:6 }}>
                    {CATS.find(c=>c.id===p.categoria)?.label || p.categoria}
                  </span>
                  R$ {Number(p.preco).toFixed(2).replace(".",",")} / {p.unidade}
                </div>
              </div>

              {/* Ações */}
              <div style={{ display:"flex", gap:6, alignItems:"center", flexShrink:0 }}>
                {/* Toggle disponível hoje */}
                {p.ativo && (
                  <div className={"toggle" + (p.disponivel_hoje ? " on" : "")}
                       onClick={() => toggleDisp(p)}
                       title={p.disponivel_hoje ? "Pausar hoje" : "Ativar para hoje"} />
                )}
                {/* Editar */}
                <button onClick={() => abrirEditar(p)}
                  style={{ padding:"5px 11px", borderRadius:8, border:"0.5px solid #E0DED6",
                           background:"#F9F9F9", fontSize:12, cursor:"pointer", color:"#1A1A1A" }}>
                  ✏️
                </button>
                {/* Desativar / Reativar */}
                <button onClick={() => setConfirmarExcluir(p)}
                  style={{ padding:"5px 11px", borderRadius:8, border:"0.5px solid",
                           borderColor: p.ativo ? "#FCEBEB" : "#EAF3DE",
                           background:  p.ativo ? "#FCEBEB" : "#EAF3DE",
                           fontSize:12, cursor:"pointer",
                           color: p.ativo ? "#A32D2D" : "#3B6D11" }}>
                  {p.ativo ? "🗑️" : "↩️"}
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* ── Drawer de formulário ── */}
      {drawerAberto && (
        <>
          {/* Overlay escuro */}
          <div onClick={fecharDrawer}
            style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.4)", zIndex:100 }} />

          {/* Painel deslizante */}
          <div style={{ position:"fixed", bottom:0, left:"50%", transform:"translateX(-50%)",
                        width:"100%", maxWidth:430, background:"white", borderRadius:"20px 20px 0 0",
                        zIndex:101, maxHeight:"92dvh", display:"flex", flexDirection:"column",
                        animation:"slideUp .25s ease" }}>
            <style>{`@keyframes slideUp { from { transform: translateX(-50%) translateY(100%); } to { transform: translateX(-50%) translateY(0); } }`}</style>

            {/* Handle + título */}
            <div style={{ padding:"12px 16px 8px", borderBottom:"0.5px solid #E0DED6",
                          display:"flex", alignItems:"center", justifyContent:"space-between",
                          flexShrink:0 }}>
              <div style={{ width:36, height:4, borderRadius:2, background:"#E0DED6",
                            position:"absolute", top:8, left:"50%", transform:"translateX(-50%)" }} />
              <h3 style={{ fontSize:16, fontWeight:600, marginTop:4 }}>
                {editandoId ? "Editar produto" : "Novo produto"}
              </h3>
              <button onClick={fecharDrawer}
                style={{ background:"#F9F9F9", border:"0.5px solid #E0DED6", borderRadius:"50%",
                         width:32, height:32, cursor:"pointer", fontSize:16, display:"flex",
                         alignItems:"center", justifyContent:"center" }}>
                ✕
              </button>
            </div>

            {/* Conteúdo com scroll */}
            <div style={{ overflowY:"auto", flex:1, padding:"12px 16px 0" }}>

              {/* Seletor de emoji */}
              <div style={{ marginBottom:14 }}>
                <label style={{ fontSize:12, color:"#888780", display:"block", marginBottom:6 }}>
                  Ícone do produto
                </label>
                <div style={{ display:"grid", gridTemplateColumns:"repeat(8,1fr)", gap:4 }}>
                  {EMOJIS.map(e => (
                    <button key={e} onClick={() => setF("emoji", e)}
                      style={{ aspectRatio:"1", borderRadius:8, fontSize:20, cursor:"pointer",
                               border: form.emoji===e ? "2px solid #854F0B" : "0.5px solid #E0DED6",
                               background: form.emoji===e ? "#FAEEDA" : "#F9F9F9",
                               display:"flex", alignItems:"center", justifyContent:"center" }}>
                      {e}
                    </button>
                  ))}
                </div>
              </div>

              {/* Nome */}
              <div style={{ marginBottom:12 }}>
                <label style={{ fontSize:12, color:"#888780", display:"block", marginBottom:5 }}>
                  Nome <span style={{ color:"#A32D2D" }}>*</span>
                </label>
                <input className="input" placeholder="Ex: Pão francês"
                  value={form.nome} onChange={e => setF("nome", e.target.value)} />
                {erros.nome && <p style={{ fontSize:11, color:"#A32D2D", marginTop:3 }}>{erros.nome}</p>}
              </div>

              {/* Descrição */}
              <div style={{ marginBottom:12 }}>
                <label style={{ fontSize:12, color:"#888780", display:"block", marginBottom:5 }}>
                  Descrição curta
                </label>
                <textarea className="input" placeholder="Ex: Crocante por fora, macio por dentro"
                  rows={2} style={{ resize:"none", lineHeight:1.4 }}
                  value={form.descricao} onChange={e => setF("descricao", e.target.value)} />
              </div>

              {/* Categoria + Unidade */}
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginBottom:12 }}>
                <div>
                  <label style={{ fontSize:12, color:"#888780", display:"block", marginBottom:5 }}>Categoria</label>
                  <select className="input" value={form.categoria} onChange={e => setF("categoria", e.target.value)}>
                    {CATS.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize:12, color:"#888780", display:"block", marginBottom:5 }}>Unidade</label>
                  <select className="input" value={form.unidade} onChange={e => setF("unidade", e.target.value)}>
                    <option value="unidade">Unidade</option>
                    <option value="pacote">Pacote</option>
                    <option value="kg">Kg</option>
                    <option value="duzia">Dúzia</option>
                    <option value="bandeja">Bandeja</option>
                  </select>
                </div>
              </div>

              {/* Preço + Estoque */}
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginBottom:12 }}>
                <div>
                  <label style={{ fontSize:12, color:"#888780", display:"block", marginBottom:5 }}>
                    Preço (R$) <span style={{ color:"#A32D2D" }}>*</span>
                  </label>
                  <input className="input" type="number" min="0" step="0.01"
                    placeholder="0,00" value={form.preco}
                    onChange={e => setF("preco", e.target.value)} />
                  {erros.preco && <p style={{ fontSize:11, color:"#A32D2D", marginTop:3 }}>{erros.preco}</p>}
                </div>
                <div>
                  <label style={{ fontSize:12, color:"#888780", display:"block", marginBottom:5 }}>
                    Estoque máximo
                  </label>
                  <input className="input" type="number" min="1"
                    placeholder="100" value={form.estoque_max}
                    onChange={e => setF("estoque_max", e.target.value)} />
                </div>
              </div>

              {/* Badge */}
              <div style={{ marginBottom:12 }}>
                <label style={{ fontSize:12, color:"#888780", display:"block", marginBottom:6 }}>Badge</label>
                <div style={{ display:"flex", gap:6 }}>
                  {[{id:"",label:"Nenhum"},{id:"promocao",label:"Promoção"},{id:"novo",label:"Novo"},{id:"destaque",label:"Destaque"},{id:"esgotado",label:"Esgotado"}].map(b => (
                    <button key={b.id} onClick={() => setF("badge", b.id)}
                      style={{ flex:1, padding:"6px 4px", borderRadius:8, fontSize:12, cursor:"pointer",
                               border: form.badge===b.id ? "2px solid #854F0B" : "0.5px solid #E0DED6",
                               background: form.badge===b.id ? "#FAEEDA" : "#F9F9F9",
                               color: form.badge===b.id ? "#633806" : "#888780",
                               fontWeight: form.badge===b.id ? 600 : 400 }}>
                      {b.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Toggles */}
              <div style={{ background:"#F9F9F9", borderRadius:10, border:"0.5px solid #E0DED6",
                            marginBottom:12, overflow:"hidden" }}>
                {[
                  { campo:"ativo",           label:"Produto ativo",      sub:"Aparece no catálogo" },
                  { campo:"disponivel_hoje", label:"Disponível hoje",    sub:"Aceita pedidos para amanhã" },
                  { campo:"permite_delivery",label:"Permite delivery",   sub:"Pode ser entregue em casa" },
                ].map((t, i, arr) => (
                  <div key={t.campo}
                    style={{ display:"flex", alignItems:"center", justifyContent:"space-between",
                             padding:"11px 14px", borderBottom: i<arr.length-1 ? "0.5px solid #E0DED6":"none" }}>
                    <div>
                      <div style={{ fontSize:14, color:"#1A1A1A" }}>{t.label}</div>
                      <div style={{ fontSize:11, color:"#888780" }}>{t.sub}</div>
                    </div>
                    <div className={"toggle" + (form[t.campo] ? " on" : "")}
                         onClick={() => setF(t.campo, !form[t.campo])} />
                  </div>
                ))}
              </div>

              {/* Alérgenos */}
              <div style={{ marginBottom:12 }}>
                <label style={{ fontSize:12, color:"#888780", display:"block", marginBottom:5 }}>
                  Alérgenos / restrições
                </label>
                <input className="input" placeholder="Ex: contém glúten, lactose"
                  value={form.alergenos} onChange={e => setF("alergenos", e.target.value)} />
              </div>

              {/* Nota de produção */}
              <div style={{ marginBottom:20 }}>
                <label style={{ fontSize:12, color:"#888780", display:"block", marginBottom:5 }}>
                  Nota para produção
                </label>
                <textarea className="input" rows={2} style={{ resize:"none", lineHeight:1.4 }}
                  placeholder="Ex: assar por 20min a 200°C"
                  value={form.nota_producao} onChange={e => setF("nota_producao", e.target.value)} />
              </div>
            </div>

            {/* Botões fixos no fundo */}
            <div style={{ padding:"12px 16px 24px", borderTop:"0.5px solid #E0DED6",
                          display:"flex", gap:8, flexShrink:0, background:"white" }}>
              <button onClick={fecharDrawer}
                style={{ flex:1, padding:12, borderRadius:10, border:"0.5px solid #E0DED6",
                         background:"#F9F9F9", fontSize:14, cursor:"pointer", color:"#888780" }}>
                Cancelar
              </button>
              <button onClick={salvar} disabled={salvando}
                style={{ flex:2, padding:12, borderRadius:10, border:"none", fontSize:14,
                         fontWeight:600, cursor:"pointer",
                         background: salvando ? "#B4B2A9" : "#854F0B", color:"#FAC775",
                         display:"flex", alignItems:"center", justifyContent:"center", gap:6 }}>
                {salvando
                  ? <><span className="spinner" style={{ width:16, height:16 }} /> Salvando...</>
                  : editandoId ? "Salvar alterações" : "Criar produto"}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
