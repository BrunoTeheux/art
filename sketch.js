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
    }

    render() {
        push();
        if (this.isHighlighted) {
            fill(255, 255, 0, 100);
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

    update(color, interaction) {
        this.color = color;
        this.past.push(interaction);
        console.log(`Hexagon at (${this.position.x}, ${this.position.y}) updated:`, {
            color: this.color,
            interaction: interaction
        });
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
}

let grid;

function setup() {
    createCanvas(windowWidth, windowHeight);
    grid = new Grid();
}

function draw() {
    background(255);
    grid.render();
}

function windowResized() {
    resizeCanvas(windowWidth, windowHeight);
    grid.resize();
}

function mousePressed() {
    if (!showNeighbors) return;
    
    const clicked = grid.getHexagonAtPoint(mouseX, mouseY);
    if (clicked) {
        const [i, j] = clicked;
        grid.highlightNeighbors(i, j);
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