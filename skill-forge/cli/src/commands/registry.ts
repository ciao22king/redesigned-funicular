import type { Command } from './types.js';
import { loginCommand, logoutCommand } from './login.js';
import { whoamiCommand } from './whoami.js';
import { generateCommand } from './generate.js';
import { publishCommand } from './publish.js';
import { listCommand, searchCommand } from './list.js';
import { browseCommand, uiCommand } from './browse.js';
import { showCommand } from './show.js';
import { pullCommand } from './pull.js';
import { starCommand } from './star.js';
import { deleteCommand } from './delete.js';

/** List of commands, in the order they appear in the help. */
export const commands: Command[] = [
  loginCommand,
  logoutCommand,
  whoamiCommand,
  generateCommand,
  publishCommand,
  browseCommand,
  uiCommand,
  listCommand,
  searchCommand,
  showCommand,
  pullCommand,
  starCommand,
  deleteCommand,
];
