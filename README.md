# High-Performance Huffman File Compression Utility

A robust, lossless file compression and decompression web application powered by a high-performance **C++ engine** and a modern, state-free **Flask API**. Designed with strong software engineering principles to showcase algorithmic optimization, binary stream serialization, concurrent request isolation, and highly interactive UI design.

---

## 🚀 Key Features

* **High-Performance C++ Core**: Re-engineered Huffman coding utilizing standard library priority queues ($O(N \log N)$ time complexity) and true bit-level packing. Processes files in milliseconds.
* **Algorithmic Correctness**: Handles extreme edge cases cleanly (empty files, single-character files, full 256-value byte spectrum) with recursive tree cleanup and unsigned character safety checks.
* **Concurrent & Secure Flask API**: State-free JSON REST API that isolates user operations in unique transaction directories using `uuid.uuid4()`. Leverages Python's `subprocess` for secure, shell-injection-free backend execution.
* **Futuristic Single Page Dashboard**: A visual neon-dark interface featuring glassmorphic controls, interactive mouse-responsive particle canvas background, animated drag-and-drop upload zone, and side-by-side metric dashboards.
* **Automated Quality Verification**: Includes full unit and integration testing pipelines verifying binary integrity using MD5 checksum validation.

---

## ⚙️ How it Works

Huffman Coding is an optimal prefix code generator used for lossless data compression:
1. **Frequency Profiling**: The C++ compressor reads the input file byte-by-byte and counts the frequency of each unique byte value.
2. **Greedy Priority Queue**: Unique bytes are pushed into a min-heap priority queue. The two lowest-frequency nodes are repeatedly merged to form a parent node until a single Huffman Tree remains.
3. **Prefix Bit Coding**: Traversing left assigns `0` and traversing right assigns `1`. More frequent bytes get shorter binary sequences, minimizing total file footprint.
4. **Bitwise Packing**: The sequence of bits is packed into 8-bit bytes and written directly to the compressed output binary.
5. **Exact Boundary Reconstruct**: The compressed file includes a customized serialized frequency map header. The decompressor reconstructs the identical tree and decodes only the exact count of original characters, ignoring any trailing bitwise padding.

### Serialized Binary Format Header Spec
```
[1 Byte: Ext Length L] [L Bytes: Extension String]
[2 Bytes: Alphabet Size N]
[N * 5 Bytes: (1 Byte Character, 4 Bytes Frequency Count)]
[Raw Bitstream...]
```

---

## 📁 Repository Structure

```
├── app.py                # Concurrent Flask web server & JSON REST endpoints
├── huffcompress.cpp      # C++ binary packing compression engine
├── huffdecompress.cpp    # C++ binary unpacking decompression engine
├── Makefile              # Compiler configurations & builds
├── requirements.txt      # Python package dependencies
├── run.sh                # Interactive launcher script (compiles C++ & runs server)
├── static/
│   ├── css/styles.css    # Neon-dark style definitions & glassmorphic themes
│   └── js/app.js         # AJAX upload, UI states, and particle canvas system
├── templates/
│   └── index.html        # Single Page dashboard skeleton
├── test_compression.py   # Unit engine validation suite
└── test_api.py           # Integration API endpoint validation suite
```

---

## 🚀 Getting Started

### Prerequisites
* A Linux environment with `g++` (supporting C++17)
* `python3` (with `venv` package support)

### Run & Launch Web Server
A developer convenience script is included to automatically create a python virtual environment, install requirements, compile optimized C++ engines, and launch the Flask server:
```bash
chmod +x run.sh
./run.sh
```
Once started, navigate to **`http://127.0.0.1:5000`** in your browser.

### Run Automated Tests
Verify Huffman engine compression accuracy across multiple cases (empty, single character, binary, large text block) and assert MD5 checksum matching:
```bash
python3 test_compression.py
```

Run REST API integration verification (performs network request flows to `/api/compress` and `/api/decompress` and verifies output hashes):
```bash
.venv/bin/python3 test_api.py
```

---

## 📊 Performance Benchmarks

Below are metrics captured during automated testing suite execution:

| Test Case | Original Size | Compressed Size | Space Savings (%) | Correctness |
| :--- | :--- | :--- | :--- | :--- |
| **Empty File** | 0 B | 6 B | 0.00% | **PASSED** (MD5 Hash Matches) |
| **Single Character** (1000 'a's) | 1,000 B | 136 B | 86.40% | **PASSED** (MD5 Hash Matches) |
| **Lorem Ipsum Text** (22.2 KB) | 22,250 B | 11,720 B | 47.33% | **PASSED** (MD5 Hash Matches) |
| **Repeated text sequence** (30 KB) | 30,000 B | 6,271 B | 79.10% | **PASSED** (MD5 Hash Matches) |
| **Full Spectrum Binary** (25.6 KB) | 25,600 B | 26,886 B | -5.02% *(Header Overhead)* | **PASSED** (MD5 Hash Matches) |

*Note: For extremely small files (<500 bytes) or perfectly uniform noise, the header structure representing the Huffman table might cause a slight size expansion, which is standard for prefix-code compressors.*
