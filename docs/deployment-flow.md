# CloudBanking Deployment Flow

This document explains how CloudBanking is deployed from source code to AWS infrastructure and Kubernetes workloads.

It covers the deployment flow for:

- Infrastructure
- Backend API
- Frontend application
- Secrets
- Helm
- GitHub Actions CI
- ArgoCD GitOps CD

---

## 1. Deployment Overview

CloudBanking uses a layered deployment model.

```text
Terraform
↓
AWS Infrastructure and Platform Components
↓
EKS Cluster
↓
Helm Chart
↓
ArgoCD GitOps Deployment
↓
Backend Pods
```

The frontend and backend have different deployment paths.

Frontend:

```text
React/Vite source code
↓
npm run build
↓
dist/
↓
S3 bucket
↓
CloudFront
↓
cloudbanking.ameeradel.dev
```

Backend:

```text
Backend source code
↓
GitHub Actions
↓
Docker build
↓
Push image to ECR
↓
Update Helm image tag
↓
ArgoCD sync
↓
EKS backend deployment
```

---

## 2. Deployment Responsibilities

Each tool has a clear responsibility.

| Tool | Responsibility |
|---|---|
| Terraform | Creates AWS infrastructure and platform tools |
| Docker | Packages backend application |
| ECR | Stores backend Docker images |
| Helm | Packages Kubernetes resources |
| GitHub Actions | Builds and pushes backend images |
| ArgoCD | Deploys Helm chart to EKS |
| S3 | Stores frontend build files |
| CloudFront | Serves frontend globally |
| Cloudflare | Manages DNS records |

---

## 3. Infrastructure Deployment

Terraform is used to create the AWS infrastructure.

Terraform manages:

```text
VPC
Subnets
Route Tables
NAT Gateway
Internet Gateway
EKS
EKS Node Group
ECR
RDS
Secrets Manager
S3
CloudFront
IAM Roles
External Secrets Operator
AWS Load Balancer Controller
ArgoCD
```

Terraform commands:

```bash
cd terraform

terraform init
terraform fmt
terraform validate
terraform plan
terraform apply
```

Terraform outputs important values such as:

```text
EKS cluster name
RDS endpoint
S3 bucket name
CloudFront domain
CloudFront distribution ID
Secrets Manager secret ARN
GitHub Actions role ARN
```

---

## 4. Infrastructure Deployment Flow

```text
Developer runs Terraform
↓
Terraform reads .tf files
↓
Terraform compares desired state with AWS
↓
Terraform creates or updates AWS resources
↓
AWS infrastructure becomes ready
```

Example:

```text
terraform apply
↓
Creates VPC
↓
Creates EKS
↓
Creates RDS
↓
Creates S3 and CloudFront
↓
Installs controllers through Helm provider
```

Terraform is the source of truth for platform-level resources.

---

## 5. EKS Deployment Foundation

The EKS cluster runs backend workloads.

The cluster uses:

- Private worker nodes
- AWS Load Balancer Controller
- External Secrets Operator
- ArgoCD
- Kubernetes namespaces
- Helm-based application deployment

The backend namespace is:

```text
cloudbanking
```

Platform namespaces include:

```text
external-secrets
argocd
kube-system
```

---

## 6. Backend Image Build Flow

The backend is containerized using Docker.

Manual local build example:

```bash
docker build -t cloudbanking-backend ./backend
```

Production build is handled by GitHub Actions.

GitHub Actions builds the image and tags it using the short Git commit SHA.

Example image:

```text
777208093235.dkr.ecr.eu-central-1.amazonaws.com/cloudbanking-backend:4ec6555
```

---

## 7. Backend CI Flow

When backend code changes are pushed to GitHub:

```text
Developer pushes code
↓
GitHub Actions starts
↓
Checkout repository
↓
Authenticate to AWS using OIDC
↓
Login to Amazon ECR
↓
Build Docker image
↓
Tag image with commit SHA
↓
Push image to ECR
```

The workflow does not use static AWS access keys.

It uses GitHub OIDC and an IAM role created by Terraform.

---

## 8. GitHub Actions OIDC Flow

```text
GitHub Actions job
↓
Requests OIDC token from GitHub
↓
AWS STS validates token
↓
GitHub Actions assumes IAM role
↓
Workflow gets temporary AWS credentials
↓
Workflow pushes image to ECR
```

This avoids storing long-lived AWS credentials in GitHub secrets.

The IAM role is restricted to the CloudBanking repository.

---

## 9. ECR Image Tagging Strategy

Each backend image is pushed with two tags:

```text
latest
<short-git-sha>
```

Example:

```text
cloudbanking-backend:latest
cloudbanking-backend:4ec6555
```

The `latest` tag is useful for quick testing.

The Git SHA tag is used for traceable deployments.

The Helm chart should deploy the Git SHA tag, not rely only on `latest`.

