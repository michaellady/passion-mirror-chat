# Passion Service Infrastructure
#
# This module creates:
# - Lambda functions for API endpoints (mirrors Supabase Edge Functions)
# - API Gateway HTTP API with custom domain
# - S3 bucket for frontend static assets
# - CloudFront distribution for frontend CDN
# - IAM roles for Lambda execution
# - CloudWatch log groups

# Local values for resource naming
locals {
  function_name_full = "${var.function_name}-${var.environment}"

  common_tags = merge(var.tags, {
    Environment = var.environment
  })

  # Domain configuration
  base_domain = var.environment == "prod" ? var.prod_domain_name : var.dev_domain_name
  api_domain  = var.custom_domain_enabled && local.base_domain != "" ? "${var.api_subdomain}.${local.base_domain}" : null
  www_domain  = var.custom_domain_enabled && local.base_domain != "" ? local.base_domain : null
}

# =============================================================================
# IAM Role for Lambda Execution
# =============================================================================

resource "aws_iam_role" "lambda_exec" {
  name = "${local.function_name_full}-exec-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "lambda.amazonaws.com"
        }
      }
    ]
  })

  tags = local.common_tags
}

# Attach basic Lambda execution policy
resource "aws_iam_role_policy_attachment" "lambda_basic" {
  role       = aws_iam_role.lambda_exec.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

# Attach VPC execution policy (for Lambda to access RDS in VPC)
resource "aws_iam_role_policy_attachment" "lambda_vpc" {
  role       = aws_iam_role.lambda_exec.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaVPCAccessExecutionRole"
}

# =============================================================================
# CloudWatch Log Groups
# =============================================================================

resource "aws_cloudwatch_log_group" "lambda_logs" {
  name              = "/aws/lambda/${local.function_name_full}"
  retention_in_days = var.log_retention_days

  tags = local.common_tags
}

resource "aws_cloudwatch_log_group" "api_logs" {
  name              = "/aws/apigateway/${local.function_name_full}"
  retention_in_days = var.log_retention_days

  tags = local.common_tags
}

# =============================================================================
# Lambda Function
# =============================================================================

resource "aws_lambda_function" "api" {
  filename         = var.lambda_zip_path
  function_name    = local.function_name_full
  role             = aws_iam_role.lambda_exec.arn
  handler          = "bootstrap"
  source_code_hash = fileexists(var.lambda_zip_path) ? filebase64sha256(var.lambda_zip_path) : null
  runtime          = "provided.al2023"
  timeout          = var.lambda_timeout
  memory_size      = var.lambda_memory_size

  # VPC configuration for RDS access
  vpc_config {
    subnet_ids         = local.private_subnet_ids
    security_group_ids = [local.lambda_security_group_id]
  }

  environment {
    variables = {
      NIMROBO_API_KEY = var.nimrobo_api_key
      DB_SECRET_NAME  = aws_secretsmanager_secret.database.name
      LOG_LEVEL       = var.log_level
      ENVIRONMENT     = var.environment
    }
  }

  depends_on = [
    aws_cloudwatch_log_group.lambda_logs,
    aws_iam_role_policy_attachment.lambda_basic,
    aws_iam_role_policy_attachment.lambda_vpc
  ]

  tags = local.common_tags
}

# =============================================================================
# API Gateway HTTP API
# =============================================================================

resource "aws_apigatewayv2_api" "api" {
  name          = "${local.function_name_full}-api"
  protocol_type = "HTTP"
  description   = "Passion API Gateway (${var.environment})"

  cors_configuration {
    allow_origins = ["*"]
    allow_methods = ["GET", "POST", "PUT", "DELETE", "OPTIONS"]
    allow_headers = ["authorization", "x-client-info", "apikey", "content-type"]
    max_age       = 300
  }

  tags = local.common_tags
}

resource "aws_apigatewayv2_stage" "default" {
  api_id      = aws_apigatewayv2_api.api.id
  name        = "$default"
  auto_deploy = true

  access_log_settings {
    destination_arn = aws_cloudwatch_log_group.api_logs.arn
    format = jsonencode({
      requestId      = "$context.requestId"
      ip             = "$context.identity.sourceIp"
      requestTime    = "$context.requestTime"
      httpMethod     = "$context.httpMethod"
      routeKey       = "$context.routeKey"
      status         = "$context.status"
      protocol       = "$context.protocol"
      responseLength = "$context.responseLength"
    })
  }

  tags = local.common_tags
}

resource "aws_apigatewayv2_integration" "lambda" {
  api_id                 = aws_apigatewayv2_api.api.id
  integration_type       = "AWS_PROXY"
  integration_uri        = aws_lambda_function.api.invoke_arn
  integration_method     = "POST"
  payload_format_version = "2.0"
}

# Route: POST /start-interview (mirrors Supabase edge function)
resource "aws_apigatewayv2_route" "start_interview" {
  api_id    = aws_apigatewayv2_api.api.id
  route_key = "POST /start-interview"
  target    = "integrations/${aws_apigatewayv2_integration.lambda.id}"
}

# Route: GET /check-interview-status (mirrors Supabase edge function)
resource "aws_apigatewayv2_route" "check_interview_status" {
  api_id    = aws_apigatewayv2_api.api.id
  route_key = "GET /check-interview-status"
  target    = "integrations/${aws_apigatewayv2_integration.lambda.id}"
}

# Route: Catch-all for additional endpoints
resource "aws_apigatewayv2_route" "catchall" {
  api_id    = aws_apigatewayv2_api.api.id
  route_key = "$default"
  target    = "integrations/${aws_apigatewayv2_integration.lambda.id}"
}

# Lambda Permission for API Gateway
resource "aws_lambda_permission" "api_gateway" {
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.api.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.api.execution_arn}/*/*"
}

# =============================================================================
# S3 Bucket for Frontend Static Assets
# =============================================================================

resource "aws_s3_bucket" "frontend" {
  bucket_prefix = "passion-frontend-${var.environment}-"

  tags = local.common_tags
}

resource "aws_s3_bucket_public_access_block" "frontend" {
  bucket = aws_s3_bucket.frontend.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_versioning" "frontend" {
  bucket = aws_s3_bucket.frontend.id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "frontend" {
  bucket = aws_s3_bucket.frontend.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

# =============================================================================
# CloudFront Distribution
# =============================================================================

# Origin Access Control for S3
resource "aws_cloudfront_origin_access_control" "frontend" {
  name                              = "passion-frontend-${var.environment}-oac"
  description                       = "OAC for Passion frontend S3 bucket"
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}

# CloudFront Distribution
resource "aws_cloudfront_distribution" "frontend" {
  enabled             = true
  is_ipv6_enabled     = true
  default_root_object = "index.html"
  price_class         = "PriceClass_100" # US, Canada, Europe only for cost savings
  comment             = "Passion frontend (${var.environment})"

  # Custom domain aliases (if enabled)
  aliases = var.custom_domain_enabled && local.www_domain != null ? [local.www_domain] : []

  origin {
    domain_name              = aws_s3_bucket.frontend.bucket_regional_domain_name
    origin_access_control_id = aws_cloudfront_origin_access_control.frontend.id
    origin_id                = "S3-${aws_s3_bucket.frontend.id}"
  }

  default_cache_behavior {
    allowed_methods  = ["GET", "HEAD", "OPTIONS"]
    cached_methods   = ["GET", "HEAD"]
    target_origin_id = "S3-${aws_s3_bucket.frontend.id}"

    forwarded_values {
      query_string = false
      cookies {
        forward = "none"
      }
    }

    viewer_protocol_policy = "redirect-to-https"
    min_ttl                = 0
    default_ttl            = 3600
    max_ttl                = 86400
    compress               = true
  }

  # SPA routing: return index.html for 404s
  custom_error_response {
    error_code         = 404
    response_code      = 200
    response_page_path = "/index.html"
  }

  custom_error_response {
    error_code         = 403
    response_code      = 200
    response_page_path = "/index.html"
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  viewer_certificate {
    # Use custom ACM certificate if custom domain enabled, otherwise CloudFront default
    acm_certificate_arn            = var.custom_domain_enabled && local.acm_certificate_arn != null ? local.acm_certificate_arn : null
    ssl_support_method             = var.custom_domain_enabled && local.acm_certificate_arn != null ? "sni-only" : null
    minimum_protocol_version       = var.custom_domain_enabled && local.acm_certificate_arn != null ? "TLSv1.2_2021" : null
    cloudfront_default_certificate = !(var.custom_domain_enabled && local.acm_certificate_arn != null)
  }

  tags = local.common_tags
}

# S3 Bucket Policy for CloudFront OAC
resource "aws_s3_bucket_policy" "frontend" {
  bucket = aws_s3_bucket.frontend.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "AllowCloudFrontServicePrincipal"
        Effect = "Allow"
        Principal = {
          Service = "cloudfront.amazonaws.com"
        }
        Action   = "s3:GetObject"
        Resource = "${aws_s3_bucket.frontend.arn}/*"
        Condition = {
          StringEquals = {
            "AWS:SourceArn" = aws_cloudfront_distribution.frontend.arn
          }
        }
      }
    ]
  })
}
