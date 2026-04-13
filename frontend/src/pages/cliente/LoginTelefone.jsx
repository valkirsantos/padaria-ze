// frontend/src/pages/cliente/LoginTelefone.jsx
// Tela de entrada do número de celular — envia OTP via WhatsApp
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { authService } from '../../services/api';

export default function LoginTelefone() {
  const navigate = useNavigate();
  const [telefone,    setTelefone]    = useState('');
  const [carregando,  setCarregando]  = useState(false);
  const [erro,        setErro]        = useState('');

  // Formata enquanto digita: (93) 99999-9999
  function formatarTelefone(valor) {
    const nums = valor.replace(/\D/g, '').slice(0, 11);
    if (nums.length <= 2)  return nums;
    if (nums.length <= 7)  return `(${nums.slice(0,2)}) ${nums.slice(2)}`;
    return `(${nums.slice(0,2)}) ${nums.slice(2,7)}-${nums.slice(7)}`;
  }

  async function handleEnviar() {
    const nums = telefone.replace(/\D/g, '');
    if (nums.length < 10) { setErro('Digite um número válido com DDD'); return; }

    setCarregando(true); setErro('');
    try {
      await authService.enviarOTP(nums);
      // Passa o telefone via state para a próxima tela
      navigate('/login/otp', { state: { telefone: nums } });
    } catch (err) {
      setErro(err.response?.data?.error || 'Erro ao enviar código. Tente novamente.');
    } finally {
      setCarregando(false);
    }
  }

  return (
    <div style={{ minHeight: '100dvh', background: 'white', display: 'flex',
                  flexDirection: 'column', padding: '20px 20px 0' }}>
      {/* Botão voltar */}
      <button onClick={() => navigate('/')}
        style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#888780',
                 fontSize: 14, cursor: 'pointer', background: 'none', border: 'none',
                 padding: '8px 0', marginBottom: 24, width: 'fit-content' }}>
        ← Voltar
      </button>

      <h1 style={{ fontSize: 22, marginBottom: 8 }}>Qual é o seu número?</h1>
      <p style={{ fontSize: 14, color: '#888780', marginBottom: 28 }}>
        Vamos enviar um código de verificação pelo WhatsApp.
      </p>

      <label style={{ fontSize: 12, color: '#888780', marginBottom: 6, display: 'block' }}>
        Número de celular
      </label>
      <div style={{ position: 'relative', marginBottom: 8 }}>
        <span style={{ position: 'absolute', left: 12, top: '50%',
                       transform: 'translateY(-50%)', fontSize: 18 }}>🇧🇷</span>
        <input
          className="input"
          style={{ paddingLeft: 42 }}
          type="tel"
          placeholder="(93) 99999-9999"
          value={telefone}
          onChange={e => setTelefone(formatarTelefone(e.target.value))}
          onKeyDown={e => e.key === 'Enter' && handleEnviar()}
          inputMode="numeric"
          autoFocus
        />
      </div>
      <p style={{ fontSize: 11, color: '#888780', marginBottom: 4 }}>DDI +55 Brasil</p>

      {erro && <p style={{ fontSize: 13, color: '#A32D2D', margin: '8px 0' }}>{erro}</p>}

      <div style={{ flex: 1 }} />

      <div style={{ paddingBottom: 24 }}>
        <button className="btn-primary" onClick={handleEnviar}
          disabled={telefone.replace(/\D/g,'').length < 10 || carregando}>
          {carregando ? <span className="spinner" /> : 'Enviar código'}
        </button>
        <p style={{ fontSize: 12, color: '#888780', textAlign: 'center', marginTop: 12 }}>
          Você receberá uma mensagem no WhatsApp
        </p>
      </div>
    </div>
  );
}