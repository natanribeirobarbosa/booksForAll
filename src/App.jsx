
import { useState } from 'react';

import Home from './pages/Home';
import Settings from './pages/Settings';
import Store from './pages/Store';
import Reader from './pages/Reader';

import BottomNav from './components/BottomNav';
import './App.css';

export default function App() {
  const [aba, setAba] = useState('inicio');
  const [livroAberto, setLivroAberto] = useState(null);

  // Se houver um livro aberto, mostrar somente o leitor.
  if (livroAberto) {
    return (
      <Reader
        livro={livroAberto}
        onVoltar={() => setLivroAberto(null)}
      />
    );
  }

  return (
    <div className="app">
      <main className="conteudo">
        {aba === 'inicio' && (
          <Home onAbrirLivro={setLivroAberto} />
        )}

        {aba === 'opcoes' && <Settings />}

        {aba === 'loja' && <Store />}
      </main>

      <BottomNav
        abaAtual={aba}
        onMudarAba={setAba}
      />
    </div>
  );
}
