variable "service_version" {
  default     = "v1.0.0"
  type        = string
  description = "The version of the service"
}

variable "service_domain" {
  type        = string
  description = "The 1st level of logical grouping of the service, e.g. 'api', 'web', 'db', etc."
}

variable "service_name" {
  type        = string
  description = "The 2nd level of logical grouping of the service, e.g. 'my-api', 'my-web', 'my-db', etc."
}

variable "service_environment" {
  type        = string
  description = "The 3rd level of logical grouping of the service, e.g. 'dev', 'test', 'prod', etc."
}

variable "parameter_store_list" {
  type        = list(string)
  description = "The list of parameter store keys to be used for the service"
  default     = []
}

variable "dynamodb_table_list" {
  type = list(object({
    name      = string,
    key       = string,
    range_key = optional(string),
  }))
  description = "The list of dynamodb tables to be used for the service"
  default     = []
}

variable "lambda_function_custom_configuration" {
  type = map(object({
    lambda_memory_size  = optional(number),
    lambda_timeout      = optional(number),
    schedule_expression = optional(string),
  }))
  description = "The custom configuration for the Lambda Function"
  default     = {}
}

variable "default_tags" {
  type        = map(string)
  description = "The default tags for the service"
  default     = {}
}
