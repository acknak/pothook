import { open, ask, save, message } from "@tauri-apps/api/dialog";
import { listen } from "@tauri-apps/api/event";
import { convertFileSrc, invoke } from "@tauri-apps/api/tauri";
import { Whisper, WhisperPayload } from "./whisper";
import {
  controlToSlider,
  controlFromSlider,
  getTime,
  fillSlider,
  setToggleAccessible,
  getParsed,
} from "./dual_range_slider";

let whisper = new Whisper();
let outputMsgEl: HTMLTextAreaElement | null;
let outputSysEl: HTMLTextAreaElement | null;
let progressEl: HTMLProgressElement | null;
let voiceInputEl: HTMLInputElement | null;
let voiceAudioEl: HTMLMediaElement | null;
let dualRngSliderEl: HTMLDivElement | null;
let modelInputEl: HTMLInputElement | null;
let langSelectEl: HTMLSelectElement | null;
let transInputEl: HTMLInputElement | null;
let callWhisperBtnEl: HTMLButtonElement | null;
let editMsgInputEl: HTMLInputElement | null;
let autoplayInputEl: HTMLInputElement | null;
let copyMsgButtonEl: HTMLButtonElement | null;
let playingOutputNum: number = Number.MAX_SAFE_INTEGER;
let playingEventTimestamp: number = 0;

let fromSlider: HTMLInputElement | null;
let toSlider: HTMLInputElement | null;
let fromInput: HTMLInputElement | null;
let toInput: HTMLInputElement | null;

