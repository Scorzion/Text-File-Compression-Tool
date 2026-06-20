#include "huffman.hpp"
#include <queue>
#include <unordered_map>
#include <iostream>
#include <functional>

// Node Constructors & Destructors
Node::Node(uint8_t c, uint32_t f) : ch(c), freq(f), left(nullptr), right(nullptr) {}
Node::Node(uint32_t f, Node* l, Node* r) : ch(0), freq(f), left(l), right(r) {}
Node::~Node() {
    delete left;
    delete right;
}

bool Compare::operator()(const Node* l, const Node* r) const {
    return l->freq > r->freq;
}

// In-Memory Bit Stream Writing
class BitWriter {
private:
    std::vector<uint8_t>& out;
    uint8_t buffer;
    int bit_count;

public:
    BitWriter(std::vector<uint8_t>& o) : out(o), buffer(0), bit_count(0) {}

    void write_bit(bool bit) {
        buffer = (buffer << 1) | bit;
        bit_count++;
        if (bit_count == 8) {
            out.push_back(buffer);
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
            out.push_back(buffer);
            buffer = 0;
            bit_count = 0;
        }
    }
};

// In-Memory Bit Stream Reading
class BitReader {
private:
    const std::vector<uint8_t>& in;
    size_t offset;
    uint8_t buffer;
    int bit_count;

public:
    BitReader(const std::vector<uint8_t>& i, size_t start_offset) 
        : in(i), offset(start_offset), buffer(0), bit_count(0) {}

    bool read_bit(bool& bit) {
        if (bit_count == 0) {
            if (offset >= in.size()) {
                return false;
            }
            buffer = in[offset++];
            bit_count = 8;
        }
        bit = (buffer & 0x80) != 0;
        buffer = buffer << 1;
        bit_count--;
        return true;
    }
};

