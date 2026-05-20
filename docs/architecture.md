# CloudBanking Architecture

This document explains the CloudBanking project architecture, how traffic flows through the system, why each component exists, and how the infrastructure, application, secrets, CI/CD, and GitOps layers work together.

---

## 1. High-Level Architecture

CloudBanking is a cloud-native digital banking platform deployed on AWS.

The system is split into two main runtime paths:

1. Frontend hosting path
2. Backend API path

```text
User Browser
↓
cloudbanking.ameeradel.dev
↓
CloudFront
↓
Private S3 Bucket
↓
React/Vite Frontend
↓ API Requests
api.cloudbanking.ameeradel.dev
↓
AWS Application Load Balancer
↓
Kubernetes Ingress
↓
Backend Service
↓
Backend Pods on EKS
↓
RDS PostgreSQL
```

The frontend and backend are deployed separately.

The frontend is a static React/Vite application served from S3 through CloudFront.

The backend is a Node.js/Express API running as containers on EKS.

The database is PostgreSQL running on private Amazon RDS.

---

## 2. Main Components

| Component | Purpose |
|---|---|
| Cloudflare DNS | Manages DNS records for the custom domains |
| CloudFront | Serves the frontend globally with HTTPS and caching |
| S3 | Stores the built React frontend files |
| EKS | Runs backend workloads on Kubernetes |
| ECR | Stores backend Docker images |
| ALB | Exposes the backend API publicly over HTTPS |
| AWS Load Balancer Controller | Creates and manages ALB resources from Kubernetes Ingress |
| RDS PostgreSQL | Stores banking data such as accounts and transactions |
| AWS Secrets Manager | Stores database credentials securely |
| External Secrets Operator | Syncs AWS Secrets Manager secrets into Kubernetes Secrets |
| Helm | Packages Kubernetes manifests for the backend |
| GitHub Actions | Builds backend Docker images and pushes them to ECR |
| ArgoCD | Deploys the Helm chart to EKS using GitOps |
| Terraform | Provisions AWS infrastructure and platform components |

---

## 3. Frontend Architecture

The frontend is built with React and Vite.

After building the frontend, the static files are uploaded to S3.

```text
React/Vite source code
↓
npm run build
↓
dist/
↓
S3 private bucket
↓
CloudFront
↓
cloudbanking.ameeradel.dev
```

The S3 bucket is private.

Users do not access the S3 bucket directly.

CloudFront accesses the S3 bucket using Origin Access Control.

This keeps the frontend files private while still allowing public access through CloudFront.

---

## 4. Frontend Request Flow

When a user opens the frontend domain:

```text
User
↓
https://cloudbanking.ameeradel.dev
↓
Cloudflare DNS
↓
CloudFront
↓
S3 private bucket
↓
React app loaded in browser
```

After the React app loads in the browser, API calls are sent to the backend API domain:

```text
React app in browser
↓
https://api.cloudbanking.ameeradel.dev
↓
AWS ALB
↓
EKS backend
```

The frontend is not deployed inside Kubernetes.

This is intentional because the frontend is a static web application, and S3 + CloudFront is a better production hosting model for static assets.

---

## 5. Backend Architecture

The backend is a Node.js/Express application containerized with Docker.

The image is stored in Amazon ECR.

The backend runs on EKS as Kubernetes pods.

```text
Backend source code
↓
Docker build
↓
Docker image
↓
Amazon ECR
↓
EKS Deployment
↓
Backend Pods
```

The backend exposes APIs such as:

```text
GET  /health
GET  /ready
GET  /metrics

GET  /api/accounts
POST /api/accounts

POST /api/transfers

GET  /api/transactions
GET  /api/accounts/:id/transactions
```

---

## 6. Backend Traffic Flow

Backend traffic enters the system through the API domain:

```text
User / Frontend
↓
https://api.cloudbanking.ameeradel.dev
↓
Cloudflare DNS
↓
AWS Application Load Balancer
↓
Kubernetes Ingress
↓
cloudbanking-backend-service
↓
Backend Pods
↓
RDS PostgreSQL
```

The ALB is created by AWS Load Balancer Controller based on the Kubernetes Ingress resource.

