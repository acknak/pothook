use once_cell::sync::Lazy;
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use tauri::Manager;

#[derive(Debug)]
pub struct Store {
    config: Config,
    wav_load_status: LoadStatus,
    model_load_status: LoadStatus,
    data: Vec<Data>,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub enum Status {
    NotReady,
    StandBy,
    Whispering,
}

#[derive(Debug)]
pub enum LoadStatus {
    StandBy,
    Loading(i64),
    Loaded,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct Config {
    status: Status,
    path_wav: PathBuf,
    path_model: PathBuf,
    display_clock: bool,
    lang: String,
    translate: bool,
    sec_start: i32,
    sec_end: i32,
}

#[derive(Debug)]
struct Data {
    ms_start: i64,
    ms_end: i64,
    subtitle: String,
}

impl Store {
    fn new() -> Store {
        Store {
            config: Config {
                status: Status::NotReady,
                display_clock: true,
                path_wav: PathBuf::new(),
                path_model: PathBuf::new(),
                lang: "ja".to_string(),
                translate: false,
                sec_start: 0,
                sec_end: 0,
            },
            wav_load_status: LoadStatus::StandBy,
            model_load_status: LoadStatus::StandBy,
            data: Vec::new(),
        }
    }

    pub fn set_config(&mut self, app: &tauri::AppHandle, config: Config) {
        self.config = config;
        self.emit_config(app);
    }

    pub fn set_status(&mut self, app: &tauri::AppHandle, status: Status) {
        self.config.status = status;
        self.emit_config(app);
    }

    pub fn get_path_wav(&self) -> &Path {
        &(self.config.path_wav)
    }

    pub fn set_path_wav(&mut self, app: &tauri::AppHandle, path_wav: PathBuf) {
        self.config.path_wav = path_wav;
        self.emit_config(app);
    }

    pub fn get_path_model(&self) -> &Path {
        &(self.config.path_model)
    }

    pub fn set_path_model(&mut self, app: &tauri::AppHandle, path_model: PathBuf) {
        self.config.path_model = path_model;
        self.emit_config(app);
    }

    pub fn set_display_clock(&mut self, app: &tauri::AppHandle, display_clock: bool) {
        self.config.display_clock = display_clock;
        self.emit_config(app);
    }

    pub fn get_lang(&self) -> Option<&str> {
        Some(&(self.config.lang))
    }

    pub fn set_lang(&mut self, app: &tauri::AppHandle, lang: String) {
        self.config.lang = lang;
        self.emit_config(app);
    }

    pub fn get_translate(&self) -> bool {
        self.config.translate
    }

    pub fn set_translate(&mut self, app: &tauri::AppHandle, translate: bool) {
        self.config.translate = translate;
        self.emit_config(app);
    }

    pub fn set_sec_start(&mut self, app: &tauri::AppHandle, sec_start: i32) {
        self.config.sec_start = sec_start;
        self.emit_config(app);
    }

    pub fn set_sec_end(&mut self, app: &tauri::AppHandle, sec_end: i32) {
        self.config.sec_end = sec_end;
        self.emit_config(app);
    }

    pub fn get_ms_offset(&self) -> i32 {
        self.config.sec_start * 1000
    }

    pub fn get_ms_duration(&self) -> i32 {
        if self.config.sec_start > self.config.sec_end {
            0
        } else {
            (self.config.sec_end - self.config.sec_start) * 1000
        }
    }

    pub fn push_data(
        &mut self,
        app: &tauri::AppHandle,
        ms_start: i64,
        ms_end: i64,
        subtitle: String,
    ) {
        self.data.push(Data {
            ms_start,
            ms_end,
            subtitle,
        });
        self.emit_data(app)
    }

    pub fn clear_data(&mut self, app: &tauri::AppHandle) {
        self.data = Vec::new();
        self.emit_data(app)
    }

    fn emit_config(&self, app: &tauri::AppHandle) {
        dbg!(&self.config);
        app.emit_all("config", self.config.clone()).unwrap();
    }

    fn emit_data(&self, app: &tauri::AppHandle) {
        app.emit_all(
            "data",
            self.data
                .iter()
                .map(|d| {
                    if self.config.display_clock {
                        format!("[{} --> {}] {}", ts(d.ms_start), ts(d.ms_end), d.subtitle)
                    } else {
                        d.subtitle.clone()
                    }
                })
                .collect::<Vec<_>>()
                .join("\n"),
        )
        .unwrap();
        let sec = self.data.last().map_or(0, |d| d.ms_end / 1000) as i32;
        app.emit_all(
            "progress",
            if self.config.sec_end <= 0 {
                0
            } else if sec > self.config.sec_end {
                100
            } else {
                sec * 100 / self.config.sec_end
            },
        )
        .unwrap();
    }
}

fn ts(ms: i64) -> String {
    format!(
        "{:0>2}:{:0>2}:{:0>2}.{:0>3}",
        ms / 3600000,
        (ms % 3600000) / 60000,
        (ms % 60000) / 1000,
        ms % 1000
    )
}

pub static STORE: Lazy<Mutex<Store>> = Lazy::new(|| Mutex::new(Store::new()));
