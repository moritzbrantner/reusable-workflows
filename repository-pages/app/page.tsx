"use client";

import { useQuery } from "@tanstack/react-query";

const repository = process.env.NEXT_PUBLIC_REPOSITORY ?? "moritzbrantner/repository";
const repositoryUrl = `https://github.com/${repository}`;

interface Repository {
  name: string;
  full_name: string;
  html_url: string;
  description: string | null;
  homepage: string | null;
  default_branch: string;
  language: string | null;
  stargazers_count: number;
  forks_count: number;
  open_issues_count: number;
  updated_at: string;
  license: { spdx_id: string } | null;
}

interface Commit {
  sha: string;
  html_url: string;
  commit: {
    message: string;
    author: {
      name: string;
      date: string;
    } | null;
  };
}

interface ReleaseAsset {
  id: number;
  name: string;
  browser_download_url: string;
  size: number;
}

interface Release {
  id: number;
  name: string | null;
  tag_name: string;
  html_url: string;
  published_at: string | null;
  prerelease: boolean;
  assets: ReleaseAsset[];
}

interface PullRequest {
  id: number;
  number: number;
  title: string;
  html_url: string;
  draft: boolean;
  updated_at: string;
}

interface Issue {
  id: number;
  number: number;
  title: string;
  html_url: string;
  updated_at: string;
  pull_request?: unknown;
}

interface WorkflowRun {
  id: number;
  name: string | null;
  html_url: string;
  event: string;
  status: string;
  conclusion: string | null;
  head_branch: string | null;
  updated_at: string;
}

interface WorkflowRuns {
  total_count: number;
  workflow_runs: WorkflowRun[];
}

async function githubJson<T>(path: string): Promise<T> {
  const response = await fetch(`https://api.github.com/repos/${repository}${path}`, {
    headers: {
      Accept: "application/vnd.github+json",
    },
  });

  if (!response.ok) {
    if (response.status === 403) {
      throw new Error("GitHub API rate limit reached. Open the repository for live details.");
    }

    throw new Error(`GitHub API request failed with status ${response.status}.`);
  }

  return (await response.json()) as T;
}

function formatDate(value: string | null | undefined) {
  if (!value) {
    return "Unknown";
  }

  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatBytes(bytes: number) {
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  const units = ["KB", "MB", "GB"];
  let value = bytes / 1024;
  let unitIndex = 0;

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }

  return `${value.toFixed(value >= 10 ? 0 : 1)} ${units[unitIndex]}`;
}

function firstLine(value: string) {
  return value.split("\n", 1)[0] ?? value;
}

function Panel({
  title,
  children,
}: Readonly<{
  title: string;
  children: React.ReactNode;
}>) {
  return (
    <section className="rounded-2xl border border-zinc-800 bg-zinc-950/70 p-5 shadow-2xl shadow-black/10">
      <h2 className="mb-4 text-sm font-semibold uppercase tracking-[0.16em] text-zinc-400">
        {title}
      </h2>
      {children}
    </section>
  );
}

function ErrorNotice({ error }: Readonly<{ error: Error | null }>) {
  if (!error) {
    return null;
  }

  return (
    <p className="rounded-xl border border-zinc-700 bg-zinc-900 p-4 text-sm text-zinc-300">
      {error.message}{" "}
      <a className="underline underline-offset-4" href={repositoryUrl}>
        Open GitHub
      </a>
      .
    </p>
  );
}

