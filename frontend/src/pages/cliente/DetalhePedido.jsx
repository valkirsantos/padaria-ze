// frontend/src/pages/cliente/DetalhePedido.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { pedidosService } from '../../services/api';

function fmt(v) { return `R$ ${Number(v).toFixed(2).replace('.', ',')}` }

const STATUS_INFO = {
  aguardando: { label: 'Aguardando produção', cor: '#EF9F27', bg: '#FAEEDA', emoji: '⏳' },
  pronto:     { label: 'Pronto para retirada!', cor: '#3B6D11', bg: '#EAF3DE', emoji: '✅' },
  entregue:   { label: 'Entregue', cor: '#888780', bg: '#F1EFE8', emoji: '📦' },
  cancelado:  { label: 'Cancelado', cor: '#A32D2D', bg: '#FCEBEB', emoji: '❌' },
};

export default function DetalhePedido() {
  const navigate = useNavigate();
  const { id }   = useParams();
  const [pedido, setPedido] = useState(null);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    pedidosService.detalhe(id)
      .then(({ data }) => setPedido(data.pedido))
      .catch(() => navigate('/pedidos', { replace: true }))
      .finally(() => setCarregando(false));
  }, [id]);

  if (carregando) return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: 80 }}>
      <div className="spinner" style={{ width: 32, height: 32 }} />
    </div>
  );
  if (!pedido) return null;

  const st = STATUS_INFO[pedido.status] || STATUS_INFO.aguardando;

  return (
    <div style={{ minHeight: '100dvh', background: '#F9F9F9' }}>
      <div style={{ background: 'white', padding: '14px 16px', borderBottom: '0.5px solid #E0DED6',
                    display: 'flex', alignItems: 'center', gap: 12 }}>
        <button onClick={() => navigate('/pedidos')} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20 }}>←</button>
        <h2 style={{ fontSize: 17, fontWeight: 600 }}>Pedido #{pedido.numero}</h2>
      </div>

      <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
        {/* Status */}
        <div style={{ background: st.bg, borderRadius: 12, padding: '16px', textAlign: 'center' }}>
          <div style={{ fontSize: 36, marginBottom: 8 }}>{st.emoji}</div>
          <div style={{ fontSize: 16, fontWeight: 600, color: st.cor }}>{st.label}</div>
          <div style={{ fontSize: 12, color: '#888780', marginTop: 4 }}>
            {pedido.tipo_entrega === 'delivery' ? `Entrega em: ${pedido.endereco_entrega}, ${pedido.bairro_entrega}` : 'Retirada na padaria'}
          </div>
        </div>

        {/* Itens */}
        <div className="card">
          <div style={{ padding: '11px 13px 9px', borderBottom: '0.5px solid #E0DED6', fontSize: 13, fontWeight: 600, color: '#888780' }}>
            Itens
          </div>
          {pedido.itens?.map((item, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 13px', borderBottom: '0.5px solid #E0DED6' }}>
              <span style={{ fontSize: 14 }}>{item.emoji} {item.nome} × {item.quantidade}</span>
              <span style={{ fontSize: 14, fontWeight: 600 }}>{fmt(item.subtotal)}</span>
            </div>
          ))}
          {pedido.taxa_delivery > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 13px', borderBottom: '0.5px solid #E0DED6', fontSize: 13, color: '#888780' }}>
              <span>Taxa de delivery</span><span>{fmt(pedido.taxa_delivery)}</span>
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '11px 13px' }}>
            <span style={{ fontWeight: 600 }}>Total</span>
            <span style={{ fontWeight: 600, fontSize: 16, color: '#854F0B' }}>{fmt(pedido.total)}</span>
          </div>
        </div>

        <button className="btn-secondary" onClick={() => navigate('/catalogo')}>
          Fazer novo pedido
        </button>
      </div>
    </div>
  );
}