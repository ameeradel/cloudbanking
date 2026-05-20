# CloudBanking Secrets Management

This document explains how secrets are managed in the CloudBanking project using AWS Secrets Manager, External Secrets Operator, Kubernetes Secrets, IAM, and IRSA.

---

## 1. Secrets Management Overview

CloudBanking uses AWS Secrets Manager as the central source of truth for sensitive application configuration.

The backend database credentials are stored in AWS Secrets Manager and synced into Kubernetes using External Secrets Operator.

```text
AWS Secrets Manager
↓
External Secrets Operator
↓
Kubernetes Secret
↓
Backend Pod environment variables
```

The backend application does not store secrets in code, Docker images, Kubernetes manifests, or GitHub.

---

## 2. Why Secrets Management Is Needed

The backend needs sensitive configuration to connect to the database.

Examples:

```text
DB_HOST
DB_PORT
DB_NAME
DB_USER
DB_PASSWORD
DB_SSL
```

These values should not be stored directly in:

```text
GitHub repository
Kubernetes YAML files
Docker images
Terraform tfvars committed to Git
Application source code
```

A production-style project should keep secrets outside the codebase.

---

## 3. Secret Source of Truth

The source of truth for backend database credentials is:

```text
AWS Secrets Manager
```

The secret name is:

```text
cloudbanking-dev/backend/db
```

The secret contains a JSON object:

```json
{
  "DB_HOST": "cloudbanking-dev-postgres.xxxxxx.eu-central-1.rds.amazonaws.com",
  "DB_PORT": "5432",
  "DB_NAME": "cloudbanking",
  "DB_USER": "cloudbanking_user",
  "DB_PASSWORD": "generated-password",
  "DB_SSL": "true"
}
```

---

## 4. Secret Creation with Terraform

Terraform creates the AWS Secrets Manager secret.

The database password is generated with Terraform using the `random_password` provider.

The generated password is then stored in AWS Secrets Manager.

```text
Terraform
↓
random_password
↓
AWS Secrets Manager secret
```

This avoids manually creating the database password or storing it in a local file.

---

## 5. AWS Secrets Manager Terraform Flow

The flow is:

```text
Terraform creates RDS
↓
Terraform generates DB password
↓
Terraform creates AWS Secrets Manager secret
↓
Terraform stores DB connection values in the secret
```

The secret contains the RDS endpoint and database credentials.

This makes the RDS connection information available to workloads without exposing it in Git.

---

## 6. Why Not Use Manual Kubernetes Secrets Only

A manual Kubernetes Secret can work for quick testing.

Example:

```bash
kubectl create secret generic backend-db-secret \
  -n cloudbanking \
  --from-literal=DB_PASSWORD="password"
```

But this approach has limitations:

- It is manual.
- It is not easily reproducible.
- It is not GitOps-friendly.
- It has weaker AWS-level audit visibility.
- It does not provide centralized secret management.
- Rebuilding the environment requires recreating the secret manually.

For a production-style project, AWS Secrets Manager is better as the central source of truth.

---

## 7. External Secrets Operator

External Secrets Operator runs inside the EKS cluster.

It watches Kubernetes resources such as:

```text
SecretStore
ExternalSecret
```

It reads secrets from external providers such as AWS Secrets Manager and creates normal Kubernetes Secrets inside the cluster.

```text
ExternalSecret resource
↓
External Secrets Operator
↓
Read from AWS Secrets Manager
↓
Create or update Kubernetes Secret
```

---

## 8. External Secrets Operator Is Not in the Runtime Traffic Path

External Secrets Operator does not serve application traffic.

It only syncs secrets.

Application traffic flow:

```text
Frontend
↓
ALB
↓
Backend Pod
↓
RDS
```

Secrets sync flow:

```text
AWS Secrets Manager
↓
External Secrets Operator
↓
Kubernetes Secret
```

The operator is a controller, not a request proxy.

---

## 9. Kubernetes Secret Still Exists

Using External Secrets Operator does not eliminate Kubernetes Secrets.

The final result is still a Kubernetes Secret inside the cluster.

