// frontend/src/pages/dono/LoginDono.jsx
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { authService } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';

export default function LoginDono() {
  const navigate = useNavigate();
  const { loginStaff, usuario, tipoUsuario } = useAuth();
  const [tel,        setTel]        = useState('');
  const [senha,      setSenha]      = useState('');
  const [carregando, setCarregando] = useState(false);
  const [erro,       setErro]       = useState('');

  React.useEffect(() => {
    if (usuario && tipoUsuario === 'staff') navigate('/dono', { replace: true });
  }, [usuario]);

  function formatarTel(v) {
    const n = v.replace(/\D/g,'').slice(0,11);
    if (n.length <= 2) return n;
    if (n.length <= 7) return `(${n.slice(0,2)}) ${n.slice(2)}`;
    return `(${n.slice(0,2)}) ${n.slice(2,7)}-${n.slice(7)}`;
  }

  async function handleLogin() {
    const nums = tel.replace(/\D/g,'');
    if (nums.length < 10 || !senha) { setErro('Preencha telefone e senha'); return; }
    setCarregando(true); setErro('');
    try {
      const { data } = await authService.loginStaff(nums, senha);
      loginStaff(data.token, data.staff);
      navigate('/dono', { replace: true });
    } catch (err) {
      setErro(err.response?.data?.error || 'Telefone ou senha incorretos');
    } finally { setCarregando(false); }
  }

  return (
    <div style={{ minHeight: '100dvh', background: 'white', display: 'flex',
                  flexDirection: 'column', padding: '60px 24px 24px' }}>
      <div style={{ textAlign: 'center', marginBottom: 36 }}>
        <div style={{ fontSize: 48, marginBottom: 12 }}>🥖</div>
        <h1 style={{ fontSize: 22, marginBottom: 4 }}>Padaria do Zé</h1>
        <p style={{ fontSize: 14, color: '#888780' }}>Acesso do dono</p>
      </div>

      <label style={{ fontSize: 12, color: '#888780', marginBottom: 5, display: 'block' }}>Telefone</label>
      <input className="input" style={{ marginBottom: 14 }} type="tel" placeholder="(93) 98800-1234"
        value={tel} onChange={e => setTel(formatarTel(e.target.value))} />

      <label style={{ fontSize: 12, color: '#888780', marginBottom: 5, display: 'block' }}>Senha</label>
      <input className="input" style={{ marginBottom: 20 }} type="password" placeholder="••••••••"
        value={senha} onChange={e => setSenha(e.target.value)}
        onKeyDown={e => e.key === 'Enter' && handleLogin()} />

      {erro && <p style={{ fontSize: 13, color: '#A32D2D', marginBottom: 12, textAlign: 'center' }}>{erro}</p>}

      <button className="btn-primary" onClick={handleLogin}
        disabled={tel.replace(/\D/g,'').length < 10 || !senha || carregando}>
        {carregando ? <span className="spinner" /> : 'Entrar'}
      </button>
    </div>
  );
}