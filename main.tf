locals {

  # lambda runtime 
  lambda_runtime = "nodejs14.x"

  # this is will generate the list of function name based on files residing in the functions directory
  # this is also parse the name of the function and generate the function name
  functions = toset([
    for file in fileset("${path.module}/sources/src/functions", "*.function.ts") : lower(replace(split(".", split("/", file)[length(split("/", file)) - 1])[0], "[^a-zA-Z0-9]", "-"))
  ])

  # temporary path prefix to store the generated files
  temporary_build_prefix = "/tmp/${data.aws_caller_identity.current.id}/${data.aws_region.current.id}/${local.service_name}"

}

# create KMS key alias for the service
resource "aws_kms_alias" "key" {
  name          = "alias/${local.service_domain}/${local.service_name}"
  target_key_id = aws_kms_key.key.key_id
}

# create KMS key for the service
resource "aws_kms_key" "key" {
  description         = "${local.service_name}-key"
  key_usage           = "ENCRYPT_DECRYPT"
  enable_key_rotation = true
  tags                = local.default_tags
}

# create the source code archive which will triggered whenever there's file change in the source code directory
# this is to generate the hash of the source code directory
data "archive_file" "source-code" {
  type        = "zip"
  source_dir  = "${path.module}/sources/src"
  output_path = "${local.temporary_build_prefix}/source-code.zip"
}

# if the hash of the source code directory is different from the previous hash, 
# then we sould trigger the build process
resource "null_resource" "source-code-builder" {
  depends_on = [
    null_resource.models-builder,
  ]
  provisioner "local-exec" {
    working_dir = "${path.module}/sources"
    command     = "npm run build"
  }
  triggers = {
    source-code-md5 = data.archive_file.source-code.output_md5
    service_domain  = local.service_domain
    service_name    = local.service_name
  }
}

# if the hash of the dependencies file is different from the previous hash,
# then we sould trigger the build process
resource "null_resource" "dependencies-builder" {
  provisioner "local-exec" {
    working_dir = "${path.module}/sources"
    command     = <<EOT
      npm install
      rm -rf ${local.temporary_build_prefix}/layers
      mkdir -p ${local.temporary_build_prefix}/layers/nodejs
      cp -r node_modules ${local.temporary_build_prefix}/layers/nodejs
    EOT
  }
  triggers = {
    dependencies-md5 = filemd5("${path.module}/sources/package-lock.json")
    service_domain   = local.service_domain
    service_name     = local.service_name
  }
}

# create lambda layer archive file
data "archive_file" "layer" {
  type        = "zip"
  depends_on  = [null_resource.dependencies-builder]
  source_dir  = "${local.temporary_build_prefix}/layers"
  output_path = "${local.temporary_build_prefix}/layers-${filemd5("${path.module}/sources/package-lock.json")}.zip"
}

# create lambda layer name
module "naming-layer" {
  source        = "git@github.com:traveloka/terraform-aws-resource-naming.git?ref=v0.22.0"
  name_prefix   = "${local.service_name}-layer"
  resource_type = "lambda_function"
}

# provision lambda layer based on the layer archive file
resource "aws_lambda_layer_version" "layer" {
  filename            = data.archive_file.layer.output_path
  description         = "${local.service_name} ${local.service_environment} layer"
  layer_name          = module.naming-layer.name
  compatible_runtimes = [local.lambda_runtime]
}

# provision the lambda function
module "function" {

  depends_on = [
    null_resource.source-code-builder,
  ]

  source   = "git@github.com:traveloka/terraform-aws-lambda.git?ref=v2.0.2"
  for_each = local.functions

  lambda_descriptive_name = each.value
  product_domain          = local.service_domain
  service_name            = local.service_name
  environment             = local.service_environment

  lambda_code_directory_path    = "${path.module}/sources/dist"
  lambda_archive_directory_path = "${local.temporary_build_prefix}/functions-${each.value}-${data.archive_file.source-code.output_md5}.zip"
  lambda_layer_arns             = [aws_lambda_layer_version.layer.arn]
  lambda_runtime                = local.lambda_runtime
  lambda_handler                = "index.handler"
  lambda_memory_size            = try(local.lambda_custom_configuration[each.value].lambda_memory_size, "512")
  lambda_timeout                = try(local.lambda_custom_configuration[each.value].lambda_timeout, "60")
  log_retention_days            = "7"
  additional_tags               = local.default_tags

  lambda_environment_variables = {
    PARAMETER_STORE_PATH = "/${local.parameter_store_path}"
  }

  enable_enhanced_monitoring = "yes"
  enable_active_tracing      = "yes"

  is_local_archive = "true"
  is_lambda_vpc    = "false"

}

# provision the parameter store
resource "aws_ssm_parameter" "parameter" {
  for_each = toset(local.parameter_store_list)
  name     = "/${local.parameter_store_path}/${each.value}"
  type     = "SecureString"
  value    = "placeholder"
  tags     = local.default_tags
  // the following is to make sure the parameter store is not overwritten by the default value
  // if you want to change the default value, please change it in the web console or api console
  lifecycle {
    ignore_changes = [value]
  }
}

# provision the parameter store to store the service version
resource "aws_ssm_parameter" "version" {
  name  = "/${local.parameter_store_path}/service-version"
  type  = "String"
  value = local.service_version
  tags  = local.default_tags
}

