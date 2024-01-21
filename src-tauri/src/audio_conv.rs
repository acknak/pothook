use rubato::{
    Resampler, SincFixedIn, SincInterpolationParameters, SincInterpolationType, WindowFunction,
};
use std::fs;
use symphonia::core::audio::SampleBuffer;
use symphonia::core::codecs::{DecoderOptions, CODEC_TYPE_NULL};
use symphonia::core::formats::{FormatOptions, SeekMode, SeekTo};
use symphonia::core::io::MediaSourceStream;
use symphonia::core::meta::MetadataOptions;
use symphonia::core::probe::Hint;
use tauri::Manager;

#[derive(Clone, serde::Serialize, Debug)]
struct AudioConvPayload {
    status: String,
    progress: f32,
    message: String,
}

pub async fn run(path_in: &str, path_out: &str, app: &tauri::AppHandle) -> Result<(), String> {
    let src = fs::File::open(path_in)
        .map_err(|_| emit_err(app, "指定されたファイルが開けませんでした"))?;
    let mss = MediaSourceStream::new(Box::new(src), Default::default());
    let mut hint = Hint::new();
    hint.with_extension(
        std::path::Path::new(path_in)
            .extension()
            .unwrap_or_default()
            .to_str()
            .unwrap_or_default(),
    );
    let meta_opts: MetadataOptions = Default::default();
    let fmt_opts: FormatOptions = Default::default();
    let probed = symphonia::default::get_probe()
        .format(&hint, mss, &fmt_opts, &meta_opts)
        .map_err(|_| emit_err(app, "指定されたファイルは対応していません"))?;
    let mut format = probed.format;
    let track: &symphonia::core::formats::prelude::Track = format
        .tracks()
        .iter()
        .find(|t| t.codec_params.codec != CODEC_TYPE_NULL)
        .ok_or_else(|| emit_err(app, "指定されたファイルは対応しているトラックがありません"))?;
    dbg!(&track.codec_params);
    let dec_opts: DecoderOptions = Default::default();
    let mut decoder = symphonia::default::get_codecs()
        .make(&track.codec_params, &dec_opts)
        .map_err(|_| emit_err(app, "指定されたファイルのコーデックは対応していません"))?;
    let track_id = track.id;
    let input_sample_rate = track.codec_params.sample_rate.unwrap() as f64;
    emit_progress(app, "start", 0., "メディアを解析用音声に変換しています...");
    let mut n_frames: u64 = 0;
    loop {
        let packet = match format.next_packet() {
            Ok(packet) => packet,
            Err(symphonia::core::errors::Error::ResetRequired) => {
                Err(emit_err(app, "原因不明のエラーが発生しました:packet"))?
            }
            Err(symphonia::core::errors::Error::IoError(err)) => {
                if err.kind() == std::io::ErrorKind::UnexpectedEof {
                    break;
                }
                dbg!("{:?}", err);
                Err(emit_err(app, "原因不明のエラーが発生しました:packet"))?
            }
            Err(err) => {
                dbg!("{:?}", err);
                Err(emit_err(app, "原因不明のエラーが発生しました:packet"))?
            }
        };
        if packet.track_id() != track_id {
            continue;
        }
        n_frames = packet.ts + packet.dur;
    }
    dbg!(n_frames);
    format
        .seek(SeekMode::Coarse, SeekTo::TimeStamp { ts: 0, track_id })
        .map_err(|_| emit_err(app, "原因不明のエラーが発生しました:seek"))?;
    let mut waves_in = vec![vec![0.0f32; n_frames as usize]; 1];
    loop {
        let packet = match format.next_packet() {
            Ok(packet) => packet,
            Err(symphonia::core::errors::Error::ResetRequired) => {
                Err(emit_err(app, "原因不明のエラーが発生しました:packet"))?
            }
            Err(symphonia::core::errors::Error::IoError(err)) => {
                if err.kind() == std::io::ErrorKind::UnexpectedEof {
                    break;
                }
                dbg!("{:?}", err);
                Err(emit_err(app, "原因不明のエラーが発生しました:packet"))?
            }
            Err(err) => {
                dbg!("{:?}", err);
                Err(emit_err(app, "原因不明のエラーが発生しました:packet"))?
            }
        };
        while !format.metadata().is_latest() {
            format.metadata().pop();
        }
        if packet.track_id() != track_id {
            continue;
        }
        if packet.ts % 1000 == 0 {
            dbg!(packet.ts);
            emit_progress(app, "progress", packet.ts as f32 / n_frames as f32, "");
        }
        match decoder.decode(&packet) {
            Ok(decoded) => {
                let mut sb: SampleBuffer<f32> = SampleBuffer::new(packet.dur, *decoded.spec());
                sb.copy_planar_ref(decoded);
                let samples = sb.samples();
                (0..packet.dur as usize).for_each(|idx| {
                    waves_in[0][packet.ts as usize + idx] = samples[idx];
                });
            }
            Err(symphonia::core::errors::Error::IoError(_)) => break,
            Err(symphonia::core::errors::Error::DecodeError(_)) => break,
            Err(err) => {
                dbg!("{:?}", err);
                Err(emit_err(app, "原因不明のエラーが発生しました:decoder"))?;
            }
        }
    }
    emit_progress(app, "indeterminate", 0., "音声を書き出しています...");
    let waves_out = if input_sample_rate == 16000. {
        waves_in
    } else {
        SincFixedIn::<f32>::new(
            16000. / input_sample_rate,
            2.0,
            SincInterpolationParameters {
                sinc_len: 256,
                f_cutoff: 0.95,
                interpolation: SincInterpolationType::Linear,
                oversampling_factor: 256,
                window: WindowFunction::BlackmanHarris2,
            },
            waves_in[0].len(),
            1,
        )
        .map_err(|_| emit_err(app, "原因不明のエラーが発生しました:rubato"))?
        .process(&waves_in, None)
        .map_err(|_| emit_err(app, "原因不明のエラーが発生しました:rubato"))?
    };
    let mut writer = hound::WavWriter::create(
        path_out,
        hound::WavSpec {
            channels: 1,
            sample_rate: 16000,
            bits_per_sample: 16,
            sample_format: hound::SampleFormat::Int,
        },
    )
    .map_err(|_| emit_err(app, "原因不明のエラーが発生しました:hound"))?;
    for sample in &waves_out[0] {
        writer
            .write_sample((sample * core::i16::MAX as f32) as i16)
            .map_err(|_| emit_err(app, "原因不明のエラーが発生しました:hound"))?;
    }
    writer
        .finalize()
        .map_err(|_| emit_err(app, "原因不明のエラーが発生しました:hound"))?;
    emit_progress(app, "finished", 1., "解析用音声ファイルを作成しました");
    Ok(())
}

fn emit_progress(app: &tauri::AppHandle, status: &str, progress: f32, msg: &str) {
    let _ = app.emit_all(
        "audio_conv",
        AudioConvPayload {
            status: status.to_string(),
            progress,
            message: msg.to_string(),
        },
    );
}

fn emit_err(app: &tauri::AppHandle, msg: &str) -> String {
    let _ = app.emit_all(
        "audio_conv",
        AudioConvPayload {
            status: "error".to_string(),
            progress: 0.,
            message: msg.to_string(),
        },
    );
    msg.to_string()
}
