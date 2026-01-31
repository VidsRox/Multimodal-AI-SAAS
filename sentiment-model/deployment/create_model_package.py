import tarfile
import os

def create_model_package():
    """Package model and code files for SageMaker deployment"""
    
    print("Creating model package...")
    
    with tarfile.open('model.tar.gz', 'w:gz') as tar:
        # Add the model weights
        print("Adding model.pth...")
        tar.add('model_normalized/model.pth', arcname='model.pth')
        
        # Add all code files
        print("Adding inference.py...")
        tar.add('inference.py', arcname='code/inference.py')
        
        print("Adding models.py...")
        tar.add('models.py', arcname='code/models.py')
        
        print("Adding requirements.txt...")
        tar.add('requirements.txt', arcname='code/requirements.txt')
    
    print("✓ model.tar.gz created successfully")
    print("\nPackage contents:")
    
    # Verify contents
    with tarfile.open('model.tar.gz', 'r:gz') as tar:
        for member in tar.getmembers():
            print(f"  - {member.name}")

if __name__ == "__main__":
    create_model_package()
