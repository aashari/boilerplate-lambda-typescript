terraform {
  
  required_version = "~> 1.1.9"
  experiments = [module_variable_optional_attrs]

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 4.10.0"
    }
  }
  
}

provider "aws" {
  region = "ap-southeast-1"
}
