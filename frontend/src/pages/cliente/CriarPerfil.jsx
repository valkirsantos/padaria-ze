// frontend/src/pages/cliente/CriarPerfil.jsx
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { authService } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';

const AVATARES = ['😊','🧑','👩','🧔','👴','👵','🙂','😄'];

export default function CriarPerfil() {
  const navigate = useNavigate();
  const { atualizarUsuario } = useAuth();
  const [avatarIdx,   setAvatarIdx]   = useState(0);
  const [nome,        setNome]        = useState('');
  const [rua,         setRua]         = useState('');
  const [bairro,      setBairro]      = useState('');
  const [carregando,  setCarregando]  = useState(false);
  const [erro,        setErro]        = useState('');

  async function handleSalvar() {
    if (nome.trim().length < 2) { setErro('Nome deve ter ao menos 2 caracteres'); return; }
    setCarregando(true); setErro('');
    try {
      const { data } = await authService.atualizarPerfil({
        nome: nome.trim(), endereco_rua: rua, endereco_bairro: bairro, avatar_idx: avatarIdx,
      });
      atualizarUsuario(data.cliente);
      navigate('/catalogo', { replace: true });
    } catch (err) {
      setErro(err.response?.data?.error || 'Erro ao salvar perfil');
    } finally {
      setCarregando(false);
    }
  }

  return (
    <div style={{ minHeight: '100dvh', background: 'white', display: 'flex',
                  flexDirection: 'column', padding: '20px 20px 0' }}>
      <h1 style={{ fontSize: 22, marginBottom: 6 }}>Crie seu perfil</h1>
      <p style={{ fontSize: 14, color: '#888780', marginBottom: 24 }}>
        Só precisamos de algumas informações rápidas.
      </p>

      {/* Seletor de avatar */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 20 }}>
        <div onClick={() => setAvatarIdx(i => (i + 1) % AVATARES.length)}
          style={{ width: 72, height: 72, borderRadius: '50%', background: '#FAEEDA',
                   border: '2px dashed #EF9F27', display: 'flex', alignItems: 'center',
                   justifyContent: 'center', fontSize: 32, cursor: 'pointer', marginBottom: 6 }}>
          {AVATARES[avatarIdx]}
        </div>
        <span style={{ fontSize: 12, color: '#888780' }}>Toque para trocar</span>
      </div>

      <label style={{ fontSize: 12, color: '#888780', marginBottom: 5, display: 'block' }}>Seu nome</label>
      <input className="input" style={{ marginBottom: 14 }} placeholder="Como quer ser chamado?"
        value={nome} onChange={e => setNome(e.target.value)} autoFocus />

      <label style={{ fontSize: 12, color: '#888780', marginBottom: 5, display: 'block' }}>
        Endereço para delivery <span style={{ color: '#B4B2A9' }}>(opcional)</span>
      </label>
      <input className="input" style={{ marginBottom: 8 }} placeholder="Rua e número"
        value={rua} onChange={e => setRua(e.target.value)} />
      <input className="input" placeholder="Bairro"
        value={bairro} onChange={e => setBairro(e.target.value)} />

      {erro && <p style={{ fontSize: 13, color: '#A32D2D', marginTop: 8 }}>{erro}</p>}

      <div style={{ flex: 1 }} />
      <div style={{ paddingBottom: 24 }}>
        <button className="btn-primary" onClick={handleSalvar}
          disabled={nome.trim().length < 2 || carregando}>
          {carregando ? <span className="spinner" /> : 'Criar conta'}
        </button>
      </div>
    </div>
  );
}