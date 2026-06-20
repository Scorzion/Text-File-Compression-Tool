# Technical Design Document: In-Memory Huffman Coder

This document describes the architectural layout, data structures, complexity metrics, and binary serialization format of this Huffman File Compressor.

---

## ⚡ Core Design Decisions

### 1. In-Memory Operations
Unlike typical file compressors that read and write blocks to disk during processing, this system does all operations in RAM using `std::vector<uint8_t>` buffers. 
* **Benefits**: Maximizes performance by avoiding disk I/O bottlenecks and simplifies application logic by eliminating the need to manage temporary directories or garbage collection of old sessions on disk.

### 2. Multi-threaded Request Handling
The C++ HTTP server utilizes a thread-pool routing system to handle concurrent compression and decompression requests. The client uploads raw files via standard multipart form data, and the server returns the raw binary stream directly, conveying metrics (savings, duration) through custom HTTP response headers (e.g. `X-Savings`).

### 3. Built-In Verification
Testing is compiled directly inside the server executable. Running the server with the `--test` flag runs validation checks covering empty files, repeating characters, standard text blocks, and standard byte ranges, ensuring algorithmic correctness.

---

## 🧬 Complexity Metrics

* **Time Complexity**:
  * **Frequency Profiling**: $\mathcal{O}(M)$ where $M$ is the size of the input file.
  * **Tree Construction**: $\mathcal{O}(N \log N)$ where $N$ is the alphabet size (max 256 for standard byte spectrums). Since $N$ is bounded by 256, the heap sorting operations are fast.
* **Space Complexity**: $\mathcal{O}(N)$ to store the frequency map, prefix lookup tables, and active tree nodes. The space usage is independent of the file size $M$.

---

## 💾 Binary Packet Format (Header Specification)

The compressed output stream prepends a custom serialization header to the raw bitstream to allow the decompressor to reconstruct the tree:

```
+------------------+-------------------+------------------+------------------------------+--------------------+
| Ext Length (1B)  | Extension Str (L) | Alphabet Sz (2B) | Alphabet Entries (N * 5B)   | Raw Bitstream...   |
+------------------+-------------------+------------------+------------------------------+--------------------+
```

### Fields:
1. **Extension Length (1 Byte)**: Length of the original file extension string.
2. **Original Extension (L Bytes)**: Original file extension (e.g., `txt`).
3. **Alphabet Size $N$ (2 Bytes)**: `uint16_t` count of unique character entries.
4. **Alphabet Entries ($N \times 5$ Bytes)**: Mapping of character value (1 byte) to its original frequency count (4-byte `uint32_t`).
5. **Raw Bitstream**: Huffman-coded bit sequences.

### Trailing Bit Alignment
Bits are packed into 8-bit bytes. If the total encoded bit length is not a multiple of 8, the last byte is left-padded with zero bits.
* **Decompression Safety**: The decompressor sums the character frequencies in the header to compute `total_chars`. It stops decoding once it outputs `total_chars`, ignoring trailing padding bits.

---

## 🛠️ Component Overview

* **`BitWriter`**: Left-shifts bits into a single byte buffer. Writes to the output vector when 8 bits accumulate.
* **`BitReader`**: Reads a byte from the input vector and uses bitmasks to test the most significant bit to yield bits sequentially.
* **`httplib` API**: Maps `/api/compress` and `/api/decompress` POST endpoints, extracting files from `MultipartFormData` directly into vectors and sending raw binary results.
