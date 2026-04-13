// frontend/src/pages/cliente/Catalogo.jsx
// Tela principal do cliente — exibe os produtos disponíveis para encomenda
// US09, US12, US13

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { produtosService } from '../../services/api';
import { useCart } from '../../contexts/CartContext';
import { useAuth } from '../../contexts/AuthContext';

const CATEGORIAS = [
  { id: 'todos',      label: 'Todos' },
  { id: 'classicos',  label: 'Clássicos' },
  { id: 'especiais',  label: 'Especiais' },
  { id: 'doces',      label: 'Doces' },
  { id: 'integrais',  label: 'Integrais' },
];

function formatarPreco(v) {
  return `R$ ${Number(v).toFixed(2).replace('.', ',')}`;
}

export default function Catalogo() {
  const navigate   = useNavigate();
  const { usuario, logout } = useAuth();
  const { itens: cartItens, totalItens, totalValor, adicionar, remover } = useCart();

  const [produtos,       setProdutos]       = useState([]);
  const [carregando,     setCarregando]     = useState(true);
  const [categoriaAtiva, setCategoriaAtiva] = useState('todos');
  const [busca,          setBusca]          = useState('');
  const [catalogoAberto, setCatalogoAberto] = useState(true);
  const [horarioCorte,   setHorarioCorte]   = useState('20:00');

  // Carrega o catálogo da API
  async function carregarCatalogo() {
    setCarregando(true);
    try {
      const params = {};
      if (categoriaAtiva !== 'todos') params.categoria = categoriaAtiva;
      if (busca.trim()) params.busca = busca.trim();

      const { data } = await produtosService.catalogo(params);
      setProdutos(data.produtos);
      setCatalogoAberto(data.catalogo_aberto);
      setHorarioCorte(data.horario_corte);
    } catch (err) {
      console.error('Erro ao carregar catálogo:', err);
    } finally {
      setCarregando(false);
    }
  }

  // Recarrega ao mudar categoria
  useEffect(() => { carregarCatalogo(); }, [categoriaAtiva]);

  // Busca com debounce de 400ms (não faz requisição a cada tecla)
  useEffect(() => {
    const timer = setTimeout(() => carregarCatalogo(), 400);
    return () => clearTimeout(timer);
  }, [busca]);

  // Quantidade de um produto no carrinho
  const qtdNoCarrinho = (id) => cartItens.find(i => i.id === id)?.quantidade || 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100dvh',
                  background: 'white' }}>

      {/* ── Top bar ── */}
      <div style={{ padding: '14px 16px 10px', borderBottom: '0.5px solid #E0DED6',
                    background: 'white', position: 'sticky', top: 0, zIndex: 10 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1 style={{ fontSize: 18, fontWeight: 600 }}>Padaria do Zé</h1>
            <p style={{ fontSize: 12, color: '#888780' }}>
              Pedidos para amanhã até às <strong>{horarioCorte}</strong>
            </p>
          </div>
          <button onClick={() => navigate('/pedidos')}
            style={{ fontSize: 12, color: '#888780', background: 'none', border: 'none',
                     cursor: 'pointer', display: 'flex', flexDirection: 'column',
                     alignItems: 'center', gap: 2 }}>
            📦 <span>Meus pedidos</span>
          </button>
        </div>

        {/* Catálogo fechado */}
        {!catalogoAberto && (
          <div style={{ marginTop: 8, padding: '8px 12px', background: '#FCEBEB',
                        borderRadius: 8, fontSize: 12, color: '#A32D2D', fontWeight: 500 }}>
            ⏰ Pedidos encerrados para hoje. Aberto novamente amanhã!
          </div>
        )}
      </div>

      {/* ── Busca ── */}
      <div style={{ padding: '10px 16px', borderBottom: '0.5px solid #E0DED6' }}>
        <input className="input" placeholder="Buscar pão..."
          value={busca} onChange={e => setBusca(e.target.value)} />
      </div>

      {/* ── Filtros de categoria ── */}
      <div className="scroll-x"
        style={{ display: 'flex', gap: 8, padding: '10px 16px',
                 borderBottom: '0.5px solid #E0DED6' }}>
        {CATEGORIAS.map(cat => (
          <button key={cat.id} onClick={() => setCategoriaAtiva(cat.id)}
            style={{
              flexShrink: 0, padding: '5px 14px', borderRadius: 20, fontSize: 13,
              cursor: 'pointer', border: '0.5px solid',
              background:   categoriaAtiva === cat.id ? '#854F0B' : '#F9F9F9',
              borderColor:  categoriaAtiva === cat.id ? '#854F0B' : '#E0DED6',
              color:        categoriaAtiva === cat.id ? '#FAC775' : '#888780',
              transition: 'all 0.15s',
            }}>
            {cat.label}
          </button>
        ))}
      </div>

      {/* ── Grade de produtos ── */}
      <div style={{ flex: 1, padding: '12px 12px 100px' }}>
        {carregando ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
            <div className="spinner" style={{ width: 32, height: 32 }} />
          </div>
        ) : produtos.length === 0 ? (
          <p style={{ textAlign: 'center', color: '#888780', padding: 40, fontSize: 14 }}>
            Nenhum produto encontrado
          </p>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {produtos.map(produto => {
              const qtd = qtdNoCarrinho(produto.id);
              return (
                <div key={produto.id} className="card">
                  {/* Imagem / emoji */}
                  <div style={{ height: 90, display: 'flex', alignItems: 'center',
                                justifyContent: 'center', background: '#F9F9F9',
                                fontSize: 40 }}>
                    {produto.foto_url
                      ? <img src={produto.foto_url} alt={produto.nome}
                             style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      : produto.emoji}
                  </div>
                  <div style={{ padding: 10 }}>
                    {/* Badge */}
                    {produto.badge && (
                      <span className={`badge badge-${
                        produto.badge === 'esgotado' ? 'red' :
                        produto.badge === 'novo'     ? 'green' : 'amber'
                      }`} style={{ marginBottom: 4 }}>
                        {produto.badge === 'destaque' ? 'Destaque' :
                         produto.badge === 'novo'     ? 'Novo'     : 'Esgotado'}
                      </span>
                    )}

                    <p style={{ fontSize: 13, fontWeight: 600, lineHeight: 1.3,
                                color: produto.badge === 'esgotado' ? '#888780' : '#1A1A1A' }}>
                      {produto.nome}
                    </p>
                    <p style={{ fontSize: 11, color: '#888780', marginTop: 2, lineHeight: 1.4 }}>
                      {produto.descricao}
                    </p>
                    <p style={{ fontSize: 14, fontWeight: 600, color: '#854F0B', marginTop: 6 }}>
                      {formatarPreco(produto.preco)}
                    </p>

                    {/* Controle de quantidade ou botão adicionar */}
                    {produto.badge !== 'esgotado' && catalogoAberto && (
                      <div style={{ display: 'flex', alignItems: 'center',
                                    justifyContent: 'flex-end', marginTop: 8, gap: 8 }}>
                        {qtd > 0 && (
                          <>
                            <button onClick={() => remover(produto.id)}
                              style={{ width: 28, height: 28, borderRadius: '50%',
                                       border: '0.5px solid #E0DED6', background: '#F9F9F9',
                                       cursor: 'pointer', fontSize: 18, display: 'flex',
                                       alignItems: 'center', justifyContent: 'center' }}>
                              −
                            </button>
                            <span style={{ fontSize: 14, fontWeight: 600, minWidth: 14,
                                           textAlign: 'center' }}>{qtd}</span>
                          </>
                        )}
                        <button onClick={() => adicionar(produto)}
                          style={{ width: 28, height: 28, borderRadius: '50%',
                                   background: '#854F0B', color: '#FAC775',
                                   border: 'none', cursor: 'pointer', fontSize: 18,
                                   display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
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

      {/* ── Barra do carrinho (fixa na base) ── */}
      {totalItens > 0 && (
        <div style={{ position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)',
                      width: '100%', maxWidth: 430, padding: '12px 16px 24px',
                      background: 'white', borderTop: '0.5px solid #E0DED6',
                      display: 'flex', gap: 10 }}>
          <button className="btn-primary" onClick={() => navigate('/pedido/confirmar')}
            style={{ flex: 1 }}>
            <span>Ver carrinho</span>
            <span style={{ background: '#FAC775', color: '#854F0B', borderRadius: 12,
                           padding: '2px 8px', fontSize: 12, fontWeight: 700 }}>
              {totalItens}
            </span>
            <span style={{ marginLeft: 'auto' }}>{formatarPreco(totalValor)}</span>
          </button>
        </div>
      )}
    </div>
  );
}