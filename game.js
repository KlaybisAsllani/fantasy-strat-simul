class Unit {
  constructor(type, x, y, owner) {
    this.type = type;
    this.x = x;
    this.y = y;
    this.owner = owner;
    const stats = this.getStats();
    this.hp = stats.hp;
    this.attack = stats.attack;
    this.defense = stats.defense;
    this.critChance = stats.critChance;
    this.fabricObject = null;
    this.startX = x; // Store starting position for each move
    this.startY = y;
  }

  getStats() {
    switch (this.type) {
      case 'wizard': return { attack: 8, defense: 2, critChance: 0.3, hp: 5 }; // High attack, low defense, high crit
      case 'thief': return { attack: 5, defense: 7, critChance: 0.1, hp: 10 }; // Balanced, high defense
      case 'archer': return { attack: 6, defense: 3, critChance: 0.2, hp: 6 }; // Medium attack, decent crit
      case 'paladin': return { attack: 4, defense: 8, critChance: 0.05, hp: 12 }; // Tanky, low crit
      case 'rogue': return { attack: 7, defense: 4, critChance: 0.4, hp: 4 }; // High crit, low HP
      default: return { attack: 5, defense: 5, critChance: 0.1, hp: 7 };
    }
  }
}

class Territory {
  constructor(id, x, y, width, height, owner, units) {
    this.id = id;
    this.x = x;
    this.y = y;
    this.width = width;
    this.height = height;
    this.owner = owner;
    this.units = units || 0;
    this.unitList = [];
    this.neighbors = [];
    this.fabricGroup = null;
  }
}

// Global variables
let canvas;
let selectedTerritory = null;
let turnDuration = 0;
let currentTurn = 0;
let territories = [];
let timeLeft = 0;
let timerInterval = null;
let playerColor = '#00ff00'; // Default green
const aiColors = ['#ff0000', '#0000ff', '#ffff00', '#800080']; // Red, Blue, Yellow, Purple (AI1-AI4)
let gameOver = false;

function initializeTerritories() {
  const gridSize = Math.min(window.innerWidth, window.innerHeight);
  const cellSize = gridSize / 3;

  territories = [
    new Territory(1, 0, 0, cellSize, cellSize, 'neutral', 0),
    new Territory(2, cellSize, 0, cellSize, cellSize, 'AI1', 1),
    new Territory(3, 2 * cellSize, 0, cellSize, cellSize, 'neutral', 0),
    new Territory(4, 0, cellSize, cellSize, cellSize, 'AI2', 1),
    new Territory(5, cellSize, cellSize, cellSize, cellSize, 'player', 2),
    new Territory(6, 2 * cellSize, cellSize, cellSize, cellSize, 'AI3', 1),
    new Territory(7, 0, 2 * cellSize, cellSize, cellSize, 'neutral', 0),
    new Territory(8, cellSize, 2 * cellSize, cellSize, cellSize, 'AI4', 1),
    new Territory(9, 2 * cellSize, 2 * cellSize, cellSize, cellSize, 'neutral', 0)
  ];

  // Fixed neighbor connections (these were incorrect)
  territories[0].neighbors = [1, 3, 4];
  territories[1].neighbors = [0, 2, 4];
  territories[2].neighbors = [1, 5];
  territories[3].neighbors = [0, 4, 6];
  territories[4].neighbors = [0, 1, 2, 3, 5, 6, 7, 8];
  territories[5].neighbors = [2, 4, 8];
  territories[6].neighbors = [3, 4, 7];
  territories[7].neighbors = [4, 6, 8];
  territories[8].neighbors = [4, 5, 7];

  // Initialize AI units
  territories.forEach(territory => {
    if (territory.owner.startsWith('AI') && territory.units > 0) {
      const unitTypes = ['wizard', 'thief', 'archer', 'paladin', 'rogue'];
      for (let i = 0; i < territory.units; i++) {
        const randomType = unitTypes[Math.floor(Math.random() * unitTypes.length)];
        territory.unitList.push(new Unit(
          randomType,
          territory.x + territory.width / 2,
          territory.y + territory.height / 2,
          territory.owner
        ));
      }
    }
  });
}

