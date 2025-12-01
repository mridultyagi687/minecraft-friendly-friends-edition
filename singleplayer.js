// Minecraft Friendly Friends Edition - Singleplayer Mode
import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';

class MinecraftGame {
    constructor() {
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.controls = null;
        this.world = null;
        this.gameMode = 'survival'; // survival, creative, adventure
        this.currentWorld = null;
        this.worldName = 'My World';
        this.blocks = new Map(); // Store block positions
        this.selectedBlock = 0; // Currently selected hotbar slot
        this.hotbarItems = ['grass', 'dirt', 'stone', 'wood', 'leaves', 'sand', 'gravel', 'cobblestone', 'planks'];
        this.isPointerLocked = false;
        this.moveState = {
            forward: false,
            backward: false,
            left: false,
            right: false,
            jump: false
        };
        this.velocity = new THREE.Vector3();
        this.direction = new THREE.Vector3();
        this.canJump = false;
        this.prevTime = performance.now();
        
        this.init();
    }
    
    init() {
        // Check if user is logged in
        const savedUser = localStorage.getItem('currentUser');
        if (!savedUser) {
            window.location.href = 'index.html';
            return;
        }
        
        this.currentUser = JSON.parse(savedUser);
        this.setupUI();
        this.showGameModeSelector();
    }
    
    setupUI() {
        // Setup hotbar
        const hud = document.getElementById('hud');
        this.hotbarItems.forEach((item, index) => {
            const slot = document.createElement('div');
            slot.className = 'hotbar-slot';
            slot.textContent = this.getBlockEmoji(item);
            slot.dataset.index = index;
            if (index === 0) slot.classList.add('selected');
            slot.addEventListener('click', () => this.selectHotbarSlot(index));
            hud.appendChild(slot);
        });
        
        // Menu button
        document.getElementById('menu-btn').addEventListener('click', () => {
            this.showPauseMenu();
        });
        
        // Game mode selector buttons
        document.querySelectorAll('.game-mode-button').forEach(btn => {
            if (btn.dataset.mode) {
                btn.addEventListener('click', () => {
                    this.gameMode = btn.dataset.mode;
                    this.worldName = document.getElementById('world-name-input').value || 'My World';
                    this.startGame();
                });
            }
        });
        
        // Load world button
        document.getElementById('load-world-btn').addEventListener('click', () => {
            this.showWorldList();
        });
        
        // Keyboard controls
        document.addEventListener('keydown', (e) => this.onKeyDown(e));
        document.addEventListener('keyup', (e) => this.onKeyUp(e));
        document.addEventListener('mousedown', (e) => this.onMouseDown(e));
    }
    
    showGameModeSelector() {
        document.getElementById('game-mode-selector').classList.add('active');
    }
    
    hideGameModeSelector() {
        document.getElementById('game-mode-selector').classList.remove('active');
    }
    
    async showWorldList() {
        // Load worlds from API
        try {
            const response = await fetch(`http://localhost:3000/api/worlds?world_type=singleplayer`, {
                headers: {
                    'user-id': this.currentUser.id.toString()
                }
            });
            const data = await response.json();
            
            if (data.success && data.worlds.length > 0) {
                const worldList = prompt('Available worlds:\n' + 
                    data.worlds.map(w => w.name).join('\n') + 
                    '\n\nEnter world name to load:');
                if (worldList) {
                    const world = data.worlds.find(w => w.name === worldList);
                    if (world) {
                        this.currentWorld = world;
                        this.worldName = world.name;
                        this.gameMode = world.world_type || 'survival';
                        this.startGame();
                    }
                }
            } else {
                alert('No saved worlds found. Create a new world!');
            }
        } catch (error) {
            console.error('Error loading worlds:', error);
            alert('Error loading worlds. Starting new world.');
            this.startGame();
        }
    }
    
    startGame() {
        this.hideGameModeSelector();
        this.initThreeJS();
        this.generateWorld();
        this.animate();
        this.requestPointerLock();
    }
    