```text
AWS Secrets Manager
↓
External Secrets Operator
↓
Kubernetes Secret
↓
Backend Pod
```

The improvement is that the Kubernetes Secret is created automatically from AWS Secrets Manager instead of being manually created or stored in Git.

---

## 10. Security Benefit

The main benefits are:

- Secrets are not committed to Git.
- Secrets are not written in Kubernetes YAML.
- Secrets are not hardcoded in application code.
- Secrets are managed centrally in AWS.
- IAM controls who can read secrets.
- Secret rotation can be added later.
- Environments can be recreated more reliably.
- GitOps remains clean because only secret references are stored in Git.

---

## 11. SecretStore

The `SecretStore` tells External Secrets Operator which external provider to use.

In this project, the provider is AWS Secrets Manager.

Example:

```yaml
apiVersion: external-secrets.io/v1
kind: SecretStore
metadata:
  name: aws-secretsmanager
  namespace: cloudbanking
spec:
  provider:
    aws:
      service: SecretsManager
      region: eu-central-1
```

This tells the operator:

```text
Use AWS Secrets Manager in eu-central-1
```

---

## 12. ExternalSecret

The `ExternalSecret` tells the operator which AWS secret to read and what Kubernetes Secret to create.

Example:

```yaml
apiVersion: external-secrets.io/v1
kind: ExternalSecret
metadata:
  name: backend-db-external-secret
  namespace: cloudbanking
spec:
  refreshInterval: 1h
  secretStoreRef:
    name: aws-secretsmanager
    kind: SecretStore
  target:
    name: backend-db-secret
    creationPolicy: Owner
  data:
    - secretKey: DB_HOST
      remoteRef:
        key: cloudbanking-dev/backend/db
        property: DB_HOST
```

This means:

```text
Read DB_HOST from AWS Secrets Manager secret cloudbanking-dev/backend/db
↓
Create DB_HOST key inside Kubernetes Secret backend-db-secret
```

---

## 13. Target Kubernetes Secret

The target Kubernetes Secret is:

```text
backend-db-secret
```

It is created in the namespace:

```text
cloudbanking
```

The backend deployment reads environment variables from this secret.

```text
backend-db-secret
├── DB_HOST
├── DB_PORT
├── DB_NAME
├── DB_USER
├── DB_PASSWORD
└── DB_SSL
```

---

## 14. Backend Deployment Secret Consumption

The backend pod reads the secret as environment variables.

Example:

```yaml
env:
  - name: DB_HOST
    valueFrom:
      secretKeyRef:
        name: backend-db-secret
        key: DB_HOST

  - name: DB_PASSWORD
    valueFrom:
      secretKeyRef:
        name: backend-db-secret
        key: DB_PASSWORD
```

The backend app receives these values through `process.env`.

---

## 15. Backend Database Connection

The backend uses the secret values to connect to PostgreSQL.

Example connection values:

```text
DB_HOST
DB_PORT
DB_NAME
DB_USER
DB_PASSWORD
DB_SSL
```

The app connects to RDS using the `pg` package.

Because RDS requires encrypted connections, the project uses:

```env
DB_SSL=true
```

---

## 16. RDS SSL Requirement

During deployment, the backend initially failed with:

```text
no pg_hba.conf entry for host "...", user "...", database "...", no encryption
```

This meant the backend tried to connect to RDS without SSL.

The fix was to add:

```env
DB_SSL=true
```

to AWS Secrets Manager and sync it through External Secrets Operator.

The backend then uses SSL when connecting to RDS.

---

## 17. IAM Permissions for External Secrets Operator

External Secrets Operator needs permission to read from AWS Secrets Manager.

The project uses IAM permissions with IRSA.

The IAM policy allows actions such as:

```text
secretsmanager:GetSecretValue
secretsmanager:DescribeSecret
```

The policy is scoped to the CloudBanking database secret.

This is better than allowing access to all secrets.

---

## 18. IRSA Flow

IRSA means IAM Roles for Service Accounts.

The External Secrets Operator service account is linked to an IAM role.

```text
Kubernetes ServiceAccount
↓
IAM Role
↓
AWS Secrets Manager permissions
```

