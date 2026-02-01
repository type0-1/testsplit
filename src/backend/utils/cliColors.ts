import chalk from 'chalk';

export const success = (msg: string) => console.log(chalk.green(`✔ ${msg}`));

export const warning = (msg: string) => console.warn(chalk.yellow(`⚠ ${msg}`));

export const error = (msg: string) => console.error(chalk.red(`✖ ${msg}`));

export const info = (msg: string) => console.log(chalk.cyan(msg));
