# CloudBanking Troubleshooting Guide

This document contains common issues encountered during the CloudBanking project and how they were diagnosed and fixed.

The goal of this document is to make the project easier to debug, explain, and reproduce.

---

## 1. AWS CLI Was Connected to the Wrong AWS Account

### Problem

Running:

```bash
aws sts get-caller-identity
```

returned a different AWS account than the one intended for the CloudBanking project.

Example:

```json
{
  "UserId": "AIDA...",
  "Account": "916205284554",
  "Arn": "arn:aws:iam::916205284554:user/terraform-user"
}
```

### Cause

The local AWS CLI was using an old/default profile connected to another AWS account.

### Fix

Create and use a dedicated AWS CLI profile for CloudBanking.

```bash
aws configure --profile cloudbanking
```

Then export the profile:

```bash
export AWS_PROFILE=cloudbanking
export AWS_REGION=eu-central-1
```

Verify:

```bash
aws sts get-caller-identity --profile cloudbanking
```

Expected account:

```text
777208093235
```

---

## 2. ECR Push Failed Because Repository Name Became `cloudbanking-backendatest`

### Problem

Docker tried to push to:

```text
777208093235.dkr.ecr.eu-central-1.amazonaws.com/cloudbanking-backendatest
```

instead of:

```text
777208093235.dkr.ecr.eu-central-1.amazonaws.com/cloudbanking-backend:latest
```

Error:

```text
The repository with name 'cloudbanking-backendatest' does not exist
```

### Cause

Shell variable parsing issue.

The command was likely written like this:

```bash
docker push $ECR_REGISTRY/$ECR_REPO_NAME:latest
```

Depending on shell parsing, the variable and suffix may be interpreted incorrectly.

### Fix

Always wrap variables in braces:

```bash
docker push ${ECR_REGISTRY}/${ECR_REPO_NAME}:latest
```

Correct image format:

```text
777208093235.dkr.ecr.eu-central-1.amazonaws.com/cloudbanking-backend:latest
```

---

## 3. Terraform Duplicate `terraform` and `provider` Blocks

### Problem

Terraform configuration had duplicate blocks:

```hcl
terraform {
  required_providers {
    ...
  }
}

provider "aws" {
  ...
}

terraform {
  required_providers {
    ...
  }
}

provider "aws" {
  ...
}
```

### Cause

The provider configuration was appended instead of replacing the older block.

### Fix

Keep only one `terraform` block and one `provider "aws"` block.

Correct structure:

```hcl
terraform {
  required_version = ">= 1.6.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }

    random = {
      source  = "hashicorp/random"
      version = "~> 3.6"
    }

    tls = {
      source  = "hashicorp/tls"
      version = "~> 4.0"
    }

    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "~> 2.30"
    }

    helm = {
      source  = "hashicorp/helm"
      version = "~> 2.13"
    }
  }
}

provider "aws" {
  region  = var.aws_region
  profile = var.aws_profile
}
```

---

## 4. RDS PostgreSQL Version Not Available

### Problem

Terraform failed while creating RDS:

```text
InvalidParameterCombination: Cannot find version 16.3 for postgres
```

### Cause

The requested PostgreSQL engine version was not available in the selected AWS region.

### Fix

Use a PostgreSQL version available in the target region.

Example:

```hcl
engine         = "postgres"
engine_version = "16.13"
```

---

## 5. RDS Master Password Was Invalid

### Problem

RDS creation failed with:

```text
The parameter MasterUserPassword is not a valid password.
Only printable ASCII characters besides '/', '@', '"', ' ' may be used.
```

### Cause

Terraform `random_password` generated special characters that RDS does not allow.

### Fix

Restrict special characters or disable unsupported special characters.

Example:

```hcl
resource "random_password" "db_password" {
  length           = 24
  special          = true
  override_special = "!#$%&*()-_=+[]{}<>:?"
}
```

Or disable special characters:

```hcl
resource "random_password" "db_password" {
  length  = 24
  special = false
}
```

---

## 6. EKS Kubeconfig Confusion

### Question

Is the kubeconfig stored on the node like K3s?

### Explanation

In K3s, the kubeconfig is usually generated directly on the control-plane node.

In EKS, the kubeconfig is generated locally by AWS CLI.

Command:

