terraform {
  required_providers {
    aws = {
      source = "hashicorp/aws"
      version = "~> 4.10.0"
    }
  }
}

provider "aws" {
  region = "ap-southeast-1"
}
