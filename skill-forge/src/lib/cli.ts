/**
 * CLI facts, in one place.
 *
 * The npm package name and the install command live here so the landing page,
 * the /cli page and the tests all read the same values: if the package is
 * renamed, the string changes once and the test catches any drift.
 */

/** The published npm package. Must match the scope of the publishing account. */
export const CLI_PACKAGE = '@ciao223/skill-forge-cli';

/** The command a user copies. */
export const CLI_INSTALL_COMMAND = `npm install -g ${CLI_PACKAGE}`;

/** The two binaries the package installs. */
export const CLI_BINARIES = ['skill-forge', 'sf'] as const;

/** Minimum Node version, from the package's `engines` field. */
export const CLI_NODE = '18';

export interface CliCommand {
  /** The command, without the leading `$`. */
  usage: string;
  /** What it does, in one line. */
  what: string;
  /** Whether it needs an authenticated token. */
  needsAuth: boolean;
}

export const CLI_COMMANDS: CliCommand[] = [
  { usage: 'skill-forge login', what: 'Authenticate with GitHub (Device Flow) and save the token', needsAuth: false },
  { usage: 'skill-forge logout', what: 'Remove the saved token', needsAuth: false },
  { usage: 'skill-forge whoami', what: 'Show the authenticated user and the remaining quota', needsAuth: true },
  { usage: 'skill-forge generate -f notes.md -o skill.md', what: 'Generate a skill from files or from the wizard', needsAuth: true },
  { usage: 'skill-forge publish -f skill.md --tags docker,deploy', what: 'Publish a skill to the marketplace', needsAuth: true },
  { usage: 'skill-forge browse', what: 'Browse the marketplace interactively, with mouse and keyboard', needsAuth: false },
  { usage: 'skill-forge list -q docker -s stars', what: 'Search and browse the marketplace', needsAuth: false },
  { usage: 'skill-forge show ciao22king/docker-deploy', what: 'Show the detail of a skill, markdown included', needsAuth: false },
  { usage: 'skill-forge pull ciao22king/docker-deploy -o skill.md', what: 'Download a skill as a .md file', needsAuth: false },
  { usage: 'skill-forge star ciao22king/docker-deploy', what: 'Star or unstar a skill', needsAuth: true },
  { usage: 'skill-forge delete ciao22king/docker-deploy --yes', what: 'Delete one of your skills', needsAuth: true },
];

export interface CliStep {
  title: string;
  body: string;
  /** The command shown under the step, if any. */
  code?: string;
}

export const CLI_STEPS: CliStep[] = [
  {
    title: 'Install',
    body: `Needs Node ${CLI_NODE} or later. The package has no runtime dependencies. It installs two commands, \`skill-forge\` and its short alias \`sf\`.`,
    code: CLI_INSTALL_COMMAND,
  },
  {
    title: 'Sign in',
    body: 'The Device Flow prints a code, you enter it at github.com/login/device and authorize. The CLI waits and saves the token as soon as it arrives: nothing to copy and paste.',
    code: 'skill-forge login',
  },
  {
    title: 'Use it',
    body: 'Generate, publish and pull skills without leaving the shell. Reading commands (list, show, pull) work without an account.',
    code: 'skill-forge generate -f notes.md -o skill.md',
  },
];

/**
 * The token sources, in priority order. Kept as data so the page and the tests
 * agree on the order.
 */
export const CLI_TOKEN_SOURCES = [
  '--token <token>',
  'the SKILL_FORGE_TOKEN variable',
  'gh auth token, if the GitHub CLI is installed',
  'the Device Flow (interactive terminal only)',
] as const;
