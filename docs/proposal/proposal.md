# School of Computing — Year 4 Project Proposal Form

## SECTION A

**Project Title:** TestSplit  
**Student 1 Name:** Samson Oloruntola  
**Student 1 ID:** 22714745  
**Student 2 Name:** Marjia Siddik  
**Student 2 ID:** 22306501  
**Project Supervisor:** Paul Clarke

---

## SECTION B

### 1. Introduction
Continuous integration (CI) pipelines suffer from long execution times as unit test suites grow, blocking developer productivity. TestSplit analyses unit test performance to identify bottlenecks and automatically generate optimised parallel execution strategies. The project will deliver a CLI tool, backend service, and web dashboard to help teams reduce CI wait times through intelligent test distribution and historical performance tracking.

### 2. Outline
- Parse unit test framework output (JUnit XML, Jest JSON)
- Profile execution times and store historical performance data
- Implement the Longest Processing Time (LPT) scheduling algorithm to generate optimal test splits across parallel jobs
- Provide a backend API for data persistence and analytics
- Web dashboard to visualise performance trends and display optimisation metrics
- Generate optimised CI configuration files (GitHub Actions YAML, GitLab CI YAML)
- Validate on 10+ open source repositories and measure speedup and algorithm effectiveness

### 3. Background
The project originates from developer frustration with CI pipelines where unit tests block pull requests. Existing CI platforms provide basic parallelisation but lack intelligent distribution based on execution times. While commercial tools offer analysis features, there is no open-source tool that combines execution time profiling, automatic parallel configuration generation, and historical performance tracking in a single integrated solution. This project applies the Longest Processing Time (LPT) scheduling algorithm [Graham, 1969], which provides a 4/3-approximation guarantee for makespan minimisation.

### 4. Core Functions

#### Phase A — Core Functionality
- Parse `JUnit XML` and `Jest JSON` test output formats
- Profile test execution times and store historical data in `PostgreSQL`
- Implement the Longest Processing Time (LPT) scheduling algorithm for optimal test distribution
- Generate optimized CI configuration files (`GitHub Actions` YAML, `GitLab CI` YAML)
- Provide CLI commands (examples: `profile`, `generate-config`)
- Expose a REST API for storing test runs and retrieving analytics
- Web dashboard: performance overview page and trend graphs (execution time over time)
- GitHub OAuth authentication for the dashboard
- Validate on 10+ repositories with statistical analysis

#### Phase B — Enhanced Features (Afte core features)
- Advanced visualizations (job timeline, distribution analysis)
- Comprehensive statistical analysis and reporting
- Comparison against a naive parallelization baseline
- Performance recommendations based on historical trends

#### Phase C — Optional Enhancements
- Simple flaky test detection (heuristics)
- GitLab CI integration for automated data collection
- Export functionality for reports

### 5. Target Users
- Software developers reducing CI wait times  
- DevOps engineers optimizing test infrastructure  
- Team leads monitoring test suite health

### 6. Justification
Unit test suites are a common CI bottleneck and can represent a significant portion of total test execution time. Reducing test run times improves developer productivity. The tool provides optimisation recommendations and long-term performance management through trend tracking. Validation across multiple repositories with statistical analysis will demonstrate effectiveness.

### 7. Programming Languages
- CLI, backend, analysis engine: Node.js with TypeScript  
- Frontend dashboard: React with TypeScript

### 8. Tech Stack

**CLI & Backend**
- Commander.js, chalk, cli-table3  
- Fastify, Prisma, PostgreSQL  
- octokit (GitHub OAuth), Zod, tslog  
- fast-xml-parser, js-yaml  
- simple-statistics (flaky detection)

**Frontend**
- React 18, Vite, React Router  
- Tailwind CSS, shadcn/ui (components & charts)  
- React Query, Zustand (state management)

**Development & Deployment**
- Jest (backend tests), Vitest (frontend tests)  
- ESLint, Prettier, Husky (Git hooks)  
- Docker  
- GitLab (CI/CD and project hosting)  
- Vercel (frontend), Railway (backend + DB)  
- npm (CLI distribution)

