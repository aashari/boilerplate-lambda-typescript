locals {

  # service domain is the level 1 logical stacks grouping
  service_domain = "tsi"

  # service name is the level 2 logical stacks grouping, this will be used as the prefix for the stack name
  service_name = "tsiandi"

  # service environment is the environment of the service
  service_environment = "dev"

  # lambda runtime 
  lambda_runtime = "nodejs14.x"

  # parameter store prefix
  parameter_store_path = "tvlk-secret/${local.service_name}/${local.service_domain}"

  # generate parameter store which will be loaded into the lambda function environment
  parameter_store_list = [
    "dd-api-key", // this will be loaded into the lambda function environment as DD_API_KEY
    "dd-app-key", // this will be loaded into the lambda function environment as DD_APP_KEY
  ]

  # this is will generate the list of function name based on files residing in the functions directory
  # this is also parse the name of the function and generate the function name
  functions = toset([
    for file in fileset(path.module, "${path.module}/sources/src/functions/*.function.ts") : lower(replace(split(".", split("/", file)[length(split("/", file)) - 1])[0], "[^a-zA-Z0-9]", "-"))
  ])

  # temporary path prefix to store the generated files
  temporary_build_prefix = "/tmp/${data.aws_caller_identity.current.id}/${data.aws_region.current.id}/${local.service_name}"

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
  provisioner "local-exec" {
    working_dir = "${path.module}/sources"
    command     = "npm run build"
  }
  triggers = {
    "source-code-md5" = data.archive_file.source-code.output_md5
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
    "dependencies-md5" = filemd5("${path.module}/sources/package-lock.json")
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
module "functions" {

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
  lambda_memory_size            = "512"
  lambda_timeout                = "60"
  lambda_environment_variables = {
    PARAMETER_STORE_PATH = "/${local.parameter_store_path}"
  }

  enable_enhanced_monitoring = "yes"
  enable_active_tracing      = "yes"

  is_local_archive = "true"
  is_lambda_vpc    = "false"

  log_retention_days = "7"

}

# provision the parameter store
resource "aws_ssm_parameter" "parameters" {
  for_each = toset(local.parameter_store_list)
  name     = "/${local.parameter_store_path}/${each.value}"
  type     = "SecureString"
  value    = "placeholder"
  // the following is to make sure the parameter store is not overwritten by the default value
  // if you want to change the default value, please change it in the web console or api console
  lifecycle {
    ignore_changes = [value]
  }
}

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
}

# provision the permission for the lambda function
resource "aws_iam_role_policy" "functions-policy" {
  for_each = module.functions
  name     = "function-policy"
  role     = each.value.role_name
  policy   = data.aws_iam_policy_document.function-policy.json
}