    initThreeJS() {
        const container = document.getElementById('game-container');
        const canvas = document.getElementById('game-canvas');
        
        // Scene
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x87CEEB); // Sky blue
        this.scene.fog = new THREE.Fog(0x87CEEB, 0, 500);
        
        // Camera
        this.camera = new THREE.PerspectiveCamera(
            75,
            window.innerWidth / window.innerHeight,
            0.1,
            1000
        );
        this.camera.position.set(0, 20, 0);
        
        // Renderer
        this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        
        // Controls
        this.controls = new PointerLockControls(this.camera, document.body);
        
        // Lighting
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
        this.scene.add(ambientLight);
        
        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
        directionalLight.position.set(50, 100, 50);
        directionalLight.castShadow = true;
        directionalLight.shadow.mapSize.width = 2048;
        directionalLight.shadow.mapSize.height = 2048;
        directionalLight.shadow.camera.near = 0.5;
        directionalLight.shadow.camera.far = 500;
        directionalLight.shadow.camera.left = -100;
        directionalLight.shadow.camera.right = 100;
        directionalLight.shadow.camera.top = 100;
        directionalLight.shadow.camera.bottom = -100;
        this.scene.add(directionalLight);
        
        // Window resize
        window.addEventListener('resize', () => {
            this.camera.aspect = window.innerWidth / window.innerHeight;
            this.camera.updateProjectionMatrix();
            this.renderer.setSize(window.innerWidth, window.innerHeight);
        });
    }
    
    generateWorld() {
        // Generate a simple flat world with some terrain variation
        const worldSize = 50;
        const chunkSize = 16;
        
        // Create ground
        for (let x = -worldSize; x < worldSize; x++) {
            for (let z = -worldSize; z < worldSize; z++) {
                // Simple height map using noise-like function
                const height = Math.floor(
                    10 + 
                    Math.sin(x * 0.1) * 3 + 
                    Math.cos(z * 0.1) * 3 +
                    Math.sin((x + z) * 0.05) * 2
                );
                
                // Place blocks from bottom to height
                for (let y = 0; y <= height; y++) {
                    let blockType = 'dirt';
                    if (y === height) {
                        blockType = 'grass';
                    } else if (y < height - 3) {
                        blockType = 'stone';
                    }
                    
                    this.placeBlock(x, y, z, blockType);
                }
                
                // Add some trees randomly
                if (Math.random() < 0.02 && height > 12) {
                    this.generateTree(x, height + 1, z);
                }
            }
        }
    }
    
    generateTree(x, y, z) {
        // Trunk
        for (let i = 0; i < 4; i++) {
            this.placeBlock(x, y + i, z, 'wood');
        }
        
        // Leaves
        const leafPositions = [
            [0, 4, 0], [0, 5, 0],
            [-1, 4, 0], [1, 4, 0], [0, 4, -1], [0, 4, 1],
            [-1, 4, -1], [1, 4, -1], [-1, 4, 1], [1, 4, 1],
            [-1, 5, 0], [1, 5, 0], [0, 5, -1], [0, 5, 1]
        ];
        
        leafPositions.forEach(([dx, dy, dz]) => {
            this.placeBlock(x + dx, y + dy, z + dz, 'leaves');
        });
    }
    
    placeBlock(x, y, z, blockType) {
        const key = `${x},${y},${z}`;
        if (this.blocks.has(key)) {
            this.scene.remove(this.blocks.get(key));
        }
        
        const geometry = new THREE.BoxGeometry(1, 1, 1);
        const material = new THREE.MeshLambertMaterial({ 
            color: this.getBlockColor(blockType),
            map: this.getBlockTexture(blockType)
        });
        
        const block = new THREE.Mesh(geometry, material);
        block.position.set(x, y, z);
        block.castShadow = true;
        block.receiveShadow = true;
        block.userData = { blockType, x, y, z };
        
        this.scene.add(block);
        this.blocks.set(key, block);
    }
    
    removeBlock(x, y, z) {
        const key = `${x},${y},${z}`;
        if (this.blocks.has(key)) {
            this.scene.remove(this.blocks.get(key));
            this.blocks.delete(key);
        }
    }
    
    getBlockColor(blockType) {
        const colors = {
            grass: 0x7cb342,
            dirt: 0x8d6e63,
            stone: 0x757575,
            wood: 0x8d6e63,
            leaves: 0x558b2f,
            sand: 0xfdd835,
            gravel: 0x9e9e9e,
            cobblestone: 0x616161,
            planks: 0xd7ccc8
        };
        return colors[blockType] || 0xffffff;
    }
    
    getBlockTexture(blockType) {
        // For now, return null - can add textures later
        return null;
    }
    
    getBlockEmoji(blockType) {
        const emojis = {
            grass: '🟩',
            dirt: '🟫',
            stone: '⬜',
            wood: '🟤',
            leaves: '🍃',
            sand: '🟨',
            gravel: '⚫',
            cobblestone: '⬛',
            planks: '🟧'
        };
        return emojis[blockType] || '⬜';
    }
    
    selectHotbarSlot(index) {
        document.querySelectorAll('.hotbar-slot').forEach(slot => {
            slot.classList.remove('selected');
        });
        document.querySelector(`[data-index="${index}"]`).classList.add('selected');
        this.selectedBlock = index;
    }
    
    requestPointerLock() {
        const havePointerLock = 'pointerLockElement' in document ||
            'mozPointerLockElement' in document ||
            'webkitPointerLockElement' in document;
        
        if (havePointerLock) {
            document.body.requestPointerLock = document.body.requestPointerLock ||
                document.body.mozRequestPointerLock ||
                document.body.webkitRequestPointerLock;
            
            document.body.requestPointerLock();
            
            document.addEventListener('pointerlockchange', () => {
                this.isPointerLocked = document.pointerLockElement === document.body;
                if (this.isPointerLocked) {
                    this.controls.lock();
                } else {
                    this.controls.unlock();
                }
            });
        }
    }
    
    onKeyDown(event) {
        switch (event.code) {
            case 'KeyW': this.moveState.forward = true; break;
            case 'KeyS': this.moveState.backward = true; break;
            case 'KeyA': this.moveState.left = true; break;
            case 'KeyD': this.moveState.right = true; break;
            case 'Space': 
                if (this.canJump) {
                    this.velocity.y += 10;
                    this.canJump = false;
                }
                break;
            case 'Digit1': this.selectHotbarSlot(0); break;
            case 'Digit2': this.selectHotbarSlot(1); break;
            case 'Digit3': this.selectHotbarSlot(2); break;
            case 'Digit4': this.selectHotbarSlot(3); break;
            case 'Digit5': this.selectHotbarSlot(4); break;
            case 'Digit6': this.selectHotbarSlot(5); break;
            case 'Digit7': this.selectHotbarSlot(6); break;
            case 'Digit8': this.selectHotbarSlot(7); break;
            case 'Digit9': this.selectHotbarSlot(8); break;
        }
    }
    
    onKeyUp(event) {
        switch (event.code) {
            case 'KeyW': this.moveState.forward = false; break;
            case 'KeyS': this.moveState.backward = false; break;
            case 'KeyA': this.moveState.left = false; break;
            case 'KeyD': this.moveState.right = false; break;
        }
    }
    
    onMouseDown(event) {
        if (!this.isPointerLocked) return;
        
        if (event.button === 0) { // Left click - break block
            this.breakBlock();
        } else if (event.button === 2) { // Right click - place block
            this.placeBlockAtCursor();
        }
    }
    
    breakBlock() {
        // Raycast to find block
        const raycaster = new THREE.Raycaster();
        raycaster.setFromCamera(new THREE.Vector2(0, 0), this.camera);
        const intersects = raycaster.intersectObjects(Array.from(this.blocks.values()));
        
        if (intersects.length > 0) {
            const block = intersects[0].object;
            const { x, y, z } = block.userData;
            this.removeBlock(x, y, z);
        }
    }
    
    placeBlockAtCursor() {
        const raycaster = new THREE.Raycaster();
        raycaster.setFromCamera(new THREE.Vector2(0, 0), this.camera);
        const intersects = raycaster.intersectObjects(Array.from(this.blocks.values()));
        
        if (intersects.length > 0) {
            const intersect = intersects[0];
            const normal = intersect.face.normal;
            const blockType = this.hotbarItems[this.selectedBlock];
            
            const newX = Math.round(intersect.point.x + normal.x * 0.5);
            const newY = Math.round(intersect.point.y + normal.y * 0.5);
            const newZ = Math.round(intersect.point.z + normal.z * 0.5);
            
            // Don't place block if player is inside it
            const playerPos = this.camera.position;
            if (Math.abs(newX - playerPos.x) > 0.5 || 
                Math.abs(newY - playerPos.y) > 1.5 || 
                Math.abs(newZ - playerPos.z) > 0.5) {
                this.placeBlock(newX, newY, newZ, blockType);
            }
        }
    }
    
    updateMovement(delta) {
        if (!this.controls.isLocked) return;
        
        this.velocity.x -= this.velocity.x * 10.0 * delta;
        this.velocity.z -= this.velocity.z * 10.0 * delta;
        this.velocity.y -= 9.8 * 100.0 * delta; // gravity
        
        this.direction.z = Number(this.moveState.forward) - Number(this.moveState.backward);
        this.direction.x = Number(this.moveState.right) - Number(this.moveState.left);
        this.direction.normalize();
        
        if (this.moveState.forward || this.moveState.backward) {
            this.velocity.z -= this.direction.z * 400.0 * delta;
        }
        if (this.moveState.left || this.moveState.right) {
            this.velocity.x -= this.direction.x * 400.0 * delta;
        }
        
        this.controls.moveRight(-this.velocity.x * delta);
        this.controls.moveForward(-this.velocity.z * delta);
        
        this.camera.position.y += (this.velocity.y * delta);
        
        // Simple collision detection - keep player above ground
        const playerY = this.camera.position.y;
        const playerX = Math.floor(this.camera.position.x);
        const playerZ = Math.floor(this.camera.position.z);
        
        let groundLevel = 0;
        for (let y = 50; y >= 0; y--) {
            const key = `${playerX},${y},${playerZ}`;
            if (this.blocks.has(key)) {
                groundLevel = y + 1.8; // Player height
                break;
            }
        }
        
        if (this.camera.position.y < groundLevel) {
            this.camera.position.y = groundLevel;
            this.velocity.y = 0;
            this.canJump = true;
        }
    }
    
    animate() {
        requestAnimationFrame(() => this.animate());
        
        const time = performance.now();
        const delta = (time - this.prevTime) / 1000;
        this.prevTime = time;
        
        this.updateMovement(delta);
        this.renderer.render(this.scene, this.camera);
    }
    
    showPauseMenu() {
        this.controls.unlock();
        const action = confirm('Paused\n\nResume - OK\nSave & Exit - Cancel');
        if (!action) {
            this.saveWorld();
            window.location.href = 'index.html';
        } else {
            this.requestPointerLock();
        }
    }
    
    async saveWorld() {
        try {
            const worldData = {
                name: this.worldName,
                world_type: 'singleplayer',
                seed: Date.now().toString()
            };
            
            // Check if world exists
            const checkResponse = await fetch(`http://localhost:3000/api/worlds`, {
                headers: {
                    'user-id': this.currentUser.id.toString()
                }
            });
            const checkData = await checkResponse.json();
            const existingWorld = checkData.worlds?.find(w => w.name === this.worldName);
            
            if (existingWorld) {
                // Update existing world
                await fetch(`http://localhost:3000/api/worlds/${existingWorld.id}`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        'user-id': this.currentUser.id.toString()
                    },
                    body: JSON.stringify(worldData)
                });
            } else {
                // Create new world
                await fetch(`http://localhost:3000/api/worlds`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'user-id': this.currentUser.id.toString()
                    },
                    body: JSON.stringify(worldData)
                });
            }
            
            console.log('World saved successfully');
        } catch (error) {
            console.error('Error saving world:', error);
        }
    }
}

// Prevent right-click menu
document.addEventListener('contextmenu', (e) => e.preventDefault());

// Start game when page loads
window.addEventListener('DOMContentLoaded', () => {
    new MinecraftGame();
});

