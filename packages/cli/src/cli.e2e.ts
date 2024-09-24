import {
  getFixture,
  readAllDirectories,
  removeDirectory,
  run,
} from '@ts-bridge/test-utils';
import { readdir } from 'fs/promises';
import { beforeEach, describe, expect, it } from 'vitest';

describe('cli', () => {
  describe('build', () => {
    describe('node 10', () => {
      const FIXTURE_PATH = getFixture('node-10');
      const FIXTURE_DIST_PATH = getFixture('node-10', 'dist');

      beforeEach(async () => {
        await removeDirectory(FIXTURE_DIST_PATH);
      });

      it('builds the project', async () => {
        const runner = run('build', [], FIXTURE_PATH);

        const exitCode = await runner.waitForExit();
        expect(exitCode).toBe(0);
        expect(runner.stdout).toHaveLength(0);
        expect(runner.stderr).toHaveLength(0);

        const files = await readdir(FIXTURE_DIST_PATH);
        expect(files).toMatchInlineSnapshot(`
          [
            "file-1.cjs",
            "file-1.cjs.map",
            "file-1.d.cts",
            "file-1.d.cts.map",
            "file-1.d.mts",
            "file-1.d.mts.map",
            "file-1.mjs",
            "file-1.mjs.map",
            "file-2.cjs",
            "file-2.cjs.map",
            "file-2.d.cts",
            "file-2.d.cts.map",
            "file-2.d.mts",
            "file-2.d.mts.map",
            "file-2.mjs",
            "file-2.mjs.map",
            "index.cjs",
            "index.cjs.map",
            "index.d.cts",
            "index.d.cts.map",
            "index.d.mts",
            "index.d.mts.map",
            "index.mjs",
            "index.mjs.map",
          ]
        `);
      });

      it('builds the project with verbose logging', async () => {
        const runner = run('build', ['--verbose'], FIXTURE_PATH);

        const exitCode = await runner.waitForExit();
        expect(exitCode).toBe(0);
        expect(runner.stderr).toHaveLength(0);
        expect(runner.output).toMatchInlineSnapshot(`
          "ℹ Building ES module "tsconfig.json".
          → Transforming source file "src/file-1.ts".
          → Transforming source file "src/file-2.ts".
          → Transforming source file "src/index.ts".
          ℹ Building CommonJS module "tsconfig.json".
          → Transforming source file "src/file-1.ts".
          → Transforming source file "src/file-2.ts".
          → Transforming source file "src/index.ts".
          ✔ Project built successfully.
          "
        `);
      });
    });

    describe('node 16', () => {
      const FIXTURE_PATH = getFixture('node-16');
      const FIXTURE_DIST_PATH = getFixture('node-16', 'dist');

      beforeEach(async () => {
        await removeDirectory(FIXTURE_DIST_PATH);
      });

      it('builds the project', async () => {
        const runner = run('build', [], FIXTURE_PATH);

        const exitCode = await runner.waitForExit();
        expect(exitCode).toBe(0);
        expect(runner.stdout).toHaveLength(0);
        expect(runner.stderr).toHaveLength(0);

        const files = await readdir(FIXTURE_DIST_PATH);
        expect(files).toMatchInlineSnapshot(`
          [
            "file-1.cjs",
            "file-1.cjs.map",
            "file-1.d.cts",
            "file-1.d.cts.map",
            "file-1.d.mts",
            "file-1.d.mts.map",
            "file-1.mjs",
            "file-1.mjs.map",
            "file-2.cjs",
            "file-2.cjs.map",
            "file-2.d.cts",
            "file-2.d.cts.map",
            "file-2.d.mts",
            "file-2.d.mts.map",
            "file-2.mjs",
            "file-2.mjs.map",
            "index.cjs",
            "index.cjs.map",
            "index.d.cts",
            "index.d.cts.map",
            "index.d.mts",
            "index.d.mts.map",
            "index.mjs",
            "index.mjs.map",
          ]
        `);
      });

      it('builds the project with verbose logging', async () => {
        const runner = run('build', ['--verbose'], FIXTURE_PATH);

        const exitCode = await runner.waitForExit();
        expect(exitCode).toBe(0);
        expect(runner.stderr).toHaveLength(0);
        expect(runner.output).toMatchInlineSnapshot(`
          "ℹ Building ES module "tsconfig.json".
          → Transforming source file "src/file-1.ts".
          → Transforming source file "src/file-2.ts".
          → Transforming source file "src/index.ts".
          ℹ Building CommonJS module "tsconfig.json".
          → Transforming source file "src/file-1.ts".
          → Transforming source file "src/file-2.ts".
          → Transforming source file "src/index.ts".
          ✔ Project built successfully.
          "
        `);
      });
    });

    describe('project references', () => {
      const FIXTURE_PATH = getFixture('project-references');
      const FIXTURE_DIST_PATH = getFixture('project-references', 'dist');

      const ALL_FIXTURE_DIST_PATHS = [
        FIXTURE_DIST_PATH,
        getFixture('project-references', 'packages', 'project-1', 'dist'),
        getFixture('project-references', 'packages', 'project-2', 'dist'),
        getFixture('project-references', 'packages', 'project-3', 'dist'),
        getFixture('project-references', 'packages', 'project-4', 'dist'),
        getFixture('project-references', 'packages', 'project-5', 'dist'),
        getFixture('project-references', 'packages', 'project-6', 'dist'),
      ];

      beforeEach(async () => {
        for (const path of ALL_FIXTURE_DIST_PATHS) {
          await removeDirectory(path);
        }
      });

      it('builds the project', async () => {
        const runner = run('build', [], FIXTURE_PATH);

        const exitCode = await runner.waitForExit();
        expect(exitCode).toBe(0);
        expect(runner.stdout).toHaveLength(0);
        expect(runner.stderr).toHaveLength(0);

        const files = await readAllDirectories(
          FIXTURE_PATH,
          ALL_FIXTURE_DIST_PATHS,
        );
        expect(files).toMatchInlineSnapshot(`
          [
            "dist/index.cjs",
            "dist/index.d.cts",
            "dist/index.d.cts.map",
            "dist/index.d.mts",
            "dist/index.d.mts.map",
            "dist/index.mjs",
            "packages/project-1/dist/index.cjs",
            "packages/project-1/dist/index.d.cts",
            "packages/project-1/dist/index.d.cts.map",
            "packages/project-1/dist/index.d.mts",
            "packages/project-1/dist/index.d.mts.map",
            "packages/project-1/dist/index.mjs",
            "packages/project-2/dist/index.cjs",
            "packages/project-2/dist/index.d.cts",
            "packages/project-2/dist/index.d.cts.map",
            "packages/project-2/dist/index.d.mts",
            "packages/project-2/dist/index.d.mts.map",
            "packages/project-2/dist/index.mjs",
            "packages/project-3/dist/index.cjs",
            "packages/project-3/dist/index.d.cts",
            "packages/project-3/dist/index.d.cts.map",
            "packages/project-3/dist/index.d.mts",
            "packages/project-3/dist/index.d.mts.map",
            "packages/project-3/dist/index.mjs",
            "packages/project-4/dist/index.cjs",
            "packages/project-4/dist/index.d.cts",
            "packages/project-4/dist/index.d.cts.map",
            "packages/project-4/dist/index.d.mts",
            "packages/project-4/dist/index.d.mts.map",
            "packages/project-4/dist/index.mjs",
            "packages/project-5/dist/index.cjs",
            "packages/project-5/dist/index.d.cts",
            "packages/project-5/dist/index.d.cts.map",
            "packages/project-5/dist/index.d.mts",
            "packages/project-5/dist/index.d.mts.map",
            "packages/project-5/dist/index.mjs",
            "packages/project-6/dist/index.cjs",
            "packages/project-6/dist/index.d.cts",
            "packages/project-6/dist/index.d.cts.map",
            "packages/project-6/dist/index.d.mts",
            "packages/project-6/dist/index.d.mts.map",
            "packages/project-6/dist/index.mjs",
          ]
        `);
      });

      it('builds the project with verbose logging', async () => {
        const runner = run('build', ['--verbose'], FIXTURE_PATH);

        const exitCode = await runner.waitForExit();
        expect(exitCode).toBe(0);
        expect(runner.stderr).toHaveLength(0);

        // Since we're working with worker threads, the order of the logs is not
        // deterministic. We'll just check if the logs contain the expected
        // messages.
        expect(runner.output).toContain(
          'Building ES module "packages/project-1/tsconfig.json"',
        );

        expect(runner.output).toContain(
          'Building ES module "packages/project-2/tsconfig.json"',
        );

        expect(runner.output).toContain(
          'Building ES module "packages/project-3/tsconfig.json"',
        );

        expect(runner.output).toContain(
          'Building ES module "packages/project-4/tsconfig.json"',
        );

        expect(runner.output).toContain(
          'Building ES module "packages/project-5/tsconfig.json"',
        );

        expect(runner.output).toContain(
          'Building ES module "packages/project-6/tsconfig.json"',
        );

        expect(runner.output).toContain(
          'Building CommonJS module "packages/project-1/tsconfig.json"',
        );

        expect(runner.output).toContain(
          'Building CommonJS module "packages/project-2/tsconfig.json"',
        );

        expect(runner.output).toContain(
          'Building CommonJS module "packages/project-3/tsconfig.json"',
        );

        expect(runner.output).toContain(
          'Building CommonJS module "packages/project-4/tsconfig.json"',
        );

        expect(runner.output).toContain(
          'Building CommonJS module "packages/project-5/tsconfig.json"',
        );

        expect(runner.output).toContain(
          'Building CommonJS module "packages/project-6/tsconfig.json"',
        );

        expect(runner.output).toContain('All project references built.');
        expect(runner.output).toContain('Building ES module "tsconfig.json"');
        expect(runner.output).toContain('Project built successfully.');
      });
    });
  });

  describe('--help', () => {
    it('logs the manual', async () => {
      const runner = run('build', ['--help']);

      const manual = await runner.expectStdout();
      const exitCode = await runner.waitForExit();

      expect(exitCode).toBe(0);
      expect(manual).toMatchInlineSnapshot(`
        "index.js build

        Build the project using the TypeScript compiler. This is the default command.

        Options:
              --help                 Show help                                 [boolean]
              --version              Show version number                       [boolean]
          -p, --project              Path to the \`tsconfig.json\` file.
                                                   [string] [default: "./tsconfig.json"]
          -f, --format               The format(s) of the output files. Defaults to
                                     \`module\` and \`commonjs\`.
                [array] [choices: "module", "commonjs"] [default: ["module","commonjs"]]
              --clean                Remove the output directory before building.
                                                              [boolean] [default: false]
              --verbose              Enable verbose logging.  [boolean] [default: false]
              --references, --build  Build project references in the project. Enabled by
                                     default if \`tsconfig.json\` contains project
                                     references.               [boolean] [default: true]
              --shims                Generate shims for environment-specific APIs.
                                                               [boolean] [default: true]
        "
      `);
    });
  });
});
