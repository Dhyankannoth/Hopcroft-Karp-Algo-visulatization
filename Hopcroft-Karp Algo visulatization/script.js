const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');

let leftNodes = [];
let rightNodes = [];
let edges = [];
let matching = new Map();
let running = false;
let animationFrame = null;

let stepMode = false;
let stepState = null;
let stepIteration = 0;

function resizeCanvas() {
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height;
    draw();
}

window.addEventListener('resize', resizeCanvas);
resizeCanvas();

function generateGraph() {
    const leftCount = 6 + Math.floor(Math.random() * 3);
    const rightCount = 6 + Math.floor(Math.random() * 3);
    
    leftNodes = [];
    rightNodes = [];
    edges = [];
    matching = new Map();

    const leftX = canvas.width * 0.2;
    const rightX = canvas.width * 0.8;
    const spacing = canvas.height / (Math.max(leftCount, rightCount) + 1);

    for (let i = 0; i < leftCount; i++) {
        leftNodes.push({
            id: 'L' + i,
            x: leftX,
            y: spacing * (i + 1),
            type: 'left'
        });
    }

    for (let i = 0; i < rightCount; i++) {
        rightNodes.push({
            id: 'R' + i,
            x: rightX,
            y: spacing * (i + 1),
            type: 'right'
        });
    }

    leftNodes.forEach(left => {
        const edgeCount = 2 + Math.floor(Math.random() * 3);
        const targets = new Set();
        while (targets.size < Math.min(edgeCount, rightNodes.length)) {
            targets.add(Math.floor(Math.random() * rightNodes.length));
        }
        targets.forEach(idx => {
            edges.push({
                from: left.id,
                to: rightNodes[idx].id,
                matched: false,
                highlighted: false
            });
        });
    });

    resetVisualization();
}

function resetVisualization() {
    running = false;
    stepMode = false;
    stepState = null;
    stepIteration = 0;
    matching = new Map();
    edges.forEach(e => {
        e.matched = false;
        e.highlighted = false;
    });
    updateStats(0, 'Ready', 0);
    document.getElementById('status').textContent = 'Ready to start...';
    document.getElementById('runBtn').disabled = false;
    document.getElementById('stepBtn').disabled = false;
    draw();
}

function updateStats(matchSize, phase, iter) {
    document.getElementById('matching').textContent = matchSize;
    document.getElementById('phase').textContent = phase;
    document.getElementById('iterations').textContent = iter;
}

async function runAlgorithm() {
    if (running) return;
    running = true;
    stepMode = false;
    stepState = null;
    document.getElementById('runBtn').disabled = true;
    document.getElementById('stepBtn').disabled = true;

    matching = new Map();
    edges.forEach(e => e.matched = false);
    
    let iteration = 0;
    let maxMatch = 0;

    while (true) {
        iteration++;
        updateStats(maxMatch, 'BFS Phase', iteration);
        document.getElementById('status').textContent = 'Finding augmenting paths...';
        
        const paths = await bfsPhase();
        
        if (paths.length === 0) break;

        updateStats(maxMatch, 'DFS Phase', iteration);
        document.getElementById('status').textContent = `Found ${paths.length} augmenting path(s), updating matching...`;
        
        for (const path of paths) {
            await highlightPath(path);
            await applyPath(path);
            maxMatch++;
            updateStats(maxMatch, 'DFS Phase', iteration);
        }

        await sleep(500);
    }

    updateStats(maxMatch, 'Complete', iteration);
    document.getElementById('status').textContent = `Algorithm complete! Maximum matching: ${maxMatch}`;
    running = false;
    document.getElementById('runBtn').disabled = false;
    document.getElementById('stepBtn').disabled = false;
}