window.addEventListener("DOMContentLoaded", () => {
  outputMsgEl = document.querySelector("#output-msg");
  outputSysEl = document.querySelector("#output-sys");
  progressEl = document.querySelector("#progress");
  voiceInputEl = document.querySelector("#voice-path");
  voiceAudioEl = document.querySelector("#voice-audio");
  dualRngSliderEl = document.querySelector("#dual-range-slider");
  modelInputEl = document.querySelector("#model-path");
  langSelectEl = document.querySelector("#lang");
  transInputEl = document.querySelector("#translate");
  callWhisperBtnEl = document.querySelector("#call-whisper");
  editMsgInputEl = document.querySelector("#edit-msg");
  autoplayInputEl = document.querySelector("#autoplay");
  copyMsgButtonEl = document.querySelector("#copy-msg");

  fromSlider = document.querySelector("#fromSlider");
  toSlider = document.querySelector("#toSlider");
  fromInput = document.querySelector("#fromInput");
  toInput = document.querySelector("#toInput");

  if (fromSlider && toSlider && fromInput && toInput) {
    fillSlider(fromSlider, toSlider, toSlider);
    setToggleAccessible(toSlider);
    fromSlider.oninput = () => {
      if (fromSlider && toSlider && fromInput && toInput && voiceAudioEl) {
        controlFromSlider(fromSlider, toSlider, fromInput);
        const [from, to] = getParsed();
        whisper.start_sec = voiceAudioEl.duration * (from / 1000);
        whisper.end_sec = voiceAudioEl.duration * (to / 1000);
      }
    };
    toSlider.oninput = () => {
      if (fromSlider && toSlider && fromInput && toInput && voiceAudioEl) {
        controlToSlider(fromSlider, toSlider, toInput);
        const [from, to] = getParsed();
        whisper.start_sec = voiceAudioEl.duration * (from / 1000);
        whisper.end_sec = voiceAudioEl.duration * (to / 1000);
      }
    };
    fromSlider.onmouseup = () =>
      refresh_config(
        "secStart",
        Math.trunc(
          (parseInt(fromSlider?.value ?? "0") * (voiceAudioEl?.duration ?? 0)) /
            1000
        ).toString()
      );
    toSlider.onmouseup = () =>
      refresh_config(
        "secEnd",
        Math.trunc(
          (parseInt(toSlider?.value ?? "0") * (voiceAudioEl?.duration ?? 0)) /
            1000
        ).toString()
      );
  }

  document
    .querySelector("#params-form")
    ?.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (!voiceInputEl || voiceInputEl?.value === "") {
        await message("映像・音声ファイルを指定してください", {
          title: "Pothook",
          type: "error",
        });
        return;
      }
      if (!modelInputEl || modelInputEl?.value === "") {
        await message("言語モデルファイルを指定してください", {
          title: "Pothook",
          type: "error",
        });
        return;
      }
      if (
        outputMsgEl &&
        callWhisperBtnEl &&
        copyMsgButtonEl &&
        voiceAudioEl &&
        outputSysEl &&
        progressEl
      ) {
        callWhisperBtnEl.disabled = true;
        copyMsgButtonEl.disabled = true;
        outputMsgEl.value = "";
        outputSysEl.value =
          (outputSysEl.value === "" ? "" : outputSysEl.value + "\n") +
          "[" +
          new Date().toLocaleString("ja-JP") +
          "] 初期設定中...";
        outputSysEl.scrollTo(0, outputSysEl.scrollHeight);
        progressEl.classList.remove("progress-error");
        progressEl.removeAttribute("value");
        progressEl.removeAttribute("max");
        if (await whisper.callWhisper()) {
          outputSysEl.value =
            (outputSysEl.value === "" ? "" : outputSysEl.value + "\n") +
            "[" +
            new Date().toLocaleString("ja-JP") +
            "] 文字起こしが完了しました";
          progressEl.classList.remove("progress-error");
          progressEl.setAttribute("max", "100");
          progressEl.value = 100;
          outputSysEl.scrollTo(0, outputSysEl.scrollHeight);
          callWhisperBtnEl.disabled = false;
        }
      }
    });
  outputMsgEl?.addEventListener("keydown", (e) => {
    if (e.isComposing || outputMsgEl?.readOnly) {
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      return;
    }
  });
  outputMsgEl?.addEventListener("paste", (e) => {
    e.preventDefault();
    if (!outputMsgEl?.readOnly) {
      outputMsgEl?.setRangeText(
        (e.clipboardData?.getData("text") ?? "").replace(/\r?\n/g, "")
      );
    }
  });
  outputMsgEl?.addEventListener("keyup", (e) => {
    e.preventDefault();
    if (outputMsgEl && !outputMsgEl.readOnly) {
      if (
        (outputMsgEl.value.match(/\r?\n/g) || []).length == whisper.numOutputs()
      ) {
        whisper.editOutputs(outputMsgEl.value);
      }
    }
  });
  outputMsgEl?.addEventListener("click", (e) => {
    if (autoplayInputEl?.checked && whisper.numOutputs() > 0 && voiceAudioEl) {
      const numOutput = (
        outputMsgEl?.value
          .substring(0, outputMsgEl?.selectionStart)
          .match(/\r?\n/g) || []
      ).length;
      if (playingOutputNum == numOutput) {
        return;
      }
      const startMs = whisper.outputStartMsAt(numOutput);
      const endMs = whisper.outputEndMsAt(numOutput);
      voiceAudioEl.currentTime = startMs / 1000.0;
      voiceAudioEl.play();
      playingOutputNum = numOutput;
      playingEventTimestamp = e.timeStamp;
      setTimeout(
        () => {
          if (playingEventTimestamp == e.timeStamp) voiceAudioEl?.pause();
        },
        endMs - startMs + 500
      );
    }
  });
  voiceInputEl?.addEventListener("click", async (e) => {
    e.preventDefault();
    if (
      voiceInputEl &&
      callWhisperBtnEl &&
      copyMsgButtonEl &&
      outputMsgEl &&
      voiceAudioEl &&
      dualRngSliderEl
    ) {
      voiceInputEl.disabled = true;
      const path = await open({
        directory: false,
        multiple: false,
      });
      voiceInputEl.disabled = false;
      const new_path = Array.isArray(path) ? path[0] : path;
      if (new_path && new_path !== voiceInputEl.value) {
        voiceInputEl.value = new_path;
        refresh_config("pathWav", new_path);
        dualRngSliderEl.classList.add("hidden");
        dualRngSliderEl.classList.remove("flex");
        voiceAudioEl.classList.add("hidden");
        voiceAudioEl.pause();
        if (outputMsgEl) {
          outputMsgEl.value = "";
        }
        try {
          await invoke("check_wav", { pathToWav: voiceInputEl.value });
        } catch (res) {
          if (
            await ask(
              "指定されたファイルは解析可能な映像・音声ファイルではありませんでした。解析用に変換しますか？"
            )
          ) {
            let filePath = await save({
              defaultPath:
                voiceInputEl.value.split("/").reverse()[0].split(".")[0] +
                ".wav",
              filters: [{ name: "voices", extensions: ["wav"] }],
            });
            if (!filePath) return;
            await invoke("audio_conv", {
              pathToMedia: voiceInputEl.value,
              pathToWav: filePath,
            });
            voiceAudioEl.src = convertFileSrc(filePath);
            voiceInputEl.value = filePath;
            refresh_config("pathWav", filePath);
          } else {
            voiceInputEl.value = "";
            refresh_config("pathWav", "");
            voiceAudioEl.classList.add("hidden");
            dualRngSliderEl.classList.remove("flex");
            dualRngSliderEl.classList.add("hidden");
            return;
          }
        }
        if (voiceAudioEl && dualRngSliderEl && toInput) {
          dualRngSliderEl.classList.remove("hidden");
          dualRngSliderEl.classList.add("flex");
          voiceAudioEl.classList.remove("hidden");
          voiceAudioEl.pause();
          voiceAudioEl.src = convertFileSrc(voiceInputEl.value);
          if (outputMsgEl) {
            outputMsgEl.value = "";
          }
        }
        whisper = new Whisper();
        refresh_config("pathWav", voiceInputEl.value);
        if (outputSysEl && progressEl) {
          outputSysEl.value =
            (outputSysEl.value === "" ? "" : outputSysEl.value + "\n") +
            "[" +
            new Date().toLocaleString("ja-JP") +
            "] 音声を読み込みました";
          outputSysEl.scrollTo(0, outputSysEl.scrollHeight);
          progressEl.classList.remove("progress-error");
          progressEl.value = 100;
        }
        callWhisperBtnEl.disabled = false;
        copyMsgButtonEl.disabled = true;
        outputMsgEl.value = "";
      }
    }
  });
  voiceAudioEl?.addEventListener("canplaythrough", () => {
    if (toInput && voiceAudioEl) {
      toInput.value = getTime(1000);
      whisper.end_sec = voiceAudioEl.duration;
    }
  });
  modelInputEl?.addEventListener("click", async (e) => {
    e.preventDefault();
    if (modelInputEl) {
      const path = await open({
        directory: false,
        multiple: false,
        filters: [
          {
            name: "言語モデル",
            extensions: ["bin"],
          },
        ],
      });
      modelInputEl.value = Array.isArray(path)
        ? path[0]
        : path ?? modelInputEl.value;
      whisper.pathToModel = modelInputEl.value;
      refresh_config("pathModel", modelInputEl.value);
    }
  });
  langSelectEl?.addEventListener("change", (_) => {
    whisper.lang = langSelectEl?.value ?? "ja";
    refresh_config("lang", langSelectEl?.value ?? "ja");
  });
  transInputEl?.addEventListener("change", (_) => {
    whisper.translate = transInputEl?.checked ?? false;
    refresh_config("translate", (transInputEl?.checked ?? false).toString());
  });
  editMsgInputEl?.addEventListener("change", (_) => {
    if (outputMsgEl) {
      if (!whisper.clock) {
        whisper.editOutputs(outputMsgEl.value);
      }
      whisper.clock = !(editMsgInputEl?.checked ?? false);
      outputMsgEl.readOnly = whisper.clock || whisper.numOutputs() === 0;
      outputMsgEl.value = whisper.strOutputs();
    }
  });
  copyMsgButtonEl?.addEventListener("click", (e) => {
    e.preventDefault();
    if (outputMsgEl) {
      navigator.clipboard.writeText(outputMsgEl.value);
    }
  });
});