```bash
aws eks update-kubeconfig \
  --region eu-central-1 \
  --name cloudbanking-dev-cluster \
  --profile cloudbanking
```

This command writes cluster access information into the local kubeconfig file.

Then `kubectl` uses AWS IAM authentication to get temporary credentials.

Flow:

```text
kubectl
↓
local kubeconfig
↓
AWS IAM authentication
↓
EKS API Server
```

---

## 7. `eksctl` Was Used Before Terraform Managed OIDC

### Problem

The EKS OIDC provider was initially created using:

```bash
eksctl utils associate-iam-oidc-provider
```

But the project goal was to keep Terraform as the source of truth.

### Fix

Import the existing OIDC provider into Terraform.

Get the OIDC issuer:

```bash
aws eks describe-cluster \
  --name cloudbanking-dev-cluster \
  --region eu-central-1 \
  --profile cloudbanking \
  --query "cluster.identity.oidc.issuer" \
  --output text
```

Import the existing provider:

```bash
terraform import aws_iam_openid_connect_provider.eks \
  "arn:aws:iam::777208093235:oidc-provider/oidc.eks.eu-central-1.amazonaws.com/id/59580A2E4CEC71903DF2B88A2FE44701"
```

After import, Terraform manages the OIDC provider.

---

## 8. Terraform Tried to Modify EKS/OIDC Tags After Import

### Problem

After importing OIDC, Terraform showed changes like removing `eksctl` tags.

Example:

```text
- "alpha.eksctl.io/cluster-oidc-enabled" = "true" -> null
```

### Cause

`eksctl` added its own tags, but Terraform configuration did not include them.

### Fix

Allow Terraform to remove `eksctl` tags and apply the project tags.

This is acceptable because Terraform should become the source of truth.

---

## 9. External Secrets Namespace Already Exists

### Problem

Terraform failed:

```text
Error: namespaces "external-secrets" already exists
```

### Cause

The namespace already existed because it was created manually or by a previous Helm install.

### Fix

Import the namespace into Terraform:

```bash
terraform import kubernetes_namespace.external_secrets external-secrets
```

Then rerun:

```bash
terraform plan
terraform apply
```

---

## 10. Helm Release Name Already in Use

### Problem

Terraform failed when installing External Secrets Operator:

```text
cannot re-use a name that is still in use
```

### Cause

A Helm release named `external-secrets` already existed outside Terraform state.

### Fix Option 1: Uninstall and Let Terraform Recreate

```bash
helm uninstall external-secrets -n external-secrets
terraform apply
```

### Fix Option 2: Import the Helm Release

```bash
terraform import helm_release.external_secrets external-secrets/external-secrets
```

The project used the first option during setup.

---

## 11. External Secrets Operator Creates Kubernetes Secrets

### Question

Are secrets exposed inside Kubernetes?

### Explanation

Yes, External Secrets Operator syncs AWS Secrets Manager values into a normal Kubernetes Secret.

Flow:

```text
AWS Secrets Manager
↓
External Secrets Operator
↓
Kubernetes Secret
↓
Backend Pod
```

The benefit is not that Kubernetes Secrets disappear.

The benefit is that secret values are not stored in Git or Kubernetes YAML.

### Security Notes

Restrict:

- Kubernetes RBAC
- IAM permissions
- Access to secrets
- Logs and screenshots

---

## 12. Backend Pod Failed With `no pg_hba.conf entry ... no encryption`

### Problem

Backend pod crashed with:

```text
no pg_hba.conf entry for host "...", user "cloudbanking_user", database "cloudbanking", no encryption
```

### Cause

RDS PostgreSQL required SSL, but the backend tried to connect without encryption.

### Fix

Add `DB_SSL=true` to AWS Secrets Manager.

Terraform secret example:

```hcl
secret_string = jsonencode({
  DB_HOST     = split(":", aws_db_instance.postgres.endpoint)[0]
  DB_PORT     = "5432"
  DB_NAME     = aws_db_instance.postgres.db_name
  DB_USER     = aws_db_instance.postgres.username
  DB_PASSWORD = random_password.db_password.result
  DB_SSL      = "true"
})
```

Update ExternalSecret to sync `DB_SSL`.

Update Deployment to pass `DB_SSL` as an environment variable.

Then restart backend:

```bash
kubectl rollout restart deployment/cloudbanking-backend -n cloudbanking
```

