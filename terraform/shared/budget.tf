# AWS Budget - Monthly spending limit per account
# Alerts at 50%, 80%, 100%, 120%, and 200% of budget
# Circuit breaker at 200%: SNS triggers Lambda to disable all passion-* functions

resource "aws_budgets_budget" "monthly_cost" {
  count = length(var.budget_alert_emails) > 0 ? 1 : 0

  name         = "${local.name_prefix}-monthly-budget"
  budget_type  = "COST"
  limit_amount = var.monthly_budget_limit
  limit_unit   = "USD"
  time_unit    = "MONTHLY"

  # Notification at 50% - early warning
  notification {
    comparison_operator        = "GREATER_THAN"
    threshold                  = 50
    threshold_type             = "PERCENTAGE"
    notification_type          = "ACTUAL"
    subscriber_email_addresses = var.budget_alert_emails
  }

  # Notification at 80% - approaching limit
  notification {
    comparison_operator        = "GREATER_THAN"
    threshold                  = 80
    threshold_type             = "PERCENTAGE"
    notification_type          = "ACTUAL"
    subscriber_email_addresses = var.budget_alert_emails
  }

  # Notification at 100% - budget exceeded
  notification {
    comparison_operator        = "GREATER_THAN"
    threshold                  = 100
    threshold_type             = "PERCENTAGE"
    notification_type          = "ACTUAL"
    subscriber_email_addresses = var.budget_alert_emails
  }

  # Notification at 120% - significant overspend
  notification {
    comparison_operator        = "GREATER_THAN"
    threshold                  = 120
    threshold_type             = "PERCENTAGE"
    notification_type          = "ACTUAL"
    subscriber_email_addresses = var.budget_alert_emails
  }

  # Notification at circuit breaker threshold (200%) - critical
  # Publishes to SNS to trigger Lambda circuit breaker
  notification {
    comparison_operator        = "GREATER_THAN"
    threshold                  = var.circuit_breaker_threshold
    threshold_type             = "PERCENTAGE"
    notification_type          = "ACTUAL"
    subscriber_email_addresses = var.budget_alert_emails
    subscriber_sns_topic_arns  = [aws_sns_topic.budget_circuit_breaker[0].arn]
  }

  # Forecasted notification at 100% - predicted to exceed
  notification {
    comparison_operator        = "GREATER_THAN"
    threshold                  = 100
    threshold_type             = "PERCENTAGE"
    notification_type          = "FORECASTED"
    subscriber_email_addresses = var.budget_alert_emails
  }

  tags = local.common_tags
}

# =============================================================================
# Circuit Breaker: SNS-triggered Lambda that disables all passion-* functions
#
# When budget reaches 200%, SNS triggers a Lambda that:
# 1. Lists all Lambda functions matching "passion-*" prefix
# 2. Sets reserved concurrent executions to 0 (disables invocation)
#
# This works for both prod and dev PR environments regardless of role names.
#
# Recovery (manual):
#   aws lambda delete-function-concurrency --function-name FUNCTION_NAME
# =============================================================================

# SNS Topic for budget circuit breaker alerts
resource "aws_sns_topic" "budget_circuit_breaker" {
  count = length(var.budget_alert_emails) > 0 ? 1 : 0

  name = "${local.name_prefix}-budget-circuit-breaker"
  tags = local.common_tags
}

# SNS Topic Policy - allow AWS Budgets to publish
resource "aws_sns_topic_policy" "budget_circuit_breaker" {
  count = length(var.budget_alert_emails) > 0 ? 1 : 0

  arn = aws_sns_topic.budget_circuit_breaker[0].arn

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "AllowBudgetsPublish"
        Effect = "Allow"
        Principal = {
          Service = "budgets.amazonaws.com"
        }
        Action   = "sns:Publish"
        Resource = aws_sns_topic.budget_circuit_breaker[0].arn
        Condition = {
          StringEquals = {
            "aws:SourceAccount" = data.aws_caller_identity.current.account_id
          }
        }
      }
    ]
  })
}

# IAM Role for Circuit Breaker Lambda
resource "aws_iam_role" "circuit_breaker_lambda" {
  count = length(var.budget_alert_emails) > 0 ? 1 : 0

  name = "${local.name_prefix}-circuit-breaker-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Principal = {
          Service = "lambda.amazonaws.com"
        }
        Action = "sts:AssumeRole"
      }
    ]
  })

  tags = local.common_tags
}

