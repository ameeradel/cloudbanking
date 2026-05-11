resource "aws_iam_policy" "external_secrets" {
  name        = "${local.name_prefix}-external-secrets-policy"
  description = "Allow External Secrets Operator to read CloudBanking backend DB secret from AWS Secrets Manager"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "secretsmanager:GetSecretValue",
          "secretsmanager:DescribeSecret"
        ]
        Resource = [
          aws_secretsmanager_secret.backend_db.arn
        ]
      }
    ]
  })
}

resource "aws_iam_role" "external_secrets" {
  name = "${local.name_prefix}-external-secrets-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Principal = {
          Federated = aws_iam_openid_connect_provider.eks.arn
        }
        Action = "sts:AssumeRoleWithWebIdentity"
        Condition = {
          StringEquals = {
            "${replace(aws_eks_cluster.main.identity[0].oidc[0].issuer, "https://", "")}:aud" = "sts.amazonaws.com"
            "${replace(aws_eks_cluster.main.identity[0].oidc[0].issuer, "https://", "")}:sub" = "system:serviceaccount:external-secrets:external-secrets-sa"
          }
        }
      }
    ]
  })

  tags = local.common_tags
}

resource "aws_iam_role_policy_attachment" "external_secrets" {
  role       = aws_iam_role.external_secrets.name
  policy_arn = aws_iam_policy.external_secrets.arn
}

resource "kubernetes_namespace" "external_secrets" {
  metadata {
    name = "external-secrets"
  }
}

resource "helm_release" "external_secrets" {
  name       = "external-secrets"
  namespace  = kubernetes_namespace.external_secrets.metadata[0].name
  repository = "https://charts.external-secrets.io"
  chart      = "external-secrets"

  set {
    name  = "installCRDs"
    value = "true"
  }

  set {
    name  = "serviceAccount.create"
    value = "true"
  }

  set {
    name  = "serviceAccount.name"
    value = "external-secrets-sa"
  }

  set {
    name  = "serviceAccount.annotations.eks\\.amazonaws\\.com/role-arn"
    value = aws_iam_role.external_secrets.arn
  }

  depends_on = [
    aws_iam_role_policy_attachment.external_secrets
  ]
}