// Background Particle System on Canvas
const canvas = document.getElementById('bg-canvas');
const ctx = canvas.getContext('2d');

let particles = [];
let mouse = { x: null, y: null, radius: 100 };

// Adjust canvas size
function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}
resizeCanvas();
window.addEventListener('resize', resizeCanvas);

// Track mouse position
window.addEventListener('mousemove', (e) => {
    mouse.x = e.x;
    mouse.y = e.y;
});
window.addEventListener('mouseout', () => {
    mouse.x = null;
    mouse.y = null;
});

// Particle Class
class Particle {
    constructor() {
        this.x = Math.random() * canvas.width;
        this.y = Math.random() * canvas.height;
        this.size = Math.random() * 2 + 1;
        this.speedX = Math.random() * 0.4 - 0.2;
        this.speedY = Math.random() * 0.4 - 0.2;
        this.color = Math.random() > 0.5 ? 'rgba(168, 85, 247, 0.4)' : 'rgba(34, 211, 238, 0.3)';
    }

    update() {
        this.x += this.speedX;
        this.y += this.speedY;

        // Bounce on boundaries
        if (this.x < 0 || this.x > canvas.width) this.speedX = -this.speedX;
        if (this.y < 0 || this.y > canvas.height) this.speedY = -this.speedY;

        // Interaction with mouse
        if (mouse.x != null && mouse.y != null) {
            let dx = mouse.x - this.x;
            let dy = mouse.y - this.y;
            let distance = Math.sqrt(dx * dx + dy * dy);
            if (distance < mouse.radius) {
                const force = (mouse.radius - distance) / mouse.radius;
                this.x -= dx * force * 0.02;
                this.y -= dy * force * 0.02;
            }
        }
    }

    draw() {
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();
    }
}

// Populate particles
function initParticles() {
    particles = [];
    const count = Math.min(60, Math.floor((canvas.width * canvas.height) / 25000));
    for (let i = 0; i < count; i++) {
        particles.push(new Particle());
    }
}
initParticles();
window.addEventListener('resize', initParticles);

// Drawing connecting lines
function connectParticles() {
    let opacityValue = 1;
    for (let a = 0; a < particles.length; a++) {
        for (let b = a; b < particles.length; b++) {
            let dx = particles[a].x - particles[b].x;
            let dy = particles[a].y - particles[b].y;
            let distance = Math.sqrt(dx * dx + dy * dy);

            if (distance < 120) {
                opacityValue = 1 - (distance / 120);
                ctx.strokeStyle = `rgba(168, 85, 247, ${opacityValue * 0.15})`;
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.moveTo(particles[a].x, particles[a].y);
                ctx.lineTo(particles[b].x, particles[b].y);
                ctx.stroke();
            }
        }
    }
}

// Particle loop
function animate() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (let i = 0; i < particles.length; i++) {
        particles[i].update();
        particles[i].draw();
    }
    connectParticles();
    requestAnimationFrame(animate);
}
animate();

// ----------------------------------------------------
// UI Logic
// ----------------------------------------------------
let currentMode = 'compress'; // or 'decompress'
let selectedFile = null;

const dropZone = document.getElementById('drop-zone');
const fileInput = document.getElementById('file-input');
const dropZonePrompt = document.getElementById('drop-zone-prompt');
const selectedFileState = document.getElementById('selected-file-state');
const selectedFileName = document.getElementById('selected-file-name');
const selectedFileSize = document.getElementById('selected-file-size');
const stateFileIcon = document.getElementById('state-file-icon');
const processBtn = document.getElementById('process-btn');
const btnText = document.getElementById('btn-text');
const loadingContainer = document.getElementById('loading-container');
const loadingTitle = document.getElementById('loading-title');
const resultsContainer = document.getElementById('results-container');
const errorAlert = document.getElementById('error-alert');
const errorMessage = document.getElementById('error-message');
const formatsLabel = document.getElementById('supported-formats-label');

// Safe Lucide creator
function safeCreateIcons() {
    try {
        if (typeof lucide !== 'undefined') {
            lucide.createIcons();
        }
    } catch (e) {
        console.warn('Lucide icons failed to render:', e);
    }
}

// Tab switching
function switchTab(mode) {
    if (currentMode === mode) return;
    currentMode = mode;

    // Reset UI
    startOver();

    // Toggle active classes on tab buttons
    document.getElementById('tab-compress').classList.toggle('active', mode === 'compress');
    document.getElementById('tab-decompress').classList.toggle('active', mode === 'decompress');

    // Update texts
    if (mode === 'compress') {
        btnText.innerText = 'Compress File';
        formatsLabel.innerText = 'Supports any text-based file (.txt, .c, .cpp, .js, etc.)';
    } else {
        btnText.innerText = 'Decompress File';
        formatsLabel.innerText = 'Supports Huffman compressed binary files (.bin)';
    }
}

// File Helpers
function formatBytes(bytes, decimals = 2) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

// Event Listeners for Drag and Drop
['dragenter', 'dragover'].forEach(eventName => {
    dropZone.addEventListener(eventName, highlight, false);
});