The backend service is internal to Kubernetes and uses `ClusterIP`.

Only the ALB exposes the backend publicly.

---

## 7. Kubernetes Ingress and ALB

The project uses AWS Load Balancer Controller, not NGINX Ingress Controller.

The Kubernetes Ingress resource defines routing rules.

The AWS Load Balancer Controller watches the Ingress resource and creates AWS ALB resources.

```text
Kubernetes Ingress YAML
↓
AWS Load Balancer Controller
↓
Creates / updates AWS ALB
↓
Creates listeners and target groups
↓
Routes traffic to backend pods
```

The traffic does not pass through the AWS Load Balancer Controller pod.

The controller only manages AWS resources.

The actual traffic flow is:

```text
User
↓
AWS ALB
↓
Target Group
↓
Backend Pods / Service
```

---

## 8. Why ALB Instead of NGINX Ingress

In this EKS architecture, AWS ALB is used because it integrates directly with AWS networking and load balancing.

NGINX Ingress would add an extra proxy layer inside the cluster.

With AWS Load Balancer Controller, the Ingress resource directly results in an AWS ALB.

```text
EKS with AWS Load Balancer Controller:

User
↓
AWS ALB
↓
Backend Service / Pods
```

Compared to NGINX Ingress:

```text
User
↓
Load Balancer
↓
NGINX Ingress Controller Pod
↓
Backend Service
↓
Backend Pods
```

For this project, ALB is simpler and more AWS-native.

---

## 9. Backend Kubernetes Resources

The backend Helm chart manages these Kubernetes resources:

```text
Deployment
Service
Ingress
SecretStore
ExternalSecret
```

### Deployment

Runs the backend pods.

The deployment uses:

- 2 replicas
- CPU and memory requests
- CPU and memory limits
- Liveness probe
- Readiness probe
- Environment variables from Kubernetes Secret

### Service

Exposes backend pods internally inside Kubernetes.

```text
cloudbanking-backend-service
Type: ClusterIP
Port: 3000
```

### Ingress

Defines the public routing for:

```text
api.cloudbanking.ameeradel.dev
```

The Ingress is processed by AWS Load Balancer Controller.

### ExternalSecret

Defines how to sync database credentials from AWS Secrets Manager into Kubernetes.

---

## 10. Health and Readiness Probes

The backend exposes two production-style endpoints:

### `/health`

Used for liveness checks.

It confirms that the application process is alive.

If this endpoint fails, Kubernetes can restart the container.

### `/ready`

Used for readiness checks.

It confirms that the application can connect to PostgreSQL.

If this endpoint fails, Kubernetes will not send traffic to the pod.

```text
Kubernetes readiness probe
↓
GET /ready
↓
Backend checks PostgreSQL connection
↓
Pod marked Ready or NotReady
```

This prevents traffic from reaching pods that cannot serve real requests.

---

## 11. Database Architecture

The database is Amazon RDS PostgreSQL.

RDS is deployed in private subnets.

It is not publicly accessible.

```text
Backend Pods on EKS
↓
Private networking
↓
RDS PostgreSQL
```

Only the backend workload can connect to RDS through controlled security group rules.

The database stores:

- Accounts
- Transactions

Transfers are handled using PostgreSQL transactions.

```text
BEGIN
↓
Lock source and destination accounts
↓
Validate balances and currency
↓
Update source account balance
↓
Update destination account balance
↓
Insert transaction record
↓
COMMIT
```

If anything fails:

```text
ROLLBACK
```

This ensures that money transfer operations are atomic.

---

## 12. Secrets Management Architecture

Database credentials are stored in AWS Secrets Manager.

Terraform creates and manages the AWS secret.

The secret contains:

```json
{
  "DB_HOST": "rds-endpoint",
  "DB_PORT": "5432",
  "DB_NAME": "cloudbanking",
  "DB_USER": "cloudbanking_user",
  "DB_PASSWORD": "generated-password",
  "DB_SSL": "true"
}
```

External Secrets Operator syncs this secret into Kubernetes.

```text
AWS Secrets Manager
↓
External Secrets Operator
↓
Kubernetes Secret
↓
Backend Deployment
↓
Backend Pod environment variables
```

