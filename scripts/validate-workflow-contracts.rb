#!/usr/bin/env ruby
# frozen_string_literal: true

require "json"
require "yaml"

ROOT = File.expand_path("..", __dir__)
CONTRACT_PATH = File.join(ROOT, "contracts", "workflows.json")
OPTIONAL_UPSTREAM_DOC = File.expand_path("../monorepo/REUSABLE_WORKFLOWS.md", ROOT)

def stringify_keys(value)
  case value
  when Hash
    value.each_with_object({}) { |(key, child), out| out[key.to_s] = stringify_keys(child) }
  when Array
    value.map { |child| stringify_keys(child) }
  else
    value
  end
end

def workflow_call_for(path)
  workflow = stringify_keys(YAML.safe_load(File.read(path), aliases: true))
  on_block = workflow["on"] || workflow["true"] || {}
  on_block["workflow_call"] || {}
end

def first_job_for(path)
  workflow = stringify_keys(YAML.safe_load(File.read(path), aliases: true))
  jobs = workflow.fetch("jobs")
  jobs.values.first
end

def compact_contract_map(map)
  (map || {}).sort.to_h
end

contract = JSON.parse(File.read(CONTRACT_PATH))
errors = []

unless contract["workflow_standard"] == "workflow-standard-v1"
  errors << "contracts/workflows.json must declare workflow_standard workflow-standard-v1"
end

workflow_contracts = contract.fetch("workflows")

workflow_contracts.each do |relative_path, expected|
  path = File.join(ROOT, relative_path)
  unless File.exist?(path)
    errors << "Missing workflow file: #{relative_path}"
    next
  end

  workflow_call = workflow_call_for(path)
  job = first_job_for(path)

  actual_inputs = compact_contract_map(workflow_call["inputs"])
  expected_inputs = compact_contract_map(expected["inputs"])
  if actual_inputs != expected_inputs
    errors << "Input contract drift in #{relative_path}"
  end

  actual_secrets = compact_contract_map(workflow_call["secrets"])
  expected_secrets = compact_contract_map(expected["secrets"])
  if actual_secrets != expected_secrets
    errors << "Secret contract drift in #{relative_path}"
  end

  actual_outputs = compact_contract_map(workflow_call["outputs"])
  expected_outputs = compact_contract_map(expected["outputs"])
  if actual_outputs != expected_outputs
    errors << "Output contract drift in #{relative_path}"
  end

  actual_permissions = compact_contract_map(job["permissions"])
  expected_permissions = compact_contract_map(expected["permissions"])
  if actual_permissions != expected_permissions
    errors << "Permission contract drift in #{relative_path}"
  end
end

repo_workflows = Dir.glob(File.join(ROOT, ".github", "workflows", "*.yml"))
                    .map { |path| path.delete_prefix("#{ROOT}/") }
                    .reject { |path| path.end_with?("validate.yml", "smoke-reusable-workflows.yml") }
                    .sort
missing_contracts = repo_workflows - workflow_contracts.keys.sort
extra_contracts = workflow_contracts.keys.sort - repo_workflows
errors << "Missing contract entries: #{missing_contracts.join(", ")}" unless missing_contracts.empty?
errors << "Contract entries for missing workflows: #{extra_contracts.join(", ")}" unless extra_contracts.empty?

required_doc_tokens = ["workflow-standard-v1"] + workflow_contracts.keys.map { |path| File.basename(path) }
["README.md", "SCAFFOLD_ALIGNMENT.md"].each do |doc_path|
  content = File.read(File.join(ROOT, doc_path))
  required_doc_tokens.each do |token|
    errors << "#{doc_path} does not document #{token}" unless content.include?(token)
  end
end

if File.exist?(OPTIONAL_UPSTREAM_DOC)
  upstream_content = File.read(OPTIONAL_UPSTREAM_DOC)
  required_doc_tokens.each do |token|
    errors << "#{OPTIONAL_UPSTREAM_DOC} does not document #{token}" unless upstream_content.include?(token)
  end
else
  warn "Skipping optional upstream doc check; #{OPTIONAL_UPSTREAM_DOC} is not present."
end

if errors.empty?
  puts "Workflow contracts are in sync."
else
  warn errors.join("\n")
  exit 1
end
