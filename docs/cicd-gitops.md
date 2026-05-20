# CloudBanking CI/CD and GitOps

This document explains the CI/CD and GitOps workflow used in the CloudBanking project.

The project uses:

- GitHub Actions for CI
- Amazon ECR for Docker image storage
- Helm for Kubernetes application packaging
- ArgoCD for GitOps-based deployment to EKS

---

## 1. CI/CD Overview

CloudBanking uses a GitOps-based CI/CD model.

```text
Developer pushes code
↓
GitHub Actions builds Docker image
↓
Image is pushed to Amazon ECR
↓
GitHub Actions updates Helm image tag
↓
Change is pushed to GitHub
↓
ArgoCD detects Git change
↓
ArgoCD syncs Helm chart to EKS
↓
Kubernetes rolls out new backend pods
```

GitHub Actions handles building and publishing images.

ArgoCD handles deployment.

This separation keeps the deployment process Git-driven and production-style.

---

## 2. Tool Responsibilities

| Tool | Responsibility |
|---|---|
| GitHub Actions | Build backend image and push it to ECR |
| Amazon ECR | Store backend Docker images |
| Helm | Package Kubernetes backend resources |
| ArgoCD | Sync Helm chart from Git to EKS |
| Kubernetes | Run backend pods and perform rolling updates |
| GitHub | Source of truth for application desired state |

---

## 3. Why GitOps

GitOps means Git is the source of truth for application deployment.

Instead of manually running:

```bash
kubectl apply
```

or:

```bash
helm upgrade
```

ArgoCD watches the Git repository and applies the desired state automatically.

```text
Git desired state
↓
ArgoCD
↓
Kubernetes live state
```

If the cluster drifts away from Git, ArgoCD can detect and fix it.

---

## 4. Backend CI Flow

When backend code changes are pushed to GitHub, the backend CI workflow runs.

The workflow steps are:

```text
Checkout repository
↓
Configure AWS credentials using GitHub OIDC
↓
Login to Amazon ECR
↓
Create image tag from Git commit SHA
↓
Build Docker image
↓
Tag image for ECR
↓
Push image to ECR
↓
Update Helm values image tag
↓
Commit and push updated values.yaml
```

This makes the new backend image available and also updates the deployment desired state in Git.

---

## 5. GitHub Actions Trigger

The workflow runs on pushes to:

```text
main
feature/**
```

It only runs when relevant files change:

```text
backend/**
.github/workflows/backend-ci.yml
```

This prevents unnecessary builds when unrelated files are changed.

Example trigger:

```yaml
on:
  push:
    branches:
      - main
      - feature/**
    paths:
      - "backend/**"
      - ".github/workflows/backend-ci.yml"
```

---

## 6. GitHub Actions Permissions

The workflow needs two important permissions:

```yaml
permissions:
  id-token: write
  contents: write
```

### `id-token: write`

Required for GitHub OIDC authentication with AWS.

This allows GitHub Actions to request an OIDC token and assume an AWS IAM role.

### `contents: write`

Required because the workflow updates `helm/cloudbanking-backend/values.yaml` and commits the updated image tag back to Git.

---

## 7. AWS Authentication with GitHub OIDC

The workflow does not use static AWS access keys.

Instead, it uses GitHub OIDC.

```text
GitHub Actions
↓
OIDC token
↓
AWS STS
↓
Assume IAM Role
↓
Temporary AWS credentials
```

This is safer than storing long-lived AWS keys in GitHub Secrets.

---

## 8. IAM Role for GitHub Actions

Terraform creates an IAM role for GitHub Actions.

The role allows GitHub Actions to push Docker images to ECR.

The trust policy allows the GitHub repository to assume the role using OIDC.

The role is scoped to:

```text
repo:ameeradel/cloudbanking:*
```

This means only this repository can use the role.

---

## 9. ECR Permissions

The GitHub Actions IAM policy allows the workflow to push images to ECR.

Required actions include:

```text
ecr:GetAuthorizationToken
ecr:BatchCheckLayerAvailability
ecr:CompleteLayerUpload
ecr:DescribeRepositories
ecr:InitiateLayerUpload
ecr:PutImage
ecr:UploadLayerPart
ecr:BatchGetImage
```