# Lambda basic execution (CloudWatch Logs)
resource "aws_iam_role_policy_attachment" "circuit_breaker_basic" {
  count = length(var.budget_alert_emails) > 0 ? 1 : 0

  role       = aws_iam_role.circuit_breaker_lambda[0].name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

# Policy for circuit breaker Lambda to stop all passion-* resources
resource "aws_iam_role_policy" "circuit_breaker_lambda" {
  count = length(var.budget_alert_emails) > 0 ? 1 : 0

  name = "circuit-breaker-permissions"
  role = aws_iam_role.circuit_breaker_lambda[0].id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "ListLambdaFunctions"
        Effect = "Allow"
        Action = [
          "lambda:ListFunctions"
        ]
        Resource = "*"
      },
      {
        Sid    = "ThrottlePassionLambdas"
        Effect = "Allow"
        Action = [
          "lambda:PutFunctionConcurrency",
          "lambda:DeleteFunctionConcurrency"
        ]
        Resource = "arn:aws:lambda:${var.aws_region}:${data.aws_caller_identity.current.account_id}:function:passion-*"
      },
      {
        Sid    = "ListRDSInstances"
        Effect = "Allow"
        Action = [
          "rds:DescribeDBInstances"
        ]
        Resource = "*"
      },
      {
        Sid    = "StopPassionRDS"
        Effect = "Allow"
        Action = [
          "rds:StopDBInstance"
        ]
        Resource = "arn:aws:rds:${var.aws_region}:${data.aws_caller_identity.current.account_id}:db:passion-*"
      },
      {
        Sid    = "ListEC2Instances"
        Effect = "Allow"
        Action = [
          "ec2:DescribeInstances"
        ]
        Resource = "*"
      },
      {
        Sid    = "StopPassionNATInstances"
        Effect = "Allow"
        Action = [
          "ec2:StopInstances"
        ]
        # Condition restricts to instances tagged with passion-*
        Resource = "arn:aws:ec2:${var.aws_region}:${data.aws_caller_identity.current.account_id}:instance/*"
        Condition = {
          StringLike = {
            "ec2:ResourceTag/Name" = "passion-*"
          }
        }
      }
    ]
  })
}

# CloudWatch Log Group for circuit breaker Lambda
resource "aws_cloudwatch_log_group" "circuit_breaker_lambda" {
  count = length(var.budget_alert_emails) > 0 ? 1 : 0

  name              = "/aws/lambda/${local.name_prefix}-circuit-breaker"
  retention_in_days = 30

  tags = local.common_tags
}

# Circuit Breaker Lambda function (Go)
# Note: The ZIP file is built by CI before terraform apply (see shared-infra.yml)
resource "aws_lambda_function" "circuit_breaker" {
  count = length(var.budget_alert_emails) > 0 ? 1 : 0

  filename         = "${path.module}/lambda/circuit_breaker.zip"
  source_code_hash = fileexists("${path.module}/lambda/circuit_breaker.zip") ? filebase64sha256("${path.module}/lambda/circuit_breaker.zip") : null
  function_name    = "${local.name_prefix}-circuit-breaker"
  role             = aws_iam_role.circuit_breaker_lambda[0].arn
  handler          = "bootstrap"
  runtime          = "provided.al2023"
  timeout          = 60
  memory_size      = 128
  architectures    = ["arm64"]

  environment {
    variables = {
      FUNCTION_PREFIX = "passion-"
    }
  }

  depends_on = [
    aws_cloudwatch_log_group.circuit_breaker_lambda,
    aws_iam_role_policy_attachment.circuit_breaker_basic,
    aws_iam_role_policy.circuit_breaker_lambda
  ]

  tags = local.common_tags
}

# Allow SNS to invoke the circuit breaker Lambda
resource "aws_lambda_permission" "circuit_breaker_sns" {
  count = length(var.budget_alert_emails) > 0 ? 1 : 0

  statement_id  = "AllowSNSInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.circuit_breaker[0].function_name
  principal     = "sns.amazonaws.com"
  source_arn    = aws_sns_topic.budget_circuit_breaker[0].arn
}

# Subscribe Lambda to SNS topic
resource "aws_sns_topic_subscription" "circuit_breaker_lambda" {
  count = length(var.budget_alert_emails) > 0 ? 1 : 0

  topic_arn = aws_sns_topic.budget_circuit_breaker[0].arn
  protocol  = "lambda"
  endpoint  = aws_lambda_function.circuit_breaker[0].arn
}
