# CloudBanking

CloudBanking is a production-style cloud-native banking platform designed as a DevOps portfolio project.

The project will include:

- React frontend
- Node.js backend API
- PostgreSQL database using Amazon RDS
- AWS infrastructure provisioned with Terraform
- Kubernetes deployment on Amazon EKS
- Helm charts for application packaging
- Argo CD for GitOps-based deployment
- AWS Secrets Manager for secret management
- CI/CD pipeline using GitHub Actions
- Monitoring and observability practices

## Project Status

This project is currently in active development.

## Planned Architecture

User → Frontend → Backend API → Amazon RDS

DevOps flow:

GitHub → GitHub Actions → ECR → Argo CD → EKS