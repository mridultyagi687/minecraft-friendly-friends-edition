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
        
        // Inventory system
        this.inventory = {
            hotbar: new Array(9).fill(null), // 9 hotbar slots
            main: new Array(27).fill(null), // 27 main inventory slots
            crafting: new Array(9).fill(null) // 3x3 crafting grid
        };
        
        // Crafting recipes
        this.craftingRecipes = {
            // Format: recipe pattern -> result item
            'wood,wood,wood,wood': { item: 'planks', count: 4 },
            'planks,planks,planks,planks': { item: 'stick', count: 4 },
            'stick,stick,stick,stick,planks,planks,planks,planks,planks': { item: 'crafting_table', count: 1 },
            'stone,stone,stone,stone': { item: 'cobblestone', count: 4 },
            'cobblestone,cobblestone,cobblestone,cobblestone': { item: 'stone_bricks', count: 4 }
        };
        
        // Item definitions
        this.items = {
            grass: { emoji: '🟩', name: 'Grass Block' },
            dirt: { emoji: '🟫', name: 'Dirt' },
            stone: { emoji: '⬜', name: 'Stone' },
            wood: { emoji: '🟤', name: 'Wood' },
            leaves: { emoji: '🍃', name: 'Leaves' },
            sand: { emoji: '🟨', name: 'Sand' },
            gravel: { emoji: '⚫', name: 'Gravel' },
            cobblestone: { emoji: '⬛', name: 'Cobblestone' },
            planks: { emoji: '🟧', name: 'Wooden Planks' },
            stick: { emoji: '🪵', name: 'Stick' },
            crafting_table: { emoji: '🪵', name: 'Crafting Table' },
            stone_bricks: { emoji: '🧱', name: 'Stone Bricks' },
            cactus: { emoji: '🌵', name: 'Cactus' },
            glass: { emoji: '🪟', name: 'Glass' },
            iron_ore: { emoji: '⚙️', name: 'Iron Ore' },
            coal_ore: { emoji: '⚫', name: 'Coal Ore' },
            gold_ore: { emoji: '🟨', name: 'Gold Ore' },
            diamond_ore: { emoji: '💎', name: 'Diamond Ore' },
            water: { emoji: '💧', name: 'Water' },
            lava: { emoji: '🌋', name: 'Lava' },
            ice: { emoji: '🧊', name: 'Ice' },
            snow: { emoji: '❄️', name: 'Snow' },
            clay: { emoji: '🟫', name: 'Clay' },
            wool: { emoji: '🐑', name: 'Wool' }
        };
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
        
        // Mobs and entities
        this.entities = [];
        this.mobSpawnTimer = 0;
        this.mobSpawnInterval = 10000; // Spawn mobs every 10 seconds
        
        // Day/night cycle
        this.timeOfDay = 0.5; // 0 = midnight, 0.5 = noon, 1 = midnight
        this.dayLength = 120000; // 2 minutes per day
        this.sunLight = null;
        this.ambientLight = null;
        
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
        // Initialize inventory with some starting items (Creative mode)
        if (this.gameMode === 'creative') {
            Object.keys(this.items).forEach((item, index) => {
                if (index < 9) {
                    this.inventory.hotbar[index] = { item, count: 64 };
                }
            });
        }
        
        // Setup hotbar
        this.updateHotbar();
        
        // Setup inventory grid
        this.updateInventory();
        
        // Setup crafting grid
        this.setupCraftingGrid();
        
        // Menu button
        document.getElementById('menu-btn').addEventListener('click', () => {
            this.showPauseMenu();
        });
        
        // Inventory toggle
        document.getElementById('close-inventory-btn').addEventListener('click', () => {
            this.toggleInventory();
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
        
        // Lighting - Day/Night cycle
        this.ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
        this.scene.add(this.ambientLight);
        
        this.sunLight = new THREE.DirectionalLight(0xffffff, 0.8);
        this.sunLight.position.set(50, 100, 50);
        this.sunLight.castShadow = true;
        this.sunLight.shadow.mapSize.width = 2048;
        this.sunLight.shadow.mapSize.height = 2048;
        this.sunLight.shadow.camera.near = 0.5;
        this.sunLight.shadow.camera.far = 500;
        this.sunLight.shadow.camera.left = -100;
        this.sunLight.shadow.camera.right = 100;
        this.sunLight.shadow.camera.top = 100;
        this.sunLight.shadow.camera.bottom = -100;
        this.scene.add(this.sunLight);
        
        // Moon light (for night)
        this.moonLight = new THREE.DirectionalLight(0x6b7fd7, 0.3);
        this.moonLight.position.set(-50, 100, -50);
        this.scene.add(this.moonLight);
        
        // Window resize
        window.addEventListener('resize', () => {
            this.camera.aspect = window.innerWidth / window.innerHeight;
            this.camera.updateProjectionMatrix();
            this.renderer.setSize(window.innerWidth, window.innerHeight);
        });
    }
    
    generateWorld() {
        // Improved world generation with biomes
        const worldSize = 50;
        const chunkSize = 16;
        
        // Create ground with biome-based generation
        for (let x = -worldSize; x < worldSize; x++) {
            for (let z = -worldSize; z < worldSize; z++) {
                // Determine biome based on position
                const biome = this.getBiome(x, z);
                
                // Height map with multiple octaves for more natural terrain
                const height = this.getTerrainHeight(x, z, biome);
                
                // Place blocks based on biome
                this.generateBiomeBlocks(x, z, height, biome);
                
                // Add structures based on biome
                if (Math.random() < this.getStructureChance(biome)) {
                    this.generateStructure(x, height + 1, z, biome);
                }
            }
        }
        
        // Spawn initial mobs
        this.spawnInitialMobs();
    }
    
    getBiome(x, z) {
        // Simple biome system based on distance from origin
        const distance = Math.sqrt(x * x + z * z);
        const noise = Math.sin(x * 0.05) * Math.cos(z * 0.05);
        
        if (distance < 15) {
            return 'plains';
        } else if (noise > 0.3) {
            return 'forest';
        } else if (noise < -0.3) {
            return 'desert';
        } else if (distance > 30) {
            return 'mountains';
        } else {
            return 'plains';
        }
    }
    
    getTerrainHeight(x, z, biome) {
        // Multi-octave noise for more natural terrain
        const baseHeight = 10;
        const octave1 = Math.sin(x * 0.1) * Math.cos(z * 0.1) * 3;
        const octave2 = Math.sin(x * 0.05) * Math.cos(z * 0.05) * 5;
        const octave3 = Math.sin((x + z) * 0.02) * 2;
        
        let height = baseHeight + octave1 + octave2 + octave3;
        
        // Biome-specific height adjustments
        if (biome === 'mountains') {
            height += 8 + Math.random() * 5;
        } else if (biome === 'desert') {
            height += Math.random() * 2 - 1;
        } else if (biome === 'forest') {
            height += 2 + Math.random() * 3;
        }
        
        return Math.floor(height);
    }
    
    generateBiomeBlocks(x, z, height, biome) {
        for (let y = 0; y <= height; y++) {
            let blockType = 'dirt';
            
            if (y === height) {
                // Surface block
                if (biome === 'desert') {
                    blockType = 'sand';
                } else if (biome === 'mountains') {
                    blockType = Math.random() < 0.7 ? 'stone' : 'gravel';
                } else {
                    blockType = 'grass';
                }
            } else if (y > height - 3) {
                // Top layers
                if (biome === 'desert') {
                    blockType = 'sand';
                } else {
                    blockType = 'dirt';
                }
            } else {
                // Deep layers
                blockType = 'stone';
            }
            
            this.placeBlock(x, y, z, blockType);
        }
    }
    
    getStructureChance(biome) {
        const chances = {
            forest: 0.03,
            plains: 0.01,
            desert: 0.02,
            mountains: 0.005
        };
        return chances[biome] || 0.01;
    }
    
    generateStructure(x, y, z, biome) {
        if (biome === 'forest' && Math.random() < 0.8) {
            this.generateTree(x, y, z);
        } else if (biome === 'plains' && Math.random() < 0.3) {
            this.generateTree(x, y, z);
        } else if (biome === 'desert' && Math.random() < 0.1) {
            this.generateCactus(x, y, z);
        }
    }
    
    generateCactus(x, y, z) {
        const height = 2 + Math.floor(Math.random() * 3);
        for (let i = 0; i < height; i++) {
            this.placeBlock(x, y + i, z, 'cactus');
        }
    }
    
    spawnInitialMobs() {
        // Spawn a few passive mobs
        for (let i = 0; i < 5; i++) {
            const x = (Math.random() - 0.5) * 40;
            const z = (Math.random() - 0.5) * 40;
            const y = this.getGroundLevel(x, z) + 1;
            this.spawnMob('cow', x, y, z);
        }
    }
    
    getGroundLevel(x, z) {
        const blockX = Math.floor(x);
        const blockZ = Math.floor(z);
        for (let y = 50; y >= 0; y--) {
            const key = `${blockX},${y},${blockZ}`;
            if (this.blocks.has(key)) {
                return y + 1;
            }
        }
        return 10;
    }
    
    spawnMob(type, x, y, z) {
        const mobTypes = {
            zombie: { emoji: '🧟', health: 20, speed: 0.02, hostile: true },
            creeper: { emoji: '💥', health: 20, speed: 0.015, hostile: true },
            cow: { emoji: '🐄', health: 10, speed: 0.01, hostile: false },
            pig: { emoji: '🐷', health: 10, speed: 0.01, hostile: false },
            chicken: { emoji: '🐔', health: 4, speed: 0.015, hostile: false }
        };
        
        const mobData = mobTypes[type];
        if (!mobData) return;
        
        // Create mob mesh
        const geometry = new THREE.BoxGeometry(0.6, 1.8, 0.6);
        const material = new THREE.MeshLambertMaterial({ color: 0x8b4513 });
        const mob = new THREE.Mesh(geometry, material);
        mob.position.set(x, y, z);
        mob.castShadow = true;
        mob.receiveShadow = true;
        
        // Add mob data
        mob.userData = {
            type,
            health: mobData.health,
            maxHealth: mobData.health,
            speed: mobData.speed,
            hostile: mobData.hostile,
            target: null,
            lastMove: 0,
            direction: new THREE.Vector3(
                (Math.random() - 0.5) * 2,
                0,
                (Math.random() - 0.5) * 2
            ).normalize()
        };
        
        // Add name tag
        const canvas = document.createElement('canvas');
        canvas.width = 128;
        canvas.height = 32;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.fillRect(0, 0, 128, 32);
        ctx.fillStyle = 'white';
        ctx.font = '20px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(mobData.emoji + ' ' + type, 64, 22);
        
        const texture = new THREE.CanvasTexture(canvas);
        const spriteMaterial = new THREE.SpriteMaterial({ map: texture });
        const sprite = new THREE.Sprite(spriteMaterial);
        sprite.position.set(0, 1.2, 0);
        sprite.scale.set(1, 0.5, 1);
        mob.add(sprite);
        
        this.scene.add(mob);
        this.entities.push(mob);
    }
    
    updateEntities(delta) {
        const playerPos = this.camera.position;
        
        this.entities.forEach((entity, index) => {
            const data = entity.userData;
            
            // Update hostile mobs - move towards player
            if (data.hostile) {
                const distance = entity.position.distanceTo(playerPos);
                if (distance < 32) {
                    // Move towards player
                    const direction = new THREE.Vector3()
                        .subVectors(playerPos, entity.position)
                        .normalize();
                    entity.position.add(direction.multiplyScalar(data.speed * 1000 * delta));
                    
                    // Check if close enough to attack
                    if (distance < 2) {
                        // Attack player (reduce health, show damage)
                        console.log('Mob attacking player!');
                    }
                } else {
                    // Random movement
                    data.lastMove += delta;
                    if (data.lastMove > 2) {
                        data.direction.set(
                            (Math.random() - 0.5) * 2,
                            0,
                            (Math.random() - 0.5) * 2
                        ).normalize();
                        data.lastMove = 0;
                    }
                    entity.position.add(data.direction.multiplyScalar(data.speed * 1000 * delta));
                }
            } else {
                // Passive mobs - random movement
                data.lastMove += delta;
                if (data.lastMove > 3) {
                    data.direction.set(
                        (Math.random() - 0.5) * 2,
                        0,
                        (Math.random() - 0.5) * 2
                    ).normalize();
                    data.lastMove = 0;
                }
                entity.position.add(data.direction.multiplyScalar(data.speed * 1000 * delta));
            }
            
            // Keep mob on ground
            const groundY = this.getGroundLevel(entity.position.x, entity.position.z);
            if (entity.position.y < groundY) {
                entity.position.y = groundY;
            }
            
            // Rotate mob to face movement direction
            if (data.direction.length() > 0) {
                entity.lookAt(entity.position.clone().add(data.direction));
            }
        });
        
        // Spawn new mobs periodically
        this.mobSpawnTimer += delta * 1000;
        if (this.mobSpawnTimer > this.mobSpawnInterval) {
            this.mobSpawnTimer = 0;
            if (this.entities.length < 20) {
                const x = playerPos.x + (Math.random() - 0.5) * 30;
                const z = playerPos.z + (Math.random() - 0.5) * 30;
                const y = this.getGroundLevel(x, z) + 1;
                
                const mobTypes = ['zombie', 'creeper', 'cow', 'pig', 'chicken'];
                const randomType = mobTypes[Math.floor(Math.random() * mobTypes.length)];
                this.spawnMob(randomType, x, y, z);
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
            planks: 0xd7ccc8,
            cactus: 0x4caf50,
            glass: 0x81d4fa,
            iron_ore: 0x9e9e9e,
            coal_ore: 0x212121,
            gold_ore: 0xffd700,
            diamond_ore: 0x00bcd4,
            water: 0x2196f3,
            lava: 0xff5722,
            ice: 0xb3e5fc,
            snow: 0xffffff,
            clay: 0x8d6e63,
            wool: 0xf5f5f5
        };
        return colors[blockType] || 0xffffff;
    }
    
    getBlockTexture(blockType) {
        // For now, return null - can add textures later
        return null;
    }
    
    getBlockEmoji(blockType) {
        return this.items[blockType]?.emoji || '⬜';
    }
    
    updateHotbar() {
        const hud = document.getElementById('hud');
        hud.innerHTML = '';
        
        for (let i = 0; i < 9; i++) {
            const slot = document.createElement('div');
            slot.className = 'hotbar-slot';
            slot.dataset.index = i;
            if (i === this.selectedBlock) slot.classList.add('selected');
            
            const item = this.inventory.hotbar[i];
            if (item) {
                slot.textContent = this.items[item.item]?.emoji || '❓';
                if (item.count > 1) {
                    const count = document.createElement('span');
                    count.className = 'item-count';
                    count.textContent = item.count;
                    slot.appendChild(count);
                }
            }
            
            slot.addEventListener('click', () => this.selectHotbarSlot(i));
            hud.appendChild(slot);
        }
    }
    
    updateInventory() {
        const grid = document.getElementById('inventory-grid');
        grid.innerHTML = '';
        
        // Hotbar in inventory
        for (let i = 0; i < 9; i++) {
            const slot = this.createInventorySlot(this.inventory.hotbar[i], i, 'hotbar');
            grid.appendChild(slot);
        }
        
        // Main inventory
        for (let i = 0; i < 27; i++) {
            const slot = this.createInventorySlot(this.inventory.main[i], i, 'main');
            grid.appendChild(slot);
        }
    }
    
    createInventorySlot(item, index, type) {
        const slot = document.createElement('div');
        slot.className = 'inventory-slot';
        slot.dataset.index = index;
        slot.dataset.type = type;
        
        if (item) {
            slot.textContent = this.items[item.item]?.emoji || '❓';
            if (item.count > 1) {
                const count = document.createElement('span');
                count.className = 'item-count';
                count.textContent = item.count;
                slot.appendChild(count);
            }
        }
        
        slot.addEventListener('click', () => this.handleInventoryClick(index, type));
        return slot;
    }
    
    setupCraftingGrid() {
        const grid = document.getElementById('crafting-grid');
        grid.innerHTML = '';
        
        for (let i = 0; i < 9; i++) {
            const slot = document.createElement('div');
            slot.className = 'crafting-slot';
            slot.dataset.index = i;
            
            const item = this.inventory.crafting[i];
            if (item) {
                slot.textContent = this.items[item.item]?.emoji || '❓';
            }
            
            slot.addEventListener('click', () => this.handleCraftingClick(i));
            grid.appendChild(slot);
        }
        
        // Crafting result slot
        const resultSlot = document.getElementById('crafting-result');
        resultSlot.addEventListener('click', () => this.craftItem());
        this.updateCraftingResult();
    }
    
    handleInventoryClick(index, type) {
        // Simple click to move items (can be enhanced with drag-drop)
        const inventory = type === 'hotbar' ? this.inventory.hotbar : this.inventory.main;
        const item = inventory[index];
        
        // For now, just select if it's in hotbar
        if (type === 'hotbar') {
            this.selectHotbarSlot(index);
        }
    }
    
    handleCraftingClick(index) {
        // Move item from inventory to crafting grid
        // Find first available item in inventory
        let sourceItem = null;
        let sourceIndex = -1;
        let sourceType = null;
        
        // Check hotbar first
        for (let i = 0; i < 9; i++) {
            if (this.inventory.hotbar[i] && !this.inventory.crafting[index]) {
                sourceItem = this.inventory.hotbar[i];
                sourceIndex = i;
                sourceType = 'hotbar';
                break;
            }
        }
        
        // Check main inventory
        if (!sourceItem) {
            for (let i = 0; i < 27; i++) {
                if (this.inventory.main[i] && !this.inventory.crafting[index]) {
                    sourceItem = this.inventory.main[i];
                    sourceIndex = i;
                    sourceType = 'main';
                    break;
                }
            }
        }
        
        if (sourceItem) {
            this.inventory.crafting[index] = { ...sourceItem, count: 1 };
            sourceItem.count--;
            if (sourceItem.count <= 0) {
                if (sourceType === 'hotbar') {
                    this.inventory.hotbar[sourceIndex] = null;
                } else {
                    this.inventory.main[sourceIndex] = null;
                }
            }
            this.updateInventory();
            this.updateCraftingGrid();
            this.updateCraftingResult();
        } else if (this.inventory.crafting[index]) {
            // Remove from crafting grid
            this.addItemToInventory(this.inventory.crafting[index].item, 1);
            this.inventory.crafting[index] = null;
            this.updateCraftingGrid();
            this.updateCraftingResult();
        }
    }
    
    updateCraftingGrid() {
        const grid = document.getElementById('crafting-grid');
        const slots = grid.querySelectorAll('.crafting-slot');
        slots.forEach((slot, index) => {
            const item = this.inventory.crafting[index];
            slot.textContent = item ? (this.items[item.item]?.emoji || '❓') : '';
        });
    }
    
    updateCraftingResult() {
        const resultSlot = document.getElementById('crafting-result');
        const recipe = this.checkCraftingRecipe();
        
        if (recipe) {
            resultSlot.textContent = this.items[recipe.item]?.emoji || '❓';
            resultSlot.dataset.result = recipe.item;
            resultSlot.dataset.count = recipe.count;
        } else {
            resultSlot.textContent = '';
            resultSlot.dataset.result = '';
        }
    }
    
    checkCraftingRecipe() {
        // Create recipe string from crafting grid
        const recipe = this.inventory.crafting.map(slot => slot ? slot.item : '').join(',');
        return this.craftingRecipes[recipe];
    }
    
    craftItem() {
        const resultSlot = document.getElementById('crafting-result');
        const resultItem = resultSlot.dataset.result;
        
        if (resultItem) {
            const recipe = this.checkCraftingRecipe();
            if (recipe) {
                // Remove items from crafting grid
                this.inventory.crafting.forEach((slot, index) => {
                    if (slot) {
                        slot.count--;
                        if (slot.count <= 0) {
                            this.inventory.crafting[index] = null;
                        }
                    }
                });
                
                // Add crafted item to inventory
                this.addItemToInventory(recipe.item, recipe.count);
                
                this.updateCraftingGrid();
                this.updateCraftingResult();
                this.updateInventory();
                this.updateHotbar();
            }
        }
    }
    
    addItemToInventory(item, count) {
        // Try to add to existing stack in hotbar
        for (let i = 0; i < 9; i++) {
            if (this.inventory.hotbar[i] && this.inventory.hotbar[i].item === item) {
                this.inventory.hotbar[i].count += count;
                this.updateHotbar();
                return;
            }
        }
        
        // Try to add to empty hotbar slot
        for (let i = 0; i < 9; i++) {
            if (!this.inventory.hotbar[i]) {
                this.inventory.hotbar[i] = { item, count };
                this.updateHotbar();
                return;
            }
        }
        
        // Try to add to existing stack in main inventory
        for (let i = 0; i < 27; i++) {
            if (this.inventory.main[i] && this.inventory.main[i].item === item) {
                this.inventory.main[i].count += count;
                this.updateInventory();
                return;
            }
        }
        
        // Try to add to empty main inventory slot
        for (let i = 0; i < 27; i++) {
            if (!this.inventory.main[i]) {
                this.inventory.main[i] = { item, count };
                this.updateInventory();
                return;
            }
        }
    }
    
    selectHotbarSlot(index) {
        document.querySelectorAll('.hotbar-slot').forEach(slot => {
            slot.classList.remove('selected');
        });
        const slot = document.querySelector(`[data-index="${index}"].hotbar-slot`);
        if (slot) {
            slot.classList.add('selected');
        }
        this.selectedBlock = index;
    }
    
    toggleInventory() {
        const inventory = document.getElementById('inventory');
        inventory.classList.toggle('active');
        
        if (inventory.classList.contains('active')) {
            this.controls.unlock();
            this.updateInventory();
        } else {
            this.requestPointerLock();
        }
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
            case 'KeyE': 
                if (!document.getElementById('inventory').classList.contains('active')) {
                    this.toggleInventory();
                }
                break;
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
            const { x, y, z, blockType } = block.userData;
            
            // Add item to inventory when breaking block (Survival mode)
            if (this.gameMode === 'survival' || this.gameMode === 'adventure') {
                this.addItemToInventory(blockType, 1);
            }
            
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
            
            // Get block type from selected hotbar slot
            const hotbarItem = this.inventory.hotbar[this.selectedBlock];
            if (!hotbarItem && this.gameMode !== 'creative') {
                return; // No item in slot
            }
            
            const blockType = hotbarItem ? hotbarItem.item : this.hotbarItems[this.selectedBlock];
            
            const newX = Math.round(intersect.point.x + normal.x * 0.5);
            const newY = Math.round(intersect.point.y + normal.y * 0.5);
            const newZ = Math.round(intersect.point.z + normal.z * 0.5);
            
            // Don't place block if player is inside it
            const playerPos = this.camera.position;
            if (Math.abs(newX - playerPos.x) > 0.5 || 
                Math.abs(newY - playerPos.y) > 1.5 || 
                Math.abs(newZ - playerPos.z) > 0.5) {
                
                // Consume item in survival mode
                if (this.gameMode === 'survival' && hotbarItem) {
                    hotbarItem.count--;
                    if (hotbarItem.count <= 0) {
                        this.inventory.hotbar[this.selectedBlock] = null;
                    }
                    this.updateHotbar();
                }
                
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
    
    updateDayNightCycle(delta) {
        this.timeOfDay += (delta * 1000) / this.dayLength;
        if (this.timeOfDay >= 1) this.timeOfDay -= 1;
        
        // Calculate sun position (circular motion)
        const angle = this.timeOfDay * Math.PI * 2;
        const sunDistance = 200;
        const sunHeight = Math.sin(angle) * sunDistance;
        const sunX = Math.cos(angle) * sunDistance;
        const sunZ = Math.sin(angle * 0.5) * sunDistance;
        
        this.sunLight.position.set(sunX, sunHeight, sunZ);
        this.moonLight.position.set(-sunX, -sunHeight, -sunZ);
        
        // Adjust lighting intensity based on time
        const dayFactor = Math.max(0, Math.sin(angle));
        this.sunLight.intensity = dayFactor * 0.8;
        this.ambientLight.intensity = 0.3 + dayFactor * 0.3;
        this.moonLight.intensity = (1 - dayFactor) * 0.3;
        
        // Adjust sky color
        const skyColor = new THREE.Color();
        if (dayFactor > 0.5) {
            // Day
            skyColor.setRGB(0.53, 0.81, 0.92); // Sky blue
        } else if (dayFactor > 0) {
            // Dawn/Dusk
            skyColor.setRGB(1.0, 0.5, 0.3); // Orange
        } else {
            // Night
            skyColor.setRGB(0.05, 0.05, 0.15); // Dark blue
        }
        this.scene.background = skyColor;
        this.scene.fog.color = skyColor;
    }
    
    animate() {
        requestAnimationFrame(() => this.animate());
        
        const time = performance.now();
        const delta = (time - this.prevTime) / 1000;
        this.prevTime = time;
        
        this.updateMovement(delta);
        this.updateEntities(delta);
        this.updateDayNightCycle(delta);
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

