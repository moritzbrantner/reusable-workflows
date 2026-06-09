import workflowContracts from "../../../contracts/workflows.json";
import type { AdoptionOptions, GeneratedWorkflow, PackageManager } from "./types";

type ContractPermissions = Record<string, string>;

const workflowOwner = "moritzbrantner/reusable-workflows";

export function generateAdoptionWorkflows(options: AdoptionOptions): GeneratedWorkflow[] {
  const validateWorkflow = generateValidateWorkflow(options);
  const workflows = [
    {
      path: ".github/workflows/validate.yml",
      content: validateWorkflow,
    },
  ];

  if (options.includePagesDeploy) {
    workflows.push({
      path: ".github/workflows/deploy-pages.yml",
      content: generateDeployPagesWorkflow(options),
    });
  }

  if (options.includePackagePublish) {
    workflows.push({
      path: ".github/workflows/publish-package.yml",
      content: generatePackagePublishWorkflow(options),
    });
  }

  return workflows;
}

export function combinedGeneratedWorkflowText(workflows: GeneratedWorkflow[]) {
  return workflows
    .map((workflow) => `# ${workflow.path}\n${workflow.content.trimEnd()}`)
    .join("\n\n---\n\n");
}

function generateValidateWorkflow(options: AdoptionOptions) {
  const jobs: string[] = [fastValidationJob(options)];

  if (options.profileId === "package") {
    jobs.push(integrationValidationJob(options));
  }

  if (options.includeE2e) {
    jobs.push(e2eValidationJob(options));
  }

  if (options.profileId === "component-library") {
    jobs.push(storybookValidationJob(options));
  }

  if (options.includeLinks) {
    jobs.push(linkValidationJob(options));
  }

  if (options.includePerformance) {
    jobs.push(performanceValidationJob(options));
  }

  return [
    "name: Validate",
    "",
    "on:",
    "  pull_request:",
    "  push:",
    "    branches:",
    "      - main",
    "",
    "concurrency:",
    "  group: ${{ github.workflow }}-${{ github.ref }}",
    "  cancel-in-progress: true",
    "",
    "jobs:",
    ...jobs.flatMap((job) => indentBlock(job, 2)),
    "",
  ].join("\n");
}

function generateDeployPagesWorkflow(options: AdoptionOptions) {
  return [
    "name: Deploy Pages",
    "",
    "on:",
    "  push:",
    "    branches:",
    "      - main",
    "  workflow_dispatch:",
    "",
    "concurrency:",
    "  group: pages-${{ github.ref }}",
    "  cancel-in-progress: false",
    "",
    "jobs:",
    ...indentBlock(
      reusableJob("deploy-pages", ".github/workflows/deploy-pages.yml", options, {
        permissions: permissionsFor(".github/workflows/deploy-pages.yml"),
        with: {
          install_command: installCommand(options.packageManager),
          build_command: runCommand(options.packageManager, "build"),
          artifact_path: "dist",
          ...workingDirectoryInputs(options),
        },
      }),
      2,
    ),
    "",
  ].join("\n");
}

function generatePackagePublishWorkflow(options: AdoptionOptions) {
  return [
    "name: Publish Package",
    "",
    "on:",
    "  workflow_dispatch:",
    "  release:",
    "    types:",
    "      - published",
    "",
    "jobs:",
    ...indentBlock(
      reusableJob("package-publish", ".github/workflows/package-publish.yml", options, {
        permissions: permissionsFor(".github/workflows/package-publish.yml"),
        with: {
          package_manager: "npm",
          publish_enabled: false,
          dry_run: true,
          install_command: installCommand(options.packageManager),
          ...packageManagerSetupInputs(options.packageManager),
          build_command: runCommand(options.packageManager, "build"),
          validate_command: runCommand(options.packageManager, "test:unit"),
          publish_command: publishCommand(options.packageManager),
          ...workingDirectoryInputs(options),
        },
        secrets: {
          NPM_TOKEN: "${{ secrets.NPM_TOKEN }}",
        },
      }),
      2,
    ),
    "",
  ].join("\n");
}

