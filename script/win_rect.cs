using System;
using System.Collections.Generic;
using System.Runtime.InteropServices;
using System.Text;

class WinRectProgram
{
    [StructLayout(LayoutKind.Sequential)]
    struct RECT
    {
        public int Left;
        public int Top;
        public int Right;
        public int Bottom;
    }

    delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);

    [DllImport("user32.dll")]
    static extern bool EnumWindows(EnumWindowsProc lpEnumFunc, IntPtr lParam);

    [DllImport("user32.dll")]
    static extern bool EnumChildWindows(IntPtr hWndParent, EnumWindowsProc lpEnumFunc, IntPtr lParam);

    [DllImport("user32.dll")]
    static extern bool IsWindowVisible(IntPtr hWnd);

    [DllImport("user32.dll")]
    static extern bool IsIconic(IntPtr hWnd);

    [DllImport("user32.dll")]
    static extern bool IsZoomed(IntPtr hWnd);

    [DllImport("user32.dll")]
    static extern bool GetWindowRect(IntPtr hWnd, out RECT lpRect);

    [DllImport("user32.dll")]
    static extern int GetSystemMetrics(int nIndex);

    [DllImport("user32.dll", CharSet = CharSet.Unicode)]
    static extern int GetWindowText(IntPtr hWnd, StringBuilder lpString, int nMaxCount);

    [DllImport("user32.dll", CharSet = CharSet.Unicode)]
    static extern int GetClassName(IntPtr hWnd, StringBuilder lpClassName, int nMaxCount);

    [DllImport("user32.dll")]
    static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint lpdwProcessId);

    [DllImport("user32.dll")]
    static extern int GetWindowLong(IntPtr hWnd, int nIndex);

    [DllImport("user32.dll")]
    static extern int SetWindowLong(IntPtr hWnd, int nIndex, int dwNewLong);

    [DllImport("user32.dll")]
    static extern bool SetWindowPos(IntPtr hWnd, IntPtr hWndInsertAfter, int X, int Y, int cx, int cy, uint uFlags);

    [DllImport("user32.dll")]
    static extern bool SetWindowDisplayAffinity(IntPtr hWnd, uint dwAffinity);

    [DllImport("user32.dll")]
    static extern IntPtr SetProcessDpiAwarenessContext(IntPtr dpiContext);

    [DllImport("shcore.dll")]
    static extern int SetProcessDpiAwareness(int value);

    [DllImport("dwmapi.dll")]
    static extern int DwmGetWindowAttribute(IntPtr hwnd, int dwAttribute, out RECT pvAttribute, int cbAttribute);

    [DllImport("dwmapi.dll")]
    static extern int DwmGetWindowAttribute(IntPtr hwnd, int dwAttribute, out int pvAttribute, int cbAttribute);

    [DllImport("dwmapi.dll")]
    static extern int DwmSetWindowAttribute(IntPtr hwnd, int dwAttribute, ref int pvAttribute, int cbAttribute);

    [DllImport("dwmapi.dll")]
    static extern int DwmFlush();

    const int GWL_EXSTYLE = -20;
    const int WS_EX_TOOLWINDOW = 0x00000080;
    const int WS_EX_APPWINDOW = 0x00040000;
    const int WS_EX_TRANSPARENT = 0x00000020;
    const int WS_EX_LAYERED = 0x00080000;
    const int WS_EX_NOACTIVATE = 0x08000000;
    const uint SWP_STYLE_REFRESH = 0x0037;
    const uint WDA_NONE = 0x00000000;
    const uint WDA_EXCLUDEFROMCAPTURE = 0x00000011;
    const int DWMWA_TRANSITIONS_FORCEDISABLED = 3;
    const int DWMWA_EXTENDED_FRAME_BOUNDS = 9;
    const int DWMWA_CLOAKED = 14;
    const int DWMWA_WINDOW_CORNER_PREFERENCE = 33;

    static void ApplyNoAnimation(long hwndVal, bool asToolWindow)
    {
        if (hwndVal == 0) return;
        try
        {
            IntPtr hWnd = new IntPtr(hwndVal);
            int one = 1;
            DwmSetWindowAttribute(hWnd, DWMWA_TRANSITIONS_FORCEDISABLED, ref one, sizeof(int));
            DwmSetWindowAttribute(hWnd, DWMWA_WINDOW_CORNER_PREFERENCE, ref one, sizeof(int));
            if (asToolWindow)
            {
                int ex = GetWindowLong(hWnd, GWL_EXSTYLE);
                int nextEx = (ex | WS_EX_TOOLWINDOW) & ~WS_EX_APPWINDOW;
                if (nextEx != ex)
                {
                    SetWindowLong(hWnd, GWL_EXSTYLE, nextEx);
                }
            }
            DwmFlush();
        }
        catch { }
    }

    static void ApplyExcludeFromCapture(long hwndVal, bool exclude)
    {
        if (hwndVal == 0) return;
        try
        {
            IntPtr hWnd = new IntPtr(hwndVal);
            SetWindowDisplayAffinity(hWnd, exclude ? WDA_EXCLUDEFROMCAPTURE : WDA_NONE);
        }
        catch { }
    }

    static string EscapeJson(string s)
    {
        if (string.IsNullOrEmpty(s)) return "";
        var sb = new StringBuilder(s.Length + 8);
        foreach (char c in s)
        {
            switch (c)
            {
                case '\\': sb.Append("\\\\"); break;
                case '"': sb.Append("\\\""); break;
                case '\r': sb.Append("\\r"); break;
                case '\n': sb.Append("\\n"); break;
                case '\t': sb.Append("\\t"); break;
                default:
                    if (c < 0x20) sb.Append(' ');
                    else sb.Append(c);
                    break;
            }
        }
        return sb.ToString();
    }

    static bool TryGetDwmRect(IntPtr hWnd, out RECT rect)
    {
        if (DwmGetWindowAttribute(hWnd, DWMWA_EXTENDED_FRAME_BOUNDS, out rect, Marshal.SizeOf(typeof(RECT))) == 0)
        {
            if (rect.Right > rect.Left && rect.Bottom > rect.Top) return true;
        }
        return GetWindowRect(hWnd, out rect) && rect.Right > rect.Left && rect.Bottom > rect.Top;
    }

    static string QueryWindowsJson(uint skipPid)
    {
        var sb = new StringBuilder(4096);
        sb.Append('[');
        bool first = true;
        int order = 0;
        var titleBuf = new StringBuilder(256);
        var classBuf = new StringBuilder(128);
        int primaryW = Math.Max(800, GetSystemMetrics(0));
        int primaryH = Math.Max(600, GetSystemMetrics(1));

        EnumWindows((hWnd, lParam) =>
        {
            if (!IsWindowVisible(hWnd) || IsIconic(hWnd)) return true;

            int cloaked = 0;
            if (DwmGetWindowAttribute(hWnd, DWMWA_CLOAKED, out cloaked, sizeof(int)) == 0 && cloaked != 0)
            {
                return true;
            }

            uint pid = 0;
            GetWindowThreadProcessId(hWnd, out pid);
            if (skipPid != 0 && pid == skipPid) return true;

            int exStyle = GetWindowLong(hWnd, GWL_EXSTYLE);
            if ((exStyle & WS_EX_TRANSPARENT) != 0 && (exStyle & WS_EX_LAYERED) != 0)
            {
                return true;
            }

            classBuf.Clear();
            GetClassName(hWnd, classBuf, classBuf.Capacity);
            string cls = classBuf.ToString();
            if (cls == "Progman" || cls == "WorkerW" || cls == "CEF-OSC-WIDGET" || cls == "DummyDWMListenerWindow")
            {
                return true;
            }

            RECT r;
            if (!TryGetDwmRect(hWnd, out r)) return true;
            int w = r.Right - r.Left;
            int h = r.Bottom - r.Top;
            if (w < 24 || h < 24) return true;

            titleBuf.Clear();
            GetWindowText(hWnd, titleBuf, titleBuf.Capacity);
            string title = titleBuf.ToString().Trim();

            bool isTaskbar = cls == "Shell_TrayWnd" || cls == "Shell_SecondaryTrayWnd";
            if (title == "Program Manager" || title == "Windows Input Experience" || title == "Microsoft Text Input Application")
            {
                return true;
            }
            if (string.IsNullOrEmpty(title) && !isTaskbar)
            {
                if ((w >= primaryW * 0.95 && h >= primaryH * 0.95) ||
                    (exStyle & (WS_EX_TOOLWINDOW | WS_EX_NOACTIVATE)) != 0)
                {
                    return true;
                }
            }

            bool zoomed = IsZoomed(hWnd);
            string displayTitle = isTaskbar ? "任务栏" : title;
            int curOrder = order++;

            if (!first) sb.Append(',');
            first = false;
            sb.Append("{\"id\":").Append(hWnd.ToInt64())
              .Append(",\"pid\":").Append(pid)
              .Append(",\"x\":").Append(r.Left)
              .Append(",\"y\":").Append(r.Top)
              .Append(",\"w\":").Append(w)
              .Append(",\"h\":").Append(h)
              .Append(",\"z\":").Append(10000 - curOrder)
              .Append(",\"order\":").Append(curOrder)
              .Append(",\"max\":").Append(zoomed ? "true" : "false")
              .Append(",\"child\":false")
              .Append(",\"cls\":\"").Append(EscapeJson(cls)).Append('"')
              .Append(",\"title\":\"").Append(EscapeJson(displayTitle)).Append("\"}");

            if (!isTaskbar && w >= 160 && h >= 120)
            {
                int childCount = 0;
                var seenRects = new List<RECT>();
                EnumChildWindows(hWnd, (cHwnd, cParam) =>
                {
                    if (childCount >= 20) return false;
                    if (!IsWindowVisible(cHwnd)) return true;
                    RECT cr;
                    if (!GetWindowRect(cHwnd, out cr)) return true;
                    int cx0 = Math.Max(r.Left, cr.Left);
                    int cy0 = Math.Max(r.Top, cr.Top);
                    int cx1 = Math.Min(r.Right, cr.Right);
                    int cy1 = Math.Min(r.Bottom, cr.Bottom);
                    int cw = cx1 - cx0;
                    int ch = cy1 - cy0;
                    if (cw < 56 || ch < 34) return true;
                    if (cw >= w - 14 && ch >= h - 14) return true;
                    foreach (var sr in seenRects)
                    {
                        if (Math.Abs(sr.Left - cx0) <= 6 && Math.Abs(sr.Top - cy0) <= 6 &&
                            Math.Abs((sr.Right - sr.Left) - cw) <= 6 && Math.Abs((sr.Bottom - sr.Top) - ch) <= 6)
                        {
                            return true;
                        }
                    }
                    seenRects.Add(new RECT { Left = cx0, Top = cy0, Right = cx1, Bottom = cy1 });
                    childCount++;

                    sb.Append(",{\"id\":").Append(cHwnd.ToInt64())
                      .Append(",\"pid\":").Append(pid)
                      .Append(",\"parentId\":").Append(hWnd.ToInt64())
                      .Append(",\"x\":").Append(cx0)
                      .Append(",\"y\":").Append(cy0)
                      .Append(",\"w\":").Append(cw)
                      .Append(",\"h\":").Append(ch)
                      .Append(",\"z\":").Append(10000 - curOrder)
                      .Append(",\"order\":").Append(curOrder)
                      .Append(",\"max\":false,\"child\":true")
                      .Append(",\"cls\":\"\",\"title\":\"\"}");
                    return true;
                }, IntPtr.Zero);
            }

            return true;
        }, IntPtr.Zero);

        sb.Append(']');
        return sb.ToString();
    }

    static void EnablePerMonitorDpi()
    {
        try
        {
            if (SetProcessDpiAwarenessContext(new IntPtr(-4)) != IntPtr.Zero) return;
        }
        catch { }
        try
        {
            SetProcessDpiAwareness(2);
        }
        catch { }
    }

    static int Main(string[] args)
    {
        Console.OutputEncoding = Encoding.UTF8;
        EnablePerMonitorDpi();

        uint skipPid = 0;
        bool daemon = false;
        long noAnimHwnd = 0;
        bool noAnimTool = false;
        for (int i = 0; i < args.Length; i++)
        {
            if (args[i] == "--daemon") daemon = true;
            else if (args[i] == "--skip-pid" && i + 1 < args.Length) uint.TryParse(args[++i], out skipPid);
            else if (args[i] == "--no-anim" && i + 1 < args.Length)
            {
                long.TryParse(args[++i], out noAnimHwnd);
                if (i + 1 < args.Length && args[i + 1] == "tool")
                {
                    noAnimTool = true;
                    i++;
                }
            }
        }

        if (noAnimHwnd != 0 && !daemon)
        {
            ApplyNoAnimation(noAnimHwnd, noAnimTool);
            return 0;
        }

        if (daemon)
        {
            string line;
            while ((line = Console.ReadLine()) != null)
            {
                string trimmed = line.Trim();
                if (trimmed.StartsWith("noanimtool:"))
                {
                    long h;
                    if (long.TryParse(trimmed.Substring(11), out h)) ApplyNoAnimation(h, true);
                    Console.WriteLine("ok");
                    Console.Out.Flush();
                    continue;
                }
                if (trimmed.StartsWith("noanim:"))
                {
                    long h;
                    if (long.TryParse(trimmed.Substring(7), out h)) ApplyNoAnimation(h, false);
                    Console.WriteLine("ok");
                    Console.Out.Flush();
                    continue;
                }
                if (trimmed.StartsWith("exclude:"))
                {
                    string rest = trimmed.Substring(8);
                    int idx = rest.IndexOf(':');
                    if (idx > 0)
                    {
                        long h;
                        int flag;
                        if (long.TryParse(rest.Substring(0, idx), out h) && int.TryParse(rest.Substring(idx + 1), out flag))
                        {
                            ApplyExcludeFromCapture(h, flag == 1);
                        }
                    }
                    Console.WriteLine("ok");
                    Console.Out.Flush();
                    continue;
                }
                uint reqSkip = skipPid;
                int sep = trimmed.IndexOf('|');
                if (sep >= 0)
                {
                    uint parsedPid;
                    if (uint.TryParse(trimmed.Substring(0, sep), out parsedPid)) reqSkip = parsedPid;
                    long clipH;
                    if (long.TryParse(trimmed.Substring(sep + 1), out clipH)) ApplyNoAnimation(clipH, true);
                }
                else
                {
                    uint parsed;
                    if (uint.TryParse(trimmed, out parsed)) reqSkip = parsed;
                }
                Console.WriteLine(QueryWindowsJson(reqSkip));
                Console.Out.Flush();
            }
            return 0;
        }

        Console.WriteLine(QueryWindowsJson(skipPid));
        return 0;
    }
}
