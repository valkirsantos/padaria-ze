// frontend/src/pages/dono/Produtos.jsx
import React, { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { produtosService } from "../../services/api";
import api from "../../services/api";

const CATS = [
  { id:"classicos",  label:"Clássicos" },
  { id:"especiais",  label:"Especiais" },
  { id:"doces",      label:"Doces"     },
  { id:"integrais",  label:"Integrais" },
  { id:"outros",     label:"Outros"    },
];
const CAT_COR = { classicos:"#854F0B", especiais:"#185FA5", integrais:"#3B6D11", doces:"#993556", outros:"#5F5E5A" };
const CAT_BG  = { classicos:"#FAEEDA", especiais:"#E6F1FB", integrais:"#EAF3DE", doces:"#FBEAF0", outros:"#F1EFE8" };
const EMOJIS  = ["🥖","🧀","🥐","🍞","🌾","🍯","🧁","🍕","🥨","🫓","🍰","🧇","🍩","🥧","🫔"];

const FORM_VAZIO = {
  nome:"", descricao:"", emoji:"🥖", foto_url:"",
  categoria:"classicos", unidade:"unidade", preco:"", estoque_max:"100",
  ativo:true, disponivel_hoje:true, permite_delivery:true,
  alergenos:"", nota_producao:"", badge:"",
};

// Resolve URL da foto — imagens locais precisam do prefixo do backend
function resolverFoto(url) {
  if (!url) return null;
  if (url.startsWith("http")) return url;
  return "http://localhost:3001" + url;
}

export default function Produtos() {
  const navigate   = useNavigate();
  const inputFoto  = useRef(null);

  const [produtos,     setProdutos]     = useState([]);
  const [carregando,   setCarregando]   = useState(true);
  const [catFiltro,    setCatFiltro]    = useState("todos");
  const [busca,        setBusca]        = useState("");
  const [toast,        setToast]        = useState("");

  const [drawerAberto, setDrawerAberto] = useState(false);
  const [editandoId,   setEditandoId]   = useState(null);
  const [form,         setForm]         = useState(FORM_VAZIO);
  const [salvando,     setSalvando]     = useState(false);
  const [erros,        setErros]        = useState({});

  // Estado do upload de foto
  const [fotoPreview,    setFotoPreview]    = useState(null);  // URL para preview
  const [fotoArquivo,    setFotoArquivo]    = useState(null);  // File object
  const [uploadandoFoto, setUploadandoFoto] = useState(false);
  const [modoFoto,       setModoFoto]       = useState("emoji"); // "emoji" | "foto"

  const [confirmarExcluir, setConfirmarExcluir] = useState(null);

  function mostrarToast(msg, tipo = "success") {
    setToast({ msg, tipo });
    setTimeout(() => setToast(""), 2500);
  }

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
  useEffect(() => {
    const t = setTimeout(carregar, 400);
    return () => clearTimeout(t);
  }, [busca]);

  // ── Abrir drawer ──────────────────────────────────────────────────────────
  function abrirNovo() {
    setEditandoId(null);
    setForm(FORM_VAZIO);
    setFotoPreview(null);
    setFotoArquivo(null);
    setModoFoto("emoji");
    setErros({});
    setDrawerAberto(true);
  }

  function abrirEditar(produto) {
    setEditandoId(produto.id);
    setForm({
      nome:             produto.nome             || "",
      descricao:        produto.descricao        || "",
      emoji:            produto.emoji            || "🥖",
      foto_url:         produto.foto_url         || "",
      categoria:        produto.categoria        || "classicos",
      unidade:          produto.unidade          || "unidade",
      preco:            String(produto.preco     || ""),
      estoque_max:      String(produto.estoque_max || "100"),
      ativo:            produto.ativo            ?? true,
      disponivel_hoje:  produto.disponivel_hoje  ?? true,
      permite_delivery: produto.permite_delivery ?? true,
      alergenos:        produto.alergenos        || "",
      nota_producao:    produto.nota_producao    || "",
      badge:            produto.badge            || "",
    });
    // Se o produto já tem foto, mostra no modo foto
    if (produto.foto_url) {
      setFotoPreview(resolverFoto(produto.foto_url));
      setModoFoto("foto");
    } else {
      setFotoPreview(null);
      setModoFoto("emoji");
    }
    setFotoArquivo(null);
    setErros({});
    setDrawerAberto(true);
  }

  function fecharDrawer() {
    setDrawerAberto(false);
    setEditandoId(null);
    setFotoPreview(null);
    setFotoArquivo(null);
    setErros({});
  }

  // ── Selecionar foto do dispositivo ───────────────────────────────────────
  function handleSelecionarFoto(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    // Valida tipo e tamanho no frontend antes de enviar
    const tiposOk = ["image/jpeg","image/jpg","image/png","image/webp"];
    if (!tiposOk.includes(file.type)) {
      mostrarToast("❌ Use JPG, PNG ou WebP", "error");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      mostrarToast("❌ Foto muito grande. Máximo 5MB", "error");
      return;
    }

    setFotoArquivo(file);
    setModoFoto("foto");
    // Preview local — não precisa fazer upload ainda
    const reader = new FileReader();
    reader.onload = (ev) => setFotoPreview(ev.target.result);
    reader.readAsDataURL(file);
    // Limpa o foto_url existente pois vai ser substituído
    setForm(prev => ({ ...prev, foto_url: "" }));
  }

  // ── Remover foto ──────────────────────────────────────────────────────────
  function removerFoto() {
    setFotoPreview(null);
    setFotoArquivo(null);
    setModoFoto("emoji");
    setForm(prev => ({ ...prev, foto_url: "" }));
    if (inputFoto.current) inputFoto.current.value = "";
  }

  // ── Fazer upload e salvar ─────────────────────────────────────────────────
  async function salvar() {
    const e = {};
    if (!form.nome.trim())                    e.nome  = "Nome é obrigatório";
    if (!form.preco || Number(form.preco) <= 0) e.preco = "Informe um preço válido";
    setErros(e);
    if (Object.keys(e).length > 0) return;

    setSalvando(true);
    let foto_url = form.foto_url;

    try {
      // Se tem arquivo novo para enviar, faz o upload primeiro
      if (fotoArquivo) {
        setUploadandoFoto(true);
        const formData = new FormData();
        formData.append("foto", fotoArquivo);
        const { data } = await api.post("/upload/produto", formData, {
          headers: { "Content-Type": "multipart/form-data" },
        });
        foto_url = data.url;
        setUploadandoFoto(false);
      }

      const payload = {
        ...form,
        foto_url:    foto_url || null,
        preco:       Number(form.preco),
        estoque_max: Number(form.estoque_max) || 100,
        badge:       form.badge       || null,
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
      setUploadandoFoto(false);
      const msg = err.response?.data?.error || "Erro ao salvar produto";
      mostrarToast("❌ " + msg, "error");
    } finally {
      setSalvando(false);
    }
  }

  async function toggleDisp(produto) {
    const novo = !produto.disponivel_hoje;
    try {
      await produtosService.toggleDisp(produto.id, novo);
      setProdutos(prev => prev.map(p => p.id === produto.id ? { ...p, disponivel_hoje: novo } : p));
      mostrarToast(novo ? "✅ Disponível hoje" : "⏸️ Pausado para hoje");
    } catch { mostrarToast("❌ Erro ao atualizar", "error"); }
  }

  async function toggleAtivo(produto) {
    try {
      if (produto.ativo) {
        await produtosService.desativar(produto.id);
        mostrarToast("🗑️ Produto desativado");
      } else {
        await produtosService.editar(produto.id, { ativo: true, disponivel_hoje: true });
        mostrarToast("✅ Produto reativado");
      }
      setConfirmarExcluir(null);
      carregar();
    } catch { mostrarToast("❌ Erro ao alterar produto", "error"); }
  }

  function setF(campo, valor) {
    setForm(prev => ({ ...prev, [campo]: valor }));
    if (erros[campo]) setErros(prev => ({ ...prev, [campo]: "" }));
  }

  return (
    <div style={{ minHeight:"100dvh", background:"#F9F9F9" }}>
      {toast && <div className={"toast " + (toast.tipo||"success")}>{toast.msg}</div>}

      {/* Modal de confirmação */}
      {confirmarExcluir && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.45)",
                      display:"flex", alignItems:"center", justifyContent:"center",
                      zIndex:200, padding:20 }}>
          <div style={{ background:"white", borderRadius:16, padding:24, maxWidth:320, width:"100%" }}>
            <div style={{ fontSize:36, textAlign:"center", marginBottom:12 }}>
              {confirmarExcluir.ativo ? "🗑️" : "✅"}
            </div>
            <h3 style={{ textAlign:"center", fontSize:16, marginBottom:8 }}>
              {confirmarExcluir.ativo ? "Desativar produto?" : "Reativar produto?"}
            </h3>
            <p style={{ textAlign:"center", fontSize:13, color:"#888780", marginBottom:20 }}>
              {confirmarExcluir.ativo
                ? `"${confirmarExcluir.nome}" ficará oculto no catálogo.`
                : `"${confirmarExcluir.nome}" voltará ao catálogo.`}
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
        <div style={{ marginBottom:8 }}>
          <input className="input" placeholder="Buscar produto..."
            value={busca} onChange={e => setBusca(e.target.value)} />
        </div>
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

      {/* Lista */}
      <div style={{ padding:12, display:"flex", flexDirection:"column", gap:8 }}>
        {carregando ? (
          <div style={{ display:"flex", justifyContent:"center", padding:40 }}>
            <div className="spinner" style={{ width:32, height:32 }} />
          </div>
        ) : produtos.length === 0 ? (
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
        ) : produtos.map(p => (
          <div key={p.id} className="card" style={{ opacity: p.ativo ? 1 : 0.55 }}>
            <div style={{ display:"flex", alignItems:"center", gap:10, padding:"11px 13px" }}>
              {/* Thumb: foto ou emoji */}
              <div style={{ width:46, height:46, borderRadius:10, flexShrink:0, overflow:"hidden",
                            background:"#F9F9F9", display:"flex", alignItems:"center",
                            justifyContent:"center" }}>
                {p.foto_url
                  ? <img src={resolverFoto(p.foto_url)} alt={p.nome}
                         style={{ width:"100%", height:"100%", objectFit:"cover" }} />
                  : <span style={{ fontSize:26 }}>{p.emoji}</span>}
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
                                   background:"#F1EFE8", color:"#5F5E5A" }}>Inativo</span>
                  )}
                  {p.badge && (
                    <span style={{ fontSize:10, padding:"2px 7px", borderRadius:10,
                                   background: p.badge==="esgotado"?"#FCEBEB":p.badge==="novo"?"#EAF3DE":"#FAEEDA",
                                   color:      p.badge==="esgotado"?"#791F1F":p.badge==="novo"?"#27500A":"#633806" }}>
                      {p.badge}
                    </span>
                  )}
                </div>
                <div style={{ fontSize:12, color:"#888780", marginTop:2 }}>
                  <span style={{ padding:"1px 7px", borderRadius:8, fontSize:10, marginRight:6,
                                  background: CAT_BG[p.categoria]||"#F1EFE8",
                                  color:      CAT_COR[p.categoria]||"#5F5E5A" }}>
                    {CATS.find(c=>c.id===p.categoria)?.label || p.categoria}
                  </span>
                  R$ {Number(p.preco).toFixed(2).replace(".",",")} / {p.unidade}
                </div>
              </div>

              {/* Ações */}
              <div style={{ display:"flex", gap:6, alignItems:"center", flexShrink:0 }}>
                {p.ativo && (
                  <div className={"toggle"+(p.disponivel_hoje?" on":"")}
                       onClick={() => toggleDisp(p)} />
                )}
                <button onClick={() => abrirEditar(p)}
                  style={{ padding:"5px 11px", borderRadius:8, border:"0.5px solid #E0DED6",
                           background:"#F9F9F9", fontSize:12, cursor:"pointer" }}>✏️</button>
                <button onClick={() => setConfirmarExcluir(p)}
                  style={{ padding:"5px 11px", borderRadius:8, border:"0.5px solid",
                           borderColor: p.ativo?"#FCEBEB":"#EAF3DE",
                           background:  p.ativo?"#FCEBEB":"#EAF3DE",
                           fontSize:12, cursor:"pointer",
                           color: p.ativo?"#A32D2D":"#3B6D11" }}>
                  {p.ativo?"🗑️":"↩️"}
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* ── Drawer de formulário ── */}
      {drawerAberto && (
        <>
          <div onClick={fecharDrawer}
            style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.4)", zIndex:100 }} />
          <div style={{ position:"fixed", bottom:0, left:"50%", transform:"translateX(-50%)",
                        width:"100%", maxWidth:430, background:"white",
                        borderRadius:"20px 20px 0 0", zIndex:101,
                        maxHeight:"93dvh", display:"flex", flexDirection:"column",
                        animation:"slideUp .25s ease" }}>
            <style>{`@keyframes slideUp{from{transform:translateX(-50%) translateY(100%)}to{transform:translateX(-50%) translateY(0)}}`}</style>

            {/* Título */}
            <div style={{ padding:"12px 16px 10px", borderBottom:"0.5px solid #E0DED6",
                          display:"flex", alignItems:"center", justifyContent:"space-between",
                          flexShrink:0, position:"relative" }}>
              <div style={{ width:36, height:4, borderRadius:2, background:"#E0DED6",
                            position:"absolute", top:8, left:"50%", transform:"translateX(-50%)" }} />
              <h3 style={{ fontSize:16, fontWeight:600, marginTop:4 }}>
                {editandoId ? "Editar produto" : "Novo produto"}
              </h3>
              <button onClick={fecharDrawer}
                style={{ background:"#F9F9F9", border:"0.5px solid #E0DED6", borderRadius:"50%",
                         width:32, height:32, cursor:"pointer", fontSize:16,
                         display:"flex", alignItems:"center", justifyContent:"center" }}>✕</button>
            </div>

            {/* Formulário com scroll */}
            <div style={{ overflowY:"auto", flex:1, padding:"14px 16px 0" }}>

              {/* ── Seção de imagem ── */}
              <div style={{ marginBottom:16 }}>
                <label style={{ fontSize:12, color:"#888780", display:"block", marginBottom:8 }}>
                  Imagem do produto
                </label>

                {/* Tabs emoji / foto */}
                <div style={{ display:"flex", gap:0, marginBottom:12,
                              border:"0.5px solid #E0DED6", borderRadius:10, overflow:"hidden" }}>
                  {[{id:"emoji",label:"🎨 Ícone"},{id:"foto",label:"📷 Foto"}].map(tab => (
                    <button key={tab.id} onClick={() => setModoFoto(tab.id)}
                      style={{ flex:1, padding:"8px 0", fontSize:13, cursor:"pointer",
                               border:"none", transition:"all .15s",
                               background: modoFoto===tab.id ? "#854F0B" : "#F9F9F9",
                               color:      modoFoto===tab.id ? "#FAC775" : "#888780",
                               fontWeight: modoFoto===tab.id ? 600 : 400 }}>
                      {tab.label}
                    </button>
                  ))}
                </div>

                {/* Modo emoji */}
                {modoFoto === "emoji" && (
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
                )}

                {/* Modo foto */}
                {modoFoto === "foto" && (
                  <div>
                    {fotoPreview ? (
                      <div style={{ position:"relative", marginBottom:8 }}>
                        <img src={fotoPreview} alt="Preview"
                          style={{ width:"100%", height:160, objectFit:"cover",
                                   borderRadius:12, border:"0.5px solid #E0DED6" }} />
                        <button onClick={removerFoto}
                          style={{ position:"absolute", top:8, right:8, width:30, height:30,
                                   borderRadius:"50%", background:"rgba(0,0,0,0.6)", border:"none",
                                   color:"white", fontSize:16, cursor:"pointer",
                                   display:"flex", alignItems:"center", justifyContent:"center" }}>
                          ✕
                        </button>
                      </div>
                    ) : (
                      <div onClick={() => inputFoto.current?.click()}
                        style={{ border:"2px dashed #E0DED6", borderRadius:12, padding:28,
                                 textAlign:"center", cursor:"pointer", background:"#F9F9F9",
                                 marginBottom:8 }}>
                        <div style={{ fontSize:32, marginBottom:6 }}>📷</div>
                        <div style={{ fontSize:13, color:"#888780" }}>
                          Toque para escolher uma foto
                        </div>
                        <div style={{ fontSize:11, color:"#B4B2A9", marginTop:4 }}>
                          JPG, PNG ou WebP · máximo 5MB
                        </div>
                      </div>
                    )}

                    <input ref={inputFoto} type="file" accept="image/*"
                      onChange={handleSelecionarFoto}
                      style={{ display:"none" }} />

                    {!fotoPreview && (
                      <button onClick={() => inputFoto.current?.click()}
                        style={{ width:"100%", padding:"10px", borderRadius:10,
                                 border:"0.5px solid #E0DED6", background:"#F9F9F9",
                                 fontSize:13, cursor:"pointer", color:"#888780" }}>
                        📂 Escolher arquivo
                      </button>
                    )}
                  </div>
                )}
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
                  Descrição
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
                  {[{id:"",label:"Nenhum"},{id:"novo",label:"Novo"},{id:"destaque",label:"Destaque"},{id:"esgotado",label:"Esgotado"}].map(b => (
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
                  { campo:"ativo",           label:"Produto ativo",     sub:"Aparece no catálogo" },
                  { campo:"disponivel_hoje", label:"Disponível hoje",   sub:"Aceita pedidos para amanhã" },
                  { campo:"permite_delivery",label:"Permite delivery",  sub:"Pode ser entregue em casa" },
                ].map((t, i, arr) => (
                  <div key={t.campo}
                    style={{ display:"flex", alignItems:"center", justifyContent:"space-between",
                             padding:"11px 14px",
                             borderBottom: i<arr.length-1 ? "0.5px solid #E0DED6":"none" }}>
                    <div>
                      <div style={{ fontSize:14, color:"#1A1A1A" }}>{t.label}</div>
                      <div style={{ fontSize:11, color:"#888780" }}>{t.sub}</div>
                    </div>
                    <div className={"toggle"+(form[t.campo]?" on":"")}
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

            {/* Botões */}
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
                {uploadandoFoto
                  ? <><span className="spinner" style={{ width:16, height:16 }} /> Enviando foto...</>
                  : salvando
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
