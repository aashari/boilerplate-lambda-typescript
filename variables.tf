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
  default     = []
  description = <<EOF
    The list of parameter store keys to be used for the service, e.g. 
    <pre>[<br />&nbsp;&nbsp;"datadog-api-key",<br />&nbsp;&nbsp;"datadog-app-key",<br />&nbsp;&nbsp;"sentry-dsn",<br />&nbsp;&nbsp;"sentry-environment"<br />]</pre>
  EOF
}

variable "dynamodb_table_list" {
  type = list(object({
    name      = string,
    key       = string,
    range_key = optional(string),
  }))
  default     = []
  description = <<EOF
    The list of dynamodb tables to be used for the service, e.g.
    <pre>[<br />&nbsp;&nbsp;{<br />&nbsp;&nbsp;&nbsp;&nbsp;"name": "booking",<br />&nbsp;&nbsp;&nbsp;&nbsp;"key": "id"<br />&nbsp;&nbsp;},<br />&nbsp;&nbsp;{<br />&nbsp;&nbsp;&nbsp;&nbsp;"name": "flight",<br />&nbsp;&nbsp;&nbsp;&nbsp;"key": "id"<br />&nbsp;&nbsp;},<br />&nbsp;&nbsp;{<br />&nbsp;&nbsp;&nbsp;&nbsp;"name": "transaction",<br />&nbsp;&nbsp;&nbsp;&nbsp;"key": "booking_id",<br />&nbsp;&nbsp;&nbsp;&nbsp;"range_key": "flight_id"<br />&nbsp;&nbsp;}<br />]</pre>
  EOF
}

variable "lambda_function_configuration" {
  type = map(object({
    lambda_memory_size  = optional(number),
    lambda_timeout      = optional(number),
    schedule_expression = optional(string),
  }))
  default     = {}
  description = <<EOF
    The custom configuration for the Lambda Function, e.g.
    <pre>{<br />&nbsp;&nbsp;"booking-create": {<br />&nbsp;&nbsp;&nbsp;&nbsp;"lambda_memory_size": 1024,<br />&nbsp;&nbsp;&nbsp;&nbsp;"lambda_timeout": 300<br />&nbsp;&nbsp;}<br />}</pre>
  EOF
}

variable "default_tags" {
  type        = map(string)
  default     = {}
  description = "The default tags for the service"
}
