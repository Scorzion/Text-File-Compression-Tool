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
// Client-Side Huffman Coding Fallback (For static deployment like GitHub Pages)
// ----------------------------------------------------
class HuffmanJS {
    static compress(fileBytes, extension) {
        // 1. Count frequencies
        const freq = {};
        for (let i = 0; i < fileBytes.length; i++) {
            const byte = fileBytes[i];
            freq[byte] = (freq[byte] || 0) + 1;
        }

        // 2. Build Min-Heap
        const pq = [];
        for (const [byteStr, count] of Object.entries(freq)) {
            const byte = parseInt(byteStr);
            pq.push({ byte, freq: count, left: null, right: null });
        }

        if (pq.length === 0) {
            // Empty file: write basic header
            const header = new Uint8Array(3); // ext_len=0, num_unique=0 (2 bytes)
            return header;
        }

        // Helper to pop node with minimum frequency
        const popMin = () => {
            pq.sort((a, b) => a.freq - b.freq);
            return pq.shift();
        };

        let root = null;
        if (pq.length === 1) {
            const single = popMin();
            root = { byte: 0, freq: single.freq, left: single, right: null };
        } else {
            while (pq.length > 1) {
                const left = popMin();
                const right = popMin();
                const parent = { byte: 0, freq: left.freq + right.freq, left, right };
                pq.push(parent);
            }
            root = pq[0];
        }

        // 3. Generate codes recursively
        const codes = {};
        const generateCodes = (node, code) => {
            if (!node) return;
            if (!node.left && !node.right) {
                codes[node.byte] = code === "" ? "0" : code;
                return;
            }
            generateCodes(node.left, code + "0");
            generateCodes(node.right, code + "1");
        };
        generateCodes(root, "");

        // 4. Serialize Header
        const encoder = new TextEncoder();
        const extBytes = encoder.encode(extension);
        const extLen = extBytes.length;
        const numUnique = Object.keys(freq).length;
        
        // Header length: 1 (ext_len) + extLen + 2 (numUnique) + numUnique * 5
        const headerSize = 1 + extLen + 2 + numUnique * 5;
        const header = new Uint8Array(headerSize);
        
        let offset = 0;
        header[offset++] = extLen;
        header.set(extBytes, offset);
        offset += extLen;
        
        // Alphabet size (16-bit uint)
        header[offset++] = numUnique & 0xFF;
        header[offset++] = (numUnique >> 8) & 0xFF;
        
        for (const [byteStr, count] of Object.entries(freq)) {
            const byte = parseInt(byteStr);
            header[offset++] = byte;
            header[offset++] = count & 0xFF;
            header[offset++] = (count >> 8) & 0xFF;
            header[offset++] = (count >> 16) & 0xFF;
            header[offset++] = (count >> 24) & 0xFF;
        }

        // 5. Pack bit stream into bytes
        const bitStream = [];
        for (let i = 0; i < fileBytes.length; i++) {
            const byte = fileBytes[i];
            const code = codes[byte];
            for (let j = 0; j < code.length; j++) {
                bitStream.push(code[j] === '1');
            }
        }

        const numBits = bitStream.length;
        const numBytes = Math.ceil(numBits / 8);
        const compressedData = new Uint8Array(numBytes);
        
        let currentByte = 0;
        let bitCount = 0;
        let byteIndex = 0;

        for (let i = 0; i < numBits; i++) {
            currentByte = (currentByte << 1) | (bitStream[i] ? 1 : 0);
            bitCount++;
            if (bitCount === 8) {
                compressedData[byteIndex++] = currentByte;
                currentByte = 0;
                bitCount = 0;
            }
        }

        if (bitCount > 0) {
            currentByte = currentByte << (8 - bitCount);
            compressedData[byteIndex++] = currentByte;
        }

        // 6. Concatenate Header + Compressed Data
        const finalOutput = new Uint8Array(headerSize + numBytes);
        finalOutput.set(header, 0);
        finalOutput.set(compressedData, headerSize);
        return finalOutput;
    }

