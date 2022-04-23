locals {

  # service version (e.g. v1.0.0)
  service_version = "v1.0.0"

  # service domain is the level 1 logical stacks grouping
  service_domain = "flight"

  # service name is the level 2 logical stacks grouping, this will be used as the prefix for the stack name
  service_name = "booking"

  # service environment is the environment of the service
  service_environment = "dev"

  # parameter store prefix
  parameter_store_path = "tvlk-secret/${local.service_name}/${local.service_domain}"

  # following configuration is an optional configuration
  # generate parameter store which will be loaded into the lambda function environment
  parameter_store_list = [
    "dd-api-key", // this will be loaded into the lambda function environment as DD_API_KEY
    "dd-app-key", // this will be loaded into the lambda function environment as DD_APP_KEY
  ]

  # following configuration is an optional configuration
  # this will create a dynamodb table and parameter store to store the table name
  # the parameterstore will be loaded into the lambda function environment as DYNAMO_DB_TABLE_${each.name}
  dynamodb_table_list = [
    {
      name : "booking",
      key : "id",
    },
    {
      name : "flight",
      key : "id",
    }
  ]

  # following configuration is an optional configuration
  # leave this as empty object if you don't want to use lambda custom configuration
  lambda_custom_configuration = {
    booking-create : {
      lambda_memory_size : "128",
      lambda_timeout : "60"
    }
  }

}
