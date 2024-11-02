// Constants
const line_length = 8;
const column_length = 32;
const PADDING = 40;
let highlightedHexagons = [];
let selectedHexagons = []; 
let isSelecting = false;   
const SELECTION_SENSITIVITY = 0.8; // 1.0 means full radius, smaller values make selection more strict
const DEFAULT_DECAY_RATE = 0.1;  // Normal decay rate (amount of color lost per frame)
let CURRENT_DECAY_RATE = DEFAULT_DECAY_RATE;  // Current decay rate that can be modified for debugging
let DEBUG_DECAY_RATE = 1.0;  // Faster decay rate for debugging (10x faster)
// Echo-related constants
const DEFAULT_ECHO_PERIOD = 20000;  // 20 seconds between echoes
const DEFAULT_ECHO_DECAY = 0.8;    // Each echo is 80% as intense as the previous
let CURRENT_ECHO_PERIOD = DEFAULT_ECHO_PERIOD;
let CURRENT_ECHO_DECAY = DEFAULT_ECHO_DECAY;
let DEBUG_ECHO_PERIOD = 500;      // Faster echoes for debugging
let DEBUG_ECHO_DECAY = 0.5;       // Faster intensity decay for debugging



// Color palette
const COLOR_PALETTE = [
    [64, 224, 208],  // Turquoise
    [92, 182, 224],  // Sky Blue
    [130, 150, 227], // Periwinkle
    [155, 127, 216]  // Soft Purple
];

class Hexagon {
    constructor(x, y, diameter, color = [0, 0, 0]) {
        this.position = { x, y };
        this.color = color;
        this.intensity = 255;
        this.diameter = diameter;
        this.isHighlighted = false;
        this.highlightColor = [255, 255, 0, 100];
        this.eventHistory = [];
        this.isDecaying = false;
        this.originalColor = [...color];
        this.echoTimers = [];  // Store echo timers for this hexagon
        this.lastEchoTime = 0; // Track when the last echo occurred
    }

    startDecay() {
        this.isDecaying = true;
        this.intensity = 255;
        this.originalColor = [...this.color];
        this.lastEchoTime = Date.now();
    }

    recordCycleEvent(colorIndex, cycleId) {
        const timestamp = Date.now(); // Use numeric timestamp for easier calculations
        const event = {
            timestamp: timestamp,
            colorIndex: colorIndex,
            cycleId: cycleId,
            originalIntensity: 255
        };
        this.eventHistory.push(event);
        this.setupEcho(event);
        
        console.log(`Hexagon at (${this.position.x}, ${this.position.y}) - New cycle event:`, 
                    `Timestamp: ${new Date(timestamp).toISOString()}`, 
                    `Color Index: ${colorIndex}`,
                    `Cycle ID: ${cycleId}`);
    }

    setupEcho(event) {
        const startEcho = () => {
            const age = Date.now() - event.timestamp;
            const echoCount = Math.floor(age / CURRENT_ECHO_PERIOD);
            const intensity = 255 * Math.pow(CURRENT_ECHO_DECAY, echoCount);
            
            // Only echo if intensity is still visible
            if (intensity > 1) {
                this.triggerEcho(event.colorIndex, intensity);
                setTimeout(startEcho, CURRENT_ECHO_PERIOD);
            }
        };

        // Start the echo cycle
        setTimeout(startEcho, CURRENT_ECHO_PERIOD);
    }

    triggerEcho(colorIndex, intensity) {
        // Only trigger echo if not already in a more intense state
        if (!this.isDecaying || this.intensity < intensity) {
            this.color = [...COLOR_PALETTE[colorIndex]];
            this.intensity = intensity;
            this.isDecaying = true;
            this.lastEchoTime = Date.now();
        }
    }

    updateDecay() {
        if (this.isDecaying) {
            let stillDecaying = false;
            
            // Calculate time since last echo
            const timeSinceEcho = Date.now() - this.lastEchoTime;
            
            // Only decay after a short delay to show the echo
            if (timeSinceEcho > 100) {  // 100ms delay before starting decay
                for (let i = 0; i < 3; i++) {
                    if (this.color[i] > 0) {
                        this.color[i] = Math.max(0, this.color[i] - CURRENT_DECAY_RATE);
                        stillDecaying = true;
                    }
                }
                
                if (!stillDecaying) {
                    this.isDecaying = false;
                    this.color = [0, 0, 0];
                }
            }
        }
    }

    render() {
        this.updateDecay();

        push();
        if (this.isHighlighted) {
            fill(this.highlightColor[0], this.highlightColor[1], 
                 this.highlightColor[2], this.highlightColor[3]);
        } else {
            fill(this.color[0], this.color[1], this.color[2], this.intensity);
        }
        stroke(255);
        strokeWeight(1);
        translate(this.position.x, this.position.y);
        
        beginShape();
        for (let i = 0; i < 6; i++) {
            let angle = TWO_PI / 6 * i - TWO_PI / 12;
            let x = cos(angle) * this.diameter / 2;
            let y = sin(angle) * this.diameter / 2;
            vertex(x, y);
        }
        endShape(CLOSE);
        pop();
    }
}

