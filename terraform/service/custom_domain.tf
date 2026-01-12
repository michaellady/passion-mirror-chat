# Custom Domain Configuration
#
# API Gateway: api.{domain}/
# CloudFront (Frontend): {domain}/
#
# ACM certificate is managed by terraform/shared/ and referenced via SSM

# Local values for domain configuration
locals {
  # Determine if custom domain should be created
  create_custom_domain = var.custom_domain_enabled && local.base_domain != "" && local.hosted_zone_id != null
}

# =============================================================================
# API Gateway Custom Domain
# =============================================================================

# API Gateway Custom Domain Name
resource "aws_apigatewayv2_domain_name" "api" {
  count = local.create_custom_domain ? 1 : 0

  domain_name = local.api_domain

  domain_name_configuration {
    certificate_arn = local.acm_certificate_arn
    endpoint_type   = "REGIONAL"
    security_policy = "TLS_1_2"
  }

  tags = merge(local.common_tags, {
    Name = "${local.function_name_full}-api-domain"
  })
}

# API Gateway API Mapping
resource "aws_apigatewayv2_api_mapping" "api" {
  count = local.create_custom_domain ? 1 : 0

  api_id      = aws_apigatewayv2_api.api.id
  domain_name = aws_apigatewayv2_domain_name.api[0].id
  stage       = aws_apigatewayv2_stage.default.id
}

# Route53 A Record for API Gateway
resource "aws_route53_record" "api" {
  count = local.create_custom_domain ? 1 : 0

  zone_id = local.hosted_zone_id
  name    = local.api_domain
  type    = "A"

  alias {
    name                   = aws_apigatewayv2_domain_name.api[0].domain_name_configuration[0].target_domain_name
    zone_id                = aws_apigatewayv2_domain_name.api[0].domain_name_configuration[0].hosted_zone_id
    evaluate_target_health = false
  }
}

# =============================================================================
# CloudFront Custom Domain (Frontend)
# =============================================================================

# Route53 A Record for CloudFront (apex domain)
resource "aws_route53_record" "www" {
  count = local.create_custom_domain ? 1 : 0

  zone_id = local.hosted_zone_id
  name    = local.www_domain
  type    = "A"

  alias {
    name                   = aws_cloudfront_distribution.frontend.domain_name
    zone_id                = aws_cloudfront_distribution.frontend.hosted_zone_id
    evaluate_target_health = false
  }
}

# Route53 AAAA Record for CloudFront (IPv6)
resource "aws_route53_record" "www_ipv6" {
  count = local.create_custom_domain ? 1 : 0

  zone_id = local.hosted_zone_id
  name    = local.www_domain
  type    = "AAAA"

  alias {
    name                   = aws_cloudfront_distribution.frontend.domain_name
    zone_id                = aws_cloudfront_distribution.frontend.hosted_zone_id
    evaluate_target_health = false
  }
}
