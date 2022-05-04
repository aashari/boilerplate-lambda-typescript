locals {

  # lambda runtime 
  lambda_runtime = "nodejs14.x"

  # this is will generate the list of function name based on files residing in the functions directory
  # this is also parse the name of the function and generate the function name
  functions = toset([
    for file in fileset("${path.module}/sources/src/functions", "*.function.ts") : lower(replace(split(".", split("/", file)[length(split("/", file)) - 1])[0], "[^a-zA-Z0-9]", "-"))
  ])

  # temporary path prefix to store the generated files
  temporary_build_prefix = "/tmp/${data.aws_caller_identity.current.id}/${data.aws_region.current.id}/${var.service_name}"

  # define the default tags for the resources
  default_tags = merge({
    "Name" : "${var.service_domain}-${var.service_name}-${var.service_environment}",
    "Environment" : "${var.service_environment}",
    "Service" : "${var.service_name}",
    "ServiceName" : "${var.service_name}",
    "ServiceDomain" : "${var.service_domain}",
    "ServiceVersion" : "${var.service_version}",
  }, var.default_tags)

  # define resources prefix name
  resource_prefix_name = substr(var.service_name, 0, length(var.service_domain)) == var.service_domain ? "${var.service_name}-${var.service_environment}" : "${var.service_domain}-${var.service_name}-${var.service_environment}"

}

# naming section to standardize the naming of the resources
# naming for Lambda Layer
module "lambda-layer-name" {
  source        = "git@github.com:traveloka/terraform-aws-resource-naming.git?ref=v0.22.0"
  name_prefix   = "${local.resource_prefix_name}-layer"
  resource_type = "lambda_function"
}

# naming for Lambda Function
module "lambda-function-name" {
  for_each      = local.functions
  source        = "git@github.com:traveloka/terraform-aws-resource-naming.git?ref=v0.22.0"
  name_prefix   = "${local.resource_prefix_name}-${each.value}"
  resource_type = "lambda_function"
}

# naming for DynamoDB Table
module "dynamodb-table-name" {
  for_each      = { for table in var.dynamodb_table_list : table.name => table }
  source        = "git@github.com:traveloka/terraform-aws-resource-naming.git?ref=v0.22.0"
  name_prefix   = "${local.resource_prefix_name}-${each.value.name}"
  resource_type = "dynamodb_table"
}

