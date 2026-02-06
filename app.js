// UTILS
let currentUser = null;
let data = getInitialLocalData();
let turmaAtual = null;
let filtroCompensacoes = 'ativas';
let filtroDataInicio = '';
let filtroDataFim = '';

// Para a agenda
window.visualizacaoAgenda = 'mes';
window.dataAtualAgenda = new Date();

// Para ocorrências
window.estudantesOcorrenciaIds = [];

// Para agendamentos de tutoria
window.tempSlots = [];
window.previewWeekOffset = 0;

// --- SISTEMA DE LOGIN E PERSISTÊNCIA ---
import { auth, db } from './firebase-init.js';
import {
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    signOut,
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
    doc,
    setDoc,
    getDoc,
    collection,
    getDocs,
    addDoc,
    deleteDoc,
    updateDoc,
    writeBatch,
    query,
    where,
    orderBy,
    limit
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";


function getTodayString() {
    const today = new Date();
    return today.toISOString().split('T')[0];
}

function formatDate(dateStr) {
    if (!dateStr) return '';
    const [y, m, d] = dateStr.split('-');
    return `${d}/${m}/${y}`;
}

function getStatusColor(status) {
    const cores = {
        'pendente': '#ffc107',
        'notificado': '#3182ce',
        'entregue': '#22c55e',
        'entregue_atraso': '#f59e0b',
        'nao_entregue': '#ef4444'
    };
    return cores[status] || '#718096';
}

// DADOS INICIAIS (TEMPLATE)
// Esta função retorna uma estrutura vazia para novos usuários
function getInitialLocalData() {
    return {
    turmas: [
        {
            id: 1,
            nome: "9º A",
            ano_serie: "9º Ano",
            disciplina: "Matemática",
            turno: "Manhã"
        },
        {
            id: 2,
            nome: "8º B",
            ano_serie: "8º Ano",
            disciplina: "Matemática",
            turno: "Tarde"
        }
    ],
    estudantes: [],
    horariosAulas: [
        { id: 1, id_turma: 1, dia_semana: 1, hora_inicio: "07:30", hora_fim: "08:20" },
        { id: 2, id_turma: 1, dia_semana: 3, hora_inicio: "07:30", hora_fim: "08:20" },
        { id: 3, id_turma: 1, dia_semana: 5, hora_inicio: "07:30", hora_fim: "08:20" }
    ],
    aulas: [
        { id: 1, id_turma: 1, data: getTodayString(), horario_id: 1, conteudo: "Equações do 2º Grau" },
        { id: 2, id_turma: 2, data: getTodayString(), horario_id: null, conteudo: "Frações e Decimais" }
    ],
    presencas: [],
    atrasos: [
    ],
    trabalhos: [
    ],
    notas: [],
    compensacoes: [],
    tutorados: [
        { id: 1, nome_estudante: "Carlos Eduardo Martins", turma: "9º A" }
    ],
    encontros: [
        {
            id: 1,
            id_tutorado: 1,
            data: getTodayString(),
            tema: "Dificuldades em Matemática",
            resumo: "Conversamos sobre as dificuldades e definimos um plano de estudos."
        }
    ],
    eventos: [
        {
            id: 1,
            tipo: "Reunião",
            data: getTodayString(),
            hora_inicio: "14:00",
            hora_fim: "16:00",
            descricao: "Reunião de Planejamento"
        }
    ],
    ocorrencias: [],
    agendamentos: []
};
}

function getNextId(array) {
    return array.length > 0 ? Math.max(...array.map(i => i.id)) + 1 : 1;
}

/**
 * Salva todos os documentos de uma coleção local para o Firestore.
 * ATENÇÃO: Esta função apaga todos os documentos existentes na coleção do Firestore
 * e os substitui pelos dados locais. Use com cuidado.
 * @param {string} collectionName O nome da coleção a ser persistida (ex: 'turmas').
 */
async function persistirDados(collectionName) {
    if (!currentUser || !db || !data[collectionName]) return;

    console.log(`Iniciando persistência para a coleção: ${collectionName}...`);
    try {
        const batch = writeBatch(db);
        const collectionRef = collection(db, "users", currentUser.uid, collectionName);

        // Adiciona cada item da coleção local ao batch
        data[collectionName].forEach(item => {
            const docRef = doc(collectionRef, String(item.id)); // Usa o ID local como ID do documento
            batch.set(docRef, item);
        });

        await batch.commit();
        console.log(`Coleção '${collectionName}' persistida com sucesso!`);
    } catch (error) {
        console.error(`Erro ao persistir a coleção ${collectionName}:`, error);
    }
}

document.addEventListener('DOMContentLoaded', async () => {
    // Observador de estado de autenticação
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            const userDoc = await getDoc(doc(db, "users", user.uid));
            currentUser = { uid: user.uid, email: user.email, ...userDoc.data() };
            iniciarApp(user);
        } else {
            renderLogin();
        }
    });
});

