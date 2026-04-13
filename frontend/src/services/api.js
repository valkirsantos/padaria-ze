import axios from "axios";

const api = axios.create({ baseURL: "/api", timeout: 15000, headers: { "Content-Type": "application/json" } });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) config.headers.Authorization = "Bearer " + token;
  return config;
});

api.interceptors.response.use(
  (r) => r,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem("token");
      localStorage.removeItem("usuario");
      localStorage.removeItem("tipo_usuario");
      window.dispatchEvent(new CustomEvent("auth:logout"));
    }
    return Promise.reject(err);
  }
);

export default api;

export const authService = {
  enviarOTP:       (telefone)         => api.post("/auth/otp/enviar",    { telefone }),
  verificarOTP:    (telefone, codigo) => api.post("/auth/otp/verificar", { telefone, codigo }),
  atualizarPerfil: (dados)            => api.put("/auth/perfil", dados),
  loginStaff:      (telefone, senha)  => api.post("/auth/staff/login", { telefone, senha }),
  meCliente:       ()                 => api.get("/auth/me/cliente"),
  meStaff:         ()                 => api.get("/auth/me/staff"),
};

export const produtosService = {
  catalogo:   (params)     => api.get("/produtos", { params }),
  admin:      (params)     => api.get("/produtos/admin", { params }),
  criar:      (dados)      => api.post("/produtos", dados),
  editar:     (id, dados)  => api.put("/produtos/" + id, dados),
  toggleDisp: (id, disp)   => api.patch("/produtos/" + id + "/disponibilidade", { disponivel_hoje: disp }),
  desativar:  (id)         => api.delete("/produtos/" + id),
};

export const pedidosService = {
  criar:           (dados)  => api.post("/pedidos", dados),
  meus:            ()       => api.get("/pedidos/meus"),
  dia:             (params) => api.get("/pedidos/dia", { params }),
  detalhe:         (id)     => api.get("/pedidos/" + id),
  atualizarStatus: (id, s)  => api.put("/pedidos/" + id + "/status",    { status: s }),
  registrarPagto:  (id, m)  => api.put("/pedidos/" + id + "/pagamento", { metodo: m }),
};

export const configService = {
  buscar:    () => api.get("/configuracoes"),
  atualizar: (dados) => api.put("/configuracoes", dados),
};

export const relatoriosService = {
  faturamento:   (p) => api.get("/relatorios/faturamento",   { params: { periodo: p } }),
  produtos:      (p) => api.get("/relatorios/produtos",      { params: { periodo: p } }),
  inadimplencia: ()  => api.get("/relatorios/inadimplencia"),
  entregas:      (p) => api.get("/relatorios/entregas",      { params: { periodo: p } }),
};