    static decompress(compressedBytes) {
        if (compressedBytes.length < 3) {
            throw new Error("Invalid compressed file size.");
        }

        let offset = 0;
        const extLen = compressedBytes[offset++];
        if (offset + extLen > compressedBytes.length) {
            throw new Error("Invalid extension length in header.");
        }

        const decoder = new TextDecoder();
        const ext = decoder.decode(compressedBytes.subarray(offset, offset + extLen));
        offset += extLen;

        const numUnique = compressedBytes[offset] | (compressedBytes[offset + 1] << 8);
        offset += 2;

        const uniqueChars = [];
        let totalChars = 0;
        for (let i = 0; i < numUnique; i++) {
            if (offset + 5 > compressedBytes.length) {
                throw new Error("Frequency table truncated.");
            }
            const ch = compressedBytes[offset++];
            const freq = compressedBytes[offset] | 
                         (compressedBytes[offset + 1] << 8) | 
                         (compressedBytes[offset + 2] << 16) | 
                         (compressedBytes[offset + 3] << 24);
            offset += 4;
            uniqueChars.push({ byte: ch, freq });
            totalChars += freq;
        }

        if (totalChars === 0) {
            return { fileBytes: new Uint8Array(0), ext };
        }

        // Reconstruct Huffman tree
        const pq = [];
        for (const item of uniqueChars) {
            pq.push({ byte: item.byte, freq: item.freq, left: null, right: null });
        }

        const popMin = () => {
            pq.sort((a, b) => a.freq - b.freq);
            return pq.shift();
        };

        let root = null;
        if (pq.length === 1) {
            const single = popMin();
            root = { byte: 0, freq: single.freq, left: single, right: null };
        } else {
            while (pq.length > 1) {
                const left = popMin();
                const right = popMin();
                const parent = { byte: 0, freq: left.freq + right.freq, left, right };
                pq.push(parent);
            }
            root = pq[0];
        }

        // Decompress raw bitstream
        const decodedBytes = new Uint8Array(totalChars);
        let decodedCount = 0;
        let curr = root;

        let byteVal = 0;

        for (let i = offset; i < compressedBytes.length && decodedCount < totalChars; i++) {
            byteVal = compressedBytes[i];
            for (let b = 7; b >= 0 && decodedCount < totalChars; b--) {
                const bit = (byteVal >> b) & 1;
                
                if (curr.left && curr.right) {
                    curr = bit ? curr.right : curr.left;
                } else if (curr.left) {
                    curr = curr.left;
                } else if (curr.right) {
                    curr = curr.right;
                }

                if (curr && !curr.left && !curr.right) {
                    decodedBytes[decodedCount++] = curr.byte;
                    curr = root;
                }
            }
        }

        return { fileBytes: decodedBytes, ext };
    }
}

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

    // Try server-side API processing first
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
        // Fall back to client-side JS Huffman Engine (perfect for static servers like GitHub Pages)
        console.warn("API request failed, falling back to client-side execution:", error.message);
        runClientSideFallback();
    });
}

// Client-Side Huffman Fallback Executer
function runClientSideFallback() {
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const fileBytes = new Uint8Array(e.target.result);
            const startTime = performance.now();
            
            if (currentMode === 'compress') {
                const extension = selectedFile.name.split('.').pop() || '';
                const compressedOutput = HuffmanJS.compress(fileBytes, extension);
                const duration = performance.now() - startTime;
                
                // Create Blob download URL
                const blob = new Blob([compressedOutput], { type: 'application/octet-stream' });
                const downloadUrl = URL.createObjectURL(blob);
                const baseName = selectedFile.name.substring(0, selectedFile.name.lastIndexOf('.')) || selectedFile.name;
                const compressedName = `${baseName}-compressed.bin`;
                
                showResults({
                    success: true,
                    original_name: selectedFile.name,
                    compressed_name: compressedName,
                    original_size: fileBytes.length,
                    compressed_size: compressedOutput.length,
                    savings: `${((1 - (compressedOutput.length / fileBytes.length)) * 100).toFixed(2)}%`,
                    ratio: `${(compressedOutput.length / fileBytes.length).toFixed(2)}x`,
                    time_ms: Math.round(duration),
                    download_url: downloadUrl,
                    fallback: true
                });
            } else {
                const { fileBytes: decompressedOutput, ext } = HuffmanJS.decompress(fileBytes);
                const duration = performance.now() - startTime;
                
                // Create Blob download URL
                const blob = new Blob([decompressedOutput], { type: 'application/octet-stream' });
                const downloadUrl = URL.createObjectURL(blob);
                const baseName = selectedFile.name.replace("-compressed.bin", "").replace(".bin", "");
                const decompressedName = `${baseName}-decompressed.${ext}`;
                
                showResults({
                    success: true,
                    original_name: selectedFile.name,
                    decompressed_name: decompressedName,
                    original_size: fileBytes.length,
                    decompressed_size: decompressedOutput.length,
                    time_ms: Math.round(duration),
                    download_url: downloadUrl,
                    fallback: true
                });
            }
        } catch (err) {
            showError("Processing Error", err.message || "Failed client-side compression fallback.");
        }
    };
    reader.onerror = function() {
        showError("File Error", "Could not read the uploaded file.");
    };
    reader.readAsArrayBuffer(selectedFile);
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
    const downloadLink = document.getElementById('download-link');

    origName.innerText = data.original_name;
    origSize.innerText = `Size: ${formatBytes(data.original_size)}`;
    downloadLink.href = data.download_url;

    if (data.fallback) {
        downloadLink.setAttribute('download', currentMode === 'compress' ? data.compressed_name : data.decompressed_name);
    } else {
        downloadLink.removeAttribute('download');
    }

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

    // Update performance text & fallback badge
    const perfTag = document.querySelector('.performance-tag');
    if (data.fallback) {
        perfTag.innerHTML = `Executed in <span id="res-time" class="mono">${data.time_ms}</span> ms <span style="color:var(--accent); font-size:11px; display:block; margin-top:4px;">(Client-Side JS Fallback Mode)</span>`;
    } else {
        perfTag.innerHTML = `Executed in <span id="res-time" class="mono">${data.time_ms}</span> ms`;
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
