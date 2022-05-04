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

## Configuration

There is file `variables.tf` contains the configuration for the project, here is the detailed configuration information:

| name                                 | description                                                 | is required | example                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| ------------------------------------ | ----------------------------------------------------------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| service_domain                       | The 1st level of logical grouping of the service            | yes         | api, web, db, etc.                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| service_name                         | The 2nd level of logical grouping of the service            | yes         | my-api, my-web, my-db, etc.                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| service_environment                  | The 3rd level of logical grouping of the service            | yes         | dev, test, prod, etc.                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| parameter_store_list                 | The list of parameter store keys to be used for the service | no          | <pre>[<br />&nbsp;&nbsp;"datadog-api-key",<br />&nbsp;&nbsp;"datadog-app-key",<br />&nbsp;&nbsp;"sentry-dsn",<br />&nbsp;&nbsp;"sentry-environment"<br />]</pre>                                                                                                                                                                                                                                                                                                                     |
| service_version                      | The version of the service                                  | no          | <pre>'v1.0.0'</pre>                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| dynamodb_table_list                  | The list of dynamodb tables to be used for the service      | no          | <pre>[<br />&nbsp;&nbsp;{<br />&nbsp;&nbsp;&nbsp;&nbsp;"name": "booking",<br />&nbsp;&nbsp;&nbsp;&nbsp;"key": "id"<br />&nbsp;&nbsp;},<br />&nbsp;&nbsp;{<br />&nbsp;&nbsp;&nbsp;&nbsp;"name": "flight",<br />&nbsp;&nbsp;&nbsp;&nbsp;"key": "id"<br />&nbsp;&nbsp;},<br />&nbsp;&nbsp;{<br />&nbsp;&nbsp;&nbsp;&nbsp;"name": "transaction",<br />&nbsp;&nbsp;&nbsp;&nbsp;"key": "booking_id",<br />&nbsp;&nbsp;&nbsp;&nbsp;"range_key": "flight_id"<br />&nbsp;&nbsp;}<br />]</pre> |
| lambda_function_custom_configuration | The custom configuration for the Lambda Function            | no          | <pre>{<br />&nbsp;&nbsp;"booking-create": {<br />&nbsp;&nbsp;&nbsp;&nbsp;"lambda_memory_size": 1024,<br />&nbsp;&nbsp;&nbsp;&nbsp;"lambda_timeout": 300<br />&nbsp;&nbsp;}<br />}</pre>                                                                                                                                                                                                                                                                                              |
| default_tags                         | The default tags for the service                            | no          |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |

### DynamoDB Configuration

| name      | description                           | is required | example   |
| --------- | ------------------------------------- | ----------- | --------- |
| name      | The name of the DynamoDB table        | yes         | booking   |
| key       | The primary key of the DynamoDB table | yes         | id        |
| range_key | The range key of the DynamoDB table   | no          | flight_id |

### Lambda Configuration

| name                | description                                    | is required | example     |
| ------------------- | ---------------------------------------------- | ----------- | ----------- |
| lambda_memory_size  | The memory size of the Lambda Function         | no          | 1024        |
| lambda_timeout      | The timeout of the Lambda Function             | no          | 300         |
| schedule_expression | The schedule expression of the Lambda Function | no          | rate(1 day) |

## Context

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