export default function HomePage() {
  const repoQuery = useQuery({
    queryKey: [repository, "repository"],
    queryFn: () => githubJson<Repository>(""),
  });
  const commitsQuery = useQuery({
    queryKey: [repository, "commits"],
    queryFn: () => githubJson<Commit[]>("/commits?per_page=1"),
  });
  const releasesQuery = useQuery({
    queryKey: [repository, "releases"],
    queryFn: () => githubJson<Release[]>("/releases?per_page=5"),
  });
  const pullsQuery = useQuery({
    queryKey: [repository, "pulls"],
    queryFn: () => githubJson<PullRequest[]>("/pulls?state=open&per_page=5"),
  });
  const issuesQuery = useQuery({
    queryKey: [repository, "issues"],
    queryFn: () => githubJson<Issue[]>("/issues?state=open&per_page=10"),
  });
  const runsQuery = useQuery({
    queryKey: [repository, "workflow-runs"],
    queryFn: () => githubJson<WorkflowRuns>("/actions/runs?per_page=5"),
  });

  const repo = repoQuery.data;
  const latestCommit = commitsQuery.data?.[0];
  const releases = releasesQuery.data ?? [];
  const pulls = pullsQuery.data ?? [];
  const issues = (issuesQuery.data ?? []).filter((issue) => !issue.pull_request).slice(0, 5);
  const runs = runsQuery.data?.workflow_runs ?? [];
  const error = [
    repoQuery.error,
    commitsQuery.error,
    releasesQuery.error,
    pullsQuery.error,
    issuesQuery.error,
    runsQuery.error,
  ].find((candidate): candidate is Error => candidate instanceof Error) ?? null;

  return (
    <main className="mx-auto min-h-screen max-w-7xl px-5 py-10 sm:px-8 lg:px-10">
      <header className="mb-8 flex flex-col gap-5 border-b border-zinc-800 pb-8 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-3xl">
          <p className="mb-2 text-sm font-medium text-zinc-500">Repository Pages</p>
          <h1 className="text-3xl font-semibold tracking-tight text-zinc-50 sm:text-4xl">
            {repo?.full_name ?? repository}
          </h1>
          <p className="mt-3 max-w-2xl text-base leading-7 text-zinc-400">
            {repo?.description ?? "A compact view of the repository state, recent work, and published outputs."}
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          {repo?.homepage ? (
            <a
              className="rounded-xl border border-zinc-700 px-4 py-2 text-sm font-medium text-zinc-200 hover:bg-zinc-900"
              href={repo.homepage}
              rel="noreferrer"
              target="_blank"
            >
              Project home
            </a>
          ) : null}
          <a
            className="rounded-xl bg-zinc-100 px-4 py-2 text-sm font-semibold text-zinc-950 hover:bg-white"
            href={repo?.html_url ?? repositoryUrl}
            rel="noreferrer"
            target="_blank"
          >
            Open repository
          </a>
        </div>
      </header>

      <ErrorNotice error={error} />

      <div className="mt-6 grid gap-5 lg:grid-cols-3">
        <Panel title="State">
          <dl className="grid grid-cols-2 gap-x-4 gap-y-5 text-sm">
            <div>
              <dt className="text-zinc-500">Default branch</dt>
              <dd className="mt-1 font-medium text-zinc-200">{repo?.default_branch ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-zinc-500">Primary language</dt>
              <dd className="mt-1 font-medium text-zinc-200">{repo?.language ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-zinc-500">Stars</dt>
              <dd className="mt-1 font-medium text-zinc-200">{repo?.stargazers_count ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-zinc-500">Forks</dt>
              <dd className="mt-1 font-medium text-zinc-200">{repo?.forks_count ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-zinc-500">Open issues + PRs</dt>
              <dd className="mt-1 font-medium text-zinc-200">{repo?.open_issues_count ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-zinc-500">License</dt>
              <dd className="mt-1 font-medium text-zinc-200">{repo?.license?.spdx_id ?? "—"}</dd>
            </div>
          </dl>
          <p className="mt-5 border-t border-zinc-800 pt-4 text-xs leading-5 text-zinc-500">
            Repository updated {formatDate(repo?.updated_at)}
          </p>
        </Panel>

        <Panel title="Latest commit">
          {latestCommit ? (
            <div>
              <a
                className="text-base font-medium leading-6 text-zinc-100 hover:underline"
                href={latestCommit.html_url}
                rel="noreferrer"
                target="_blank"
              >
                {firstLine(latestCommit.commit.message)}
              </a>
              <p className="mt-3 font-mono text-xs text-zinc-500">{latestCommit.sha.slice(0, 12)}</p>
              <p className="mt-2 text-sm text-zinc-400">
                {latestCommit.commit.author?.name ?? "Unknown author"} · {formatDate(latestCommit.commit.author?.date)}
              </p>
            </div>
          ) : (
            <p className="text-sm text-zinc-500">No commit information available.</p>
          )}
        </Panel>

        <Panel title="Automation">
          {runs.length ? (
            <div className="space-y-4">
              {runs.map((run) => (
                <a
                  className="block rounded-xl border border-zinc-800 p-3 hover:bg-zinc-900/70"
                  href={run.html_url}
                  key={run.id}
                  rel="noreferrer"
                  target="_blank"
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="truncate text-sm font-medium text-zinc-200">{run.name ?? "Workflow"}</span>
                    <span className="shrink-0 text-xs text-zinc-500">{run.conclusion ?? run.status}</span>
                  </div>
                  <p className="mt-1 truncate text-xs text-zinc-500">
                    {run.event} · {run.head_branch ?? "no branch"} · {formatDate(run.updated_at)}
                  </p>
                </a>
              ))}
            </div>
          ) : (
            <p className="text-sm text-zinc-500">No workflow runs found.</p>
          )}
        </Panel>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <Panel title="Published outputs">
          {releases.length ? (
            <div className="space-y-5">
              {releases.map((release) => (
                <article className="border-b border-zinc-800 pb-5 last:border-0 last:pb-0" key={release.id}>
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <a
                      className="font-medium text-zinc-100 hover:underline"
                      href={release.html_url}
                      rel="noreferrer"
                      target="_blank"
                    >
                      {release.name || release.tag_name}
                    </a>
                    <span className="text-xs text-zinc-500">
                      {release.prerelease ? "Prerelease" : "Release"} · {formatDate(release.published_at)}
                    </span>
                  </div>
                  {release.assets.length ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {release.assets.map((asset) => (
                        <a
                          className="rounded-lg border border-zinc-800 px-3 py-1.5 text-xs text-zinc-300 hover:bg-zinc-900"
                          href={asset.browser_download_url}
                          key={asset.id}
                        >
                          {asset.name} · {formatBytes(asset.size)}
                        </a>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-2 text-xs text-zinc-500">No downloadable assets on this release.</p>
                  )}
                </article>
              ))}
            </div>
          ) : (
            <p className="text-sm leading-6 text-zinc-500">
              No GitHub releases are published yet. This page will surface release assets automatically when they appear.
            </p>
          )}
        </Panel>

        <div className="grid gap-5 sm:grid-cols-2">
          <Panel title="Open pull requests">
            {pulls.length ? (
              <div className="space-y-3">
                {pulls.map((pull) => (
                  <a
                    className="block text-sm leading-5 text-zinc-300 hover:underline"
                    href={pull.html_url}
                    key={pull.id}
                    rel="noreferrer"
                    target="_blank"
                  >
                    <span className="text-zinc-500">#{pull.number}</span> {pull.title}
                    {pull.draft ? <span className="ml-2 text-xs text-zinc-600">draft</span> : null}
                  </a>
                ))}
              </div>
            ) : (
              <p className="text-sm text-zinc-500">No open pull requests.</p>
            )}
          </Panel>

          <Panel title="Recent open issues">
            {issues.length ? (
              <div className="space-y-3">
                {issues.map((issue) => (
                  <a
                    className="block text-sm leading-5 text-zinc-300 hover:underline"
                    href={issue.html_url}
                    key={issue.id}
                    rel="noreferrer"
                    target="_blank"
                  >
                    <span className="text-zinc-500">#{issue.number}</span> {issue.title}
                  </a>
                ))}
              </div>
            ) : (
              <p className="text-sm text-zinc-500">No open issues in the recent result set.</p>
            )}
          </Panel>
        </div>
      </div>

      <footer className="mt-8 border-t border-zinc-800 pt-5 text-xs leading-5 text-zinc-600">
        Static Next.js export. Repository data is read from GitHub when this page is opened and cached briefly in the browser.
      </footer>
    </main>
  );
}
