import workflowContracts from "../../../contracts/workflows.json";
import type { AdoptionOptions, AdoptionProfile, AdoptionProfileId, PackageManager } from "./types";

const defaultWorkflowRef = workflowContracts.workflow_standard;

const baseOptions: AdoptionOptions = {
  profileId: "web-app",
  packageManager: "bun",
  workflowRef: defaultWorkflowRef,
  workingDirectory: ".",
  includeE2e: true,
  includeLinks: true,
  includePerformance: false,
  includePagesDeploy: false,
  includePackagePublish: false,
};

export const adoptionProfiles: AdoptionProfile[] = [
  {
    id: "web-app",
    label: "Web app",
    description:
      "Fast PR validation with deeper link and optional E2E coverage after merge or on demand.",
    options: { ...baseOptions },
  },
  {
    id: "monorepo-web-app",
    label: "Monorepo web app",
    description:
      "Scoped fast PR validation for `apps/web`, with deeper checks after merge or on demand.",
    options: {
      ...baseOptions,
      profileId: "monorepo-web-app",
      workingDirectory: "apps/web",
    },
  },
  {
    id: "component-library",
    label: "Component library",
    description:
      "Fast PR validation plus post-merge/on-demand Storybook, interaction, accessibility, and visual hooks.",
    options: {
      ...baseOptions,
      profileId: "component-library",
      includeE2e: false,
      includeLinks: false,
    },
  },
  {
    id: "package",
    label: "Package",
    description:
      "Fast PR validation with post-merge package checks and a gated publish workflow starter.",
    options: {
      ...baseOptions,
      profileId: "package",
      includeE2e: false,
      includeLinks: false,
      includePackagePublish: true,
    },
  },
  {
    id: "pages-site",
    label: "Pages site",
    description:
      "Fast PR validation with post-merge link checks and a separate Pages deployment workflow.",
    options: {
      ...baseOptions,
      profileId: "pages-site",
      includeE2e: false,
      includePagesDeploy: true,
    },
  },
];

export const packageManagers: Array<{ id: PackageManager; label: string }> = [
  { id: "bun", label: "Bun" },
  { id: "npm", label: "npm" },
  { id: "pnpm", label: "pnpm" },
];

export function adoptionProfileById(profileId: AdoptionProfileId) {
  return adoptionProfiles.find((profile) => profile.id === profileId) ?? adoptionProfiles[0];
}

export function defaultAdoptionOptions(profileId: AdoptionProfileId = "web-app") {
  return { ...adoptionProfileById(profileId).options };
}
