# Zowe Remote SSH VSCE Benchmarks

This directory contains performance benchmarks comparing the traditional z/OSMF REST APIs against the new native SSH APIs.

The benchmarks are built on top of [Vitest Bench](https://vitest.dev/guide/features/benchmark.html) to measure execution times for various common Zowe Explorer operations.

## Prerequisites

Before running the benchmarks, you must have Zowe default profiles configured for both **z/OSMF** and **SSH**.

The test suite automatically picks up your default profiles using the `@zowe/zowe-explorer-api` framework. Ensure you have working default `zosmf` and `ssh` profiles set up on your machine that point to the same system for a valid comparison.

## Current Benchmarks

The following categories of APIs are currently benchmarked (each run against both z/OSMF and SSH targets):

- Data sets (`SshMvsApi.bench.ts`)
- USS files (`SshUssApi.bench.ts`)
- JES jobs (`SshJesApi.bench.ts`)

## How to Run

To run all benchmarks, navigate to the `packages/vsce` directory and execute the bench script:

```bash
cd packages/vsce && npm run bench
```

Alternatively, you can run Vitest Bench directly using `npx`:

```bash
npx vitest bench
```

To run a specific benchmark file, pass its path to the command:

```bash
npx vitest bench benchmarks/SshMvsApi.bench.ts
```
