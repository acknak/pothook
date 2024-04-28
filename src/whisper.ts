import { invoke } from "@tauri-apps/api/tauri";

export type WhisperPayload = {
  status: string;
  start_ms: number;
  end_ms: number;
  message: string;
};

export class Whisper {
  private outputs: Array<WhisperPayload> = new Array();
  public clock: boolean = true;
  public pathToWav: String = "";
  public pathToModel: String = "";
  public lang: String = "ja";
  public translate: boolean = false;
  public start_sec: number = 0;
  public end_sec: number = 0;

  public async callWhisper(): Promise<boolean> {
    await invoke("whisper", {});
    return true;
  }
  public editOutputs(outputText: string) {
    outputText.split(/\r?\n/g).forEach((message, index) => {
      if (index < this.outputs.length) {
        this.outputs[index].message = message;
      }
    });
  }
  public strOutputs(): string {
    return this.outputs.reduce(
      (rawOutputs, v) =>
        (rawOutputs =
          (rawOutputs === "" ? "" : rawOutputs + "\n") +
          (this.clock ? this.formatOutputText(v) : v.message)),
      ""
    );
  }
  public pushOutputs(wp: WhisperPayload) {
    this.outputs.push(wp);
  }
  public numOutputs(): number {
    return this.outputs.length;
  }
  public outputStartMsAt(index: number): number {
    return 0 <= index && index < this.outputs.length
      ? this.outputs[index].start_ms
      : 0;
  }
  public outputEndMsAt(index: number): number {
    return 0 <= index && index < this.outputs.length
      ? this.outputs[index].end_ms
      : 0;
  }

  private formatOutputText(payload: WhisperPayload): String {
    return (
      (this.clock
        ? `[${getTimestamp(payload.start_ms)} --> ${getTimestamp(payload.end_ms)}]  `
        : "") + payload.message
    );
  }
}

function getTimestamp(ms: number): String {
  return (
    String(Math.floor(ms / 3600000)).padStart(2, "0") +
    ":" +
    String(Math.floor((ms % 3600000) / 60000)).padStart(2, "0") +
    ":" +
    String(Math.floor((ms % 60000) / 1000)).padStart(2, "0") +
    "." +
    String(Math.floor(ms % 1000)).padStart(3, "0")
  );
}