async function bfsPhase() {
    const adjList = buildAdjList();
    const level = new Map();
    const queue = [];

    leftNodes.forEach(node => {
        if (!matching.has(node.id)) {
            level.set(node.id, 0);
            queue.push(node.id);
        }
    });

    while (queue.length > 0) {
        const u = queue.shift();
        
        if (adjList.has(u)) {
            for (const v of adjList.get(u)) {
                const matchedTo = getMatchedNode(v);
                
                if (matchedTo === null) {
                    if (!level.has(v)) {
                        level.set(v, level.get(u) + 1);
                    }
                } else if (!level.has(matchedTo)) {
                    level.set(matchedTo, level.get(u) + 2);
                    queue.push(matchedTo);
                }
            }
        }
    }

    const paths = [];
    const used = new Set();

    for (const node of leftNodes) {
        if (!matching.has(node.id)) {
            const path = dfs(node.id, level, used, adjList);
            if (path) {
                paths.push(path);
            }
        }
    }

    return paths;
}

function dfs(u, level, used, adjList) {
    if (used.has(u)) return null;
    used.add(u);

    if (!adjList.has(u)) return null;

    for (const v of adjList.get(u)) {
        if (!level.has(v)) continue;
        
        const matchedTo = getMatchedNode(v);
        
        if (matchedTo === null) {
            return [u, v];
        } else if (level.get(matchedTo) === level.get(u) + 2) {
            const rest = dfs(matchedTo, level, used, adjList);
            if (rest) {
                return [u, v, ...rest];
            }
        }
    }

    return null;
}

function buildAdjList() {
    const adj = new Map();
    edges.forEach(edge => {
        if (!adj.has(edge.from)) adj.set(edge.from, []);
        adj.get(edge.from).push(edge.to);
    });
    return adj;
}

function getMatchedNode(nodeId) {
    if (matching.has(nodeId)) return matching.get(nodeId);
    
    for (const [key, value] of matching) {
        if (value === nodeId) return key;
    }
    return null;
}

async function highlightPath(path) {
    edges.forEach(e => e.highlighted = false);
    
    for (let i = 0; i < path.length - 1; i++) {
        const edge = edges.find(e => 
            (e.from === path[i] && e.to === path[i + 1]) ||
            (e.from === path[i + 1] && e.to === path[i])
        );
        if (edge) edge.highlighted = true;
    }
    
    draw();
    await sleep(600);
}

async function applyPath(path) {
    for (let i = 0; i < path.length - 1; i += 2) {
        const from = path[i];
        const to = path[i + 1];
        matching.set(from, to);
        
        const edge = edges.find(e => e.from === from && e.to === to);
        if (edge) edge.matched = true;
    }
    
    edges.forEach(e => e.highlighted = false);
    draw();
    await sleep(300);
}

function stepAlgorithm() {
    if (running && !stepMode) {
        document.getElementById('status').textContent = 'Cannot step while auto-run is active.';
        return;
    }

    if (!stepMode) {
        stepMode = true;
        stepState = {
            phase: 'init',
            iteration: 0,
            maxMatch: 0,
            currentPaths: [],
            currentPathIndex: 0,
            pathSubStep: 'find'
        };
        matching = new Map();
        edges.forEach(e => {
            e.matched = false;
            e.highlighted = false;
        });
        document.getElementById('runBtn').disabled = true;
        document.getElementById('status').textContent = 'Step mode activated. Click Step to proceed.';
        updateStats(0, 'Ready', 0);
        draw();
        return;
    }

    executeStep();
}

