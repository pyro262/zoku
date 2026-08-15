; Kill running Zoku BEFORE file extraction — customInit runs in .onInit
; so files are never locked when installApplicationFiles runs
!macro customInit
  nsExec::ExecToLog `taskkill /F /IM "Zoku.exe" /T`
  Pop $0
  IntCmp $0 0 wait_close skip_wait skip_wait
  wait_close:
    Sleep 1500
  skip_wait:
!macroend

; After files are installed: show FH6 data-out reminder, then offer README
!macro customInstall
  MessageBox MB_OK|MB_ICONINFORMATION "Zoku requires Forza Horizon 6 to have Data Out enabled:$\r$\n$\r$\nSettings  ->  HUD & Gameplay  ->  Data Out$\r$\n$\r$\n    Data Out:               ON$\r$\n    IP Address:             127.0.0.1$\r$\n    Port:                   20777$\r$\n    Data Out Packet Format: Car Dash$\r$\n$\r$\nThe game must also run in Borderless Windowed mode.$\r$\n(Settings -> Video -> Display Mode)"

  MessageBox MB_YESNO|MB_ICONQUESTION "Open the full README for setup instructions?" IDNO skip_readme
    ExecShell "open" "$INSTDIR\README.txt"
  skip_readme:

  ; electron-builder writes the uninstaller to $INSTDIR and registers it in
  ; Apps & features, but never makes a Start Menu entry for it. Add one next to
  ; the app shortcut (menuCategory "Zoku" => $SMPROGRAMS\Zoku\).
  CreateDirectory "$SMPROGRAMS\Zoku"
  CreateShortCut "$SMPROGRAMS\Zoku\Uninstall Zoku.lnk" "$INSTDIR\${UNINSTALL_FILENAME}"
!macroend

; Uninstall runs while Zoku sits in the tray -> locked files, partial removal.
; Kill it first, same as customInit does on install.
!macro customUnInit
  nsExec::ExecToLog `taskkill /F /IM "Zoku.exe" /T`
  Pop $0
  IntCmp $0 0 wait_close_un skip_wait_un skip_wait_un
  wait_close_un:
    Sleep 1500
  skip_wait_un:
!macroend

!macro customUnInstall
  Delete "$SMPROGRAMS\Zoku\Uninstall Zoku.lnk"
  RMDir "$SMPROGRAMS\Zoku"
!macroend

!macro customHeader
!macroend
