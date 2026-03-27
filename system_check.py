#!/usr/bin/env python3
"""
system_check.py - Complete System Verification for Alwin Appliance Detector
=============================================================================
Verifies all components are properly connected and working
"""

import os
import sys
import subprocess
import json
from pathlib import Path

# Colors for terminal output
GREEN = '\033[92m'
RED = '\033[91m'
YELLOW = '\033[93m'
BLUE = '\033[94m'
END = '\033[0m'

def print_header(title):
    print(f"\n{BLUE}{'='*60}")
    print(f"  {title}")
    print(f"{'='*60}{END}\n")

def print_ok(message):
    print(f"{GREEN}✓{END} {message}")

def print_error(message):
    print(f"{RED}✗{END} {message}")

def print_warning(message):
    print(f"{YELLOW}⚠{END} {message}")

def check_file_exists(path, name):
    """Check if file/folder exists"""
    if os.path.exists(path):
        print_ok(f"{name}: {path}")
        return True
    else:
        print_error(f"{name} NOT FOUND: {path}")
        return False

def check_python_module(module_name):
    """Check if Python module is installed"""
    try:
        __import__(module_name)
        print_ok(f"Python module '{module_name}' installed")
        return True
    except ImportError:
        print_error(f"Python module '{module_name}' NOT installed")
        return False

def check_port_available(port):
    """Check if port is open/available"""
    try:
        import socket
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        result = sock.connect_ex(('127.0.0.1', port))
        sock.close()
        if result == 0:
            print_warning(f"Port {port} is already in use")
            return False
        else:
            print_ok(f"Port {port} is available")
            return True
    except Exception as e:
        print_error(f"Cannot check port {port}: {e}")
        return False

