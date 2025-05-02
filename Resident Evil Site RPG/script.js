document.addEventListener('DOMContentLoaded', function () {
    // Elementos principais
    const characterImage = document.getElementById('character-image');
    const imageUpload = document.getElementById('image-upload');
    const charNameInput = document.getElementById('char-name');
    const equippedWeapon = document.getElementById('equipped-weapon');
    const saveBtn = document.getElementById('save-btn');
    const docsBtn = document.getElementById('docs-btn');
    const mapBtn = document.getElementById('map-btn');
    const healthBar = document.getElementById('health');
    const healthValue = document.getElementById('health-value');
    const selectedItemDisplay = document.getElementById('selected-item-display');
    const itemDescription = document.getElementById('item-description');
    const inventoryGrid = document.getElementById('inventory-grid');

    // Elementos de atributos
    const strengthInput = document.getElementById('strength');
    const dexterityInput = document.getElementById('dexterity');
    const constitutionInput = document.getElementById('constitution');
    const intelligenceInput = document.getElementById('intelligence');
    const perceptionInput = document.getElementById('perception');
    const lifeTotalSpan = document.getElementById('life-total');
    const sanityTotalSpan = document.getElementById('sanity-total');

    // Botões para ajustar vida
    const increaseHealthBtn = document.createElement('button');
    increaseHealthBtn.textContent = '+';
    increaseHealthBtn.className = 'health-btn';
    const decreaseHealthBtn = document.createElement('button');
    decreaseHealthBtn.textContent = '-';
    decreaseHealthBtn.className = 'health-btn';

    // Insere os botões na barra de vida
    healthBar.parentNode.insertBefore(decreaseHealthBtn, healthBar);
    healthBar.parentNode.insertBefore(increaseHealthBtn, healthBar.nextSibling);

    let inventory = Array(8).fill(null);
    let selectedItem = null;
    let currentEditingSlot = null;

    // Inicialização
    function init() {
        // Carrega dados salvos se existirem
        loadData();

        // Preenche o inventário com slots vazios
        for (let i = 0; i < 8; i++) {
            const slot = document.createElement('div');
            slot.className = 'inventory-slot';
            slot.dataset.index = i;
            slot.addEventListener('click', () => handleSlotClick(i));

            // Slot vazio sem conteúdo
            inventoryGrid.appendChild(slot);
        }

        // Atualiza atributos
        updateCalculatedStats();
    }

    // Manipula o clique no slot
    function handleSlotClick(slotIndex) {
        currentEditingSlot = slotIndex;
        const item = inventory[slotIndex];

        if (item) {
            selectItem(slotIndex);
        } else {
            // Cria um input file temporário para upload de imagem
            const fileInput = document.createElement('input');
            fileInput.type = 'file';
            fileInput.accept = 'image/*';

            fileInput.addEventListener('change', (e) => {
                const file = e.target.files[0];
                if (file) {
                    const reader = new FileReader();
                    reader.onload = function (event) {
                        const itemData = parseFileName(file.name);
                        itemData.image = event.target.result;
                        addItemToInventory(currentEditingSlot, itemData);
                        saveData();
                    };
                    reader.readAsDataURL(file);
                }
            });

            fileInput.click();
        }
    }

    // Adiciona item ao inventário
    function addItemToInventory(slotIndex, item) {
        const slot = inventoryGrid.children[slotIndex];

        // Limpa o slot e adiciona a imagem cobrindo todo o espaço
        slot.innerHTML = '';
        slot.style.backgroundImage = `url('${item.image}')`;
        slot.style.backgroundSize = 'cover';
        slot.style.backgroundPosition = 'center';

        // Adiciona quantidade se necessário
        if (item.showQuantity) {
            const quantityBadge = document.createElement('div');
            quantityBadge.className = 'item-quantity';
            quantityBadge.textContent = item.quantity;
            slot.appendChild(quantityBadge);
        }

        // Armazena metadados
        slot.title = `${item.name}\n${item.description}\nTipo: ${item.type}`;
        inventory[slotIndex] = item;
    }

    // Seleciona item
    function selectItem(slotIndex) {
        const item = inventory[slotIndex];
        selectedItem = item;

        if (item) {
            // Atualiza displays
            selectedItemDisplay.textContent = `Item selecionado: ${item.name}`;
            itemDescription.innerHTML = `
            <p>${item.description}</p>
            <p><strong>Tipo:</strong> ${item.type}</p>
        `;

            // Adiciona botões de ação
            const actionsDiv = document.createElement('div');
            actionsDiv.className = 'item-actions';

            // Botão para remover item
            const removeBtn = document.createElement('button');
            removeBtn.textContent = 'Remover Item';
            removeBtn.className = 'remove-item-btn';
            removeBtn.addEventListener('click', () => {
                removeItemFromInventory(slotIndex);
            });
            actionsDiv.appendChild(removeBtn);

            // Controle de quantidade para itens relevantes
            if (item.showQuantity) {
                const quantityDiv = document.createElement('div');
                quantityDiv.className = 'quantity-control';
                quantityDiv.innerHTML = `
                <button class="quantity-btn minus">-</button>
                <span>${item.quantity}</span>
                <button class="quantity-btn plus">+</button>
            `;

                quantityDiv.querySelector('.minus').addEventListener('click', () => {
                    if (item.quantity > 1) {
                        item.quantity--;
                        updateItemQuantity(slotIndex, item.quantity);
                    }
                });

                quantityDiv.querySelector('.plus').addEventListener('click', () => {
                    item.quantity++;
                    updateItemQuantity(slotIndex, item.quantity);
                });

                actionsDiv.appendChild(quantityDiv);
            }

            itemDescription.appendChild(actionsDiv);

            // Destaca slot selecionado
            document.querySelectorAll('.inventory-slot').forEach(slot => {
                slot.style.borderColor = '#555';
            });
            inventoryGrid.children[slotIndex].style.borderColor = '#c0a050';

            // Se for arma, equipa
            if (item.type === 'weapon') {
                equippedWeapon.innerHTML = `Arma: ${item.name}`;
            }
        } else {
            selectedItemDisplay.textContent = 'Item selecionado: Nenhum';
            itemDescription.textContent = 'Descrição do item aparecerá aqui';
        }
    }

    // Remove item do inventário
    function removeItemFromInventory(slotIndex) {
        const slot = inventoryGrid.children[slotIndex];
        slot.innerHTML = '<span>+</span>';
        slot.title = '';
        inventory[slotIndex] = null;

        // Limpa seleção se estava selecionado
        if (selectedItem && selectedItem === inventory[slotIndex]) {
            selectedItemDisplay.textContent = 'Item selecionado: Nenhum';
            itemDescription.textContent = 'Descrição do item aparecerá aqui';
        }

        saveData();
    }

    // Atualiza a quantidade do item
    function updateItemQuantity(slotIndex, newQuantity) {
        const item = inventory[slotIndex];
        if (item && item.showQuantity) {
            item.quantity = newQuantity;

            // Atualiza o badge de quantidade
            const quantityBadge = inventoryGrid.children[slotIndex].querySelector('.item-quantity');
            if (quantityBadge) {
                quantityBadge.textContent = newQuantity;
            }

            // Atualiza o display se estiver selecionado
            if (selectedItem === item) {
                selectItem(slotIndex);
            }

            saveData();
        }
    }

    // Extrai informações do nome do arquivo
    function parseFileName(filename) {
        // Formato esperado: "Nome - Descrição - Tipo - Quantidade.ext"
        const baseName = filename.replace(/\.[^/.]+$/, "");
        const parts = baseName.split(' - ');

        return {
            name: parts[0] || "Item Desconhecido",
            description: parts[1] || "Descrição não disponível",
            type: parts[2] || "misc",
            quantity: parseInt(parts[3]) || 1,
            showQuantity: ["weapon", "ammo"].includes(parts[2])
        };
    }

    // Atualiza a cor da barra de vida baseada no percentual
    function updateHealthBarColor() {
        const percent = (healthBar.value / healthBar.max) * 100;

        if (percent > 60) {
            healthBar.style.backgroundColor = '#4CAF50'; // Verde
        } else if (percent > 30) {
            healthBar.style.backgroundColor = '#FFC107'; // Amarelo
        } else if (percent > 15) {
            healthBar.style.backgroundColor = '#FF9800'; // Laranja
        } else {
            healthBar.style.backgroundColor = '#F44336'; // Vermelho
        }
    }

    // Atualiza status calculados
    function updateCalculatedStats() {
        // Obtém valores dos atributos
        const strength = parseInt(strengthInput.value) || 0;
        const dexterity = parseInt(dexterityInput.value) || 0;
        const constitution = parseInt(constitutionInput.value) || 0;
        const intelligence = parseInt(intelligenceInput.value) || 0;

        // Calcula Vida: (Constituição + Força) / 2
        const lifeTotal = Math.floor((constitution + strength) / 2);
        lifeTotalSpan.textContent = lifeTotal;

        // Atualiza a barra de vida
        healthBar.max = lifeTotal;
        if (healthBar.value > lifeTotal) {
            healthBar.value = lifeTotal;
        }
        healthValue.textContent = `${healthBar.value}/${lifeTotal}`;

        // Calcula Sanidade: Inteligência * Destreza
        const sanityTotal = intelligence * dexterity;
        sanityTotalSpan.textContent = sanityTotal;

        // Atualiza cor da barra de vida
        updateHealthBarColor();
    }

    // Função para atualizar a cor da barra de vida (definida no escopo global)
    function updateHealthBarColor() {
        const percent = (healthBar.value / healthBar.max) * 100;

        // Remove todas as classes de cor primeiro
        healthBar.classList.remove('health-green', 'health-yellow', 'health-orange', 'health-red');

        // Adiciona a classe apropriada
        if (percent > 60) {
            healthBar.classList.add('health-green');
        } else if (percent > 30) {
            healthBar.classList.add('health-yellow');
        } else if (percent > 15) {
            healthBar.classList.add('health-orange');
        } else {
            healthBar.classList.add('health-red');
        }
    }

    // Ajusta a vida (aumenta ou diminui)
    function adjustHealth(amount) {
        const newValue = parseInt(healthBar.value) + amount;

        // Garante que o valor fique dentro dos limites
        healthBar.value = Math.max(0, Math.min(newValue, healthBar.max));

        // Atualiza display
        healthValue.textContent = `${healthBar.value}/${healthBar.max}`;

        // Atualiza cor da barra
        updateHealthBarColor();

        // Salva automaticamente a mudança
        saveData();

        // Efeito visual ao mudar a vida
        if (amount < 0) {
            healthBar.style.transform = 'scale(1.02)';
            setTimeout(() => {
                healthBar.style.transform = 'scale(1)';
            }, 200);
        } else if (amount > 0) {
            healthBar.style.transform = 'scale(1.05)';
            setTimeout(() => {
                healthBar.style.transform = 'scale(1)';
            }, 200);
        }
    }

    // Configuração dos Mapas
    // Configuração dos Mapas - versão corrigida
    const mansionMaps = [
        {
            name: "1º Andar",
            path: "imgs/maps/mansion1f.png"
        },
        {
            name: "2º Andar",
            path: "imgs/maps/mansion2f.png"
        },
        {
            name: "3º Andar",
            path: "imgs/maps/mansion3f.png"
        },
        {
            name: "Porão",
            path: "imgs/maps/mansionb1.png"
        }
        // Adicione mais mapas conforme necessário
    ];

    let currentMapIndex = 0;
    const mapModal = document.getElementById('map-modal');
    const mapImage = document.getElementById('map-image');
    const mapTitle = document.getElementById('map-title');
    const prevMapBtn = document.getElementById('prev-map');
    const nextMapBtn = document.getElementById('next-map');
    const closeBtn = document.querySelector('.close-btn');
    const mapError = document.getElementById('map-error');

    // Verifica mapas disponíveis ao carregar
    function checkAvailableMaps() {
        mansionMaps.forEach((map, index) => {
            const img = new Image();
            img.onerror = () => {
                console.warn(`Mapa não encontrado: ${map.path}`);
                mansionMaps.splice(index, 1);
                if (currentMapIndex >= mansionMaps.length) {
                    currentMapIndex = Math.max(0, mansionMaps.length - 1);
                }
            };
            img.src = map.path;
        });
    }

    // Carrega o mapa específico - versão corrigida
    function loadMap(index) {
        if (mansionMaps.length === 0) {
            mapError.style.display = 'block';
            mapImage.style.display = 'none';
            mapTitle.textContent = 'Nenhum mapa disponível';
            prevMapBtn.disabled = true;
            nextMapBtn.disabled = true;
            return;
        }

        const map = mansionMaps[index];
        const img = new Image();

        img.onload = () => {
            mapImage.src = img.src;
            mapImage.style.display = 'block';
            mapError.style.display = 'none';
            mapTitle.textContent = `Mansão - ${map.name}`;
            prevMapBtn.disabled = index === 0;
            nextMapBtn.disabled = index === mansionMaps.length - 1;
        };

        img.onerror = () => {
            mapImage.style.display = 'none';
            mapError.style.display = 'block';
            mapTitle.textContent = `Erro ao carregar: ${map.name}`;
        };

        img.src = map.path;
    }

    // Event Listeners
    document.getElementById('map-btn').addEventListener('click', () => {
        if (mansionMaps.length > 0) {
            loadMap(currentMapIndex);
            mapModal.style.display = 'block';
        } else {
            alert('Nenhum mapa disponível na pasta imgs/maps/');
        }
    });

    closeBtn.addEventListener('click', () => {
        mapModal.style.display = 'none';
    });

    window.addEventListener('click', (event) => {
        if (event.target === mapModal) {
            mapModal.style.display = 'none';
        }
    });

    prevMapBtn.addEventListener('click', () => {
        currentMapIndex = (currentMapIndex - 1 + mansionMaps.length) % mansionMaps.length;
        loadMap(currentMapIndex);
    });

    nextMapBtn.addEventListener('click', () => {
        currentMapIndex = (currentMapIndex + 1) % mansionMaps.length;
        loadMap(currentMapIndex);
    });

    document.addEventListener('keydown', (e) => {
        if (mapModal.style.display === 'block') {
            if (e.key === 'ArrowLeft') prevMapBtn.click();
            else if (e.key === 'ArrowRight') nextMapBtn.click();
            else if (e.key === 'Escape') mapModal.style.display = 'none';
        }
    });

    // Sistema de Documentos
    const docsModal = document.getElementById('docs-modal');
    const notesTextarea = document.getElementById('notes-textarea');
    const saveNotesBtn = document.getElementById('save-notes');
    const docsStatus = document.getElementById('docs-status');

    // Carregar notas salvas
    function loadNotes() {
        const savedNotes = localStorage.getItem('re1rpg_notes');
        if (savedNotes) {
            notesTextarea.value = savedNotes;
        }
    }

    // Salvar notas
    function saveNotes() {
        const notes = notesTextarea.value;
        localStorage.setItem('re1rpg_notes', notes);

        // Feedback visual
        docsStatus.textContent = "Salvo em " + new Date().toLocaleTimeString();
        saveNotesBtn.classList.add('saving');

        setTimeout(() => {
            saveNotesBtn.classList.remove('saving');
        }, 1000);
    }

    // Auto-salvar a cada 30 segundos
    let autoSaveInterval;
    function startAutoSave() {
        autoSaveInterval = setInterval(saveNotes, 30000);
    }

    // Event Listeners
    document.getElementById('docs-btn').addEventListener('click', () => {
        loadNotes();
        docsModal.style.display = 'block';
        notesTextarea.focus();
        startAutoSave();
    });

    document.querySelector('#docs-modal .close-btn').addEventListener('click', () => {
        saveNotes();
        clearInterval(autoSaveInterval);
        docsModal.style.display = 'none';
    });

    saveNotesBtn.addEventListener('click', saveNotes);

    // Salvar também quando o modal é fechado clicando fora
    window.addEventListener('click', (event) => {
        if (event.target === docsModal) {
            saveNotes();
            clearInterval(autoSaveInterval);
            docsModal.style.display = 'none';
        }
    });

    // Salvar ao pressionar Ctrl+S
    document.addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key === 's') {
            e.preventDefault();
            saveNotes();
        }
    });

    // Sistema de Rolagem de Dados
    const diceModal = document.getElementById('dice-modal');
    const diceResult = document.getElementById('dice-result');
    const diceAnimation = document.getElementById('dice-roll-animation');
    const diceHistory = document.getElementById('dice-history');
    let diceRollHistory = JSON.parse(localStorage.getItem('re1rpg_dice_history')) || [];

    // Rolagem de dado
    function rollDice(sides) {
        // Animação
        diceAnimation.textContent = '...';
        diceAnimation.classList.add('dice-animation');

        // Limpa animação após término
        setTimeout(() => {
            diceAnimation.classList.remove('dice-animation');

            // Gera resultado aleatório
            const result = Math.floor(Math.random() * sides) + 1;
            const rollTime = new Date().toLocaleTimeString();
            const rollEntry = {
                dice: `d${sides}`,
                result: result,
                time: rollTime
            };

            // Atualiza interface
            diceResult.textContent = `Resultado: ${result}`;
            diceAnimation.textContent = `d${sides}`;

            // Armazena no histórico
            diceRollHistory.unshift(rollEntry);
            if (diceRollHistory.length > 10) {
                diceRollHistory = diceRollHistory.slice(0, 10);
            }

            // Salva e atualiza histórico
            localStorage.setItem('re1rpg_dice_history', JSON.stringify(diceRollHistory));
            updateDiceHistory();

            // Efeito sonoro (opcional)
            playDiceSound();
        }, 500);
    }

    // Atualiza histórico na tela
    function updateDiceHistory() {
        diceHistory.innerHTML = '<h4>Histórico:</h4>';
        diceRollHistory.forEach(roll => {
            const rollElement = document.createElement('div');
            rollElement.className = 'dice-history-item';
            rollElement.textContent = `${roll.time} - ${roll.dice}: ${roll.result}`;
            diceHistory.appendChild(rollElement);
        });
    }

    // Efeito sonoro (opcional)
    function playDiceSound() {
        const sounds = [
            'sounds/dice1.mp3'
        ];
        const sound = new Audio(sounds[Math.floor(Math.random() * sounds.length)]);
        sound.volume = 0.3;
        sound.play().catch(e => console.log("Erro ao reproduzir som:", e));
    }

    // Event Listeners para botões de dados
    document.querySelectorAll('.dice-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const sides = parseInt(btn.dataset.sides);
            rollDice(sides);
        });
    });

    // Sistema de Áudio de Fundo
    const audioToggle = document.getElementById('audio-toggle');
    const audioIcon = document.getElementById('audio-icon');
    const backgroundAudio = document.getElementById('background-audio');

    // Verifica preferência de áudio salva
    const audioPreference = localStorage.getItem('re1rpg_audio');
    let isAudioEnabled = audioPreference ? JSON.parse(audioPreference) : false;

    // Carrega música de fundo (opcional - você pode usar sua própria)
    if (!backgroundAudio.src) {
        // Música de fundo genérica (substitua pelo seu arquivo)
        backgroundAudio.src = 'sounds/background.mp3';
        backgroundAudio.volume = 0.3; // Volume reduzido para não incomodar
    }

    // Atualiza ícone e estado
    function updateAudioControls() {
        if (isAudioEnabled) {
            audioIcon.textContent = '🔊';
            audioToggle.classList.add('audio-playing');
            backgroundAudio.play().catch(e => console.log("Autoplay bloqueado:", e));
        } else {
            audioIcon.textContent = '🔇';
            audioToggle.classList.remove('audio-playing');
            backgroundAudio.pause();
        }
    }

    // Alternar áudio
    audioToggle.addEventListener('click', () => {
        isAudioEnabled = !isAudioEnabled;
        localStorage.setItem('re1rpg_audio', JSON.stringify(isAudioEnabled));
        updateAudioControls();

        // Tenta reproduzir após interação do usuário (contorna políticas de autoplay)
        if (isAudioEnabled) {
            backgroundAudio.play().catch(e => console.log("Erro ao reproduzir áudio:", e));
        }
    });

    // Inicializa controles de áudio
    document.addEventListener('DOMContentLoaded', () => {
        // Espera um pouco para contornar restrições de autoplay
        setTimeout(() => {
            updateAudioControls();
        }, 1000);
    });

    // Atualiza ícone quando o áudio terminar (para loop contínuo)
    backgroundAudio.addEventListener('ended', () => {
        if (isAudioEnabled) {
            backgroundAudio.currentTime = 0;
            backgroundAudio.play().catch(e => console.log("Erro ao reiniciar áudio:", e));
        }
    });

    // Abrir modal de dados
    document.getElementById('dice-btn').addEventListener('click', () => {
        diceModal.style.display = 'block';
        updateDiceHistory();
    });

    // Fechar modal
    document.querySelector('#dice-modal .close-btn').addEventListener('click', () => {
        diceModal.style.display = 'none';
    });

    // Fechar ao clicar fora
    window.addEventListener('click', (e) => {
        if (e.target === diceModal) {
            diceModal.style.display = 'none';
        }
    });

    // Atalhos de teclado para dados
    document.addEventListener('keydown', (e) => {
        if (diceModal.style.display === 'block') {
            const keyMap = {
                '1': 20, '2': 12, '3': 10,
                '4': 8, '5': 6, '6': 4
            };
            if (keyMap[e.key]) {
                rollDice(keyMap[e.key]);
            }
        }
    });

    // Inicializar
    window.addEventListener('DOMContentLoaded', loadNotes);

    // Inicialização
    window.addEventListener('DOMContentLoaded', checkAvailableMaps);

    // Carrega dados salvos
    function loadData() {
        const savedData = localStorage.getItem('re1rpg_inventory');
        if (savedData) {
            const data = JSON.parse(savedData);

            // Carrega informações básicas
            charNameInput.value = data.name || '';

            // Carrega imagem do personagem
            if (data.characterImage) {
                characterImage.innerHTML = `<img src="${data.characterImage}" alt="Personagem">`;
            }

            // Carrega atributos
            strengthInput.value = data.strength || 10;
            dexterityInput.value = data.dexterity || 10;
            constitutionInput.value = data.constitution || 10;
            intelligenceInput.value = data.intelligence || 10;
            perceptionInput.value = data.perception || 10;

            // Carrega vida
            if (data.health) {
                healthBar.value = data.health;
            } else {
                // Se não houver vida salva, define como vida máxima
                updateCalculatedStats();
                healthBar.value = healthBar.max;
            }

            // Atualiza cálculos e cor
            updateCalculatedStats();
            updateHealthBarColor();
        } else {
            // Valores padrão se não houver dados salvos
            updateCalculatedStats();
            healthBar.value = healthBar.max;
            updateHealthBarColor();
        }
    }

    // 1. Sistema de Reset
    const resetBtn = document.getElementById('reset-btn');
    const confirmResetModal = document.getElementById('confirm-reset-modal');
    const confirmResetBtn = document.getElementById('confirm-reset');
    const cancelResetBtn = document.getElementById('cancel-reset');

    // Mostrar modal de confirmação
    resetBtn.addEventListener('click', () => {
        confirmResetModal.style.display = 'flex';
        confirmResetModal.style.justifyContent = 'center';
        confirmResetModal.style.alignItems = 'center';
    });

    // Cancelar reset
    cancelResetBtn.addEventListener('click', () => {
        confirmResetModal.style.display = 'none';
    });

    // Confirmar reset
    confirmResetBtn.addEventListener('click', () => {
        // Limpa todos os dados salvos
        localStorage.clear();

        // Recarrega a página
        location.reload();

        confirmResetModal.style.display = 'none';
    });

    // Fechar modal clicando fora
    confirmResetModal.addEventListener('click', (e) => {
        if (e.target === confirmResetModal) {
            confirmResetModal.style.display = 'none';
        }
    });

    // Salva dados
    function saveData() {
        const data = {
            name: charNameInput.value,
            health: healthBar.value,
            characterImage: characterImage.querySelector('img')?.src || '',
            strength: strengthInput.value,
            dexterity: dexterityInput.value,
            constitution: constitutionInput.value,
            intelligence: intelligenceInput.value,
            perception: perceptionInput.value
        };

        localStorage.setItem('re1rpg_inventory', JSON.stringify(data));
    }

    // Event Listeners
    characterImage.addEventListener('click', () => {
        imageUpload.click();
    });

    imageUpload.addEventListener('change', function (e) {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = function (event) {
                characterImage.innerHTML = `<img src="${event.target.result}" alt="Personagem">`;
                saveData();
            };
            reader.readAsDataURL(file);
        }
    });

    saveBtn.addEventListener('click', () => {
        saveData();
        alert('Dados do personagem salvos com sucesso!');
    });

    docsBtn.addEventListener('click', () => {
        alert('Documentos serão mostrados aqui');
    });

    mapBtn.addEventListener('click', () => {
        alert('Mapa será aberto aqui');
    });

    healthBar.addEventListener('input', function () {
        healthValue.textContent = `${this.value}/${this.max}`;
        updateHealthBarColor();
        saveData();
    });

    // Listeners para os atributos
    strengthInput.addEventListener('change', updateCalculatedStats);
    dexterityInput.addEventListener('change', updateCalculatedStats);
    constitutionInput.addEventListener('change', updateCalculatedStats);
    intelligenceInput.addEventListener('change', updateCalculatedStats);
    perceptionInput.addEventListener('change', updateCalculatedStats);

    // Listeners para os botões de vida
    increaseHealthBtn.addEventListener('click', () => adjustHealth(1));
    decreaseHealthBtn.addEventListener('click', () => adjustHealth(-1));

    // Inicializa o sistema
    init();
});