function getColor(owner) {
  if (owner === 'neutral') return 'gray';
  if (owner === 'player') return playerColor;
  const aiIndex = parseInt(owner.replace('AI', '')) - 1; // AI1 -> 0, AI2 -> 1, etc.
  return aiColors[aiIndex];
}

function renderMap() {
  const gridSize = Math.min(window.innerWidth, window.innerHeight);
  const cellSize = gridSize / 3;
  canvas.clear();

  territories.forEach((territory, index) => {
    const row = Math.floor(index / 3);
    const col = index % 3;
    territory.x = col * cellSize;
    territory.y = row * cellSize;
    territory.width = cellSize;
    territory.height = cellSize;

    let rect = new fabric.Rect({
      left: territory.x,
      top: territory.y,
      width: territory.width,
      height: territory.height,
      fill: getColor(territory.owner),
      stroke: 'black',
      strokeWidth: 1,
      selectable: false
    });
    
    let text = new fabric.Text(territory.id + " (" + territory.unitList.length + ")", {
      left: territory.x + territory.width / 2,
      top: territory.y + territory.height / 2,
      fill: "white",
      fontFamily: 'arial',
      fontWeight: 'bold',
      selectable: false,
      originX: 'center',
      originY: 'center'
    });
    
    let group = new fabric.Group([rect, text], {
      selectable: false, // Prevent interaction with territory squares
      hasControls: false,
      hasBorders: false,
      lockMovementX: true,
      lockMovementY: true
    });
    
    group.territory = territory;
    territory.fabricGroup = group;
    
    if (selectedTerritory === territory) {
      rect.set({
        stroke: 'yellow',
        strokeWidth: 3
      });
    }
    
    canvas.add(group);
    renderUnits(territory);
  });

  document.getElementById('playerColorDisplay').style.backgroundColor = playerColor;
  document.getElementById('playerColorIndicator').classList.remove('hidden');
  canvas.requestRenderAll();
}

function renderUnits(territory) {
  // Update territory units count to match unit list
  territory.units = territory.unitList.length;
  
  territory.unitList.forEach((unit, index) => {
    if (!unit.fabricObject) {
      const radius = 10;
      
      // Position units in a circular pattern around territory center
      const angle = (index / territory.unitList.length) * 2 * Math.PI;
      const distance = territory.width / 4;
      const centerX = territory.x + territory.width / 2;
      const centerY = territory.y + territory.height / 2;
      
      unit.x = centerX + Math.cos(angle) * distance;
      unit.y = centerY + Math.sin(angle) * distance;
      unit.startX = unit.x;
      unit.startY = unit.y;
      
      let unitCircle = new fabric.Circle({
        left: unit.x,
        top: unit.y,
        radius: radius,
        fill: getColor(unit.owner),
        stroke: 'black',
        strokeWidth: 2,
        selectable: unit.owner === 'player', // Only player units are selectable
        hasControls: false,
        hasBorders: false
      });
      
      // Add text indicator for unit type
      let unitIndicator = new fabric.Text(unit.type.charAt(0).toUpperCase(), {
        left: unit.x + radius,
        top: unit.y + radius,
        fontSize: 10,
        fill: 'white',
        fontFamily: 'arial',
        fontWeight: 'bold',
        selectable: false,
        originX: 'center',
        originY: 'center'
      });
      
      unitCircle.unit = unit;
      unit.fabricObject = unitCircle;
      canvas.add(unitCircle);
      canvas.add(unitIndicator);
      
      if (unit.owner === 'player') {
        unitCircle.on('mousedown', () => {
          unit.startX = unit.x;
          unit.startY = unit.y;
        });
        
        unitCircle.on('moving', (e) => {
          restrictMovement(unitCircle, territory.width);
          unit.x = unitCircle.left;
          unit.y = unitCircle.top;
          unitIndicator.set({
            left: unit.x + radius,
            top: unit.y + radius
          });
        });
        
        unitCircle.on('mouseup', () => {
          checkUnitTerritory(unit, territory);
          canvas.requestRenderAll();
        });
      }
      
      unitCircle.on('mouseover', () => showUnitStats(unit, unitCircle));
      unitCircle.on('mouseout', () => hideUnitStats());
    } else {
      unit.fabricObject.set({
        left: unit.x,
        top: unit.y
      });
      unit.fabricObject.setCoords();
    }
  });
}

