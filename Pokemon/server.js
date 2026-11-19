const http = require('http');
const fs = require('fs');
const path = require('path');

const {
    LIMITE_BARALHO,
    listarBaralho,
    contarBaralho,
    insertPokemon,
    removerPokemon
} = require('./script_db.js');

const PORTA = process.env.PORT || 3002;

const ARQUIVOS = {
    '/': { arquivo: 'index.html', tipo: 'text/html; charset=utf8' },
    '/index.html': { arquivo: 'index.html', tipo: 'text/html; charset=utf8' },
    '/style.css': { arquivo: 'style.css', tipo: 'text/css; charset=utf8' },
    '/script.js': { arquivo: 'script.js', tipo: 'text/javascript; charset=utf8' }
};

function responderJSON(res, status, dados) {
    res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify(dados));
}

function lerCorpo(req) {
    return new Promise((resolve, reject) => {
        let corpo = '';
        req.on('data', pedaco => corpo += pedaco);
        req.on('end', () => {
            try {
                resolve(JSON.parse(corpo || '{}'));
            } catch (erro) {
                reject(erro);
            }
        });
        req.on('error', reject);
    });
}

const servidor = http.createServer(async (req, res) => {
    if (req.url === '/api/baralho' && req.method === 'GET') {
        const linhas = await listarBaralho();
        if (linhas === null) {
            return responderJSON(res, 500, { erro: 'Falha ao consultar o banco de dados' });
        }
        return responderJSON(res, 200, linhas);
    }

    if (req.url === '/api/baralho' && req.method === 'POST') {
        try {
            const { id, nome, img, cp, treinador, tipo } = await lerCorpo(req);

            if (!id || !nome || !img) {
                return responderJSON(res, 400, { erro: 'Dados do Pokémon incompletos' });
            }

            const resultado = await insertPokemon(
                Number(id),
                nome,
                img,
                Number(cp) || 0,
                treinador || '',
                tipo || ''
            );

            if (resultado.erro === 'DUPLICADO') {
                return responderJSON(res, 409, { erro: 'Pokémon já cadastrado' });
            }
            if (resultado.erro === 'LIMITE') {
                return responderJSON(res, 409, { erro: `O baralho permite apenas ${LIMITE_BARALHO} Pokémon` });
            }
            if (!resultado.sucesso) {
                return responderJSON(res, 500, { erro: 'Falha ao cadastrar o Pokémon' });
            }

            return responderJSON(res, 201, resultado.pokemon);
        } catch (erro) {
            return responderJSON(res, 400, { erro: 'Corpo da requisição inválido' });
        }
    }

    if (req.url?.startsWith('/api/baralho/') && req.method === 'DELETE') {
        const id = Number(req.url.split('/').pop());
        if (!Number.isInteger(id)) {
            return responderJSON(res, 400, { erro: 'ID inválido' });
        }

        const removido = await removerPokemon(id);
        if (removido === null) {
            return responderJSON(res, 500, { erro: 'Falha ao remover o Pokémon' });
        }
        if (!removido) {
            return responderJSON(res, 404, { erro: 'Pokémon não encontrado' });
        }
        return responderJSON(res, 200, removido);
    }

    const rota = ARQUIVOS[req.url];
    if (rota) {
        res.writeHead(200, { 'Content-Type': rota.tipo });
        return fs.createReadStream(path.join(__dirname, rota.arquivo)).pipe(res);
    }

    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Página não encontrada');
});

servidor.listen(PORTA, () => {
    console.log(`Arena Pokemon em http://localhost:${PORTA}`);
});