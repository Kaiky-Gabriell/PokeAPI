require('dotenv').config({ quiet: true });

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
    throw new Error('DATABASE_URL não foi definida no arquivo .env');
}

const host = new URL(DATABASE_URL).host;
const neonHttpEndPoint = `https://${host}/sql`;

const LIMITE_BARALHO = 12;

async function executarQueryNeon(querySQL, parametros = []) {
    try {
        const resposta = await fetch(neonHttpEndPoint, {
            method: 'POST',
            headers: {
                'Neon-Connection-String': DATABASE_URL,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                query: querySQL,
                params: parametros
            })
        });

        if (!resposta.ok) {
            const erroTexto = await resposta.text();
            throw new Error(`Erro HTTP ${resposta.status}: ${erroTexto}`);
        }

        const dados = await resposta.json();
        return dados.rows || [];
    } catch (erro) {
        console.error('Falha ao comunicar com o banco de dados:', erro);
        return null;
    }
}

async function contarBaralho() {
    const linhas = await executarQueryNeon(
        'SELECT COUNT(*)::INT AS total FROM baralho'
    );

    if (linhas === null) return null;
    return linhas[0]?.total || 0;
}

async function listarBaralho() {
    return executarQueryNeon('SELECT * FROM baralho ORDER BY id ASC');
}

async function verificarPokemonNoBaralho(id) {
    const linhas = await executarQueryNeon(
        'SELECT id FROM baralho WHERE id = $1 LIMIT 1',
        [id]
    );

    if (linhas === null) return null;
    return linhas.length > 0;
}

async function insertPokemon(id, nome, img, cp, treinador, tipo ) {
    const existe = await verificarPokemonNoBaralho(id);
    if (existe === null) return { sucesso: false, erro: 'BANCO' };
    if (existe) return { sucesso: false, erro: 'DUPLICADO' };

    const total = await contarBaralho();
    if (total === null) return { sucesso: false, erro: 'BANCO' };
    if (total >= LIMITE_BARALHO) return { sucesso: false, erro: 'LIMITE' };

    const linhas = await executarQueryNeon(
        `INSERT INTO baralho (id, nome, img, cp, treinador, tipo)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING *`,
        [id, nome, img, cp, treinador, tipo]
    );

    if (linhas === null) return { sucesso: false, erro: 'BANCO' };
    return { sucesso: true, pokemon: linhas[0] };
}

async function removerPokemon(id) {
    const linhas = await executarQueryNeon(
        'DELETE FROM baralho WHERE id = $1 RETURNING *',
        [id]
    );

    if (linhas === null) return null;
    return linhas[0] || null;
}

module.exports = {
    LIMITE_BARALHO,
    listarBaralho,
    contarBaralho,
    verificarPokemonNoBaralho,
    insertPokemon,
    removerPokemon
};