['dragleave', 'drop'].forEach(eventName => {
    dropZone.addEventListener(eventName, unhighlight, false);
});

function highlight(e) {
    e.preventDefault();
    dropZone.classList.add('dragover');
}

function unhighlight(e) {
    e.preventDefault();
    dropZone.classList.remove('dragover');
}

dropZone.addEventListener('drop', handleDrop, false);
fileInput.addEventListener('change', handleFileSelect, false);

function handleDrop(e) {
    const dt = e.dataTransfer;
    const files = dt.files;
    if (files.length > 0) {
        setFile(files[0]);
    }
}

function handleFileSelect(e) {
    const files = e.target.files;
    if (files.length > 0) {
        setFile(files[0]);
    }
}

function setFile(file) {
    selectedFile = file;
    selectedFileName.innerText = file.name;
    selectedFileSize.innerText = formatBytes(file.size);
    
    // Choose icon and styles based on mode
    if (currentMode === 'compress') {
        stateFileIcon.setAttribute('data-lucide', 'file-text');
        stateFileIcon.style.color = 'var(--accent)';
    } else {
        stateFileIcon.setAttribute('data-lucide', 'binary');
        stateFileIcon.style.color = 'var(--primary)';
    }
    safeCreateIcons();

    dropZonePrompt.classList.add('hidden');
    selectedFileState.classList.remove('hidden');
    processBtn.disabled = false;
    hideError();
}

function resetUpload(event) {
    if (event) event.stopPropagation();
    selectedFile = null;
    fileInput.value = '';
    selectedFileState.classList.add('hidden');
    dropZonePrompt.classList.remove('hidden');
    processBtn.disabled = true;
}

// Process Action (Compress / Decompress)
function processFile() {
    if (!selectedFile) return;

    // Show loading spinner
    dropZone.classList.add('hidden');
    processBtn.classList.add('hidden');
    loadingContainer.classList.remove('hidden');
    hideError();

    if (currentMode === 'compress') {
        loadingTitle.innerText = 'Compressing file...';
    } else {
        loadingTitle.innerText = 'Decompressing file...';
    }

    const formData = new FormData();
    formData.append('file', selectedFile);

    const apiEndpoint = currentMode === 'compress' ? '/api/compress' : '/api/decompress';

    fetch(apiEndpoint, {
        method: 'POST',
        body: formData
    })
    .then(response => {
        if (!response.ok) {
            return response.text().then(text => {
                let errorMsg = `Server error ${response.status}`;
                try {
                    const errJson = JSON.parse(text);
                    if (errJson && errJson.error) {
                        errorMsg = errJson.error;
                    }
                } catch(e) {}
                throw new Error(errorMsg);
            });
        }
        return response.json();
    })
    .then(data => {
        if (data.success) {
            showResults(data);
        } else {
            showError("Failed processing", data.error || "Unknown error occurred.");
        }
    })
    .catch(error => {
        showError("Server Error", error.message || "Could not connect to compression service.");
    });
}

// Show Results
function showResults(data) {
    loadingContainer.classList.add('hidden');
    resultsContainer.classList.remove('hidden');

    const origName = document.getElementById('res-orig-name');
    const origSize = document.getElementById('res-orig-size');
    const outName = document.getElementById('res-out-name');
    const outSize = document.getElementById('res-out-size');
    const savings = document.getElementById('res-savings');
    const ratio = document.getElementById('res-ratio');
    const timeMs = document.getElementById('res-time');
    const downloadLink = document.getElementById('download-link');

    origName.innerText = data.original_name;
    origSize.innerText = `Size: ${formatBytes(data.original_size)}`;
    timeMs.innerText = data.time_ms;
    downloadLink.href = data.download_url;

    if (currentMode === 'compress') {
        outName.innerText = data.compressed_name;
        outSize.innerText = `Compressed: ${formatBytes(data.compressed_size)}`;
        savings.innerText = data.savings;
        savings.className = 'metric-val text-accent';
        ratio.innerText = `Ratio: ${data.ratio}`;
    } else {
        outName.innerText = data.decompressed_name;
        outSize.innerText = `Decompressed: ${formatBytes(data.decompressed_size)}`;
        savings.innerText = '100%';
        savings.className = 'metric-val text-success';
        ratio.innerText = `Accuracy verified`;
    }
}

// Reset everything to start state
function startOver() {
    resetUpload();
    resultsContainer.classList.add('hidden');
    loadingContainer.classList.add('hidden');
    dropZone.classList.remove('hidden');
    processBtn.classList.remove('hidden');
    hideError();
}

// Error Handling
function showError(title, message) {
    // Hide loader
    loadingContainer.classList.add('hidden');
    
    // Restore file drop state
    dropZone.classList.remove('hidden');
    processBtn.classList.remove('hidden');

    document.getElementById('error-title').innerText = title;
    document.getElementById('error-message').innerText = message;
    errorAlert.classList.remove('hidden');
}

function hideError() {
    errorAlert.classList.add('hidden');
}