The repository is:

```text
cloudbanking-backend
```

---

## 10. Docker Image Build

The workflow builds the backend image from the backend directory.

```bash
docker build \
  -t cloudbanking-backend:<commit-sha> \
  -t cloudbanking-backend:latest \
  ./backend
```

The image receives two tags:

```text
latest
short Git commit SHA
```

Example:

```text
latest
4ec6555
```

---

## 11. Image Tagging Strategy

The main deployment tag is the short Git commit SHA.

Example image:

```text
777208093235.dkr.ecr.eu-central-1.amazonaws.com/cloudbanking-backend:4ec6555
```

This makes deployments traceable.

You can identify exactly which Git commit is running in EKS.

The `latest` tag is also pushed, but the Helm deployment uses the commit SHA tag.

---

## 12. Push Image to ECR

After building the Docker image, the workflow tags it with the ECR registry URI.

```text
AWS_ACCOUNT_ID.dkr.ecr.eu-central-1.amazonaws.com/cloudbanking-backend:<tag>
```

Then it pushes the image to ECR.

```bash
docker push $ECR_REGISTRY/$ECR_REPOSITORY:<commit-sha>
docker push $ECR_REGISTRY/$ECR_REPOSITORY:latest
```

---

## 13. Verify ECR Images

Images can be checked from the CLI.

```bash
aws ecr describe-images \
  --repository-name cloudbanking-backend \
  --region eu-central-1 \
  --profile cloudbanking \
  --query 'imageDetails[?imageTags!=null].imageTags[]' \
  --output table
```

To check a specific tag:

```bash
aws ecr describe-images \
  --repository-name cloudbanking-backend \
  --image-ids imageTag=4ec6555 \
  --region eu-central-1 \
  --profile cloudbanking
```

---

## 14. Updating Helm Values

After pushing the new image, GitHub Actions updates:

```text
helm/cloudbanking-backend/values.yaml
```

The workflow changes:

```yaml
image:
  tag: old-tag
```

to:

```yaml
image:
  tag: new-commit-sha
```

Example:

```yaml
image:
  repository: 777208093235.dkr.ecr.eu-central-1.amazonaws.com/cloudbanking-backend
  tag: 4ec6555
  pullPolicy: Always
```

---

## 15. Why Update Helm Values

ArgoCD deploys what is stored in Git.

If a new image is pushed to ECR but Git is not updated, ArgoCD has no reason to deploy anything new.

The important flow is:

```text
New image in ECR
+
Updated image tag in Git
↓
ArgoCD deploys new version
```

Without the Git change, ArgoCD will keep the existing deployment state.

---

## 16. Commit Back to Git

After updating the Helm values file, the workflow commits the change back to Git.

Example commit message:

```text
Update backend image tag to 4ec6555 [skip ci]
```

The `[skip ci]` part prevents unnecessary CI loops.

The workflow also avoids triggering itself again because it only runs on changes to:

```text
backend/**
.github/workflows/backend-ci.yml
```

A change to `helm/cloudbanking-backend/values.yaml` alone does not trigger the backend CI workflow.

---

## 17. ArgoCD Application

ArgoCD watches the backend Helm chart.

```text
Repository: https://github.com/ameeradel/cloudbanking.git
Branch: main
Path: helm/cloudbanking-backend
Destination: EKS / cloudbanking namespace
```

The ArgoCD Application is stored in:

```text
argocd/cloudbanking-backend-app.yaml
```

---

## 18. ArgoCD Sync Flow

When GitHub Actions pushes the updated Helm values file:

```text
GitHub receives new commit
↓
ArgoCD detects new revision
↓
ArgoCD renders Helm chart
↓
ArgoCD compares desired state with cluster state
↓
ArgoCD applies the changes
↓
Kubernetes rolls out the new image
```

This completes the continuous delivery process.

---

## 19. ArgoCD Sync Status

Check ArgoCD status:

```bash
kubectl get applications -n argocd
```

Expected:

```text
NAME                   SYNC STATUS   HEALTH STATUS
cloudbanking-backend   Synced        Healthy
```

This means the live cluster state matches the Git desired state.

---

## 20. Check ArgoCD Revision

