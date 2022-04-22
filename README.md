# Boilerplate Lambda Typescript

## Overview
This is a boilerplate to help you initiate AWS Lambda project using Typescript, in this boilerplate there are `terraform code` to provision the stacks and the initial Typescript source code in the `sources` directory

## How to Setup

### Requirement
- tfenv: ~2.2.2
- nodenv: ~1.4.0

### Setup the configuration
In the `main.tf` you will see the `locals` block to help you configure the project information, you need to adjust your configuration accordingly there
- `service_domain` is a 1st level logical grouping (it could be anything you want)
- `service_name` is the 2nd level logical grouping (it could be anything you want), this will be used as the prefix for the stack name
- `parameter_store_list` is the parameter store name list (list of string) that will be provisioned during apply, the parameter store generated will be parsed and loaded into the lambda function environment
	- name parsing logic: convert the parameter name to upper case and replace the '-' with '_', (e.g. `dd-app-key` become `DD_APP_KEY`, `dd-api-key` become `DD_API_KEY`)

### Apply the stacks
Simply use `terraform init` then `terraform apply`

## How it Works
// TODO:
