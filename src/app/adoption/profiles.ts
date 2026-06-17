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
    description: "PR validation for a routed app with unit, link, and optional e2e coverage.",
    options: { ...baseOptions },
  },
  {
    id: "monorepo-web-app",
    label: "Monorepo web app",
    description: "Scoped validation for an app in `apps/web` with matching cache paths.",
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
      "Fast validation plus Storybook build, interaction, accessibility, and visual hooks.",
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
    description: "Package validation with a gated publish workflow starter.",
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
      "Static site validation with link checks and a separate Pages deployment workflow.",
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