# provision the dynamodb table
module "naming-dynamodb-table" {
  for_each      = { for table in local.dynamodb_table_list : table.name => table }
  source        = "git@github.com:traveloka/terraform-aws-resource-naming.git?ref=v0.22.0"
  name_prefix   = "${local.service_name}-${each.value.name}"
  resource_type = "dynamodb_table"
}

resource "aws_dynamodb_table" "table" {
  for_each     = { for table in local.dynamodb_table_list : table.name => table }
  name         = module.naming-dynamodb-table[each.value.name].name
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = each.value.key
  range_key    = try(each.value.range_key, "") != "" ? each.value.range_key : ""
  tags         = local.default_tags

  point_in_time_recovery {
    enabled = true
  }

  server_side_encryption {
    enabled     = true
    kms_key_arn = aws_kms_key.key.arn
  }

  attribute {
    name = each.value.key
    type = "S"
  }

  dynamic "attribute" {
    for_each = toset(try(each.value.range_key, "") != "" ? [each.value.range_key] : [])
    content {
      name = each.value.range_key
      type = "S"
    }
  }

}

resource "null_resource" "models-builder" {
  for_each = { for table in local.dynamodb_table_list : table.name => table }
  provisioner "local-exec" {
    working_dir = "${path.module}/sources"
    command     = <<EOT
      mkdir -p ${path.module}/src/models
      if [ ! -f ${path.module}/src/models/${each.value.name}.model.ts ]; then
        echo "import { Model } from './model';" > ${path.module}/src/models/${each.value.name}.model.ts
        echo "" >> ${path.module}/src/models/${each.value.name}.model.ts
        echo "export class ${join("", [for name_component in split("-", each.value.name) : "${upper(substr(name_component, 0, 1))}${substr(name_component, 1, length(name_component))}"])}Model extends Model {" >> ${path.module}/src/models/${each.value.name}.model.ts
        echo "  public ${each.value.key}: string;" >> ${path.module}/src/models/${each.value.name}.model.ts
        echo "  // insert your model properties here" >> ${path.module}/src/models/${each.value.name}.model.ts
        echo "  // e.g. public name: string;" >> ${path.module}/src/models/${each.value.name}.model.ts
        echo "}" >> ${path.module}/src/models/${each.value.name}.model.ts
      fi
    EOT
  }
  triggers = {
    timestamp = timestamp()
  }
}

resource "aws_ssm_parameter" "dynamodb-parameter" {
  for_each = { for table in local.dynamodb_table_list : table.name => table }
  name     = "/${local.parameter_store_path}/dynamodb-table-${each.value.name}"
  type     = "SecureString"
  value    = module.naming-dynamodb-table[each.value.name].name
  tags     = local.default_tags
}

# update lambda function policy
data "aws_iam_policy_document" "function-policy" {

  statement {
    sid = "AllowParameterStoreRead"
    actions = [
      "ssm:GetParametersByPath",
    ]
    effect = "Allow"
    resources = [
      "arn:aws:ssm:${data.aws_region.current.id}:${data.aws_caller_identity.current.id}:parameter/${local.parameter_store_path}/*",
    ]
  }

  statement {
    sid = "AllowDynamoDBAccess"
    actions = [
      "dynamodb:Get*",
      "dynamodb:Put*",
      "dynamodb:Query",
      "dynamodb:Scan",
      "dynamodb:BatchWriteItem",
      "dynamodb:DescribeTable"
    ]
    effect    = "Allow"
    resources = [for table in local.dynamodb_table_list : "arn:aws:dynamodb:${data.aws_region.current.id}:${data.aws_caller_identity.current.account_id}:table/${module.naming-dynamodb-table[table.name].name}"]
  }

  statement {
    sid = "AllowKMSAccess"
    actions = [
      "kms:Decrypt*",
      "kms:Encrypt*",
    ]
    effect = "Allow"
    resources = [
      aws_kms_key.key.arn,
    ]
  }

}

# provision the permission for the lambda function
resource "aws_iam_role_policy" "function-policy" {
  for_each = module.function
  name     = "function-policy"
  role     = each.value.role_name
  policy   = data.aws_iam_policy_document.function-policy.json
}

# provision the scheduled event for the lambda function
resource "aws_cloudwatch_event_rule" "scheduler" {
  for_each = {
    for name, configuration in local.lambda_custom_configuration : name => configuration
    if configuration.schedule_expression != ""
  }
  description         = "Lambda trigger scheduler for ${each.key}"
  event_bus_name      = "default"
  is_enabled          = true
  name                = "scheduler-${each.key}"
  schedule_expression = each.value.schedule_expression
  tags                = local.default_tags
}

resource "aws_cloudwatch_event_target" "scheduler" {
  for_each       = aws_cloudwatch_event_rule.scheduler
  arn            = module.function[each.key].lambda_arn
  event_bus_name = "default"
  rule           = aws_cloudwatch_event_rule.scheduler[each.key].name
  target_id      = "scheduler-${each.key}"
}

resource "aws_lambda_permission" "scheduler" {
  depends_on    = [module.function]
  for_each      = aws_cloudwatch_event_rule.scheduler
  statement_id  = "AllowSchedulerInvoke"
  action        = "lambda:InvokeFunction"
  function_name = module.function[each.key].lambda_name
  principal     = "events.amazonaws.com"
  source_arn    = aws_cloudwatch_event_rule.scheduler[each.key].arn
}
