import { colorAttributes, rgbAnsi } from "components/apps/Terminal/color";
import { config, PI_ASCII } from "components/apps/Terminal/config";
import {
  aliases,
  autoComplete,
  commands,
  getFreeSpace,
  getUptime,
  help,
  parseCommand,
  printColor,
  printTable,
  unknownCommand,
} from "components/apps/Terminal/functions";
import loadWapm from "components/apps/Terminal/loadWapm";
import processGit from "components/apps/Terminal/processGit";
import { runPython } from "components/apps/Terminal/python";
import type {
  CommandInterpreter,
  LocalEcho,
} from "components/apps/Terminal/types";
import {
  displayLicense,
  displayVersion,
} from "components/apps/Terminal/useTerminal";
import extensions from "components/system/Files/FileEntry/extensions";
import {
  getModifiedTime,
  getProcessByFileExtension,
  getShortcutInfo,
} from "components/system/Files/FileEntry/functions";
import { useFileSystem } from "contexts/fileSystem";
import { requestPermission, resetStorage } from "contexts/fileSystem/functions";
import { useProcesses } from "contexts/process";
import processDirectory from "contexts/process/directory";
import { useProcessesRef } from "hooks/useProcessesRef";
import { basename, dirname, extname, isAbsolute, join } from "path";
import { useCallback, useEffect, useRef } from "react";
import { useTheme } from "styled-components";
import type UAParser from "ua-parser-js";
import {
  DEFAULT_LOCALE,
  DESKTOP_PATH,
  HIGH_PRIORITY_REQUEST,
  isFileSystemMappingSupported,
  MILLISECONDS_IN_SECOND,
  PACKAGE_DATA,
  SHORTCUT_EXTENSION,
} from "utils/constants";
import { transcode } from "utils/ffmpeg";
import { getTZOffsetISOString, loadFiles } from "utils/functions";
import { convert } from "utils/imagemagick";
import { getIpfsFileName, getIpfsResource } from "utils/ipfs";
import { fullSearch } from "utils/search";
import { convertSheet } from "utils/sheetjs";
import type { Terminal } from "xterm";

const COMMAND_NOT_SUPPORTED = "The system does not support the command.";
const FILE_NOT_FILE = "The system cannot find the file specified.";
const PATH_NOT_FOUND = "The system cannot find the path specified.";
const SYNTAX_ERROR = "The syntax of the command is incorrect.";

const { alias } = PACKAGE_DATA;

type WindowPerformance = Performance & {
  memory: {
    jsHeapSizeLimit: number;
    totalJSHeapSize: number;
  };
};

type IResultWithGPU = UAParser.IResult & { gpu: UAParser.IDevice };

declare global {
  interface Window {
    UAParser: UAParser;
  }
}