function fastValidationJob(options: AdoptionOptions) {
  return reusableJob("fast-validation", ".github/workflows/fast-validation.yml", options, {
    permissions: permissionsFor(".github/workflows/fast-validation.yml"),
    with: {
      install_command: installCommand(options.packageManager),
      format_command: runCommand(options.packageManager, "format:check"),
      lint_command: runCommand(options.packageManager, "lint"),
      typecheck_command: runCommand(options.packageManager, "check-types"),
      build_command: runCommand(options.packageManager, "build"),
      unit_test_command: runCommand(options.packageManager, "test:unit"),
      ...workingDirectoryInputs(options),
    },
  });
}

function integrationValidationJob(options: AdoptionOptions) {
  return reusableJob(
    "integration-validation",
    ".github/workflows/integration-validation.yml",
    options,
    {
      permissions: permissionsFor(".github/workflows/integration-validation.yml"),
      with: {
        install_command: installCommand(options.packageManager),
        integration_command: runCommand(options.packageManager, "test:integration"),
        package_check_command: packageCheckCommand(options.packageManager),
        artifact_paths: "coverage\ntest-results",
        ...workingDirectoryInputs(options),
      },
    },
  );
}

function e2eValidationJob(options: AdoptionOptions) {
  return reusableJob("e2e-validation", ".github/workflows/e2e-validation.yml", options, {
    permissions: permissionsFor(".github/workflows/e2e-validation.yml"),
    with: {
      install_command: installCommand(options.packageManager),
      build_command: runCommand(options.packageManager, "build"),
      e2e_command: e2eCommand(options.packageManager),
      install_playwright: true,
      upload_artifacts_on: "always",
      ...workingDirectoryInputs(options),
    },
  });
}

function storybookValidationJob(options: AdoptionOptions) {
  return reusableJob(
    "storybook-validation",
    ".github/workflows/storybook-validation.yml",
    options,
    {
      permissions: permissionsFor(".github/workflows/storybook-validation.yml"),
      with: {
        install_command: installCommand(options.packageManager),
        storybook_build_command: runCommand(options.packageManager, "storybook:build"),
        storybook_test_command: runCommand(options.packageManager, "test:storybook"),
        accessibility_command: runCommand(options.packageManager, "test:a11y"),
        visual_command: runCommand(options.packageManager, "test:visual"),
        upload_artifacts_on: "always",
        ...workingDirectoryInputs(options),
      },
    },
  );
}

function linkValidationJob(options: AdoptionOptions) {
  return reusableJob("link-validation", ".github/workflows/link-validation.yml", options, {
    permissions: permissionsFor(".github/workflows/link-validation.yml"),
    with: {
      install_command: installCommand(options.packageManager),
      build_command: runCommand(options.packageManager, "build"),
      start_command: `${runCommand(options.packageManager, "preview")} -- --host 127.0.0.1 --port 4173`,
      link_check_url: "http://127.0.0.1:4173",
      link_check_command:
        'bunx linkinator "$LINK_CHECK_URL" --recurse --check-fragments --skip "^mailto:" --skip "^tel:"',
      upload_artifacts_on: "failure",
      ...workingDirectoryInputs(options),
    },
  });
}

function performanceValidationJob(options: AdoptionOptions) {
  return reusableJob(
    "performance-validation",
    ".github/workflows/performance-validation.yml",
    options,
    {
      permissions: permissionsFor(".github/workflows/performance-validation.yml"),
      with: {
        install_command: installCommand(options.packageManager),
        build_command: runCommand(options.packageManager, "build"),
        benchmark_command: runCommand(options.packageManager, "bench"),
        bundle_size_command: runCommand(options.packageManager, "size:check"),
        upload_artifacts_on: "always",
        artifact_paths: "benchmark-results\nperformance-results",
        summary_paths: "benchmark-results/*.md",
        ...workingDirectoryInputs(options),
      },
    },
  );
}

