# DNS Migration & Cutover Plan

## Overview
This document outlines the plan to migrate Passion from Lovable/Supabase to AWS infrastructure.

## Current State
- **Frontend**: Lovable (hosted static site)
- **Backend**: Supabase (PostgreSQL + Auth + Edge Functions)
- **Domain**: (to be determined based on current DNS setup)

## Target State
- **Frontend**: AWS CloudFront + S3
- **Backend**: AWS Lambda + API Gateway + RDS PostgreSQL
- **Auth**: Custom JWT-based auth (Lambda)
- **DNS**: Route53 managing all records

---

## Pre-Cutover Checklist

### Infrastructure Ready
- [ ] Terraform `shared` module applied (VPC, RDS, ACM certificate)
- [ ] Terraform `service` module applied (Lambda, API Gateway, CloudFront, S3)
- [ ] Database schema migrated (`lambda/src/migration.sql`)
- [ ] Environment variables configured in Lambda
- [ ] Custom domain enabled in terraform (`custom_domain_enabled = true`)

### Testing Complete
- [ ] E2E tests passing against staging environment
- [ ] Manual testing of all user flows
- [ ] Performance testing completed
- [ ] Security audit reviewed

### Data Migration Prepared
- [ ] Supabase data export script ready
- [ ] Data transformation scripts tested
- [ ] Rollback procedure documented

---

## Cutover Steps

### Phase 1: Preparation (Day Before)
1. **Notify users** of planned maintenance window (if applicable)
2. **Export current data** from Supabase
3. **Verify AWS infrastructure** is deployed and healthy
4. **Run smoke tests** against AWS endpoints

### Phase 2: Data Migration (During Maintenance Window)
1. **Put Lovable site in maintenance mode** (if possible)
2. **Export final data** from Supabase:
   ```bash
   # Export users
   supabase db dump --data-only -f users_export.sql

   # Or use pg_dump for specific tables
   pg_dump -h <supabase-host> -U postgres -t users -t profiles -t rooms -t messages -t traits --data-only > data_export.sql
   ```

3. **Transform data** for new schema (if needed)

4. **Import to RDS**:
   ```bash
   psql -h <rds-endpoint> -U <username> -d <database> -f data_export.sql
   ```

5. **Verify data integrity**:
   - Count records in each table
   - Spot check user records
   - Verify password hashes migrated correctly

### Phase 3: DNS Cutover
1. **Update Route53 records** (or trigger terraform apply):
   ```bash
   cd terraform/service
   terraform apply -var="custom_domain_enabled=true"
   ```

2. **DNS Record Changes** (automated by terraform):
   - `passion.yourdomain.com` → CloudFront distribution
   - `api.passion.yourdomain.com` → API Gateway

3. **TTL Consideration**:
   - If current DNS TTL is high, consider lowering it 24h before cutover
   - Recommended TTL: 300 seconds (5 minutes) during migration

### Phase 4: Verification
1. **Verify DNS propagation**:
   ```bash
   dig passion.yourdomain.com
   dig api.passion.yourdomain.com
   ```

2. **Test all endpoints**:
   - [ ] Landing page loads
   - [ ] Auth flow works
   - [ ] Interview flow works
   - [ ] Chat/rooms work

3. **Monitor CloudWatch**:
   - Lambda error rates
   - API Gateway 4xx/5xx responses
   - CloudFront cache hit ratio

---

## Rollback Procedure

### If Issues Detected Post-Cutover

1. **Quick Rollback (< 30 minutes)**:
   - Update DNS to point back to Lovable
   - Lovable should still be serving content if not decommissioned
   ```bash
   # In Route53 or your DNS provider
   # Change A/AAAA records back to Lovable's IP/CNAME
   ```

2. **Data Sync** (if users created data on AWS):
   - Export new data from RDS
   - Import into Supabase
   - Merge with existing data

### If Major Issues

1. **Re-enable Supabase auth**
2. **Point frontend to Supabase backend**
3. **Investigate AWS issues**
4. **Reschedule cutover**

---

## Post-Cutover Tasks

### Immediate (Same Day)
- [ ] Monitor error rates for 2+ hours
- [ ] Verify email notifications working (if applicable)
- [ ] Check CloudWatch alarms

### Within 24 Hours
- [ ] Review CloudWatch logs for errors
- [ ] Check user feedback channels
- [ ] Verify scheduled jobs working (if any)

### Within 1 Week
- [ ] **Decommission Lovable** frontend
- [ ] **Decommission Supabase** project (or keep as cold backup)
- [ ] Update documentation with new endpoints
- [ ] Team training on new infrastructure

---

## Resource Decommissioning

### Supabase Cleanup
1. **Export final backup** (keep for 30 days)
2. **Pause project** (reduces cost, keeps data)
3. **Delete project** after 30-day verification period

### Lovable Cleanup
1. **Remove custom domain** from Lovable project
2. **Archive project** or delete

---

## Emergency Contacts

| Role | Contact | Responsibility |
|------|---------|----------------|
| Infrastructure Lead | TBD | AWS issues, terraform |
| Database Admin | TBD | Data migration, RDS |
| Frontend Lead | TBD | CloudFront, S3 |
| On-Call | TBD | After-hours issues |

---

## Terraform Commands Reference

```bash
# Check planned changes
cd terraform/service
terraform plan -var-file=prod.tfvars

# Apply changes
terraform apply -var-file=prod.tfvars

# Check outputs
terraform output

# Emergency: destroy specific resource
terraform destroy -target=aws_route53_record.www
```

---

## Monitoring URLs

- CloudWatch Dashboard: (to be created)
- API Gateway: https://console.aws.amazon.com/apigateway
- Lambda: https://console.aws.amazon.com/lambda
- CloudFront: https://console.aws.amazon.com/cloudfront

---

Last Updated: 2026-01-12