def main():
    print(f"\n{BLUE}")
    print("╔════════════════════════════════════════════════════════════╗")
    print("║  ALWIN APPLIANCE DETECTOR - SYSTEM VERIFICATION           ║")
    print("║  Complete startup check for all components                ║")
    print("╚════════════════════════════════════════════════════════════╝")
    print(END)

    all_ok = True
    
    # ───── PROJECT STRUCTURE ─────
    print_header("1. Project Structure")
    
    dirs = {
        'X:\\Alwin-Fp\\model': 'Model Directory',
        'X:\\Alwin-Fp\\server': 'Server Directory',
        'X:\\Alwin-Fp\\mobile-app': 'Mobile App Directory',
        'X:\\Alwin-Fp\\esp32': 'ESP32 Directory',
    }
    
    for path, name in dirs.items():
        if not check_file_exists(path, name):
            all_ok = False

    # ───── MODEL FILES ─────
    print_header("2. Model Files")
    
    model_files = {
        'X:\\Alwin-Fp\\model\\checkpoints\\mobilevit_appliance.onnx': 'ONNX Model',
        'X:\\Alwin-Fp\\model\\checkpoints\\mobilevit_appliance_best.pth': 'PyTorch Checkpoint',
        'X:\\Alwin-Fp\\model\\checkpoints\\class_map.json': 'Class Map',
        'X:\\Alwin-Fp\\model\\data\\train': 'Training Data',
        'X:\\Alwin-Fp\\model\\data\\val': 'Validation Data',
    }
    
    for path, name in model_files.items():
        if not check_file_exists(path, name):
            all_ok = False

    # ───── SERVER FILES ─────
    print_header("3. Server Files")
    
    server_files = {
        'X:\\Alwin-Fp\\server\\main.py': 'FastAPI Server',
        'X:\\Alwin-Fp\\server\\requirements.txt': 'Dependencies',
        'X:\\Alwin-Fp\\server\\esp32_client.py': 'ESP32 Client',
    }
    
    for path, name in server_files.items():
        if not check_file_exists(path, name):
            all_ok = False

    # ───── MOBILE APP FILES ─────
    print_header("4. Mobile App Files")
    
    app_files = {
        'X:\\Alwin-Fp\\mobile-app\\package.json': 'Package Config',
        'X:\\Alwin-Fp\\mobile-app\\app.json': 'Expo Config',
        'X:\\Alwin-Fp\\mobile-app\\App.js': 'Main App',
        'X:\\Alwin-Fp\\mobile-app\\screens\\CameraScreen.js': 'Camera Screen',
        'X:\\Alwin-Fp\\mobile-app\\screens\\ConfigScreen.js': 'Config Screen',
    }
    
    for path, name in app_files.items():
        if not check_file_exists(path, name):
            all_ok = False

    # ───── PYTHON DEPENDENCIES ─────
    print_header("5. Python Dependencies")
    
    python_modules = [
        'torch',
        'torchvision',
        'onnxruntime',
        'fastapi',
        'uvicorn',
        'pillow',
        'numpy',
        'opencv',
    ]
    
    missing_modules = []
    for module in python_modules:
        if not check_python_module(module):
            missing_modules.append(module)
            all_ok = False

    # ───── PORTS ─────
    print_header("6. Port Availability")
    
    ports = {
        8000: 'Backend Server',
        3000: 'Web App (optional)',
        19000: 'Expo Dev Server',
    }
    
    for port, name in ports.items():
        check_port_available(port)

    # ───── CONFIGURATION ─────
    print_header("7. Configuration")
    
    # Check MODEL_PATH env variable
    model_path = os.environ.get('MODEL_PATH')
    if model_path:
        print_ok(f"MODEL_PATH set: {model_path}")
    else:
        print_warning("MODEL_PATH not set (will use default)")

    # Check if model file exists at path
    if model_path and os.path.exists(model_path):
        print_ok(f"Model file accessible at MODEL_PATH")
    elif model_path:
        print_error(f"Model file NOT accessible at: {model_path}")
        all_ok = False

    # ───── DATA SUMMARY ─────
    print_header("8. Training Data Summary")
    
    train_dir = 'X:\\Alwin-Fp\\model\\data\\train'
    if os.path.exists(train_dir):
        classes = ['TV', 'Fan', 'AC', 'Light', 'Plug', 'Other']
        total_images = 0
        for cls in classes:
            cls_path = os.path.join(train_dir, cls)
            if os.path.exists(cls_path):
                images = len([f for f in os.listdir(cls_path) if f.lower().endswith(('.jpg', '.png', '.jpeg'))])
                total_images += images
                status = "✓" if images > 0 else "?"
                print(f"  {status} {cls:8} → {images:3} images")
        
        print(f"\n{GREEN}Total training images: {total_images}{END}")
        if total_images < 300:
            print_warning(f"Limited training data ({total_images} images). Consider adding more.")

    # ───── STARTUP COMMANDS ─────
    print_header("9. Startup Commands")
    
    print(f"{YELLOW}Terminal 1 - Backend Server:{END}")
    print(f"""
    cd X:\\Alwin-Fp\\server
    $env:MODEL_PATH = "X:\\Alwin-Fp\\model\\checkpoints\\mobilevit_appliance.onnx"
    python -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload
    """)
    
    print(f"{YELLOW}Terminal 2 - Mobile App:{END}")
    print(f"""
    cd X:\\Alwin-Fp\\mobile-app
    npm install
    npm start
    """)
    
    print(f"{YELLOW}Phone:{END}")
    print("""
    1. Install Expo Go from App Store / Google Play
    2. Scan QR code from Terminal 2
    3. App auto-configures and launches
    """)

    # ───── SUMMARY ─────
    print_header("VERIFICATION SUMMARY")
    
    if all_ok:
        print(f"{GREEN}✓ ALL SYSTEMS READY{END}")
        print(f"\n{BLUE}Next steps:{END}")
        print("1. Open 2 terminals")
        print("2. Run commands from section 9 above")
        print("3. Scan QR code on your phone")
        print("4. Test detection on camera screen")
        return 0
    else:
        print(f"{RED}✗ SOME ISSUES DETECTED{END}")
        print(f"\n{YELLOW}Please fix the errors above before starting{END}")
        if missing_modules:
            print(f"\nMissing Python modules: {', '.join(missing_modules)}")
            print(f"Install with: pip install {' '.join(missing_modules)}")
        return 1

if __name__ == '__main__':
    sys.exit(main())
