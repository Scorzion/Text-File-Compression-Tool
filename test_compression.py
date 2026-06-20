import os
import subprocess
import hashlib
import shutil

def get_md5(file_path):
    if not os.path.exists(file_path):
        return None
    hasher = hashlib.md5()
    with open(file_path, 'rb') as f:
        buf = f.read(4096)
        while len(buf) > 0:
            hasher.update(buf)
            buf = f.read(4096)
    return hasher.hexdigest()

def run_test(name, content):
    print(f"\n--- Running Test: {name} ---")
    
    # Create test directory
    test_dir = "test_run"
    os.makedirs(test_dir, exist_ok=True)
    
    input_file = os.path.join(test_dir, f"{name}.txt")
    with open(input_file, 'wb') as f:
        f.write(content)
        
    orig_md5 = get_md5(input_file)
    orig_size = os.path.getsize(input_file)
    print(f"Original file size: {orig_size} bytes")
    
    # Compress
    comp_proc = subprocess.run(["./c", input_file], capture_output=True, text=True)
    if comp_proc.returncode != 0:
        print(f"FAIL: Compression failed for {name} with code {comp_proc.returncode}")
        print("Stderr:", comp_proc.stderr)
        return False
        
    compressed_file = os.path.join(test_dir, f"{name}-compressed.bin")
    if not os.path.exists(compressed_file):
        print(f"FAIL: Compressed binary {compressed_file} not found")
        return False
        
    comp_size = os.path.getsize(compressed_file)
    print(f"Compressed size: {comp_size} bytes")
    savings = (1 - (comp_size / orig_size)) * 100 if orig_size > 0 else 0
    print(f"Space savings: {savings:.2f}%")
    
    # Decompress
    decomp_proc = subprocess.run(["./d", compressed_file], capture_output=True, text=True)
    if decomp_proc.returncode != 0:
        print(f"FAIL: Decompression failed for {name} with code {decomp_proc.returncode}")
        print("Stderr:", decomp_proc.stderr)
        return False
        
    decompressed_file = os.path.join(test_dir, f"{name}-decompressed.txt")
    if not os.path.exists(decompressed_file):
        print(f"FAIL: Decompressed file {decompressed_file} not found")
        return False
        
    decomp_md5 = get_md5(decompressed_file)
    decomp_size = os.path.getsize(decompressed_file)
    
    if orig_md5 != decomp_md5:
        print(f"FAIL: MD5 mismatch! Original MD5={orig_md5}, Decompressed MD5={decomp_md5}")
        return False
        
    print(f"SUCCESS: Decompressed matches original size of {decomp_size} bytes and hash: {decomp_md5}")
    return True

def main():
    # Build binaries first
    print("Building C++ binaries...")
    subprocess.run(["make", "clean"])
    make_proc = subprocess.run(["make"], capture_output=True, text=True)
    if make_proc.returncode != 0:
        print("FAIL: Compilation failed!")
        print(make_proc.stderr)
        return
        
    test_cases = {
        "empty": b"",
        "single_char": b"a" * 1000,
        "simple": b"hello world! hello world! huffman coding compression test.",
        "repeated": b"abc" * 10000,
        "binary_like": bytes(range(256)) * 100,
        "lorem": (
            b"Lorem ipsum dolor sit amet, consectetur adipiscing elit. "
            b"Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. "
            b"Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris "
            b"nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in "
            b"reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla "
            b"pariatur. Excepteur sint occaecat cupidatat non proident, sunt in "
            b"culpa qui officia deserunt mollit anim id est laborum."
        ) * 50
    }
    
    all_success = True
    for name, content in test_cases.items():
        if not run_test(name, content):
            all_success = False
            
    # Cleanup test_run
    if os.path.exists("test_run"):
        shutil.rmtree("test_run")
        
    if all_success:
        print("\n=== ALL TESTS PASSED SUCCESSFULLY! ===")
    else:
        print("\n=== SOME TESTS FAILED ===")

if __name__ == "__main__":
    main()
