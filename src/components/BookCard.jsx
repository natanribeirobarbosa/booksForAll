import './BookCard.css';

export default function BookCard({ livro, onAbrir }) {
    return (
        <article className="book-card" style={{
            height: `${Math.ceil(livro.nome.length / 25) * 10.5}em`,
            display: 'block',
        }}>


            <div onClick={() => onAbrir()} className="book-card-info" style={{ transform: livro.nome.length < 55 ? 'rotate(90deg)' : 'none', }}>
                <span
                    title={livro.nome}
                    style={{
                        /* height: `${Math.ceil(livro.nome.length / 25) * 1.5}em`,

                     display: 'block', */

                    }}
                >
                    {livro.nome
                        .replace(/\.pdf$/i, '')
                        .replace(/[-_]/g, ' ')}
                </span>

            </div>
        </article>
    );
}