The backend pod does not directly call AWS Secrets Manager.

It reads a normal Kubernetes Secret.

The External Secrets Operator is responsible for syncing the secret from AWS to Kubernetes.

---

## 13. Why Use AWS Secrets Manager and External Secrets Operator

A manual Kubernetes Secret could work for testing, but it is not ideal for production.

AWS Secrets Manager + External Secrets Operator gives:

- Centralized secret storage
- IAM-based access control
- No secrets in Git
- No secrets in Kubernetes YAML
- Better GitOps compatibility
- Ability to rotate secrets later
- Reproducible environments

Manual secrets are acceptable for quick testing, but this project uses AWS Secrets Manager as the source of truth.

---

## 14. IAM and IRSA

The project uses IAM Roles for Service Accounts.

IRSA allows Kubernetes service accounts to assume AWS IAM roles.

External Secrets Operator uses IRSA to read from AWS Secrets Manager.

AWS Load Balancer Controller uses IRSA to manage AWS ALB resources.

```text
Kubernetes ServiceAccount
↓
IAM Role
↓
AWS permissions
```

This avoids using static AWS access keys inside the cluster.

---

## 15. Infrastructure as Code

Terraform is the source of truth for AWS infrastructure and platform-level components.

Terraform manages:

```text
VPC
Subnets
NAT Gateway
Internet Gateway
Route Tables
EKS
Node Groups
ECR
RDS
Secrets Manager
External Secrets Operator
AWS Load Balancer Controller
S3
CloudFront
IAM roles
GitHub Actions OIDC role
ArgoCD
```

Terraform does not manage application code.

Application deployment is handled by Helm and ArgoCD.

---

## 16. Terraform Responsibility

Terraform is responsible for the platform.

```text
Terraform
↓
Creates AWS infrastructure
↓
Installs platform controllers
↓
Creates IAM roles and policies
```

Examples:

- EKS cluster
- RDS database
- S3 bucket
- CloudFront distribution
- AWS Secrets Manager secret
- External Secrets Operator
- AWS Load Balancer Controller
- ArgoCD
- IAM roles for IRSA and GitHub Actions

---

## 17. Helm Responsibility

Helm is responsible for packaging application Kubernetes resources.

The backend Helm chart contains:

```text
Chart.yaml
values.yaml
templates/deployment.yaml
templates/service.yaml
templates/ingress.yaml
templates/external-secret.yaml
```

Helm values control:

- Image repository
- Image tag
- Replica count
- Service port
- Ingress host
- ALB annotations
- ExternalSecret settings
- Resource requests and limits
- Health probe paths

This makes the backend deployment configurable and reusable.

---

## 18. ArgoCD Responsibility

ArgoCD is responsible for GitOps-based deployment.

ArgoCD watches the Git repository:

```text
repo: https://github.com/ameeradel/cloudbanking.git
branch: main
path: helm/cloudbanking-backend
```

When the Helm chart changes in Git, ArgoCD syncs the cluster to match Git.

```text
Git repository
↓
ArgoCD
↓
Helm chart rendered
↓
Kubernetes resources applied
↓
EKS backend updated
```

ArgoCD provides:

- Continuous delivery
- Git as source of truth
- Drift detection
- Self-healing
- Automated sync

---

## 19. GitHub Actions CI

GitHub Actions is used for CI.

When backend code changes:

```text
Developer pushes backend code
↓
GitHub Actions starts
↓
Docker image is built
↓
Image is tagged with Git commit SHA
↓
Image is pushed to ECR
```

The pipeline uses GitHub OIDC to authenticate with AWS.

No long-lived AWS access keys are stored in GitHub.

---

## 20. CI/CD GitOps Flow

The final CI/CD flow is:

```text
Developer pushes backend code
↓
GitHub Actions builds backend Docker image
↓
Image is pushed to ECR with commit SHA tag
↓
GitHub Actions updates Helm values image.tag
↓
GitHub Actions commits the updated values file to Git
↓
ArgoCD detects the Git change
↓
ArgoCD syncs the Helm chart
↓
EKS rolls out the new backend image
```

This creates a complete CI/CD GitOps workflow.

---

## 21. Image Versioning Strategy

