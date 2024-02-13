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
    const offsetMs = Math.trunc(this.start_sec * 1000);
    const durationMs = Math.trunc((this.end_sec - this.start_sec) * 1000);
    await invoke("whisper", {
      pathToWav: this.pathToWav,
      pathToModel: this.pathToModel,
      lang: this.lang,
      translate: this.translate,
      offsetMs,
      durationMs,
    });
    return true;
  }
  public editOutputs(outputText: string) {
    outputText.split(/\r?\n/g).forEach((message, index) => {
      if (index < this.outputs.length) {
        this.outputs[index].message = message;
      }
    });
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
}
