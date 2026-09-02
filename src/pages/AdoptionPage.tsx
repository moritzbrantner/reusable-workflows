import { ArrowLeft, ClipboardCheck, FileCode2 } from "lucide-react";
import { useMemo, useState } from "react";

import { adoptionProfileById, adoptionProfiles, packageManagers } from "../app/adoption/profiles";
import { checkAdoptionYaml } from "../app/adoption/check";
import { combinedGeneratedWorkflowText, generateAdoptionWorkflows } from "../app/adoption/generate";
import type { AdoptionOptions, AdoptionProfileId, PackageManager } from "../app/adoption/types";
import { homeHref } from "../app/routes";
import {
  Badge,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CodeBlock,
  CodeBlockCode,
  CodeBlockContent,
  Stat,
  StatDescription,
  StatValue,
} from "../components/ui";
import { SiteHeader } from "../components/SiteHeader";

export function AdoptionPage() {
  const [options, setOptions] = useState<AdoptionOptions>(adoptionProfiles[0].options);
  const [auditYaml, setAuditYaml] = useState("");
  const generatedWorkflows = useMemo(() => generateAdoptionWorkflows(options), [options]);
  const generatedWorkflowText = useMemo(
    () => combinedGeneratedWorkflowText(generatedWorkflows),
    [generatedWorkflows],
  );
  const diagnostics = useMemo(
    () => (auditYaml.trim() ? checkAdoptionYaml(auditYaml).diagnostics : []),
    [auditYaml],
  );
  const warnings = diagnostics.filter((diagnostic) => diagnostic.level === "warning");
  const errors = diagnostics.filter((diagnostic) => diagnostic.level === "error");

  function updateOption<T extends keyof AdoptionOptions>(key: T, value: AdoptionOptions[T]) {
    setOptions((current) => ({ ...current, [key]: value }));
  }

  function selectProfile(profileId: AdoptionProfileId) {
    const profile = adoptionProfileById(profileId);

    setOptions((current) => ({
      ...profile.options,
      packageManager: current.packageManager,
      workflowRef: current.workflowRef,
    }));
  }

  return (
    <>
      <SiteHeader />
      <main id="top">
        <section className="workflow-hero adoption-hero" aria-labelledby="adoption-title">
          <div className="workflow-hero__body">
            <a className="back-link" href={homeHref()}>
              <ArrowLeft aria-hidden="true" />
              Reference home
            </a>
            <p className="eyebrow">v1.3 Compatibility Tool</p>
            <h1 id="adoption-title">Generate and audit frozen v1.3 Caller Workflows.</h1>
            <p className="hero__lede">
              This tool preserves the historical <code>workflow-standard-v1.3</code> adoption path
              for existing consumers. New repositories should prefer a repository-owned validation
              command or <code>coding-tooling-validation.yml</code> and pin the current capability
              line by immutable commit SHA.
            </p>
            <div className="workflow-hero__meta" aria-label="Adoption metadata">
              <Badge>{options.workflowRef}</Badge>
              <Badge variant="secondary">Compatibility generator</Badge>
              <Badge variant="outline">{generatedWorkflows.length} generated files</Badge>
            </div>
          </div>
          <div className="workflow-hero__stats" aria-label="Adoption summary">
            <Stat className="signal-board__stat">
              <StatValue className="signal-board__stat-value">{adoptionProfiles.length}</StatValue>
              <StatDescription className="signal-board__stat-description">v1.3 profiles</StatDescription>
            </Stat>
            <Stat className="signal-board__stat">
              <StatValue className="signal-board__stat-value">
                {generatedWorkflows.length}
              </StatValue>
              <StatDescription className="signal-board__stat-description">
                Files generated
              </StatDescription>
            </Stat>
            <Stat className="signal-board__stat">
              <StatValue className="signal-board__stat-value">{warnings.length}</StatValue>
              <StatDescription className="signal-board__stat-description">Warnings</StatDescription>
            </Stat>
            <Stat className="signal-board__stat">
              <StatValue className="signal-board__stat-value">{errors.length}</StatValue>
              <StatDescription className="signal-board__stat-description">Errors</StatDescription>
            </Stat>
          </div>
        </section>

        <section className="section section--split" aria-labelledby="current-adoption-title">
          <div>
            <p className="eyebrow">Current Capability Line</p>
            <h2 id="current-adoption-title">Do not use this generator as a new architecture template.</h2>
          </div>
          <div className="copy">
            <p>
              Current validation semantics belong in repository commands and <code>coding-tooling</code>.
              GitHub-hosted validation should call one deterministic repository command through
              <code>fast-validation.yml</code>, or delegate a declared tier through
              <code>coding-tooling-validation.yml</code> when that private tooling is available.
            </p>
            <p>
              The profiles below remain useful for auditing or maintaining repositories already
              pinned to <code>workflow-standard-v1.3</code>. The frozen compatibility tag and manifest
              should not be evolved to represent new capabilities.
            </p>
          </div>
        </section>

        <section className="section adoption-layout" aria-labelledby="adoption-generator-title">
          <div>
            <p className="eyebrow">Compatibility Generator</p>
            <h2 id="adoption-generator-title">Choose the existing v1.3 consumer shape.</h2>
          </div>
          <div className="adoption-tool-grid">
            <Card className="detail-card adoption-controls">
              <CardHeader>
                <CardTitle>Profile</CardTitle>
                <CardDescription>
                  Historical starter workflows for repositories that intentionally remain on v1.3.
                </CardDescription>
              </CardHeader>
              <CardContent className="adoption-controls__content">
                <div aria-label="Profile" className="adoption-profile-grid" role="radiogroup">
                  {adoptionProfiles.map((profile) => (
                    <div
                      className="adoption-choice"
                      data-state={options.profileId === profile.id ? "checked" : "unchecked"}
                      key={profile.id}
                    >
                      <input
                        checked={options.profileId === profile.id}
                        id={`profile-${profile.id}`}
                        aria-describedby={`profile-${profile.id}-description`}
                        name="adoption-profile"
                        onChange={() => selectProfile(profile.id)}
                        type="radio"
                        value={profile.id}
                      />
                      <label className="adoption-choice__copy" htmlFor={`profile-${profile.id}`}>
                        <strong>{profile.label}</strong>
                        <small id={`profile-${profile.id}-description`}>
                          {profile.description}
                        </small>
                      </label>
                    </div>
                  ))}
                </div>

                <div className="adoption-field-grid">
                  <label>
                    <span>Package manager</span>
                    <select
                      onChange={(event) =>
                        updateOption("packageManager", event.target.value as PackageManager)
                      }
                      value={options.packageManager}
                    >
                      {packageManagers.map((packageManager) => (
                        <option key={packageManager.id} value={packageManager.id}>
                          {packageManager.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    <span>Workflow ref</span>
                    <input
                      onChange={(event) => updateOption("workflowRef", event.target.value)}
                      value={options.workflowRef}
                    />
                  </label>
                  <label>
                    <span>Working directory</span>
                    <input
                      onChange={(event) => updateOption("workingDirectory", event.target.value)}
                      value={options.workingDirectory}
                    />
                  </label>
                </div>

                <div className="adoption-toggle-grid" aria-label="Workflow options">
                  <Toggle
                    checked={options.includeE2e}
                    label="E2E validation"
                    onChange={(checked) => updateOption("includeE2e", checked)}
                  />
                  <Toggle
                    checked={options.includeLinks}
                    label="Link validation"
                    onChange={(checked) => updateOption("includeLinks", checked)}
                  />
                  <Toggle
                    checked={options.includePerformance}
                    label="Performance validation"
                    onChange={(checked) => updateOption("includePerformance", checked)}
                  />
                  <Toggle
                    checked={options.includePagesDeploy}
                    label="Pages deploy"
                    onChange={(checked) => updateOption("includePagesDeploy", checked)}
                  />
                  <Toggle
                    checked={options.includePackagePublish}
                    label="Package publish"
                    onChange={(checked) => updateOption("includePackagePublish", checked)}
                  />
                </div>
              </CardContent>
            </Card>

            <Card className="detail-card adoption-output">
              <CardHeader>
                <div>
                  <CardTitle>Generated v1.3 workflow YAML</CardTitle>
                  <CardDescription>
                    Complete compatibility caller workflow files using explicit permissions and the
                    selected frozen ref.
                  </CardDescription>
                </div>
                <div className="chip-list">
                  {generatedWorkflows.map((workflow) => (
                    <Badge key={workflow.path} variant="outline">
                      {workflow.path}
                    </Badge>
                  ))}
                </div>
              </CardHeader>
              <CardContent>
                <CodeBlock
                  className="code-panel adoption-code-panel"
                  role="region"
                  aria-label="Generated workflow YAML"
                  tabIndex={0}
                >
                  <CodeBlockContent>
                    <CodeBlockCode>{generatedWorkflowText}</CodeBlockCode>
                  </CodeBlockContent>
                </CodeBlock>
              </CardContent>
            </Card>
          </div>
        </section>

        <section className="section adoption-layout" aria-labelledby="adoption-audit-title">
          <div>
            <p className="eyebrow">Compatibility Checker</p>
            <h2 id="adoption-audit-title">Audit existing v1.3 workflow YAML.</h2>
          </div>
          <div className="adoption-audit-grid">
            <Card className="detail-card adoption-audit-card">
              <CardHeader>
                <CardTitle>Workflow YAML</CardTitle>
                <CardDescription>
                  The same compatibility checks are available from <code>bun run adoption:check</code>.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <textarea
                  aria-label="Workflow YAML to audit"
                  className="adoption-textarea"
                  onChange={(event) => setAuditYaml(event.target.value)}
                  placeholder="Paste an existing v1.3 caller workflow YAML file here."
                  value={auditYaml}
                />
              </CardContent>
            </Card>

            <Card className="detail-card adoption-diagnostics-card">
              <CardHeader>
                <CardTitle>Diagnostics</CardTitle>
                <CardDescription>
                  Warnings are compatibility migration guidance; parse failures are errors.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {auditYaml.trim() ? (
                  <DiagnosticsList diagnostics={diagnostics} />
                ) : (
                  <div className="adoption-empty-state">
                    <FileCode2 aria-hidden="true" />
                    <p>No YAML pasted yet.</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </section>
      </main>
    </>
  );
}

function Toggle({
  checked,
  label,
  onChange,
}: {
  checked: boolean;
  label: string;
  onChange: (checked: boolean) => void;
}) {
  const id = `workflow-option-${label.toLowerCase().replaceAll(/\W+/g, "-")}`;

  return (
    <div className="adoption-toggle" data-state={checked ? "checked" : "unchecked"}>
      <input
        checked={checked}
        id={id}
        onChange={(event) => onChange(event.target.checked)}
        type="checkbox"
      />
      <label htmlFor={id}>{label}</label>
    </div>
  );
}

function DiagnosticsList({
  diagnostics,
}: {
  diagnostics: ReturnType<typeof checkAdoptionYaml>["diagnostics"];
}) {
  if (diagnostics.length === 0) {
    return (
      <div className="adoption-empty-state">
        <ClipboardCheck aria-hidden="true" />
        <p>No reusable workflow adoption issues found.</p>
      </div>
    );
  }

  return (
    <ul className="adoption-diagnostics">
      {diagnostics.map((diagnostic, index) => (
        <li data-level={diagnostic.level} key={`${diagnostic.code}-${index}`}>
          <strong>{diagnostic.code}</strong>
          <p>{diagnostic.message}</p>
          {diagnostic.line ? <small>Line {diagnostic.line}</small> : null}
        </li>
      ))}
    </ul>
  );
}
