output "aws_account_id" {
  description = "AWS account ID currently used by Terraform"
  value       = data.aws_caller_identity.current.account_id
}

output "aws_region" {
  description = "AWS region currently used by Terraform"
  value       = data.aws_region.current.name
}

output "vpc_id" {
  description = "Main VPC ID"
  value       = aws_vpc.main.id
}

output "public_subnet_ids" {
  description = "Public subnet IDs"
  value       = aws_subnet.public[*].id
}

output "private_subnet_ids" {
  description = "Private subnet IDs"
  value       = aws_subnet.private[*].id
}

output "nat_gateway_id" {
  description = "NAT Gateway ID"
  value       = aws_nat_gateway.main.id
}
output "eks_cluster_name" {
  description = "EKS cluster name"
  value       = aws_eks_cluster.main.name
}

output "eks_cluster_endpoint" {
  description = "EKS cluster API endpoint"
  value       = aws_eks_cluster.main.endpoint
}

output "eks_node_group_name" {
  description = "EKS node group name"
  value       = aws_eks_node_group.main.node_group_name
}
output "rds_endpoint" {
  description = "RDS PostgreSQL endpoint"
  value       = aws_db_instance.postgres.endpoint
}

output "rds_database_name" {
  description = "RDS database name"
  value       = aws_db_instance.postgres.db_name
}

output "rds_username" {
  description = "RDS database username"
  value       = aws_db_instance.postgres.username
}

output "rds_password" {
  description = "Generated RDS password"
  value       = random_password.db_password.result
  sensitive   = true
}

output "backend_db_secret_name" {
  description = "AWS Secrets Manager secret name for backend database credentials"
  value       = aws_secretsmanager_secret.backend_db.name
}

output "backend_db_secret_arn" {
  description = "AWS Secrets Manager secret ARN for backend database credentials"
  value       = aws_secretsmanager_secret.backend_db.arn
}
output "frontend_bucket_name" {
  description = "S3 bucket name for frontend static files"
  value       = aws_s3_bucket.frontend.bucket
}

output "frontend_cloudfront_domain_name" {
  description = "CloudFront distribution domain name for frontend"
  value       = aws_cloudfront_distribution.frontend.domain_name
}

output "frontend_cloudfront_distribution_id" {
  description = "CloudFront distribution ID for cache invalidations"
  value       = aws_cloudfront_distribution.frontend.id
}

output "github_actions_role_arn" {
  description = "IAM Role ARN used by GitHub Actions OIDC"
  value       = aws_iam_role.github_actions.arn
}