// In-Memory Compression Implementation
std::vector<uint8_t> compress_memory(const std::vector<uint8_t>& input_data, const std::string& ext) {
    std::vector<uint8_t> output;
    
    // Handle empty file case
    if (input_data.empty()) {
        uint8_t ext_len = static_cast<uint8_t>(ext.length());
        output.push_back(ext_len);
        if (ext_len > 0) {
            for (char c : ext) output.push_back(c);
        }
        uint16_t num_unique = 0;
        output.push_back(num_unique & 0xFF);
        output.push_back((num_unique >> 8) & 0xFF);
        return output;
    }

    // Count frequencies
    uint32_t freq[256] = {0};
    for (uint8_t byte : input_data) {
        freq[byte]++;
    }

    // Write extension header
    uint8_t ext_len = static_cast<uint8_t>(ext.length());
    output.push_back(ext_len);
    if (ext_len > 0) {
        for (char c : ext) {
            output.push_back(c);
        }
    }

    // Extract unique characters for the codebook
    std::vector<std::pair<uint8_t, uint32_t>> unique_chars;
    for (int i = 0; i < 256; ++i) {
        if (freq[i] > 0) {
            unique_chars.push_back({static_cast<uint8_t>(i), freq[i]});
        }
    }

    // Write alphabet size (2 bytes)
    uint16_t num_unique = static_cast<uint16_t>(unique_chars.size());
    output.push_back(num_unique & 0xFF);
    output.push_back((num_unique >> 8) & 0xFF);

    // Write frequency table (5 bytes per entry)
    for (const auto& item : unique_chars) {
        output.push_back(item.first);
        uint32_t f = item.second;
        output.push_back(f & 0xFF);
        output.push_back((f >> 8) & 0xFF);
        output.push_back((f >> 16) & 0xFF);
        output.push_back((f >> 24) & 0xFF);
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

    // Generate prefix codes
    std::unordered_map<uint8_t, std::string> codes;
    std::function<void(const Node*, const std::string&)> generate_codes = [&](const Node* n, const std::string& code) {
        if (!n) return;
        if (!n->left && !n->right) {
            codes[n->ch] = code.empty() ? "0" : code;
            return;
        }
        generate_codes(n->left, code + "0");
        generate_codes(n->right, code + "1");
    };
    if (root) {
        generate_codes(root, "");
    }

    // Encode input stream
    BitWriter writer(output);
    for (uint8_t byte : input_data) {
        writer.write_string(codes[byte]);
    }
    writer.flush();

    delete root;
    return output;
}

// In-Memory Decompression Implementation
std::vector<uint8_t> decompress_memory(const std::vector<uint8_t>& compressed_data, std::string& ext) {
    std::vector<uint8_t> output;
    
    if (compressed_data.size() < 3) {
        return output;
    }

    size_t offset = 0;
    
    // Read extension
    uint8_t ext_len = compressed_data[offset++];
    if (offset + ext_len > compressed_data.size()) {
        return output;
    }
    
    ext = "";
    for (uint8_t i = 0; i < ext_len; ++i) {
        ext += static_cast<char>(compressed_data[offset++]);
    }

    // Read alphabet size
    if (offset + 2 > compressed_data.size()) {
        return output;
    }
    uint16_t num_unique = compressed_data[offset] | (compressed_data[offset + 1] << 8);
    offset += 2;

    if (num_unique == 0) {
        return output;
    }

    // Read frequency table
    std::vector<std::pair<uint8_t, uint32_t>> unique_chars;
    uint32_t total_chars = 0;
    for (uint16_t i = 0; i < num_unique; ++i) {
        if (offset + 5 > compressed_data.size()) {
            return output;
        }
        uint8_t ch = compressed_data[offset++];
        uint32_t freq = compressed_data[offset] |
                        (compressed_data[offset + 1] << 8) |
                        (compressed_data[offset + 2] << 16) |
                        (compressed_data[offset + 3] << 24);
        offset += 4;
        unique_chars.push_back({ch, freq});
        total_chars += freq;
    }

    if (total_chars == 0) {
        return output;
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

    // Decode bitstream
    BitReader reader(compressed_data, offset);
    uint32_t decoded_count = 0;
    Node* curr = root;
    bool bit;

    while (decoded_count < total_chars && reader.read_bit(bit)) {
        if (!curr) break;

        if (curr->left && curr->right) {
            curr = bit ? curr->right : curr->left;
        } else if (curr->left) {
            curr = curr->left;
        } else if (curr->right) {
            curr = curr->right;
        }

        if (curr && !curr->left && !curr->right) {
            output.push_back(curr->ch);
            decoded_count++;
            curr = root;
        }
    }

    delete root;
    return output;
}

// Unit Verification Tests
void run_tests() {
    std::cout << "=== Running Engine Tests ===\n";
    
    struct TestCase {
        std::string name;
        std::vector<uint8_t> data;
        std::string ext;
    };
    
    std::vector<TestCase> test_cases = {
        {"Empty File", {}, "txt"},
        {"Single Character Repeating", std::vector<uint8_t>(1000, 'a'), "txt"},
        {"Standard English Text", {'h','e','l','l','o',' ','w','o','r','l','d','!'}, "txt"},
        {"Uniform Repeats", std::vector<uint8_t>(30000, 'b'), "txt"}
    };
    
    // Unsigned Spectrum Binary values
    std::vector<uint8_t> binary_data;
    for (int r = 0; r < 10; ++r) {
        for (int i = 0; i < 256; ++i) {
            binary_data.push_back(static_cast<uint8_t>(i));
        }
    }
    test_cases.push_back({"Spectrum Binary Block", binary_data, "bin"});
    
    bool all_passed = true;
    for (const auto& tc : test_cases) {
        std::string decomp_ext;
        auto compressed = compress_memory(tc.data, tc.ext);
        auto decompressed = decompress_memory(compressed, decomp_ext);
        
        bool passed = (tc.data == decompressed) && (tc.ext == decomp_ext);
        
        std::cout << "Test: " << tc.name << " (" << tc.data.size() << " bytes) -> ";
        if (passed) {
            std::cout << "\033[32mPASSED\033[0m\n";
        } else {
            std::cout << "\033[31mFAILED!\033[0m\n";
            all_passed = false;
        }
    }
    
    std::cout << "\n=======================================\n";
    if (all_passed) {
        std::cout << "\033[32mAll unit tests passed successfully!\033[0m\n";
    } else {
        std::cout << "\033[31mSome unit tests failed!\033[0m\n";
    }
    std::cout << "=======================================\n";
}
