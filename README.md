# Boilerplate Lambda Typescript

## Overview

This is a boilerplate to help you initiate AWS Lambda project using Typescript, in this boilerplate there are `terraform code` to provision the stacks and the initial Typescript source code in the `sources` directory

### Features

- Terraform code to provision the AWS Lambda project
- Typescript source code in the `sources` directory
- Automatically load AWS Secrets Manager (parameter store) as environment variables
- Automatically load DynamoDB (table name) as environment variables
- Decorator example to log the execution time of the method
- Datadog example integration to stream the metrics of statistic decorator to Datadog

### Project Structures

```
.
├── sources
│   ├── dist
│   ├── node_modules
│   ├── package-lock.json
│   ├── package.json
│   ├── src
│   │   ├── decorators
│   │   │   └── statistic.decorator.ts
│   │   ├── functions
│   │   │   ├── booking-create.function.ts
│   │   │   ├── booking-search.function.ts
│   │   │   └── flight-search.function.ts
│   │   ├── helpers
│   │   │   └── parameter-store.helper.ts
│   │   ├── index.ts
│   │   └── libraries
│   │       └── datadog.library.ts
│   └── tsconfig.json
├── README.md
├── data.tf
├── locals.tf
├── main.tf
├── providers.tf
```

#### Context

- AWS Lambda Function will automatically created based on files `*.function.ts` under `sources/src/functions`, for example, if there's file name `test.function.ts` then there will be an AWS Lambda Function created specific for `test` function
- `sources/src/helpers` is the collection of functional helpers such as `populateEnvironmentVariables()` you can freely add another functional helpers under this directory
- `sources/src/libraries` is the collection of class helpers such as `DatadogLibrary` which contains all Datadog functionality such as `publishMetrics` and `publishEvents`, or another example `DynamoDBLibrary` which contains `putItem` and `getItem`
- `sources/src/decorators` is the collection of Typescript decorators, the initial example is `@statistic` decorator which have the functionality to log the execution duration for the method that uses the decorators, the example also include the additional process to stream the statistic metrics into Datadog
- `sources/src/index.ts` is a bootstraper file which contains default `exports.handlers` function, which is the default function that will be called by AWS Lambda Function, this file contains logic to create the `sources/src/functions/*.function.ts` instance and create object then call the `handler` method

### Configuration

There is file locals.tf contains the configuration for the project, here is the detailed configuration information:

| name                        | description                                                               | example                                                                                                 |
| --------------------------- | ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| service_domain              | The 1st level of logical grouping for the service                         | `flight`                                                                                                |
| service_name                | The 2nd level of logical grouping for the service                         | `booking`                                                                                               |
| service_environment         | The 3rd level of logical grouping for the service                         | `dev`                                                                                                   |
| parameter_store_path        | The path/prefix of the parameter store                                    | `/services/flight/booking/dev/`                                                                         |
| parameter_store_list        | The list of parameters that will be retrieved from the parameter store    | `[ "datadog-api-key", "datadog-app-key", "sentry-dsn", "sentry-environment", ]`                         |
| dynamodb_table_list         | The list of dynamodb tables that will be used by the Lambda Function      | `[ { "name": "booking", "key": "id", }, { "name": "flight", "key": "id", }, ]` |
| lambda_custom_configuration | The list of custom configuration that will be used by the Lambda Function | `{ "booking-create": { "lambda_memory_size": "1024", "lambda_timeout": "300", } }`                         |

Configuration example for the `locals.tf` file:

```
locals {

  service_domain       = "flight"
  service_name         = "booking"
  service_environment  = "dev"
  parameter_store_path = "tvlk-secret/${local.service_name}/${local.service_domain}"

  parameter_store_list = [
    "dd-api-key",
    "dd-app-key",
  ]

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

  lambda_custom_configuration = {
    booking-create : {
      lambda_memory_size : "128",
      lambda_timeout : "60"
    }
  }

}
```

By above configuration, the boilerplate will automatically creates:
- AWS Lambda Function based on `sources/src/functions/*.function.ts`
    - `sources/src/functions/booking-create.function.ts` => `booking-create` Lambda Function
    - `sources/src/functions/booking-search.function.ts` => `booking-search` Lambda Function
    - `sources/src/functions/flight-search.function.ts` => `flight-search` Lambda Function
- AWS Secrets Manager (parameter store):
    - `/services/flight/booking/dev/dd-api-key`
    - `/services/flight/booking/dev/dd-app-key`
- DynamoDB (table name):
    - `booking`
    - `flight`
- AWS Lambda Function custom configuration:
    - `booking-create` Lambda Function
        - `lambda_memory_size` => `128`
        - `lambda_timeout` => `60`

For the above configuration, the boilerplate will automatically populate theese environment variables:
- `DD_API_KEY`
- `DD_APP_KEY`
- `DYNAMODB_TABLE_BOOKING`
- `DYNAMODB_TABLE_FLIGHT`

### How to run
```
terraform init
terraform apply
```
