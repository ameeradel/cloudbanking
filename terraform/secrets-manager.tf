resource "aws_secretsmanager_secret" "backend_db" {
  name        = "${local.name_prefix}/backend/db"
  description = "Database credentials for CloudBanking backend"

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-backend-db-secret"
  })
}

resource "aws_secretsmanager_secret_version" "backend_db" {
  secret_id = aws_secretsmanager_secret.backend_db.id

  secret_string = jsonencode({
    DB_HOST     = split(":", aws_db_instance.postgres.endpoint)[0]
    DB_PORT     = "5432"
    DB_NAME     = aws_db_instance.postgres.db_name
    DB_USER     = aws_db_instance.postgres.username
    DB_PASSWORD = random_password.db_password.result
    DB_SSL      = "true"
  })
}