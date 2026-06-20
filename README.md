# Huffman File Compressor

I built this text compression and decompression tool from scratch to explore greedy algorithms, bitwise data serialization, and multi-threaded web backends. The project features a high-performance **C++17 engine** that handles files entirely in-memory, paired with an interactive dashboard that constructs and visualizes Huffman Trees recursively in real-time.

---

## 🚀 Key Features

* **100% C++17 Backend**: I wrote the entire backend in C++ using a lightweight, header-only server library (`cpp-httplib`). There are no Python scripts, virtual environments, or heavy frameworks required.
* **In-Memory Huffman Core**: All compression and decompression run entirely in RAM using `std::vector<uint8_t>`. It writes no temporary files to disk, avoiding slow I/O bottlenecks.
* **Interactive Tree visualizer**: I created an interactive sandbox panel in the frontend where you can type or select presets (like `ABRACADABRA` or `BEEP BOOP`) and watch the Huffman tree construct dynamically in the browser. It highlights code paths from the root to leaves on hover.
* **Built-in Verification**: I built unit tests directly into the server executable. Running the server with the `--test` flag automatically verifies the engine against empty files, repeating inputs, and a full 256-value byte spectrum.
* **Correctness & Safety**: The decompressor reconstructs the identical tree using custom serialized headers and stops precisely at the original character count, safely ignoring bitwise padding at the end of the stream.

---

## 📁 Repository Structure

* **`src/`**: Contains my C++ source files.
  * **`src/huffman.hpp`**: Coder declarations, struct properties, and API signatures.
  * **`src/huffman.cpp`**: Min-heap tree building, prefix code lookup table generation, bit packing, and unit tests.
  * **`src/server.cpp`**: Multi-threaded server entry point, static asset routing, and multipart file parsing.
  * **`src/third_party/httplib.h`**: Lightweight HTTP/HTTPS server library.
* **`static/`**: Frontend resources including my CSS styles and JavaScript logic.
* **`index.html`**: The main page dashboard.
* **`DESIGN.md`**: My detailed technical writeup explaining complexity metrics and the binary serialization format.
* **`Makefile`**: Simple compiler instructions that output build binaries to `bin/`.
* **`run.sh`**: Launch helper script.

---

## ⚙️ Quick Start

### 1. Run & Start Server
Simply execute the helper script. It will compile the C++ server, execute the unit tests, and launch the web server:
```bash
chmod +x run.sh
./run.sh
```
Once started, navigate to **`http://127.0.0.1:5000`** in your browser.

### 2. Run Tests Directly
To run the C++ unit tests directly without starting the server, run:
```bash
make
./bin/server --test
```

---

## 🧬 Implementation Specifications
For a deep dive into my binary serialization header format, time/space complexity analysis, and class designs, check out my **[DESIGN.md](DESIGN.md)** writeup.
