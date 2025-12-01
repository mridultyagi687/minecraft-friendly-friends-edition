// App State Management
const AppState = {
    currentScreen: 'login',
    API_URL: 'http://localhost:3000/api',
    currentUser: null,
    
    init() {
        // Check if user is already logged in
        const savedUser = localStorage.getItem('currentUser');
        if (savedUser) {
            try {
                this.currentUser = JSON.parse(savedUser);
                this.showTitleScreen();
            } catch (e) {
                localStorage.removeItem('currentUser');
            }
        }
        
        this.setupLoginForm();
        this.setupTitleScreenButtons();
    },
    
    // Helper function for authenticated API calls
    async apiCall(endpoint, options = {}) {
        const headers = {
            'Content-Type': 'application/json',
            ...options.headers
        };
        
        if (this.currentUser && this.currentUser.id) {
            headers['user-id'] = this.currentUser.id.toString();
        }
        
        return fetch(`${this.API_URL}${endpoint}`, {
            ...options,
            headers
        });
    },
    
    async setupLoginForm() {
        const loginForm = document.getElementById('login-form');
        const loginButton = loginForm.querySelector('.login-button');
        
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const username = document.getElementById('username').value;
            const password = document.getElementById('password').value;
            
            if (!username || !password) {
                this.showError('Please enter both username and password');
                return;
            }
            
            // Disable button and show loading state
            loginButton.disabled = true;
            loginButton.textContent = 'Logging in...';
            
            try {
                const response = await fetch(`${this.API_URL}/auth/login`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ username, password }),
                });
                
                const data = await response.json();
                
                if (data.success) {
                    // Store user info in localStorage
                    this.currentUser = data.user;
                    localStorage.setItem('currentUser', JSON.stringify(data.user));
                    this.showTitleScreen();
                } else {
                    this.showError(data.message || 'Login failed. Please check your credentials.');
                }
            } catch (error) {
                console.error('Login error:', error);
                this.showError('Unable to connect to server. Please make sure the server is running.');
            } finally {
                // Re-enable button
                loginButton.disabled = false;
                loginButton.textContent = 'Login';
            }
        });
    },
    
    showError(message) {
        // Remove any existing error messages
        const existingError = document.querySelector('.error-message');
        if (existingError) {
            existingError.remove();
        }
        
        // Create and show error message
        const errorDiv = document.createElement('div');
        errorDiv.className = 'error-message';
        errorDiv.textContent = message;
        
        const loginForm = document.getElementById('login-form');
        loginForm.insertBefore(errorDiv, loginForm.firstChild);
        
        // Remove error after 5 seconds
        setTimeout(() => {
            errorDiv.remove();
        }, 5000);
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
                this.logout();
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
    },
    
    logout() {
        this.currentUser = null;
        localStorage.removeItem('currentUser');
        this.showLoginScreen();
    }
};

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    AppState.init();
});

