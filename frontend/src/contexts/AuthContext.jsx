import React, { createContext, useContext, useState, useEffect, useCallback } from "react";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [usuario,     setUsuario]     = useState(null);
  const [tipoUsuario, setTipoUsuario] = useState(null);
  const [carregando,  setCarregando]  = useState(true);

  useEffect(() => {
    const token  = localStorage.getItem("token");
    const saved  = localStorage.getItem("usuario");
    const tipo   = localStorage.getItem("tipo_usuario");
    if (token && saved && tipo) {
      try { setUsuario(JSON.parse(saved)); setTipoUsuario(tipo); } catch { localStorage.clear(); }
    }
    setCarregando(false);
  }, []);

  useEffect(() => {
    const fn = () => logout();
    window.addEventListener("auth:logout", fn);
    return () => window.removeEventListener("auth:logout", fn);
  }, []);

  const loginCliente = useCallback((token, data) => {
    localStorage.setItem("token", token);
    localStorage.setItem("usuario", JSON.stringify(data));
    localStorage.setItem("tipo_usuario", "cliente");
    setUsuario(data); setTipoUsuario("cliente");
  }, []);

  const loginStaff = useCallback((token, data) => {
    localStorage.setItem("token", token);
    localStorage.setItem("usuario", JSON.stringify(data));
    localStorage.setItem("tipo_usuario", "staff");
    setUsuario(data); setTipoUsuario("staff");
  }, []);

  const atualizarUsuario = useCallback((dados) => {
    const novo = { ...usuario, ...dados };
    localStorage.setItem("usuario", JSON.stringify(novo));
    setUsuario(novo);
  }, [usuario]);

  const logout = useCallback(() => {
    localStorage.removeItem("token");
    localStorage.removeItem("usuario");
    localStorage.removeItem("tipo_usuario");
    setUsuario(null); setTipoUsuario(null);
  }, []);

  return (
    <AuthContext.Provider value={{ usuario, tipoUsuario, carregando, isCliente: tipoUsuario === "cliente", isStaff: tipoUsuario === "staff", loginCliente, loginStaff, atualizarUsuario, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth deve ser usado dentro de AuthProvider");
  return ctx;
}