const refresh_config = async (paramName: string, paramData: string) => {
  await invoke("refresh_config", { paramName, paramData });
};

(async () => {
  await listen<WhisperPayload>("whisper", (event) => {
    if (event.payload.status === "error" || event.payload.status === "start") {
      if (outputSysEl && progressEl) {
        outputSysEl.value =
          (outputSysEl.value === "" ? "" : outputSysEl.value + "\n") +
          "[" +
          new Date().toLocaleString("ja-JP") +
          "] " +
          event.payload.message;
        outputSysEl.scrollTo(0, outputSysEl.scrollHeight);
        if (event.payload.status === "error") {
          progressEl.classList.add("progress-error");
          progressEl.value = 100;
        }
      }
    } else {
      if (whisper.numOutputs() == 0 && outputSysEl && progressEl) {
        outputSysEl.value =
          (outputSysEl.value === "" ? "" : outputSysEl.value + "\n") +
          "[" +
          new Date().toLocaleString("ja-JP") +
          "] 文字起こし中...";
        outputSysEl.scrollTo(0, outputSysEl.scrollHeight);
      }
      whisper.pushOutputs(event.payload);
      if (outputMsgEl && callWhisperBtnEl && copyMsgButtonEl) {
        const start = outputMsgEl.selectionStart;
        const end = outputMsgEl.selectionEnd;
        const top = outputMsgEl.scrollTop;
        outputMsgEl.setSelectionRange(start, end);
        outputMsgEl.scrollTop = top;
        outputMsgEl.value = whisper.strOutputs();
        copyMsgButtonEl.disabled = false;
      }
      if (progressEl && voiceAudioEl && fromSlider && toSlider) {
        progressEl.classList.remove("progress-error");
        progressEl.setAttribute("max", "100");
        const progress_sec = event.payload.end_ms / 1000.0;
        const end_sec =
          whisper.start_sec >= whisper.end_sec
            ? voiceAudioEl.duration
            : whisper.end_sec;
        progressEl.value =
          ((progress_sec - whisper.start_sec) / (end_sec - progress_sec)) * 100;
      }
    }
  });
})();

export type AudioConvPayload = {
  status: string;
  progress: number;
  message: string;
};

(async () => {
  await listen<AudioConvPayload>("audio_conv", (event) => {
    if (outputSysEl && progressEl && voiceAudioEl) {
      if (event.payload.message !== "") {
        outputSysEl.value =
          (outputSysEl.value === "" ? "" : outputSysEl.value + "\n") +
          "[" +
          new Date().toLocaleString("ja-JP") +
          "] " +
          event.payload.message;
        outputSysEl.scrollTo(0, outputSysEl.scrollHeight);
      }
      if (event.payload.status === "error") {
        progressEl.classList.add("progress-error");
        progressEl.value = 100;
        if (voiceInputEl) {
          voiceInputEl!.value = "";
        }
        refresh_config("pathWav", "");
      } else if (event.payload.status === "indeterminate") {
        progressEl.classList.remove("progress-error");
        progressEl.removeAttribute("value");
        progressEl.removeAttribute("max");
      } else {
        progressEl.classList.remove("progress-error");
        progressEl.value = event.payload.progress * 100;
        progressEl.setAttribute("max", "100");
      }
    }
  });
})();
