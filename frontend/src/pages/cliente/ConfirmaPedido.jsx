// frontend/src/pages/cliente/ConfirmaPedido.jsx
// US13, US14, US21 — confirmação com retirada/delivery e pagamento manual
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { pedidosService } from '../../services/api';
import { useCart } from '../../contexts/CartContext';
import { useAuth } from '../../contexts/AuthContext';

function fmt(v) { return `R$ ${Number(v).toFixed(2).replace('.', ',')}` }

const TAXAS = { 'Centro': 3, 'Aparecida': 5, 'Aldeia': 7, 'Outros': 8 };

export default function ConfirmaPedido() {
  const navigate = useNavigate();
  const { itens, totalValor, limpar } = useCart();
  const { usuario } = useAuth();

  const [tipoEntrega, setTipoEntrega] = useState('retirada');
  const [rua,         setRua]         = useState(usuario?.endereco_rua    || '');
  const [bairro,      setBairro]      = useState(usuario?.endereco_bairro || '');
  const [metodo,      setMetodo]      = useState('');
  const [carregando,  setCarregando]  = useState(false);
  const [erro,        setErro]        = useState('');

  if (itens.length === 0) { navigate('/catalogo', { replace: true }); return null; }

  const taxa  = tipoEntrega === 'delivery' ? (TAXAS[bairro] || TAXAS['Outros']) : 0;
  const total = totalValor + taxa;

  async function handleConfirmar() {
    if (!metodo) { setErro('Selecione a forma de pagamento'); return; }
    if (tipoEntrega === 'delivery' && !rua.trim()) { setErro('Informe o endereço'); return; }

    setCarregando(true); setErro('');
    try {
      const payload = {
        itens: itens.map(i => ({ produto_id: i.id, quantidade: i.quantidade })),
        tipo_entrega:     tipoEntrega,
        endereco_entrega: tipoEntrega === 'delivery' ? rua   : undefined,
        bairro_entrega:   tipoEntrega === 'delivery' ? bairro : undefined,
      };
      const { data } = await pedidosService.criar(payload);
      limpar(); // esvazia o carrinho
      navigate(`/pedidos/${data.pedido.id}`, { replace: true });
    } catch (err) {
      setErro(err.response?.data?.error || 'Erro ao confirmar pedido');
    } finally { setCarregando(false); }
  }

  const SecOpt = ({ id, label, sub, selected, onClick }) => (
    <div onClick={onClick} style={{
      flex: 1, padding: '12px 10px', borderRadius: 10, cursor: 'pointer', textAlign: 'center',
      border: selected ? '2px solid #854F0B' : '0.5px solid #E0DED6',
      background: selected ? '#FAEEDA' : '#F9F9F9', transition: 'all .15s',
    }}>
      <div style={{ fontSize: 22, marginBottom: 4 }}>{id === 'retirada' ? '🏪' : '🛵'}</div>
      <div style={{ fontSize: 13, fontWeight: 600, color: selected ? '#633806' : '#1A1A1A' }}>{label}</div>
      <div style={{ fontSize: 11, color: selected ? '#854F0B' : '#888780' }}>{sub}</div>
    </div>
  );

  const PagOpt = ({ id, label, desc, icon }) => (
    <div onClick={() => setMetodo(id)} style={{
      display: 'flex', alignItems: 'center', gap: 12, padding: '11px 12px',
      borderRadius: 10, cursor: 'pointer',
      border: metodo === id ? '2px solid #854F0B' : '0.5px solid #E0DED6',
      background: metodo === id ? '#FAEEDA' : '#F9F9F9', marginBottom: 8,
    }}>
      <span style={{ fontSize: 20 }}>{icon}</span>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: metodo === id ? '#633806' : '#1A1A1A' }}>{label}</div>
        <div style={{ fontSize: 11, color: '#888780' }}>{desc}</div>
      </div>
      <div style={{ width: 18, height: 18, borderRadius: '50%',
                    border: `0.5px solid ${metodo === id ? '#854F0B' : '#E0DED6'}`,
                    background: metodo === id ? '#854F0B' : 'white',
                    display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {metodo === id && <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#FAC775' }} />}
      </div>
    </div>
  );

  return (
    <div style={{ minHeight: '100dvh', background: '#F9F9F9', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{ background: 'white', padding: '14px 16px 12px', borderBottom: '0.5px solid #E0DED6',
                    display: 'flex', alignItems: 'center', gap: 12 }}>
        <button onClick={() => navigate(-1)} style={{ background: 'none', border: 'none',
          cursor: 'pointer', fontSize: 20, color: '#1A1A1A' }}>←</button>
        <h2 style={{ fontSize: 17, fontWeight: 600 }}>Confirmar encomenda</h2>
      </div>

      <div style={{ flex: 1, padding: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>

        {/* Itens */}
        <div className="card">
          <div style={{ padding: '11px 13px 9px', borderBottom: '0.5px solid #E0DED6',
                        fontSize: 13, fontWeight: 600, color: '#888780' }}>
            Itens do pedido
          </div>
          {itens.map(item => (
            <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 10,
                                         padding: '10px 13px', borderBottom: '0.5px solid #E0DED6' }}>
              <span style={{ fontSize: 22, width: 32, textAlign: 'center' }}>{item.emoji}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 500 }}>{item.nome}</div>
                <div style={{ fontSize: 11, color: '#888780' }}>{item.quantidade} unidade{item.quantidade > 1 ? 's' : ''}</div>
              </div>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#1A1A1A' }}>
                {fmt(item.preco * item.quantidade)}
              </div>
            </div>
          ))}
        </div>

        {/* Tipo de entrega */}
        <div className="card" style={{ padding: '13px 14px' }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#888780', marginBottom: 10 }}>
            Como quer receber?
          </div>
          <div style={{ display: 'flex', gap: 8, marginBottom: tipoEntrega === 'delivery' ? 12 : 0 }}>
            <SecOpt id="retirada" label="Retirada" sub="Na padaria" selected={tipoEntrega === 'retirada'} onClick={() => setTipoEntrega('retirada')} />
            <SecOpt id="delivery" label="Delivery"  sub="Em casa"   selected={tipoEntrega === 'delivery'} onClick={() => setTipoEntrega('delivery')} />
          </div>
          {tipoEntrega === 'delivery' && (
            <>
              <input className="input" style={{ marginBottom: 8 }} placeholder="Rua e número"
                value={rua} onChange={e => setRua(e.target.value)} />
              <select className="input" value={bairro} onChange={e => setBairro(e.target.value)}>
                <option value="">Selecione o bairro</option>
                {Object.keys(TAXAS).map(b => <option key={b} value={b}>{b} — {fmt(TAXAS[b])}</option>)}
              </select>
            </>
          )}
        </div>

        {/* Pagamento */}
        <div className="card" style={{ padding: '13px 14px' }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#888780', marginBottom: 10 }}>
            Forma de pagamento
          </div>
          <PagOpt id="cartao_credito" label="Cartão de crédito"  desc="Na retirada ou entrega" icon="💳" />
          <PagOpt id="cartao_debito"  label="Cartão de débito"   desc="Na retirada ou entrega" icon="💳" />
          <PagOpt id="dinheiro"       label="Dinheiro"            desc="Na retirada ou entrega" icon="💵" />
        </div>

        {/* Totais */}
        <div className="card" style={{ padding: '12px 14px' }}>
          {tipoEntrega === 'delivery' && (
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13,
                          color: '#888780', marginBottom: 6 }}>
              <span>Taxa de delivery</span><span>{fmt(taxa)}</span>
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 14, color: '#888780' }}>Total</span>
            <span style={{ fontSize: 18, fontWeight: 600, color: '#1A1A1A' }}>{fmt(total)}</span>
          </div>
        </div>

        {erro && <p style={{ fontSize: 13, color: '#A32D2D', textAlign: 'center' }}>{erro}</p>}

        <button className="btn-primary" onClick={handleConfirmar} disabled={carregando}>
          {carregando ? <span className="spinner" /> : 'Confirmar encomenda'}
        </button>
        <p style={{ fontSize: 11, color: '#888780', textAlign: 'center' }}>
          Retirada a partir das 7h de amanhã
        </p>
      </div>
    </div>
  );
}