---

## 10. Helm Values Update Flow

After pushing the image to ECR, GitHub Actions updates:

```text
helm/cloudbanking-backend/values.yaml
```

The image tag is changed from the previous version to the new commit SHA.

Example:

```yaml
image:
  repository: 777208093235.dkr.ecr.eu-central-1.amazonaws.com/cloudbanking-backend
  tag: 4ec6555
  pullPolicy: Always
```

Then GitHub Actions commits this change back to GitHub.

The commit message includes:

```text
[skip ci]
```

This prevents unnecessary CI loops.

---

## 11. GitOps Deployment Flow

ArgoCD watches the Git repository.

```text
GitHub repository
↓
main branch
↓
helm/cloudbanking-backend
↓
ArgoCD Application
↓
EKS cluster
```

When GitHub Actions updates the Helm image tag:

```text
Git commit updates values.yaml
↓
ArgoCD detects new Git revision
↓
ArgoCD renders Helm chart
↓
ArgoCD applies Kubernetes manifests
↓
Kubernetes rolls out new backend pods
```

This is the GitOps deployment model.

---

## 12. ArgoCD Application

The ArgoCD Application points to:

```text
Repository: https://github.com/ameeradel/cloudbanking.git
Branch: main
Path: helm/cloudbanking-backend
Namespace: cloudbanking
```

ArgoCD sync status should be:

```text
Synced
Healthy
```

Check ArgoCD status:

```bash
kubectl get applications -n argocd
```

Expected output:

```text
NAME                   SYNC STATUS   HEALTH STATUS
cloudbanking-backend   Synced        Healthy
```

---

## 13. Backend Kubernetes Rollout

When ArgoCD syncs a new image tag, Kubernetes creates a new ReplicaSet.

The deployment performs a rolling update.

```text
Old ReplicaSet
↓
New ReplicaSet created
↓
New pods start
↓
Readiness probes pass
↓
Old pods terminate
↓
New version serves traffic
```

Check rollout:

```bash
kubectl get pods -n cloudbanking
```

Check deployed image:

```bash
kubectl describe deployment cloudbanking-backend -n cloudbanking | grep Image
```

Expected image format:

```text
777208093235.dkr.ecr.eu-central-1.amazonaws.com/cloudbanking-backend:<commit-sha>
```

---

## 14. Backend Runtime Validation

After deployment, validate the backend through the public API domain.

Health check:

```bash
curl https://api.cloudbanking.ameeradel.dev/health
```

Readiness check:

```bash
curl https://api.cloudbanking.ameeradel.dev/ready
```

Accounts API:

```bash
curl https://api.cloudbanking.ameeradel.dev/api/accounts
```

Expected results:

- `/health` returns application status
- `/ready` confirms database connectivity
- `/api/accounts` returns stored accounts from RDS

---

## 15. Frontend Deployment Flow

The frontend is deployed separately from the backend.

```text
Frontend source code
↓
npm run build
↓
dist/
↓
Upload to S3
↓
Invalidate CloudFront cache
↓
Users receive new frontend version
```

Build frontend:

```bash
cd frontend
npm run build
```

Upload to S3:

```bash
aws s3 sync dist/ s3://cloudbanking-dev-frontend-777208093235 --delete --profile cloudbanking
```

Invalidate CloudFront:

```bash
aws cloudfront create-invalidation \
  --distribution-id E2VPXJ8QYX5AUB \
  --paths "/*" \
  --profile cloudbanking
```

Open frontend:

```text
https://cloudbanking.ameeradel.dev
```

---

## 16. Frontend Environment Configuration

The frontend uses Vite environment variables.

Production API URL:

```env
VITE_API_BASE_URL=https://api.cloudbanking.ameeradel.dev
VITE_USE_MOCKS=false
```

The frontend source code reads the backend API base URL from:

```text
import.meta.env.VITE_API_BASE_URL
```

This avoids hardcoding API URLs inside frontend components.

---

## 17. Secrets Deployment Flow

Secrets are not stored in Git.

Terraform creates the AWS Secrets Manager secret.

External Secrets Operator syncs it into Kubernetes.

```text
Terraform
↓
AWS Secrets Manager secret
↓
ExternalSecret resource
↓
External Secrets Operator
↓
Kubernetes Secret
↓
Backend Pod environment variables
```

The backend reads:

```text
DB_HOST
DB_PORT
DB_NAME
DB_USER
DB_PASSWORD
DB_SSL
```

from the Kubernetes Secret.

---

## 18. ExternalSecret Deployment

The Helm chart includes:

```text
SecretStore
ExternalSecret
```

The SecretStore defines AWS Secrets Manager as the provider.

The ExternalSecret defines which secret should be synced.

```text
cloudbanking-dev/backend/db
↓
backend-db-secret
```

Check ExternalSecret status:

```bash
kubectl get externalsecret -n cloudbanking
```