---

## 13. Local Backend Failed With `ECONNREFUSED localhost:5432`

### Problem

Running locally:

```bash
npm run dev
```

failed with:

```text
ECONNREFUSED ::1:5432
ECONNREFUSED 127.0.0.1:5432
```

### Cause

The backend tried to connect to PostgreSQL on the local machine.

RDS is private inside the AWS VPC, so local machine cannot connect directly.

### Fix Option 1: Test Inside EKS

Build and push the image, then test through the deployed backend.

This is the preferred method for this project.

### Fix Option 2: Run Local PostgreSQL

```bash
docker run --name cloudbanking-postgres \
  -e POSTGRES_DB=cloudbanking \
  -e POSTGRES_USER=cloudbanking_user \
  -e POSTGRES_PASSWORD=cloudbanking_password \
  -p 5432:5432 \
  -d postgres:16
```

Local `.env`:

```env
PORT=3000
DB_HOST=localhost
DB_PORT=5432
DB_NAME=cloudbanking
DB_USER=cloudbanking_user
DB_PASSWORD=cloudbanking_password
DB_SSL=false
```

---

## 14. Backend Pod CrashLoopBackOff

### Problem

Pod status:

```text
CrashLoopBackOff
```

### Diagnosis

Describe pod:

```bash
kubectl describe pod <pod-name> -n cloudbanking
```

Check logs:

```bash
kubectl logs -n cloudbanking deployment/cloudbanking-backend --tail=100
```

### Common Causes

- Invalid database credentials
- Missing environment variable
- RDS SSL error
- Application runtime error
- Missing secret key
- Database schema init error

### Fix

Use logs to identify the exact runtime failure.

---

## 15. ACM Validation Record Was Added Incorrectly in Cloudflare

### Problem

ACM certificate stayed pending.

Cloudflare record was created with:

```text
Name: @
Target: validation-name
Proxy: Proxied
```

### Cause

For ACM DNS validation, the exact CNAME name and value from AWS must be added.

Also, proxy must be disabled.

### Fix

In Cloudflare:

```text
Type: CNAME
Name: _validation-record.cloudbanking
Target: _validation-value.acm-validations.aws
Proxy: DNS only
TTL: Auto
```

Do not use `@`.

Do not use proxied mode for validation.

---

## 16. CloudFront Certificate Must Be in `us-east-1`

### Problem

CloudFront custom domain requires a certificate, but certificate in another region does not work.

### Cause

CloudFront requires ACM certificates for custom domains to be issued in:

```text
us-east-1
```

### Fix

Create ACM certificate for:

```text
cloudbanking.ameeradel.dev
```

in:

```text
us-east-1
```

Use that ARN in CloudFront.

---

## 17. Backend ALB Certificate Must Be in `eu-central-1`

### Problem

ALB HTTPS listener failed when using the wrong certificate or region.

### Cause

ALB requires the ACM certificate to be in the same region as the ALB.

The backend ALB is in:

```text
eu-central-1
```

### Fix

Create ACM certificate for:

```text
api.cloudbanking.ameeradel.dev
```

in:

```text
eu-central-1
```

Use that certificate ARN in the Ingress annotation.

---

## 18. ALB HTTPS Failed With `CertificateNotFound`

### Problem

Ingress events showed:

```text
CertificateNotFound
Certificate ARN is not valid
```

### Cause

The Ingress annotation had a placeholder value:

```text
YOUR_BACKEND_CERT_ID
```

or the wrong certificate ARN.

### Fix

Use the real ACM certificate ARN:

```yaml
alb.ingress.kubernetes.io/certificate-arn: arn:aws:acm:eu-central-1:777208093235:certificate/real-id
```

Check Ingress events:

```bash
kubectl describe ingress cloudbanking-backend-ingress -n cloudbanking
```

---

## 19. Ingress `PORTS` Shows Only `80`

### Problem

`kubectl get ingress` showed:

```text
PORTS 80
```

even after HTTPS was configured.

### Explanation

The `PORTS` column in `kubectl get ingress` may not always accurately show all ALB listeners.

### Check Instead

Describe the Ingress:

```bash
kubectl describe ingress cloudbanking-backend-ingress -n cloudbanking
```

Test HTTPS directly:

```bash
curl https://api.cloudbanking.ameeradel.dev/health
```

