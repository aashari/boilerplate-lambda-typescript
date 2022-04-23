# Boilerplate Lambda Typescript

## Overview

This is a boilerplate to help you initiate AWS Lambda project using Typescript, in this boilerplate there are `terraform code` to provision the stacks and the initial Typescript source code in the `sources` directory

### Features

- Terraform code to provision the AWS Lambda project
- Typescript source code in the `sources` directory
- Automatically load AWS Secrets Manager (parameter store) as environment variables
- Automatically load DynamoDB (table name) as environment variables
- Automatically create model for DynamoDB tables
- Decorator example to log the execution time of the method
- Datadog example integration to stream the metrics of statistic decorator to Datadog
- Lambda layer to store the dependencies of the project

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
│   │   ├── libraries
│   │   │   └── datadog.library.ts
│   │   └── models
│   │       ├── booking.model.ts
│   │       └── flight.model.ts
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
- `sources/src/models` is the collection of Typescript models, the initial example is `Booking` which is the model for DynamoDB table `booking` which automatically created by terraform code

## Configuration

There is file locals.tf contains the configuration for the project, here is the detailed configuration information:

| name                        | description                                                               | example                                                                            |
| --------------------------- | ------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| service_domain              | The 1st level of logical grouping for the service                         | `flight`                                                                           |
| service_name                | The 2nd level of logical grouping for the service                         | `booking`                                                                          |
| service_environment         | The 3rd level of logical grouping for the service                         | `dev`                                                                              |
| parameter_store_path        | The path/prefix of the parameter store                                    | `/services/flight/booking/dev/`                                                    |
| parameter_store_list        | The list of parameters that will be retrieved from the parameter store    | `[ "datadog-api-key", "datadog-app-key", "sentry-dsn", "sentry-environment", ]`    |
| dynamodb_table_list         | The list of dynamodb tables that will be used by the Lambda Function      | `[ { "name": "booking", "key": "id", }, { "name": "flight", "key": "id", }, ]`     |
| lambda_custom_configuration | The list of custom configuration that will be used by the Lambda Function | `{ "booking-create": { "lambda_memory_size": "1024", "lambda_timeout": "300", } }` |

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
- Typescript models:
  - `sources/src/models/booking.model.ts`
  - `sources/src/models/flight.model.ts`
- AWS Lambda Function custom configuration:
  - `booking-create` Lambda Function
    - `lambda_memory_size` => `128`
    - `lambda_timeout` => `60`

For the above configuration, the boilerplate will automatically populate theese environment variables:

- `DD_API_KEY`
- `DD_APP_KEY`
- `DYNAMODB_TABLE_BOOKING`
- `DYNAMODB_TABLE_FLIGHT`

## Typescript Code

### Decorator

There is an initial example of `@statistic` decorator which have the functionality to log the execution duration for the method that uses the decorators, the example also include the additional process to stream the statistic metrics into Datadog, the example of how to use the decorator is as follows:

```
@statistic(true) // true if you want to stream the statistic metrics into Datadog
public async handler(event: any, context: any, callback: any) {
    callback(null, {
        statusCode: 200,
        body: JSON.stringify({
            message: 'Hello World!',
        }),
    });
}
```

### Model

By default, the boilerplate will automatically created models based on DynamoDB table defined in `locals.tf`, for example, if there's DynamoDB table `booking` and `flight` then there will be two models created:

```
export class BookingModel extends Model {
  public id: string;
  public created_at: number;
  public updated_at: number;
}

export class FlightModel extends Model {
  public id: string;
  public created_at: number;
  public updated_at: number;
}
```

All of the models created extends from `Model` class, which is the base class for all models, and the `Model` class contains the following methods:

- `get(key: { [key: string]: string }): Promise<Model|null>`
- `put(data: Model): Promise<boolean>`

Here is the example of usage:

#### To retrieve the booking data by id
```
BookingModel.get({ id: "123" }).then((booking) => {
  if (booking) {
    console.log(booking);
  }
});
```

#### To store the booking data:
```
let myBooking = new BookingModel();
myBooking.id = "123";
myBooking.save();
```

#### To store the booking data using static method:
```
let myBooking = new BookingModel();
myBooking.id = "123";
BookingModel.put(myBooking).then((success) => {
  if (success) {
    console.log("success");
  }
});
```

## Minimum Requirements
- [nodenv 1.4.0](https://github.com/nodenv/nodenv)
- [tfenv 2.2.3](https://github.com/tfutils/tfenv)

## How to run
```
terraform init
terraform apply
```