Expected:

```text
STATUS         READY
SecretSynced   True
```

---

## 19. Ingress Deployment Flow

The Helm chart deploys the backend Ingress.

The Ingress contains ALB annotations.

```text
Helm chart
↓
Ingress resource
↓
AWS Load Balancer Controller
↓
AWS ALB
↓
Target group
↓
Backend pods
```

The Ingress host is:

```text
api.cloudbanking.ameeradel.dev
```

Check Ingress:

```bash
kubectl get ingress -n cloudbanking
```

Describe Ingress:

```bash
kubectl describe ingress cloudbanking-backend-ingress -n cloudbanking
```

---

## 20. DNS Deployment Step

Cloudflare DNS points custom domains to AWS endpoints.

Frontend DNS:

```text
cloudbanking.ameeradel.dev
↓
CloudFront distribution domain
```

Backend DNS:

```text
api.cloudbanking.ameeradel.dev
↓
ALB DNS name
```

When the ALB is recreated, the Cloudflare backend CNAME must be updated to the new ALB DNS name unless DNS automation is added later.

---

## 21. HTTPS Deployment Step

The frontend and backend use separate ACM certificates.

Frontend certificate:

```text
Domain: cloudbanking.ameeradel.dev
Region: us-east-1
Used by: CloudFront
```

Backend certificate:

```text
Domain: api.cloudbanking.ameeradel.dev
Region: eu-central-1
Used by: ALB
```

The backend certificate ARN is configured in the Helm chart values.

---

## 22. Full Backend Deployment Sequence

End-to-end backend deployment:

```text
1. Developer changes backend code
2. Code is pushed to GitHub
3. GitHub Actions starts
4. AWS credentials are configured through OIDC
5. Docker image is built
6. Image is tagged with short commit SHA
7. Image is pushed to ECR
8. Helm values image tag is updated
9. GitHub Actions commits the updated values file
10. ArgoCD detects the Git change
11. ArgoCD syncs the Helm chart
12. Kubernetes creates new pods
13. Readiness probes pass
14. ALB routes traffic to new pods
```

---

## 23. Full Frontend Deployment Sequence

End-to-end frontend deployment:

```text
1. Developer changes frontend code
2. Frontend is built with npm run build
3. dist/ files are generated
4. Files are uploaded to private S3 bucket
5. CloudFront cache is invalidated
6. Users access the updated frontend through CloudFront
```

Frontend deployment is currently manual.

A future improvement is to automate it with GitHub Actions.

---

## 24. Deployment Verification Checklist

After backend deployment, verify:

```bash
kubectl get applications -n argocd
kubectl get pods -n cloudbanking
kubectl describe deployment cloudbanking-backend -n cloudbanking | grep Image
curl https://api.cloudbanking.ameeradel.dev/health
curl https://api.cloudbanking.ameeradel.dev/ready
curl https://api.cloudbanking.ameeradel.dev/api/accounts
```

Expected:

```text
ArgoCD: Synced / Healthy
Pods: Running 1/1
Image: ECR image with Git SHA tag
/health: status ok
/ready: database connected
/api/accounts: returns accounts JSON
```

---

## 25. Rollback Strategy

Because images are tagged with Git commit SHA, rollback can be done by reverting the Helm values image tag.

Example:

```yaml
image:
  tag: previous-sha
```

After this change is committed to Git, ArgoCD syncs the previous image.

Another option is to revert the Git commit that changed the image tag.

```bash
git revert <commit>
git push
```

ArgoCD will detect the revert and sync the previous desired state.

---

## 26. Why This Deployment Model Is Production-Style

This deployment model is production-style because:

- Infrastructure is managed by Terraform
- Application manifests are packaged by Helm
- Secrets are managed outside Git
- Images are stored in ECR
- Images are versioned by Git SHA
- CI does not use static AWS keys
- CD is handled by ArgoCD
- Git is the deployment source of truth
- Kubernetes performs rolling updates
- Readiness probes protect traffic routing
- HTTPS is used for frontend and backend

---

## 27. Current Deployment Status

Current deployment state:

```text
Infrastructure: Terraform
Backend image build: GitHub Actions
Backend deployment: ArgoCD + Helm
Frontend hosting: S3 + CloudFront
Database: RDS PostgreSQL
Secrets: AWS Secrets Manager + External Secrets Operator
Ingress: AWS ALB via AWS Load Balancer Controller
DNS: Cloudflare
HTTPS: ACM
```

---

## 28. Future Deployment Improvements

Possible improvements:

- Automate frontend deployment with GitHub Actions
- Automate CloudFront invalidation
- Add staging and production environments
- Add database migration workflow
- Add integration tests before image push
- Add ArgoCD Image Updater
- Move Cloudflare DNS records into Terraform
- Add deployment notifications
- Add rollback workflow
- Add manual approval for production deployments