If HTTPS returns `200`, the setup is working.

---

## 20. Direct HTTP ALB Request Returned `301 Moved Permanently`

### Problem

Request:

```bash
curl http://ALB-DNS/health
```

returned:

```html
301 Moved Permanently
```

### Cause

The Ingress includes:

```yaml
alb.ingress.kubernetes.io/ssl-redirect: "443"
```

This redirects HTTP traffic to HTTPS.

### Fix

Use HTTPS through the custom API domain:

```bash
curl https://api.cloudbanking.ameeradel.dev/health
```

---

## 21. API Domain Could Not Resolve

### Problem

Curl failed:

```text
Could not resolve host: api.cloudbanking.ameeradel.dev
```

### Cause

Cloudflare DNS record was missing, wrong, or still pointing to an old ALB DNS.

### Fix

Update Cloudflare CNAME:

```text
Type: CNAME
Name: api.cloudbanking
Target: current ALB DNS
Proxy: DNS only
TTL: Auto
```

Get current ALB DNS:

```bash
kubectl get ingress -n cloudbanking
```

---

## 22. Helm `values.yaml` YAML Parse Error

### Problem

Helm failed:

```text
cannot unmarshal yaml document
mapping values are not allowed in this context
```

### Cause

The ALB `listenPorts` value was written as inline JSON and YAML parsing failed.

### Fix

Use YAML list format:

```yaml
listenPorts:
  - HTTP: 80
  - HTTPS: 443
```

Then convert it in the template using `toJson`.

---

## 23. Helm Ingress Template Failed on `listen-ports`

### Problem

Helm lint failed:

```text
templates/ingress.yaml: unable to parse YAML
mapping values are not allowed in this context
```

### Cause

The `listen-ports` annotation was not rendered safely as a string.

### Fix

In `templates/ingress.yaml`:

```yaml
alb.ingress.kubernetes.io/listen-ports: {{ .Values.ingress.alb.listenPorts | toJson | quote }}
```

In `values.yaml`:

```yaml
listenPorts:
  - HTTP: 80
  - HTTPS: 443
```

---

## 24. Helm Certificate ARN Was Rendered Incorrectly

### Problem

Ingress event showed:

```text
Certificate ARN 'alb.ingress.kubernetes.io/certificate-arn: arn:aws:...' is not valid
```

### Cause

The value in `values.yaml` included the annotation key as part of the value.

Wrong:

```yaml
certificateArn: "alb.ingress.kubernetes.io/certificate-arn: arn:aws:..."
```

Correct:

```yaml
certificateArn: "arn:aws:acm:eu-central-1:777208093235:certificate/real-id"
```

### Fix

Only put the ARN in `certificateArn`.

---

## 25. Helm Installed Successfully But Ingress ADDRESS Was Empty

### Problem

After Helm install:

```text
ADDRESS empty
```

### Cause

AWS Load Balancer Controller was still reconciling or had an error.

### Diagnosis

Check Ingress events:

```bash
kubectl describe ingress cloudbanking-backend-ingress -n cloudbanking
```

Check controller logs:

```bash
kubectl logs -n kube-system deployment/aws-load-balancer-controller --tail=100
```

### Common Causes

- Invalid certificate ARN
- Missing ALB annotations
- AWS Load Balancer Controller error
- IAM permission issue
- Subnet tagging issue

---

## 26. ArgoCD Synced But Deployment Still Used Old Image

### Problem

ArgoCD showed:

```text
Synced
Healthy
```

but deployment still used:

```text
cloudbanking-backend:latest
```

### Cause

ArgoCD had not yet completed the sync or Kubernetes rollout.

### Fix

Wait and re-check:

```bash
kubectl get applications -n argocd
kubectl describe deployment cloudbanking-backend -n cloudbanking | grep Image
```

Verify ArgoCD revision:

```bash
kubectl get application cloudbanking-backend -n argocd \
  -o jsonpath='{.status.sync.revision}{"\n"}'
```

Compare with Git:

```bash
git rev-parse origin/main
```

In this case, it was only a matter of time.

---

## 27. GitHub Actions ECR Query `sort_by` Failed

### Problem

AWS CLI query failed:

```text
Row should have 3 elements, instead it has 1
```

### Cause

Some ECR image details may have `imageTags=null`, which breaks table output with mixed row shapes.

### Fix

