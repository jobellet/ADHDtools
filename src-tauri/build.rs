fn main() {
    #[cfg(target_os = "macos")]
    {
        println!("cargo:rerun-if-changed=src/macos_speech.m");
        println!("cargo:rerun-if-changed=../dist-desktop/index.html");
        let out_dir = std::env::var("OUT_DIR").expect("OUT_DIR not set");
        let obj = format!("{}/macos_speech.o", out_dir);
        let lib = format!("{}/libmacos_speech.a", out_dir);
        let status = std::process::Command::new("clang")
            .args(["-c", "-fobjc-arc", "-O2", "src/macos_speech.m", "-o", &obj])
            .status()
            .expect("failed to execute clang");
        assert!(status.success(), "clang failed to compile src/macos_speech.m");
        let status = std::process::Command::new("ar")
            .args(["rcs", &lib, &obj])
            .status()
            .expect("failed to execute ar");
        assert!(status.success(), "ar failed to archive libmacos_speech.a");
        println!("cargo:rustc-link-search=native={}", out_dir);
        println!("cargo:rustc-link-lib=static=macos_speech");
        println!("cargo:rustc-link-lib=framework=Foundation");
        println!("cargo:rustc-link-lib=framework=Speech");
        println!("cargo:rustc-link-lib=framework=AVFoundation");
        println!("cargo:rustc-link-lib=framework=QuartzCore");
        println!("cargo:rustc-link-lib=framework=AppKit");
    }
    tauri_build::build()
}
