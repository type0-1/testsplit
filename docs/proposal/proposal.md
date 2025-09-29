

# School of Computing — Year 4 Project Proposal Form

## SECTION A

|                     |                                   |
|---------------------|-----------------------------------|
| Project Title:      | Retrace: Runtime Tracing & Trace Comparison |
| Student 1 Name:     | Samson Oloruntola                  |
| Student 1 ID:       | 22714745                    |
| Student 2 Name:     | Marjia Siddik                  |
| Student 2 ID:       | 22306501                    |
| Project Supervisor: | Paul Clarke                 |

---

## SECTION B

### Introduction

Modern software debugging, CI validation, and reproducibility demand better tooling to see what happened at runtime. Retrace is a developer and CI-focused tool that runs a program (script, binary, or container) in a sandbox, captures rich runtime telemetry (syscalls, Python stacks, resource usage, network connections, environment), and produces reproducible “merged” traces and interactive comparison reports that show differences between two runs (e.g., passing vs failing). The project develops a CLI + backend + dashboard that enables forensic investigation of flaky runs and improves developer productivity by making runtime behavior observable and comparable. Retrace turns guesswork into reproducible evidence so teams find and fix problems faster, spend less time re-running CI, have fewer noisy on-call pages, and get reliable audit-grade records of what happened.

### Value proposition / Benefits (measurable outcomes)

Retrace delivers operational and business benefits that can be measured during the evaluation phase. The following are the primary benefits and their expected outcomes:

1) **Faster root-cause diagnosis**  
   - Developers and SREs see exactly what the process did (syscalls) and where in code it happened (Python stacks).  
   - **Outcome:** reduce mean time to diagnose (MTTD). Realistic improvement on investigated incidents.

2) **Fewer wasted CI runs lower cost**  
   - Make flaky tests actionable instead of re-running pipelines blindly.  
   - **Outcome:** fewer reruns, direct compute cost savings; realistic reduction in reruns on flaky-heavy projects.

3) **Shorter on-call incidents & less pager noise**  
   - On-call engineers can attach and capture traces quickly; less guesswork, fewer escalations.  
   - **Outcome:** lower MTTA/MTTR and reduced on-call fatigue.

4) **Faster, safer releases**  
   - Detect environment- or timing-dependent regressions early (before release).  
   - **Outcome:** fewer rollbacks/emergency hotfixes; smoother release cadence.

5) **Prevent repeated work / fewer misdiagnoses**  
   - Concrete traces reduce back-and-forth between teams (dev, QA, SRE).  
   - **Outcome:** more developer-hours freed for feature work.

6) **Forensics & compliance**  
   - Stored traces are auditable records helpful for post-mortems and regulated environments.  
   - **Outcome:** faster audits, clearer incident post-mortems and audit-grade evidence.

7) **Better ROI for engineering time**  
   - One avoided multi-day incident or a few faster fixes per quarter already justify the tool effort.  
   - **Outcome:** measurable engineering-hours saved; cost-benefit likely positive after a small number of incidents.

These benefits are what we will aim to demonstrate during the validation phase with concrete measurements (MTTD/MTTR delta, rerun counts, CPU/time benchmarks, and user validation notes).

### Outline

Retrace will:
- Launch and manage sandboxed runs (Docker) and optionally support k8s packaging for operators.
- Attach non-intrusively to Python processes inside the sandbox using py-spy (stack sampling) and strace (syscalls).
- Capture and persist raw traces (raw strace, py-spy samples), then merge them into a unified time-aligned JSONL format (`merged.jsonl.gz`) with per-event confidence scores.
- Provide a Trace Comparison tool that compares two runs and renders an interactive HTML report showing syscall, Python stack, and resource differences.
- Offer an optional forensic mode (on-demand `pystack --native --locals`) and an optional eBPF prototype plugin for advanced kernel-level tracing (research extra).
- Provide a React dashboard to inspect timelines, individual events, and comparisons; and a CLI for scripting/automation.

### Background

