
export default function BottomNav({ abaAtual, onMudarAba }) {
  const abas = [
    { id: 'opcoes', nome: 'opções' },
    { id: 'inicio', nome: 'início' }  ];

  return (
    <nav className="bottom-nav">
      {abas.map((item) => (
        <button
          key={item.id}
          className={abaAtual === item.id ? 'ativo' : ''}
          onClick={() => onMudarAba(item.id)}
        >

          <span style={{
            color: abaAtual === item.id ? '#000000' : '#888888',
            fontWeight: abaAtual === item.id ? 'bold' : 'normal',
            fontSize: abaAtual === item.id ? '18px' : '16px',
           
          }}>{item.nome}</span>
        </button>
      ))}
    </nav>
  );
}
