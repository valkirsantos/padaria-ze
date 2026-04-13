// frontend/src/pages/cliente/LoginOTP.jsx
// Tela de verificação do código OTP de 6 dígitos
// Timer regressivo de 60s antes de permitir reenvio

import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { authService } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';

export default function LoginOTP() {
  const navigate  = useNavigate();
  const location  = useLocation();
  const { loginCliente } = useAuth();

  // Recupera o telefone passado pela tela anterior
  const telefone = location.state?.telefone;

  const [codigo,      setCodigo]      = useState('');
  const [carregando,  setCarregando]  = useState(false);
  const [erro,        setErro]        = useState('');
  const [segundos,    setSegundos]    = useState(59);
  const inputRef = useRef(null);

  // Redireciona se chegou aqui sem telefone
  useEffect(() => {
    if (!telefone) navigate('/login', { replace: true });
    inputRef.current?.focus();
  }, []);

  // Timer de reenvio
  useEffect(() => {
    if (segundos <= 0) return;
    const timer = setTimeout(() => setSegundos(s => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [segundos]);

  async function handleVerificar() {
    if (codigo.length !== 6) { setErro('Digite os 6 dígitos do código'); return; }
    setCarregando(true); setErro('');

    try {
      const { data } = await authService.verificarOTP(telefone, codigo);
      // Salva o token e os dados do cliente no context
      loginCliente(data.token, data.cliente);

      // Se primeiro acesso, vai para a tela de criação de perfil
      if (data.primeiro_acesso) {
        navigate('/login/perfil', { replace: true });
      } else {
        navigate('/catalogo', { replace: true });
      }
    } catch (err) {
      setErro(err.response?.data?.error || 'Código inválido ou expirado');
      setCodigo('');
      inputRef.current?.focus();
    } finally {
      setCarregando(false);
    }
  }

  async function handleReenviar() {
    if (segundos > 0) return;
    try {
      await authService.enviarOTP(telefone);
      setSegundos(59);
      setCodigo('');
      setErro('');
    } catch {
      setErro('Erro ao reenviar código');
    }
  }

  // Formata telefone para exibição
  const telFormatado = telefone
    ? `(${telefone.slice(0,2)}) ${telefone.slice(2,7)}-${telefone.slice(7)}`
    : '';

  return (
    <div style={{ minHeight: '100dvh', background: 'white', display: 'flex',
                  flexDirection: 'column', padding: '20px 20px 0' }}>
      <button onClick={() => navigate('/login')}
        style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#888780',
                 fontSize: 14, cursor: 'pointer', background: 'none', border: 'none',
                 padding: '8px 0', marginBottom: 24, width: 'fit-content' }}>
        ← Voltar
      </button>

      <h1 style={{ fontSize: 22, marginBottom: 8 }}>Digite o código</h1>
      <p style={{ fontSize: 14, color: '#888780', marginBottom: 28 }}>
        Enviamos um código para o WhatsApp do número{' '}
        <strong style={{ color: '#1A1A1A' }}>{telFormatado}</strong>.
      </p>

      <label style={{ fontSize: 12, color: '#888780', marginBottom: 6, display: 'block' }}>
        Código de verificação
      </label>
      <input
        ref={inputRef}
        className="input"
        style={{ textAlign: 'center', letterSpacing: 8, fontSize: 24, fontWeight: 600 }}
        type="number"
        placeholder="000000"
        value={codigo}
        onChange={e => {
          const v = e.target.value.replace(/\D/g,'').slice(0, 6);
          setCodigo(v);
          if (v.length === 6) setErro(''); // limpa erro ao completar
        }}
        onKeyDown={e => e.key === 'Enter' && handleVerificar()}
        inputMode="numeric"
      />

      {/* Timer / botão de reenvio */}
      <p style={{ fontSize: 13, color: '#888780', textAlign: 'center', marginTop: 12 }}>
        {segundos > 0
          ? <>Reenviar código em <strong>0:{String(segundos).padStart(2,'0')}</strong></>
          : <button onClick={handleReenviar}
              style={{ color: '#854F0B', fontWeight: 600, background: 'none',
                       border: 'none', cursor: 'pointer', fontSize: 13 }}>
              Reenviar código
            </button>
        }
      </p>

      {erro && <p style={{ fontSize: 13, color: '#A32D2D', textAlign: 'center', marginTop: 8 }}>{erro}</p>}

      <div style={{ flex: 1 }} />
      <div style={{ paddingBottom: 24 }}>
        <button className="btn-primary" onClick={handleVerificar}
          disabled={codigo.length !== 6 || carregando}>
          {carregando ? <span className="spinner" /> : 'Verificar código'}
        </button>
      </div>
    </div>
  );
}