# AWS Cost Analysis & Validation

## Overview
Cost analysis for Passion's AWS infrastructure, comparing to previous Lovable/Supabase setup.

---

## Previous Costs (Lovable/Supabase)

| Service | Monthly Cost | Notes |
|---------|-------------|-------|
| Lovable | Free - $20 | Depends on tier |
| Supabase Pro | $25+ | Database + Auth + Edge Functions |
| **Total** | **$25-45/month** | Base cost without scaling |

---

## AWS Infrastructure Costs

### Compute

#### Lambda (API Backend)
| Configuration | Cost |
|--------------|------|
| Memory | 256 MB |
| Architecture | ARM64 (Graviton2) |
| Free Tier | 1M requests, 400,000 GB-seconds/month |
| Beyond Free Tier | $0.20 per 1M requests + $0.0000166667/GB-second |

**Estimated Monthly Cost**: $0-5/month (depends on traffic)
- Most small apps stay within free tier
- 100K requests/month with 200ms avg duration = ~$0.50

#### fck-nat Instance
| Configuration | Cost |
|--------------|------|
| Instance Type | t4g.nano (ARM) |
| Region | us-west-2 |
| On-Demand Price | ~$3.07/month |
| Spot Price | ~$1.50/month (when available) |

**Comparison**: AWS NAT Gateway = $32.40/month + data transfer
**Savings**: ~$29/month by using fck-nat

### Database

#### RDS PostgreSQL
| Configuration | Cost |
|--------------|------|
| Instance Class | db.t4g.micro (ARM) |
| Engine | PostgreSQL 17 |
| Storage | 20 GB gp3 |
| Multi-AZ | Disabled (dev) |
| Backup Retention | 7 days |

**Monthly Cost Breakdown**:
- Instance: ~$12.41/month (on-demand)
- Storage: ~$2.30/month (20GB gp3)
- **Total**: ~$14.71/month

### Storage & CDN

#### S3 (Frontend Assets)
| Configuration | Cost |
|--------------|------|
| Storage Class | Standard |
| Expected Size | < 100 MB |
| Requests | Pay per request |

**Estimated Monthly Cost**: < $1/month

#### CloudFront (CDN)
| Configuration | Cost |
|--------------|------|
| Free Tier | 1 TB data transfer/month |
| Price Origin Shield | Disabled |
| HTTP/HTTPS | Standard pricing |

**Estimated Monthly Cost**: $0-5/month (within free tier for low traffic)

### Networking

#### API Gateway
| Configuration | Cost |
|--------------|------|
| Type | HTTP API |
| Free Tier | 1M requests/month (12 months) |
| Price After | $1.00 per million requests |

**Estimated Monthly Cost**: $0-2/month

### Secrets & Monitoring

#### Secrets Manager
- $0.40 per secret per month
- 2-3 secrets expected
- **Cost**: ~$1.20/month

#### CloudWatch
- Basic metrics: Free
- Custom metrics: $0.30 each
- Log storage: $0.50/GB
- **Estimated Cost**: $2-5/month

### Optional: Custom Domain

#### Route53
- $0.50/month per hosted zone
- $0.40 per million queries (first 1B queries)
- **Cost**: ~$0.50/month

#### ACM Certificate
- **Free** (for AWS services)

---

## Cost Summary

### Minimum Monthly Cost (Low Traffic)
| Service | Cost |
|---------|------|
| Lambda | $0 (free tier) |
| fck-nat | $3.07 |
| RDS | $14.71 |
| S3 | $0.50 |
| CloudFront | $0 (free tier) |
| API Gateway | $0 (free tier) |
| Secrets Manager | $1.20 |
| CloudWatch | $2.00 |
| Route53 | $0.50 |
| **Total** | **~$22/month** |

### Moderate Traffic (~10K MAU)
| Service | Cost |
|---------|------|
| Lambda | $2.00 |
| fck-nat | $3.07 |
| RDS | $14.71 |
| S3 | $1.00 |
| CloudFront | $5.00 |
| API Gateway | $1.00 |
| Secrets Manager | $1.20 |
| CloudWatch | $5.00 |
| Route53 | $0.50 |
| **Total** | **~$33/month** |

---

## Cost Comparison

| Scenario | Lovable/Supabase | AWS |
|----------|-----------------|-----|
| Low Traffic | $25-45 | ~$22 |
| Moderate Traffic | $50-100+ | ~$33 |
| High Traffic | $100-200+ | ~$50-100 |

### Key Savings

1. **NAT Gateway → fck-nat**: ~$29/month saved
2. **Serverless compute**: Pay only for actual usage
3. **No auth service fees**: Custom auth in Lambda
4. **Free CDN tier**: 1TB/month free from CloudFront

---

## Cost Optimization Recommendations

### Implemented
- [x] fck-nat instead of NAT Gateway
- [x] ARM64 (Graviton2) for Lambda and RDS
- [x] db.t4g.micro for RDS (smallest ARM instance)
- [x] HTTP API Gateway (cheaper than REST API)

### Consider for Future
- [ ] Reserved Instances for RDS (1-year = ~30% savings)
- [ ] Spot instances for fck-nat (when available)
- [ ] S3 Intelligent-Tiering for larger datasets
- [ ] CloudWatch Logs retention policy (7 days vs forever)

---

## Budget Alerts

Configured in terraform/shared:
- **Budget Limit**: $100/month (configurable)
- **Alert Thresholds**: 50%, 80%, 100%
- **Circuit Breaker**: Stops non-essential services at 200%

---

## Monitoring Cost

Check AWS Cost Explorer:
```
https://console.aws.amazon.com/cost-management/home#/cost-explorer
```

Filter by:
- Tag: Project = Passion
- Tag: Environment = dev/prod

---

Last Updated: 2026-01-12