### 9. Hardware
Standard development machines with modest resources. Internet access required for GitHub API. Cloud hosting uses free tiers for demos.

### 10. Learning Challenges
- Implementing and validating the LPT scheduling algorithm  
- Parsing diverse testing frameworks (Jest JSON, JUnit XML)  
- Generating valid CI/CD pipeline configurations programmatically  
- Implementing OAuth authentication with GitHub  
- Designing an efficient database schema for time-series data storage  
- Frontend state management with React Query

### 11. Breakdown of Work

Both students collaborate on architecture, integration testing, and documentation.

| Component | Student 1 (Backend & Analysis) | Student 2 (Frontend & Integration) |
|---|---|---|
| Parsers & Algorithm | Primary: Implement JUnit XML and Jest JSON parsers with validation. Primary: Design and implement LPT scheduling algorithm with performance analysis. | Support: Test parsers on sample data and provide feedback on edge cases. |
| Backend API | Primary: Build Fastify server with REST endpoints for test runs and analytics. Implement GitHub OAuth backend with octokit-oauth. Configure GitLab CI/CD for backend. | Support: Test API endpoints and provide frontend requirements for data formats. |
| Database | Primary: Design PostgreSQL schema with Prisma for test runs and results. Implement indexes and migrations. | Support: Provide frontend query requirements and test data retrieval performance. |
| Config Generation | Primary: Implement YAML generation for GitHub Actions and GitLab CI. Validate syntax with schema validators. | Support: Test generated configs on sample repositories. |
| CLI Tool | Support: Provide backend integration and test CLI commands. | Primary: Implement CLI commands (`profile`, `generate-config`) with clear output, error handling, and progress indicators. |
| Dashboard | Support: Build analytics endpoints and provide data for visualizations. | Primary: Build React dashboard with overview and trend charts. Implement GitHub OAuth frontend and configure GitLab CI/CD for frontend. |
| Validation | Support: Provide analysis tools and assist with statistics. | Primary: Test tool on 10+ repositories and conduct statistical analysis. Document methodology and results. |
| Testing | Primary: Write comprehensive unit tests for backend and algorithm. | Primary: Write tests for CLI and frontend. |
| Documentation | Deliverable: Algorithm documentation (design decisions, complexity analysis) and API specification (OpenAPI). | Deliverable: Validation report, user documentation (installation, usage, troubleshooting). |

### 12. Risk Register

| Risk | Likelihood | Severity | Mitigation |
|---|---|---|---|
| Inconsistent test framework outputs | Medium | High | Focus on JUnit XML and Jest JSON. Add validation, handle version errors, document supported formats. |
| Dashboard takes longer than expected | High | High | Use shadcn/ui for speed. Prioritise core views and collaborate if delays occur. |
| LPT algorithm produces poor job balance | Medium | Medium | Test on varied suites, compare with baseline, allow manual job override. |
| Low speedup prediction accuracy | Medium | High | Validate on multiple repos, use conservative estimates, refine models. |
| Insufficient open-source repos for validation | Low | Medium | Identify candidates early. Use synthetic data if needed. |
| GitHub API rate limits or OAuth issues | Medium | Medium | Use authenticated requests, caching, and provide offline demo mode. |
| Generated CI configs fail | Medium | High | Validate YAML syntax, test on forks, include rollback instructions. |
| Integration failures (CLI, backend, dashboard) | Medium | High | Define clear API contracts, share types, and run regular integration tests. |
| Time constraints limit feature completion | High | High | Prioritise CLI + backend + basic dashboard. Defer optional features. |
| Database performance degradation | Low | Medium | Add indexes, pagination, and a data retention policy. |

---

### Signatures

**Samson Oloruntola**  
I accept responsibility for backend, algorithms, and database. I will ensure thorough test coverage and provide a stable backend API early for frontend development.

**Marjia Siddik**  
I accept responsibility for CLI, dashboard, and integration. I will validate on multiple repositories and produce user documentation and demo materials.

### References
- Graham, R. L. (1969). Bounds on multiprocessing timing anomalies. SIAM Journal on Applied Mathematics, 17(2), 416–429.