The pod does not need AWS access keys.

Instead, it gets temporary credentials through the EKS OIDC provider.

---

## 19. External Secrets Operator IAM Flow

```text
External Secrets Operator pod
↓
Uses Kubernetes ServiceAccount
↓
Assumes IAM role through IRSA
↓
Calls AWS Secrets Manager
↓
Reads cloudbanking-dev/backend/db
↓
Creates backend-db-secret
```

This is secure and AWS-native.

---

## 20. Why IRSA Instead of Static AWS Keys

Static AWS keys inside Kubernetes are risky.

They can leak through:

```text
YAML files
Git history
Pod environment variables
Logs
Container images
```

IRSA avoids this by using temporary AWS credentials.

Benefits:

- No long-lived AWS keys in the cluster
- IAM permissions are scoped
- Access is tied to a Kubernetes service account
- Easier audit and control

---

## 21. Helm Integration

The backend Helm chart includes both:

```text
SecretStore
ExternalSecret
```

This means the application deployment includes the secret sync configuration.

Helm does not include the actual secret values.

It only includes references to AWS Secrets Manager.

Example Helm values:

```yaml
externalSecret:
  enabled: true
  secretStoreName: aws-secretsmanager
  externalSecretName: backend-db-external-secret
  targetSecretName: backend-db-secret
  refreshInterval: 1h
  awsSecretName: cloudbanking-dev/backend/db
  region: eu-central-1
```

This keeps the Helm chart safe to store in Git.

---

## 22. GitOps Compatibility

External Secrets Operator makes secrets GitOps-friendly.

Git contains:

```text
SecretStore
ExternalSecret
```

Git does not contain:

```text
DB_PASSWORD
actual credentials
secret values
```

ArgoCD can safely deploy the ExternalSecret resource.

The operator then pulls the actual secret values from AWS Secrets Manager.

---

## 23. Secret Sync Refresh

The ExternalSecret uses:

```yaml
refreshInterval: 1h
```

This means the operator checks the AWS secret regularly and syncs changes to Kubernetes.

If the secret value changes in AWS Secrets Manager, the Kubernetes Secret will be updated.

However, if the backend uses secrets as environment variables, running pods may need a restart to load the new values.

---

## 24. Environment Variable Update Behavior

When Kubernetes Secrets are consumed as environment variables:

```text
Kubernetes Secret changes
↓
Existing pod environment does not automatically change
```

To apply updated secret values, restart the deployment:

```bash
kubectl rollout restart deployment/cloudbanking-backend -n cloudbanking
```

If secrets are mounted as volumes, updates can behave differently.

This project uses environment variables for simplicity.

---

## 25. Checking ExternalSecret Status

Check ExternalSecret:

```bash
kubectl get externalsecret -n cloudbanking
```

Expected output:

```text
NAME                         STORETYPE     STORE                STATUS         READY
backend-db-external-secret   SecretStore   aws-secretsmanager   SecretSynced   True
```

Describe details:

```bash
kubectl describe externalsecret backend-db-external-secret -n cloudbanking
```

Look for:

```text
Ready=True
SecretSynced
```

---

## 26. Checking Kubernetes Secret

Check that the Kubernetes Secret exists:

```bash
kubectl get secret backend-db-secret -n cloudbanking
```

Do not print secret values unless needed.

If you need to verify keys exist:

```bash
kubectl get secret backend-db-secret -n cloudbanking -o jsonpath='{.data}' 
```

Avoid decoding and exposing secrets in logs or screenshots.

---

## 27. Checking Backend Environment Variables

Describe a backend pod:

```bash
kubectl describe pod -n cloudbanking <pod-name>
```

You should see environment variables referencing the secret:

```text
DB_HOST:      <set to the key 'DB_HOST' in secret 'backend-db-secret'>
DB_PORT:      <set to the key 'DB_PORT' in secret 'backend-db-secret'>
DB_NAME:      <set to the key 'DB_NAME' in secret 'backend-db-secret'>
DB_USER:      <set to the key 'DB_USER' in secret 'backend-db-secret'>
DB_PASSWORD:  <set to the key 'DB_PASSWORD' in secret 'backend-db-secret'>
DB_SSL:       <set to the key 'DB_SSL' in secret 'backend-db-secret'>
```

