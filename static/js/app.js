// ----------------------------------------------------
// Core Huffman JS Engine (Deterministic & Safe)
// ----------------------------------------------------
class HuffmanJS {
    static compress(fileBytes, extension) {
        const encoder = new TextEncoder();
        const extBytes = encoder.encode(extension || '');
        const extLen = extBytes.length;

        if (fileBytes.length === 0) {
            const header = new Uint8Array(1 + 1 + extLen + 2);
            header[0] = 0x00; // Mode 0x00 (Huffman)
            header[1] = extLen;
            header.set(extBytes, 2);
            return header;
        }

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

        const getMinCh = (node) => {
            if (node.min_ch !== undefined) return node.min_ch;
            if (!node.left && !node.right) {
                return node.byte !== undefined ? node.byte : (node.char ? node.char.charCodeAt(0) : 255);
            }
            const lMin = node.left ? getMinCh(node.left) : 255;
            const rMin = node.right ? getMinCh(node.right) : 255;
            node.min_ch = Math.min(lMin, rMin);
            return node.min_ch;
        };

        const popMin = () => {
            pq.sort((a, b) => {
                if (a.freq !== b.freq) return a.freq - b.freq;
                return getMinCh(a) - getMinCh(b);
            });
            return pq.shift();
        };

        let root = null;
        if (pq.length === 1) {
            const single = popMin();
            root = { byte: 0, freq: single.freq, min_ch: getMinCh(single), left: single, right: null };
        } else {
            while (pq.length > 1) {
                const left = popMin();
                const right = popMin();
                const parent = { byte: 0, freq: left.freq + right.freq, min_ch: Math.min(getMinCh(left), getMinCh(right)), left, right };
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

        // 4. Varint Header Serialization
        const numUnique = Object.keys(freq).length;
        const varintBuf = [];
        for (const byteStr of Object.keys(freq)) {
            const byte = parseInt(byteStr);
            varintBuf.push(byte);
            let count = freq[byte];
            while (count >= 0x80) {
                varintBuf.push((count & 0x7F) | 0x80);
                count >>>= 7;
            }
            varintBuf.push(count & 0x7F);
        }

        const headerSize = 1 + 1 + extLen + 2 + varintBuf.length;
        const header = new Uint8Array(headerSize);

        let offset = 0;
        header[offset++] = 0x00; // Mode 0x00 (Huffman)
        header[offset++] = extLen;
        header.set(extBytes, offset);
        offset += extLen;

        header[offset++] = numUnique & 0xFF;
        header[offset++] = (numUnique >> 8) & 0xFF;
        header.set(varintBuf, offset);

        // 5. Pack bit stream
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

        const huffOutput = new Uint8Array(headerSize + numBytes);
        huffOutput.set(header, 0);
        huffOutput.set(compressedData, headerSize);

        // 6. Store Mode Pass-Through Check
        const storeHeaderSize = 1 + 1 + extLen;
        const storeOutput = new Uint8Array(storeHeaderSize + fileBytes.length);
        storeOutput[0] = 0x01; // Mode 0x01 (Store)
        storeOutput[1] = extLen;
        storeOutput.set(extBytes, 2);
        storeOutput.set(fileBytes, storeHeaderSize);

        if (huffOutput.length <= storeOutput.length) {
            return huffOutput;
        } else {
            return storeOutput;
        }
    }

    static decompress(compressedBytes) {
        if (compressedBytes.length < 3) {
            throw new Error("Invalid compressed file size.");
        }

        let offset = 0;
        const mode = compressedBytes[offset++];

        // Mode 0x01: Store Mode (Uncompressed Pass-through)
        if (mode === 0x01) {
            const extLen = compressedBytes[offset++];
            if (offset + extLen > compressedBytes.length) {
                throw new Error("Invalid extension length in store header.");
            }
            const decoder = new TextDecoder();
            const ext = decoder.decode(compressedBytes.subarray(offset, offset + extLen));
            offset += extLen;
            const fileBytes = compressedBytes.subarray(offset);
            return { fileBytes, ext };
        }

        let extLen = 0;
        if (mode === 0x00) {
            extLen = compressedBytes[offset++];
        } else {
            // Legacy mode where byte 0 was extLen
            extLen = mode;
        }

        if (offset + extLen > compressedBytes.length) {
            throw new Error("Invalid extension length in header.");
        }

        const decoder = new TextDecoder();
        const ext = decoder.decode(compressedBytes.subarray(offset, offset + extLen));
        offset += extLen;

        const numUnique = compressedBytes[offset] | (compressedBytes[offset + 1] << 8);
        offset += 2;

        if (numUnique > 256) {
            throw new Error("Invalid unique symbol count in header.");
        }

        const uniqueChars = [];
        let totalChars = 0;

        for (let i = 0; i < numUnique; i++) {
            if (offset >= compressedBytes.length) {
                throw new Error("Frequency table truncated.");
            }
            const ch = compressedBytes[offset++];

            let freq = 0;
            if (mode === 0x00) {
                let shift = 0;
                while (offset < compressedBytes.length) {
                    const b = compressedBytes[offset++];
                    freq |= (b & 0x7F) << shift;
                    freq = freq >>> 0;
                    if ((b & 0x80) === 0) break;
                    shift += 7;
                }
            } else {
                // Legacy 4-byte uint32
                if (offset + 4 > compressedBytes.length) {
                    throw new Error("Frequency table truncated.");
                }
                freq = (compressedBytes[offset] |
                    (compressedBytes[offset + 1] << 8) |
                    (compressedBytes[offset + 2] << 16) |
                    (compressedBytes[offset + 3] << 24)) >>> 0;
                offset += 4;
            }

            uniqueChars.push({ byte: ch, freq });
            totalChars += freq;
        }

        if (totalChars === 0) {
            return { fileBytes: new Uint8Array(0), ext };
        }

        const pq = [];
        for (const item of uniqueChars) {
            pq.push({ byte: item.byte, freq: item.freq, left: null, right: null });
        }

        const getMinCh = (node) => {
            if (node.min_ch !== undefined) return node.min_ch;
            if (!node.left && !node.right) {
                return node.byte !== undefined ? node.byte : (node.char ? node.char.charCodeAt(0) : 255);
            }
            const lMin = node.left ? getMinCh(node.left) : 255;
            const rMin = node.right ? getMinCh(node.right) : 255;
            node.min_ch = Math.min(lMin, rMin);
            return node.min_ch;
        };

        const popMin = () => {
            pq.sort((a, b) => {
                if (a.freq !== b.freq) return a.freq - b.freq;
                return getMinCh(a) - getMinCh(b);
            });
            return pq.shift();
        };

        let root = null;
        if (pq.length === 1) {
            const single = popMin();
            root = { byte: 0, freq: single.freq, min_ch: getMinCh(single), left: single, right: null };
        } else {
            while (pq.length > 1) {
                const left = popMin();
                const right = popMin();
                const parent = { byte: 0, freq: left.freq + right.freq, min_ch: Math.min(getMinCh(left), getMinCh(right)), left, right };
                pq.push(parent);
            }
            root = pq[0];
        }

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
// Shannon Entropy Calculation
// ----------------------------------------------------
function computeShannonEntropy(fileBytes) {
    if (!fileBytes || fileBytes.length === 0) return 0;
    const freq = {};
    for (let i = 0; i < fileBytes.length; i++) {
        const b = fileBytes[i];
        freq[b] = (freq[b] || 0) + 1;
    }
    let entropy = 0;
    const total = fileBytes.length;
    for (const count of Object.values(freq)) {
        const p = count / total;
        entropy -= p * Math.log2(p);
    }
    return entropy;
}

// ----------------------------------------------------
// UI Logic & Event Handlers
// ----------------------------------------------------
let currentMode = 'compress'; // 'compress', 'decompress', 'inspector', 'visualizer'
let inputMode = 'file'; // 'file' or 'text'
let selectedFile = null;
let lastCompressedBytes = null;

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
const textInputContainer = document.getElementById('text-input-container');
const rawTextArea = document.getElementById('raw-text-area');

function safeCreateIcons() {
    try {
        if (typeof lucide !== 'undefined') {
            lucide.createIcons();
        }
    } catch (e) {}
}

function switchTab(mode) {
    currentMode = mode;

    document.getElementById('tab-compress').classList.toggle('active', mode === 'compress');
    document.getElementById('tab-decompress').classList.toggle('active', mode === 'decompress');
    document.getElementById('tab-inspector').classList.toggle('active', mode === 'inspector');
    document.getElementById('tab-visualizer').classList.toggle('active', mode === 'visualizer');

    const workspaceContent = document.getElementById('workspace-content');
    const inspectorPanel = document.getElementById('inspector-panel');
    const visualizerContainer = document.getElementById('visualizer-container');

    workspaceContent.classList.add('hidden');
    inspectorPanel.classList.add('hidden');
    visualizerContainer.classList.add('hidden');

    if (mode === 'compress' || mode === 'decompress') {
        workspaceContent.classList.remove('hidden');
        btnText.innerText = mode === 'compress' ? 'RUN COMPRESSION' : 'RUN DECOMPRESSION';
        hideError();
    } else if (mode === 'inspector') {
        inspectorPanel.classList.remove('hidden');
        renderHexDump(lastCompressedBytes);
    } else if (mode === 'visualizer') {
        visualizerContainer.classList.remove('hidden');
        updateSandbox();
    }
}

function setInputMode(m) {
    inputMode = m;
    document.getElementById('mode-file-btn').classList.toggle('active', m === 'file');
    document.getElementById('mode-text-btn').classList.toggle('active', m === 'text');

    if (m === 'file') {
        dropZone.classList.remove('hidden');
        textInputContainer.classList.add('hidden');
        processBtn.disabled = !selectedFile;
    } else {
        dropZone.classList.add('hidden');
        textInputContainer.classList.remove('hidden');
        processBtn.disabled = rawTextArea.value.trim().length === 0;
    }
}

function handleTextInput() {
    if (inputMode === 'text') {
        processBtn.disabled = rawTextArea.value.trim().length === 0;
    }
}

function formatBytes(bytes, decimals = 2) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

// Drag & Drop Handling
['dragenter', 'dragover'].forEach(name => {
    dropZone.addEventListener(name, (e) => { e.preventDefault(); dropZone.classList.add('dragover'); }, false);
});
['dragleave', 'drop'].forEach(name => {
    dropZone.addEventListener(name, (e) => { e.preventDefault(); dropZone.classList.remove('dragover'); }, false);
});
dropZone.addEventListener('drop', (e) => {
    if (e.dataTransfer.files.length > 0) setFile(e.dataTransfer.files[0]);
}, false);
fileInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) setFile(e.target.files[0]);
}, false);

function setFile(file) {
    selectedFile = file;
    selectedFileName.innerText = file.name;
    selectedFileSize.innerText = formatBytes(file.size);

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

// File / Payload Execution
function processFile() {
    dropZone.classList.add('hidden');
    textInputContainer.classList.add('hidden');
    document.getElementById('action-bar').classList.add('hidden');
    loadingContainer.classList.remove('hidden');
    hideError();

    if (inputMode === 'text') {
        const textStr = rawTextArea.value;
        const encoder = new TextEncoder();
        const payloadBytes = encoder.encode(textStr);
        selectedFile = new File([payloadBytes], "payload.txt", { type: "text/plain" });
    }

    const formData = new FormData();
    formData.append('file', selectedFile);

    const apiEndpoint = currentMode === 'compress' ? '/api/compress' : '/api/decompress';

    const startTime = performance.now();

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
                    if (errJson && errJson.error) errorMsg = errJson.error;
                } catch (e) {}
                throw new Error(errorMsg);
            });
        }

        const origSize = parseInt(response.headers.get('X-Original-Size') || '0');
        const compSize = parseInt(response.headers.get('X-Compressed-Size') || response.headers.get('X-Decompressed-Size') || '0');
        const durationUs = parseInt(response.headers.get('X-Duration-US') || '0');
        const origName = response.headers.get('X-Original-Name') || selectedFile.name;

        return response.arrayBuffer().then(buffer => {
            const bytes = new Uint8Array(buffer);
            lastCompressedBytes = bytes;
            const blob = new Blob([bytes], { type: 'application/octet-stream' });
            const downloadUrl = URL.createObjectURL(blob);

            const durationMs = durationUs > 0 ? (durationUs / 1000) : (performance.now() - startTime);

            if (currentMode === 'compress') {
                const savings = response.headers.get('X-Savings') || '0';
                const ratio = response.headers.get('X-Ratio') || '0';
                const baseName = origName.substring(0, origName.lastIndexOf('.')) || origName;

                // Read input payload for entropy
                const fileReader = new FileReader();
                fileReader.onload = function(e) {
                    const inputBytes = new Uint8Array(e.target.result);
                    const entropy = computeShannonEntropy(inputBytes);

                    showResults({
                        success: true,
                        original_name: origName,
                        compressed_name: `${baseName}-compressed.bin`,
                        original_size: origSize,
                        compressed_size: compSize,
                        entropy: entropy,
                        savings: `${parseFloat(savings).toFixed(2)}%`,
                        ratio: `${parseFloat(ratio).toFixed(2)}x`,
                        time_us: durationUs,
                        time_ms: durationMs,
                        download_url: downloadUrl
                    });
                };
                fileReader.readAsArrayBuffer(selectedFile);
            } else {
                const ext = response.headers.get('X-Extension') || 'txt';
                const baseName = origName.replace("-compressed.bin", "").replace(".bin", "");

                showResults({
                    success: true,
                    original_name: origName,
                    decompressed_name: `${baseName}-decompressed.${ext}`,
                    original_size: origSize,
                    decompressed_size: compSize,
                    entropy: 0,
                    time_us: durationUs,
                    time_ms: durationMs,
                    download_url: downloadUrl
                });
            }
        });
    })
    .catch(error => {
        console.warn("C++ API unavailable, executing client-side Huffman Engine:", error.message);
        runClientSideFallback();
    });
}

