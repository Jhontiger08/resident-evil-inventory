document.addEventListener('DOMContentLoaded', function () {
    // --- VALIDAÇÃO INICIAL ---
    if (typeof firebase === 'undefined') {
        document.body.innerHTML = '<h1>ERRO CRÍTICO: Firebase não foi carregado.</h1>';
        return;
    }

    // --- CONFIGURAÇÃO E INICIALIZAÇÃO DO FIREBASE ---
    const firebaseConfig = {
        apiKey: "AIzaSyAKUKEyV3iS8QCQpdjtHhDdbiySy2e9RZY",
        authDomain: "rpgterror-90630.firebaseapp.com",
        projectId: "rpgterror-90630",
        storageBucket: "rpgterror-90630.appspot.com",
        messagingSenderId: "569459851763",
        appId: "1:569459851763:web:302afb88d253d14ab25286",
    };
    firebase.initializeApp(firebaseConfig);
    const db = firebase.firestore();
    const auth = firebase.auth();

    const currentCampaignId = new URLSearchParams(window.location.search).get('campaign');
    if (!currentCampaignId) {
        window.location.href = 'campaign.html';
        return;
    }

    // --- REFERÊNCIAS DO FIRESTORE ---
    const campaignRef = db.collection('campaigns').doc(currentCampaignId);
    const playersRef = campaignRef.collection('players');
    const itemsRef = campaignRef.collection('items');
    const enemiesRef = campaignRef.collection('enemies');
    const eventsRef = campaignRef.collection('events');
    const mapsRef = campaignRef.collection('maps');
    const mapStateRef = campaignRef.collection('mapState').doc('current');

    // --- REFERÊNCIAS DA UI ---
    const ui = {
        notificationContainer: document.getElementById('notification-container'),
        campaignTitle: document.getElementById('campaignTitle'),
        campaignCode: document.getElementById('campaignCode').querySelector('span'),
        copyCodeBtn: document.getElementById('copyCode'),
        saveNotesBtn: document.getElementById('saveNotesBtn'),
        endSessionBtn: document.getElementById('endSessionBtn'),
        masterLogoutBtn: document.getElementById('masterLogoutBtn'),
        playerList: document.getElementById('playerList'),
        playerCount: document.getElementById('playerCount'),
        addNpcBtn: document.getElementById('addNpcBtn'),
        tabs: document.querySelectorAll('.tab-btn'),
        tabContents: document.querySelectorAll('.tab-content'),
        masterNotes: document.getElementById('masterNotes'),
        masterItemList: document.getElementById('masterItemList'),
        addItemBtn: document.getElementById('addItemBtn'),
        itemModal: document.getElementById('itemModal'),
        itemForm: document.getElementById('itemForm'),
        enemyList: document.getElementById('enemyList'),
        addEnemyBtn: document.getElementById('addEnemyBtn'),
        enemyModal: document.getElementById('enemyModal'),
        enemyForm: document.getElementById('enemyForm'),
        fogOfWarCanvas: document.getElementById('fogOfWarCanvas'),
        masterMap: document.getElementById('masterMap'),
        clearMapBtn: document.getElementById('clearMapBtn'),
        diceBtns: document.querySelectorAll('.dice-btn'),
        masterChat: document.querySelector('.master-chat'),
        masterChatMessages: document.getElementById('masterChatMessages'),
        masterChatInput: document.getElementById('masterChatInput'),
        sendMasterMsgBtn: document.getElementById('sendMasterMsgBtn'),
        toggleChatBtn: document.getElementById('toggleChatBtn'), // Referência reativada
        confirmModal: document.getElementById('confirmModal'),
        playerActionModal: document.getElementById('playerActionModal'),
        mapNameInput: document.getElementById('mapNameInput'),
        mapUrlInput: document.getElementById('mapUrlInput'),
        addMapBtn: document.getElementById('addMapBtn'),
        mapList: document.getElementById('mapList'),
    };
    
    // --- ESTADO DA APLICAÇÃO ---
    let appState = { players: [], items: [], enemies: [], maps: [], currentUser: null, masterInfo: {}, activeMapId: null, campaignMaxPlayers: 6, map: { ctx: null, revealedAreas: [] } };

    // --- FUNÇÕES DE FEEDBACK VISUAL ---
    const showNotification = (message, type = 'info') => {
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.textContent = message;
        ui.notificationContainer.appendChild(notification);
        setTimeout(() => notification.remove(), 4000);
    };

    const showConfirmation = (title, text) => {
        return new Promise((resolve) => {
            ui.confirmModal.querySelector('#confirmModalTitle').textContent = title;
            ui.confirmModal.querySelector('#confirmModalText').textContent = text;
            ui.confirmModal.style.display = 'block';
            ui.confirmModal.querySelector('#confirmBtn').onclick = () => { ui.confirmModal.style.display = 'none'; resolve(true); };
            ui.confirmModal.querySelector('#cancelBtn').onclick = () => { ui.confirmModal.style.display = 'none'; resolve(false); };
        });
    };

    // --- FUNÇÕES DE RENDERIZAÇÃO ---
    const renderPlayers = () => {
        ui.playerList.innerHTML = appState.players.length === 0 ? '<div class="empty-placeholder">Nenhum jogador conectado</div>' : '';
        appState.players.forEach(player => {
            const p = document.createElement('div');
            p.className = `player-item ${player.type === 'npc' ? 'npc-player' : ''}`;
            p.dataset.playerId = player.id;
            const health = player.health || 0;
            const maxHealth = player.maxHealth || 1;
            const healthPercent = (health / maxHealth) * 100;
            let healthClass = 'health-red';
            if (healthPercent > 60) healthClass = 'health-green';
            else if (healthPercent > 30) healthClass = 'health-yellow';

            p.innerHTML = `
                <h3>${player.name} <span>${health}/${maxHealth}</span></h3>
                <p>${player.type === 'npc' ? 'NPC' : 'Jogador'}</p>
                <div class="player-health"><progress class="${healthClass}" value="${health}" max="${maxHealth}"></progress></div>
            `;
            p.addEventListener('click', () => openPlayerActionModal(player));
            ui.playerList.appendChild(p);
        });
        const actualPlayers = appState.players.filter(p => p.type !== 'npc');
        ui.playerCount.textContent = `(${actualPlayers.length}/${appState.campaignMaxPlayers || 'N/A'})`;
    };
    
    const renderGenericList = (list, container, renderFunc) => {
        container.innerHTML = list.length === 0 ? `<div class="empty-placeholder">Nenhum registro encontrado.</div>` : '';
        list.forEach(item => renderFunc(item, container));
    };
    
    const renderItemCard = (item, container) => {
        const card = document.createElement('div');
        card.className = 'item-card';
        card.innerHTML = `
            <button class="delete-btn" data-id="${item.id}" title="Excluir Item">&times;</button>
            <div class="card-content-wrapper" data-entity-id="${item.id}">
                <div class="card-header">
                    ${item.image ? `<img src="${item.image}" alt="${item.name}" class="card-image">` : ''}
                    <div class="card-title"><h3>${item.name}</h3><span class="item-type">${item.type}</span></div>
                </div>
                <p>${item.description || 'Sem descrição.'}</p>
            </div>
        `;
        container.appendChild(card);
    };

    const renderEnemyCard = (enemy, container) => {
        const card = document.createElement('div');
        card.className = 'enemy-card';
        card.innerHTML = `
            <button class="delete-btn" data-id="${enemy.id}" title="Excluir Inimigo">&times;</button>
            <div class="card-content-wrapper" data-entity-id="${enemy.id}">
                <div class="card-header">
                    ${enemy.image ? `<img src="${enemy.image}" alt="${enemy.name}" class="card-image">` : ''}
                    <div class="card-title"><h3>${enemy.name}</h3></div>
                </div>
                <p class="stats">Vida: ${enemy.health} | Dano: ${enemy.damage || 'N/A'}</p>
                <p>${enemy.behavior || 'Sem comportamento.'}</p>
            </div>
        `;
        container.appendChild(card);
    };

    const renderMapList = () => {
        ui.mapList.innerHTML = '';
        appState.maps.forEach(map => {
            const mapItem = document.createElement('div');
            mapItem.className = 'map-list-item';
            if (appState.activeMapId === map.id) {
                mapItem.classList.add('active');
                if (ui.masterMap.src !== map.url) ui.masterMap.src = map.url;
            }
            mapItem.innerHTML = `
                <span class="map-name" data-id="${map.id}">${map.name}</span>
                <button class="delete-btn" data-id="${map.id}" title="Excluir Mapa">&times;</button>
            `;
            ui.mapList.appendChild(mapItem);
        });
    };

    const renderChatMessage = (msg) => {
        const messageDiv = document.createElement('div');
        messageDiv.className = 'chat-message';
        if(msg.senderId === appState.currentUser.uid) messageDiv.classList.add('own-message');
        
        messageDiv.innerHTML = `
            <div class="sender-info">
                <span class="sender">${msg.senderName}</span>
                <span class="time">${msg.timestamp ? msg.timestamp.toDate().toLocaleTimeString() : ''}</span>
            </div>
            <div class="text">${msg.text}</div>
        `;
        ui.masterChatMessages.prepend(messageDiv);
    };

    // --- LÓGICA DE MODAIS ---
    const openModal = (modalId, data = {}) => {
        const modal = document.getElementById(modalId);
        if(!modal) return;
        const form = modal.querySelector('form');
        if(form) form.reset();
        
        const entityName = modalId.replace('Modal', '');
        modal.querySelector('h2').textContent = data.id ? `Editar ${entityName.charAt(0).toUpperCase() + entityName.slice(1)}` : `Criar Novo ${entityName.charAt(0).toUpperCase() + entityName.slice(1)}`;
        if(form) form.querySelector('input[type="hidden"]').value = data.id || '';
        
        if(form) {
            for(const element of form.elements) {
                const fieldName = element.id.replace(entityName, '').toLowerCase();
                if(data[fieldName] !== undefined) {
                    element.value = data[fieldName];
                }
            }
        }

        if (modalId === 'itemModal') {
            updateItemSpecificFields(data.type || 'misc', data);
        }
        modal.style.display = 'block';
    };
    
    const closeModal = (modalId) => { 
        const modal = document.getElementById(modalId);
        if(modal) modal.style.display = 'none'; 
    };

    function updateItemSpecificFields(type, data = {}) {
        const container = document.getElementById('item-specific-fields');
        container.innerHTML = '';
        if (type === 'healing') {
            container.innerHTML = `<div class="form-group"><label for="itemHealAmount">Quantidade de Cura:</label><input type="number" id="itemHealAmount" value="${data.healAmount || 0}"></div>`;
        } else if (type === 'weapon') {
            container.innerHTML = `<div class="form-group"><label for="itemAmmoCount">Munição:</label><input type="number" id="itemAmmoCount" value="${data.ammoCount || 0}"></div>`;
        } else if (type === 'document') {
            container.innerHTML = `<div class="form-group"><label for="itemDocumentContent">Conteúdo do Documento:</label><textarea id="itemDocumentContent">${data.content || ''}</textarea></div>`;
        }
    }
    
    const openPlayerActionModal = (player) => {
        const modal = ui.playerActionModal;
        modal.querySelector('#playerActionTitle').textContent = `Ações para: ${player.name}`;
        modal.querySelector('#playerActionTargetId').value = player.id;
        modal.querySelector('#playerActionHealth').value = player.health || 0;
        modal.querySelector('#playerActionMaxHealth').value = player.maxHealth || 0;

        const itemSelect = modal.querySelector('#playerActionItemSelect');
        itemSelect.innerHTML = '<option value="">Selecione um item...</option>';
        appState.items.forEach(item => itemSelect.innerHTML += `<option value="${item.id}">${item.name}</option>`);
        
        modal.style.display = 'block';
    };

    // --- LÓGICA DE INTERAÇÃO COM FIRESTORE ---
    const handleDelete = async (collectionName, docId, entityName) => {
        const confirmed = await showConfirmation(`Excluir ${entityName}`, `Tem certeza que deseja excluir? Esta ação não pode ser desfeita.`);
        if(confirmed) {
            campaignRef.collection(collectionName).doc(docId).delete()
                .then(() => showNotification(`${entityName} excluído com sucesso.`, 'success'))
                .catch(err => showNotification(`Erro ao excluir: ${err.message}`, 'error'));
        }
    };

    const handleUpdatePlayerHealth = () => {
        const playerId = document.getElementById('playerActionTargetId').value;
        const health = parseInt(document.getElementById('playerActionHealth').value);
        const maxHealth = parseInt(document.getElementById('playerActionMaxHealth').value);
        if (isNaN(health) || isNaN(maxHealth)) return showNotification("Valores de vida inválidos.", "error");
        
        playersRef.doc(playerId).update({ health, maxHealth })
            .then(() => showNotification("Vida do jogador atualizada.", "success"))
            .catch(err => showNotification(`Erro: ${err.message}`, "error"));
    };

    const handleSendItemToPlayer = async () => {
        const playerId = document.getElementById('playerActionTargetId').value;
        const itemId = document.getElementById('playerActionItemSelect').value;
        if (!itemId) return showNotification("Selecione um item.", "error");

        const item = appState.items.find(i => i.id === itemId);
        const player = appState.players.find(p => p.id === playerId);

        const playerDoc = await playersRef.doc(playerId).get();
        if (!playerDoc.exists) return showNotification("Jogador não encontrado.", "error");

        const playerData = playerDoc.data();
        const inventory = playerData.inventory || Array(8).fill(null);
        const emptySlotIndex = inventory.findIndex(slot => slot === null);

        if (emptySlotIndex === -1) {
            return showNotification(`Inventário de ${player.name} está cheio!`, 'error');
        }

        inventory[emptySlotIndex] = item;
        
        await playersRef.doc(playerId).update({ inventory: inventory });
        
        eventsRef.add({
            type: 'item_received',
            recipientId: player.id,
            item: item,
            timestamp: firebase.firestore.FieldValue.serverTimestamp(),
            text: `${appState.masterInfo.name || 'Mestre'} enviou ${item.name} para ${player.name}.`
        }).then(() => {
            showNotification(`Item enviado para ${player.name}.`, 'success');
            closeModal('playerActionModal');
        });
    };

    const handleFormSubmit = (e) => {
        e.preventDefault();
        const form = e.target;
        const id = form.querySelector('input[type="hidden"]').value;
        let data, collection, entityName;

        if (form.id === 'itemForm') {
            entityName = 'Item';
            collection = itemsRef;
            data = {
                name: form.itemName.value,
                image: form.itemImage.value,
                type: form.itemType.value,
                description: form.itemDescription.value,
            };
            if (data.type === 'healing') data.healAmount = parseInt(form.itemHealAmount.value) || 0;
            if (data.type === 'weapon') data.ammoCount = parseInt(form.itemAmmoCount.value) || 0;
            if (data.type === 'document') data.content = form.itemDocumentContent.value || '';

        } else if (form.id === 'enemyForm') {
            entityName = 'Inimigo';
            collection = enemiesRef;
            data = {
                name: form.enemyName.value,
                image: form.enemyImage.value,
                health: parseInt(form.enemyHealth.value),
                damage: form.enemyDamage.value,
                behavior: form.enemyBehavior.value,
            };
        }

        const promise = id ? collection.doc(id).update(data) : collection.add({ ...data, createdAt: firebase.firestore.FieldValue.serverTimestamp() });
        promise.then(() => {
            showNotification(`${entityName} ${id ? 'atualizado' : 'criado'}!`, 'success');
            closeModal(`${entityName.toLowerCase()}Modal`);
        }).catch(err => showNotification(`Erro: ${err.message}`, 'error'));
    };

    // --- LÓGICA DO MAPA ---
    const setupMap = () => {
        const canvas = ui.fogOfWarCanvas;
        const mapImage = ui.masterMap;
        if(!canvas || !mapImage) return;
        appState.map.ctx = canvas.getContext('2d');
        const resizeCanvas = () => {
            canvas.width = mapImage.clientWidth;
            canvas.height = mapImage.clientHeight;
            drawRevealedAreas();
        };
        mapImage.onload = resizeCanvas;
        window.addEventListener('resize', resizeCanvas);
        if (mapImage.complete) resizeCanvas();

        let isDrawing = false;
        let startX, startY;
        canvas.addEventListener('mousedown', (e) => { isDrawing = true; startX = e.offsetX; startY = e.offsetY; });
        canvas.addEventListener('mouseup', (e) => {
            if (!isDrawing) return;
            isDrawing = false;
            const newArea = {
                x: startX / canvas.width, y: startY / canvas.height,
                w: (e.offsetX - startX) / canvas.width, h: (e.offsetY - startY) / canvas.height,
            };
            mapStateRef.set({ revealed: firebase.firestore.FieldValue.arrayUnion(newArea) }, { merge: true });
        });
    };

    const drawRevealedAreas = () => {
        const { ctx, revealedAreas } = appState.map;
        if(!ctx) return;
        const canvas = ui.fogOfWarCanvas;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        if (revealedAreas && revealedAreas.length > 0) {
            ctx.globalCompositeOperation = 'destination-out';
            revealedAreas.forEach(area => {
                ctx.fillRect(area.x * canvas.width, area.y * canvas.height, area.w * canvas.width, area.h * canvas.height);
            });
            ctx.globalCompositeOperation = 'source-over';
        }
    };

    // --- SETUP DE LISTENERS DA APLICAÇÃO ---
    const setupRealtimeListeners = () => {
        auth.onAuthStateChanged(user => {
            if (user) {
                appState.currentUser = user;
                loadInitialData();
            } else { window.location.href = 'index.html'; }
        });
    };

    const loadInitialData = () => {
        campaignRef.onSnapshot(doc => {
            if (doc.exists) {
                const data = doc.data();
                appState.campaignMaxPlayers = data.maxPlayers;
                appState.masterInfo = { id: data.masterId, name: data.masterName };
                appState.activeMapId = data.activeMapId;
                ui.campaignTitle.textContent = data.name;
                ui.campaignCode.textContent = data.code;
                ui.masterNotes.value = data.masterNotes || '';
                renderMapList();
            } else {
                alert("Campanha não encontrada ou foi encerrada.");
                window.location.href = 'campaign.html';
            }
        });
        
        playersRef.orderBy('name').onSnapshot(snap => {
            appState.players = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            renderPlayers();
        });
        itemsRef.orderBy('name').onSnapshot(snap => {
            appState.items = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            renderGenericList(appState.items, ui.masterItemList, renderItemCard);
        });
        enemiesRef.orderBy('name').onSnapshot(snap => {
            appState.enemies = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            renderGenericList(appState.enemies, ui.enemyList, renderEnemyCard);
        });
        mapsRef.orderBy('name').onSnapshot(snap => {
            appState.maps = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            renderMapList();
        });
        mapStateRef.onSnapshot(doc => {
            appState.map.revealedAreas = doc.exists && doc.data().revealed ? doc.data().revealed : [];
            drawRevealedAreas();
        });
        eventsRef.orderBy('timestamp', 'desc').limit(50).onSnapshot(snapshot => {
            ui.masterChatMessages.innerHTML = '';
            const docs = snapshot.docs.reverse();
            docs.forEach(doc => {
                const eventData = doc.data();
                if (eventData.type === 'chat' || eventData.type === 'dice_roll') {
                    renderChatMessage(eventData);
                }
            });
        });
    };

    const setupUIEvents = () => {
        ui.copyCodeBtn.addEventListener('click', () => navigator.clipboard.writeText(ui.campaignCode.textContent).then(() => showNotification('Código copiado!', 'success')));
        ui.saveNotesBtn.addEventListener('click', () => campaignRef.update({ masterNotes: ui.masterNotes.value }).then(() => showNotification('Anotações salvas.', 'success')));
        ui.endSessionBtn.addEventListener('click', async () => { if (await showConfirmation('Encerrar Sessão', 'Isso desconectará todos os jogadores. Deseja continuar?')) { campaignRef.update({ active: false }).then(() => window.location.href = 'campaign.html'); } });
        ui.masterLogoutBtn.addEventListener('click', () => auth.signOut());
        
        ui.tabs.forEach(btn => btn.addEventListener('click', (e) => {
            ui.tabs.forEach(t => t.classList.remove('active'));
            ui.tabContents.forEach(c => c.classList.remove('active'));
            e.currentTarget.classList.add('active');
            document.getElementById(`${e.currentTarget.dataset.tab}Tab`).classList.add('active');
        }));
        
        document.querySelectorAll('.close-modal').forEach(btn => btn.addEventListener('click', (e) => closeModal(e.target.closest('.master-modal').id)));
        ui.addItemBtn.addEventListener('click', () => openModal('itemModal'));
        ui.addEnemyBtn.addEventListener('click', () => openModal('enemyModal'));
        ui.itemForm.addEventListener('submit', handleFormSubmit);
        ui.enemyForm.addEventListener('submit', handleFormSubmit);
        document.getElementById('itemType').addEventListener('change', (e) => updateItemSpecificFields(e.target.value));
        
        document.getElementById('playerActionUpdateHealthBtn').addEventListener('click', handleUpdatePlayerHealth);
        document.getElementById('playerActionSendItemBtn').addEventListener('click', handleSendItemToPlayer);
        
        ui.addNpcBtn.addEventListener('click', () => {
            const name = prompt('Nome do NPC:');
            if (name) playersRef.add({ name, type: 'npc', health: 10, maxHealth: 10, createdAt: firebase.firestore.FieldValue.serverTimestamp() });
        });
        
        // --- DELEGAÇÃO DE EVENTOS PARA EXCLUSÃO E EDIÇÃO ---
        ui.masterItemList.addEventListener('click', e => {
            const target = e.target;
            const card = target.closest('.item-card');
            if (target.classList.contains('delete-btn')) {
                handleDelete('items', target.dataset.id, 'Item');
            } else if (card) {
                const entityId = card.querySelector('[data-entity-id]').dataset.entityId;
                const itemData = appState.items.find(i => i.id === entityId);
                if (itemData) openModal('itemModal', itemData);
            }
        });

        ui.enemyList.addEventListener('click', e => {
            const target = e.target;
            const card = target.closest('.enemy-card');
            if (target.classList.contains('delete-btn')) {
                handleDelete('enemies', target.dataset.id, 'Inimigo');
            } else if (card) {
                const entityId = card.querySelector('[data-entity-id]').dataset.entityId;
                const enemyData = appState.enemies.find(en => en.id === entityId);
                if (enemyData) openModal('enemyModal', enemyData);
            }
        });
        
        ui.mapList.addEventListener('click', e => {
            const target = e.target;
            if (target.classList.contains('delete-btn')) {
                handleDelete('maps', target.dataset.id, 'Mapa');
            } else if (target.classList.contains('map-name')) {
                campaignRef.update({ activeMapId: target.dataset.id });
            }
        });

        ui.addMapBtn.addEventListener('click', () => {
            const name = ui.mapNameInput.value.trim();
            const url = ui.mapUrlInput.value.trim();
            if (name && url) {
                mapsRef.add({ name, url }).then(() => {
                    showNotification('Mapa adicionado!', 'success');
                    ui.mapNameInput.value = ''; ui.mapUrlInput.value = '';
                }).catch(err => showNotification(`Erro: ${err.message}`, 'error'));
            } else {
                showNotification('Preencha o nome e a URL do mapa.', 'error');
            }
        });
        ui.clearMapBtn.addEventListener('click', async () => { if (await showConfirmation('Limpar Mapa', 'Isso removerá todas as áreas reveladas. Certeza?')) { mapStateRef.set({ revealed: [] }); } });

        ui.diceBtns.forEach(btn => btn.addEventListener('click', (e) => {
            const sides = parseInt(e.target.dataset.sides);
            const result = Math.floor(Math.random() * sides) + 1;
            const rollText = `(Mestre) rolou d${sides}: ${result}`;
            
            eventsRef.add({ type: 'dice_roll', senderId: appState.currentUser.uid, senderName: appState.masterInfo.name || 'Mestre', text: rollText, timestamp: firebase.firestore.FieldValue.serverTimestamp() })
                .then(() => showNotification('Rolagem enviada para o chat!', 'info'));
        }));

        const sendChatMessage = () => {
            const text = ui.masterChatInput.value.trim();
            if (!text) return;
            eventsRef.add({ type: 'chat', senderId: appState.currentUser.uid, senderName: appState.masterInfo.name || 'Mestre', text: text, timestamp: firebase.firestore.FieldValue.serverTimestamp() });
            ui.masterChatInput.value = '';
        };
        ui.sendMasterMsgBtn.addEventListener('click', sendChatMessage);
        ui.masterChatInput.addEventListener('keypress', (e) => { if(e.key === 'Enter') sendChatMessage(); });
        
        // Listener para o botão do chat reativado
        if (ui.toggleChatBtn) {
            ui.toggleChatBtn.addEventListener('click', () => {
                ui.masterChat.classList.toggle('collapsed');
            });
        }
    };

    // --- INICIALIZAÇÃO DA APLICAÇÃO ---
    setupRealtimeListeners();
    setupUIEvents();
    setupMap();
});