The project avoids relying only on `latest`.

Each backend image is tagged with the short Git commit SHA.

Example:

```text
777208093235.dkr.ecr.eu-central-1.amazonaws.com/cloudbanking-backend:4ec6555
```

This makes deployments traceable.

You can identify exactly which Git commit is running in the cluster.

Check the deployed image:

```bash
kubectl describe deployment cloudbanking-backend -n cloudbanking | grep Image
```

---

## 22. Frontend and Backend Separation

The frontend and backend are deployed separately.

Frontend:

```text
S3 + CloudFront
```

Backend:

```text
EKS + ALB + RDS
```

This separation is intentional.

The frontend is static and does not need Kubernetes.

The backend is dynamic and needs compute, networking, database access, health checks, and rolling deployments.

---

## 23. DNS Design

Cloudflare manages DNS.

The domain was purchased from Namecheap, but DNS is managed by Cloudflare nameservers.

Frontend DNS:

```text
cloudbanking.ameeradel.dev
↓
CloudFront domain
```

Backend DNS:

```text
api.cloudbanking.ameeradel.dev
↓
AWS ALB DNS name
```

Cloudflare records are configured as DNS-only during setup to reduce proxy-related complexity.

---

## 24. HTTPS Design

HTTPS is handled using AWS ACM certificates.

CloudFront requires the certificate to be in:

```text
us-east-1
```

The backend ALB requires the certificate to be in the same region as the ALB:

```text
eu-central-1
```

| Component | Domain | ACM Region |
|---|---|---|
| Frontend | `cloudbanking.ameeradel.dev` | `us-east-1` |
| Backend API | `api.cloudbanking.ameeradel.dev` | `eu-central-1` |

---

## 25. Runtime Summary

At runtime, the system works like this:

```text
User opens frontend
↓
CloudFront serves React app from private S3
↓
React app sends API request to backend domain
↓
ALB receives HTTPS request
↓
Ingress rule routes request to backend service
↓
Backend pod handles request
↓
Backend reads/writes data in RDS
↓
Response returns to user
```

---

## 26. Deployment Summary

The deployment lifecycle works like this:

```text
Terraform provisions infrastructure
↓
Developer pushes code to GitHub
↓
GitHub Actions builds backend image
↓
Image pushed to ECR
↓
Helm values updated with image tag
↓
ArgoCD syncs Helm chart
↓
Kubernetes rolls out new backend pods
```

---

## 27. Key Design Decisions

### S3 + CloudFront for frontend

Chosen because the frontend is static and does not need containers or Kubernetes.

### EKS for backend

Chosen to demonstrate production Kubernetes deployment on AWS.

### RDS instead of self-hosted PostgreSQL

Chosen for managed database reliability and production-style architecture.

### AWS Secrets Manager instead of plain Kubernetes Secrets

Chosen for centralized secret management and better security posture.

### External Secrets Operator

Chosen to integrate AWS Secrets Manager with Kubernetes in a GitOps-friendly way.

### ALB instead of NGINX Ingress

Chosen for AWS-native integration with EKS and Application Load Balancer.

### Helm

Chosen to package and configure Kubernetes application resources.

### ArgoCD

Chosen to implement GitOps-based continuous delivery.

### GitHub Actions OIDC

Chosen to avoid static AWS access keys in GitHub.

---

## 28. Architecture Benefits

This architecture provides:

- Clear separation between frontend and backend
- Private database access
- HTTPS for frontend and backend
- Kubernetes-based backend deployment
- Managed PostgreSQL database
- Secure secret management
- GitOps-based delivery
- Traceable image versions
- Infrastructure reproducibility
- Production-style AWS design

---

## 29. Future Architecture Improvements

Possible improvements:

- Add frontend CI/CD pipeline
- Add CloudFront invalidation automation
- Move Cloudflare DNS records into Terraform
- Add Prometheus and Grafana monitoring
- Add centralized logging
- Add HPA for backend autoscaling
- Add RDS Multi-AZ
- Add WAF in front of CloudFront and ALB
- Add database migrations
- Add authentication and authorization
- Add staging and production environments
- Add integration tests in CI
- Add ArgoCD Image Updater