function runClientSideFallback() {
    const reader = new FileReader();
    reader.onload = function (e) {
        try {
            const fileBytes = new Uint8Array(e.target.result);
            const startTime = performance.now();

            if (currentMode === 'compress') {
                const extension = selectedFile.name.split('.').pop() || '';
                const compressedOutput = HuffmanJS.compress(fileBytes, extension);
                const durationMs = performance.now() - startTime;
                lastCompressedBytes = compressedOutput;

                const entropy = computeShannonEntropy(fileBytes);
                const blob = new Blob([compressedOutput], { type: 'application/octet-stream' });
                const downloadUrl = URL.createObjectURL(blob);
                const baseName = selectedFile.name.substring(0, selectedFile.name.lastIndexOf('.')) || selectedFile.name;

                showResults({
                    success: true,
                    original_name: selectedFile.name,
                    compressed_name: `${baseName}-compressed.bin`,
                    original_size: fileBytes.length,
                    compressed_size: compressedOutput.length,
                    entropy: entropy,
                    savings: `${((1 - (compressedOutput.length / fileBytes.length)) * 100).toFixed(2)}%`,
                    ratio: `${(fileBytes.length / compressedOutput.length).toFixed(2)}x`,
                    time_ms: durationMs,
                    download_url: downloadUrl,
                    fallback: true
                });
            } else {
                const { fileBytes: decompressedOutput, ext } = HuffmanJS.decompress(fileBytes);
                const durationMs = performance.now() - startTime;
                lastCompressedBytes = fileBytes;

                const blob = new Blob([decompressedOutput], { type: 'application/octet-stream' });
                const downloadUrl = URL.createObjectURL(blob);
                const baseName = selectedFile.name.replace("-compressed.bin", "").replace(".bin", "");

                showResults({
                    success: true,
                    original_name: selectedFile.name,
                    decompressed_name: `${baseName}-decompressed.${ext}`,
                    original_size: fileBytes.length,
                    decompressed_size: decompressedOutput.length,
                    entropy: 0,
                    time_ms: durationMs,
                    download_url: downloadUrl,
                    fallback: true
                });
            }
        } catch (err) {
            showError("Engine Exception", err.message || "Failed client-side compression execution.");
        }
    };
    reader.readAsArrayBuffer(selectedFile);
}

