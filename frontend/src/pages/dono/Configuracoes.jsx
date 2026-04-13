// frontend/src/pages/dono/Configuracoes.jsx
import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { configService } from "../../services/api";
import { useAuth } from "../../contexts/AuthContext";

const BAIRROS_PADRAO = ["Centro", "Aparecida", "Aldeia", "Outros"];

export default function Configuracoes() {
  const navigate = useNavigate();
  const { logout } = useAuth();

  const [form, setForm] = useState({
    horario_abertura:   "07:00",
    horario_fechamento: "12:00",
    horario_corte:      "20:00",
    pedido_minimo:      5,
    aceita_delivery:    true,
    aceita_cartao:      true,
    aceita_dinheiro:    false,
    pix_chave:          "",
    pix_tipo:           "celular",
    taxas_delivery:     { Centro: 3, Aparecida: 5, Aldeia: 7, Outros: 8 },
  });
  const [padaria,    setPadaria]    = useState({});
  const [carregando, setCarregando] = useState(true);
  const [salvando,   setSalvando]   = useState(false);
  const [toast,      setToast]      = useState("");

  useEffect(() => {
    configService.buscar()
      .then(({ data }) => {
        if (data.config) {
          const c = data.config;
          setForm(prev => ({
            ...prev,
            horario_abertura:   c.horario_abertura   || prev.horario_abertura,
            horario_fechamento: c.horario_fechamento  || prev.horario_fechamento,
            horario_corte:      c.horario_corte       || prev.horario_corte,
            pedido_minimo:      c.pedido_minimo       ?? prev.pedido_minimo,
            aceita_delivery:    c.aceita_delivery     ?? prev.aceita_delivery,
            aceita_cartao:      c.aceita_cartao       ?? prev.aceita_cartao,
            aceita_dinheiro:    c.aceita_dinheiro     ?? prev.aceita_dinheiro,
            pix_chave:          c.pix_chave           || "",
            pix_tipo:           c.pix_tipo            || "celular",
            taxas_delivery:     typeof c.taxas_delivery === "string"
                                  ? JSON.parse(c.taxas_delivery)
                                  : (c.taxas_delivery || prev.taxas_delivery),
          }));
        }
        if (data.padaria) setPadaria(data.padaria);
      })
      .catch(err => console.error("Erro ao buscar config:", err))
      .finally(() => setCarregando(false));
  }, []);

  function mostrarToast(msg, tipo = "success") {
    setToast({ msg, tipo });
    setTimeout(() => setToast(""), 2500);
  }

  async function salvar() {
    setSalvando(true);
    try {
      await configService.atualizar(form);
      mostrarToast("✅ Configurações salvas!");
    } catch (err) {
      mostrarToast("❌ Erro ao salvar: " + (err.response?.data?.error || "tente novamente"), "error");
    } finally {
      setSalvando(false);
    }
  }

  function setField(campo, valor) {
    setForm(prev => ({ ...prev, [campo]: valor }));
  }

  function setTaxa(bairro, valor) {
    setForm(prev => ({
      ...prev,
      taxas_delivery: { ...prev.taxas_delivery, [bairro]: Number(valor) || 0 },
    }));
  }

  const Toggle = ({ campo }) => (
    <div className={"toggle" + (form[campo] ? " on" : "")}
         onClick={() => setField(campo, !form[campo])} />
  );

  const SecTitulo = ({ label }) => (
    <div style={{ fontSize:11, fontWeight:600, color:"#888780", padding:"16px 0 6px",
                  textTransform:"uppercase", letterSpacing:".5px" }}>
      {label}
    </div>
  );

  const Linha = ({ label, sub, children }) => (
    <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between",
                  padding:"12px 14px", borderBottom:"0.5px solid #E0DED6" }}>
      <div>
        <div style={{ fontSize:14, color:"#1A1A1A" }}>{label}</div>
        {sub && <div style={{ fontSize:11, color:"#888780", marginTop:2 }}>{sub}</div>}
      </div>
      {children}
    </div>
  );

  if (carregando) return (
    <div style={{ display:"flex", justifyContent:"center", padding:80 }}>
      <div className="spinner" style={{ width:32, height:32 }} />
    </div>
  );

  return (
    <div style={{ minHeight:"100dvh", background:"#F9F9F9" }}>
      {toast && (
        <div className={"toast " + (toast.tipo || "success")}>{toast.msg}</div>
      )}

      {/* Header */}
      <div style={{ background:"white", padding:"14px 16px 12px",
                    borderBottom:"0.5px solid #E0DED6", position:"sticky", top:0, zIndex:10 }}>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
          <div style={{ display:"flex", alignItems:"center", gap:12 }}>
            <button onClick={() => navigate("/dono")}
              style={{ background:"none", border:"none", cursor:"pointer", fontSize:20 }}>←</button>
            <div>
              <h2 style={{ fontSize:17, fontWeight:600 }}>Configurações</h2>
              <p style={{ fontSize:12, color:"#888780" }}>{padaria.nome || "Padaria"}</p>
            </div>
          </div>
        </div>
      </div>

      <div style={{ padding:"0 12px 100px" }}>

        {/* Horários */}
        <SecTitulo label="Horários" />
        <div className="card">
          <Linha label="Abertura da padaria" sub="Hora que abre para retirada">
            <input type="time" value={form.horario_abertura}
              onChange={e => setField("horario_abertura", e.target.value)}
              style={{ border:"0.5px solid #E0DED6", borderRadius:8, padding:"6px 10px",
                       fontSize:14, fontWeight:600, color:"#1A1A1A", background:"#F9F9F9" }} />
          </Linha>
          <Linha label="Encerramento" sub="Hora que fecha a padaria">
            <input type="time" value={form.horario_fechamento}
              onChange={e => setField("horario_fechamento", e.target.value)}
              style={{ border:"0.5px solid #E0DED6", borderRadius:8, padding:"6px 10px",
                       fontSize:14, fontWeight:600, color:"#1A1A1A", background:"#F9F9F9" }} />
          </Linha>
          <Linha label="Horário de corte" sub="Último horário para receber pedidos">
            <input type="time" value={form.horario_corte}
              onChange={e => setField("horario_corte", e.target.value)}
              style={{ border:"0.5px solid #E0DED6", borderRadius:8, padding:"6px 10px",
                       fontSize:14, fontWeight:600, color:"#854F0B", background:"#FAEEDA" }} />
          </Linha>
          <Linha label="Pedido mínimo" sub="Valor mínimo para aceitar encomenda">
            <div style={{ display:"flex", alignItems:"center", gap:6 }}>
              <input type="number" value={form.pedido_minimo} min={0} step={0.5}
                onChange={e => setField("pedido_minimo", Number(e.target.value))}
                style={{ width:70, border:"0.5px solid #E0DED6", borderRadius:8, padding:"6px 10px",
                         fontSize:14, fontWeight:600, textAlign:"right", background:"#F9F9F9" }} />
              <span style={{ fontSize:12, color:"#888780" }}>R$</span>
            </div>
          </Linha>
        </div>

        {/* Delivery */}
        <SecTitulo label="Delivery" />
        <div className="card">
          <Linha label="Aceitar delivery" sub="Habilita opção de entrega em casa">
            <Toggle campo="aceita_delivery" />
          </Linha>
          {form.aceita_delivery && (
            <>
              <div style={{ padding:"10px 14px 4px", borderBottom:"0.5px solid #E0DED6" }}>
                <div style={{ fontSize:13, fontWeight:600, color:"#888780", marginBottom:10 }}>
                  Taxas por bairro (R$)
                </div>
                {BAIRROS_PADRAO.map(b => (
                  <div key={b} style={{ display:"flex", alignItems:"center",
                                        justifyContent:"space-between", marginBottom:8 }}>
                    <span style={{ fontSize:13, color:"#1A1A1A" }}>{b}</span>
                    <input type="number" min={0} step={0.5}
                      value={form.taxas_delivery[b] ?? 0}
                      onChange={e => setTaxa(b, e.target.value)}
                      style={{ width:70, border:"0.5px solid #E0DED6", borderRadius:8,
                               padding:"6px 10px", fontSize:14, fontWeight:600,
                               textAlign:"right", background:"#F9F9F9" }} />
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Pagamentos */}
        <SecTitulo label="Pagamentos" />
        <div className="card">
          <Linha label="Aceitar PIX" sub="Pagamento via QR Code (Fase 2)">
            <Toggle campo="aceita_pix" />
          </Linha>
          <div style={{ padding:"10px 14px 12px", borderBottom:"0.5px solid #E0DED6" }}>
            <div style={{ fontSize:12, color:"#888780", marginBottom:8 }}>
              Tipo de chave PIX
            </div>
            <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
              {["celular","cpf","email","aleatoria"].map(t => (
                <button key={t} onClick={() => setField("pix_tipo", t)}
                  style={{ padding:"5px 13px", borderRadius:20, fontSize:12, cursor:"pointer",
                           border: form.pix_tipo === t ? "none" : "0.5px solid #E0DED6",
                           background: form.pix_tipo === t ? "#854F0B" : "#F9F9F9",
                           color:      form.pix_tipo === t ? "#FAC775" : "#888780" }}>
                  {t.charAt(0).toUpperCase() + t.slice(1)}
                </button>
              ))}
            </div>
            <input className="input" style={{ marginTop:10 }}
              placeholder="Sua chave PIX"
              value={form.pix_chave}
              onChange={e => setField("pix_chave", e.target.value)} />
          </div>
          <Linha label="Aceitar cartão" sub="Crédito e débito na retirada/entrega">
            <Toggle campo="aceita_cartao" />
          </Linha>
          <Linha label="Aceitar dinheiro" sub="Pagamento em espécie">
            <Toggle campo="aceita_dinheiro" />
          </Linha>
        </div>

        {/* Conta */}
        <SecTitulo label="Conta" />
        <div className="card">
          <div onClick={logout} style={{ display:"flex", alignItems:"center", padding:"13px 14px",
                                         cursor:"pointer", gap:12 }}>
            <span style={{ fontSize:20 }}>🚪</span>
            <span style={{ fontSize:14, color:"#A32D2D", fontWeight:500 }}>Sair da conta</span>
          </div>
        </div>

      </div>

      {/* Botão salvar fixo */}
      <div style={{ position:"fixed", bottom:0, left:"50%", transform:"translateX(-50%)",
                    width:"100%", maxWidth:430, padding:"10px 16px 24px",
                    background:"white", borderTop:"0.5px solid #E0DED6" }}>
        <button className="btn-primary" onClick={salvar} disabled={salvando}>
          {salvando ? <span className="spinner" /> : "Salvar configurações"}
        </button>
      </div>
    </div>
  );
}
