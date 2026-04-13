import React, { createContext, useContext, useState, useEffect, useCallback } from "react";

const CartContext = createContext(null);

export function CartProvider({ children }) {
  const [itens, setItens] = useState(() => {
    try { const s = localStorage.getItem("carrinho"); return s ? JSON.parse(s) : []; } catch { return []; }
  });

  useEffect(() => { localStorage.setItem("carrinho", JSON.stringify(itens)); }, [itens]);

  const adicionar = useCallback((produto) => {
    setItens(prev => {
      const existe = prev.find(i => i.id === produto.id);
      return existe ? prev.map(i => i.id === produto.id ? { ...i, quantidade: i.quantidade + 1 } : i)
                    : [...prev, { ...produto, quantidade: 1 }];
    });
  }, []);

  const remover = useCallback((id) => {
    setItens(prev => {
      const item = prev.find(i => i.id === id);
      if (!item) return prev;
      return item.quantidade <= 1 ? prev.filter(i => i.id !== id)
                                  : prev.map(i => i.id === id ? { ...i, quantidade: i.quantidade - 1 } : i);
    });
  }, []);

  const limpar = useCallback(() => { setItens([]); localStorage.removeItem("carrinho"); }, []);

  const totalItens = itens.reduce((s, i) => s + i.quantidade, 0);
  const totalValor = itens.reduce((s, i) => s + i.preco * i.quantidade, 0);

  return (
    <CartContext.Provider value={{ itens, totalItens, totalValor, adicionar, remover, limpar }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart deve ser usado dentro de CartProvider");
  return ctx;
}