Idea origins:
- Developer frustration when diagnosing flaky tests or production bugs: logs often insufficient and reproducing failures is time-consuming.
- Existing tools separately provide syscalls (`strace`), Python sampling (`py-spy`), or full native debugging (`gdb`), but few tools combine and align these layers automatically and produce comparison reports.
- Retrace builds on established research and tooling: sampling profilers, system-call tracing, and observability practices (e.g., Brendan Gregg’s eBPF work and py-spy).

### Achievements (Planned functions and users)

**Functions (planned):**
- CLI: `retrace run`, `retrace stop`, `retrace compare`, `retrace snapshot`.
- HostAgent: manage and supervise collectors (StraceCollector, PySpyCollector).
- Backend: FastAPI service exposing runs, events, and comparison endpoints; MergeWorker and CompareWorker (Celery).
- Storage: artifact store (MinIO local or compressed filesystem).
- UI: React-based timeline, event inspector, Trace Comparison view.
- Forensic snapshot: `pystack` integration with optional `--native --locals`.

**Users:**
- Developers debugging flaky tests and local failures.
- CI engineers investigating pipeline failures.
- Operators who need to capture and store forensic artifacts.

### Justification

Retrace is useful because:
- It reduces guesswork by aligning syscalls and Python stacks, making the true runtime behavior visible and actionable which reduces MTTD for real incidents.
- It enables reproducible comparisons (Trace Comparison) that help identify root causes in CI and development enabling fewer reruns and lower compute costs.
- It supports both low-cost adoption (Compose-first, local MinIO) and later production packaging (Helm for k3s/k8s) without forcing paid cloud services.
- It provides audit-grade forensic artifacts for post-mortems and compliance where required.
- These outcomes (reduced time-to-diagnose, fewer reruns, lower on-call burden, and measurable ROI) will be validated with experiments, metrics and user feedback during the project.

### Programming language(s)

- **Backend / Agent / Workers:** Python 3.11+  
- **Frontend:** React + TypeScript  
- **CLI:** Python (click / typer) or lightweight shell wrapper as appropriate

### Programming tools / Tech stack

**Runtime & Packaging**
- Docker & Docker Compose (primary)  
- Optional: k3s / kind and Helm charts (secondary packaging)

**Backend & Workers**
- FastAPI (backend API), Uvicorn  
- Celery (or RQ) + Redis for background workers  
- SQLAlchemy + Alembic (Postgres in staging, SQLite for local dev)

**Collectors & Instrumentation**
- py-spy (Python sampling profiler) default non-intrusive stack sampling  
- strace (syscall tracing) default syscall capture  
- pystack (forensic snapshots, native+locals) opt-in  
- Optional: bpftrace / BCC / libbpf for eBPF prototyping (research extra)

**Storage & Artifacts**
- MinIO (self-hosted S3-compatible) or LocalFS compressed JSONL (`merged.jsonl.gz`)  
- Object lifecycle rules (default artifact retention: 14 days)

**Frontend & Visualization**
- React + TypeScript + Vite  
- Tailwind CSS (styling), visx/d3 for timeline visualisations

**Dev & CI**
- GitHub Actions (or GitLab CI), pre-commit hooks (black, ruff, isort), mypy, pytest, hypothesis, Playwright

**Observability**
- prometheus_client, Prometheus and Grafana for graphs (performance evaluation)

**Why these choices**
- The stack gives rapid local reproducibility (Compose-first), clear separation of concerns (hexagonal architecture), and uses tooling (py-spy/strace) that is proven and safe. MinIO provides a free artifact store with an S3-compatible API so we can switch to cloud S3 later without rewriting the app. The instrumentation and metrics stack enables the measurable outcomes described in the benefits section.

### Hardware

No special hardware required for development or demo. A reasonable lab machine (or a student laptop) with:

- 4 CPU cores, 8 GB RAM recommended for running Docker Compose demo reliably.

If eBPF is prototyped, testing on a Linux host with a kernel supporting eBPF (recent kernel ≥4.9+) is required. All development can be done on normal university machines or personal laptops.

### Learning Challenges

New technologies and skills we will need to learn:

- Low-level process tracing concepts (ptrace, strace, kernel timers)
- py-spy usage and constraints (sampling, overhead)
- eBPF basics (bpftrace/BCC) optional prototype
- FastAPI and Async programming patterns (asyncio)
- Celery + Redis worker patterns and job idempotency
- React + TypeScript visualization (visx/d3)
- Docker Compose + Helm/k3s packaging
- Prometheus/Grafana for measured evaluation

### Breakdown of work

We will split responsibilities so each student owns coherent subsystems while collaborating on design, tests and docs. Both students contribute to architecture, tests, and final demo.

#### Student 1 - Samson Oloruntola (Backend & Core)
**Primary responsibilities**
- Implement domain merge/compare logi and unit/property tests (pytest + hypothesis).
- Implement FastAPI backend endpoints and worker integration (Celery) for merge/compare tasks.
- Implement storage adapter (MinIO/LocalFS) and DB models (SQLAlchemy).
- Implement comparison report generation.
- CI integration for backend tests and coverage gating.

**Deliverables**
- `backend/` code, unit tests, `examples/merged.jsonl.gz`, `examples/comparison-report.html`, `docs/technical_spec.pdf` contributions.

#### Student 2 - Marjia Siddik (Agent & Frontend)
**Primary responsibilities**
- Implement HostAgent, collectors and forensic snapshot wrapper.
- Implement frontend UI: timeline, event inspector, Trace Comparison viewer (React/TypeScript).
- Implement CLI (start/stop/compare) and integration with backend.
- Implement Compose setup and demo script, basic monitoring integration (Prometheus metrics) for performance tests.

**Deliverables**
- `agent/` code, `frontend/` app, CLI, `infra/docker-compose.yml`, demo scripts.

**Shared responsibilities**
- Documentation (operator guide, functional spec), tests for integration and E2E, demo video, and packaging (Helm skeleton). Both students will review and commit to CI and code reviews.

### Risk Register

You are to complete a risk register to demonstrate how you will account for the potential risks (i.e. something going wrong) when you are working on your project. The purpose of a risk register is to identify potential issues beforehand and plan mitigation strategies to ensure the success of the project.

| Description | Likelihood | Severity | Mitigation |
|-------------|------------|----------|------------|
| Privilege/permission denied when attaching collectors (ptrace blocked in environment) | Medium | High | Document operator install steps, require operator to run HostAgent with `--cap-add SYS_PTRACE` or use sidecar approach. Provide LocalFS fallback to still demonstrate merge/compare without attaching. |
| Demo unreliable due to large artifacts or resource exhaustion | Medium | High | Use compressed JSONL chunks, limit demo run length (e.g., 30s), provide a `make demo` script and a recorded backup video. Set reasonable resource limits in Compose. |
| eBPF prototype complexity or kernel incompatibility | Medium | Medium | Treat eBPF as optional research extra; only prototype if time permits and document kernel requirements. Fallback to py-spy+strace baseline. |
| Sensitive data leakage in forensic snapshots (locals contain secrets) | Low | High | Implement redaction rules by default (regex-based), mark forensic artifacts as `sensitive`, restrict access via RBAC, and document audit logs. |
| Time/resource constraints (underestimate implementation effort) | Medium | High | Prioritise core features (merge/compare/domain tests, Compose demo, CI) first. Keep Helm/k8s and eBPF optional. Weekly milestone tracking. |
| Storage growth and disk exhaustion due to retained artifacts | Medium | Medium | Default artifact retention 14 days, lifecycle cleanup job, encourage chunking and gzip compression. |
| CI cannot run privileged integration tests | High | Low-Medium | Keep privileged steps manual with a documented script for graders; CI will run non-privileged unit tests and linting automatically. Consider a self-hosted runner for integration if available. |

#### Samson Oloruntola
- I accept responsibility for backend/domain implementation, unit and integration tests, and CI configuration.  
- I will regularly update the progress board and ensure unit tests for the merge algorithm reach the target coverage.

#### Marjia Siddik
- I accept responsibility for HostAgent & collectors, frontend UI, CLI and Compose demo orchestration.  
- I will provide the demo script and video and ensure the Compose environment reproduces the demo reliably.
