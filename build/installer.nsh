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
!macroend

!macro customHeader
!macroend