const useCommandInterpreter = (
  id: string,
  cd: React.MutableRefObject<string>,
  terminal?: Terminal,
  localEcho?: LocalEcho
): React.MutableRefObject<CommandInterpreter> => {
  const {
    createPath,
    deletePath,
    exists,
    fs,
    lstat,
    mapFs,
    mkdirRecursive,
    readdir,
    readFile,
    rename,
    rootFs,
    stat,
    updateFolder,
  } = useFileSystem();
  const { closeWithTransition, open, title: changeTitle } = useProcesses();
  const processesRef = useProcessesRef();
  const { name: themeName } = useTheme();
  const getFullPath = useCallback(
    async (file: string, writePath?: string): Promise<string> => {
      if (!file) return "";

      if (file.startsWith("ipfs://")) {
        const ipfsData = await getIpfsResource(file);
        const ipfsFile = join(
          DESKTOP_PATH,
          await createPath(
            await getIpfsFileName(file, ipfsData),
            writePath || DESKTOP_PATH,
            ipfsData
          )
        );

        updateFolder(writePath || DESKTOP_PATH, basename(ipfsFile));

        return ipfsFile;
      }

      return isAbsolute(file) ? file : join(cd.current, file);
    },
    [cd, createPath, updateFolder]
  );
  const colorOutput = useRef<string[]>([]);
  const updateFile = useCallback(
    (filePath: string, isDeleted = false): void => {
      const dirPath = dirname(filePath);

      if (isDeleted) {
        updateFolder(dirPath, undefined, basename(filePath));
      } else {
        updateFolder(dirPath, basename(filePath));
      }
    },
    [updateFolder]
  );
  const commandInterpreter = useCallback(
    async (command = ""): Promise<string> => {
      const [baseCommand = "", ...commandArgs] = parseCommand(command);
      const lcBaseCommand = baseCommand.toLowerCase();
      const readArgFile = async (
        file?: string
      ): Promise<string | undefined> => {
        if (!file) return undefined;

        const filePath = await getFullPath(file);

        return (await exists(filePath)) &&
          !(await lstat(filePath)).isDirectory()
          ? (await readFile(filePath)).toString()
          : undefined;
      };

      // eslint-disable-next-line sonarjs/max-switch-cases
      switch (lcBaseCommand) {
        case "cat":
        case "type": {
          const [file] = commandArgs;

          if (file) {
            const fullPath = await getFullPath(file);

            if (await exists(fullPath)) {
              if ((await lstat(fullPath)).isDirectory()) {
                localEcho?.println("Access is denied.");
              } else {
                localEcho?.println((await readFile(fullPath)).toString());
              }
            } else {
              localEcho?.println(PATH_NOT_FOUND);
            }
          } else {
            localEcho?.println(SYNTAX_ERROR);
          }
          break;
        }
        case "cd":
        case "cd/":
        case "cd.":
        case "cd..":
        case "chdir":
        case "pwd": {
          const [directory] =
            lcBaseCommand.startsWith("cd") && lcBaseCommand.length > 2
              ? [lcBaseCommand.slice(2)]
              : commandArgs;

          if (directory && lcBaseCommand !== "pwd") {
            const fullPath = await getFullPath(directory);

            if (await exists(fullPath)) {
              if (!(await lstat(fullPath)).isDirectory()) {
                localEcho?.println("The directory name is invalid.");
              } else if (cd.current !== fullPath && localEcho) {
                // eslint-disable-next-line no-param-reassign
                cd.current = fullPath;
              }
            } else {
              localEcho?.println(PATH_NOT_FOUND);
            }
          } else {
            localEcho?.println(cd.current);
          }
          break;
        }
        case "color": {
          const [r, g, b] = commandArgs;

          if (r !== undefined && g !== undefined && b !== undefined) {
            localEcho?.print(rgbAnsi(Number(r), Number(g), Number(b)));
          } else {
            const [[bg, fg] = []] = commandArgs;
            const { rgb: bgRgb, name: bgName } =
              colorAttributes[bg?.toUpperCase()] || {};
            const { rgb: fgRgb, name: fgName } =
              colorAttributes[fg?.toUpperCase()] || {};

            if (bgRgb) {
              const useAsBg = Boolean(fgRgb);
              const bgAnsi = rgbAnsi(...bgRgb, useAsBg);

              localEcho?.print(bgAnsi);
              localEcho?.println(
                `${useAsBg ? "Background" : "Foreground"}: ${bgName}`
              );
              colorOutput.current[0] = bgAnsi;
            }

            if (fgRgb) {
              const fgAnsi = rgbAnsi(...fgRgb);

              localEcho?.print(fgAnsi);
              localEcho?.println(`Foreground: ${fgName}`);
              colorOutput.current[1] = fgAnsi;
            }

            if (!fgRgb && !bgRgb) {
              localEcho?.print("\u001B[0m");
              colorOutput.current = [];
            }
          }
          break;
        }
        case "copy":
        case "cp": {
          const [source, destination] = commandArgs;
          const fullSourcePath = await getFullPath(source);

          if (await exists(fullSourcePath)) {
            if (destination) {
              const fullDestinationPath = await getFullPath(destination);
              const dirName = dirname(fullDestinationPath);

              updateFile(
                join(
                  dirName,
                  await createPath(
                    basename(fullDestinationPath),
                    dirName,
                    await readFile(fullSourcePath)
                  )
                )
              );
              localEcho?.println("\t1 file(s) copied.");
            } else {
              localEcho?.println("The file cannot be copied onto itself.");
              localEcho?.println("\t0 file(s) copied.");
            }
          } else {
            localEcho?.println(FILE_NOT_FILE);
          }
          break;
        }
        case "clear":
        case "cls":
          terminal?.reset();
          terminal?.write(`\u001Bc${colorOutput.current.join("")}`);
          break;
        case "date":
          localEcho?.println(
            `The current date is: ${getTZOffsetISOString().slice(0, 10)}`
          );
          break;
        case "del":
        case "erase":
        case "rd":
        case "rm":
        case "rmdir": {
          const [commandPath] = commandArgs;

          if (commandPath) {
            const fullPath = await getFullPath(commandPath);

            if (await exists(fullPath)) {
              await deletePath(fullPath);
              updateFile(fullPath, true);
            }
          }
          break;
        }
        case "dir":
        case "ls": {
          const [directory = ""] = commandArgs;
          const listDir = async (dirPath: string): Promise<void> => {
            let totalSize = 0;
            let fileCount = 0;
            let directoryCount = 0;
            let entries = await readdir(dirPath);

            if (
              entries.length === 0 &&
              rootFs?.mntMap[dirPath]?.getName() === "FileSystemAccess"
            ) {
              await requestPermission(dirPath);
              entries = await readdir(dirPath);
            }

            const timeFormatter = new Intl.DateTimeFormat(DEFAULT_LOCALE, {
              timeStyle: "short",
            });
            const entriesWithStats = await Promise.all(
              entries
                .filter(
                  (entry) =>
                    (!directory.startsWith("*") ||
                      entry.endsWith(directory.slice(1))) &&
                    (!directory.endsWith("*") ||
                      entry.startsWith(directory.slice(0, -1)))
                )
                .map(async (entry) => {
                  const filePath = join(dirPath, entry);
                  const fileStats = await stat(filePath);
                  const mDate = new Date(getModifiedTime(filePath, fileStats));
                  const date = mDate.toISOString().slice(0, 10);
                  const time = timeFormatter.format(mDate).padStart(8, "0");
                  const isDirectory = fileStats.isDirectory();

                  totalSize += isDirectory ? 0 : fileStats.size;
                  if (isDirectory) {
                    directoryCount += 1;
                  } else {
                    fileCount += 1;
                  }

                  return [
                    `${date}  ${time}`,
                    isDirectory
                      ? "<DIR>        "
                      : fileStats.size.toLocaleString(),
                    entry,
                  ];
                })
            );
            localEcho?.println(` Directory of ${dirPath}`);
            localEcho?.println("");

            const fullSizeTerminal =
              !localEcho?._termSize?.cols || localEcho?._termSize?.cols > 52;

            printTable(
              [
                ["Date", fullSizeTerminal ? 22 : 20],
                [
                  "Type/Size",
                  fullSizeTerminal ? 15 : 13,
                  true,
                  (size) => (size === "-1" ? "" : size),
                ],
                ["Name", terminal?.cols ? terminal.cols - 40 : 30],
              ],
              entriesWithStats,
              localEcho,
              true
            );
            localEcho?.println(
              `\t\t${fileCount} File(s)\t${totalSize.toLocaleString()} bytes`
            );
            localEcho?.println(
              `\t\t${directoryCount} Dir(s)${await getFreeSpace()}`
            );
          };

          if (
            directory &&
            !directory.startsWith("*") &&
            !directory.endsWith("*")
          ) {
            const fullPath = await getFullPath(directory);

            if (await exists(fullPath)) {
              if ((await lstat(fullPath)).isDirectory()) {
                await listDir(fullPath);
              } else {
                localEcho?.println(basename(fullPath));
              }
            } else {
              localEcho?.println("File Not Found");
            }
          } else {
            await listDir(cd.current);
          }
          break;
        }
        case "echo":
          localEcho?.println(command.slice(command.indexOf(" ") + 1));
          break;
        case "exit":
        case "quit":
          closeWithTransition(id);
          break;
        case "file": {
          const [commandPath] = commandArgs;

          if (commandPath) {
            const fullPath = await getFullPath(commandPath);

            if (await exists(fullPath)) {
              const { fileTypeFromBuffer } = await import("file-type");
              const { mime = "Unknown" } =
                (await fileTypeFromBuffer(await readFile(fullPath))) || {};

              localEcho?.println(`${commandPath}: ${mime}`);
            }
          }
          break;
        }
        case "find":
        case "search": {
          const results = await fullSearch(
            commandArgs.join(" "),
            readFile,
            rootFs
          );
          results?.forEach(({ ref }) => localEcho?.println(ref));
          break;
        }
        case "ffmpeg":
        case "imagemagick": {
          const [file, format] = commandArgs;

          if (file && format) {
            const fullPath = await getFullPath(file);

            if (
              (await exists(fullPath)) &&
              !(await lstat(fullPath)).isDirectory()
            ) {
              const convertOrTranscode =
                lcBaseCommand === "ffmpeg" ? transcode : convert;
              const [[newName, newData]] = await convertOrTranscode(
                [[basename(fullPath), await readFile(fullPath)]],
                format,
                localEcho
              );

              if (newName && newData) {
                const dirName = dirname(fullPath);

                updateFile(
                  join(dirName, await createPath(newName, dirName, newData))
                );
              }
            } else {
              localEcho?.println(FILE_NOT_FILE);
            }
          } else {
            localEcho?.println(SYNTAX_ERROR);
          }
          break;
        }
        case "git":
        case "isogit":
          if (fs && localEcho) {
            await processGit(
              commandArgs,
              cd.current,
              localEcho,
              fs,
              updateFolder
            );
          }
          break;
        case "help": {
          const [commandName] = commandArgs;

          if (localEcho) {
            const showAliases = commandName === "-a";

            if (commandName && !showAliases) {
              const helpCommand = commands[commandName]
                ? commandName
                : Object.entries(aliases).find(
                    ([, [baseCommandName]]) => baseCommandName === commandName
                  )?.[0];

              if (helpCommand && commands[helpCommand]) {
                localEcho.println(commands[helpCommand]);
              } else {
                localEcho.println(
                  "This command is not supported by the help utility."
                );
              }
            } else {
              help(localEcho, commands, showAliases ? aliases : undefined);
            }
          }
          break;
        }
        case "history":
          localEcho?.history.entries.forEach((entry, index) =>
            localEcho.println(`${(index + 1).toString().padStart(4)} ${entry}`)
          );
          break;
        case "ipfs": {
          const [commandName, cid] = commandArgs;

          if (commandName === "get" && cid) {
            await getFullPath(`ipfs://${cid}`, cd.current);
          }

          break;
        }
        case "ifconfig":
        case "ipconfig":
        case "whatsmyip": {
          const cloudFlareIpTraceText =
            (await (
              await fetch("https://cloudflare.com/cdn-cgi/trace")
            ).text()) || "";
          const { ip = "" } = Object.fromEntries(
            cloudFlareIpTraceText
              .trim()
              .split("\n")
              .map((entry) => entry.split("=")) || []
          ) as Record<string, string>;
          const isValidIp = (possibleIp: string): boolean => {
            const octets = possibleIp.split(".");

            return (
              octets.length === 4 &&
              octets.map(Number).every((octet) => octet > 0 && octet < 256)
            );
          };

          localEcho?.println("IP Configuration");
          localEcho?.println("");
          localEcho?.println(
            `   IPv4 Address. . . . . . . . . . . : ${
              isValidIp(ip) ? ip : "Unknown"
            }`
          );
          break;
        }
        case "kill":
        case "taskkill": {
          const [processName] = commandArgs;

          if (processesRef.current[processName]) {
            closeWithTransition(processName);
            localEcho?.println(
              `SUCCESS: Sent termination signal to the process "${processName}".`
            );
          } else {
            localEcho?.println(
              `ERROR: The process "${processName}" not found.`
            );
          }
          break;
        }
        case "license":
          localEcho?.println(displayLicense);
          break;
        case "md":
        case "mkdir": {
          const [directory] = commandArgs;

          if (directory) {
            const fullPath = await getFullPath(directory);

            await mkdirRecursive(fullPath);
            updateFile(fullPath);
          }
          break;
        }
        case "mount":
          if (localEcho) {
            if (isFileSystemMappingSupported()) {
              try {
                const mappedFolder = await mapFs(cd.current);

                if (mappedFolder) {
                  const fullPath = join(cd.current, mappedFolder);

                  updateFolder(cd.current, mappedFolder);

                  // eslint-disable-next-line no-param-reassign
                  cd.current = fullPath;
                }
              } catch {
                // Ignore failure to mount
              }
            } else {
              localEcho?.println(COMMAND_NOT_SUPPORTED);
            }
          }
          break;
        case "move":
        case "mv":
        case "ren":
        case "rename": {
          const [source, destination] = commandArgs;
          const fullSourcePath = await getFullPath(source);

          if (await exists(fullSourcePath)) {
            if (destination) {
              let fullDestinationPath = await getFullPath(destination);

              if (
                ["move", "mv"].includes(lcBaseCommand) &&
                (await stat(fullDestinationPath)).isDirectory()
              ) {
                fullDestinationPath = join(
                  fullDestinationPath,
                  basename(fullSourcePath)
                );
              }

              await rename(fullSourcePath, fullDestinationPath);
              updateFile(fullSourcePath, true);
              updateFile(fullDestinationPath);
            } else {
              localEcho?.println(SYNTAX_ERROR);
            }
          } else {
            localEcho?.println(FILE_NOT_FILE);
          }
          break;
        }
        case "neofetch":
        case "systeminfo": {
          await loadFiles(["/Program Files/Xterm.js/ua-parser.js"]);

          const {
            browser,
            cpu,
            engine,
            gpu,
            os: hostOS,
          } = (new window.UAParser().getResult() || {}) as IResultWithGPU;
          const { cols, options } = terminal || {};
          const userId = `public@${window.location.hostname}`;
          const terminalFont = (options?.fontFamily || config.fontFamily)
            ?.split(", ")
            .find((font) =>
              document.fonts.check(
                `${options?.fontSize || config.fontSize || 12}px ${font}`
              )
            );
          const { quota = 0, usage = 0 } =
            (await navigator.storage?.estimate?.()) || {};
          const labelColor = 3;
          const labelText = (text: string): string =>
            `${rgbAnsi(...colorAttributes[labelColor].rgb)}${text}${
              colorOutput.current?.[0] || rgbAnsi(...colorAttributes[7].rgb)
            }`;
          const output = [
            userId,
            Array.from({ length: userId.length }).fill("-").join(""),
            `OS: ${alias} ${displayVersion()}`,
          ];

          if (hostOS?.name) {
            output.push(
              `Host: ${hostOS.name}${
                hostOS?.version ? ` ${hostOS.version}` : ""
              }${cpu?.architecture ? ` ${cpu?.architecture}` : ""}`
            );
          }

          if (browser?.name) {
            output.push(
              `Kernel: ${browser.name}${
                browser?.version ? ` ${browser.version}` : ""
              }${engine?.name ? ` (${engine.name})` : ""}`
            );
          }

          output.push(
            `Uptime: ${getUptime(true)}`,
            `Packages: ${Object.keys(processDirectory).length}`,
            `Resolution: ${window.screen.width}x${window.screen.height}`,
            `Theme: ${themeName}`
          );

          if (terminalFont) {
            output.push(`Terminal Font: ${terminalFont}`);
          }

          if (gpu?.vendor) {
            output.push(
              `GPU: ${gpu.vendor}${gpu?.model ? ` ${gpu.model}` : ""}`
            );
          } else if (gpu?.model) {
            output.push(`GPU: ${gpu.model}`);
          }

          if (window.performance && "memory" in window.performance) {
            output.push(
              `Memory: ${(
                (window.performance as WindowPerformance).memory
                  .totalJSHeapSize /
                1024 /
                1024
              ).toFixed(0)}MB / ${(
                (window.performance as WindowPerformance).memory
                  .jsHeapSizeLimit /
                1024 /
                1024
              ).toFixed(0)}MB`
            );
          }

          if (quota) {
            output.push(
              `Disk (/): ${(usage / 1024 / 1024 / 1024).toFixed(0)}G / ${(
                quota /
                1024 /
                1024 /
                1024
              ).toFixed(0)}G (${((usage / quota) * 100).toFixed(2)}%)`
            );
          }

          const longestLineLength = output.reduce(
            (max, line) => Math.max(max, line.length),
            0
          );
          const maxCols = cols || config.cols || 70;

          if (localEcho) {
            const longestLine = PI_ASCII[0].length + longestLineLength;
            const imgPadding = Math.max(Math.min(maxCols - longestLine, 3), 1);

            output.push(
              "\n",
              [0, 4, 2, 6, 1, 5, 3, 7]
                .map((color) => printColor(color, colorOutput.current))
                .join(""),
              [8, "C", "A", "E", 9, "D", "B", "F"]
                .map((color) => printColor(color, colorOutput.current))
                .join("")
            );
            PI_ASCII.forEach((imgLine, lineIndex) => {
              let outputLine = output[lineIndex] || "";

              if (lineIndex === 0) {
                const [user, system] = outputLine.split("@");

                outputLine = `${labelText(user)}@${labelText(system)}`;
              } else {
                const [label, info] = outputLine.split(":");

                if (info) {
                  outputLine = `${labelText(label)}:${info}`;
                }
              }

              localEcho.println(
                `${labelText(imgLine)}${
                  outputLine.padStart(outputLine.length + imgPadding, " ") || ""
                }`
              );
            });
          }
          break;
        }
        case "sheep":
        case "esheep": {
          const { default: spawnSheep } = await import("utils/spawnSheep");
          let [count = 1, duration = 0] = commandArgs;

          if (!Number.isNaN(count) && !Number.isNaN(duration)) {
            count = Number(count);
            duration = Number(duration);

            if (count > 1) {
              await spawnSheep();
              count -= 1;
            }

            const maxDuration =
              (duration || (count > 1 ? 1 : 0)) * MILLISECONDS_IN_SECOND;

            Array.from({ length: count })
              .fill(0)
              .map(() => Math.floor(Math.random() * maxDuration))
              .forEach((delay) => setTimeout(spawnSheep, delay));
          }
          break;
        }
        case "ps":
        case "tasklist":
          printTable(
            [
              ["PID", 30],
              ["Title", 25],
            ],
            Object.entries(processesRef.current).map(([pid, { title }]) => [
              pid,
              title,
            ]),
            localEcho
          );
          break;
        case "py":
        case "python":
          if (localEcho) {
            const [file] = commandArgs;
            const fullSourcePath = await getFullPath(file);

            if (await exists(fullSourcePath)) {
              const code = await readFile(fullSourcePath);

              await runPython(code.toString(), localEcho);
            } else {
              await runPython(
                command.slice(command.indexOf(" ") + 1),
                localEcho
              );
            }
          }
          break;
        case "logout":
        case "restart":
        case "shutdown":
          resetStorage(rootFs).finally(() => window.location.reload());
          break;
        case "time":
          localEcho?.println(
            `The current time is: ${getTZOffsetISOString().slice(11, 22)}`
          );
          break;
        case "title":
          changeTitle(id, command.slice(command.indexOf(" ") + 1));
          break;
        case "touch": {
          const [file] = commandArgs;

          if (file) {
            const fullPath = await getFullPath(file);
            const dirName = dirname(fullPath);

            updateFile(
              join(
                dirName,
                await createPath(basename(fullPath), dirName, Buffer.from(""))
              )
            );
          }
          break;
        }
        case "uptime":
          localEcho?.println(`Uptime: ${getUptime()}`);
          break;
        case "ver":
        case "version":
          localEcho?.println(displayVersion());
          break;
        case "wapm":
        case "wax":
          if (localEcho) await loadWapm(commandArgs, localEcho);
          break;
        case "weather":
        case "wttr": {
          const response = await fetch(
            "https://wttr.in/?1nAF",
            HIGH_PRIORITY_REQUEST
          );

          localEcho?.println(await response.text());

          const [bgAnsi, fgAnsi] = colorOutput.current;

          if (bgAnsi) localEcho?.print(bgAnsi);
          if (fgAnsi) localEcho?.print(fgAnsi);
          break;
        }
        case "whoami":
          localEcho?.println(`${window.location.hostname}\\public`);
          break;
        case "xlsx": {
          const [file, format = "xlsx"] = commandArgs;

          if (file && format) {
            const fullPath = await getFullPath(file);

            if (
              (await exists(fullPath)) &&
              !(await lstat(fullPath)).isDirectory()
            ) {
              const workBook = await convertSheet(
                await readFile(fullPath),
                format
              );
              const dirName = dirname(fullPath);

              updateFile(
                join(
                  dirName,
                  await createPath(
                    `${basename(file, extname(file))}.${format}`,
                    dirName,
                    Buffer.from(workBook)
                  )
                )
              );
            } else {
              localEcho?.println(FILE_NOT_FILE);
            }
          } else {
            localEcho?.println(SYNTAX_ERROR);
          }
          break;
        }
        case "grep": {
          const [pattern, file] = commandArgs;
          const text = await readArgFile(file);

          if (text === undefined) {
            localEcho?.println(file ? PATH_NOT_FOUND : SYNTAX_ERROR);
          } else if (pattern) {
            let matcher: (line: string) => boolean;

            try {
              const regExp = new RegExp(pattern, "i");

              matcher = (line) => regExp.test(line);
            } catch {
              matcher = (line) => line.includes(pattern);
            }

            text.split("\n").forEach((line) => {
              if (matcher(line)) localEcho?.println(line);
            });
          } else {
            localEcho?.println(SYNTAX_ERROR);
          }
          break;
        }
        case "stat": {
          const [file] = commandArgs;
          const full = file ? await getFullPath(file) : "";

          if (!full || !(await exists(full))) {
            localEcho?.println(file ? PATH_NOT_FOUND : SYNTAX_ERROR);
          } else {
            const s = await lstat(full);

            localEcho?.println(`  File: ${full}`);
            localEcho?.println(
              `  Type: ${s.isDirectory() ? "directory" : "file"}    Size: ${
                s.size
              } bytes`
            );
            localEcho?.println(
              `  Modified: ${new Date(s.mtimeMs).toISOString()}`
            );
          }
          break;
        }
        case "df": {
          const est = (await navigator.storage?.estimate?.()) || {};
          const usage = est.usage || 0;
          const quota = est.quota || 0;
          const kb = (n: number): string =>
            Math.ceil(n / 1024).toLocaleString();
          const pct = quota ? Math.round((usage / quota) * 100) : 0;

          localEcho?.println(
            "Filesystem       1K-blocks       Used  Available  Use%  Mounted"
          );
          localEcho?.println(
            `SecurityOS-VFS  ${kb(quota).padStart(11)}  ${kb(usage).padStart(
              9
            )}  ${kb(Math.max(quota - usage, 0)).padStart(
              9
            )}  ${`${pct}%`.padStart(4)}  /`
          );
          break;
        }
        case "du":
        case "tree": {
          const target = commandArgs.find((a) => !a.startsWith("-")) || ".";
          const full = await getFullPath(target);

          if (!(await exists(full))) {
            localEcho?.println(PATH_NOT_FOUND);
            break;
          }

          const sizeOf = async (p: string): Promise<number> => {
            const s = await lstat(p);

            if (!s.isDirectory()) return s.size;

            const entries = await readdir(p);

            return entries.reduce<Promise<number>>(
              async (acc, e) => (await acc) + (await sizeOf(join(p, e))),
              Promise.resolve(0)
            );
          };

          if (lcBaseCommand === "tree") {
            const printTree = async (
              p: string,
              depth: number
            ): Promise<void> => {
              if (depth > 4 || !(await lstat(p)).isDirectory()) return;

              const entries = await readdir(p);

              await entries.reduce(async (chain, e) => {
                await chain;
                localEcho?.println(`${"  ".repeat(depth)}├── ${e}`);
                await printTree(join(p, e), depth + 1);
              }, Promise.resolve());
            };

            localEcho?.println(full);
            await printTree(full, 0);
          } else {
            const summary = commandArgs.includes("-s");

            if (!summary && (await lstat(full)).isDirectory()) {
              const entries = await readdir(full);

              await entries.reduce(async (chain, e) => {
                await chain;

                const entryPath = join(full, e);

                localEcho?.println(
                  `${Math.ceil((await sizeOf(entryPath)) / 1024)
                    .toString()
                    .padStart(8)}\t${entryPath}`
                );
              }, Promise.resolve());
            }
            localEcho?.println(
              `${Math.ceil((await sizeOf(full)) / 1024)
                .toString()
                .padStart(8)}\t${full}`
            );
          }
          break;
        }
        case "curl":
        case "wget": {
          const args = commandArgs.filter(Boolean);
          let outFile = "";
          const rest: string[] = [];

          for (let index = 0; index < args.length; index += 1) {
            if (args[index] === "-O" || args[index] === "-o") {
              index += 1;
              outFile = args[index] || "";
            } else {
              rest.push(args[index]);
            }
          }

          const url = rest.find((a) => /^https?:\/\//.test(a)) || rest[0];

          if (!url) {
            localEcho?.println(SYNTAX_ERROR);
            break;
          }

          localEcho?.println(`Fetching ${url} via Tor proxy …`);

          try {
            const response = await fetch(
              `/api/proxy?url=${encodeURIComponent(
                /^https?:\/\//.test(url) ? url : `https://${url}`
              )}`
            );
            const body = Buffer.from(await response.arrayBuffer());

            if (lcBaseCommand === "wget" || outFile) {
              const name =
                outFile || url.split("/").filter(Boolean).pop() || "index.html";
              const dest = await getFullPath(name);
              const created = await createPath(
                basename(dest),
                dirname(dest),
                body
              );

              updateFolder(dirname(dest), created || basename(dest));
              localEcho?.println(
                `Saved ${body.length} bytes → ${join(
                  dirname(dest),
                  created || basename(dest)
                )}`
              );
            } else {
              localEcho?.println(body.toString());
            }
          } catch {
            localEcho?.println("Request failed (proxy/Tor unreachable?).");
          }
          break;
        }
        case "head":
        case "tail": {
          let count = 10;
          let file = commandArgs[0];

          if (commandArgs[0] === "-n") {
            count = Number(commandArgs[1]) || 10;
            file = commandArgs[2];
          }

          const text = await readArgFile(file);

          if (text === undefined) {
            localEcho?.println(file ? PATH_NOT_FOUND : SYNTAX_ERROR);
          } else {
            const lines = text.replace(/\n$/, "").split("\n");

            (lcBaseCommand === "head"
              ? lines.slice(0, count)
              : lines.slice(-count)
            ).forEach((line) => localEcho?.println(line));
          }
          break;
        }
        case "wc": {
          const [file] = commandArgs;
          const text = await readArgFile(file);

          if (text === undefined) {
            localEcho?.println(file ? PATH_NOT_FOUND : SYNTAX_ERROR);
          } else {
            localEcho?.println(
              `${text.split("\n").length.toString().padStart(7)} ${text
                .split(/\s+/)
                .filter(Boolean)
                .length.toString()
                .padStart(7)} ${Buffer.byteLength(text)
                .toString()
                .padStart(7)} ${file}`
            );
          }
          break;
        }
        case "sort":
        case "tac":
        case "rev":
        case "nl":
        case "uniq": {
          const [file] = commandArgs;
          const text = await readArgFile(file);

          if (text === undefined) {
            localEcho?.println(file ? PATH_NOT_FOUND : SYNTAX_ERROR);
            break;
          }

          let lines = text.replace(/\n$/, "").split("\n");

          if (lcBaseCommand === "sort") lines = [...lines].sort();
          else if (lcBaseCommand === "tac") lines = [...lines].reverse();
          else if (lcBaseCommand === "rev") {
            lines = lines.map((line) => [...line].reverse().join(""));
          } else if (lcBaseCommand === "uniq") {
            lines = lines.filter((line, index) => line !== lines[index - 1]);
          } else if (lcBaseCommand === "nl") {
            lines = lines.map(
              (line, index) => `${(index + 1).toString().padStart(6)}\t${line}`
            );
          }

          lines.forEach((line) => localEcho?.println(line));
          break;
        }
        case "base64": {
          let decode = false;
          let file = commandArgs[0];

          if (file === "-d" || file === "--decode") {
            decode = true;
            file = commandArgs[1];
          }

          const text = await readArgFile(file);

          if (text === undefined) {
            localEcho?.println(file ? PATH_NOT_FOUND : SYNTAX_ERROR);
          } else {
            try {
              localEcho?.println(
                decode
                  ? Buffer.from(text.trim(), "base64").toString("utf8")
                  : Buffer.from(text).toString("base64")
              );
            } catch {
              localEcho?.println("base64: invalid input");
            }
          }
          break;
        }
        case "md5sum":
        case "sha1sum":
        case "sha256sum":
        case "sha512sum": {
          const [file] = commandArgs;
          const filePath = await getFullPath(file);

          if (file && (await exists(filePath))) {
            if (lcBaseCommand === "md5sum") {
              localEcho?.println(
                "md5sum: MD5 is unavailable in-browser — use sha256sum."
              );
            } else {
              const algorithm = {
                sha1sum: "SHA-1",
                sha256sum: "SHA-256",
                sha512sum: "SHA-512",
              }[lcBaseCommand] as AlgorithmIdentifier;
              const fileBuffer = await readFile(filePath);
              const digestInput = new Uint8Array(fileBuffer.byteLength);

              digestInput.set(fileBuffer);

              const digest = await crypto.subtle.digest(algorithm, digestInput);

              localEcho?.println(
                `${[...new Uint8Array(digest)]
                  .map((byte) => byte.toString(16).padStart(2, "0"))
                  .join("")}  ${file}`
              );
            }
          } else {
            localEcho?.println(file ? PATH_NOT_FOUND : SYNTAX_ERROR);
          }
          break;
        }
        case "xxd":
        case "hexdump": {
          const [file] = commandArgs;
          const filePath = await getFullPath(file);

          if (file && (await exists(filePath))) {
            const buffer = await readFile(filePath);
            const maxBytes = Math.min(buffer.length, 4096);

            for (let offset = 0; offset < maxBytes; offset += 16) {
              const slice = buffer.subarray(offset, offset + 16);

              localEcho?.println(
                `${offset.toString(16).padStart(8, "0")}: ${[...slice]
                  .map((byte) => byte.toString(16).padStart(2, "0"))
                  .join(" ")
                  .padEnd(47)}  ${[...slice]
                  .map((byte) =>
                    byte >= 32 && byte < 127 ? String.fromCharCode(byte) : "."
                  )
                  .join("")}`
              );
            }

            if (buffer.length > maxBytes) {
              localEcho?.println(
                `... (${buffer.length - maxBytes} more bytes)`
              );
            }
          } else {
            localEcho?.println(file ? PATH_NOT_FOUND : SYNTAX_ERROR);
          }
          break;
        }
        case "basename":
          localEcho?.println(basename(commandArgs[0] || ""));
          break;
        case "dirname":
          localEcho?.println(dirname(commandArgs[0] || ""));
          break;
        case "hostname":
          localEcho?.println(window.location.hostname);
          break;
        case "uname":
          localEcho?.println(
            commandArgs[0] === "-a"
              ? `SecurityOS ${
                  window.location.hostname
                } ${displayVersion()} browser x86_64 SecurityOS`
              : "SecurityOS"
          );
          break;
        case "env":
        case "printenv":
          [
            "USER=public",
            `HOSTNAME=${window.location.hostname}`,
            "HOME=/Users/Public",
            `PWD=${cd.current}`,
            "SHELL=/securityos/sh",
            "TERM=xterm-256color",
            `OS=${alias}`,
          ].forEach((line) => localEcho?.println(line));
          break;
        case "which": {
          const target = commandArgs[0]?.toLowerCase();
          const isKnown =
            Boolean(target) &&
            (Boolean(commands[target]) ||
              Boolean(aliases[target]) ||
              Object.keys(processDirectory).some(
                (process) => process.toLowerCase() === target
              ));

          localEcho?.println(
            isKnown ? `/securityos/bin/${target}` : `${target || ""}: not found`
          );
          break;
        }
        case "man": {
          const [name] = commandArgs;

          localEcho?.println(
            name && commands[name]
              ? commands[name]
              : `No manual entry for ${name || ""}`
          );
          break;
        }
        case "seq": {
          const nums = commandArgs.map(Number);
          let [start, step, end] = [1, 1, nums[0]];

          if (nums.length === 2) [start, end] = nums;
          else if (nums.length >= 3) [start, step, end] = nums;

          if (![start, step, end].every(Number.isFinite) || step === 0) {
            localEcho?.println(SYNTAX_ERROR);
            break;
          }

          let printed = 0;

          for (
            let value = start;
            step > 0 ? value <= end : value >= end;
            value += step
          ) {
            localEcho?.println(String(value));
            printed += 1;
            if (printed >= 100_000) break;
          }
          break;
        }
        case "sleep":
          await new Promise((resolve) => {
            setTimeout(
              resolve,
              Math.min(Number(commandArgs[0]) || 0, 30) * MILLISECONDS_IN_SECOND
            );
          });
          break;
        case "true":
        case "false":
          break;
        case "yes": {
          const message = commandArgs.join(" ") || "y";

          for (let index = 0; index < 1000; index += 1) {
            localEcho?.println(message);
          }
          break;
        }
        case "encrypt":
        case "decrypt":
        case "vaptvupt": {
          let action: string = lcBaseCommand;
          let cryptoArgs = commandArgs;

          if (lcBaseCommand === "vaptvupt") {
            action = (commandArgs[0] || "").toLowerCase();
            cryptoArgs = commandArgs.slice(1);
          }

          if (action !== "encrypt" && action !== "decrypt") {
            localEcho?.println(
              "Vaptvupt — real (WASM) file/folder encryption → .zupt (PBKDF2 → AES-256 + HMAC, quantum-resistant)."
            );
            localEcho?.println("  vaptvupt encrypt <path> <password>");
            localEcho?.println("  vaptvupt decrypt <path.zupt> <password>");
            localEcho?.println(
              "  (aliases: encrypt / decrypt <path> <password>)"
            );
            localEcho?.println(
              "For full VAPT + the native binary, run it in the Linux VM (V86 app)."
            );
            break;
          }

          const [target, password] = cryptoArgs;

          if (!target || !password) {
            localEcho?.println(`Usage: ${action} <path> <password>`);
            break;
          }

          const fullPath = await getFullPath(target);

          if (!(await exists(fullPath))) {
            localEcho?.println(PATH_NOT_FOUND);
            break;
          }

          const { decryptData, encryptData, ENCRYPTED_EXTENSION } =
            await import("utils/vaptvuptCrypto");
          const processFile = async (filePath: string): Promise<void> => {
            try {
              const data = await readFile(filePath);

              if (action === "encrypt") {
                const dest = `${filePath}${ENCRYPTED_EXTENSION}`;

                await createPath(
                  basename(dest),
                  dirname(dest),
                  await encryptData(data, password)
                );
                updateFile(dest);
                localEcho?.println(`  encrypted -> ${dest}`);
              } else {
                const dest = filePath.endsWith(ENCRYPTED_EXTENSION)
                  ? filePath.slice(0, -ENCRYPTED_EXTENSION.length)
                  : `${filePath}.dec`;

                await createPath(
                  basename(dest),
                  dirname(dest),
                  await decryptData(data, password)
                );
                updateFile(dest);
                localEcho?.println(`  decrypted -> ${dest}`);
              }
            } catch {
              localEcho?.println(
                `  FAILED (${
                  action === "decrypt"
                    ? "wrong password or not encrypted"
                    : "error"
                }): ${filePath}`
              );
            }
          };

          if ((await lstat(fullPath)).isDirectory()) {
            const entries = await readdir(fullPath);

            await entries.reduce(async (chain, entry) => {
              await chain;

              const entryPath = join(fullPath, entry);

              if (!(await lstat(entryPath)).isDirectory()) {
                await processFile(entryPath);
              }
            }, Promise.resolve());
          } else {
            await processFile(fullPath);
          }
          break;
        }
        case "evelin":
          localEcho?.println(
            "Evelin — post-quantum SSH successor (Rust, Protocol v2)."
          );
          localEcho?.println(
            "Native binary — run it inside the Linux VM (V86 app):"
          );
          localEcho?.println("  guix install evelin   (or build from source)");
          localEcho?.println(
            "Source: https://git.securityops.co/cristiancmoises/evelin"
          );
          break;
        case "tails":
        case "liveos":
          localEcho?.println(
            "SecurityOS Linux VM (v86) — boot a live security ISO, amnesic by default."
          );
          localEcho?.println("");
          localEcho?.println(
            "  1. Put a *32-bit (i686)* live .iso in your files, then open it with the"
          );
          localEcho?.println(
            "     Virtual x86 app (it boots from the CD; nothing is saved unless you do)."
          );
          localEcho?.println(
            "  2. Route the VM through Tor in the Tor Control app for anonymous browsing."
          );
          localEcho?.println("");
          localEcho?.println(
            "NOTE: v86 is a 32-bit emulator. Current TAILS is 64-bit only, so the real"
          );
          localEcho?.println(
            "TAILS.iso can't boot here — use a 32-bit amnesic/Tor live ISO, or run real"
          );
          localEcho?.println(
            "TAILS in a native VM. See docs/LIVE-ISO.md. Opening the VM…"
          );
          open("V86");
          break;
        case "fish":
          localEcho?.println(
            "fish — the friendly interactive shell; the DEFAULT login shell in the"
          );
          localEcho?.println(
            "SecurityOS Guix VM image. This JS terminal is a separate sandboxed shell."
          );
          localEcho?.println(
            "Boot the Guix VM (docs/GUIX-SETUP.md) for a real fish session."
          );
          break;
        case "fastfetch":
          localEcho?.println(
            "fastfetch — system info, shown automatically on login in the SecurityOS"
          );
          localEcho?.println(
            "Guix VM (fish runs it from ~/.config/fish/config.fish)."
          );
          localEcho?.println(
            "Boot the Guix VM (docs/GUIX-SETUP.md) to see it."
          );
          break;
        default:
          if (baseCommand) {
            const pid = Object.keys(processDirectory).find(
              (process) => process.toLowerCase() === lcBaseCommand
            );

            if (pid) {
              const [file] = commandArgs;
              const fullPath = await getFullPath(file);

              open(pid, {
                url:
                  file && fullPath && (await exists(fullPath)) ? fullPath : "",
              });
            } else if (await exists(baseCommand)) {
              const fileExtension = extname(baseCommand).toLowerCase();
              const { command: extCommand = "" } =
                extensions[fileExtension] || {};

              if (extCommand) {
                await commandInterpreter(`${extCommand} ${baseCommand}`);
              } else {
                let basePid = "";
                let baseUrl = baseCommand;

                if (fileExtension === SHORTCUT_EXTENSION) {
                  ({ pid: basePid, url: baseUrl } = getShortcutInfo(
                    await readFile(baseCommand)
                  ));
                } else {
                  basePid = getProcessByFileExtension(fileExtension);
                }

                if (basePid) open(basePid, { url: baseUrl });
              }
            } else {
              localEcho?.println(unknownCommand(baseCommand));
            }
          }
      }

      if (localEcho) {
        readdir(cd.current).then((files) => autoComplete(files, localEcho));
      }

      return cd.current;
    },
    [
      cd,
      changeTitle,
      closeWithTransition,
      createPath,
      deletePath,
      exists,
      fs,
      getFullPath,
      id,
      localEcho,
      lstat,
      mapFs,
      mkdirRecursive,
      open,
      processesRef,
      readFile,
      readdir,
      rename,
      rootFs,
      stat,
      terminal,
      themeName,
      updateFile,
      updateFolder,
    ]
  );
  const commandInterpreterRef = useRef<CommandInterpreter>(commandInterpreter);

  useEffect(() => {
    commandInterpreterRef.current = commandInterpreter;
  }, [commandInterpreter]);

  return commandInterpreterRef;
};

export default useCommandInterpreter;