Check which Git revision ArgoCD has synced:

```bash
kubectl get application cloudbanking-backend -n argocd \
  -o jsonpath='{.status.sync.revision}{"\n"}'
```

Compare it with the latest commit on main:

```bash
git rev-parse origin/main
```

If both match, ArgoCD has synced the latest Git revision.

---

## 21. Kubernetes Rollout

When ArgoCD applies a new image tag, Kubernetes performs a rolling update.

```text
New ReplicaSet created
↓
New pods start
↓
Readiness probes run
↓
Traffic moves to ready pods
↓
Old pods terminate
```

Check pods:

```bash
kubectl get pods -n cloudbanking
```

Check deployment image:

```bash
kubectl describe deployment cloudbanking-backend -n cloudbanking | grep Image
```

Expected:

```text
Image: 777208093235.dkr.ecr.eu-central-1.amazonaws.com/cloudbanking-backend:<commit-sha>
```

---

## 22. Validate API After Deployment

After the rollout finishes, test the API.

```bash
curl https://api.cloudbanking.ameeradel.dev/health
```

```bash
curl https://api.cloudbanking.ameeradel.dev/ready
```

```bash
curl https://api.cloudbanking.ameeradel.dev/api/accounts
```

Expected:

- `/health` returns `status: ok`
- `/ready` returns database connected
- `/api/accounts` returns JSON data

---

## 23. Full CI/CD Flow Diagram

```text
Developer
↓
Push backend code to GitHub
↓
GitHub Actions
↓
Build Docker image
↓
Push image to ECR
↓
Update Helm values image.tag
↓
Commit values.yaml change
↓
GitHub main branch updated
↓
ArgoCD detects new Git revision
↓
ArgoCD syncs Helm chart
↓
Kubernetes rolling update
↓
Backend pods run new image
↓
ALB routes traffic to ready pods
```

---

## 24. Why ArgoCD Does Not Pull From ECR Directly

ArgoCD does not watch ECR in this setup.

ArgoCD watches Git.

This is intentional.

```text
ECR = stores image artifacts
Git = stores desired deployment state
ArgoCD = syncs Git state to Kubernetes
```

Pushing an image to ECR alone does not trigger deployment.

Updating Git triggers deployment.

---

## 25. Why Not Deploy Directly From GitHub Actions

GitHub Actions could run:

```bash
kubectl apply
```

or:

```bash
helm upgrade
```

But this project uses ArgoCD instead.

Reasons:

- Git remains the source of truth
- Deployment history is visible in Git
- ArgoCD detects drift
- ArgoCD can self-heal
- Cluster credentials do not need to be stored in GitHub Actions
- The CD flow is Kubernetes-native and production-style

GitHub Actions builds artifacts.

ArgoCD deploys desired state.

---

## 26. Self-Healing

ArgoCD can self-heal cluster drift.

If someone manually changes the deployment replicas:

```bash
kubectl scale deployment cloudbanking-backend -n cloudbanking --replicas=1
```

ArgoCD detects that live state differs from Git and restores the desired value.

If Git says:

```yaml
replicaCount: 2
```

ArgoCD brings the deployment back to 2 replicas.

---

## 27. Pruning

The ArgoCD Application uses pruning.

Pruning means:

```text
If a resource is removed from Git
↓
ArgoCD removes it from the cluster
```

This prevents old resources from staying in the cluster after they are deleted from the Helm chart.

---

## 28. Rollback Strategy

Because image tags are Git commit SHAs, rollback is simple.

Option 1: revert the commit that updated the image tag.

```bash
git revert <commit>
git push
```

ArgoCD detects the revert and deploys the previous image tag.

Option 2: manually change `values.yaml` back to a previous tag.

```yaml
image:
  tag: previous-sha
```

Then commit and push.

ArgoCD syncs the previous image.

---

## 29. Debugging GitHub Actions

Check workflow runs in GitHub:

```text
Repository
↓
Actions
↓
Backend CI - Build, Push, and Update Helm
```

Common issues:

- IAM role trust policy is wrong
- OIDC permissions are missing
- ECR permissions are missing
- Docker build fails
- GitHub token does not have content write permissions
- Workflow updates Helm tag but cannot push

---

