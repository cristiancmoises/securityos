import { colorAttributes, rgbAnsi } from "components/apps/Terminal/color";
import { commands as gitCommands } from "components/apps/Terminal/processGit";
import type { LocalEcho } from "components/apps/Terminal/types";
import processDirectory from "contexts/process/directory";
import { ONE_DAY_IN_MILLISECONDS } from "utils/constants";

export const help = (
  localEcho: LocalEcho,
  commandList: Record<string, string>,
  aliasList?: Record<string, string[]>
): void => {
  Object.entries(commandList).forEach(([command, description]) => {
    localEcho?.println(`${command.padEnd(14)} ${description}`);
  });

  if (aliasList) {
    localEcho?.println("\r\nAliases:\r\n");
    Object.entries(aliasList).forEach(([baseCommand, aliasCommands]) => {
      aliasCommands.forEach((aliasCommand) => {
        localEcho?.println(
          `${aliasCommand.padEnd(14)} ${commandList[baseCommand]}`
        );
      });
    });
  }
};

export const commands: Record<string, string> = {
  cd: "Changes the current directory.",
  clear: "Clears the screen.",
  color: "Specifies color attribute of console output.",
  copy: "Copies a file to another location.",
  date: "Displays the date.",
  del: "Deletes a file.",
  dir: "Displays list of entries in current directory.",
  echo: "Displays messages that are passed to it.",
  base64: "Base64 encode (or -d to decode) a file.",
  basename: "Strips the directory from a path.",
  dirname: "Strips the last component from a path.",
  env: "Displays environment variables.",
  grep: "Prints lines in a file matching a pattern.",
  head: "Outputs the first lines of a file (-n N).",
  hexdump: "Displays a file as hexadecimal + ASCII (also xxd).",
  hostname: "Displays the host name.",
  man: "Displays the manual entry for a command.",
  nl: "Numbers the lines of a file.",
  rev: "Reverses each line of a file.",
  seq: "Prints a sequence of numbers.",
  sha256sum: "SHA-256 checksum of a file (also sha1sum/sha512sum).",
  sleep: "Pauses for the given number of seconds.",
  sort: "Sorts the lines of a file.",
  tac: "Prints the lines of a file in reverse.",
  tail: "Outputs the last lines of a file (-n N).",
  uname: "Prints system information (-a for all).",
  uniq: "Filters adjacent duplicate lines.",
  wc: "Counts lines, words and bytes of a file.",
  which: "Locates a command.",
  stat: "Show a file's metadata (type, size, modified time).",
  df: "Show SecurityOS filesystem usage (IndexedDB quota).",
  du: "Disk usage of a file/folder (recursive). -s for a summary total.",
  tree: "Print a directory tree (depth-limited).",
  curl: "Fetch a URL through the Tor proxy and print it: curl <url>.",
  wget: "Download a URL through the Tor proxy to a file: wget <url> [-O name].",
  encrypt: "Vaptvupt-encrypt a file/folder → .zupt: encrypt <path> <password>.",
  decrypt: "Decrypt a Vaptvupt .zupt file: decrypt <path.zupt> <password>.",
  vaptvupt: "Vaptvupt encryption (.zupt): vaptvupt encrypt|decrypt <path> <password>.",
  evelin: "Evelin post-quantum SSH (info — the native binary runs in the Linux VM).",
  tails: "Boot a live security ISO in the Linux VM (amnesic). Opens Virtual x86.",
  liveos: "Boot a live security ISO in the Linux VM (amnesic). Opens Virtual x86.",
  fish: "The friendly interactive shell (inside a Linux live ISO / the VM).",
  fastfetch: "System info tool (inside a Linux live ISO / the VM).",
  exit: "Quits the command interpreter.",
  ffmpeg: "Convert audio or video file to another format.",
  file: "Detects the MIME type of the file.",
  find: "Searches for a text string in a file or files.",
  git: "Read from git repositories.",
  help: "Provides Help information for commands.",
  history: "Displays command history list.",
  imagemagick: "Convert an image file to another format.",
  ipconfig: "Displays current IP.",
  license: "Displays license.",
  md: "Creates a directory.",
  mount: "Mounts a local file system directory.",
  move: "Moves file or directory.",
  neofetch: "Displays system information.",
  pwd: "Prints the working directory.",
  python: "Run code through Python interpreter.",
  rd: "Removes a directory.",
  ren: "Renames a file or directory.",
  rm: "Removes a file or directory.",
  sheep: "Spawn a new sheep",
  shutdown: "Allows proper local shutdown of machine.",
  taskkill: "Kill or stop a running process or application.",
  tasklist: "Displays all currently running processes.",
  time: "Displays the system time.",
  title: "Sets the window title for the command interpreter.",
  touch: "Create empty file.",
  type: "Displays the contents of a file.",
  uptime: "Display the current uptime of the local system.",
  ver: "Displays the system version.",
  wapm: "Run universal Wasm binaries.",
  weather: "Weather forecast service",
  whoami: "Displays user information.",
  xlsx: "Convert a spreadsheet file to another format.",
};