function showResults(data) {
    loadingContainer.classList.add('hidden');
    resultsContainer.classList.remove('hidden');

    document.getElementById('res-orig-size').innerText = formatBytes(data.original_size);
    document.getElementById('res-orig-bits').innerText = `${data.original_size * 8} bits`;

    document.getElementById('res-out-size').innerText = formatBytes(data.compressed_size);
    document.getElementById('res-out-bits').innerText = `${data.compressed_size * 8} bits`;

    if (data.entropy !== undefined) {
        document.getElementById('res-entropy').innerText = `${data.entropy.toFixed(3)} b/B`;
        const theoreticalBits = Math.ceil(data.entropy * data.original_size);
        document.getElementById('res-theoretical').innerText = `Limit: ${formatBytes(Math.ceil(theoreticalBits / 8))}`;
    }

    document.getElementById('res-savings').innerText = data.savings || '100%';
    document.getElementById('res-ratio').innerText = `Ratio: ${data.ratio || '1.00x'}`;

    // Throughput in MB/s
    const timeSec = (data.time_ms || 1) / 1000;
    const sizeMB = data.original_size / (1024 * 1024);
    const throughput = timeSec > 0 ? (sizeMB / timeSec).toFixed(2) : '0.00';
    document.getElementById('res-throughput').innerText = `${throughput} MB/s`;

    const downloadLink = document.getElementById('download-link');
    downloadLink.href = data.download_url;
    downloadLink.setAttribute('download', currentMode === 'compress' ? data.compressed_name : data.decompressed_name);

    document.getElementById('res-time-badge').innerText = `LATENCY: ${parseFloat(data.time_ms).toFixed(2)} ms ${data.fallback ? '(CLIENT FALLBACK)' : '(NATIVE C++)'}`;

    const badge = document.getElementById('engine-status-badge');
    if (badge) {
        badge.innerText = data.fallback ? 'ENGINE: JS CLIENT FALLBACK' : 'ENGINE: C++ NATIVE HTTP';
    }
}