Filter out images without tags:

```bash
aws ecr describe-images \
  --repository-name cloudbanking-backend \
  --region eu-central-1 \
  --profile cloudbanking \
  --query 'sort_by(imageDetails[?imageTags!=null], &imagePushedAt)[-5:].[imagePushedAt, join(`,`, imageTags), imageDigest]' \
  --output table
```

For tags only:

```bash
aws ecr describe-images \
  --repository-name cloudbanking-backend \
  --region eu-central-1 \
  --profile cloudbanking \
  --query 'imageDetails[?imageTags!=null].imageTags[]' \
  --output table
```

---

## 28. Terminal Tried to Run URL as a Command

### Problem

Running:

```bash
https://api.cloudbanking.ameeradel.dev/health
```

returned:

```text
zsh: no such file or directory
```

### Cause

The terminal tried to execute the URL as a shell command.

### Fix

Use `curl`:

```bash
curl https://api.cloudbanking.ameeradel.dev/health
```

---

## 29. Terraform Was Run From the Wrong Directory

### Problem

Terraform returned:

```text
Error: No configuration files
```

### Cause

Terraform was run from the `frontend` directory instead of the `terraform` directory.

### Fix

Run Terraform from the directory containing `.tf` files:

```bash
cd terraform
terraform plan
```

---

## 30. `.env.production` Should Not Be Committed

### Problem

Frontend production env file appeared as untracked:

```text
frontend/.env.production
```

### Recommendation

Do not commit environment-specific `.env` files.

Add to `.gitignore`:

```gitignore
frontend/.env.production
backend/.env
backend/node_modules/
```

Create example file instead:

```bash
cp frontend/.env.production frontend/.env.production.example
```

Commit the example file, not the real environment file.

---

## 31. Node Modules Appeared in File Search

### Problem

`backend/node_modules/` appeared in project file listing.

### Recommendation

Do not commit `node_modules`.

Ensure `.gitignore` contains:

```gitignore
backend/node_modules/
frontend/node_modules/
```

If already tracked, remove from Git tracking:

```bash
git rm -r --cached backend/node_modules
git commit -m "Remove node_modules from repository"
```

---

## 32. Recommended Debugging Order

When something breaks, debug in this order:

```text
1. DNS
2. Certificate
3. ALB / Ingress
4. Service
5. Pods
6. Application logs
7. Database connectivity
8. Secrets
9. IAM permissions
```

Useful commands:

```bash
kubectl get ingress -n cloudbanking
kubectl describe ingress cloudbanking-backend-ingress -n cloudbanking
kubectl get svc -n cloudbanking
kubectl get pods -n cloudbanking
kubectl logs -n cloudbanking deployment/cloudbanking-backend --tail=100
kubectl get externalsecret -n cloudbanking
kubectl get applications -n argocd
```

---

## 33. Final Verification Commands

Backend:

```bash
curl https://api.cloudbanking.ameeradel.dev/health
curl https://api.cloudbanking.ameeradel.dev/ready
curl https://api.cloudbanking.ameeradel.dev/api/accounts
```

Kubernetes:

```bash
kubectl get pods -n cloudbanking
kubectl get ingress -n cloudbanking
kubectl describe deployment cloudbanking-backend -n cloudbanking | grep Image
```

ArgoCD:

```bash
kubectl get applications -n argocd
```

ECR:

```bash
aws ecr describe-images \
  --repository-name cloudbanking-backend \
  --region eu-central-1 \
  --profile cloudbanking \
  --query 'imageDetails[?imageTags!=null].imageTags[]' \
  --output table
```

Terraform:

```bash
cd terraform
terraform plan
```

---

## 34. Troubleshooting Summary

Most issues in the project came from:

- Wrong AWS CLI profile
- Invalid Docker image tag format
- RDS SSL requirement
- ACM certificate region mismatch
- Wrong Cloudflare DNS validation record
- Invalid Ingress certificate ARN
- Helm YAML formatting
- ArgoCD sync timing
- Running commands from the wrong directory

The project now has working:

```text
Frontend HTTPS domain
Backend HTTPS API domain
EKS backend pods
RDS PostgreSQL connection
AWS Secrets Manager integration
External Secrets Operator sync
Helm-managed Kubernetes resources
GitHub Actions image build and push
ArgoCD GitOps deployment
```