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
    static extern IntPtr SetProcessDpiAwarenessContext(IntPtr dpiContext);

    [DllImport("shcore.dll")]
    static extern int SetProcessDpiAwareness(int value);

    [DllImport("dwmapi.dll")]
    static extern int DwmGetWindowAttribute(IntPtr hwnd, int dwAttribute, out RECT pvAttribute, int cbAttribute);

    [DllImport("dwmapi.dll")]
    static extern int DwmGetWindowAttribute(IntPtr hwnd, int dwAttribute, out int pvAttribute, int cbAttribute);

    const int GWL_EXSTYLE = -20;
    const int WS_EX_TOOLWINDOW = 0x00000080;
    const int WS_EX_TRANSPARENT = 0x00000020;
    const int WS_EX_LAYERED = 0x00080000;
    const int WS_EX_NOACTIVATE = 0x08000000;
    const int DWMWA_EXTENDED_FRAME_BOUNDS = 9;
    const int DWMWA_CLOAKED = 14;

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
        for (int i = 0; i < args.Length; i++)
        {
            if (args[i] == "--daemon") daemon = true;
            else if (args[i] == "--skip-pid" && i + 1 < args.Length) uint.TryParse(args[++i], out skipPid);
        }

        if (daemon)
        {
            string line;
            while ((line = Console.ReadLine()) != null)
            {
                uint reqSkip = skipPid;
                uint parsed;
                if (uint.TryParse(line.Trim(), out parsed)) reqSkip = parsed;
                Console.WriteLine(QueryWindowsJson(reqSkip));
                Console.Out.Flush();
            }
            return 0;
        }

        Console.WriteLine(QueryWindowsJson(skipPid));
        return 0;
    }
}
