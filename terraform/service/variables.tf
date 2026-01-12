# Input Variables for Service Infrastructure

variable "aws_region" {
  description = "AWS region for deployment"
  type        = string
  default     = "us-west-2"
}

variable "environment" {
  description = "Environment name (dev or prod)"
  type        = string
  validation {
    condition     = contains(["dev", "prod"], var.environment)
    error_message = "Environment must be either 'dev' or 'prod'."
  }
}

variable "function_name" {
  description = "Name of the Lambda function (will be suffixed with environment)"
  type        = string
  default     = "passion-api"
}

variable "lambda_zip_path" {
  description = "Path to the Lambda deployment package (ZIP file)"
  type        = string
  default     = "../../lambda/bootstrap.zip"
}

variable "lambda_timeout" {
  description = "Lambda function timeout in seconds"
  type        = number
  default     = 60
}

variable "lambda_memory_size" {
  description = "Lambda function memory size in MB"
  type        = number
  default     = 256
}

variable "log_retention_days" {
  description = "CloudWatch log retention period in days"
  type        = number
  default     = 7
}

variable "log_level" {
  description = "Application log level"
  type        = string
  default     = "info"
}

# Sensitive variables - must be provided via environment or tfvars
variable "nimrobo_api_key" {
  description = "Nimrobo API key for voice interview sessions"
  type        = string
  sensitive   = true
}

variable "tags" {
  description = "Common tags for all resources"
  type        = map(string)
  default = {
    Project   = "Passion"
    ManagedBy = "Terraform"
  }
}

# Custom Domain Configuration
variable "custom_domain_enabled" {
  description = "Enable custom domain for API Gateway and CloudFront"
  type        = bool
  default     = true
}

# Frontend Configuration
variable "frontend_build_path" {
  description = "Path to the frontend build output (dist folder)"
  type        = string
  default     = "../../dist"
}

# Domain variables (passed from shared or tfvars)
variable "dev_domain_name" {
  description = "Domain name for dev environment (e.g., dev.passion.app)"
  type        = string
  default     = ""
}

variable "prod_domain_name" {
  description = "Domain name for prod environment (e.g., passion.app)"
  type        = string
  default     = ""
}

variable "api_subdomain" {
  description = "Subdomain for API Gateway (e.g., api -> api.passion.app)"
  type        = string
  default     = "api"
}