function renderLogin() {
    document.getElementById('appContainer').style.display = 'none';
    document.getElementById('superAdminContainer').style.display = 'none';
    document.getElementById('authContainer').style.display = 'flex';
    document.getElementById('authContainer').innerHTML = `
        <div class="auth-box">
            <h2>🔐 Login</h2>
            <form onsubmit="fazerLogin(event)">
                <label>Email: <input type="email" id="loginEmail" required></label>
                <label>Senha:
                    <div class="password-wrapper">
                        <input type="password" id="loginSenha" required style="padding-right: 35px;">
                        <button type="button" class="toggle-password" onclick="toggleSenha('loginSenha', this)">👁️</button>
                    </div>
                </label>
                <div id="authError" class="auth-error"></div>
                <button type="submit" class="btn btn-primary" style="width: 100%; margin-top: 10px;">Entrar</button>
            </form>
            <span class="auth-link" onclick="renderCadastro()">Não tem conta? Cadastre-se</span>
        </div>
    `;
}

function renderCadastro() {
    document.getElementById('authContainer').innerHTML = `
        <div class="auth-box">
            <h2>📝 Cadastro</h2>
            <form onsubmit="fazerCadastro(event)">
                <label>Nome: <input type="text" id="cadNome" required></label>
                <label>Email: <input type="email" id="cadEmail" required></label>
                <label>Senha:
                    <div class="password-wrapper">
                        <input type="password" id="cadSenha" required style="padding-right: 35px;">
                        <button type="button" class="toggle-password" onclick="toggleSenha('cadSenha', this)">👁️</button>
                    </div>
                </label>
                <div id="authError" class="auth-error"></div>
                <button type="submit" class="btn btn-success" style="width: 100%; margin-top: 10px;">Criar Conta</button>
            </form>
            <span class="auth-link" onclick="renderLogin()">Já tem conta? Faça Login</span>
        </div>
    `;
}

function toggleSenha(inputId, btn) {
    const input = document.getElementById(inputId);
    if (input.type === 'password') {
        input.type = 'text';
        btn.textContent = '🙈';
    } else {
        input.type = 'password';
        btn.textContent = '👁️';
    }
}

async function fazerCadastro(e) {
    e.preventDefault();
    const authErrorDiv = document.getElementById('authError');
    authErrorDiv.textContent = '';

    const nome = document.getElementById('cadNome').value;
    const email = document.getElementById('cadEmail').value;
    const senha = document.getElementById('cadSenha').value;

    try {
        const userCredential = await createUserWithEmailAndPassword(auth, email, senha);
        const user = userCredential.user;

        // Salva informações adicionais do usuário no Firestore
        await setDoc(doc(db, "users", user.uid), {
            nome: nome,
            email: email,
            role: 'Professor' // Perfil padrão
        });

        // Cria uma subcoleção de dados para este usuário com um documento inicial
        const userDataCollection = collection(db, "users", user.uid, "data");
        await addDoc(userDataCollection, getInitialLocalData());

        alert('Cadastro realizado com sucesso! Faça login.');
        renderLogin();
    } catch (error) {
        console.error("Erro no cadastro:", error);
        authErrorDiv.textContent = traduzirErroAuth(error.code);
    }
}

async function fazerLogin(e) {
    e.preventDefault();
    const authErrorDiv = document.getElementById('authError');
    authErrorDiv.textContent = '';

    const email = document.getElementById('loginEmail').value;
    const senha = document.getElementById('loginSenha').value;

    try {
        await signInWithEmailAndPassword(auth, email, senha);
        // O onAuthStateChanged vai cuidar de redirecionar para a app
    } catch (error) {
        console.error("Erro no login:", error);
        authErrorDiv.textContent = traduzirErroAuth(error.code);
    }
}

function traduzirErroAuth(code) {
    switch (code) {
        case 'auth/invalid-email':
            return 'Formato de e-mail inválido.';
        case 'auth/user-not-found':
            return 'Nenhum usuário encontrado com este e-mail.';
        case 'auth/wrong-password':
            return 'Senha incorreta.';
        case 'auth/email-already-in-use':
            return 'Este e-mail já está em uso.';
        case 'auth/weak-password':
            return 'A senha deve ter pelo menos 6 caracteres.';
        default:
            return 'Ocorreu um erro. Tente novamente.';
    }
}

async function logout() {
    try {
        await signOut(auth);
        currentUser = null;
        data = getInitialLocalData(); // Limpa dados da memória
        renderLogin();
    } catch (error) {
        console.error("Erro ao fazer logout:", error);
    }
}