## 30. Debugging ECR

List image tags:

```bash
aws ecr describe-images \
  --repository-name cloudbanking-backend \
  --region eu-central-1 \
  --profile cloudbanking \
  --query 'imageDetails[?imageTags!=null].imageTags[]' \
  --output table
```

Check a specific image tag:

```bash
aws ecr describe-images \
  --repository-name cloudbanking-backend \
  --image-ids imageTag=<tag> \
  --region eu-central-1 \
  --profile cloudbanking
```

If the image does not exist, the workflow did not push it successfully.

---

## 31. Debugging ArgoCD

Check application:

```bash
kubectl get applications -n argocd
```

Get detailed application YAML:

```bash
kubectl get application cloudbanking-backend -n argocd -o yaml
```

Check source configuration:

```bash
kubectl get application cloudbanking-backend -n argocd \
  -o jsonpath='{.spec.source.repoURL}{"\n"}{.spec.source.targetRevision}{"\n"}{.spec.source.path}{"\n"}'
```

Check synced revision:

```bash
kubectl get application cloudbanking-backend -n argocd \
  -o jsonpath='{.status.sync.revision}{"\n"}'
```

Force refresh:

```bash
kubectl annotate application cloudbanking-backend -n argocd \
  argocd.argoproj.io/refresh=hard \
  --overwrite
```

---

## 32. Debugging Deployment Image

If ArgoCD is synced but the deployment still uses an old image, check:

```bash
kubectl describe deployment cloudbanking-backend -n cloudbanking | grep Image
```

Check Helm values in Git:

```bash
grep -A 4 "image:" helm/cloudbanking-backend/values.yaml
```

Check ArgoCD synced revision:

```bash
kubectl get application cloudbanking-backend -n argocd \
  -o jsonpath='{.status.sync.revision}{"\n"}'
```

If ArgoCD is synced to the latest Git revision, the deployment image should match the Helm values.

---

## 33. Common Issue: ArgoCD Synced But Image Still Old

Possible causes:

- ArgoCD has not synced yet
- ArgoCD is watching a different branch
- ArgoCD is watching a different path
- Helm values were updated in a feature branch, but ArgoCD watches main
- The deployment rollout is still in progress

Check:

```bash
kubectl get application cloudbanking-backend -n argocd \
  -o jsonpath='{.spec.source.targetRevision}{"\n"}'
```

Expected:

```text
main
```

---

## 34. Common Issue: Pipeline Pushes Image But No Deployment Happens

This means ECR was updated, but Git desired state was not updated.

Check whether `values.yaml` changed:

```bash
git pull
grep -A 4 "image:" helm/cloudbanking-backend/values.yaml
```

If the tag did not change, GitHub Actions did not commit the new tag.

Check the workflow logs.

---

## 35. Common Issue: GitHub Actions Creates a Loop

To avoid loops, the auto-generated commit uses:

```text
[skip ci]
```

Also, the workflow path filter only triggers on:

```text
backend/**
.github/workflows/backend-ci.yml
```

So changes to Helm values do not trigger the build workflow again.

---

## 36. Security Considerations

The pipeline avoids static AWS credentials.

Security choices:

- GitHub OIDC instead of AWS access keys
- IAM role scoped to this repository
- IAM policy scoped to ECR push permissions
- ArgoCD deploys from Git instead of GitHub Actions accessing the cluster
- Secrets are not stored in GitHub Actions variables
- Database credentials remain in AWS Secrets Manager

---

## 37. Current Status

Current CI/CD status:

```text
GitHub Actions builds backend image
↓
Image pushed to ECR
↓
Helm values updated with Git SHA image tag
↓
ArgoCD detects the Git change
↓
Backend deployed to EKS
↓
Application status Synced and Healthy
```

This means the CloudBanking backend has a working CI/CD GitOps pipeline.

---

## 38. Future Improvements

Possible improvements:

- Add frontend deployment pipeline
- Add automated CloudFront invalidation
- Add integration tests before pushing images
- Add vulnerability scanning for Docker images
- Add approval gates for production deployment
- Add ArgoCD Image Updater
- Add separate staging and production ArgoCD Applications
- Add Slack or email deployment notifications
- Add automated rollback workflow