function checkUnitTerritory(unit, originalTerritory) {
  // Find which territory the unit is in now
  const newTerritory = territories.find(territory => 
    unit.x >= territory.x && 
    unit.x <= territory.x + territory.width &&
    unit.y >= territory.y && 
    unit.y <= territory.y + territory.height
  );
  
  if (!newTerritory) {
    // Unit is outside all territories, move it back
    unit.x = unit.startX;
    unit.y = unit.startY;
    unit.fabricObject.set({
      left: unit.x,
      top: unit.y
    });
    return;
  }
  
  if (newTerritory.id !== originalTerritory.id) {
    // Check if the territories are neighbors
    if (!originalTerritory.neighbors.includes(newTerritory.id - 1)) {
      // Not a neighbor, move it back
      unit.x = unit.startX;
      unit.y = unit.startY;
      unit.fabricObject.set({
        left: unit.x,
        top: unit.y
      });
      return;
    }
    
    // Move unit to new territory
    originalTerritory.unitList = originalTerritory.unitList.filter(u => u !== unit);
    newTerritory.unitList.push(unit);
    unit.startX = unit.x;
    unit.startY = unit.y;
  }
}

function restrictMovement(unitCircle, cellSize) {
  const unit = unitCircle.unit;
  const maxDistance = cellSize;
  const startX = unit.startX;
  const startY = unit.startY;
  const newX = unitCircle.left;
  const newY = unitCircle.top;
  const distance = Math.sqrt(Math.pow(newX - startX, 2) + Math.pow(newY - startY, 2));

  if (distance > maxDistance) {
    const angle = Math.atan2(newY - startY, newX - startX);
    unitCircle.set({
      left: startX + Math.cos(angle) * maxDistance,
      top: startY + Math.sin(angle) * maxDistance
    });
  }
}

function showUnitStats(unit, unitCircle) {
  const tooltip = document.getElementById('unitStatsTooltip');
  tooltip.innerHTML = `Type: ${unit.type}<br>Attack: ${unit.attack}<br>Defense: ${unit.defense}<br>Crit Chance: ${(unit.critChance * 100).toFixed(0)}%<br>HP: ${unit.hp.toFixed(1)}`;
  const canvasRect = canvas.upperCanvasEl.getBoundingClientRect();
  
  tooltip.style.left = (canvasRect.left + unitCircle.left + unitCircle.radius + 10) + 'px';
  tooltip.style.top = (canvasRect.top + unitCircle.top) + 'px';
  tooltip.classList.remove('hidden');
}

function hideUnitStats() {
  document.getElementById('unitStatsTooltip').classList.add('hidden');
}

function checkCombat() {
  let battles = [];
  
  territories.forEach(territory => {
    const owners = [...new Set(territory.unitList.map(unit => unit.owner))];
    
    if (owners.length > 1) {
      // Combat happens when multiple owners have units in the same territory
      battles.push({
        territory,
        unitsAtPos: territory.unitList
      });
    }
  });
  
  return battles;
}

