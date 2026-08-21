# example-three-tier-application

A reference implementation of a three-tier web application: a Next.js frontend, an Express REST API, and a PostgreSQL database. It runs locally with Docker Compose and deploys to Google Cloud Platform (Cloud Run + Cloud SQL) via Terraform.

## Architecture

```
Browser → Web (Next.js :3000) → API (Express :3001) → PostgreSQL
```

| Layer | Technology | Location |
|-------|-----------|----------|
| Frontend | Next.js 16, React 19, Tailwind CSS | `src/web/` |
| API | Express 5, Node.js 22 | `src/api/` |
| Database | PostgreSQL 17 | managed by Docker / Cloud SQL |
| Migrations | node-pg-migrate | `src/db/` |
| Infrastructure | Terraform (GCP) | `src/infrastructure/` |

The app is a simple task manager (to-do list) that demonstrates how the three tiers communicate.

## Running locally with Docker Compose

### Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (or Docker Engine + Compose plugin)

### Start the stack

```bash
docker compose up --build
```

This starts four services in order:

1. **postgres** — PostgreSQL 17 database, waits until healthy
2. **migrate** — runs `node-pg-migrate up` to apply schema migrations, then exits
3. **api** — Express API on port 3001 (internal only, not exposed to the host)
4. **web** — Next.js frontend on port 3000 (exposed to host)

