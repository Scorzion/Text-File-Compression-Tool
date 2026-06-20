import os
import time
import uuid
import glob
import shutil
import subprocess
from flask import Flask, render_template, request, send_from_directory, jsonify

app = Flask(__name__)

# Base directories
BASE_DIR = os.path.abspath(os.path.dirname(__file__))
INSTANCE_DIR = os.path.join(BASE_DIR, 'instance')
UPLOAD_FOLDER = os.path.join(INSTANCE_DIR, 'uploads')
DOWNLOAD_FOLDER = os.path.join(INSTANCE_DIR, 'downloads')

app.config["UPLOAD_FOLDER"] = UPLOAD_FOLDER
app.config["DOWNLOAD_FOLDER"] = DOWNLOAD_FOLDER

# Ensure folders exist
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
os.makedirs(DOWNLOAD_FOLDER, exist_ok=True)

# Clean up all uploads/downloads on startup
def startup_clean():
    try:
        if os.path.exists(INSTANCE_DIR):
            shutil.rmtree(INSTANCE_DIR)
        os.makedirs(UPLOAD_FOLDER, exist_ok=True)
        os.makedirs(DOWNLOAD_FOLDER, exist_ok=True)
    except Exception as e:
        print(f"Error during startup cleanup: {e}")

startup_clean()

def clean_old_sessions():
    """Deletes directories in uploads/downloads older than 1 hour to prevent disk bloat."""
    now = time.time()
    for root_dir in [UPLOAD_FOLDER, DOWNLOAD_FOLDER]:
        if not os.path.exists(root_dir):
            continue
        for item in os.listdir(root_dir):
            item_path = os.path.join(root_dir, item)
            if os.path.isdir(item_path):
                # Check creation/modification time of the folder
                mtime = os.path.getmtime(item_path)
                if now - mtime > 3600:  # older than 1 hour
                    try:
                        shutil.rmtree(item_path)
                    except Exception as e:
                        print(f"Failed to delete old folder {item_path}: {e}")

@app.route("/")
def home():
    clean_old_sessions()
    return render_template("index.html")

@app.route("/api/compress", methods=["POST"])
def compress_api():
    clean_old_sessions()
    
    if "file" not in request.files:
        return jsonify({"success": False, "error": "No file uploaded."}), 400
        
    up_file = request.files["file"]
    if not up_file or len(up_file.filename) == 0:
        return jsonify({"success": False, "error": "Empty or invalid file."}), 400

    filename = up_file.filename
    task_id = str(uuid.uuid4())
    task_upload_dir = os.path.join(app.config["UPLOAD_FOLDER"], task_id)
    os.makedirs(task_upload_dir, exist_ok=True)
    
    input_path = os.path.join(task_upload_dir, filename)
    up_file.save(input_path)
    
    # Check if compiled binary exists. If not, build it.
    c_binary = os.path.join(BASE_DIR, 'c')
    if not os.path.exists(c_binary):
        try:
            subprocess.run(["make"], cwd=BASE_DIR, check=True, capture_output=True)
        except Exception as e:
            return jsonify({"success": False, "error": f"Failed to compile C++ compression engine: {str(e)}"}), 500
            
    # Run the compression engine
    start_time = time.time()
    try:
        proc = subprocess.run([c_binary, input_path], capture_output=True, text=True, check=True)
    except subprocess.CalledProcessError as e:
        return jsonify({
            "success": False, 
            "error": f"Compression engine crashed with code {e.returncode}.",
            "details": e.stderr
        }), 500
    except Exception as e:
        return jsonify({"success": False, "error": f"Failed to run compression engine: {str(e)}"}), 500
        
    duration = time.time() - start_time
    
    # Compressed file path
    base_name, _ = os.path.splitext(filename)
    compressed_filename = f"{base_name}-compressed.bin"
    compressed_path = os.path.join(task_upload_dir, compressed_filename)
    
    if not os.path.exists(compressed_path):
        return jsonify({"success": False, "error": "Compression completed, but compressed file not found."}), 500
        
    original_size = os.path.getsize(input_path)
    compressed_size = os.path.getsize(compressed_path)
    
    # Calculate stats
    savings = (1 - (compressed_size / original_size)) * 100 if original_size > 0 else 0
    ratio = (compressed_size / original_size) if original_size > 0 else 0
    
    return jsonify({
        "success": True,
        "original_name": filename,
        "compressed_name": compressed_filename,
        "original_size": original_size,
        "compressed_size": compressed_size,
        "savings": f"{savings:.2f}%",
        "ratio": f"{ratio:.2f}x",
        "time_ms": int(duration * 1000),
        "download_url": f"/download/{task_id}/{compressed_filename}"
    })

@app.route("/api/decompress", methods=["POST"])
def decompress_api():
    clean_old_sessions()
    
    if "file" not in request.files:
        return jsonify({"success": False, "error": "No file uploaded."}), 400
        
    up_file = request.files["file"]
    if not up_file or len(up_file.filename) == 0:
        return jsonify({"success": False, "error": "Empty or invalid file."}), 400

    filename = up_file.filename
    task_id = str(uuid.uuid4())
    task_upload_dir = os.path.join(app.config["UPLOAD_FOLDER"], task_id)
    os.makedirs(task_upload_dir, exist_ok=True)
    
    input_path = os.path.join(task_upload_dir, filename)
    up_file.save(input_path)
    
    # Check if compiled binary exists. If not, build it.
    d_binary = os.path.join(BASE_DIR, 'd')
    if not os.path.exists(d_binary):
        try:
            subprocess.run(["make"], cwd=BASE_DIR, check=True, capture_output=True)
        except Exception as e:
            return jsonify({"success": False, "error": f"Failed to compile C++ decompression engine: {str(e)}"}), 500
            
    # Run the decompression engine
    start_time = time.time()
    try:
        proc = subprocess.run([d_binary, input_path], capture_output=True, text=True, check=True)
    except subprocess.CalledProcessError as e:
        return jsonify({
            "success": False, 
            "error": f"Decompression engine crashed with code {e.returncode}.",
            "details": e.stderr
        }), 500
    except Exception as e:
        return jsonify({"success": False, "error": f"Failed to run decompression engine: {str(e)}"}), 500
        
    duration = time.time() - start_time
    
    # Locate decompressed file inside task_upload_dir
    # The C++ tool names it as: <base_name_before_compressed>-decompressed.<ext>
    # Let's search for files matching *-decompressed.*
    decompressed_files = glob.glob(os.path.join(task_upload_dir, "*-decompressed.*"))
    if not decompressed_files:
        return jsonify({"success": False, "error": "Decompression completed, but decompressed file not found."}), 500
        
    decompressed_path = decompressed_files[0]
    decompressed_filename = os.path.basename(decompressed_path)
    
    original_size = os.path.getsize(input_path)
    decompressed_size = os.path.getsize(decompressed_path)
    
    return jsonify({
        "success": True,
        "original_name": filename,
        "decompressed_name": decompressed_filename,
        "original_size": original_size,
        "decompressed_size": decompressed_size,
        "time_ms": int(duration * 1000),
        "download_url": f"/download/{task_id}/{decompressed_filename}"
    })

@app.route("/download/<task_id>/<filename>")
def download_file(task_id, filename):
    # Restrict path to prevent traverse
    safe_task_id = os.path.basename(task_id)
    safe_filename = os.path.basename(filename)
    directory = os.path.join(app.config["UPLOAD_FOLDER"], safe_task_id)
    return send_from_directory(directory, safe_filename, as_attachment=True)

if __name__ == "__main__":
    app.run(debug=True, host="127.0.0.1", port=5000)