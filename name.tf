module "lambda-layer-name" {
  source        = "git@github.com:traveloka/terraform-aws-resource-naming.git?ref=v0.22.0"
  name_prefix   = "${local.service_domain}-${local.service_name}-${local.service_environment}-layer"
  resource_type = "lambda_function"
}

module "lambda-function-name" {
  for_each      = local.functions
  source        = "git@github.com:traveloka/terraform-aws-resource-naming.git?ref=v0.22.0"
  name_prefix   = "${local.service_domain}-${local.service_name}-${local.service_environment}-${each.value}"
  resource_type = "lambda_function"
}

module "dynamodb-table-name" {
  for_each      = { for table in local.dynamodb_table_list : table.name => table }
  source        = "git@github.com:traveloka/terraform-aws-resource-naming.git?ref=v0.22.0"
  name_prefix   = "${local.service_domain}-${local.service_name}-${local.service_environment}-${each.value.name}"
  resource_type = "dynamodb_table"
}
