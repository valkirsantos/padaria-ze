// frontend/src/pages/cliente/BoasVindas.jsx
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

export default function BoasVindas() {
  const navigate = useNavigate();
  const { usuario, tipoUsuario } = useAuth();

  // Se já está logado, redireciona direto
  React.useEffect(() => {
    if (usuario && tipoUsuario === 'cliente') navigate('/catalogo', { replace: true });
    if (usuario && tipoUsuario === 'staff')   navigate('/dono',     { replace: true });
  }, [usuario]);

  return (
    <div style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column',
                  alignItems: 'center', justifyContent: 'center', padding: '40px 28px',
                  background: 'white' }}>
      {/* Logo */}
      <div style={{ width: 80, height: 80, borderRadius: 24, background: '#854F0B',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 40, marginBottom: 16 }}>
        🥖
      </div>
      <h1 style={{ fontSize: 22, fontWeight: 600, marginBottom: 6 }}>Padaria do Zé</h1>
      <p style={{ fontSize: 14, color: '#888780', marginBottom: 40, textAlign: 'center' }}>
        Faça seu pedido com antecedência e retire fresquinho amanhã
      </p>

      <button className="btn-primary" onClick={() => navigate('/login')} style={{ marginBottom: 12 }}>
        Entrar com WhatsApp
      </button>
      <p style={{ fontSize: 11, color: '#888780', textAlign: 'center' }}>
        Ao continuar, você concorda com os Termos de uso
      </p>
    </div>
  );
}