function resolveCombat(territory, unitsAtPos) {
  const owners = [...new Set(unitsAtPos.map(u => u.owner))];
  let totalForces = owners.map(owner => ({
    owner,
    units: unitsAtPos.filter(u => u.owner === owner),
    totalAttack: unitsAtPos.filter(u => u.owner === owner).reduce((sum, unit) => sum + unit.attack, 0),
    totalDefense: unitsAtPos.filter(u => u.owner === owner).reduce((sum, unit) => sum + unit.defense, 0)
  }));

  // Process combat until only one (or zero) force remains
  while (totalForces.length > 1) {
    // Randomize order of combat
    totalForces.sort(() => Math.random() - 0.5);
    
    // Get two forces to battle
    const [forceA, forceB] = [totalForces[0], totalForces[1]];
    
    // Combat calculation with randomness and crits
    const rngFactor = Math.random() * 0.5 + 0.75; // 0.75 to 1.25 random factor
    
    // Determine critical hits for each force's first unit
    const critA = Math.random() < forceA.units[0].critChance ? 1.5 : 1;
    const critB = Math.random() < forceB.units[0].critChance ? 1.5 : 1;
    
    // Calculate damage dealt by each force (attack - defense, minimum 1)
    const damageAtoB = Math.max(1, forceA.totalAttack * rngFactor * critA - forceB.totalDefense * 0.5);
    const damageBtoA = Math.max(1, forceB.totalAttack * rngFactor * critB - forceA.totalDefense * 0.5);
    
    // Apply damage to all units in each force
    forceA.units.forEach(unit => {
      unit.hp -= damageBtoA / forceA.units.length;
      if (unit.hp <= 0) {
        if (unit.fabricObject) {
          canvas.remove(unit.fabricObject);
        }
        // Remove dead units
        forceA.units = forceA.units.filter(u => u !== unit);
      }
    });
    
    forceB.units.forEach(unit => {
      unit.hp -= damageAtoB / forceB.units.length;
      if (unit.hp <= 0) {
        if (unit.fabricObject) {
          canvas.remove(unit.fabricObject);
        }
        // Remove dead units
        forceB.units = forceB.units.filter(u => u !== unit);
      }
    });
    
    // Update forces list, removing any forces with no units left
    totalForces = totalForces.filter(force => force.units.length > 0);
    
    // Recalculate stats for remaining forces
    if (forceA.units.length > 0) {
      forceA.totalAttack = forceA.units.reduce((sum, unit) => sum + unit.attack, 0);
      forceA.totalDefense = forceA.units.reduce((sum, unit) => sum + unit.defense, 0);
    }
    
    if (forceB.units.length > 0) {
      forceB.totalAttack = forceB.units.reduce((sum, unit) => sum + unit.attack, 0);
      forceB.totalDefense = forceB.units.reduce((sum, unit) => sum + unit.defense, 0);
    }
  }
  
  // Update territory ownership based on combat result
  if (totalForces.length === 1) {
    const winner = totalForces[0];
    territory.owner = winner.owner;
    territory.unitList = winner.units;
  } else {
    // No units left, territory becomes neutral
    territory.owner = 'neutral';
    territory.unitList = [];
  }
  
  // Check if player has lost
  checkWinLossState();
}

function checkWinLossState() {
  if (gameOver) return;
  
  const playerTerritories = territories.filter(t => t.owner === 'player');
  const aiTerritories = territories.filter(t => t.owner.startsWith('AI'));
  
  if (playerTerritories.length === 0) {
    gameOver = true;
    clearInterval(timerInterval);
    document.getElementById('gameCanvasContainer').classList.add('hidden');
    document.getElementById('resultScreen').classList.remove('hidden');
    document.getElementById('resultMessage').textContent = "You Lost! All your territories have been captured.";
    return;
  }
  
  if (aiTerritories.length === 0) {
    gameOver = true;
    clearInterval(timerInterval);
    document.getElementById('gameCanvasContainer').classList.add('hidden');
    document.getElementById('resultScreen').classList.remove('hidden');
    document.getElementById('resultMessage').textContent = "You Won! You've conquered all AI territories.";
    return;
  }
}

