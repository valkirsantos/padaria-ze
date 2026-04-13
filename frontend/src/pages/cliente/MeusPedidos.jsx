// frontend/src/pages/cliente/MeusPedidos.jsx
import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { pedidosService } from "../../services/api";

const STATUS_LABEL = { aguardando:"Aguardando", pronto:"Pronto!", entregue:"Entregue", cancelado:"Cancelado" };
const STATUS_COR   = { aguardando:"#EF9F27",    pronto:"#3B6D11", entregue:"#888780",  cancelado:"#A32D2D" };

function formatarData(dataStr) {
  if (!dataStr) return "";
  const parte = String(dataStr).split("T")[0];
  const [ano, mes, dia] = parte.split("-");
  if (!dia) return dataStr;
  const meses = ["jan","fev","mar","abr","mai","jun","jul","ago","set","out","nov","dez"];
  return dia + "/" + meses[Number(mes) - 1];
}

function fmt(v) { return "R$ " + Number(v).toFixed(2).replace(".", ","); }

export default function MeusPedidos() {
  const navigate = useNavigate();
  const [pedidos, setPedidos] = useState([]);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    pedidosService.meus()
      .then(({ data }) => setPedidos(data.pedidos))
      .catch(err => console.error("Erro:", err))
      .finally(() => setCarregando(false));
  }, []);

  return (
    <div style={{ minHeight:"100dvh", background:"#F9F9F9" }}>
      <div style={{ background:"white", padding:"14px 16px", borderBottom:"0.5px solid #E0DED6",
                    display:"flex", alignItems:"center", gap:12, position:"sticky", top:0, zIndex:10 }}>
        <button onClick={() => navigate("/catalogo")}
          style={{ background:"none", border:"none", cursor:"pointer", fontSize:20 }}>←</button>
        <h2 style={{ fontSize:17, fontWeight:600 }}>Meus pedidos</h2>
      </div>
      <div style={{ padding:12, display:"flex", flexDirection:"column", gap:8 }}>
        {carregando ? (
          <div style={{ display:"flex", justifyContent:"center", padding:40 }}>
            <div className="spinner" style={{ width:32, height:32 }} />
          </div>
        ) : pedidos.length === 0 ? (
          <div style={{ textAlign:"center", padding:60 }}>
            <div style={{ fontSize:48, marginBottom:12 }}>🥖</div>
            <p style={{ fontSize:15, color:"#888780" }}>Você ainda não fez nenhum pedido</p>
            <button className="btn-primary" onClick={() => navigate("/catalogo")}
              style={{ marginTop:20 }}>Ver catálogo</button>
          </div>
        ) : pedidos.map(p => (
          <div key={p.id} className="card"
            onClick={() => navigate("/pedidos/" + p.id)}
            style={{ padding:"12px 14px", cursor:"pointer", display:"flex",
                     alignItems:"center", justifyContent:"space-between" }}>
            <div>
              <div style={{ fontSize:14, fontWeight:600 }}>Pedido #{p.numero}</div>
              <div style={{ fontSize:12, color:"#888780", marginTop:3 }}>
                {p.tipo_entrega === "delivery" ? "🛵 Delivery" : "🏪 Retirada"}
                {" · Entrega "}{formatarData(p.data_entrega)}
              </div>
            </div>
            <div style={{ textAlign:"right" }}>
              <div style={{ fontSize:14, fontWeight:600, color: STATUS_COR[p.status] || "#1A1A1A" }}>
                {STATUS_LABEL[p.status] || p.status}
              </div>
              <div style={{ fontSize:13, color:"#888780", marginTop:3 }}>{fmt(p.total)}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}