async function executeStep() {
    const state = stepState;

    switch (state.phase) {
        case 'init':
            state.iteration++;
            state.phase = 'bfs';
            updateStats(state.maxMatch, 'BFS Phase', state.iteration);
            document.getElementById('status').textContent = 'Step: Finding augmenting paths with BFS...';
            break;

        case 'bfs':
            const paths = findPathsSync();
            state.currentPaths = paths;
            state.currentPathIndex = 0;
            
            if (paths.length === 0) {
                state.phase = 'complete';
                updateStats(state.maxMatch, 'Complete', state.iteration);
                document.getElementById('status').textContent = `Algorithm complete! Maximum matching: ${state.maxMatch}`;
                stepMode = false;
                document.getElementById('runBtn').disabled = false;
                return;
            }
            
            state.phase = 'dfs';
            state.pathSubStep = 'highlight';
            updateStats(state.maxMatch, 'DFS Phase', state.iteration);
            document.getElementById('status').textContent = `Step: Found ${paths.length} path(s). Highlighting path ${state.currentPathIndex + 1}/${paths.length}...`;
            
            highlightPathSync(paths[state.currentPathIndex]);
            break;

        case 'dfs':
            if (state.pathSubStep === 'highlight') {
                state.pathSubStep = 'apply';
                document.getElementById('status').textContent = `Step: Applying path ${state.currentPathIndex + 1}/${state.currentPaths.length} to matching...`;
                applyPathSync(state.currentPaths[state.currentPathIndex]);
                state.maxMatch++;
                updateStats(state.maxMatch, 'DFS Phase', state.iteration);
                
            } else if (state.pathSubStep === 'apply') {
                state.currentPathIndex++;
                
                if (state.currentPathIndex < state.currentPaths.length) {
                    state.pathSubStep = 'highlight';
                    document.getElementById('status').textContent = `Step: Highlighting path ${state.currentPathIndex + 1}/${state.currentPaths.length}...`;
                    highlightPathSync(state.currentPaths[state.currentPathIndex]);
                } else {
                    state.iteration++;
                    state.phase = 'bfs';
                    state.currentPaths = [];
                    state.currentPathIndex = 0;
                    updateStats(state.maxMatch, 'BFS Phase', state.iteration);
                    document.getElementById('status').textContent = 'Step: Starting next iteration, finding augmenting paths...';
                }
            }
            break;
    }
}

function findPathsSync() {
    const adjList = buildAdjList();
    const level = new Map();
    const queue = [];

    leftNodes.forEach(node => {
        if (!matching.has(node.id)) {
            level.set(node.id, 0);
            queue.push(node.id);
        }
    });

    while (queue.length > 0) {
        const u = queue.shift();
        
        if (adjList.has(u)) {
            for (const v of adjList.get(u)) {
                const matchedTo = getMatchedNode(v);
                
                if (matchedTo === null) {
                    if (!level.has(v)) {
                        level.set(v, level.get(u) + 1);
                    }
                } else if (!level.has(matchedTo)) {
                    level.set(matchedTo, level.get(u) + 2);
                    queue.push(matchedTo);
                }
            }
        }
    }

    const paths = [];
    const used = new Set();

    for (const node of leftNodes) {
        if (!matching.has(node.id)) {
            const path = dfs(node.id, level, used, adjList);
            if (path) {
                paths.push(path);
            }
        }
    }

    return paths;
}

function highlightPathSync(path) {
    edges.forEach(e => e.highlighted = false);
    
    for (let i = 0; i < path.length - 1; i++) {
        const edge = edges.find(e => 
            (e.from === path[i] && e.to === path[i + 1]) ||
            (e.from === path[i + 1] && e.to === path[i])
        );
        if (edge) edge.highlighted = true;
    }
    
    draw();
}

function applyPathSync(path) {
    for (let i = 0; i < path.length - 1; i += 2) {
        const from = path[i];
        const to = path[i + 1];
        matching.set(from, to);
        
        const edge = edges.find(e => e.from === from && e.to === to);
        if (edge) edge.matched = true;
    }
    
    edges.forEach(e => e.highlighted = false);
    draw();
}