function startOver() {
    resetUpload();
    resultsContainer.classList.add('hidden');
    loadingContainer.classList.add('hidden');
    document.getElementById('action-bar').classList.remove('hidden');
    if (inputMode === 'file') dropZone.classList.remove('hidden');
    else textInputContainer.classList.remove('hidden');
    hideError();
}

function showError(title, message) {
    loadingContainer.classList.add('hidden');
    document.getElementById('action-bar').classList.remove('hidden');
    if (inputMode === 'file') dropZone.classList.remove('hidden');
    else textInputContainer.classList.remove('hidden');

    document.getElementById('error-title').innerText = title;
    document.getElementById('error-message').innerText = message;
    errorAlert.classList.remove('hidden');
}

function hideError() {
    errorAlert.classList.add('hidden');
}

// ----------------------------------------------------
// Hex / Bitstream Inspector Renderer
// ----------------------------------------------------
function renderHexDump(binaryBytes) {
    const container = document.getElementById('hex-dump-container');
    const sizeTag = document.getElementById('inspector-size-tag');
    if (!container) return;

    if (!binaryBytes || binaryBytes.length === 0) {
        container.innerHTML = `<span style="color:var(--text-dim)">No compressed binary active. Run a compression job first in [1] COMPRESS WORKSPACE.</span>`;
        if (sizeTag) sizeTag.innerText = '0 Bytes';
        return;
    }

    if (sizeTag) sizeTag.innerText = `${binaryBytes.length} Bytes Payload`;

    let offset = 0;
    const extLen = binaryBytes[0] || 0;
    const extEnd = 1 + extLen;
    let numUnique = 0;
    if (binaryBytes.length >= extEnd + 2) {
        numUnique = binaryBytes[extEnd] | (binaryBytes[extEnd + 1] << 8);
    }
    const tableEnd = extEnd + 2 + numUnique * 5;

    let html = '';
    const bytesPerRow = 16;
    for (let i = 0; i < binaryBytes.length; i += bytesPerRow) {
        const rowOffsetStr = i.toString(16).padStart(4, '0').toUpperCase();
        let hexCells = '';
        let asciiStr = '';

        for (let j = 0; j < bytesPerRow; j++) {
            const idx = i + j;
            if (idx < binaryBytes.length) {
                const b = binaryBytes[idx];
                const hexVal = b.toString(16).padStart(2, '0').toUpperCase();

                let cls = 'payload';
                if (idx === 0 || (idx >= 1 && idx < extEnd)) cls = 'header-ext';
                else if (idx >= extEnd && idx < extEnd + 2) cls = 'header-count';
                else if (idx >= extEnd + 2 && idx < tableEnd) cls = 'header-table';

                hexCells += `<span class="hex-byte ${cls}">${hexVal}</span>`;
                asciiStr += (b >= 32 && b <= 126) ? String.fromCharCode(b) : '.';
            } else {
                hexCells += `<span class="hex-byte" style="opacity:0;">--</span>`;
            }
        }

        html += `
            <div class="hex-row">
                <span class="hex-offset">0x${rowOffsetStr}</span>
                <div class="hex-bytes">${hexCells}</div>
                <span class="hex-ascii">${escapeHtml(asciiStr)}</span>
            </div>
        `;
    }

    container.innerHTML = html;
}

