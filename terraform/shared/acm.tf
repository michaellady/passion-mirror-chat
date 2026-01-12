# ACM Certificate for Custom Domains (Optional)
# Dev: Wildcard certificate (*.domain.com) shared across all PRs
# Prod: Apex domain certificate (domain.com)
#
# Only created if enable_custom_domain = true and domain variables are set

# ACM Certificate
resource "aws_acm_certificate" "main" {
  count = var.enable_custom_domain ? 1 : 0

  domain_name = local.acm_domain_name

  # For dev wildcard cert, also include the base domain
  subject_alternative_names = local.acm_san

  validation_method = "DNS"

  lifecycle {
    create_before_destroy = true
  }

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-certificate"
  })
}

# Route53 DNS Validation Records
resource "aws_route53_record" "cert_validation" {
  for_each = var.enable_custom_domain ? {
    for dvo in aws_acm_certificate.main[0].domain_validation_options : dvo.domain_name => {
      name   = dvo.resource_record_name
      record = dvo.resource_record_value
      type   = dvo.resource_record_type
    }
  } : {}

  allow_overwrite = true
  name            = each.value.name
  records         = [each.value.record]
  ttl             = 60
  type            = each.value.type
  zone_id         = local.hosted_zone_id
}

# Wait for Certificate Validation
resource "aws_acm_certificate_validation" "main" {
  count = var.enable_custom_domain ? 1 : 0

  certificate_arn         = aws_acm_certificate.main[0].arn
  validation_record_fqdns = [for record in aws_route53_record.cert_validation : record.fqdn]
}