class Grid {
    constructor() {
        this.hexagons = {};
        this.dualGraph = {};
        this.cycleCounter = 0;  // Add a counter to generate unique cycle IDs
        this.init();
        this.initDualGraph();
    }

    init() {
        const horizontalSpacing = (width - 2 * PADDING) / (column_length + 0.5);
        const verticalSpacing = (height - 2 * PADDING) / (line_length * 0.75 + 0.25);
        const diameter = min(horizontalSpacing * 2 / sqrt(3), verticalSpacing);

        for (let i = 0; i < line_length; i++) {
            for (let j = 0; j < column_length; j++) {
                const x = PADDING + j * diameter * sqrt(3)/2 + (i % 2) * diameter * sqrt(3)/4;
                const y = PADDING + i * diameter * 3/4;
                this.hexagons[`${i},${j}`] = new Hexagon(x, y, diameter);
            }
        }
    }

    initDualGraph() {
        for (let i = 0; i < line_length; i++) {
            for (let j = 0; j < column_length; j++) {
                const neighbors = this.getNeighborCoordinates(i, j);
                this.dualGraph[`${i},${j}`] = neighbors;
            }
        }
    }

    getNeighborCoordinates(i, j) {
        const isOddRow = i % 2 === 1;
        const neighbors = [];
        const neighborOffsets = isOddRow ? [
            [-1, 0], [-1, 1], [0, -1], [0, 1], [1, 0], [1, 1]
        ] : [
            [-1, -1], [-1, 0], [0, -1], [0, 1], [1, -1], [1, 0]
        ];

        for (let [di, dj] of neighborOffsets) {
            let newI = (i + di + line_length) % line_length;
            let newJ = (j + dj + column_length) % column_length;
            neighbors.push(`${newI},${newJ}`);
        }
        return neighbors;
    }

    getHexagonAtPoint(x, y) {
        const diameter = Object.values(this.hexagons)[0].diameter;
        const radius = diameter / 2;
        // Calculate selection threshold based on sensitivity
        const selectionThreshold = radius * SELECTION_SENSITIVITY;
        
        const col = Math.floor((x - PADDING) / (diameter * sqrt(3)/2));
        const row = Math.floor((y - PADDING) / (diameter * 3/4));
        
        // Check nearby hexagons
        for (let i = max(0, row - 1); i <= min(line_length - 1, row + 1); i++) {
            for (let j = max(0, col - 1); j <= min(column_length - 1, col + 1); j++) {
                const hexagon = this.hexagons[`${i},${j}`];
                if (hexagon) {
                    const dx = x - hexagon.position.x;
                    const dy = y - hexagon.position.y;
                    const distance = sqrt(dx * dx + dy * dy);
                    // Use selectionThreshold instead of full radius
                    if (distance <= selectionThreshold) {
                        return [i, j];
                    }
                }
            }
        }
        return null;
    }

    areNeighbors(pos1, pos2) {
        const [i1, j1] = pos1;
        const [i2, j2] = pos2;
        const key1 = `${i1},${j1}`;
        const key2 = `${i2},${j2}`;
        const neighbors = this.dualGraph[key1];
        return neighbors.includes(key2);
    }

    countConnectionsInSequence(position) {
        const [i, j] = position;
        let connections = 0;
        selectedHexagons.forEach(otherPos => {
            if (otherPos[0] !== i || otherPos[1] !== j) {
                if (this.areNeighbors(position, otherPos)) {
                    connections++;
                }
            }
        });
        return connections;
    }

    checkCycle() {
        if (selectedHexagons.length <=3) {
            return false;
        }

        for (let i = 0; i < selectedHexagons.length - 1; i++) {
            if (!this.areNeighbors(selectedHexagons[i], selectedHexagons[i + 1])) {
                return false;
            }
        }

        const first = selectedHexagons[0];
        const last = selectedHexagons[selectedHexagons.length - 1];
        if (!this.areNeighbors(last, first)) {
            return false;
        }

        for (let pos of selectedHexagons) {
            if (this.countConnectionsInSequence(pos) !== 2) {
                return false;
            }
        }

        return true;
    }

    colorCycle() {
        this.cycleCounter++;  // Increment counter for new cycle
        const cycleId = this.cycleCounter;
        
        selectedHexagons.forEach(([i, j]) => {
            const hex = this.hexagons[`${i},${j}`];
            let currentColorIndex = COLOR_PALETTE.findIndex(color => 
                color[0] === hex.color[0] && 
                color[1] === hex.color[1] && 
                color[2] === hex.color[2]
            );
            
            const nextColorIndex = (currentColorIndex + 1) % COLOR_PALETTE.length;
            hex.color = [...COLOR_PALETTE[nextColorIndex]];
            hex.intensity = 255;
            hex.isHighlighted = false;
            
            // Start decay and record event with cycle ID
            hex.startDecay();
            hex.recordCycleEvent(nextColorIndex, cycleId);
        });
    }


