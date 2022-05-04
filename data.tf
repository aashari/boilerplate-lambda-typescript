# get current region of the aws account
data "aws_region" "current" {}

# get current caller identity of the aws account
data "aws_caller_identity" "current" {}

# create an archive of sources/src
data "archive_file" "typescript-source" {
  type        = "zip"
  source_dir  = "${path.module}/sources/src"
  output_path = "${local.temporary_build_prefix}/typescript-source.zip"
}

# create an archive of sources/dist
data "archive_file" "lambda-function-source" {
  type        = "zip"
  depends_on  = [null_resource.lambda-layer-source-builder]
  source_dir  = "${path.module}/sources/dist"
  output_path = "${local.temporary_build_prefix}/lambda-function-source.zip"
}

# create an archive of local.temporary_build_prefix/lambda-layer-source
data "archive_file" "lambda-layer-source" {
  type        = "zip"
  depends_on  = [null_resource.lambda-layer-source-builder]
  source_dir  = "${local.temporary_build_prefix}/lambda-layer-source"
  output_path = "${local.temporary_build_prefix}/lambda-layer-source-${filemd5("${path.module}/sources/package-lock.json")}.zip"
}

# create iam policy for the service lambda function
data "aws_iam_policy_document" "function-policy" {

  statement {
    sid    = "SSMParameterStoreAccess"
    effect = "Allow"
    actions = [
      "ssm:GetParametersByPath",
    ]
    resources = [
      "arn:aws:ssm:${data.aws_region.current.id}:${data.aws_caller_identity.current.id}:parameter/service/${var.service_domain}/${var.service_name}/${var.service_environment}/*",
    ]
  }

  statement {
    sid    = "DynamoDBTableAccess"
    effect = "Allow"
    actions = [
      "dynamodb:Get*",
      "dynamodb:Put*",
      "dynamodb:Query",
      "dynamodb:Scan",
      "dynamodb:BatchWriteItem",
      "dynamodb:DescribeTable"
    ]
    resources = [
      for table in var.dynamodb_table_list : "arn:aws:dynamodb:${data.aws_region.current.id}:${data.aws_caller_identity.current.account_id}:table/${module.dynamodb-table-name[table.name].name}"
    ]
  }

  statement {
    sid    = "KMSKeyAccess"
    effect = "Allow"
    actions = [
      "kms:Decrypt*",
      "kms:Encrypt*",
    ]
    resources = [
      aws_kms_key.service-key.arn,
      aws_kms_alias.service-alias.arn,
    ]
  }

  statement {
    sid    = "CloudWatchLogGroupAccess"
    effect = "Allow"
    actions = [
      "logs:CreateLogGroup",
      "logs:CreateLogStream",
      "logs:PutLogEvents"
    ]
    resources = [
      "arn:aws:logs:${data.aws_region.current.id}:${data.aws_caller_identity.current.account_id}:*",
      "arn:aws:logs:${data.aws_region.current.id}:${data.aws_caller_identity.current.account_id}:log-group:/aws/lambda/*:*",
    ]
  }

}
