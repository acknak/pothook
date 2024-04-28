use once_cell::sync::Lazy;
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use tauri::Manager;

#[derive(Debug)]
pub struct Store {
    config: Config,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub enum Status {
    NotReady,
    StandBy,
    Whispering,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct Config {
    status: Status,
    path_wav: PathBuf,
    path_model: PathBuf,
    lang: String,
    translate: bool,
    sec_start: i32,
    sec_end: i32,
}

impl Store {
    fn new() -> Store {
        Store {
            config: Config {
                status: Status::NotReady,
                path_wav: PathBuf::new(),
                path_model: PathBuf::new(),
                lang: "ja".to_string(),
                translate: false,
                sec_start: 0,
                sec_end: 0,
            },
        }
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

    fn emit_config(&self, app: &tauri::AppHandle) {
        dbg!(&self.config);
        app.emit_all("config", self.config.clone()).unwrap();
    }
}

pub static STORE: Lazy<Mutex<Store>> = Lazy::new(|| Mutex::new(Store::new()));
