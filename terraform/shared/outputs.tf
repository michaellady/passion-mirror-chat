# Outputs for Shared Infrastructure

# VPC Outputs
output "vpc_id" {
  description = "ID of the VPC"
  value       = aws_vpc.main.id
}

output "vpc_cidr" {
  description = "CIDR block of the VPC"
  value       = aws_vpc.main.cidr_block
}

output "public_subnet_ids" {
  description = "IDs of the public subnets"
  value       = aws_subnet.public[*].id
}

output "private_subnet_ids" {
  description = "IDs of the private subnets"
  value       = aws_subnet.private[*].id
}

# Security Group Outputs
output "lambda_security_group_id" {
  description = "ID of the Lambda security group"
  value       = aws_security_group.lambda.id
}

output "rds_security_group_id" {
  description = "ID of the RDS security group"
  value       = aws_security_group.rds.id
}

output "alb_security_group_id" {
  description = "ID of the ALB security group"
  value       = aws_security_group.alb.id
}

# RDS Outputs
output "rds_endpoint" {
  description = "RDS instance endpoint"
  value       = aws_db_instance.main.address
}

output "rds_port" {
  description = "RDS instance port"
  value       = aws_db_instance.main.port
}

output "rds_database_name" {
  description = "RDS database name"
  value       = aws_db_instance.main.db_name
}

output "rds_username" {
  description = "RDS master username"
  value       = aws_db_instance.main.username
}

output "db_credentials_secret_arn" {
  description = "ARN of the Secrets Manager secret containing DB credentials"
  value       = aws_secretsmanager_secret.db_credentials.arn
}

output "db_credentials_secret_name" {
  description = "Name of the Secrets Manager secret containing DB credentials"
  value       = aws_secretsmanager_secret.db_credentials.name
}

# ACM Outputs (conditional)
output "acm_certificate_arn" {
  description = "ARN of the ACM certificate (if custom domain enabled)"
  value       = var.enable_custom_domain ? aws_acm_certificate_validation.main[0].certificate_arn : null
}

output "hosted_zone_id" {
  description = "Route53 hosted zone ID (if custom domain enabled)"
  value       = var.enable_custom_domain ? local.hosted_zone_id : null
}

# Cleanup Lambda Outputs (dev only)
output "cleanup_lambda_function_name" {
  description = "Name of the cleanup Lambda function (dev only)"
  value       = local.enable_cleanup_lambda ? aws_lambda_function.cleanup[0].function_name : null
}

output "cleanup_lambda_function_arn" {
  description = "ARN of the cleanup Lambda function (dev only)"
  value       = local.enable_cleanup_lambda ? aws_lambda_function.cleanup[0].arn : null
}

# CloudWatch Dashboard
output "cloudwatch_dashboard_url" {
  description = "URL to the CloudWatch dashboard"
  value       = "https://${var.aws_region}.console.aws.amazon.com/cloudwatch/home?region=${var.aws_region}#dashboards:name=${aws_cloudwatch_dashboard.main.dashboard_name}"
}
