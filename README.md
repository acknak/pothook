<div align="center">

<image src="https://raw.githubusercontent.com/acknak/pothook/main/src-tauri/icons/pothook_circle.png" height=192 width=192>

# Pothook
This is a GUI application for transcribing text using [Whisper.cpp](https://github.com/ggerganov/whisper.cpp) with Typescript and Rust ([Tauri](https://tauri.app)).  
It works on Windows, Mac, and Linux platforms. 🚀

[![release](https://img.shields.io/github/v/release/acknak/pothook.svg?style=flat)](https://github.com/acknak/pothook/releases) [![workflow](https://github.com/acknak/pothook/actions/workflows/main.yaml/badge.svg)](https://github.com/acknak/pothook/actions/workflows/main.yaml) [![license](https://badgen.net/github/license/acknak/pothook)](https://github.com/acknak/pothook/blob/main/LICENSE)

</div>

# Quick Start :rocket:

1. Download Pothook from [Releases page](https://github.com/acknak/pothook/releases/) :arrow_down:
2. Download the [Whisper C++ model of ggml format](https://huggingface.co/ggerganov/whisper.cpp/tree/main) :file_folder:  
   :memo: If there is no specific reason, I recommend using the Large v3 model (ggml-large-v3.bin).
3. Run Pothook :computer:  
   ![Pothook GUI Image](https://raw.githubusercontent.com/acknak/pothook/main/Pothook.png)
Hint: If you want to learn more about the details and specifications of the ggml models, please check out the [Whisper C++ documentation page](https://github.com/ggerganov/whisper.cpp/tree/master/models#whisper-model-files-in-custom-ggml-format) :book:

# Run Pothook as dev mode :wrench:

Pothook is a cross-platform desktop app that lets you chat securely and anonymously with other users. To run Pothook in dev mode, you need to install some related tools first.

- [Node.js](https://nodejs.org/) - A JavaScript runtime environment that powers the frontend of Pothook. 🟢
- [Rust](https://www.rust-lang.org/) - A fast and reliable programming language that powers the backend of Pothook. 🦀
- [Git](https://git-scm.com) - A version control system that lets you clone and manage the Pothook repository. 🐙

Then, clone the repository and build the app with the following commands.

```
git clone https://github.com/acknak/pothook.git
cd pothook
npm run tauri dev
```