function buildUnits(territory) {
  if (territory.owner !== 'player') return;
  
  selectedTerritory = territory;
  document.getElementById('buildUnitsMenu').classList.remove('hidden');
  
  // Reset unit counts
  document.querySelectorAll('.unit-count').forEach(el => {
    el.textContent = '0';
  });
  
  // Update max units based on territory size
  const maxUnits = 5 - territory.unitList.length;
  document.getElementById('maxUnitsLabel').textContent = `(Max: ${maxUnits})`;
  
  if (maxUnits <= 0) {
    document.getElementById('spawnUnits').disabled = true;
    document.getElementById('maxUnitsLabel').textContent += " - Territory Full";
  } else {
    document.getElementById('spawnUnits').disabled = false;
  }
}

function getTotalUnits() {
  const wizardCount = parseInt(document.querySelector('[data-unit="wizard"].unit-count').textContent, 10) || 0;
  const thiefCount = parseInt(document.querySelector('[data-unit="thief"].unit-count').textContent, 10) || 0;
  const archerCount = parseInt(document.querySelector('[data-unit="archer"].unit-count').textContent, 10) || 0;
  const paladinCount = parseInt(document.querySelector('[data-unit="paladin"].unit-count').textContent, 10) || 0;
  const rogueCount = parseInt(document.querySelector('[data-unit="rogue"].unit-count').textContent, 10) || 0;
  return wizardCount + thiefCount + archerCount + paladinCount + rogueCount;
}

function spawnUnits(territory) {
  const wizardCount = parseInt(document.querySelector('[data-unit="wizard"].unit-count').textContent, 10) || 0;
  const thiefCount = parseInt(document.querySelector('[data-unit="thief"].unit-count').textContent, 10) || 0;
  const archerCount = parseInt(document.querySelector('[data-unit="archer"].unit-count').textContent, 10) || 0;
  const paladinCount = parseInt(document.querySelector('[data-unit="paladin"].unit-count').textContent, 10) || 0;
  const rogueCount = parseInt(document.querySelector('[data-unit="rogue"].unit-count').textContent, 10) || 0;
  const totalUnits = wizardCount + thiefCount + archerCount + paladinCount + rogueCount;
  
  // Check if territory has room for new units
  const maxNewUnits = 5 - territory.unitList.length;
  
  if (totalUnits > maxNewUnits || totalUnits === 0) {
    alert(`You can add between 1 and ${maxNewUnits} units to this territory.`);
    return;
  }
  
  // Add units to territory
  const centerX = territory.x + territory.width / 2;
  const centerY = territory.y + territory.height / 2;
  
  for (let i = 0; i < wizardCount; i++) {
    territory.unitList.push(new Unit('wizard', centerX, centerY, 'player'));
  }
  
  for (let i = 0; i < thiefCount; i++) {
    territory.unitList.push(new Unit('thief', centerX, centerY, 'player'));
  }
  
  for (let i = 0; i < archerCount; i++) {
    territory.unitList.push(new Unit('archer', centerX, centerY, 'player'));
  }
  
  for (let i = 0; i < paladinCount; i++) {
    territory.unitList.push(new Unit('paladin', centerX, centerY, 'player'));
  }
  
  for (let i = 0; i < rogueCount; i++) {
    territory.unitList.push(new Unit('rogue', centerX, centerY, 'player'));
  }
  
  // Reset build menu and render map
  document.querySelector('[data-unit="wizard"].unit-count').textContent = '0';
  document.querySelector('[data-unit="thief"].unit-count').textContent = '0';
  document.querySelector('[data-unit="archer"].unit-count').textContent = '0';
  document.querySelector('[data-unit="paladin"].unit-count').textContent = '0';
  document.querySelector('[data-unit="rogue"].unit-count').textContent = '0';
  document.getElementById('buildUnitsMenu').classList.add('hidden');
  
  renderMap();
}

