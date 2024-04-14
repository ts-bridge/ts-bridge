# Contributing

Any contributions you make are greatly appreciated! Below are some instructions
on how to get started with the project.

## Getting started

- Install [Node.js](https://nodejs.org) version 20.
  - If you're using [`nvm`](https://github.com/nvm-sh/nvm#installing-and-updating)
    (recommended), `nvm use` will ensure that the right version is installed.
- Install [Yarn v4](https://yarnpkg.com/getting-started/install).
- Run `yarn` to install dependencies and run any required post-install scripts.

## Testing

- Run `yarn workspace <workspaceName> run test` to run all tests for a package.
- Run `yarn workspace <workspaceName> run test <file>` to run a test file within
  the context of a package.
- Run `yarn test` to run tests for all packages, including coverage reports.

> [!NOTE] > `workspaceName` in these commands is the `name` field within a package's
> `package.json`, e.g., `@ts-bridge/cli`, not the directory where it is located,
> e.g., `packages/cli`.

## Linting

Run `yarn lint` to lint all files and show possible violations.

Run `yarn lint:fix` to fix any automatically fixable violations.

## Release process

The release workflow is based on MetaMask's release process, using
[create-release-branch](https://github.com/MetaMask/create-release-branch) to
create a release branch and
[auto-changelog](https://github.com/MetaMask/auto-changelog) to manage the
changelogs. Below are the steps to follow when releasing a new version of TS
Bridge:

1. **Initiate the release branch and specify packages to be released.**

   1. **Create the release branch.**

      Start by running `yarn create-release-branch`. This command creates a
      branch named `release/<new release version>` which will represent the new
      release.

   2. **Specify packages to release along with their versions.**

      At this point, you need to tell the tool which packages you want to
      include in the next release and which versions to assign to those
      packages. You do this by modifying a YAML file called a "release spec",
      which the tool has generated and opened it in your editor. Follow the
      instructions at the top of the file to proceed.

      To assist you, the tool has also updated all of the packages that have
      been changed since their previous releases so that their changelogs now
      reflect those new changes. This should help you to understand what will be
      released and how to bump the versions.

      Once you save and close the release spec, the tool will proceed.

2. **Review and update changelogs for relevant packages.**

   1. At this point, the versions of all packages you intend to release have
      been bumped and their changelogs list new changes. Now you need to go
      through each changelog and make sure that they follow existing standards:

   - Categorize entries appropriately following the
     ["Keep a Changelog"](https://keepachangelog.com/en/1.0.0/) guidelines.
   - Remove changelog entries that don't affect consumers of the package (e.g.,
     lockfile changes or development environment changes). Exceptions may be
     made for changes that might be of interest despite not having an effect
     upon the published package (e.g., major test improvements, security
     improvements, improved documentation, etc.).
   - Reword changelog entries to explain changes in terms that users of the
     package will understand (e.g., avoid referencing internal variables and
     concepts).
   - Consolidate related changes into single entries where appropriate.

   2. Run `yarn lint:changelogs` to ensure all changelogs are correctly
      formatted.

3. **Push and submit a pull request for the release branch so that it can be
   reviewed and tested.**

   Make sure the title of the pull request follows the pattern "Release
   \<new version\>".

   If changes are made to the base branch, the release branch will need to be
   updated with these changes and review/QA will need to restart again. As such,
   it's probably best to avoid merging other PRs into the base branch while
   review is underway.

4. **"Squash & Merge" the release.**

   This step triggers the
   [`publish-release` GitHub action](https://github.com/MetaMask/action-publish-release)
   workflow to tag the final release commit and publish the release on GitHub.

   Pay attention to the box you see when you press the green button and ensure
   that the final name of the commit follows the pattern
   "Release \<new version\>".

5. **Publish the release on NPM.**

   The `publish-release` GitHub Action workflow runs the `publish-npm` job,
   which publishes relevant packages to NPM.

   Once the `publish-npm` job has finished,
   [check NPM](https://npms.io/search?q=scope%3Ats-bridge) to verify that all
   relevant packages has been published.
