!include "common.nsh"
!include "extractAppPackage.nsh"

CRCCheck off
WindowIcon Off
AutoCloseWindow True
RequestExecutionLevel user
!ifdef MUI_ICON
  Icon "${MUI_ICON}"
!endif

Function .onInit
  SetSilent silent
  !insertmacro check64BitAndSetRegView
FunctionEnd

Section
  GetFileTime "$EXEPATH" $R2 $R3
  StrCpy $INSTDIR "$LOCALAPPDATA\PunPun\portable-cache\${VERSION}-$R2-$R3"
  IfFileExists "$INSTDIR\.ready" launch_app 0

  InitPluginsDir
  RMDir /r "$LOCALAPPDATA\PunPun\portable-cache"
  CreateDirectory "$INSTDIR"
  SetOutPath "$INSTDIR"
  !insertmacro extractEmbeddedAppPackage

  FileOpen $R1 "$INSTDIR\.ready" w
  FileWrite $R1 "${VERSION}-$R2-$R3"
  FileClose $R1

launch_app:
  SetOutPath "$INSTDIR"
  System::Call 'Kernel32::SetEnvironmentVariable(t, t)i ("PORTABLE_EXECUTABLE_DIR", "$EXEDIR").r0'
  System::Call 'Kernel32::SetEnvironmentVariable(t, t)i ("PORTABLE_EXECUTABLE_FILE", "$EXEPATH").r0'
  System::Call 'Kernel32::SetEnvironmentVariable(t, t)i ("PORTABLE_EXECUTABLE_APP_FILENAME", "${APP_FILENAME}").r0'
  ${StdUtils.GetAllParameters} $R0 0
  Exec '"$INSTDIR\${APP_EXECUTABLE_FILENAME}" $R0'
SectionEnd
