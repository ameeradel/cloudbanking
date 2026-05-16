variable "aws_region" {
  description = "AWS region where the infrastructure will be created"
  type        = string
}

variable "aws_profile" {
  description = "AWS CLI profile used by Terraform"
  type        = string
}

variable "project_name" {
  description = "Project name used for naming AWS resources"
  type        = string
}

variable "environment" {
  description = "Environment name such as dev, staging, or prod"
  type        = string
}

variable "vpc_cidr" {
  description = "CIDR block for the main VPC"
  type        = string
}

variable "public_subnet_cidrs" {
  description = "CIDR blocks for public subnets"
  type        = list(string)
}

variable "private_subnet_cidrs" {
  description = "CIDR blocks for private subnets"
  type        = list(string)
}

variable "eks_cluster_version" {
  description = "EKS Kubernetes version"
  type        = string
}

variable "eks_node_instance_types" {
  description = "EC2 instance types for EKS worker nodes"
  type        = list(string)
}

variable "eks_node_desired_size" {
  description = "Desired number of EKS worker nodes"
  type        = number
}

variable "eks_node_min_size" {
  description = "Minimum number of EKS worker nodes"
  type        = number
}

variable "eks_node_max_size" {
  description = "Maximum number of EKS worker nodes"
  type        = number
}
variable "db_name" {
  description = "Initial PostgreSQL database name"
  type        = string
}

variable "db_username" {
  description = "PostgreSQL master username"
  type        = string
}

variable "db_instance_class" {
  description = "RDS instance class"
  type        = string
}

variable "db_allocated_storage" {
  description = "Allocated storage for RDS in GB"
  type        = number
}

variable "frontend_domain_name" {
  description = "Custom domain name for the frontend CloudFront distribution"
  type        = string
}

variable "frontend_acm_certificate_arn" {
  description = "ACM certificate ARN for CloudFront. Must be in us-east-1"
  type        = string
}