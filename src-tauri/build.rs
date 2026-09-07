fn main() {
    println!("cargo:rerun-if-changed=icons/icon.ico");
    println!("cargo:rerun-if-changed=tauri.conf.json");
    let mut windows = tauri_build::WindowsAttributes::new();
    windows = windows.window_icon_path("icons/icon.ico");
    tauri_build::try_build(
        tauri_build::Attributes::new().windows_attributes(windows),
    )
    .expect("failed to run tauri-build");
}