function closeBuildMenu() {
  document.getElementById('buildUnitsMenu').classList.add('hidden');
  selectedTerritory = null;
  renderMap();
}

function startTurnTimer() {
  timeLeft = turnDuration;
  document.getElementById('timeLeft').textContent = timeLeft;
  document.getElementById('timer').classList.remove('hidden');
  document.getElementById('currentTurn').textContent = `Turn: ${currentTurn + 1}`;
  
  clearInterval(timerInterval);
  timerInterval = setInterval(() => {
    timeLeft--;
    document.getElementById('timeLeft').textContent = timeLeft;
    if (timeLeft <= 0) {
      clearInterval(timerInterval);
      endTurn();
    }
  }, 1000);
}

function aiTurn() {
  // Step 1: Build units for AI territories
  territories.forEach(territory => {
    if (territory.owner.startsWith('AI') && territory.unitList.length < 3) {
      const spawnCount = Math.min(3 - territory.unitList.length, 1 + Math.floor(Math.random() * 2));
      const unitTypes = ['wizard', 'thief', 'archer', 'paladin', 'rogue'];
      
      for (let i = 0; i < spawnCount; i++) {
        const unitType = unitTypes[Math.floor(Math.random() * unitTypes.length)];
        territory.unitList.push(new Unit(
          unitType, 
          territory.x + territory.width / 2, 
          territory.y + territory.height / 2, 
          territory.owner
        ));
      }
    }
  });
  
  // Step 2: Move units for AI territories
  territories.forEach(territory => {
    if (territory.owner.startsWith('AI') && territory.unitList.length > 0) {
      // Find neighbor territories to attack (prioritize player territories)
      const neighborIds = territory.neighbors;
      const neighborTerritories = neighborIds.map(id => territories[id]);
      
      // Sort neighbors: first player, then neutral, then other AI
      const playerNeighbors = neighborTerritories.filter(t => t.owner === 'player');
      const neutralNeighbors = neighborTerritories.filter(t => t.owner === 'neutral');
      const aiNeighbors = neighborTerritories.filter(t => t.owner.startsWith('AI') && t.owner !== territory.owner);
      
      const targetTerritories = [...playerNeighbors, ...neutralNeighbors, ...aiNeighbors];
      
      if (targetTerritories.length > 0) {
        // Decide how many units to move (keep at least 1 unit at home if possible)
        const unitsToMove = territory.unitList.length > 1 ? 
          Math.floor(territory.unitList.length / 2) + Math.floor(Math.random() * (territory.unitList.length / 2)) : 
          territory.unitList.length;
        
        // Choose a random target from the prioritized list
        const targetIndex = Math.floor(Math.random() * Math.min(2, targetTerritories.length));
        const targetTerritory = targetTerritories[targetIndex];
        
        // Move units to target territory
        for (let i = 0; i < unitsToMove; i++) {
          if (territory.unitList.length > 0) {
            const unitToMove = territory.unitList.pop();
            unitToMove.x = targetTerritory.x + targetTerritory.width / 2;
            unitToMove.y = targetTerritory.y + targetTerritory.height / 2;
            unitToMove.startX = unitToMove.x;
            unitToMove.startY = unitToMove.y;
            targetTerritory.unitList.push(unitToMove);
          }
        }
      }
    }
  });
}

function endTurn() {
  if (gameOver) return;
  
  document.getElementById('timer').classList.add('hidden');
  
  // Resolve combat in all territories
  const battles = checkCombat();
  battles.forEach(battle => {
    resolveCombat(battle.territory, battle.unitsAtPos);
  });
  
  // AI turn actions
  aiTurn();
  
  // Resolve any new combat from AI movements
  const aiBattles = checkCombat();
  aiBattles.forEach(battle => {
    resolveCombat(battle.territory, battle.unitsAtPos);
  });
  
  // Update the map
  renderMap();
  
  // Start next turn
  currentTurn++;
  startTurnTimer();
}

