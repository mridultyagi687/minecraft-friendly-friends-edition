// App State Management
const AppState = {
    currentScreen: 'login',
    
    init() {
        this.setupLoginForm();
        this.setupTitleScreenButtons();
    },
    
    setupLoginForm() {
        const loginForm = document.getElementById('login-form');
        loginForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const username = document.getElementById('username').value;
            const password = document.getElementById('password').value;
            
            // Simple validation - in a real app, this would authenticate with a backend
            if (username && password) {
                this.showTitleScreen();
            } else {
                alert('Please enter both username and password');
            }
        });
    },
    
    setupTitleScreenButtons() {
        // Singleplayer button
        document.getElementById('singleplayer-btn').addEventListener('click', () => {
            console.log('Singleplayer clicked');
            // TODO: Implement singleplayer functionality
            alert('Singleplayer mode - Coming soon!');
        });
        
        // Multiplayer button
        document.getElementById('multiplayer-btn').addEventListener('click', () => {
            console.log('Multiplayer clicked');
            // TODO: Implement multiplayer functionality
            alert('Multiplayer mode - Coming soon!');
        });
        
        // Options button
        document.getElementById('options-btn').addEventListener('click', () => {
            console.log('Options clicked');
            // TODO: Implement options menu
            alert('Options - Coming soon!');
        });
        
        // Quit button
        document.getElementById('quit-btn').addEventListener('click', () => {
            if (confirm('Are you sure you want to quit?')) {
                this.showLoginScreen();
            }
        });
    },
    
    showTitleScreen() {
        const loginScreen = document.getElementById('login-screen');
        const titleScreen = document.getElementById('title-screen');
        
        loginScreen.classList.remove('active');
        titleScreen.classList.add('active');
        
        this.currentScreen = 'title';
        
        // Clear login form
        document.getElementById('login-form').reset();
    },
    
    showLoginScreen() {
        const loginScreen = document.getElementById('login-screen');
        const titleScreen = document.getElementById('title-screen');
        
        titleScreen.classList.remove('active');
        loginScreen.classList.add('active');
        
        this.currentScreen = 'login';
    }
};

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    AppState.init();
});