Once running, open [http://localhost:3000](http://localhost:3000).

### Stop and clean up

```bash
# Stop containers (keeps the postgres_data volume)
docker compose down

# Stop and delete all data
docker compose down -v
```

### Rebuild after code changes

```bash
docker compose up --build
```

### API endpoints

The API is not exposed directly to the host, but you can reach it through the web container or by temporarily mapping its port:

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Health check — returns `{ "status": "ok" }` |
| GET | `/tasks` | List all tasks, ordered by creation time |
| POST | `/tasks` | Create a task (`{ "title": "..." }`) |
| PATCH | `/tasks/:id` | Update a task (`{ "completed": true }` or `{ "title": "..." }`) |
| DELETE | `/tasks/:id` | Delete a task — returns 204 No Content |
| GET | `/api/stats/summary` | Count of each core resource (`{ "users": N, "tasks": N }`) |

## Project structure

```
.
├── .github/
│   └── workflows/
│       └── deploy.yml      # CI/CD: build images → Terraform → migrate
├── agents.md               # AI-agent usage guide for the whole repo
├── docker-compose.yml      # Local four-service stack
├── docs/                   # Lightweight change notes
└── src/
    ├── api/                # Express REST API
    │   ├── index.js        # Route handlers
    │   ├── db.js           # PostgreSQL connection pool
    │   └── Dockerfile
    ├── db/                 # Database migrations
    │   ├── migrations/     # node-pg-migrate migration files
    │   └── Dockerfile
    ├── web/                # Next.js frontend
    │   ├── app/            # App Router pages and components
    │   └── Dockerfile
    └── infrastructure/     # Terraform for GCP deployment
        ├── main.tf
        ├── migration.tf    # Cloud Run Job for DB migrations
        ├── variables.tf
        ├── outputs.tf
        └── terraform.tfvars.example
```

## Database migrations

Migrations live in `src/db/migrations/` and use [node-pg-migrate](https://salsita.github.io/node-pg-migrate/).

```bash
# Apply all pending migrations (run inside the db container or with DATABASE_URL set)
cd src/db
DATABASE_URL=postgres://app:app@localhost:5432/app npx node-pg-migrate up

# Roll back the last migration
DATABASE_URL=postgres://app:app@localhost:5432/app npx node-pg-migrate down
```

When running via Docker Compose the `migrate` service handles this automatically on startup.

> **Convention:** migrations are append-only — never edit an existing migration file; always create a new one.

## Linting the frontend

```bash
cd src/web
npm run lint   # runs ESLint via the script in src/web/package.json
```

## Deploying to GCP

The `src/infrastructure/` directory contains Terraform that provisions:

- VPC network and subnet
- Cloud SQL PostgreSQL 17 instance (private IP only)
- VPC Access Connector so Cloud Run can reach the private network
- Cloud Run services for the API and web frontend
- Cloud Run Job for database migrations (`migration.tf`)
- Secret Manager secret for the database URL
- Service accounts and IAM bindings

### Required GitHub Actions secrets

The CI/CD pipeline (`.github/workflows/deploy.yml`) requires the following repository secrets:

| Secret | Description |
|--------|-------------|
| `GCP_PROJECT_ID` | GCP project ID |
| `GCP_WORKLOAD_IDENTITY_PROVIDER` | Workload Identity Federation provider resource name |
| `GCP_SERVICE_ACCOUNT` | Service account email used by the pipeline |
| `TF_STATE_BUCKET` | GCS bucket name for Terraform remote state |

### Terraform variables

All variables are declared in `src/infrastructure/variables.tf`. Copy `src/infrastructure/terraform.tfvars.example` to `terraform.tfvars` and fill in the values (never commit `terraform.tfvars`).

| Variable | Description | Default |
|----------|-------------|---------|
| `project_id` | GCP project ID | *(required)* |
| `api_image` | Container image URI for the API (e.g. `gcr.io/PROJECT/api:TAG`) | *(required)* |
| `web_image` | Container image URI for the web frontend | *(required)* |
| `db_image` | Container image URI for the migration job | *(required)* |
| `region` | GCP region | `us-central1` |
| `app_name` | Prefix used for all resource names | `todo` |
| `environment` | `dev`, `staging`, or `prod` | `dev` |
| `db_tier` | Cloud SQL machine tier | `db-f1-micro` |
| `subnet_cidr` | CIDR range for the main subnet | `10.0.0.0/24` |
| `connector_cidr` | CIDR range for the VPC Access Connector (must be /28) | `10.0.1.0/28` |
| `api_max_instances` | Maximum Cloud Run instances for the API | `10` |
| `web_max_instances` | Maximum Cloud Run instances for the web frontend | `10` |

### Manual deployment

```bash
cd src/infrastructure
terraform init \
  -backend-config="bucket=<TF_STATE_BUCKET>" \
  -backend-config="prefix=terraform/dev"
terraform apply \
  -var="project_id=my-project" \
  -var="api_image=gcr.io/my-project/api:latest" \
  -var="web_image=gcr.io/my-project/web:latest" \
  -var="db_image=gcr.io/my-project/db:latest"
```

### Terraform outputs

| Output | Description |
|--------|-------------|
| `web_url` | Public URL of the web frontend |
| `api_url` | URL of the API service (internal traffic only) |
| `db_private_ip` | Private IP address of the Cloud SQL instance |
| `db_instance_name` | Cloud SQL instance connection name |
| `vpc_name` | Name of the VPC network |
| `service_account_email` | Email of the Cloud Run service account |
| `db_url_secret_id` | Secret Manager secret ID holding the `DATABASE_URL` |

After apply, `terraform output web_url` gives the public URL.

## CI/CD pipeline

`.github/workflows/deploy.yml` runs on every push to `main` (targeting `dev`) and on manual `workflow_dispatch` (with a choice of `dev`, `staging`, or `prod`). It has three sequential jobs:

1. **Build & Push Images** — builds and pushes the `api`, `web`, and `db` Docker images to GCR using Docker Buildx with layer caching.
2. **Terraform Apply** — runs `terraform init`, `plan`, and `apply` to provision or update GCP infrastructure.
3. **Run DB Migrations** — executes the `<app_name>-<environment>-migrate` Cloud Run Job via `gcloud run jobs execute --wait`.

GCP authentication uses [Workload Identity Federation](https://cloud.google.com/iam/docs/workload-identity-federation) (`id-token: write` permission).
