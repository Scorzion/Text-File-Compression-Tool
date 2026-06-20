# C++ Huffman File Compressor

A lossless data compression and decompression web utility built in **C++17**, featuring an interactive dashboard that constructs and visualizes Huffman Trees dynamically.

---

## 🚀 Key Features

* **Modular C++17 Core**: Rebuilt modularly inside `src/`. Spawns a multi-threaded web server using the header-only `cpp-httplib` library.
* **In-Memory Streaming**: Performs all compression and decompression directly on memory buffers using `std::vector<uint8_t>`, preventing slow file writes to disk.
* **Integrated Test Runner**: Built-in test runner compiles into the server executable, providing instant engine verification via `./bin/server --test`.
* **Dynamic Tree Visualizer**: A visual frontend dashboard built using glassmorphic styling, incorporating an interactive canvas background and a sharp SVG Huffman Tree visualizer that highlights code paths on hover.
* **Algorithm Correctness**: Cleanly manages standard edge cases (empty files, repeating single-character inputs, and complete byte spectra).

---

## 📁 Repository Structure

```
├── bin/                 # Compiled binaries (ignored)
├── Makefile             # C++ compilation configurations
├── run.sh               # Run helper (compiles, validates tests, and starts server)
├── DESIGN.md            # Technical design and architecture specification
├── src/                 # C++ Source Code
│   ├── huffman.hpp      # Coder API declarations
│   ├── huffman.cpp      # Huffman priority queue, tree building, and unit tests
│   ├── server.cpp       # HTTP server, routing, and multipart parsing
│   └── third_party/
│       └── httplib.h    # Single-header HTTP library (cpp-httplib)
└── static/              # Frontend Dashboard Assets
    ├── index.html       # Web dashboard panel
    ├── css/styles.css   # Dark-glassmorphic stylesheet
    └── js/app.js        # Canvas loops, fallback encoder, and SVG tree renderer
```

---

## ⚙️ Quick Start

### Prerequisites
* A Linux environment with `g++` (supporting C++17)

### Build and Launch Server
Execute the helper script to build the code, run engine unit tests, and start the local server:
```bash
chmod +x run.sh
./run.sh
```
Once launched, navigate to **`http://127.0.0.1:5000`** in your browser.

### Run Automated Tests Directly
Run the C++ unit test runner directly:
```bash
make
./bin/server --test
```

---

## 🧬 Technical Specifications
For details on complexity metrics, binary serialization header spec, and code architecture, refer to **[DESIGN.md](DESIGN.md)**.