This confirms the pod is consuming the Kubernetes Secret.

---

## 28. Checking Backend Readiness

The backend readiness endpoint confirms database connectivity.

```bash
curl https://api.cloudbanking.ameeradel.dev/ready
```

Expected response:

```json
{
  "status": "ready",
  "service": "cloudbanking-backend",
  "database": "connected"
}
```

If readiness fails, check:

```bash
kubectl logs -n cloudbanking deployment/cloudbanking-backend --tail=100
```

---

## 29. Common Issue: Missing Secret Key

If the deployment expects a key that does not exist in the Kubernetes Secret, pods may fail to start.

Example:

```text
couldn't find key DB_SSL in Secret backend-db-secret
```

Fix:

1. Add the key to AWS Secrets Manager.
2. Add the key to ExternalSecret.
3. Apply Helm or ArgoCD sync.
4. Restart backend deployment if needed.

---

## 30. Common Issue: ExternalSecret Not Ready

If ExternalSecret is not ready, check:

```bash
kubectl describe externalsecret backend-db-external-secret -n cloudbanking
```

Possible causes:

- Wrong AWS secret name
- Missing IAM permissions
- Wrong AWS region
- External Secrets Operator not running
- ServiceAccount not annotated with IAM role
- AWS Secrets Manager secret does not contain the requested property

---

## 31. Common Issue: AWS Secret Name Wrong

The ExternalSecret references:

```text
cloudbanking-dev/backend/db
```

If this name does not match the actual AWS Secrets Manager secret name, sync will fail.

Check Terraform output:

```bash
cd terraform
terraform output backend_db_secret_name
```

Expected:

```text
cloudbanking-dev/backend/db
```

---

## 32. Common Issue: IAM Permission Denied

If External Secrets Operator cannot read AWS Secrets Manager, logs may show access denied.

Check operator logs:

```bash
kubectl logs -n external-secrets deployment/external-secrets --tail=100
```

The IAM policy should allow:

```text
secretsmanager:GetSecretValue
secretsmanager:DescribeSecret
```

on the required secret ARN.

---

## 33. Common Issue: RDS SSL Error

Error:

```text
no pg_hba.conf entry ... no encryption
```

Cause:

The backend attempted a non-SSL connection to RDS.

Fix:

Ensure the AWS secret includes:

```json
{
  "DB_SSL": "true"
}
```

Ensure ExternalSecret maps `DB_SSL`.

Ensure Deployment passes `DB_SSL` to the container.

---

## 34. Secret Security Considerations

Even with AWS Secrets Manager, the synced Kubernetes Secret exists inside the cluster.

Therefore:

- Restrict who can read Kubernetes Secrets.
- Use RBAC carefully.
- Avoid printing secrets in logs.
- Avoid sharing decoded secret values.
- Avoid committing `.env` files.
- Avoid putting secrets in screenshots.
- Scope IAM permissions narrowly.

External Secrets Operator improves secret management, but it does not remove the need for Kubernetes RBAC.

---

## 35. Files Related to Secrets

Relevant files:

```text
terraform/secrets-manager.tf
terraform/external-secrets.tf
helm/cloudbanking-backend/templates/external-secret.yaml
helm/cloudbanking-backend/templates/deployment.yaml
helm/cloudbanking-backend/values.yaml
```

Legacy or migration files may also exist under:

```text
k8s/secrets/
k8s/backend/
```

The Helm chart is the current application deployment source.

---

## 36. Secret Management Summary

The CloudBanking secret flow is:

```text
Terraform generates DB password
↓
Terraform stores DB credentials in AWS Secrets Manager
↓
External Secrets Operator reads the AWS secret using IRSA
↓
External Secrets Operator creates backend-db-secret in Kubernetes
↓
Backend deployment reads env vars from backend-db-secret
↓
Backend connects securely to RDS using SSL
```

This provides a production-style secret management workflow that is secure, repeatable, and GitOps-friendly.