function escapeHtml(str) {
    return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// ----------------------------------------------------
// Tree Visualizer Sandbox
// ----------------------------------------------------
let rootGlobal = null;
let codesGlobal = {};
let leafCount = 0;

function buildHuffmanTreeForSandbox(text) {
    if (!text || text.length === 0) return { root: null, codes: {}, freq: {} };

    const freq = {};
    for (let i = 0; i < text.length; i++) {
        const char = text[i];
        freq[char] = (freq[char] || 0) + 1;
    }

    const pq = [];
    for (const [char, count] of Object.entries(freq)) {
        pq.push({ char, freq: count, left: null, right: null });
    }

    const getMinCh = (node) => {
        if (node.min_ch !== undefined) return node.min_ch;
        if (!node.left && !node.right) {
            return node.char ? node.char.charCodeAt(0) : 255;
        }
        const lMin = node.left ? getMinCh(node.left) : 255;
        const rMin = node.right ? getMinCh(node.right) : 255;
        node.min_ch = Math.min(lMin, rMin);
        return node.min_ch;
    };

    const popMin = () => {
        pq.sort((a, b) => {
            if (a.freq !== b.freq) return a.freq - b.freq;
            return getMinCh(a) - getMinCh(b);
        });
        return pq.shift();
    };

    let root = null;
    if (pq.length === 1) {
        const single = popMin();
        root = { char: '', freq: single.freq, min_ch: getMinCh(single), left: single, right: null };
    } else {
        while (pq.length > 1) {
            const left = popMin();
            const right = popMin();
            const parent = { char: '', freq: left.freq + right.freq, min_ch: Math.min(getMinCh(left), getMinCh(right)), left, right };
            pq.push(parent);
        }
        root = pq[0];
    }

    const codes = {};
    const generateCodes = (node, code) => {
        if (!node) return;
        if (!node.left && !node.right) {
            codes[node.char] = code === "" ? "0" : code;
            return;
        }
        generateCodes(node.left, code + "0");
        generateCodes(node.right, code + "1");
    };
    generateCodes(root, "");

    return { root, codes, freq };
}

function computeDepthAndLeaves(node, depth) {
    if (!node) return 0;
    node.depth = depth;
    if (!node.left && !node.right) {
        node.xOrder = leafCount++;
        return depth;
    }
    const leftMax = computeDepthAndLeaves(node.left, depth + 1);
    const rightMax = computeDepthAndLeaves(node.right, depth + 1);
    return Math.max(leftMax, rightMax);
}

function assignXCoordinates(node) {
    if (!node) return;
    if (!node.left && !node.right) return;
    assignXCoordinates(node.left);
    assignXCoordinates(node.right);

    let leftX = node.left ? node.left.xOrder : 0;
    let rightX = node.right ? node.right.xOrder : 0;
    node.xOrder = (leftX + rightX) / 2;
}

function getNodeCoords(node, maxDepth, leafCount, svgWidth, svgHeight) {
    const px = 30;
    const py = 35;
    const availW = svgWidth - 2 * px;
    const availH = svgHeight - 2 * py;

    let x = leafCount <= 1 ? svgWidth / 2 : px + node.xOrder * (availW / Math.max(1, leafCount - 1));
    let y = maxDepth === 0 ? svgHeight / 2 : py + node.depth * (availH / maxDepth);
    return { x, y };
}

function drawSvgTree(root, codes) {
    const svg = document.getElementById('tree-svg');
    if (!svg) return;
    svg.innerHTML = '';

    if (!root) {
        const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        text.setAttribute('x', '50%');
        text.setAttribute('y', '50%');
        text.setAttribute('text-anchor', 'middle');
        text.setAttribute('fill', 'var(--text-muted)');
        text.textContent = 'Enter text payload to build Huffman Tree';
        svg.appendChild(text);
        return;
    }

    const container = document.getElementById('tree-svg-container');
    const width = container.clientWidth || 550;
    const height = 340;
    svg.setAttribute('width', width);
    svg.setAttribute('height', height);

    leafCount = 0;
    const maxDepth = computeDepthAndLeaves(root, 0);
    assignXCoordinates(root);

    const nodesList = [];
    const linksList = [];

    function traverse(node, parent) {
        if (!node) return;
        const coords = getNodeCoords(node, maxDepth, leafCount, width, height);
        node.coords = coords;
        nodesList.push(node);

        if (parent) {
            linksList.push({ parent, child: node, bit: parent.left === node ? '0' : '1' });
        }

        traverse(node.left, node);
        traverse(node.right, node);
    }
    traverse(root, null);

    linksList.forEach(link => {
        const pCoords = link.parent.coords;
        const cCoords = link.child.coords;

        const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        line.setAttribute('x1', pCoords.x);
        line.setAttribute('y1', pCoords.y);
        line.setAttribute('x2', cCoords.x);
        line.setAttribute('y2', cCoords.y);
        line.setAttribute('class', 'tree-link');
        svg.appendChild(line);

        const midX = (pCoords.x + cCoords.x) / 2;
        const midY = (pCoords.y + cCoords.y) / 2;

        const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        text.setAttribute('x', midX);
        text.setAttribute('y', midY);
        text.setAttribute('class', 'branch-label');
        text.textContent = link.bit;
        svg.appendChild(text);
    });

    nodesList.forEach(node => {
        const coords = node.coords;
        const isLeaf = !node.left && !node.right;

        const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        g.setAttribute('class', `tree-node ${isLeaf ? 'leaf' : 'internal'}`);

        const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        circle.setAttribute('cx', coords.x);
        circle.setAttribute('cy', coords.y);
        circle.setAttribute('r', isLeaf ? '16' : '14');
        g.appendChild(circle);

        if (isLeaf) {
            let displayChar = node.char;
            if (displayChar === ' ') displayChar = '␣';
            else if (displayChar === '\n') displayChar = '↵';

            const charText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            charText.setAttribute('x', coords.x);
            charText.setAttribute('y', coords.y - 3);
            charText.setAttribute('class', 'char-label');
            charText.textContent = displayChar;
            g.appendChild(charText);

            const freqText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            freqText.setAttribute('x', coords.x);
            freqText.setAttribute('y', coords.y + 8);
            freqText.setAttribute('style', 'font-size:8px; fill:var(--text-muted);');
            freqText.textContent = node.freq;
            g.appendChild(freqText);
        } else {
            const freqText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            freqText.setAttribute('x', coords.x);
            freqText.setAttribute('y', coords.y);
            freqText.setAttribute('style', 'font-size:9px; font-weight:bold;');
            freqText.textContent = node.freq;
            g.appendChild(freqText);
        }

        svg.appendChild(g);
    });
}

function populateCodebookTable(freq, codes, totalLen) {
    const tbody = document.getElementById('codebook-tbody');
    if (!tbody) return;
    tbody.innerHTML = '';

    if (totalLen === 0) {
        tbody.innerHTML = `<tr><td colspan="4" style="text-align:center; color:var(--text-dim)">Empty payload.</td></tr>`;
        return;
    }

    const sorted = Object.entries(freq).sort((a, b) => b[1] - a[1]);

    sorted.forEach(([char, count]) => {
        let displayChar = char;
        if (displayChar === ' ') displayChar = 'Space';
        else if (displayChar === '\n') displayChar = '↵ Enter';

        const percentage = ((count / totalLen) * 100).toFixed(1) + '%';
        const code = codes[char] || '';

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td class="char-cell">${escapeHtml(displayChar)}</td>
            <td>${count}</td>
            <td>${percentage}</td>
            <td class="code-cell">${code}</td>
        `;
        tbody.appendChild(tr);
    });
}

function updateSandbox() {
    const inputField = document.getElementById('sandbox-input');
    if (!inputField) return;
    const text = inputField.value;

    const { root, codes, freq } = buildHuffmanTreeForSandbox(text);
    rootGlobal = root;
    codesGlobal = codes;

    drawSvgTree(root, codes);
    populateCodebookTable(freq, codes, text.length);
}