export const aliases: Record<string, string[]> = {
  cd: ["chdir"],
  clear: ["cls"],
  copy: ["cp"],
  del: ["erase"],
  dir: ["ls"],
  exit: ["quit"],
  find: ["search"],
  git: ["isogit"],
  ipconfig: ["ifconfig", "whatsmyip"],
  md: ["mkdir"],
  move: ["mv"],
  neofetch: ["systeminfo"],
  python: ["py"],
  rd: ["rmdir"],
  ren: ["rename"],
  sheep: ["esheep"],
  shutdown: ["logout", "restart"],
  taskkill: ["kill"],
  tasklist: ["ps"],
  type: ["cat"],
  ver: ["version"],
  wapm: ["wax"],
  weather: ["wttr"],
};

const directoryCommands = new Set([
  "cat",
  "cd",
  "chdir",
  "copy",
  "cp",
  "del",
  "dir",
  "erase",
  "ffmpeg",
  "file",
  "imagemagick",
  "ls",
  "md",
  "mkdir",
  "move",
  "mv",
  "rd",
  "ren",
  "rename",
  "rm",
  "rmdir",
  "touch",
  "type",
  "vim",
  "xlsx",
]);

export const unknownCommand = (baseCommand: string): string =>
  `'${baseCommand}' is not recognized as an internal or external command, operable program or batch file.`;

export const autoComplete = (
  directory: string[],
  localEcho: LocalEcho
): void => {
  const { _autocompleteHandlers: handlers } = localEcho;

  handlers.forEach(({ fn }) => localEcho.removeAutocompleteHandler(fn));

  localEcho.addAutocompleteHandler((index: number, [command]): string[] => {
    if (index === 0) {
      return [...Object.keys(commands), ...directory];
    }
    if (index === 1) {
      const lowerCommand = command.toLowerCase();

      if (lowerCommand === "git") return Object.keys(gitCommands);
      if (directoryCommands.has(lowerCommand)) return directory;

      const lowerProcesses = Object.keys(processDirectory).map((pid) =>
        pid.toLowerCase()
      );

      if (lowerProcesses.includes(lowerCommand)) return directory;
    }

    return [];
  });
};

export const parseCommand = (commandString: string): string[] => {
  let readingQuotedArg = false;
  let currentArg = "";
  const addArg = (acc: string[]): void => {
    if (currentArg) acc.push(currentArg);
    currentArg = "";
  };
  const parsedCommand = [...commandString].reduce<string[]>((acc, char) => {
    if (char === " " && !readingQuotedArg) addArg(acc);
    else if (char === '"') {
      readingQuotedArg = !readingQuotedArg;
      if (!readingQuotedArg) addArg(acc);
    } else {
      currentArg += char;
    }

    return acc;
  }, []);

  return currentArg ? [...parsedCommand, currentArg] : parsedCommand;
};

export const printTable = (
  headers: [string, number, boolean?, ((value: string) => string)?][],
  data: string[][],
  localEcho?: LocalEcho,
  hideHeader?: boolean,
  paddingCharacter = "="
): void => {
  if (!hideHeader) {
    const header = headers
      .map(([key, padding]) => key.padEnd(padding, " "))
      .join(" ");
    const divider = headers
      .map(([, padding]) => paddingCharacter.repeat(padding))
      .join(" ");

    localEcho?.println(header);
    localEcho?.println(divider);
  }

  const content = data.map((row) =>
    row
      .map((rowData, index) => {
        const [, padding, alignRight, modifier] = headers[index];
        let trunctatedText =
          index === row.length - 1 ? rowData : rowData.slice(0, padding);

        if (modifier) trunctatedText = modifier(trunctatedText);

        return alignRight
          ? trunctatedText.padStart(padding, " ")
          : trunctatedText.padEnd(padding, " ");
      })
      .join(" ")
  );

  if (content.length > 0) content.forEach((entry) => localEcho?.println(entry));
};

export const getFreeSpace = async (): Promise<string> => {
  const { quota = 0, usage = 0 } =
    (await navigator.storage?.estimate?.()) || {};

  if (quota === 0) return "";

  return `  ${(quota - usage).toLocaleString()} bytes`;
};

export const getUptime = (isShort = false): string => {
  if (window.performance) {
    const [{ duration }] = window.performance.getEntriesByType("navigation");
    const bootTime = window.performance.timeOrigin + duration;
    const uptimeInMilliseconds = Math.ceil(Date.now() - bootTime);
    const days = Math.floor(uptimeInMilliseconds / ONE_DAY_IN_MILLISECONDS);
    const uptime = new Date(uptimeInMilliseconds);
    const hours = uptime.getUTCHours();
    const mins = uptime.getUTCMinutes();
    const secs = uptime.getUTCSeconds();

    return [
      ...(days ? [`${days} day${days === 1 ? "" : "s"}`] : []),
      ...(hours ? [`${hours} hour${hours === 1 ? "" : "s"}`] : []),
      ...(mins
        ? [`${mins} ${isShort ? "min" : "minute"}${mins === 1 ? "" : "s"}`]
        : []),
      ...(secs
        ? [`${secs} ${isShort ? "sec" : "second"}${secs === 1 ? "" : "s"}`]
        : []),
    ].join(", ");
  }

  return "Unknown";
};

export const printColor = (
  colorIndex: number | string,
  colorOutput?: string[]
): string =>
  `${rgbAnsi(...colorAttributes[colorIndex].rgb, true)}${rgbAnsi(
    ...colorAttributes[colorIndex].rgb
  )}|||${
    colorOutput?.join("") ||
    `${rgbAnsi(...colorAttributes[0].rgb, true)}${rgbAnsi(
      ...colorAttributes[7].rgb
    )}`
  }`;
