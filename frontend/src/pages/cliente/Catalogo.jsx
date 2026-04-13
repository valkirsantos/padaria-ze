// frontend/src/pages/cliente/Catalogo.jsx
import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { produtosService } from "../../services/api";
import { useCart } from "../../contexts/CartContext";
import { useAuth } from "../../contexts/AuthContext";

// Labels e cores por categoria
const CAT_LABEL = {
  classicos: "Clássicos",
  especiais: "Especiais",
  integrais: "Integrais",
  doces:     "Doces",
  outros:    "Outros",
};

function fmt(v) { return "R$ " + Number(v).toFixed(2).replace(".", ","); }

export default function Catalogo() {
  const navigate = useNavigate();
  const { logout } = useAuth();
  const { itens: cartItens, totalItens, totalValor, adicionar, remover } = useCart();

  const [produtos,        setProdutos]        = useState([]);
  const [categorias,      setCategorias]      = useState([]);   // ← vem do backend
  const [carregando,      setCarregando]      = useState(true);
  const [carregandoCats,  setCarregandoCats]  = useState(true);
  const [categoriaAtiva,  setCategoriaAtiva]  = useState("todos");
  const [busca,           setBusca]           = useState("");
  const [catalogoAberto,  setCatalogoAberto]  = useState(true);
  const [horarioCorte,    setHorarioCorte]    = useState("20:00");

  // Carrega categorias disponíveis — roda uma única vez ao montar
  useEffect(() => {
    produtosService.categorias()
      .then(({ data }) => setCategorias(data.categorias || []))
      .catch(() => setCategorias([]))
      .finally(() => setCarregandoCats(false));
  }, []);

  // Carrega o catálogo de produtos
  const carregarProdutos = useCallback(async () => {
    setCarregando(true);
    try {
      const params = {};
      if (categoriaAtiva !== "todos") params.categoria = categoriaAtiva;
      if (busca.trim())               params.busca     = busca.trim();
      const { data } = await produtosService.catalogo(params);
      setProdutos(data.produtos || []);
      setCatalogoAberto(data.catalogo_aberto);
      setHorarioCorte(data.horario_corte);
    } catch (err) {
      console.error("Erro ao carregar catálogo:", err);
    } finally {
      setCarregando(false);
    }
  }, [categoriaAtiva, busca]);

  // Recarrega ao mudar categoria
  useEffect(() => { carregarProdutos(); }, [categoriaAtiva]);

  // Busca com debounce de 400ms
  useEffect(() => {
    const t = setTimeout(carregarProdutos, 400);
    return () => clearTimeout(t);
  }, [busca]);

  // Quando as categorias carregam, se a categoria ativa não existe mais, volta para "todos"
  useEffect(() => {
    if (!carregandoCats && categoriaAtiva !== "todos" && !categorias.includes(categoriaAtiva)) {
      setCategoriaAtiva("todos");
    }
  }, [categorias, carregandoCats]);

  const qtdNoCarrinho = (id) => cartItens.find(i => i.id === id)?.quantidade || 0;

  return (
    <div style={{ display:"flex", flexDirection:"column", minHeight:"100dvh", background:"white" }}>

      {/* ── Top bar ── */}
      <div style={{ padding:"14px 16px 10px", borderBottom:"0.5px solid #E0DED6",
                    background:"white", position:"sticky", top:0, zIndex:10 }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <div>
            <h1 style={{ fontSize:18, fontWeight:600 }}>Padaria do Zé</h1>
            <p style={{ fontSize:12, color:"#888780" }}>
              Pedidos para amanhã até às <strong>{horarioCorte}</strong>
            </p>
          </div>
          <button onClick={() => navigate("/pedidos")}
            style={{ fontSize:12, color:"#888780", background:"none", border:"none",
                     cursor:"pointer", textAlign:"center" }}>
            📦<br/>Meus pedidos
          </button>
        </div>

        {/* Banner catálogo fechado */}
        {!catalogoAberto && (
          <div style={{ marginTop:8, padding:"8px 12px", background:"#FCEBEB",
                        borderRadius:8, fontSize:12, color:"#A32D2D", fontWeight:500 }}>
            ⏰ Pedidos encerrados para hoje. Aberto novamente amanhã!
          </div>
        )}
      </div>

      {/* ── Busca ── */}
      <div style={{ padding:"10px 16px", borderBottom:"0.5px solid #E0DED6" }}>
        <input className="input" placeholder="Buscar pão..."
          value={busca} onChange={e => setBusca(e.target.value)} />
      </div>

      {/* ── Filtros de categoria — dinâmicos ── */}
      <div className="scroll-x"
        style={{ display:"flex", gap:8, padding:"10px 16px",
                 borderBottom:"0.5px solid #E0DED6", background:"white" }}>

        {/* Botão "Todos" — sempre visível */}
        <button onClick={() => setCategoriaAtiva("todos")}
          style={{ flexShrink:0, padding:"5px 14px", borderRadius:20, fontSize:13,
                   cursor:"pointer", border:"0.5px solid", transition:"all .15s",
                   background:  categoriaAtiva==="todos" ? "#854F0B" : "#F9F9F9",
                   borderColor: categoriaAtiva==="todos" ? "#854F0B" : "#E0DED6",
                   color:       categoriaAtiva==="todos" ? "#FAC775" : "#888780" }}>
          Todos
        </button>

        {/* Categorias dinâmicas vindas do backend */}
        {carregandoCats ? (
          // Skeleton de loading enquanto as categorias carregam
          [1,2,3].map(i => (
            <div key={i} style={{ flexShrink:0, width:80, height:30, borderRadius:20,
                                   background:"#F1EFE8", animation:"pulse 1.2s infinite" }} />
          ))
        ) : categorias.map(cat => (
          <button key={cat} onClick={() => setCategoriaAtiva(cat)}
            style={{ flexShrink:0, padding:"5px 14px", borderRadius:20, fontSize:13,
                     cursor:"pointer", border:"0.5px solid", transition:"all .15s",
                     background:  categoriaAtiva===cat ? "#854F0B" : "#F9F9F9",
                     borderColor: categoriaAtiva===cat ? "#854F0B" : "#E0DED6",
                     color:       categoriaAtiva===cat ? "#FAC775" : "#888780" }}>
            {CAT_LABEL[cat] || cat}
          </button>
        ))}
      </div>

      {/* ── Grade de produtos ── */}
      <div style={{ flex:1, padding:"12px 12px 100px" }}>
        {carregando ? (
          <div style={{ display:"flex", justifyContent:"center", padding:40 }}>
            <div className="spinner" style={{ width:32, height:32 }} />
          </div>
        ) : produtos.length === 0 ? (
          <div style={{ textAlign:"center", padding:40, color:"#888780" }}>
            <div style={{ fontSize:40, marginBottom:12 }}>🥖</div>
            <p style={{ fontSize:14 }}>
              {busca ? `Nenhum resultado para "${busca}"` : "Nenhum produto disponível agora"}
            </p>
            {busca && (
              <button onClick={() => setBusca("")}
                style={{ marginTop:12, padding:"8px 20px", borderRadius:20,
                         border:"0.5px solid #E0DED6", background:"#F9F9F9",
                         cursor:"pointer", fontSize:13, color:"#888780" }}>
                Limpar busca
              </button>
            )}
          </div>
        ) : (
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
            {produtos.map(produto => {
              const qtd     = qtdNoCarrinho(produto.id);
              const esgotado = produto.badge === "esgotado";
              return (
                <div key={produto.id} className="card">
                  {/* Imagem / emoji */}
                  <div style={{ height:90, display:"flex", alignItems:"center",
                                justifyContent:"center", background:"#F9F9F9", fontSize:42 }}>
                    {produto.foto_url
                      ? <img src={produto.foto_url} alt={produto.nome}
                             style={{ width:"100%", height:"100%", objectFit:"cover" }} />
                      : produto.emoji}
                  </div>

                  <div style={{ padding:10 }}>
                    {/* Badge */}
                    {produto.badge && (
                      <span style={{ fontSize:10, fontWeight:600, padding:"2px 8px",
                                     borderRadius:10, display:"inline-block", marginBottom:4,
                                     background: esgotado ? "#FCEBEB" : produto.badge==="novo" ? "#EAF3DE" : "#FAEEDA",
                                     color:      esgotado ? "#791F1F" : produto.badge==="novo" ? "#27500A" : "#633806" }}>
                        {produto.badge === "destaque" ? "Destaque" :
                         produto.badge === "novo"     ? "Novo"     : "Esgotado"}
                      </span>
                    )}

                    <p style={{ fontSize:13, fontWeight:600, lineHeight:1.3,
                                color: esgotado ? "#888780" : "#1A1A1A" }}>
                      {produto.nome}
                    </p>
                    {produto.descricao && (
                      <p style={{ fontSize:11, color:"#888780", marginTop:2, lineHeight:1.4 }}>
                        {produto.descricao}
                      </p>
                    )}
                    <p style={{ fontSize:14, fontWeight:600, color:"#854F0B", marginTop:6 }}>
                      {fmt(produto.preco)}
                    </p>

                    {/* Controle de quantidade */}
                    {!esgotado && catalogoAberto && (
                      <div style={{ display:"flex", alignItems:"center",
                                    justifyContent:"flex-end", marginTop:8, gap:8 }}>
                        {qtd > 0 && (
                          <>
                            <button onClick={() => remover(produto.id)}
                              style={{ width:28, height:28, borderRadius:"50%",
                                       border:"0.5px solid #E0DED6", background:"#F9F9F9",
                                       cursor:"pointer", fontSize:18, display:"flex",
                                       alignItems:"center", justifyContent:"center" }}>
                              −
                            </button>
                            <span style={{ fontSize:14, fontWeight:600, minWidth:14,
                                           textAlign:"center" }}>{qtd}</span>
                          </>
                        )}
                        <button onClick={() => adicionar(produto)}
                          style={{ width:28, height:28, borderRadius:"50%",
                                   background:"#854F0B", color:"#FAC775", border:"none",
                                   cursor:"pointer", fontSize:18, display:"flex",
                                   alignItems:"center", justifyContent:"center" }}>
                          +
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Carrinho flutuante ── */}
      {totalItens > 0 && (
        <div style={{ position:"fixed", bottom:0, left:"50%", transform:"translateX(-50%)",
                      width:"100%", maxWidth:430, padding:"12px 16px 24px",
                      background:"white", borderTop:"0.5px solid #E0DED6" }}>
          <button className="btn-primary" onClick={() => navigate("/pedido/confirmar")}>
            <span>Ver carrinho</span>
            <span style={{ background:"#FAC775", color:"#854F0B", borderRadius:12,
                           padding:"2px 8px", fontSize:12, fontWeight:700 }}>
              {totalItens}
            </span>
            <span style={{ marginLeft:"auto" }}>{fmt(totalValor)}</span>
          </button>
        </div>
      )}

      {/* Animação de skeleton */}
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0.4; }
        }
      `}</style>
    </div>
  );
}
