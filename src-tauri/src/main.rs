// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use hound::{SampleFormat, WavSpec};
use tauri::Manager;

mod audio_conv;
mod whisper;

#[tauri::command]
async fn check_wav(path_to_wav: &str) -> Result<(), String> {
    match hound::WavReader::open(path_to_wav) {
        Ok(reader) => {
            println!("{:?}", reader.spec());
            if reader.spec()
                == (WavSpec {
                    channels: 1,
                    sample_rate: 16_000,
                    bits_per_sample: 16,
                    sample_format: SampleFormat::Int,
                })
            {
                Ok(())
            } else {
                Err(format!("invalid_channel: {}", reader.spec().channels))
            }
        }
        Err(error) => Err(error.to_string()),
    }
}

#[tauri::command]
async fn audio_conv(
    path_to_media: &str,
    path_to_wav: &str,
    app: tauri::AppHandle,
) -> Result<(), String> {
    audio_conv::run(path_to_media, path_to_wav, &app).await
}

#[tauri::command]
async fn whisper(
    path_to_wav: &str,
    path_to_model: &str,
    lang: &str,
    translate: bool,
    offset_ms: i32,
    duration_ms: i32,
    app: tauri::AppHandle,
) -> Result<(), String> {
    whisper::run(
        path_to_wav,
        path_to_model,
        lang,
        translate,
        offset_ms,
        duration_ms,
        app,
    )
    .await
}

fn main() {
    tracing_subscriber::fmt::init();
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![check_wav, audio_conv, whisper])
        .setup(|app| {
            #[cfg(debug_assertions)] // only include this code on debug builds
            {
                let window = app.get_window("main").unwrap();
                window.open_devtools();
                window.close_devtools();
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
