output "lambda-function-list" {
  value       = aws_lambda_function.lambda-function
  description = "List of Lambda Functions created"
}

output "dynamodb-table-list" {
  value       = aws_dynamodb_table.dynamodb-table
  description = "List of DynamoDB Tables created"
}

output "ssm-parameter-list" {
  value = merge(
    aws_ssm_parameter.ssm-parameter-dynamodb-table,
    aws_ssm_parameter.ssm-parameter-custom,
    aws_ssm_parameter.ssm-parameter-service-version
  )
  sensitive   = true
  description = "List of SSM Parameters created"
}

output "kms-key" {
  value       = aws_kms_key.service-key
  description = "KMS Key created"
}

output "kms-alias" {
  value       = aws_kms_alias.service-alias
  description = "KMS Alias created"
}

output "lambda-function-role" {
  value       = aws_iam_role.lambda-function-role
  description = "Lambda Function Role created"
}

output "lambda-layer" {
  value       = aws_lambda_layer_version.lambda-layer
  description = "Lambda Layer created"
}