async function iniciarApp(user) {
    document.getElementById('authContainer').style.display = 'none';
    document.getElementById('appContainer').style.display = 'block';

    // Carrega os dados do Firestore
    await carregarDadosDoFirestore();

    const today = new Date();
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    document.getElementById('currentDate').textContent =
        `${today.toLocaleDateString('pt-BR', options)} | Olá, ${currentUser.nome}`;

    renderDashboard();
    showScreen('dashboard');
}

async function carregarDadosDoFirestore() {
    if (!currentUser || !db) return;

    console.log("Carregando dados do Firestore...");
    // Mostra um indicador de loading
    document.getElementById('appContainer').innerHTML = '<div class="loading">Carregando dados...</div>';

    try {
        const dataCollections = Object.keys(getInitialLocalData());
        const promises = dataCollections.map(async (collectionName) => {
            const q = collection(db, "users", currentUser.uid, collectionName);
            const querySnapshot = await getDocs(q);
            const items = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            return { collectionName, items };
        });

        const results = await Promise.all(promises);

        // Reseta os dados locais
        data = getInitialLocalData();

        // Preenche o objeto 'data' com os dados do Firestore
        results.forEach(result => {
            data[result.collectionName] = result.items;
        });

        console.log("Dados carregados:", data);

        // Recarrega o HTML original da aplicação
        // (Esta é uma simplificação. Em um app maior, usaríamos um framework de UI)
        // A better approach would be to not replace the whole container, but for now this works.
        // We need to re-fetch the original HTML structure to put it back.
        const response = await fetch('index.html');
        const text = await response.text();
        const parser = new DOMParser();
        const doc = parser.parseFromString(text, 'text/html');
        const originalAppContainer = doc.getElementById('appContainer');

        document.getElementById('appContainer').replaceWith(originalAppContainer);
        document.getElementById('appContainer').style.display = 'block';

    } catch (error) {
        console.error("Erro ao carregar dados do Firestore: ", error);
        document.getElementById('appContainer').innerHTML = '<div class="alert alert-danger">Erro ao carregar seus dados. Tente recarregar a página.</div>';
    }
}

// NAVEGAÇÃO
function showScreen(screenId, evt) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById(screenId).classList.add('active');

    document.querySelectorAll('nav button').forEach(b => b.classList.remove('active'));
    if (evt && evt.target) {
        evt.target.classList.add('active');
    } else {
        document.querySelectorAll('nav button').forEach(b => {
            if (b.getAttribute('onclick') && b.getAttribute('onclick').includes(screenId)) {
                b.classList.add('active');
            }
        });
    }

    if (screenId === 'dashboard') renderDashboard();
    if (screenId === 'turmas') renderTurmas();
    if (screenId === 'tutoria') renderTutoria();
    if (screenId === 'agenda') renderAgenda();
}

function showModal(modalId) {
    document.getElementById(modalId).classList.add('active');

    if (modalId === 'modalNovoEncontro') {
        const select = document.getElementById('encontroTutorado');
        select.innerHTML = data.tutorados.map(t =>
            `<option value="${t.id}">${t.nome_estudante}</option>`
        ).join('');
    }
}

function closeModal(modalId) {
    document.getElementById(modalId).classList.remove('active');
}

// DASHBOARD
function renderDashboard() {
    const today = getTodayString();

    // Aulas de hoje
    const aulasHoje = data.aulas.filter(a => a.data === today);
    const aulasHtml = aulasHoje.length > 0 ? aulasHoje.map(a => {
        const turma = data.turmas.find(t => t.id === a.id_turma);
        return `
            <div class="alert alert-info" style="cursor: pointer; transition: transform 0.2s;"
                 onclick="abrirTurma(${turma.id})"
                 onmouseover="this.style.transform='translateX(5px)'"
                 onmouseout="this.style.transform='translateX(0)'">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <div>
                        <strong>${turma.nome} - ${turma.disciplina}</strong> - ${a.conteudo}
                    </div>
                    <div style="font-size: 20px;">→</div>
                </div>
            </div>
        `;
    }).join('') : '<p class="empty-state">Nenhuma aula registrada para hoje</p>';

    document.getElementById('aulasHoje').innerHTML = aulasHtml;

    // Reuniões de Hoje
    const eventosHoje = data.eventos.filter(e => e.data === today && e.tipo !== 'Aula');
    const reunioesHtml = eventosHoje.length > 0 ? eventosHoje.map(e => `
        <div class="alert alert-warning">
            <div style="display: flex; justify-content: space-between; align-items: center;">
                <div>
                    <strong>${e.hora_inicio}</strong> - ${e.descricao || e.tipo}
                </div>
            </div>
        </div>
    `).join('') : '<p class="empty-state">Nenhuma reunião hoje</p>';
    document.getElementById('reunioesHoje').innerHTML = reunioesHtml;

    // Tutorias de hoje
    const tutoriasHoje = data.encontros.filter(e => e.data === today);
    const tutoriasHtml = tutoriasHoje.length > 0 ? tutoriasHoje.map(e => {
        const tutorado = data.tutorados.find(t => t.id === e.id_tutorado);
        return `
            <div class="alert alert-success" style="cursor: pointer; transition: transform 0.2s;"
                 onclick="irParaTutoria()"
                 onmouseover="this.style.transform='translateX(5px)'"
                 onmouseout="this.style.transform='translateX(0)'">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <div>
                        <strong>${tutorado.nome_estudante}</strong> - ${e.tema}
                    </div>
                    <div style="font-size: 20px;">→</div>
                </div>
            </div>
        `;
    }).join('') : '<p class="empty-state">Nenhuma tutoria para hoje</p>';

    document.getElementById('tutoriasHoje').innerHTML = tutoriasHtml;

    // Alertas
    let alertas = [];

    // Compensações pendentes
    const compPendentes = data.compensacoes.filter(c => c.status === 'pendente' && !c.arquivada);
    if (compPendentes.length > 0) {
        alertas.push(`
            <div class="alert alert-warning">
                <strong>${compPendentes.length}</strong> compensação(ões) de falta pendente(s)
            </div>
        `);
    }

    // Atrasos do dia
    const atrasosHoje = data.atrasos.filter(a => a.data === today);
    if (atrasosHoje.length > 0) {
        alertas.push(`
            <div class="alert alert-warning">
                <strong>${atrasosHoje.length}</strong> atraso(s) registrado(s) hoje
            </div>
        `);
    }

    if (alertas.length === 0) {
        alertas.push('<div class="alert alert-success">Tudo em dia! ✓</div>');
    }

    document.getElementById('alertas').innerHTML = alertas.join('');
}

