import subprocess
import sys

def install_ffmpeg():
    print("Starting FFMPEG installation...")

    subprocess.check_call([sys.executable, "-m", "pip", "install", "--upgrade", "pip"])

    subprocess.check_call([sys.executable, "-m", "pip", "install", "--upgrade", "setuptools"])

    try:
        subprocess.check_call([sys.executable, "-m", "pip", 
                               "install", "ffmpeg-python"])
        print("FFMPEG installation completed successfully.")

    except subprocess.CalledProcessError as e:
        print("Failed to install ffmpeg-python via pip")

    try:
        subprocess.check_call([
            "wget", 
            "https://johnvansickle.com/ffmpeg/releases/ffmpeg-release-amd64-static.tar.xz",
            "-O", "/tmp/ffmpeg.tar.xz"
        ])
        
        subprocess.check_call([
            "tar", 
            "-xvf", 
            "/tmp/ffmpeg.tar.xz", 
            "-C", 
            "/tmp/"
        ])

        result = subprocess.run(
            ["find", "/tmp/", "-name", "ffmpeg", "-type", "f"],
            capture_output=True, text=True
        )

        ffmpeg_path = result.stdout.strip()

        subprocess.check_call(["cp", ffmpeg_path, "/usr/local/bin/ffmpeg"])

        subprocess.check_call(["chmod", "+x", "/usr/local/bin/ffmpeg"])

        print("FFMPEG binary installed successfully.")

    except subprocess.CalledProcessError as e:
        print(f"Failed to download or install FFMPEG binary: {e}")

    try:
        result = subprocess.run(
            ["ffmpeg", "-version"], capture_output=True, text=True)
        print("FFMPEG version:")
        print(result.stdout)
        return True
    except (subprocess.CalledProcessError, FileNotFoundError):
        print("FFMPEG is not installed correctly.")
        return False
