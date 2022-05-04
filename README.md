# Boilerplate Lambda Typescript

## Overview

This is a boilerplate to help you initiate AWS Lambda project using Typescript, in this boilerplate there are `terraform code` to provision the stacks and the initial Typescript source code in the `sources` directory

### Features

- Terraform code to provision the AWS Lambda project
- Typescript source code in the `sources` directory
- Automatically load AWS Secrets Manager (parameter store) as environment variables
- Automatically load DynamoDB (table name) as environment variables
- Automatically create models for DynamoDB tables with the ability to read, write, delete, and scan
- Decorator example to log the execution time of the method
- Datadog example integration to stream the metrics of statistic decorator to Datadog
- Lambda layer to store the dependencies of the project
- Lambda scheduler to schedule the function invocation

### Project Structures

```
.
├── sources
│   ├── package-lock.json
│   ├── package.json
│   ├── src
│   │   ├── decorators
│   │   │   └── statistic.decorator.ts
│   │   ├── functions
│   │   │   ├── booking-create.function.ts
│   │   │   ├── booking-search.function.ts
│   │   │   └── flight-search.function.ts
│   │   ├── helpers
│   │   │   ├── chunk.helper.ts
│   │   │   └── parameter-store.helper.ts
│   │   ├── index.ts
│   │   ├── libraries
│   │   │   ├── datadog.library.ts
│   │   │   └── dynamodb.library.ts
│   │   └── models
│   │       ├── booking.model.ts
│   │       ├── flight.model.ts
│   │       ├── model.ts
│   │       └── transaction.model.ts
│   └── tsconfig.json
├── README.md
├── data.tf
├── main.tf
├── providers.tf
├── terraform.tfvars.example
└── variables.tf
```

While doing a `terraform apply` command, theese are the things that will be created:

- AWS Lambda Function, in the `main.tf` there's a logic on creating AWS Lambda function based on files with format `*.function.ts` under `sources/src/functions` directory, so the number of AWS Lambda function created is based on `*.function.ts` files
- AWS System Manager Parameter Store, in the `main.tf` there's a logic on creating AWS Parameter Store with prefix set on `parameter_store_path` under `variables.tf` based on:
  - **parameter_store_list** attributes under `variables.tf` file
  - **dynamodb_table_list** attributes under `variables.tf` file which will create a Parameter Store to store the table names of DynamoDB with format `dynamodb-table-{table_name}`
  - **service_version** attributes under `variables.tf` file which will create a Parameter Store to store the version of the service

Another context related to the Typescript source code:

- **sources/src/helpers** is the collection of functional helpers such as `populateEnvironmentVariables()` you can freely add another functional helpers under this directory
- **sources/src/libraries** is the collection of class helpers such as `DatadogLibrary` which contains all Datadog functionality such as `publishMetrics` and `publishEvents`, or another example `DynamoDBLibrary` which contains `putItem` and `getItem`
- **sources/src/decorators** is the collection of Typescript decorators, the initial example is `@statistic` decorator which have the functionality to log the execution duration for the method that uses the decorators, the example also include the additional process to stream the statistic metrics into Datadog
- **sources/src/index.ts** is a bootstraper file which contains default `exports.handlers` function, which is the default function that will be called by AWS Lambda Function, this file contains logic to create the `sources/src/functions/*.function.ts` instance and create object then call the `handler` method
- **sources/src/models** is the collection of Typescript models, the initial example is `Booking` which is the model for DynamoDB table `booking` which automatically created by terraform code

<!-- BEGIN_TF_DOCS -->
## Requirements

