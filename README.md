# Boilerplate Lambda Typescript

## Overview
This is a boilerplate to help you initiate AWS Lambda project using Typescript, in this boilerplate there are `terraform code` to provision the stacks and the initial Typescript source code in the `sources` directory

## Requirement
- tfenv: ~2.2.2
- nodenv: ~1.4.0

## How to Setup

### Clone the Template
Click the "Use this template" button on this page to clone the template, or simply click this link:
[Use this template](https://github.com/aashari/boilerplate-lambda-typescript/generate)

### Setup the Configuration
In the `main.tf` you will see the `locals` block to help you configure the project information, you need to adjust your configuration accordingly there
- `service_domain` is a 1st level logical grouping (it could be anything you want)
- `service_name` is the 2nd level logical grouping (it could be anything you want), this will be used as the prefix for the stack name
- `parameter_store_list` is the parameter store name list (list of string) that will be provisioned during apply, the parameter store generated will be parsed and loaded into the lambda function environment, name parsing will convert the parameter name to upper case and replace the `'-'` with `'_'`, (e.g. `dd-app-key` become `DD_APP_KEY`, `dd-api-key` become `DD_API_KEY`)

### Apply the Stacks
Simply use `terraform init` then `terraform apply`

## Base Performance
By using x86_64 architecture and memory size set to 512, the base performance is around 222.00 ms per 1,000 invocations concurrently.