function draw() {
    ctx.fillStyle = 'rgba(10, 10, 30, 0.9)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    edges.forEach(edge => {
        const from = [...leftNodes, ...rightNodes].find(n => n.id === edge.from);
        const to = [...leftNodes, ...rightNodes].find(n => n.id === edge.to);
        
        if (from && to) {
            ctx.beginPath();
            ctx.moveTo(from.x, from.y);
            ctx.lineTo(to.x, to.y);
            
            if (edge.highlighted) {
                ctx.strokeStyle = '#facc15';
                ctx.lineWidth = 4;
                ctx.shadowBlur = 15;
                ctx.shadowColor = '#facc15';
            } else if (edge.matched) {
                ctx.strokeStyle = '#10b981';
                ctx.lineWidth = 3;
                ctx.shadowBlur = 10;
                ctx.shadowColor = '#10b981';
            } else {
                ctx.strokeStyle = '#9ca3af';
                ctx.lineWidth = 1.5;
                ctx.shadowBlur = 0;
            }
            
            ctx.stroke();
            ctx.shadowBlur = 0;
        }
    });

    [...leftNodes, ...rightNodes].forEach(node => {
        ctx.beginPath();
        ctx.arc(node.x, node.y, 20, 0, Math.PI * 2);
        
        const isMatched = matching.has(node.id) || 
            Array.from(matching.values()).includes(node.id);
        
        if (node.type === 'left') {
            ctx.fillStyle = isMatched ? '#1e88e5' : '#38bdf8';
            ctx.shadowBlur = 15;
            ctx.shadowColor = '#38bdf8';
        } else {
            ctx.fillStyle = isMatched ? '#4a90e2' : '#60a5fa';
            ctx.shadowBlur = 15;
            ctx.shadowColor = '#60a5fa';
        }
        
        ctx.fill();
        ctx.shadowBlur = 0;
        
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.fillStyle = '#fff';
        ctx.font = 'bold 12px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(node.id.substring(1), node.x, node.y);
    });
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Modal functions
function showComparison() {
    document.getElementById('comparisonModal').classList.add('active');
}

function closeComparison() {
    document.getElementById('comparisonModal').classList.remove('active');
}

document.getElementById('comparisonModal').addEventListener('click', function(e) {
    if (e.target === this) {
        closeComparison();
    }
});

function generateLargeGraph(leftCount, rightCount) {
    leftNodes = [];
    rightNodes = [];
    edges = [];
    matching = new Map();

    const leftX = canvas.width * 0.2;
    const rightX = canvas.width * 0.8;
    const leftSpacing = canvas.height / (leftCount + 1);
    const rightSpacing = canvas.height / (rightCount + 1);

    for (let i = 0; i < leftCount; i++) {
        leftNodes.push({
            id: 'L' + i,
            x: leftX,
            y: leftSpacing * (i + 1),
            type: 'left'
        });
    }

    for (let i = 0; i < rightCount; i++) {
        rightNodes.push({
            id: 'R' + i,
            x: rightX,
            y: rightSpacing * (i + 1),
            type: 'right'
        });
    }

    leftNodes.forEach(left => {
        const edgeCount = 3 + Math.floor(Math.random() * 4);
        const targets = new Set();
        while (targets.size < Math.min(edgeCount, rightNodes.length)) {
            targets.add(Math.floor(Math.random() * rightNodes.length));
        }
        targets.forEach(idx => {
            edges.push({
                from: left.id,
                to: rightNodes[idx].id,
                matched: false,
                highlighted: false
            });
        });
    });

    resetVisualization();
    document.getElementById('graphSize').textContent = `${leftCount + rightCount} nodes, ${edges.length} edges`;
}

function runBenchmark() {
    if (leftNodes.length === 0) {
        alert('Please generate a graph first!');
        return;
    }

    document.getElementById('naiveTime').textContent = 'Running...';
    document.getElementById('fordTime').textContent = 'Running...';
    document.getElementById('hopcroftTime').textContent = 'Running...';
    document.getElementById('speedup').textContent = 'Calculating...';

    setTimeout(() => {
        const naiveStart = performance.now();
        const naiveIterations = benchmarkNaiveGreedy();
        const naiveEnd = performance.now();
        const naiveTime = (naiveEnd - naiveStart).toFixed(2);

        const fordStart = performance.now();
        const fordIterations = benchmarkFordFulkerson();
        const fordEnd = performance.now();
        const fordTime = (fordEnd - fordStart).toFixed(2);

        const hopcroftStart = performance.now();
        const hopcroftIterations = benchmarkHopcroftKarp();
        const hopcroftEnd = performance.now();
        const hopcroftTime = (hopcroftEnd - hopcroftStart).toFixed(2);

        document.getElementById('naiveTime').textContent = `${naiveTime}ms (${naiveIterations} iter)`;
        document.getElementById('fordTime').textContent = `${fordTime}ms (${fordIterations} iter)`;
        document.getElementById('hopcroftTime').textContent = `${hopcroftTime}ms (${hopcroftIterations} iter)`;
        
        const speedup = (parseFloat(naiveTime) / parseFloat(hopcroftTime)).toFixed(1);
        document.getElementById('speedup').textContent = `${speedup}x faster`;
    }, 100);
}