| Name | Version |
|------|---------|
| <a name="requirement_terraform"></a> [terraform](#requirement\_terraform) | ~> 1.1.9 |
| <a name="requirement_aws"></a> [aws](#requirement\_aws) | ~> 4.10.0 |

## Providers

| Name | Version |
|------|---------|
| <a name="provider_archive"></a> [archive](#provider\_archive) | 2.2.0 |
| <a name="provider_aws"></a> [aws](#provider\_aws) | 4.10.0 |
| <a name="provider_null"></a> [null](#provider\_null) | 3.1.1 |

## Modules

| Name | Source | Version |
|------|--------|---------|
| <a name="module_dynamodb-table-name"></a> [dynamodb-table-name](#module\_dynamodb-table-name) | git@github.com:traveloka/terraform-aws-resource-naming.git | v0.22.0 |
| <a name="module_lambda-function-name"></a> [lambda-function-name](#module\_lambda-function-name) | git@github.com:traveloka/terraform-aws-resource-naming.git | v0.22.0 |
| <a name="module_lambda-layer-name"></a> [lambda-layer-name](#module\_lambda-layer-name) | git@github.com:traveloka/terraform-aws-resource-naming.git | v0.22.0 |

## Resources

| Name | Type |
|------|------|
| [aws_cloudwatch_event_rule.lambda-function-trigger-schedule](https://registry.terraform.io/providers/hashicorp/aws/latest/docs/resources/cloudwatch_event_rule) | resource |
| [aws_cloudwatch_event_target.lambda-function-trigger-schedule](https://registry.terraform.io/providers/hashicorp/aws/latest/docs/resources/cloudwatch_event_target) | resource |
| [aws_cloudwatch_log_group.lambda-function-log-group](https://registry.terraform.io/providers/hashicorp/aws/latest/docs/resources/cloudwatch_log_group) | resource |
| [aws_dynamodb_table.dynamodb-table](https://registry.terraform.io/providers/hashicorp/aws/latest/docs/resources/dynamodb_table) | resource |
| [aws_iam_role.lambda-function-role](https://registry.terraform.io/providers/hashicorp/aws/latest/docs/resources/iam_role) | resource |
| [aws_iam_role_policy.function-policy](https://registry.terraform.io/providers/hashicorp/aws/latest/docs/resources/iam_role_policy) | resource |
| [aws_kms_alias.service-alias](https://registry.terraform.io/providers/hashicorp/aws/latest/docs/resources/kms_alias) | resource |
| [aws_kms_key.service-key](https://registry.terraform.io/providers/hashicorp/aws/latest/docs/resources/kms_key) | resource |
| [aws_lambda_function.lambda-function](https://registry.terraform.io/providers/hashicorp/aws/latest/docs/resources/lambda_function) | resource |
| [aws_lambda_layer_version.lambda-layer](https://registry.terraform.io/providers/hashicorp/aws/latest/docs/resources/lambda_layer_version) | resource |
| [aws_lambda_permission.lambda-function-trigger-schedule](https://registry.terraform.io/providers/hashicorp/aws/latest/docs/resources/lambda_permission) | resource |
| [aws_ssm_parameter.ssm-parameter-custom](https://registry.terraform.io/providers/hashicorp/aws/latest/docs/resources/ssm_parameter) | resource |
| [aws_ssm_parameter.ssm-parameter-dynamodb-table](https://registry.terraform.io/providers/hashicorp/aws/latest/docs/resources/ssm_parameter) | resource |
| [aws_ssm_parameter.ssm-parameter-service-version](https://registry.terraform.io/providers/hashicorp/aws/latest/docs/resources/ssm_parameter) | resource |
| [null_resource.lambda-function-source-builder](https://registry.terraform.io/providers/hashicorp/null/latest/docs/resources/resource) | resource |
| [null_resource.lambda-layer-source-builder](https://registry.terraform.io/providers/hashicorp/null/latest/docs/resources/resource) | resource |
| [null_resource.typescript-source-model-builder](https://registry.terraform.io/providers/hashicorp/null/latest/docs/resources/resource) | resource |
| [archive_file.lambda-function-source](https://registry.terraform.io/providers/hashicorp/archive/latest/docs/data-sources/file) | data source |
| [archive_file.lambda-layer-source](https://registry.terraform.io/providers/hashicorp/archive/latest/docs/data-sources/file) | data source |
| [archive_file.typescript-source](https://registry.terraform.io/providers/hashicorp/archive/latest/docs/data-sources/file) | data source |
| [aws_caller_identity.current](https://registry.terraform.io/providers/hashicorp/aws/latest/docs/data-sources/caller_identity) | data source |
| [aws_iam_policy_document.function-policy](https://registry.terraform.io/providers/hashicorp/aws/latest/docs/data-sources/iam_policy_document) | data source |
| [aws_region.current](https://registry.terraform.io/providers/hashicorp/aws/latest/docs/data-sources/region) | data source |

## Inputs

| Name | Description | Type | Default | Required |
|------|-------------|------|---------|:--------:|
| <a name="input_default_tags"></a> [default\_tags](#input\_default\_tags) | The default tags for the service | `map(string)` | `{}` | no |
| <a name="input_dynamodb_table_list"></a> [dynamodb\_table\_list](#input\_dynamodb\_table\_list) | The list of dynamodb tables to be used for the service, e.g.<br>    <pre>[<br />&nbsp;&nbsp;{<br />&nbsp;&nbsp;&nbsp;&nbsp;"name": "booking",<br />&nbsp;&nbsp;&nbsp;&nbsp;"key": "id"<br />&nbsp;&nbsp;},<br />&nbsp;&nbsp;{<br />&nbsp;&nbsp;&nbsp;&nbsp;"name": "flight",<br />&nbsp;&nbsp;&nbsp;&nbsp;"key": "id"<br />&nbsp;&nbsp;},<br />&nbsp;&nbsp;{<br />&nbsp;&nbsp;&nbsp;&nbsp;"name": "transaction",<br />&nbsp;&nbsp;&nbsp;&nbsp;"key": "booking\_id",<br />&nbsp;&nbsp;&nbsp;&nbsp;"range\_key": "flight\_id"<br />&nbsp;&nbsp;}<br />]</pre> | <pre>list(object({<br>    name      = string,<br>    key       = string,<br>    range_key = optional(string),<br>  }))</pre> | `[]` | no |
| <a name="input_lambda_function_configuration"></a> [lambda\_function\_configuration](#input\_lambda\_function\_configuration) | The custom configuration for the Lambda Function, e.g.<br>    <pre>{<br />&nbsp;&nbsp;"booking-create": {<br />&nbsp;&nbsp;&nbsp;&nbsp;"lambda\_memory\_size": 1024,<br />&nbsp;&nbsp;&nbsp;&nbsp;"lambda\_timeout": 300<br />&nbsp;&nbsp;}<br />}</pre> | <pre>map(object({<br>    lambda_memory_size  = optional(number),<br>    lambda_timeout      = optional(number),<br>    schedule_expression = optional(string),<br>  }))</pre> | `{}` | no |
| <a name="input_parameter_store_list"></a> [parameter\_store\_list](#input\_parameter\_store\_list) | The list of parameter store keys to be used for the service, e.g. <br>    <pre>[<br />&nbsp;&nbsp;"datadog-api-key",<br />&nbsp;&nbsp;"datadog-app-key",<br />&nbsp;&nbsp;"sentry-dsn",<br />&nbsp;&nbsp;"sentry-environment"<br />]</pre> | `list(string)` | `[]` | no |
| <a name="input_service_domain"></a> [service\_domain](#input\_service\_domain) | The 1st level of logical grouping of the service, e.g. 'api', 'web', 'db', etc. | `string` | n/a | yes |
| <a name="input_service_environment"></a> [service\_environment](#input\_service\_environment) | The 3rd level of logical grouping of the service, e.g. 'dev', 'test', 'prod', etc. | `string` | n/a | yes |
| <a name="input_service_name"></a> [service\_name](#input\_service\_name) | The 2nd level of logical grouping of the service, e.g. 'my-api', 'my-web', 'my-db', etc. | `string` | n/a | yes |
| <a name="input_service_version"></a> [service\_version](#input\_service\_version) | The version of the service | `string` | `"v1.0.0"` | no |

## Outputs

| Name | Description |
|------|-------------|
| <a name="output_dynamodb-table-list"></a> [dynamodb-table-list](#output\_dynamodb-table-list) | List of DynamoDB Tables created |
| <a name="output_kms-alias"></a> [kms-alias](#output\_kms-alias) | KMS Alias created |
| <a name="output_kms-key"></a> [kms-key](#output\_kms-key) | KMS Key created |
| <a name="output_lambda-function-list"></a> [lambda-function-list](#output\_lambda-function-list) | List of Lambda Functions created |
| <a name="output_lambda-function-role"></a> [lambda-function-role](#output\_lambda-function-role) | Lambda Function Role created |
| <a name="output_lambda-layer"></a> [lambda-layer](#output\_lambda-layer) | Lambda Layer created |
| <a name="output_ssm-parameter-list"></a> [ssm-parameter-list](#output\_ssm-parameter-list) | List of SSM Parameters created |
<!-- END_TF_DOCS -->

## How to Setup
To setup the example you can follow the following steps:
* Copy the `terraform.tfvars.example` file to `terraform.tfvars`
* Run `terraform init`
* Run `terraform apply`
