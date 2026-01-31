from sagemaker.pytorch import PyTorchModel
import sagemaker

def deploy_endpoint():
    sagemaker.Session()
    role = "arn:aws:iam::354918370928:role/sentiment-analysis-deploy-endpoint-role"
    model_uri = "s3://meld-sentiment-analysis-saas/inference/model.tar.gz"

    model = PyTorchModel(
        model_data=model_uri,
        role=role,
        framework_version="2.5.1",
        py_version="py311",
        # Removed entry_point and source_dir - they're in the tar.gz now
        name="sentiment-analysis-model"
    )

    predictor = model.deploy(
        initial_instance_count=1,
        instance_type="ml.g5.xlarge",
        endpoint_name="sentiment-analysis-endpoint"
    )
    
    print(f"✓ Endpoint deployed: {predictor.endpoint_name}")
    return predictor

if __name__ == "__main__":
    deploy_endpoint()
