import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { CartProvider } from "./contexts/CartContext";

import BoasVindas     from "./pages/cliente/BoasVindas";
import LoginTelefone  from "./pages/cliente/LoginTelefone";
import LoginOTP       from "./pages/cliente/LoginOTP";
import CriarPerfil    from "./pages/cliente/CriarPerfil";
import Catalogo       from "./pages/cliente/Catalogo";
import ConfirmaPedido from "./pages/cliente/ConfirmaPedido";
import MeusPedidos    from "./pages/cliente/MeusPedidos";
import DetalhePedido  from "./pages/cliente/DetalhePedido";

import LoginDono      from "./pages/dono/LoginDono";
import PainelPedidos  from "./pages/dono/PainelPedidos";
import Produtos       from "./pages/dono/Produtos";
import Configuracoes  from "./pages/dono/Configuracoes";
import Relatorios     from "./pages/dono/Relatorios";
import OrdemProducao  from "./pages/dono/OrdemProducao";

function RotaCliente({ children }) {
  const { usuario, tipoUsuario, carregando } = useAuth();
  if (carregando) return (
    <div style={{ display:"flex", justifyContent:"center", alignItems:"center", height:"100dvh" }}>
      <div className="spinner" style={{ width:32, height:32 }} />
    </div>
  );
  if (!usuario || tipoUsuario !== "cliente") return <Navigate to="/" replace />;
  return children;
}

function RotaStaff({ children }) {
  const { usuario, tipoUsuario, carregando } = useAuth();
  if (carregando) return (
    <div style={{ display:"flex", justifyContent:"center", alignItems:"center", height:"100dvh" }}>
      <div className="spinner" style={{ width:32, height:32 }} />
    </div>
  );
  if (!usuario || tipoUsuario !== "staff") return <Navigate to="/dono/login" replace />;
  return children;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/"             element={<BoasVindas />} />
      <Route path="/login"        element={<LoginTelefone />} />
      <Route path="/login/otp"    element={<LoginOTP />} />
      <Route path="/login/perfil" element={<CriarPerfil />} />
      <Route path="/dono/login"   element={<LoginDono />} />

      <Route path="/catalogo"         element={<RotaCliente><Catalogo /></RotaCliente>} />
      <Route path="/pedido/confirmar" element={<RotaCliente><ConfirmaPedido /></RotaCliente>} />
      <Route path="/pedidos"          element={<RotaCliente><MeusPedidos /></RotaCliente>} />
      <Route path="/pedidos/:id"      element={<RotaCliente><DetalhePedido /></RotaCliente>} />

      <Route path="/dono"               element={<RotaStaff><PainelPedidos /></RotaStaff>} />
      <Route path="/dono/producao"      element={<RotaStaff><OrdemProducao /></RotaStaff>} />
      <Route path="/dono/produtos"      element={<RotaStaff><Produtos /></RotaStaff>} />
      <Route path="/dono/configuracoes" element={<RotaStaff><Configuracoes /></RotaStaff>} />
      <Route path="/dono/relatorios"    element={<RotaStaff><Relatorios /></RotaStaff>} />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <CartProvider>
        <AppRoutes />
      </CartProvider>
    </AuthProvider>
  );
}
