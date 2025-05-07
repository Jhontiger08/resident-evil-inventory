// Configuração do Firebase
const firebaseConfig = {
    apiKey: "AIzaSyAKUKEyV3iS8QCQpdjtHhDdbiySy2e9RZY",
    authDomain: "rpgterror-90630.firebaseapp.com",
    projectId: "rpgterror-90630",
    storageBucket: "rpgterror-90630.firebasestorage.app",
    messagingSenderId: "569459851763",
    appId: "1:569459851763:web:302afb88d253d14ab25286",
    measurementId: "G-S688CN1RK5"
};

// Inicializa o Firebase
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();

// Provedor de autenticação do Google
const googleProvider = new firebase.auth.GoogleAuthProvider();

document.addEventListener('DOMContentLoaded', function () {
    const googleLoginBtn = document.getElementById('googleLoginBtn');
    const guestLoginBtn = document.getElementById('guestLogin');
    const createAccountBtn = document.getElementById('createAccount');

    // Login com Google
    googleLoginBtn.addEventListener('click', () => {
        auth.signInWithPopup(googleProvider)
            .then((result) => {
                // Login bem-sucedido
                const user = result.user;
                console.log('Usuário logado:', user);

                // Redireciona para a página principal
                window.location.href = 'index.html';
            })
            .catch((error) => {
                // Tratamento de erros
                console.error('Erro no login:', error);
                alert(`Erro no login: ${error.message}`);
            });
    });

    // Login como convidado (anônimo)
    guestLoginBtn.addEventListener('click', (e) => {
        e.preventDefault();
        auth.signInAnonymously()
            .then(() => {
                // Login anônimo bem-sucedido
                window.location.href = 'index.html';
            })
            .catch((error) => {
                console.error('Erro no login anônimo:', error);
                alert(`Erro no login: ${error.message}`);
            });
    });

    // Criar nova conta (mesmo comportamento do login com Google)
    createAccountBtn.addEventListener('click', (e) => {
        e.preventDefault();
        googleLoginBtn.click();
    });

    // Monitora o estado de autenticação
    auth.onAuthStateChanged((user) => {
        if (user) {
            // Usuário está logado
            console.log('Usuário autenticado:', user);

            // Se já estiver logado, redireciona direto
            if (window.location.pathname.includes('login.html')) {
                window.location.href = 'index.html';
            }
        } else {
            // Usuário não está logado
            console.log('Nenhum usuário autenticado');
        }
    });
});