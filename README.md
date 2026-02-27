# TestSplit

A CLI tool that parallelises Maven/JUnit test suites across CI jobs using the LPT (Longest Processing Time) scheduling algorithm, reducing pipeline wait times.

## Overview

TestSplit takes JUnit XML output from Maven Surefire, profiles each test's execution time, and uses LPT scheduling to distribute tests optimally across N parallel CI jobs, resulting is a GitHub Actions or GitLab CI configuration that can reduce total pipeline duration.

## Authors

- Samson Oloruntola (22714745)
- Marjia Siddik (22306501)

Supervisor: Paul Clarke - DCU CSC1097 - 2025/2026
