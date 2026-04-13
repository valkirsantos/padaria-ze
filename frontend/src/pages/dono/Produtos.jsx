// frontend/src/pages/dono/Produtos.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { produtosService } from '../../services/api';

export default function Produtos() {
    const navigate = useNavigate();
    const [produtos, setProdutos] = useState([]);
    const [carregando, setCarregando] = useState(true);
    const [toast, setToast] = useState('');

    useEffect(() => {
        produtosService.admin()
            .then(({ data }) => setProdutos(data.produtos))
            .finally(() => setCarregando(false));
    }, []);

    async function toggleDisp(produto) {
        const novo = !produto.disponivel_hoje;
        try {
            await produtosService.toggleDisp(produto.id, novo);
            setProdutos(prev => prev.map(p => p.id === produto.id ? { ...p, disponivel_hoje: novo } : p));
            setToast(novo ? '✅ Disponível para hoje' : '⏸️ Pausado para hoje');
            setTimeout(() => setToast(''), 2500);
        } catch { setToast('❌ Erro'); setTimeout(() => setToast(''), 2500); }
    }

    const CATS = { classicos: 'Clássicos', especiais: 'Especiais', doces: 'Doces', integrais: 'Integrais', outros: 'Outros' };

    return (
        <div style={{ minHeight: '100dvh', background: '#F9F9F9' }}>
            {toast && <div className="toast">{toast}</div>}
            <div style={{
                background: 'white', padding: '14px 16px', borderBottom: '0.5px solid #E0DED6',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                position: 'sticky', top: 0, zIndex: 10
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <button onClick={() => navigate('/dono')} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20 }}>←</button>
                    <h2 style={{ fontSize: 17, fontWeight: 600 }}>Produtos</h2>
                </div>
                <button onClick={() => navigate('/dono/produtos/novo')}
                    style={{
                        background: '#854F0B', color: '#FAC775', border: 'none', borderRadius: 20,
                        padding: '7px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer'
                    }}>
                    + Novo
                </button>
            </div>

            <div style={{ padding: '12px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                {carregando ? (
                    <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
                        <div className="spinner" style={{ width: 32, height: 32 }} />
                    </div>
                ) : produtos.map(p => (
                    <div key={p.id} className="card" style={{
                        display: 'flex', alignItems: 'center',
                        padding: '11px 13px', gap: 10
                    }}>
                        <span style={{ fontSize: 28, width: 36, textAlign: 'center' }}>{p.emoji}</span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{
                                fontSize: 14, fontWeight: 600,
                                color: p.ativo ? '#1A1A1A' : '#888780',
                                textDecoration: p.ativo ? 'none' : 'line-through'
                            }}>
                                {p.nome}
                            </div>
                            <div style={{ fontSize: 12, color: '#888780' }}>
                                {CATS[p.categoria]} · R$ {Number(p.preco).toFixed(2).replace('.', ',')}
                            </div>
                        </div>
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                            {/* Toggle disponível hoje */}
                            <div className={`toggle ${p.disponivel_hoje ? 'on' : ''}`}
                                onClick={() => toggleDisp(p)} />
                            <button onClick={() => navigate(`/dono/produtos/${p.id}`)}
                                style={{
                                    padding: '5px 12px', borderRadius: 8, border: '0.5px solid #E0DED6',
                                    background: '#F9F9F9', fontSize: 12, cursor: 'pointer'
                                }}>
                                Editar
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}