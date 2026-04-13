async function enviarOTP(telefone, codigo) {
  // Em producao: integrar com Z-API aqui
  // Em desenvolvimento: o codigo e exibido no console
  console.log(" OTP para " + telefone + ": " + codigo);
}

async function enviarPedidoPronto(telefone, numeroPedido, tipoEntrega) {
  console.log(" Pedido #" + numeroPedido + " pronto para " + telefone);
}

module.exports = { enviarOTP, enviarPedidoPronto };
