# Outputs for Service Infrastructure

# Lambda Outputs
output "lambda_function_name" {
  description = "Name of the deployed Lambda function"
  value       = aws_lambda_function.api.function_name
}

output "lambda_function_arn" {
  description = "ARN of the deployed Lambda function"
  value       = aws_lambda_function.api.arn
}

# API Gateway Outputs
output "api_gateway_endpoint" {
  description = "API Gateway HTTP endpoint URL"
  value       = aws_apigatewayv2_api.api.api_endpoint
}

output "api_gateway_id" {
  description = "ID of the API Gateway"
  value       = aws_apigatewayv2_api.api.id
}

output "api_url" {
  description = "Full API URL (custom domain if enabled, otherwise API Gateway endpoint)"
  value       = local.api_domain != null ? "https://${local.api_domain}" : aws_apigatewayv2_api.api.api_endpoint
}

# Frontend Outputs
output "s3_bucket_name" {
  description = "Name of the S3 bucket for frontend assets"
  value       = aws_s3_bucket.frontend.id
}

output "s3_bucket_arn" {
  description = "ARN of the S3 bucket for frontend assets"
  value       = aws_s3_bucket.frontend.arn
}

output "cloudfront_distribution_id" {
  description = "ID of the CloudFront distribution"
  value       = aws_cloudfront_distribution.frontend.id
}

output "cloudfront_domain_name" {
  description = "CloudFront distribution domain name"
  value       = aws_cloudfront_distribution.frontend.domain_name
}

output "frontend_url" {
  description = "Full frontend URL (custom domain if enabled, otherwise CloudFront)"
  value       = local.www_domain != null ? "https://${local.www_domain}" : "https://${aws_cloudfront_distribution.frontend.domain_name}"
}

# Custom Domain Outputs
output "custom_domain_api" {
  description = "Custom domain name for API (if enabled)"
  value       = local.api_domain
}

output "custom_domain_www" {
  description = "Custom domain name for frontend (if enabled)"
  value       = local.www_domain
}

output "certificate_arn" {
  description = "ACM certificate ARN (from shared infrastructure)"
  value       = local.acm_certificate_arn
}

# Database Outputs
output "db_endpoint" {
  description = "RDS instance endpoint (from shared infrastructure)"
  value       = local.rds_endpoint
}

output "db_name" {
  description = "Database name used by this service"
  value       = local.database_name
}

output "db_secret_arn" {
  description = "ARN of the Secrets Manager secret containing database credentials"
  value       = aws_secretsmanager_secret.database.arn
  sensitive   = true
}

# Network Outputs (from shared infrastructure)
output "vpc_id" {
  description = "ID of the VPC (from shared infrastructure)"
  value       = local.vpc_id
}

output "private_subnet_ids" {
  description = "IDs of private subnets (from shared infrastructure)"
  value       = local.private_subnet_ids
}

# CloudWatch Outputs
output "lambda_log_group" {
  description = "CloudWatch log group name for Lambda logs"
  value       = aws_cloudwatch_log_group.lambda_logs.name
}

output "api_log_group" {
  description = "CloudWatch log group name for API Gateway logs"
  value       = aws_cloudwatch_log_group.api_logs.name
}
