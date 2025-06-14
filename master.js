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
    const initiativeRef = campaignRef.collection('initiative'); // NOVA REFERÊNCIA

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
        npcList: document.getElementById('npcList'), // NOVO
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
        toggleFogOfWar: document.getElementById('toggleFogOfWar'), // NOVO
        masterMap: document.getElementById('masterMap'),
        diceBtns: document.querySelectorAll('.dice-btn'),
        diceQuantityInput: document.getElementById('diceQuantityInput'),
        masterChat: document.querySelector('.master-chat'),
        masterChatMessages: document.getElementById('masterChatMessages'),
        masterChatInput: document.getElementById('masterChatInput'),
        sendMasterMsgBtn: document.getElementById('sendMasterMsgBtn'),
        toggleChatBtn: document.getElementById('toggleChatBtn'),
        confirmModal: document.getElementById('confirmModal'),
        playerActionModal: document.getElementById('playerActionModal'),
        mapNameInput: document.getElementById('mapNameInput'),
        mapUrlInput: document.getElementById('mapUrlInput'),
        addMapBtn: document.getElementById('addMapBtn'),
        mapList: document.getElementById('mapList'),
        playerActionKickBtn: document.getElementById('playerActionKickBtn'),
        npcModal: document.getElementById('npcModal'), // NOVO
        npcForm: document.getElementById('npcForm'), // NOVO
        generateRandomNpcStatsBtn: document.getElementById('generateRandomNpcStatsBtn'), // NOVO
        initiativeList: document.getElementById('initiativeList'), // NOVO
        getInitiativeFromAllBtn: document.getElementById('getInitiativeFromAllBtn'), // NOVO
        nextInitiativeBtn: document.getElementById('nextInitiativeBtn'), // NOVO
        clearInitiativeBtn: document.getElementById('clearInitiativeBtn'), // NOVO
    };

    // --- ESTADO DA APLICAÇÃO ---
    let appState = {
        players: [],
        npcs: [], // NOVO
        items: [],
        enemies: [],
        maps: [],
        initiativeList: [], // NOVO
        currentUser: null,
        masterInfo: {},
        activeMapId: null,
        campaignMaxPlayers: 6,
        map: {
            ctx: null,
            fogIsActive: true
        } // Fim do 'map'
    };

    // --- FUNÇÕES DE FEEDBACK VISUAL ---
    const showNotification = (message, type = 'info') => {
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.textContent = message;
        ui.notificationContainer.appendChild(notification);
        setTimeout(() => notification.remove(), 4000);
    };

    const handleUseItem = async (characterId, itemIndex) => {
        const characterDocRef = playersRef.doc(characterId);
        
        try {
            await db.runTransaction(async (transaction) => {
                const charDoc = await transaction.get(characterDocRef);
                if (!charDoc.exists) { throw "Personagem não encontrado!"; }
                
                const charData = charDoc.data();
                const inventory = charData.inventory || [];
                const item = inventory[itemIndex];

                if (!item || item.type !== 'healing') {
                    showNotification('Este item não pode ser usado para curar.', 'error');
                    return;
                }

                // Aplica a cura
                const newHealth = Math.min(charData.maxHealth, charData.health + item.healAmount);
                transaction.update(characterDocRef, { health: newHealth });
                
                // Remove o item do inventário
                inventory.splice(itemIndex, 1);
                // Preenche o final para manter o tamanho 8
                while (inventory.length < 8) {
                    inventory.push(null);
                }
                transaction.update(characterDocRef, { inventory: inventory });
                showNotification(`${charData.name} usou ${item.name} e recuperou vida.`, 'success');
            });
        } catch (error) {
            showNotification(`Erro ao usar item: ${error}`, 'error');
        }
    };

    const handleTransferItem = async (sourceCharacterId, itemIndex) => {
        // Cria uma lista de possíveis alvos
        const targets = [...appState.players, ...appState.npcs].filter(p => p.id !== sourceCharacterId);
        if (targets.length === 0) {
            showNotification('Não há outros personagens para transferir o item.', 'info');
            return;
        }

        let optionsHtml = '<option value="">Selecione um alvo...</option>';
        targets.forEach(t => optionsHtml += `<option value="${t.id}">${t.name}</option>`);

        // Usa um modal de confirmação com um select
        const targetId = await new Promise(resolve => {
            const modal = ui.confirmModal;
            modal.querySelector('#confirmModalTitle').textContent = 'Transferir Item';
            modal.querySelector('#confirmModalText').innerHTML = `Para quem você deseja transferir este item?<br><select id="transferTargetSelect" class="form-group" style="width:100%; margin-top:1rem;">${optionsHtml}</select>`;
            modal.style.display = 'block';
            modal.querySelector('#confirmBtn').onclick = () => {
                const selectedId = modal.querySelector('#transferTargetSelect').value;
                if (selectedId) {
                    modal.style.display = 'none';
                    resolve(selectedId);
                }
            };
            modal.querySelector('#cancelBtn').onclick = () => {
                modal.style.display = 'none';
                resolve(null);
            };
        });
        
        if (!targetId) return; // Transferência cancelada

        const sourceDocRef = playersRef.doc(sourceCharacterId);
        const targetDocRef = playersRef.doc(targetId);

        try {
            await db.runTransaction(async (transaction) => {
                const sourceDoc = await transaction.get(sourceDocRef);
                const targetDoc = await transaction.get(targetDocRef);

                if (!sourceDoc.exists || !targetDoc.exists) { throw "Personagem não encontrado!"; }
                
                const sourceData = sourceDoc.data();
                const targetData = targetDoc.data();
                const sourceInventory = sourceData.inventory || [];
                const targetInventory = targetData.inventory || [];

                const itemToTransfer = sourceInventory[itemIndex];
                if (!itemToTransfer) { throw "O item não existe mais!"; }

                const emptySlot = targetInventory.findIndex(slot => slot === null);
                if (emptySlot === -1) { throw `O inventário de ${targetData.name} está cheio!`; }
                
                // Remove do inventário de origem
                sourceInventory.splice(itemIndex, 1);
                while(sourceInventory.length < 8) { sourceInventory.push(null); }
                
                // Adiciona ao inventário de destino
                targetInventory[emptySlot] = itemToTransfer;

                transaction.update(sourceDocRef, { inventory: sourceInventory });
                transaction.update(targetDocRef, { inventory: targetInventory });

                showNotification('Item transferido com sucesso!', 'success');
            });
        } catch (error) {
            showNotification(`Erro na transferência: ${error}`, 'error');
        }
    };

    const showConfirmation = (title, text) => {
        return new Promise((resolve) => {
            ui.confirmModal.querySelector('#confirmModalTitle').textContent = title;
            ui.confirmModal.querySelector('#confirmModalText').textContent = text;
            ui.confirmModal.style.display = 'block';
            ui.confirmModal.querySelector('#confirmBtn').onclick = () => {
                ui.confirmModal.style.display = 'none';
                resolve(true);
            };
            ui.confirmModal.querySelector('#cancelBtn').onclick = () => {
                ui.confirmModal.style.display = 'none';
                resolve(false);
            };
        });
    };

    // --- FUNÇÕES DE RENDERIZAÇÃO ---
    const renderPlayers = () => {
        ui.playerList.innerHTML = '';
        const displayPlayers = appState.players.filter(p => p.id !== appState.masterInfo.id);

        if (displayPlayers.length === 0) {
            ui.playerList.innerHTML = '<div class="empty-placeholder">Nenhum jogador conectado</div>';
        } else {
            displayPlayers.forEach(player => {
                const p = document.createElement('div');
                p.className = 'player-item';
                p.dataset.playerId = player.id;
                // O resto da lógica para renderizar o jogador...
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
        }
        ui.playerCount.textContent = `(${displayPlayers.length}/${appState.campaignMaxPlayers || 'N/A'})`;
    };

    const renderNpcs = () => {
        ui.npcList.innerHTML = '';
        if (appState.npcs.length === 0) {
            ui.npcList.innerHTML = '<div class="empty-placeholder">Nenhum NPC criado</div>';
        } else {
            appState.npcs.forEach(npc => {
                const p = document.createElement('div');
                p.className = 'player-item npc-item';
                p.dataset.playerId = npc.id;

                const health = npc.health || 0;
                const maxHealth = npc.maxHealth || npc.health || 10;

                // --- LÓGICA DA BARRA DE VIDA (COPIADA DOS PLAYERS) ---
                const healthPercent = (health / maxHealth) * 100;
                let healthClass = 'health-red';
                if (healthPercent > 60) healthClass = 'health-green';
                else if (healthPercent > 30) healthClass = 'health-yellow';
                // --- FIM DA LÓGICA DA BARRA DE VIDA ---

                let inventoryHtml = '';
                if (npc.inventory && npc.inventory.some(item => item !== null)) {
                    inventoryHtml += '<div class="npc-inventory"><ul class="npc-inventory-list">';
                    npc.inventory.forEach(item => {
                        if (item) {
                            let iconClass = 'fa-question-circle';
                            if (item.type === 'weapon') iconClass = 'fa-crosshairs';
                            if (item.type === 'healing') iconClass = 'fa-heart';
                            if (item.type === 'key') iconClass = 'fa-key';
                            if (item.type === 'document') iconClass = 'fa-file-alt';
                            
                            inventoryHtml += `<li class="npc-inventory-item"><i class="fas ${iconClass}"></i>${item.name}</li>`;
                        }
                    });
                    inventoryHtml += '</ul></div>';
                }

                // --- HTML ATUALIZADO COM A BARRA DE VIDA ---
                p.innerHTML = `
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <h3>${npc.name} <span>${health}/${maxHealth}</span></h3>
                        <div>
                            <button class="npc-dice-roll-btn re-btn-secondary" data-npc-id="${npc.id}" data-npc-name="${npc.name}" title="Rolar Dado para ${npc.name}"><i class="fas fa-dice-d20"></i></button>
                        </div>
                    </div>
                    <div class="player-health"><progress class="${healthClass}" value="${health}" max="${maxHealth}"></progress></div>
                    ${npc.image ? `<img src="${npc.image}" alt="${npc.name}" style="width: 50px; height: 50px; object-fit: cover; border-radius: 4px; margin-top: 5px;">` : ''}
                    ${inventoryHtml}
                `;
                p.addEventListener('click', (e) => {
                    if (!e.target.closest('.npc-dice-roll-btn')) {
                        openPlayerActionModal(npc);
                    }
                });
                ui.npcList.appendChild(p);
            });
        }
    };

    const renderInitiativeList = () => {
        ui.initiativeList.innerHTML = '';
        if (appState.initiativeList.length === 0) {
            ui.initiativeList.innerHTML = '<div class="empty-placeholder">A lista de iniciativa está vazia.</div>';
            return;
        }

        appState.initiativeList.forEach((char, index) => {
            const item = document.createElement('div');
            item.className = 'initiative-item';
            if (char.isActiveTurn) {
                item.classList.add('active');
            }
            
            // HTML atualizado para incluir o número da ordem
            item.innerHTML = `
                <div class="order-number">${index + 1}</div>
                <span class="name">${char.name}</span>
                <span class="score">Iniciativa: ${char.initiativeScore}</span>
                <button class="remove-from-initiative-btn" data-id="${char.id}" title="Remover da Iniciativa">&times;</button>
            `;
            ui.initiativeList.appendChild(item);
        });
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
        if (msg.senderId === appState.currentUser.uid) messageDiv.classList.add('own-message');

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
        if (!modal) return;
        const form = modal.querySelector('form');
        if (form) form.reset();

        const entityName = modalId.replace('Modal', '');
        const titleElement = modal.querySelector('h2');
        const hiddenIdInput = form ? form.querySelector('input[type="hidden"]') : null;

        if (titleElement) {
            titleElement.textContent = data.id ? `Editar ${entityName.charAt(0).toUpperCase() + entityName.slice(1)}` : `Criar Novo ${entityName.charAt(0).toUpperCase() + entityName.slice(1)}`;
        }
        if (hiddenIdInput) {
            hiddenIdInput.value = data.id || '';
        }

        if (form) {
            for (const element of form.elements) {
                if (element.id) {
                    const fieldName = element.id.replace(new RegExp(`^${entityName}`, 'i'), '').toLowerCase();
                    if (data[fieldName] !== undefined) {
                        element.value = data[fieldName];
                    }
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
        if (modal) modal.style.display = 'none';
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

    const openPlayerActionModal = (character) => {
        const modal = ui.playerActionModal;
        modal.querySelector('#playerActionTitle').textContent = `Ações para: ${character.name}`;
        modal.querySelector('#playerActionTargetId').value = character.id;
        modal.querySelector('#playerActionHealth').value = character.health || 0;
        
        const maxHealth = character.maxHealth || character.health || 10;
        modal.querySelector('#playerActionMaxHealth').value = maxHealth;
        
        ui.playerActionKickBtn.textContent = character.type === 'npc' ? 'Deletar NPC' : 'Expulsar Jogador';

        const itemSelect = modal.querySelector('#playerActionItemSelect');
        itemSelect.innerHTML = '<option value="">Selecione um item...</option>';
        appState.items.forEach(item => itemSelect.innerHTML += `<option value="${item.id}">${item.name}</option>`);

        // --- LÓGICA DE RENDERIZAÇÃO DO INVENTÁRIO ---
        const inventoryList = modal.querySelector('#playerActionInventoryList');
        inventoryList.innerHTML = '';
        const inventory = character.inventory || [];

        if (inventory.every(slot => slot === null)) {
            inventoryList.innerHTML = '<div class="empty-placeholder">Inventário vazio.</div>';
        } else {
            inventory.forEach((item, index) => {
                if (item) {
                    const itemEl = document.createElement('div');
                    itemEl.className = 'modal-inventory-item';
                    
                    let useButton = '';
                    if (item.type === 'healing') {
                        useButton = `<button class="re-btn use-item-btn" data-character-id="${character.id}" data-item-index="${index}">Usar</button>`;
                    }

                    itemEl.innerHTML = `
                        <span class="item-name">${item.name}</span>
                        <div class="item-actions">
                            ${useButton}
                            <button class="re-btn re-btn-secondary transfer-item-btn" data-character-id="${character.id}" data-item-index="${index}">Transferir</button>
                        </div>
                    `;
                    inventoryList.appendChild(itemEl);
                }
            });
        }
        
        modal.style.display = 'block';
    };

    const handleKickPlayer = async () => {
        const playerId = document.getElementById('playerActionTargetId').value;
        const player = [...appState.players, ...appState.npcs].find(p => p.id === playerId);
        if (!player) return;

        const actionText = player.type === 'npc' ? 'deletar permanentemente este NPC' : 'remover permanentemente este jogador da campanha';
        const titleText = player.type === 'npc' ? `Deletar ${player.name}` : `Expulsar ${player.name}`;

        const confirmed = await showConfirmation(titleText, `Tem certeza que deseja ${actionText}?`);

        if (confirmed) {
            await playersRef.doc(playerId).delete();
            showNotification(`${player.name} foi removido(a).`, 'success');
            closeModal('playerActionModal');
        }
    };

    const handleUpdatePlayerHealth = () => {
        const playerId = document.getElementById('playerActionTargetId').value;
        const health = parseInt(document.getElementById('playerActionHealth').value);
        const maxHealth = parseInt(document.getElementById('playerActionMaxHealth').value);
        if (isNaN(health) || isNaN(maxHealth)) return showNotification("Valores de vida inválidos.", "error");

        playersRef.doc(playerId).update({
                health,
                maxHealth
            })
            .then(() => showNotification("Vida do personagem atualizada.", "success"))
            .catch(err => showNotification(`Erro: ${err.message}`, "error"));
    };

    const handleSendItemToPlayer = async () => {
        const playerId = document.getElementById('playerActionTargetId').value;
        const itemId = document.getElementById('playerActionItemSelect').value;
        if (!itemId) return showNotification("Selecione um item.", "error");

        const item = appState.items.find(i => i.id === itemId);
        const player = [...appState.players, ...appState.npcs].find(p => p.id === playerId);

        const playerDoc = await playersRef.doc(playerId).get();
        if (!playerDoc.exists) return showNotification("Personagem não encontrado.", "error");

        const playerData = playerDoc.data();
        const inventory = playerData.inventory || Array(8).fill(null);
        const emptySlotIndex = inventory.findIndex(slot => slot === null);

        if (emptySlotIndex === -1) {
            return showNotification(`Inventário de ${player.name} está cheio!`, 'error');
        }

        // --- CORREÇÃO APLICADA AQUI ---
        // Cria uma cópia simples do objeto do item antes de salvar.
        inventory[emptySlotIndex] = { ...item };

        await playersRef.doc(playerId).update({
            inventory: inventory
        });

        // Apenas envia notificação no chat se for para um jogador real
        if (player.type !== 'npc') {
            eventsRef.add({
                type: 'item_received',
                recipientId: player.id,
                item: item,
                timestamp: firebase.firestore.FieldValue.serverTimestamp(),
                text: `${appState.masterInfo.name || 'Mestre'} enviou ${item.name} para ${player.name}.`
            });
        }

        showNotification(`Item enviado para ${player.name}.`, 'success');
        closeModal('playerActionModal');
    };

    const handleFormSubmit = (e) => {
        e.preventDefault();
        const form = e.target;
        const id = form.querySelector('input[type="hidden"]').value;
        let data, collection, entityName, closeModalId;

        if (form.id === 'itemForm') {
            entityName = 'Item';
            collection = itemsRef;
            closeModalId = 'itemModal';
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
            closeModalId = 'enemyModal';
            data = {
                name: form.enemyName.value,
                image: form.enemyImage.value,
                health: parseInt(form.enemyHealth.value),
                damage: form.enemyDamage.value,
                behavior: form.enemyBehavior.value,
            };
        } else if (form.id === 'npcForm') { // NOVO FORMULÁRIO DE NPC
            entityName = 'NPC';
            collection = playersRef;
            closeModalId = 'npcModal';
            data = {
                name: ui.npcForm.npcName.value,
                image: ui.npcForm.npcImage.value,
                health: parseInt(ui.npcForm.npcHealth.value),
                maxHealth: parseInt(ui.npcForm.npcHealth.value),
                attributes: ui.npcForm.npcAttributes.value,
                characteristics: ui.npcForm.npcCharacteristics.value,
                type: 'npc', // Define o tipo
                inventory: Array(8).fill(null), // Cria inventário vazio
            };
        }

        const promise = id ? collection.doc(id).update(data) : collection.add({ ...data, createdAt: firebase.firestore.FieldValue.serverTimestamp() });
        promise.then(() => {
            showNotification(`${entityName} ${id ? 'atualizado' : 'criado'}!`, 'success');
            closeModal(closeModalId);
        }).catch(err => showNotification(`Erro: ${err.message}`, 'error'));
    };

    // --- LÓGICA DO MAPA (SIMPLIFICADA) ---
    const setupMap = () => {
        const canvas = ui.fogOfWarCanvas;
        const mapImage = ui.masterMap;
        if (!canvas || !mapImage) return;
        appState.map.ctx = canvas.getContext('2d');
        const resizeCanvas = () => {
            canvas.width = mapImage.clientWidth;
            canvas.height = mapImage.clientHeight;
            updateFogOfWar(); // Chama a nova função
        };
        mapImage.onload = resizeCanvas;
        window.addEventListener('resize', resizeCanvas);
        if (mapImage.complete) resizeCanvas();
    };

    const updateFogOfWar = () => {
        const { ctx } = appState.map;
        if (!ctx) return;
        const canvas = ui.fogOfWarCanvas;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        if (appState.map.fogIsActive) {
            ctx.fillStyle = 'rgba(0, 0, 0, 0.9)';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
        }
    };

    // --- SETUP DE LISTENERS DA APLICAÇÃO ---
    const setupRealtimeListeners = () => {
        auth.onAuthStateChanged(user => {
            if (user) {
                appState.currentUser = user;
                loadInitialData();
            } else {
                window.location.href = 'index.html';
            }
        });
    };

    const loadInitialData = () => {
        campaignRef.onSnapshot(doc => {
            if (doc.exists) {
                const data = doc.data();
                appState.campaignMaxPlayers = data.maxPlayers;
                appState.masterInfo = {
                    id: data.masterId,
                    name: data.masterName
                };
                appState.activeMapId = data.activeMapId;
                ui.campaignTitle.textContent = data.name;
                ui.campaignCode.textContent = data.code;
                ui.masterNotes.value = data.masterNotes || '';
                renderMapList();
            } else {
                showNotification("A campanha foi encerrada ou deletada.", "info");
                setTimeout(() => {
                    window.location.href = 'campaign.html';
                }, 2000);
            }
        });

        playersRef.orderBy('name').onSnapshot(snap => {
            const allCharacters = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            // Separa jogadores e NPCs
            appState.players = allCharacters.filter(p => p.type !== 'npc');
            appState.npcs = allCharacters.filter(p => p.type === 'npc');
            renderPlayers();
            renderNpcs();
        });

        itemsRef.orderBy('name').onSnapshot(snap => {
            appState.items = snap.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            renderGenericList(appState.items, ui.masterItemList, renderItemCard);
        });
        enemiesRef.orderBy('name').onSnapshot(snap => {
            appState.enemies = snap.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            renderGenericList(appState.enemies, ui.enemyList, renderEnemyCard);
        });
        mapsRef.orderBy('name').onSnapshot(snap => {
            appState.maps = snap.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            renderMapList();
        });
        mapStateRef.onSnapshot(doc => {
            // Atualiza o estado da névoa
            appState.map.fogIsActive = doc.exists && doc.data().fogIsActive !== undefined ? doc.data().fogIsActive : true;
            ui.toggleFogOfWar.checked = appState.map.fogIsActive;
            updateFogOfWar();
        });

        initiativeRef.orderBy('initiativeScore', 'desc').onSnapshot(snap => {
            appState.initiativeList = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            renderInitiativeList();
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
    
    // --- LÓGICA DE GERAÇÃO ALEATÓRIA PARA NPCS ---
    const generateRandomNpcStats = () => {
        const attributes = ["Força", "Agilidade", "Vitalidade", "Inteligência", "Percepção"];
        const characteristics = ["Agressivo", "Medroso", "Calmo", "Oportunista", "Lento", "Rápido", "Silencioso", "Barulhento", "Defensivo"];
        
        let randomAttributes = attributes.map(attr => {
            const value = Math.floor(Math.random() * 8) + 5; // Gera valor entre 5 e 12
            return `${attr}: ${value}`;
        }).join(', ');

        let randomCharacteristics = characteristics[Math.floor(Math.random() * characteristics.length)];

        ui.npcForm.npcAttributes.value = randomAttributes;
        ui.npcForm.npcCharacteristics.value = randomCharacteristics;
        ui.npcForm.npcHealth.value = Math.floor(Math.random() * 15) + 5; // Vida entre 5 e 20
    };

    // --- LÓGICA DA INICIATIVA ---
    const handleGetInitiative = async () => {
        const confirmed = await showConfirmation('Coletar Iniciativas', 'Isso irá limpar a lista atual e pedir novos valores para todos os jogadores e NPCs. Deseja continuar?');
        if (!confirmed) return;

        const allCharacters = [...appState.players, ...appState.npcs].filter(c => c.id !== appState.masterInfo.id);
        if (allCharacters.length === 0) {
            showNotification('Não há jogadores ou NPCs para adicionar à iniciativa.', 'info');
            return;
        }

        let initiatives = [];
        for (const char of allCharacters) {
            const scoreStr = prompt(`Digite a iniciativa para ${char.name}:`);
            const score = parseInt(scoreStr);
            if (!isNaN(score)) {
                initiatives.push({
                    name: char.name,
                    characterId: char.id,
                    initiativeScore: score,
                });
            }
        }

        if (initiatives.length === 0) return;

        initiatives.sort((a, b) => b.initiativeScore - a.initiativeScore);
        
        // Adiciona a propriedade 'isActiveTurn'
        const finalInitiativeList = initiatives.map((char, index) => ({
            ...char,
            isActiveTurn: index === 0
        }));

        // Limpa a iniciativa antiga no Firebase
        const oldInitiativeDocs = await initiativeRef.get();
        const batch = db.batch();
        oldInitiativeDocs.docs.forEach(doc => batch.delete(doc.ref));

        // Adiciona a nova lista ordenada
        finalInitiativeList.forEach(char => {
            const newInitiativeDoc = initiativeRef.doc();
            // Adicionamos o ID do documento ao objeto para renderização imediata
            char.id = newInitiativeDoc.id;
            batch.set(newInitiativeDoc, { ...char });
        });

        await batch.commit();

        // --- CORREÇÃO APLICADA AQUI ---
        // Força a atualização do estado local e a renderização imediata da lista
        appState.initiativeList = finalInitiativeList;
        renderInitiativeList();
        
        showNotification('Lista de iniciativa atualizada e ordenada!', 'success');
    };

    const handleNextInitiative = async () => {
        if (appState.initiativeList.length === 0) return;

        const currentIndex = appState.initiativeList.findIndex(char => char.isActiveTurn);
        if (currentIndex === -1) { // Ninguém é o ativo, define o primeiro
            await initiativeRef.doc(appState.initiativeList[0].id).update({ isActiveTurn: true });
            return;
        }

        const nextIndex = (currentIndex + 1) % appState.initiativeList.length;
        
        const batch = db.batch();
        batch.update(initiativeRef.doc(appState.initiativeList[currentIndex].id), { isActiveTurn: false });
        batch.update(initiativeRef.doc(appState.initiativeList[nextIndex].id), { isActiveTurn: true });
        await batch.commit();
    };

    const handleClearInitiative = async () => {
        const confirmed = await showConfirmation('Limpar Iniciativa', 'Tem certeza que deseja remover todos da lista de iniciativa?');
        if(confirmed) {
            const oldInitiative = await initiativeRef.get();
            const batch = db.batch();
            oldInitiative.docs.forEach(doc => batch.delete(doc.ref));
            await batch.commit();
            showNotification('Lista de iniciativa limpa.', 'success');
        }
    };


    const setupUIEvents = () => {
        ui.copyCodeBtn.addEventListener('click', () => navigator.clipboard.writeText(ui.campaignCode.textContent).then(() => showNotification('Código copiado!', 'success')));
        ui.saveNotesBtn.addEventListener('click', () => campaignRef.update({
            masterNotes: ui.masterNotes.value
        }).then(() => showNotification('Anotações salvas.', 'success')));

        ui.endSessionBtn.addEventListener('click', async () => {
            const confirmed = await showConfirmation('Encerrar Sessão', 'ATENÇÃO: Isso deletará PERMANENTEMENTE a campanha e todos os seus dados. Deseja continuar?');
            if (confirmed) {
                campaignRef.delete().catch(err => {
                    showNotification(`Erro ao encerrar sessão: ${err.message}`, 'error');
                });
            }
        });

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
        ui.addNpcBtn.addEventListener('click', () => openModal('npcModal')); // NOVO

        ui.itemForm.addEventListener('submit', handleFormSubmit);
        ui.enemyForm.addEventListener('submit', handleFormSubmit);
        ui.npcForm.addEventListener('submit', handleFormSubmit); // NOVO
        ui.generateRandomNpcStatsBtn.addEventListener('click', generateRandomNpcStats); // NOVO

        document.getElementById('itemType').addEventListener('change', (e) => updateItemSpecificFields(e.target.value));

        document.getElementById('playerActionUpdateHealthBtn').addEventListener('click', handleUpdatePlayerHealth);
        document.getElementById('playerActionSendItemBtn').addEventListener('click', handleSendItemToPlayer);
        ui.playerActionKickBtn.addEventListener('click', handleKickPlayer);

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
        
        // NOVO: Listener para rolagem de dados do NPC
        ui.npcList.addEventListener('click', (e) => {
            const target = e.target.closest('.npc-dice-roll-btn');
            if(target) {
                const npcName = target.dataset.npcName;
                const diceRoll = prompt(`Rolar dado para ${npcName} (Ex: 1d20, 2d6+3):`, "1d20");
                if(diceRoll) {
                    try {
                        const [numDice, rest] = diceRoll.toLowerCase().split('d');
                        const [sides, modifierStr] = rest.split(/([+-])/);
                        const modifierSign = modifierStr;
                        const modifierValue = parseInt(rest.split(modifierSign)[1] || '0');

                        let total = 0;
                        let rolls = [];
                        for(let i = 0; i < parseInt(numDice); i++) {
                            const roll = Math.floor(Math.random() * parseInt(sides)) + 1;
                            rolls.push(roll);
                            total += roll;
                        }
                        
                        let modifierText = "";
                        if(modifierSign && modifierValue) {
                            if(modifierSign === '+') total += modifierValue;
                            if(modifierSign === '-') total -= modifierValue;
                            modifierText = ` ${modifierSign} ${modifierValue}`;
                        }
                        
                        const rollText = `(${npcName}) rolou ${diceRoll}: [${rolls.join(', ')}]${modifierText} = ${total}`;
                        eventsRef.add({ type: 'dice_roll', senderId: 'npc_roll', senderName: npcName, text: rollText, timestamp: firebase.firestore.FieldValue.serverTimestamp() });

                    } catch(err) {
                        showNotification('Formato de dado inválido. Use "XdY" ou "XdY+Z".', 'error');
                    }
                }
            }
        });

        ui.mapList.addEventListener('click', e => {
            const target = e.target;
            if (target.classList.contains('delete-btn')) {
                handleDelete('maps', target.dataset.id, 'Mapa');
            } else if (target.classList.contains('map-name')) {
                campaignRef.update({
                    activeMapId: target.dataset.id
                });
            }
        });

        ui.addMapBtn.addEventListener('click', () => {
            const name = ui.mapNameInput.value.trim();
            const url = ui.mapUrlInput.value.trim();
            if (name && url) {
                mapsRef.add({
                    name,
                    url
                }).then(() => {
                    showNotification('Mapa adicionado!', 'success');
                    ui.mapNameInput.value = '';
                    ui.mapUrlInput.value = '';
                }).catch(err => showNotification(`Erro: ${err.message}`, 'error'));
            } else {
                showNotification('Preencha o nome e a URL do mapa.', 'error');
            }
        });

        ui.toggleFogOfWar.addEventListener('change', (e) => {
            const isActive = e.target.checked;
            mapStateRef.set({ fogIsActive: isActive }, { merge: true });
        });

        ui.diceBtns.forEach(btn => btn.addEventListener('click', (e) => {
            const diceAudio = document.getElementById('master-dice-audio');
            if (diceAudio) {
                diceAudio.currentTime = 0;
                diceAudio.play().catch(err => console.error("Erro ao tocar áudio:", err));
            }

            const sides = parseInt(e.target.dataset.sides);
            const quantity = parseInt(ui.diceQuantityInput.value) || 1;

            let rolls = [];
            let total = 0;
            for (let i = 0; i < quantity; i++) {
                const roll = Math.floor(Math.random() * sides) + 1;
                rolls.push(roll);
                total += roll;
            }

            let rollText;
            if (quantity === 1) {
                rollText = `(Mestre) rolou 1d${sides}: ${total}`;
            } else {
                rollText = `(Mestre) rolou ${quantity}d${sides}: [${rolls.join(', ')}] = ${total}`;
            }

            eventsRef.add({
                type: 'dice_roll',
                senderId: appState.currentUser.uid,
                senderName: appState.masterInfo.name || 'Mestre',
                text: rollText,
                timestamp: firebase.firestore.FieldValue.serverTimestamp()
            })
        }));

        const sendChatMessage = () => {
            const text = ui.masterChatInput.value.trim();
            if (!text) return;
            eventsRef.add({
                type: 'chat',
                senderId: appState.currentUser.uid,
                senderName: appState.masterInfo.name || 'Mestre',
                text: text,
                timestamp: firebase.firestore.FieldValue.serverTimestamp()
            });
            ui.masterChatInput.value = '';
        };
        ui.sendMasterMsgBtn.addEventListener('click', sendChatMessage);
        ui.masterChatInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') sendChatMessage();
        });
        
        // LISTENERS DA INICIATIVA
        ui.getInitiativeFromAllBtn.addEventListener('click', handleGetInitiative);
        ui.nextInitiativeBtn.addEventListener('click', handleNextInitiative);
        ui.clearInitiativeBtn.addEventListener('click', handleClearInitiative);
        ui.initiativeList.addEventListener('click', (e) => {
            const target = e.target.closest('.remove-from-initiative-btn');
            if (target) {
                initiativeRef.doc(target.dataset.id).delete();
            }
        });


        if (ui.toggleChatBtn) {
            ui.toggleChatBtn.addEventListener('click', () => {
                ui.masterChat.classList.toggle('collapsed');
                const icon = ui.toggleChatBtn.querySelector('i');
                icon.classList.toggle('fa-chevron-up');
                icon.classList.toggle('fa-chevron-down');
            });
        }

        // NOVO: Listener para ações de itens no modal
        ui.playerActionModal.addEventListener('click', (e) => {
            const useBtn = e.target.closest('.use-item-btn');
            const transferBtn = e.target.closest('.transfer-item-btn');

            if (useBtn) {
                const charId = useBtn.dataset.characterId;
                const itemIndex = parseInt(useBtn.dataset.itemIndex);
                handleUseItem(charId, itemIndex);
            }

            if (transferBtn) {
                const charId = transferBtn.dataset.characterId;
                const itemIndex = parseInt(transferBtn.dataset.itemIndex);
                handleTransferItem(charId, itemIndex);
            }
        });
    };

    // --- INICIALIZAÇÃO DA APLICAÇÃO ---
    setupRealtimeListeners();
    setupUIEvents();
    setupMap();
});