# build a TypeScript model based on DynamoDB table list
# this will generate a TypeScript model for each DynamoDB table 
# and store it in the sources/src/models directory with format of <table_name>.module.ts
# the TypeScript model will only be generated if the model file does not exist
resource "null_resource" "typescript-source-model-builder" {
  for_each   = { for table in var.dynamodb_table_list : table.name => table }
  depends_on = [null_resource.lambda-layer-source-builder]
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

# build the dist directory using npm run build
# this will generate the Javascript from Typescript source code using TypeScript compiler
# this builder will only run when:
# - there's a change in the source code directory
# - there's a change in service domain value
# - there's a change in service name value
# - there's no existing dist directory
resource "null_resource" "lambda-function-source-builder" {
  depends_on = [null_resource.typescript-source-model-builder]
  provisioner "local-exec" {
    working_dir = "${path.module}/sources"
    command     = "npm run build"
  }
  triggers = {
    lambda-function-md5 = data.archive_file.typescript-source.output_md5
    service_domain      = var.service_domain
    service_name        = var.service_name
    file_dist           = fileexists("${path.module}/sources/dist/index.js") ? "${path.module}/sources/dist/index.js" : timestamp()
  }
}

# build the dependencies directory using npm install
# this will generate the dependencies file from the package.json file
# this will be used as Lambda Layer archive file
# this builder will only run when:
# - there's a change in package.json file
# - there's a change in package-lock.json file
# - there's a change in service domain value
# - there's a change in service name value
# - there's no existing dependencies directory
resource "null_resource" "lambda-layer-source-builder" {
  provisioner "local-exec" {
    working_dir = "${path.module}/sources"
    command     = <<EOT
      npm install
      rm -rf ${local.temporary_build_prefix}/lambda-layer-source
      mkdir -p ${local.temporary_build_prefix}/lambda-layer-source/nodejs
      cp -r node_modules ${local.temporary_build_prefix}/lambda-layer-source/nodejs
    EOT
  }
  triggers = {
    dependencies-file-md5 = filemd5("${path.module}/sources/package.json")
    dependencies-lock-md5 = filemd5("${path.module}/sources/package-lock.json")
    service_domain        = var.service_domain
    service_name          = var.service_name
    file_node_modules     = fileexists("${path.module}/sources/node_modules/package-lock.json") ? "${path.module}/sources/node_modules/package-lock.json" : timestamp()
  }
}

# create kms key for the service
# this kms key will be used as a service encryption key
resource "aws_kms_key" "service-key" {
  description         = "${var.service_domain}-${var.service_name}-${var.service_environment}-key"
  key_usage           = "ENCRYPT_DECRYPT"
  enable_key_rotation = true
  tags                = local.default_tags
}

# create alias for kms key
resource "aws_kms_alias" "service-alias" {
  name          = "alias/service/${var.service_domain}/${var.service_name}/${var.service_environment}"
  target_key_id = aws_kms_key.service-key.key_id
}

# create Lambda Layer for the service
resource "aws_lambda_layer_version" "lambda-layer" {
  filename            = data.archive_file.lambda-layer-source.output_path
  description         = "${var.service_name} ${var.service_environment} layer"
  layer_name          = module.lambda-layer-name.name
  compatible_runtimes = [local.lambda_runtime]
}

# create CloudWatch Log Group for Lambda Function
resource "aws_cloudwatch_log_group" "lambda-function-log-group" {
  for_each          = local.functions
  name              = "/aws/lambda/${module.lambda-function-name[each.value].name}"
  retention_in_days = 7
  tags              = local.default_tags
}

# create IAM Role for Lambda Function
resource "aws_iam_role" "lambda-function-role" {
  for_each = local.functions
  name     = substr("ServiceRoleForLambda-${module.lambda-function-name[each.value].name}", 0, 64)
  tags     = local.default_tags
  assume_role_policy = jsonencode({
    "Version" : "2012-10-17",
    "Statement" : [{
      "Action" : "sts:AssumeRole",
      "Principal" : {
        "Service" : "lambda.amazonaws.com"
      },
      "Effect" : "Allow",
    }]
  })
}

resource "aws_lambda_function" "lambda-function" {

  for_each      = local.functions
  filename      = data.archive_file.lambda-function-source.output_path
  function_name = module.lambda-function-name[each.value].name

  handler     = "index.handler"
  runtime     = local.lambda_runtime
  role        = aws_iam_role.lambda-function-role[each.value].arn
  timeout     = try(var.lambda_function_configuration[each.value].lambda_timeout, 60)
  memory_size = try(var.lambda_function_configuration[each.value].lambda_memory_size, 128)

  source_code_hash = data.archive_file.lambda-function-source.output_sha
  layers           = [aws_lambda_layer_version.lambda-layer.arn]
  tags             = local.default_tags

  environment {
    variables = {
      "SERVICE_DOMAIN"      = var.service_domain
      "SERVICE_NAME"        = var.service_name
      "SERVICE_ENVIRONMENT" = var.service_environment
      "FUNCTION_NAME"       = each.value
    }
  }

}

# create DynamoDB table for the service based on the var.dynamodb_table_list value 
resource "aws_dynamodb_table" "dynamodb-table" {

  for_each = { for table in var.dynamodb_table_list : table.name => table }

  name         = module.dynamodb-table-name[each.value.name].name
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = each.value.key
  range_key    = each.value.range_key != null ? each.value.range_key : null
  tags         = local.default_tags

  point_in_time_recovery {
    enabled = true
  }

  server_side_encryption {
    enabled     = true
    kms_key_arn = aws_kms_key.service-key.arn
  }

  attribute {
    name = each.value.key
    type = "S"
  }

  dynamic "attribute" {
    for_each = each.value.range_key != null ? [each.value.range_key] : []
    content {
      name = each.value.range_key
      type = "S"
    }
  }

}

# create SSM Parameter Store to store DynamoDB table name based on the var.dynamodb_table_list value
# this parameter will be used to load the environment variables to get the actual DynamoDB table name
# the environment variables will be create with this format DYNAMODB_TABLE_<table_name>
resource "aws_ssm_parameter" "ssm-parameter-dynamodb-table" {
  for_each = { for table in var.dynamodb_table_list : table.name => table }
  name     = "/service/${var.service_domain}/${var.service_name}/${var.service_environment}/dynamodb-table-${each.value.name}"
  key_id   = aws_kms_alias.service-alias.id
  type     = "SecureString"
  value    = module.dynamodb-table-name[each.value.name].name
  tags     = local.default_tags
}

# create SSM Parameter Store based on the var.ssm_parameter_list value
# this parameter will be used to load the environment variables to get the actual SSM parameter value
resource "aws_ssm_parameter" "ssm-parameter-custom" {
  for_each = toset(var.parameter_store_list)
  name     = "/service/${var.service_domain}/${var.service_name}/${var.service_environment}/${each.value}"
  key_id   = aws_kms_alias.service-alias.id
  type     = "SecureString"
  value    = "placeholder"
  tags     = local.default_tags
  lifecycle {
    ignore_changes = [value]
  }
}

# create SSM Parameter Store to store the service version
# this parameter will be used to load the environment variables to get the actual service version
# the environment variables will be create with this format SERVICE_VERSION
resource "aws_ssm_parameter" "ssm-parameter-service-version" {
  name   = "/service/${var.service_domain}/${var.service_name}/${var.service_environment}/service-version"
  key_id = aws_kms_alias.service-alias.id
  type   = "String"
  value  = var.service_version
  tags   = local.default_tags
}

# attach the Lambda Function policy to the Lambda Function Role
resource "aws_iam_role_policy" "function-policy" {
  for_each = aws_iam_role.lambda-function-role
  name     = "function-policy"
  role     = each.value.name
  policy   = data.aws_iam_policy_document.function-policy.json
}

# create the Cloudwatch Event Rule for the Lambda Function with schedule_expression attribute
resource "aws_cloudwatch_event_rule" "lambda-function-trigger-schedule" {
  for_each = {
    for name, configuration in var.lambda_function_configuration : name => configuration
    if configuration.schedule_expression != ""
  }
  description         = "Lambda Function trigger schedule for ${each.key}"
  event_bus_name      = "default"
  is_enabled          = true
  name                = each.key
  schedule_expression = each.value.schedule_expression
  tags                = local.default_tags
}

# set the Cloudwatch Event Rule target to the Lambda Function
resource "aws_cloudwatch_event_target" "lambda-function-trigger-schedule" {
  for_each       = aws_cloudwatch_event_rule.lambda-function-trigger-schedule
  arn            = aws_lambda_function.lambda-function[each.key].arn
  event_bus_name = "default"
  rule           = aws_cloudwatch_event_rule.lambda-function-trigger-schedule[each.key].name
  target_id      = "lambda-function-trigger-schedule-${each.key}"
}

# give the permission to the Cloudwatch Event Rule to invoke the Lambda Function
resource "aws_lambda_permission" "lambda-function-trigger-schedule" {
  depends_on    = [aws_lambda_function.lambda-function]
  for_each      = aws_cloudwatch_event_rule.lambda-function-trigger-schedule
  statement_id  = "AllowLambdaFunctionTriggerSchedule"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.lambda-function[each.key].function_name
  principal     = "events.amazonaws.com"
  source_arn    = aws_cloudwatch_event_rule.lambda-function-trigger-schedule[each.key].arn
}
