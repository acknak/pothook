use crate::store::STORE;
use libc::c_void;
use std::ffi::CStr;
use std::path::PathBuf;
use tauri::Manager;
use whisper_rs::{
    FullParams, SamplingStrategy, WhisperContext, WhisperContextParameters, WhisperState,
};

#[derive(Clone, serde::Serialize, Debug)]
struct WhisperPayload {
    status: String,
    message: String,
}

unsafe extern "C" fn whisper_callback(
    _: *mut whisper_rs_sys::whisper_context,
    ptr: *mut whisper_rs_sys::whisper_state,
    _: i32,
    app: *mut c_void,
) {
    let i_segment = unsafe { whisper_rs_sys::whisper_full_n_segments_from_state(ptr) } - 1;
    let ret = unsafe { whisper_rs_sys::whisper_full_get_segment_text_from_state(ptr, i_segment) };
    if ret.is_null() {
        return;
    }
    let box_app = Box::from_raw(app as *mut tauri::AppHandle);
    STORE.lock().unwrap().push_data(
        &box_app,
        whisper_rs_sys::whisper_full_get_segment_t0_from_state(ptr, i_segment) * 10,
        whisper_rs_sys::whisper_full_get_segment_t1_from_state(ptr, i_segment) * 10,
        unsafe { CStr::from_ptr(ret) }.to_str().unwrap().to_string(),
    );
    _ = Box::into_raw(box_app);
}

pub async fn run(
    path_wav: &str,
    path_model: &str,
    lang: &str,
    translate: bool,
    offset_ms: i32,
    duration_ms: i32,
    app: &tauri::AppHandle,
) -> Result<(), String> {
    let mut params = FullParams::new(SamplingStrategy::Greedy { best_of: 1 });
    let context;
    let audio_data;
    let lang_string;
    {
        let mut config = STORE.lock().unwrap();
        config.set_status(app, crate::store::Status::Whispering);
        config.set_path_wav(app, PathBuf::from(path_wav));
        config.set_path_model(app, PathBuf::from(path_model));
        config.set_lang(app, lang.to_string());
        config.set_translate(app, translate);
        config.set_sec_start(app, offset_ms / 1000);
        config.set_sec_end(app, (offset_ms + duration_ms) / 1000);

        let mut reader = hound::WavReader::open(config.get_path_wav()).unwrap();
        audio_data = reader
            .samples::<i16>()
            .map(|sample| (sample.unwrap_or_default() as f32) / (i16::MAX as f32))
            .collect::<Vec<f32>>();

        lang_string = config.get_lang().unwrap_or_default().to_string();
        params.set_language(config.get_lang().and(Some(&lang_string)));
        params.set_translate(config.get_translate());
        params.set_offset_ms(config.get_ms_offset());
        params.set_duration_ms(config.get_ms_duration());
        params.set_tdrz_enable(true);
        params.set_suppress_non_speech_tokens(true);
        params.set_max_initial_ts(3.);
        unsafe {
            params.set_new_segment_callback(Some(whisper_callback));
            params.set_new_segment_callback_user_data(
                Box::into_raw(Box::new(app.clone())) as *mut c_void
            );
        }

        context = WhisperContext::new_with_params(
            config.get_path_model().as_os_str().to_str().unwrap(),
            WhisperContextParameters::default(),
        )
        .map_err(|_| emit_err(app, "言語モデルの読み込みに失敗しました"))?;
    }
    let mut state = context
        .create_state()
        .map_err(|_| emit_err(app, "初期化に失敗しました"))?;
    app.emit_all(
        "whisper",
        WhisperPayload {
            status: "start".to_string(),
            message: "初期化が完了しました。文字起こしを開始します。".to_string(),
        },
    )
    .unwrap();
    state
        .full(params, &audio_data[..])
        .map_err(|_| emit_err(app, "言語モデルの実行に失敗しました"))?;
    Ok(())
}

fn emit_err(app: &tauri::AppHandle, msg: &str) -> String {
    let _ = app.emit_all(
        "whisper",
        WhisperPayload {
            status: "error".to_string(),
            message: msg.to_string(),
        },
    );
    msg.to_string()
}