    handleCycleValidation() {
        console.log("Handling cycle validation");  // Debug log
        const isCycle = this.checkCycle();
        console.log("Is valid cycle:", isCycle);  // Debug log
        
        if (!isCycle) {
            this.flashSelection(() => {
                this.clearSelection();
            });
        } else {
            this.colorCycle();
            this.clearSelection();
        }
    }

    flashSelection(callback) {
        console.log("Flashing selection");  // Debug log
        const flashCount = 2;
        const flashDuration = 200;
        let flashes = 0;
        
        const flash = () => {
            selectedHexagons.forEach(([i, j]) => {
                const hex = this.hexagons[`${i},${j}`];
                if (hex) {
                    hex.isHighlighted = !hex.isHighlighted;
                    console.log(`Hexagon ${i},${j} highlight: ${hex.isHighlighted}`);  // Debug log
                }
            });
            
            flashes++;
            if (flashes < flashCount * 2) {
                setTimeout(flash, flashDuration);
            } else {
                if (callback) callback();
            }
        };
        
        flash();
    }

    clearSelection() {
        console.log("Clearing selection");  // Debug log
        selectedHexagons.forEach(([i, j]) => {
            const hex = this.hexagons[`${i},${j}`];
            if (hex) {
                hex.isHighlighted = false;
                hex.highlightColor = [255, 255, 0, 100];
            }
        });
        
        highlightedHexagons.forEach(key => {
            if (this.hexagons[key]) {
                this.hexagons[key].isHighlighted = false;
            }
        });
        
        highlightedHexagons = [];
        selectedHexagons = [];
    }

    highlightSelection() {
        selectedHexagons.forEach(([i, j], index) => {
            const hexagon = this.hexagons[`${i},${j}`];
            if (hexagon) {
                hexagon.isHighlighted = true;
                hexagon.highlightColor = [255, 255, 0, 100];
                
                if (index < selectedHexagons.length - 1) {
                    const nextHex = this.hexagons[`${selectedHexagons[index + 1][0]},${selectedHexagons[index + 1][1]}`];
                    push();
                    stroke(0, 0, 255);
                    strokeWeight(2);
                    line(hexagon.position.x, hexagon.position.y, 
                         nextHex.position.x, nextHex.position.y);
                    pop();
                }
                
                if (index === selectedHexagons.length - 1 && 
                    this.areNeighbors(selectedHexagons[0], selectedHexagons[selectedHexagons.length - 1])) {
                    const firstHex = this.hexagons[`${selectedHexagons[0][0]},${selectedHexagons[0][1]}`];
                    push();
                    stroke(0, 0, 255);
                    strokeWeight(2);
                    line(hexagon.position.x, hexagon.position.y, 
                         firstHex.position.x, firstHex.position.y);
                    pop();
                }
            }
        });
    }

    render() {
        for (let hexagon of Object.values(this.hexagons)) {
            hexagon.render();
        }
    }

    resize() {
        this.init();
        this.initDualGraph();
    }
}

let grid;

function setup() {
    createCanvas(windowWidth, windowHeight);
    grid = new Grid();
}

function draw() {
    // Using RGB values for dark grey (40, 40, 40)
    background(40);  // Changed from background(255) to background(40)
    grid.render();
    
    if (selectedHexagons.length > 0) {
        grid.highlightSelection();
    }
}

function mousePressed() {
    isSelecting = true;
    selectedHexagons = [];
    
    const clicked = grid.getHexagonAtPoint(mouseX, mouseY);
    if (clicked) {
        selectedHexagons.push(clicked);
        grid.highlightSelection();
    }
}w

function mouseDragged() {
    if (!isSelecting) return;
    
    const current = grid.getHexagonAtPoint(mouseX, mouseY);
    if (current) {
        const lastSelected = selectedHexagons[selectedHexagons.length - 1];
        if (!lastSelected || 
            current[0] !== lastSelected[0] || 
            current[1] !== lastSelected[1]) {
            selectedHexagons.push(current);
            grid.highlightSelection();
        }
    }
}

function mouseReleased() {
    if (isSelecting) {
        isSelecting = false;
        grid.handleCycleValidation();
    }
}

// Update key press handler
function keyPressed() {
    if (key === 'd' || key === 'D') {
        toggleDebugMode();
    }
}

function windowResized() {
    resizeCanvas(windowWidth, windowHeight);
    grid.resize();
}


// Function to toggle debug mode for both decay and echo
function toggleDebugMode() {
    if (CURRENT_DECAY_RATE === DEFAULT_DECAY_RATE) {
        CURRENT_DECAY_RATE = DEBUG_DECAY_RATE;
        CURRENT_ECHO_PERIOD = DEBUG_ECHO_PERIOD;
        CURRENT_ECHO_DECAY = DEBUG_ECHO_DECAY;
        console.log("Debug mode activated");
    } else {
        CURRENT_DECAY_RATE = DEFAULT_DECAY_RATE;
        CURRENT_ECHO_PERIOD = DEFAULT_ECHO_PERIOD;
        CURRENT_ECHO_DECAY = DEFAULT_ECHO_DECAY;
        console.log("Normal mode restored");
    }
}