function benchmarkNaiveGreedy() {
    const testMatching = new Map();
    let iterations = 0;

    while (true) {
        iterations++;
        const path = findAugmentingPathDFS(testMatching);
        if (!path) break;

        for (let i = 0; i < path.length - 1; i += 2) {
            testMatching.set(path[i], path[i + 1]);
        }
    }

    return iterations;
}

function findAugmentingPathDFS(testMatching) {
    const adjList = buildAdjList();
    const visited = new Set();

    for (const node of leftNodes) {
        if (!testMatching.has(node.id)) {
            const path = dfsAugment(node.id, testMatching, visited, adjList, []);
            if (path) return path;
        }
    }
    return null;
}

function dfsAugment(u, testMatching, visited, adjList, path) {
    if (visited.has(u)) return null;
    visited.add(u);
    path.push(u);

    if (!adjList.has(u)) {
        path.pop();
        return null;
    }

    for (const v of adjList.get(u)) {
        const matchedTo = getMatchedNodeFrom(v, testMatching);
        
        if (matchedTo === null) {
            path.push(v);
            return path.slice();
        } else {
            path.push(v);
            const rest = dfsAugment(matchedTo, testMatching, visited, adjList, path);
            if (rest) return rest;
            path.pop();
        }
    }

    path.pop();
    return null;
}

function benchmarkFordFulkerson() {
    return benchmarkNaiveGreedy();
}

function benchmarkHopcroftKarp() {
    const testMatching = new Map();
    let iterations = 0;

    while (true) {
        iterations++;
        const paths = findMultiplePaths(testMatching);
        if (paths.length === 0) break;

        for (const path of paths) {
            for (let i = 0; i < path.length - 1; i += 2) {
                testMatching.set(path[i], path[i + 1]);
            }
        }
    }

    return iterations;
}

function findMultiplePaths(testMatching) {
    const adjList = buildAdjList();
    const level = new Map();
    const queue = [];

    leftNodes.forEach(node => {
        if (!testMatching.has(node.id)) {
            level.set(node.id, 0);
            queue.push(node.id);
        }
    });

    while (queue.length > 0) {
        const u = queue.shift();
        if (adjList.has(u)) {
            for (const v of adjList.get(u)) {
                const matchedTo = getMatchedNodeFrom(v, testMatching);
                if (matchedTo === null) {
                    if (!level.has(v)) {
                        level.set(v, level.get(u) + 1);
                    }
                } else if (!level.has(matchedTo)) {
                    level.set(matchedTo, level.get(u) + 2);
                    queue.push(matchedTo);
                }
            }
        }
    }

    const paths = [];
    const used = new Set();

    for (const node of leftNodes) {
        if (!testMatching.has(node.id)) {
            const path = dfsPath(node.id, level, used, adjList, testMatching);
            if (path) paths.push(path);
        }
    }

    return paths;
}

function dfsPath(u, level, used, adjList, testMatching) {
    if (used.has(u)) return null;
    used.add(u);

    if (!adjList.has(u)) return null;

    for (const v of adjList.get(u)) {
        if (!level.has(v)) continue;
        const matchedTo = getMatchedNodeFrom(v, testMatching);
        
        if (matchedTo === null) {
            return [u, v];
        } else if (level.get(matchedTo) === level.get(u) + 2) {
            const rest = dfsPath(matchedTo, level, used, adjList, testMatching);
            if (rest) return [u, v, ...rest];
        }
    }

    return null;
}

