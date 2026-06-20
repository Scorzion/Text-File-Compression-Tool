#include <iostream>
#include <fstream>
#include <vector>
#include <queue>
#include <unordered_map>
#include <string>
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

class BitReader {
private:
    std::ifstream& in;
    unsigned char buffer;
    int bit_count;

public:
    BitReader(std::ifstream& is) : in(is), buffer(0), bit_count(0) {}

    bool read_bit(bool& bit) {
        if (bit_count == 0) {
            char ch;
            if (!in.get(ch)) {
                return false;
            }
            buffer = static_cast<unsigned char>(ch);
            bit_count = 8;
        }
        bit = (buffer & 0x80) != 0;
        buffer = buffer << 1;
        bit_count--;
        return true;
    }
};

int main(int argc, char* argv[]) {
    if (argc != 2) {
        std::cerr << "Usage: " << argv[0] << " <compressed_file>\n";
        return 1;
    }

    std::string input_path = argv[1];
    std::ifstream input(input_path, std::ios::binary);
    if (!input) {
        std::cerr << "Error: Could not open compressed file: " << input_path << "\n";
        return 2;
    }

    // Read header:
    // 1. Extension length (1 byte) + Extension string
    uint8_t ext_len = 0;
    if (!input.read(reinterpret_cast<char*>(&ext_len), sizeof(ext_len))) {
        std::cerr << "Error: Failed to read extension length.\n";
        return 4;
    }

    std::string ext = "";
    if (ext_len > 0) {
        std::vector<char> ext_buf(ext_len);
        if (!input.read(ext_buf.data(), ext_len)) {
            std::cerr << "Error: Failed to read extension string.\n";
            return 4;
        }
        ext = std::string(ext_buf.begin(), ext_buf.end());
    }

    // 2. Number of unique characters (2 bytes)
    uint16_t num_unique = 0;
    if (!input.read(reinterpret_cast<char*>(&num_unique), sizeof(num_unique))) {
        std::cerr << "Error: Failed to read alphabet size.\n";
        return 4;
    }

    // 3. Read alphabet and frequencies
    std::vector<std::pair<unsigned char, uint32_t>> unique_chars;
    uint32_t total_chars = 0;
    for (uint16_t i = 0; i < num_unique; ++i) {
        unsigned char ch;
        uint32_t freq;
        if (!input.read(reinterpret_cast<char*>(&ch), sizeof(ch)) ||
            !input.read(reinterpret_cast<char*>(&freq), sizeof(freq))) {
            std::cerr << "Error: Failed to read frequency table.\n";
            return 4;
        }
        unique_chars.push_back({ch, freq});
        total_chars += freq;
    }

    // Handle empty file case
    if (total_chars == 0) {
        // Output file path
        std::string out_path;
        size_t comp_pos = input_path.find("-compressed");
        if (comp_pos != std::string::npos) {
            out_path = input_path.substr(0, comp_pos) + "-decompressed." + ext;
        } else {
            size_t dot_pos = input_path.find_last_of('.');
            out_path = ((dot_pos != std::string::npos) ? input_path.substr(0, dot_pos) : input_path) + "-decompressed." + ext;
        }
        std::ofstream output(out_path, std::ios::binary);
        std::cout << "Successfully decompressed 0 bytes (empty file) into " << out_path << "\n";
        return 0;
    }

    // Reconstruct Huffman tree
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

    // Output file path
    std::string out_path;
    size_t comp_pos = input_path.find("-compressed");
    if (comp_pos != std::string::npos) {
        out_path = input_path.substr(0, comp_pos) + "-decompressed." + ext;
    } else {
        size_t dot_pos = input_path.find_last_of('.');
        out_path = ((dot_pos != std::string::npos) ? input_path.substr(0, dot_pos) : input_path) + "-decompressed." + ext;
    }

    std::ofstream output(out_path, std::ios::binary);
    if (!output) {
        std::cerr << "Error: Could not create output file: " << out_path << "\n";
        delete root;
        return 3;
    }

    // Decompress using Huffman tree
    BitReader reader(input);
    uint32_t decoded_count = 0;
    Node* curr = root;
    bool bit;

    while (decoded_count < total_chars && reader.read_bit(bit)) {
        if (!curr) break;

        // Traverse tree
        if (curr->left && curr->right) {
            curr = bit ? curr->right : curr->left;
        } else if (curr->left) {
            curr = curr->left;
        } else if (curr->right) {
            curr = curr->right;
        }

        // If we reached a leaf node
        if (curr && !curr->left && !curr->right) {
            output.put(static_cast<char>(curr->ch));
            decoded_count++;
            curr = root;
        }
    }

    if (decoded_count < total_chars) {
        std::cerr << "Warning: Decompression stopped early. Expected " << total_chars << " bytes, but only decoded " << decoded_count << " bytes.\n";
    }

    // Clean up memory
    delete root;

    std::cout << "Successfully decompressed " << decoded_count << " bytes into " << out_path << "\n";
    return 0;
}