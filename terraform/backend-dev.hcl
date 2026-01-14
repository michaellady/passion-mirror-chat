# Backend configuration for dev environment
# Run setup script first: ENVIRONMENT=dev ./scripts/setup-terraform-backend.sh
# Then: terraform init -backend-config=../backend-dev.hcl

bucket         = "passion-tf-state-dev-539402214167"
key            = "service/terraform.tfstate"
region         = "us-west-2"
encrypt        = true
dynamodb_table = "passion-tf-locks-dev"