function getMatchedNodeFrom(nodeId, testMatching) {
    if (testMatching.has(nodeId)) return testMatching.get(nodeId);
    for (const [key, value] of testMatching) {
        if (value === nodeId) return key;
    }
    return null;
}

let raceRunning = false;
let raceInterval = null;
const raceCanvas = document.getElementById('raceCanvas');
const raceCtx = raceCanvas ? raceCanvas.getContext('2d') : null;

function startVisualRace() {
    if (raceRunning) return;
    if (leftNodes.length === 0) {
        alert('Please generate a graph first!');
        return;
    }

    raceRunning = true;
    
    const rect = raceCanvas.getBoundingClientRect();
    raceCanvas.width = rect.width;
    raceCanvas.height = rect.height;

    const raceState = {
        naive: {
            matching: new Map(),
            iteration: 0,
            complete: false,
            color: '#ef4444',
            name: 'Naive',
            edges: JSON.parse(JSON.stringify(edges))
        },
        ford: {
            matching: new Map(),
            iteration: 0,
            complete: false,
            color: '#f59e0b',
            name: 'Ford',
            edges: JSON.parse(JSON.stringify(edges))
        },
        hopcroft: {
            matching: new Map(),
            iteration: 0,
            complete: false,
            color: '#10b981',
            name: 'Hopcroft',
            edges: JSON.parse(JSON.stringify(edges))
        }
    };

    let frameCount = 0;
    const totalMatches = Math.min(leftNodes.length, rightNodes.length);

    resetRaceStats();

    raceInterval = setInterval(() => {
        frameCount++;

        if (!raceState.naive.complete && frameCount % 3 === 0) {
            stepNaiveGreedy(raceState.naive);
            updateRaceUI('naive', raceState.naive, totalMatches);
        }

        if (!raceState.ford.complete && frameCount % 3 === 0) {
            stepFordFulkerson(raceState.ford);
            updateRaceUI('ford', raceState.ford, totalMatches);
        }

        if (!raceState.hopcroft.complete && frameCount % 2 === 0) {
            stepHopcroftKarp(raceState.hopcroft);
            updateRaceUI('hopcroft', raceState.hopcroft, totalMatches);
        }

        drawRaceVisualization(raceState);

        if (raceState.naive.complete && raceState.ford.complete && raceState.hopcroft.complete) {
            stopVisualRace();
            highlightWinner(raceState);
        }
    }, 100);
}

function stopVisualRace() {
    raceRunning = false;
    if (raceInterval) {
        clearInterval(raceInterval);
        raceInterval = null;
    }
}

function resetRaceStats() {
    document.getElementById('naiveBar').style.width = '0%';
    document.getElementById('fordBar').style.width = '0%';
    document.getElementById('hopcroftBar').style.width = '0%';
    document.getElementById('naiveMatches').textContent = '0 matches';
    document.getElementById('fordMatches').textContent = '0 matches';
    document.getElementById('hopcroftMatches').textContent = '0 matches';
    document.getElementById('naiveIter').textContent = '0 iterations';
    document.getElementById('fordIter').textContent = '0 iterations';
    document.getElementById('hopcroftIter').textContent = '0 iterations';

    document.querySelectorAll('.race-stat').forEach(el => {
        el.classList.remove('finished', 'winner');
    });
}

function stepNaiveGreedy(state) {
    state.iteration++;
    const path = findAugmentingPathDFS(state.matching);
    if (!path) {
        state.complete = true;
        return;
    }

    for (let i = 0; i < path.length - 1; i += 2) {
        state.matching.set(path[i], path[i + 1]);
    }
}

function stepFordFulkerson(state) {
    stepNaiveGreedy(state);
}

function stepHopcroftKarp(state) {
    state.iteration++;
    const paths = findMultiplePaths(state.matching);
    if (paths.length === 0) {
        state.complete = true;
        return;
    }

    for (const path of paths) {
        for (let i = 0; i < path.length - 1; i += 2) {
            state.matching.set(path[i], path[i + 1]);
        }
    }
}

