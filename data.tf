# get current region of the aws account
data "aws_region" "current" {}
# get current caller identity of the aws account
data "aws_caller_identity" "current" {}
