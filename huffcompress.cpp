#include <iostream>
#include <fstream>
#include <vector>
#include <queue>
#include <unordered_map>
#include <string>
#include <algorithm>
#include <cstdint>

struct Node {
    unsigned char ch;
    uint32_t freq;
    Node* left;
    Node* right;

    Node(unsigned char c, uint32_t f) : ch(c), freq(f), left(nullptr), right(nullptr) {}
    Node(uint32_t f, Node* l, Node* r) : ch(0), freq(f), left(l), right(r) {}

    ~Node() {
        delete left;
        delete right;
    }
};

struct Compare {
    bool operator()(const Node* l, const Node* r) const {
        return l->freq > r->freq;
    }
};

class BitWriter {
private:
    std::ofstream& out;
    unsigned char buffer;
    int bit_count;

public:
    BitWriter(std::ofstream& os) : out(os), buffer(0), bit_count(0) {}

    void write_bit(bool bit) {
        buffer = (buffer << 1) | bit;
        bit_count++;
        if (bit_count == 8) {
            out.put(buffer);
            buffer = 0;
            bit_count = 0;
        }
    }

    void write_string(const std::string& bits) {
        for (char c : bits) {
            write_bit(c == '1');
        }
    }

    void flush() {
        if (bit_count > 0) {
            buffer = buffer << (8 - bit_count); // Left align padding
            out.put(buffer);
            buffer = 0;
            bit_count = 0;
        }
    }
};

void generate_codes(const Node* root, const std::string& code, std::unordered_map<unsigned char, std::string>& codes) {
    if (!root) return;
    if (!root->left && !root->right) {
        codes[root->ch] = code.empty() ? "0" : code;
        return;
    }
    generate_codes(root->left, code + "0", codes);
    generate_codes(root->right, code + "1", codes);
}

int main(int argc, char* argv[]) {
    if (argc != 2) {
        std::cerr << "Usage: " << argv[0] << " <input_file>\n";
        return 1;
    }

    std::string input_path = argv[1];
    std::ifstream input(input_path, std::ios::binary);
    if (!input) {
        std::cerr << "Error: Could not open input file: " << input_path << "\n";
        return 2;
    }

    // Count frequencies
    uint32_t freq[256] = {0};
    uint32_t total_chars = 0;
    char buffer[4096];
    while (input.read(buffer, sizeof(buffer)) || input.gcount() > 0) {
        std::streamsize bytes_read = input.gcount();
        for (std::streamsize i = 0; i < bytes_read; ++i) {
            freq[static_cast<unsigned char>(buffer[i])]++;
            total_chars++;
        }
    }

    // Extract file extension
    std::string ext = "";
    size_t last_dot = input_path.find_last_of('.');
    if (last_dot != std::string::npos) {
        ext = input_path.substr(last_dot + 1);
    }

    // Output filename
    std::string output_path;
    size_t last_slash = input_path.find_last_of("/\\");
    std::string base_path = (last_slash == std::string::npos) ? input_path : input_path.substr(last_slash + 1);
    size_t base_dot = base_path.find_last_of('.');
    std::string filename_without_ext = (base_dot == std::string::npos) ? base_path : base_path.substr(0, base_dot);

    std::string dir_path = (last_slash == std::string::npos) ? "" : input_path.substr(0, last_slash + 1);
    output_path = dir_path + filename_without_ext + "-compressed.bin";

    std::ofstream output(output_path, std::ios::binary);
    if (!output) {
        std::cerr << "Error: Could not create output file: " << output_path << "\n";
        return 3;
    }

    // Write header:
    // 1. Extension length (1 byte) + Extension string
    uint8_t ext_len = static_cast<uint8_t>(ext.length());
    output.write(reinterpret_cast<const char*>(&ext_len), sizeof(ext_len));
    if (ext_len > 0) {
        output.write(ext.c_str(), ext_len);
    }

    // Collect unique characters
    std::vector<std::pair<unsigned char, uint32_t>> unique_chars;
    for (int i = 0; i < 256; ++i) {
        if (freq[i] > 0) {
            unique_chars.push_back({static_cast<unsigned char>(i), freq[i]});
        }
    }

    // 2. Number of unique characters (2 bytes)
    uint16_t num_unique = static_cast<uint16_t>(unique_chars.size());
    output.write(reinterpret_cast<const char*>(&num_unique), sizeof(num_unique));

    // 3. Write alphabet and frequencies (5 bytes per entry)
    for (const auto& item : unique_chars) {
        output.write(reinterpret_cast<const char*>(&item.first), sizeof(item.first));
        output.write(reinterpret_cast<const char*>(&item.second), sizeof(item.second));
    }

    // Build Huffman tree
    std::priority_queue<Node*, std::vector<Node*>, Compare> pq;
    for (const auto& item : unique_chars) {
        pq.push(new Node(item.first, item.second));
    }

    Node* root = nullptr;
    if (!pq.empty()) {
        if (pq.size() == 1) {
            Node* single = pq.top(); pq.pop();
            root = new Node(single->freq, single, nullptr);
        } else {
            while (pq.size() > 1) {
                Node* left = pq.top(); pq.pop();
                Node* right = pq.top(); pq.pop();
                Node* parent = new Node(left->freq + right->freq, left, right);
                pq.push(parent);
            }
            root = pq.top();
        }
    }

    std::unordered_map<unsigned char, std::string> codes;
    if (root) {
        generate_codes(root, "", codes);
    }

    // Reset input to read characters again and encode
    input.clear();
    input.seekg(0, std::ios::beg);

    BitWriter writer(output);
    while (input.read(buffer, sizeof(buffer)) || input.gcount() > 0) {
        std::streamsize bytes_read = input.gcount();
        for (std::streamsize i = 0; i < bytes_read; ++i) {
            unsigned char ch = static_cast<unsigned char>(buffer[i]);
            writer.write_string(codes[ch]);
        }
    }

    writer.flush();

    // Clean up memory
    delete root;

    std::cout << "Successfully compressed " << total_chars << " bytes into " << output_path << "\n";
    return 0;
}