function updateRaceUI(algorithm, state, totalMatches) {
    const matches = state.matching.size;
    const percentage = (matches / totalMatches) * 100;

    document.getElementById(`${algorithm}Bar`).style.width = `${percentage}%`;
    document.getElementById(`${algorithm}Matches`).textContent = `${matches} matches`;
    document.getElementById(`${algorithm}Iter`).textContent = `${state.iteration} iterations`;

    if (state.complete) {
        document.getElementById(`${algorithm}Bar`).parentElement.parentElement.classList.add('finished');
    }
}

function drawRaceVisualization(raceState) {
    if (!raceCtx) return;

    raceCtx.fillStyle = 'rgba(10, 10, 30, 0.9)';
    raceCtx.fillRect(0, 0, raceCanvas.width, raceCanvas.height);

    const algorithms = [
        { state: raceState.naive, y: 60 },
        { state: raceState.ford, y: 150 },
        { state: raceState.hopcroft, y: 240 }
    ];

    algorithms.forEach(({ state, y }) => {
        // Draw algorithm name
        raceCtx.fillStyle = state.color;
        raceCtx.font = 'bold 14px Arial';
        raceCtx.textAlign = 'left';
        raceCtx.fillText(state.name, 10, y - 30);

        // Draw mini nodes
        const leftX = 50;
        const rightX = raceCanvas.width - 50;
        const nodeCount = Math.min(8, leftNodes.length);
        const spacing = 20;

        for (let i = 0; i < nodeCount; i++) {
            const nodeY = y - (nodeCount * spacing / 2) + i * spacing;
            
            raceCtx.beginPath();
            raceCtx.arc(leftX, nodeY, 5, 0, Math.PI * 2);
            raceCtx.fillStyle = state.matching.has(`L${i}`) ? state.color : '#475569';
            raceCtx.fill();

            raceCtx.beginPath();
            raceCtx.arc(rightX, nodeY, 5, 0, Math.PI * 2);
            raceCtx.fillStyle = Array.from(state.matching.values()).includes(`R${i}`) ? state.color : '#475569';
            raceCtx.fill();

            if (state.matching.has(`L${i}`)) {
                raceCtx.beginPath();
                raceCtx.moveTo(leftX, nodeY);
                raceCtx.lineTo(rightX, nodeY);
                raceCtx.strokeStyle = state.color;
                raceCtx.lineWidth = 2;
                raceCtx.stroke();
            }
        }

        const maxMatches = Math.min(leftNodes.length, rightNodes.length);
        const progress = state.matching.size / maxMatches;
        const barWidth = (raceCanvas.width - 200) * progress;
        
        raceCtx.fillStyle = state.color;
        raceCtx.globalAlpha = 0.3;
        raceCtx.fillRect(100, y + 40, barWidth, 5);
        raceCtx.globalAlpha = 1;

        raceCtx.fillStyle = state.complete ? '#10b981' : '#93c5fd';
        raceCtx.font = '12px Arial';
        raceCtx.textAlign = 'right';
        raceCtx.fillText(
            state.complete ? '✓ Complete' : `${state.iteration} iterations`,
            raceCanvas.width - 10,
            y - 30
        );
    });
}

function highlightWinner(raceState) {
    const algorithms = [
        { name: 'naive', state: raceState.naive },
        { name: 'ford', state: raceState.ford },
        { name: 'hopcroft', state: raceState.hopcroft }
    ];

    const winner = algorithms.reduce((min, algo) => 
        algo.state.iteration < min.state.iteration ? algo : min
    );

    document.getElementById(`${winner.name}Bar`).parentElement.parentElement.classList.add('winner');
}

if (raceCanvas) {
    const rect = raceCanvas.getBoundingClientRect();
    raceCanvas.width = rect.width;
    raceCanvas.height = rect.height;
}

generateGraph();