function irParaTutoria() {
    showScreen('tutoria');
}

// TURMAS
function renderTurmas() {
    const diasSemana = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

    const html = data.turmas.map(t => {
        const horarios = data.horariosAulas
            .filter(h => h.id_turma === t.id)
            .sort((a, b) => a.dia_semana - b.dia_semana || a.hora_inicio.localeCompare(b.hora_inicio));

        const horariosHtml = horarios.length > 0
            ? `<div style="margin-top: 10px; font-size: 12px; color: #4a5568; background: #edf2f7; padding: 8px; border-radius: 4px;">
                ${horarios.map(h => `<div>📅 ${diasSemana[h.dia_semana]} • ⏰ ${h.hora_inicio} - ${h.hora_fim}</div>`).join('')}
               </div>`
            : '<div style="margin-top: 10px; font-size: 12px; color: #a0aec0; font-style: italic;">Sem horários configurados</div>';

        return `
        <div class="class-item" onclick="abrirTurma(${t.id})" style="position: relative;">
            <div style="display: flex; justify-content: space-between; align-items: start;">
                <div>
                    <h3>${t.nome} - ${t.disciplina}</h3>
                    <div class="class-info">
                        ${t.ano_serie} • ${t.disciplina} • ${t.turno}
                    </div>
                </div>
                <div onclick="event.stopPropagation()">
                    <button class="btn btn-sm btn-secondary" onclick="editarTurma(${t.id})" title="Editar">✏️</button>
                    <button class="btn btn-sm btn-danger" onclick="removerTurma(${t.id})" title="Excluir">🗑️</button>
                </div>
            </div>
            ${horariosHtml}
        </div>
    `}).join('');

    document.getElementById('listaTurmas').innerHTML = html || '<p class="empty-state">Nenhuma turma cadastrada</p>';
}

function abrirModalNovaTurma() {
    document.getElementById('turmaId').value = '';
    document.getElementById('turmaNome').value = '';
    document.getElementById('turmaAno').value = '';
    document.getElementById('turmaDisciplina').value = '';
    document.getElementById('turmaTurno').value = '';

    document.getElementById('tituloModalTurma').textContent = 'Nova Turma';
    showModal('modalNovaTurma');
}

function editarTurma(id) {
    const turma = data.turmas.find(t => t.id === id);
    if (!turma) return;

    document.getElementById('turmaId').value = turma.id;
    document.getElementById('turmaNome').value = turma.nome;
    document.getElementById('turmaAno').value = turma.ano_serie;
    document.getElementById('turmaDisciplina').value = turma.disciplina;
    document.getElementById('turmaTurno').value = turma.turno;

    document.getElementById('tituloModalTurma').textContent = 'Editar Turma';
    showModal('modalNovaTurma');
}

async function salvarTurma(e) {
    e.preventDefault();

    const turmaId = document.getElementById('turmaId').value;
    const turmaData = {
        nome: document.getElementById('turmaNome').value,
        ano_serie: document.getElementById('turmaAno').value,
        disciplina: document.getElementById('turmaDisciplina').value,
        turno: document.getElementById('turmaTurno').value
    };

    