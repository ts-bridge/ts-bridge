#!/usr/bin/env bash

set -o errexit
set -o nounset
set -o pipefail

# Get the TypeScript version range from package.json
version_range=$(jq --raw-output '.peerDependencies.typescript' packages/cli/package.json)

# Fetch all versions and filter based on semver range.
all_versions=$(npm show typescript time --json | jq --raw-output 'del(.modified, .created) | keys | .[] | @sh')
declare -a all_versions_array="($all_versions)"
versions=$(yarn semver "${all_versions_array[@]}" --range "$version_range" --loose | xargs)

# Sort versions, extract `major.minor`, sort by `major.minor` and patch, get the
# latest for each `major.minor`
latest_patch_versions=$(echo "$versions" | tr ' ' '\n' | sort -V | awk -F. '{print $1"."$2"."$3}' | sort -t. -k1,1n -k2,2n -k3,3nr | awk -F. '!seen[$1"."$2]++')

# Convert the versions to JSON.
versions_json=$(echo "$latest_patch_versions" | jq --raw-input --raw-output --compact-output --slurp 'split("\n") | .[0:-1]')

# Output the JSON.
echo "$versions_json"