function reusableJob(
  jobId: string,
  workflowPath: string,
  options: AdoptionOptions,
  config: {
    permissions: ContractPermissions;
    secrets?: Record<string, string>;
    with: Record<string, boolean | number | string>;
  },
) {
  const lines = [
    `${jobId}:`,
    `  uses: ${workflowOwner}/${workflowPath}@${options.workflowRef}`,
    "  permissions:",
    ...objectLines(config.permissions, 4),
    "  with:",
    ...objectLines(config.with, 4),
  ];

  if (config.secrets) {
    lines.push("  secrets:", ...objectLines(config.secrets, 4));
  }

  return lines.join("\n");
}

function permissionsFor(workflowPath: string): ContractPermissions {
  const contract =
    workflowContracts.workflows[workflowPath as keyof typeof workflowContracts.workflows];

  return contract.permissions;
}

function objectLines(values: Record<string, boolean | number | string>, spaces: number) {
  const padding = " ".repeat(spaces);
  const lines: string[] = [];

  for (const [key, value] of Object.entries(values)) {
    if (typeof value === "string" && value.includes("\n")) {
      lines.push(`${padding}${key}: |`);

      for (const line of value.split("\n")) {
        lines.push(`${padding}  ${line}`);
      }

      continue;
    }

    lines.push(`${padding}${key}: ${formatYamlValue(value)}`);
  }

  return lines;
}

function formatYamlValue(value: boolean | number | string) {
  if (typeof value === "boolean" || typeof value === "number") {
    return String(value);
  }

  if (value.startsWith("${{") || value === "" || /^[A-Za-z0-9_./*:-]+$/.test(value)) {
    return value || '""';
  }

  return JSON.stringify(value);
}

function workingDirectoryInputs(options: AdoptionOptions): Record<string, string> {
  if (options.workingDirectory === ".") {
    return {};
  }

  return {
    working_directory: options.workingDirectory,
    [cacheDependencyInput(options.packageManager)]: `${options.workingDirectory}/${lockfileFor(
      options.packageManager,
    )}`,
  };
}

function cacheDependencyInput(packageManager: PackageManager) {
  return packageManager === "bun" ? "bun_cache_dependency_path" : "npm_cache_dependency_path";
}

function lockfileFor(packageManager: PackageManager) {
  switch (packageManager) {
    case "bun":
      return "bun.lock";
    case "npm":
      return "package-lock.json";
    case "pnpm":
      return "pnpm-lock.yaml";
  }
}

function installCommand(packageManager: PackageManager) {
  switch (packageManager) {
    case "bun":
      return "bun install --frozen-lockfile";
    case "npm":
      return "npm ci";
    case "pnpm":
      return "pnpm install --frozen-lockfile";
  }
}

function runCommand(packageManager: PackageManager, script: string) {
  switch (packageManager) {
    case "bun":
      return `bun run ${script}`;
    case "npm":
      return `npm run ${script}`;
    case "pnpm":
      return `pnpm run ${script}`;
  }
}

function e2eCommand(packageManager: PackageManager) {
  switch (packageManager) {
    case "bun":
      return "bunx playwright test";
    case "npm":
      return "npx playwright test";
    case "pnpm":
      return "pnpm exec playwright test";
  }
}

function packageCheckCommand(packageManager: PackageManager) {
  switch (packageManager) {
    case "bun":
      return "bun pm pack --dry-run";
    case "npm":
      return "npm pack --dry-run";
    case "pnpm":
      return "pnpm pack --dry-run";
  }
}

function publishCommand(packageManager: PackageManager) {
  switch (packageManager) {
    case "bun":
      return "npm publish";
    case "npm":
      return "npm publish";
    case "pnpm":
      return "pnpm publish";
  }
}

function packageManagerSetupInputs(
  packageManager: PackageManager,
): Record<string, boolean | string> {
  if (packageManager === "bun") {
    return {
      bun_version: "1.3.14",
      cache_bun: true,
    };
  }

  return {};
}

function indentBlock(block: string, spaces: number) {
  const padding = " ".repeat(spaces);

  return block.split("\n").map((line) => `${padding}${line}`);
}
