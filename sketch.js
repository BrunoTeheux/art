// Constants
const line_length = 8;
const column_length = 32;
const PADDING = 40;
let showNeighbors = false;
let highlightedHexagons = [];
let highlightTimer = null;
let selectedHexagons = []; // Store sequence of selected hexagon coordinates
let isSelecting = false;   // Track if user is currently selecting

// Color palette
const COLOR_PALETTE = [
    [64, 224, 208],  // Turquoise
    [92, 182, 224],  // Sky Blue
    [130, 150, 227], // Periwinkle
    [155, 127, 216]  // Soft Purple
];

class Hexagon {
    constructor(x, y, diameter, color = [128, 128, 128]) {
        this.position = { x, y };
        this.color = color;
        this.intensity = 50;
        this.diameter = diameter;
        this.past = [];
        this.isHighlighted = false;
        this.highlightColor = [255, 255, 0, 100]; // Default highlight color
    }

    render() {
        push();
        if (this.isHighlighted) {
            fill(this.highlightColor[0], this.highlightColor[1], 
                 this.highlightColor[2], this.highlightColor[3]);
        } else {
            fill(this.color[0], this.color[1], this.color[2], this.intensity);
        }
        stroke(0);
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
        
        const col = Math.floor((x - PADDING) / (diameter * sqrt(3)/2));
        const row = Math.floor((y - PADDING) / (diameter * 3/4));
        
        for (let i = max(0, row - 1); i <= min(line_length - 1, row + 1); i++) {
            for (let j = max(0, col - 1); j <= min(column_length - 1, col + 1); j++) {
                const hexagon = this.hexagons[`${i},${j}`];
                if (hexagon) {
                    const dx = x - hexagon.position.x;
                    const dy = y - hexagon.position.y;
                    const distance = sqrt(dx * dx + dy * dy);
                    if (distance <= diameter / 2) {
                        return [i, j];
                    }
                }
            }
        }
        return null;
    }

    highlightNeighbors(i, j) {
        this.clearHighlights();
        
        const neighborKeys = this.dualGraph[`${i},${j}`];
        
        this.hexagons[`${i},${j}`].isHighlighted = true;
        highlightedHexagons.push(`${i},${j}`);
        
        neighborKeys.forEach(key => {
            this.hexagons[key].isHighlighted = true;
            highlightedHexagons.push(key);
        });

        if (highlightTimer) clearTimeout(highlightTimer);
        highlightTimer = setTimeout(() => this.clearHighlights(), 1000);
    }

    clearHighlights() {
        highlightedHexagons.forEach(key => {
            if (this.hexagons[key]) {
                this.hexagons[key].isHighlighted = false;
            }
        });
        highlightedHexagons = [];
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
        // Check if two hexagons are neighbors in the dual graph
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
            
            // Count how many other hexagons in the sequence are neighbors of this one
            selectedHexagons.forEach(otherPos => {
                if (otherPos[0] !== i || otherPos[1] !== j) { // Don't count self
                    if (this.areNeighbors(position, otherPos)) {
                        connections++;
                    }
                }
            });
            
            return connections;
        }
    
        // Modified checkCycle method with degree validation
        checkCycle() {
            if (selectedHexagons.length < 4) {
                console.log("Sequence too short to form a cycle");
                return false;
            }
    
            // First check if all consecutive hexagons are neighbors
            for (let i = 0; i < selectedHexagons.length - 1; i++) {
                const current = selectedHexagons[i];
                const next = selectedHexagons[i + 1];
                if (!this.areNeighbors(current, next)) {
                    console.log(`Break in cycle: ${current} and ${next} are not neighbors`);
                    return false;
                }
            }
    
            // Check if last and first hexagons are neighbors to close the cycle
            const first = selectedHexagons[0];
            const last = selectedHexagons[selectedHexagons.length - 1];
            if (!this.areNeighbors(last, first)) {
                console.log(`Cycle not closed: ${last} and ${first} are not neighbors`);
                return false;
            }
    
            // Check degree condition for each hexagon in the sequence
            for (let pos of selectedHexagons) {
                const degree = this.countConnectionsInSequence(pos);
                if (degree !== 2) {
                    console.log(`Invalid degree at position ${pos}: degree = ${degree}, expected 2`);
                    return false;
                }
            }
    
            console.log("Valid cycle found with all degrees = 2!", selectedHexagons);
            return true;
        }
    
        // Modified highlightSelection to show degree violations
        highlightSelection() {
            // Clear any existing highlights
            this.clearHighlights();
            
            // Calculate degrees for visual feedback
            const degrees = new Map(
                selectedHexagons.map(pos => [
                    `${pos[0]},${pos[1]}`, 
                    this.countConnectionsInSequence(pos)
                ])
            );
            
            // Highlight selected hexagons
            selectedHexagons.forEach(([i, j], index) => {
                const hexagon = this.hexagons[`${i},${j}`];
                if (hexagon) {
                    // Color based on degree
                    const degree = degrees.get(`${i},${j}`);
                    if (degree > 2) {
                        hexagon.isHighlighted = true;
                        hexagon.highlightColor = [255, 0, 0, 100]; // Red for too many connections
                    } else if (degree < 2) {
                        hexagon.isHighlighted = true;
                        hexagon.highlightColor = [255, 165, 0, 100]; // Orange for too few connections
                    } else {
                        hexagon.isHighlighted = true;
                        hexagon.highlightColor = [255, 255, 0, 100]; // Yellow for correct degree
                    }
                    
                    // Draw connection lines between consecutive hexagons
                    if (index < selectedHexagons.length - 1) {
                        const nextHex = this.hexagons[`${selectedHexagons[index + 1][0]},${selectedHexagons[index + 1][1]}`];
                        push();
                        stroke(0, 0, 255);
                        strokeWeight(2);
                        line(hexagon.position.x, hexagon.position.y, 
                             nextHex.position.x, nextHex.position.y);
                        pop();
                    }
                    
                    // If last hexagon and potentially valid cycle, draw closing line
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
    }
    

let grid;

function setup() {
    createCanvas(windowWidth, windowHeight);
    grid = new Grid();
}

function draw() {
    background(255);
    grid.render();
    
    // Draw selection lines on top
    if (selectedHexagons.length > 0) {
        grid.highlightSelection();
    }
}

function windowResized() {
    resizeCanvas(windowWidth, windowHeight);
    grid.resize();
}

function mousePressed() {
    isSelecting = true;
    selectedHexagons = []; // Clear previous selection
    
    const clicked = grid.getHexagonAtPoint(mouseX, mouseY);
    if (clicked) {
        selectedHexagons.push(clicked);
        grid.highlightSelection();
    }
}
function mouseDragged() {
    if (!isSelecting) return;
    
    const current = grid.getHexagonAtPoint(mouseX, mouseY);
    if (current) {
        // Only add if it's different from the last selected hexagon
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
        const isCycle = grid.checkCycle();
        console.log(`Selection complete, is valid cycle: ${isCycle}`);
        if (!isCycle) {
            // Clear selection after a short delay
            setTimeout(() => {
                selectedHexagons = [];
                grid.clearHighlights();
            }, 1000);
        }
    }
}

function toggleNeighborHighlight() {
    showNeighbors = !showNeighbors;
    grid.clearHighlights();
    console.log(`Neighbor highlighting ${showNeighbors ? 'enabled' : 'disabled'}`);
}

function keyPressed() {
    if (key === ' ') {
        toggleNeighborHighlight();
    }
}