function attachEventListeners() {
  document.querySelectorAll('.unit-count-increase').forEach(button => {
    button.addEventListener('click', () => {
      const unitType = button.getAttribute('data-unit');
      const countElement = document.querySelector(`.unit-count[data-unit="${unitType}"]`);
      let count = parseInt(countElement.textContent, 10) || 0;
      const totalUnits = getTotalUnits();
      
      // Get max allowed units for this territory
      const maxUnits = selectedTerritory ? 
        5 - selectedTerritory.unitList.length : 5;
      
      if (count < 5 && totalUnits < maxUnits) {
        count++;
        countElement.textContent = count;
      }
    });
  });

  document.querySelectorAll('.unit-count-decrease').forEach(button => {
    button.addEventListener('click', () => {
      const unitType = button.getAttribute('data-unit');
      const countElement = document.querySelector(`.unit-count[data-unit="${unitType}"]`);
      let count = parseInt(countElement.textContent, 10) || 0;
      if (count > 0) {
        count--;
        countElement.textContent = count;
      }
    });
  });

  document.getElementById('spawnUnits').addEventListener('click', () => {
    if (selectedTerritory) {
      spawnUnits(selectedTerritory);
    } else {
      alert("No territory selected!");
    }
  });

  document.getElementById('closeBuildMenu').addEventListener('click', () => {
    closeBuildMenu();
  });

  document.getElementById('startGame').addEventListener('click', () => {
    playerColor = document.getElementById('playerColor').value;
    turnDuration = parseInt(document.getElementById('turnDuration').value);
    
    if (isNaN(turnDuration) || turnDuration < 10 || turnDuration > 120) {
      alert("Please enter a valid turn duration between 10 and 120 seconds.");
      return;
    }
    
    document.getElementById('setupScreen').classList.add('hidden');
    document.getElementById('gameCanvasContainer').classList.remove('hidden');
    document.getElementById('turnControls').classList.remove('hidden');
    document.getElementById('playerColorIndicator').classList.remove('hidden');
    
    initializeTerritories();
    renderMap();
    startTurnTimer();
  });

  document.getElementById('endTurn').addEventListener('click', () => {
    clearInterval(timerInterval);
    endTurn();
  });

  document.getElementById('restart').addEventListener('click', () => {
    location.reload();
  });

  canvas.on('mouse:down', function (e) {
    if (e.target && e.target.territory) {
      const clickedTerritory = e.target.territory;
      if (clickedTerritory.owner === 'player') {
        if (selectedTerritory === clickedTerritory) {
          selectedTerritory = null;
          document.getElementById('buildUnitsMenu').classList.add('hidden');
        } else {
          selectedTerritory = clickedTerritory;
          buildUnits(clickedTerritory);
        }
        renderMap();
      }
    }
  });

  window.addEventListener('resize', () => {
    const gridSize = Math.min(window.innerWidth, window.innerHeight);
    canvas.setWidth(gridSize);
    canvas.setHeight(gridSize);
    renderMap();
  });
}

document.addEventListener('DOMContentLoaded', function() {
  canvas = new fabric.Canvas('gameCanvas');
  const gridSize = Math.min(window.innerWidth, window.innerHeight);
  canvas.setWidth(gridSize);
  canvas.setHeight(gridSize);
  
  // Create DOM elements
  const unitStatsTooltip = document.createElement('div');
  unitStatsTooltip.id = 'unitStatsTooltip';
  unitStatsTooltip.className = 'tooltip hidden';
  document.body.appendChild(unitStatsTooltip);
  
  // Add touch support for mobile devices
  canvas.on('touch:start', function(e) {
    canvas._handleEvent(e, 'mouse:down');
  });
  
  canvas.on('touch:move', function(e) {
    canvas._handleEvent(e, 'mouse:move');
  });
  
  canvas.on('touch:end', function(e) {
    canvas._handleEvent(e, 'mouse:up');
  });
  
  // Attach all event listeners
  attachEventListeners();
 });