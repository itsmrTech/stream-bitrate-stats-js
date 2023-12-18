const { spawn } = require("node:child_process");

const OPTIONS_DEFAULT = {
  chunkSize: 5,
  verbose: false,
  streamType: "video",
  aggregation: "time",
  tries: 1,
};
/**
 * {id,index}
 */
let processes = [];
function getProcess(id) {
  return processes.find((item) => item.id === id);
}
function setProcess(process) {
  if (!process) throw new Error("Process is required.");
  const foundIndex = processes.findIndex((item) => item.id === process.id);
  if (foundIndex >= 0) {
    processes[foundIndex] = { ...process };
    return processes[foundIndex];
  } else {
    const newProcess = {
      id: processes.length,
      index: -1,
      process: process.process,
      options: process.options,
      killed: process.killed ?? false,
    };
    processes.push(newProcess);
    return newProcess;
  }
}

function defaultIterator(value, index) {
}
function killProcess(id) {
  const processData = getProcess(id);
  if (!processData.process) throw new Error("Process is not killable.");

  setProcess({ ...processData, killed: true });
  processData.process.kill();
}
function getStatsInternal(streamUrl, options, iterator, processData) {
  const command = spawn(
    "python",
    [
      "-m",
      "engine",
      `-c ${options.chunkSize}`,
      `${options.verbose === true ? "-v" : ""}`,
      `-s${options.streamType}`,
      `-a${options.aggregation}`,
      streamUrl,
    ].filter((item) => item !== "")
  );
  const newIndex = processData.index + 1;
  setProcess({
    ...processData,
    process: command,
    index: newIndex,
  });
  command.stdout.on("data", (output) => {
    try {
      iterator(JSON.parse(output.toString()), newIndex);
    } catch (e) {
      iterator(output.toString(), newIndex);
    }
  });
  command.stdout.on("close", () => {
    const latestProcessData = getProcess(processData.id);
    if (latestProcessData.killed === true) return;
    if (options.tries > 1)
      getStatsInternal(
        streamUrl,
        { ...options, tries: options.tries - 1 },
        iterator,
        getProcess(processData.id)
      );
    else if (options.tries === -1)
      getStatsInternal(
        streamUrl,
        { ...options, tries: options.tries },
        iterator,
        getProcess(processData.id)
      );
  });
  command.on("error", (error) => {
    throw new Error(error)
  });
  command.stderr.on("data", (error) => {
    console.error("error", error.toString());
  });
}

function getStats(
  streamUrl,
  options = OPTIONS_DEFAULT,
  iterator = defaultIterator
) {
  if (typeof options !== "object") throw new Error("Options are not valid.");
  let optionsObj = {
    ...OPTIONS_DEFAULT,
    ...options,
  };
  const process = setProcess({ options: optionsObj, process: null });
  getStatsInternal(streamUrl, optionsObj, iterator, process);
  return process.id;
}



module.exports = {
  getStats,
  killProcess,
};

