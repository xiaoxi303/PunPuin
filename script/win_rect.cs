using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Runtime.InteropServices;
using System.Text;
using System.Windows;
using System.Windows.Automation;

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

    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Auto)]
    struct MONITORINFO
    {
        public int cbSize;
        public RECT rcMonitor;
        public RECT rcWork;
        public uint dwFlags;
    }

    struct TopWinEntry
    {
        public IntPtr Hwnd;
        public uint Pid;
        public RECT Rect;
        public int Order;
    }

    delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);
    delegate bool MonitorEnumProc(IntPtr hMonitor, IntPtr hdcMonitor, ref RECT lprcMonitor, IntPtr dwData);

    [DllImport("user32.dll")]
    static extern bool EnumWindows(EnumWindowsProc lpEnumFunc, IntPtr lParam);

    [DllImport("user32.dll")]
    static extern bool EnumChildWindows(IntPtr hWndParent, EnumWindowsProc lpEnumFunc, IntPtr lParam);

    [DllImport("user32.dll")]
    static extern bool EnumDisplayMonitors(IntPtr hdc, IntPtr lprcClip, MonitorEnumProc lpfnEnum, IntPtr dwData);

    [DllImport("user32.dll", CharSet = CharSet.Auto)]
    static extern bool GetMonitorInfo(IntPtr hMonitor, ref MONITORINFO lpmi);

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

    const int GWL_STYLE = -16;
    const int GWL_EXSTYLE = -20;
    const int WS_POPUP = unchecked((int)0x80000000);
    const int WS_OVERLAPPED_BITS = 0x00CF0000;
    const int WS_EX_TOOLWINDOW = 0x00000080;
    const int WS_EX_APPWINDOW = 0x00040000;
    const int WS_EX_TRANSPARENT = 0x00000020;
    const int WS_EX_LAYERED = 0x00080000;
    const int WS_EX_NOACTIVATE = 0x08000000;
    const uint SWP_NOACTIVATE = 0x0010;
    const uint SWP_SHOWWINDOW = 0x0040;
    const uint SWP_NOSENDCHANGING = 0x0400;
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
                int st = GetWindowLong(hWnd, GWL_STYLE);
                int nextSt = (st & ~WS_OVERLAPPED_BITS) | WS_POPUP;
                if (nextSt != st)
                {
                    SetWindowLong(hWnd, GWL_STYLE, nextSt);
                }
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

    static void PlaceWindowPhysical(long hwndVal, int x, int y, int w, int h, bool topmost)
    {
        if (hwndVal == 0) return;
        try
        {
            ApplyNoAnimation(hwndVal, true);
            IntPtr hWnd = new IntPtr(hwndVal);
            IntPtr insertAfter = new IntPtr(topmost ? -1 : 1);
            uint flags = SWP_NOACTIVATE | SWP_NOSENDCHANGING | (topmost ? SWP_SHOWWINDOW : 0u);
            SetWindowPos(hWnd, insertAfter, x, y, Math.Max(1, w), Math.Max(1, h), flags);
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

    static string QueryMonitorsJson()
    {
        var sb = new StringBuilder(512);
        sb.Append('[');
        bool first = true;
        EnumDisplayMonitors(IntPtr.Zero, IntPtr.Zero, (IntPtr hMon, IntPtr hdc, ref RECT rc, IntPtr data) =>
        {
            MONITORINFO mi = new MONITORINFO();
            mi.cbSize = Marshal.SizeOf(typeof(MONITORINFO));
            if (!GetMonitorInfo(hMon, ref mi)) return true;
            int mx = mi.rcMonitor.Left;
            int my = mi.rcMonitor.Top;
            int mw = mi.rcMonitor.Right - mi.rcMonitor.Left;
            int mh = mi.rcMonitor.Bottom - mi.rcMonitor.Top;
            if (mw <= 0 || mh <= 0) return true;
            if (!first) sb.Append(',');
            first = false;
            sb.Append("{\"x\":").Append(mx)
              .Append(",\"y\":").Append(my)
              .Append(",\"w\":").Append(mw)
              .Append(",\"h\":").Append(mh)
              .Append(",\"workX\":").Append(mi.rcWork.Left)
              .Append(",\"workY\":").Append(mi.rcWork.Top)
              .Append(",\"workW\":").Append(mi.rcWork.Right - mi.rcWork.Left)
              .Append(",\"workH\":").Append(mi.rcWork.Bottom - mi.rcWork.Top)
              .Append(",\"primary\":").Append((mi.dwFlags & 1) != 0 ? "true" : "false")
              .Append('}');
            return true;
        }, IntPtr.Zero);
        sb.Append(']');
        return sb.ToString();
    }

    static List<TopWinEntry> EnumTopVisibleWindows(uint skipPid, out string windowsJson)
    {
        var topList = new List<TopWinEntry>();
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
            topList.Add(new TopWinEntry { Hwnd = hWnd, Pid = pid, Rect = r, Order = curOrder });

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
                    if (childCount >= 24) return false;
                    if (!IsWindowVisible(cHwnd)) return true;
                    RECT cr;
                    if (!GetWindowRect(cHwnd, out cr)) return true;
                    int cx0 = Math.Max(r.Left, cr.Left);
                    int cy0 = Math.Max(r.Top, cr.Top);
                    int cx1 = Math.Min(r.Right, cr.Right);
                    int cy1 = Math.Min(r.Bottom, cr.Bottom);
                    int cw = cx1 - cx0;
                    int ch = cy1 - cy0;
                    if (cw < 40 || ch < 24) return true;
                    if (cw >= w - 12 && ch >= h - 12) return true;
                    foreach (var sr in seenRects)
                    {
                        if (Math.Abs(sr.Left - cx0) <= 5 && Math.Abs(sr.Top - cy0) <= 5 &&
                            Math.Abs((sr.Right - sr.Left) - cw) <= 5 && Math.Abs((sr.Bottom - sr.Top) - ch) <= 5)
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
        windowsJson = sb.ToString();
        return topList;
    }

    static string QueryWindowsJson(uint skipPid)
    {
        string json;
        EnumTopVisibleWindows(skipPid, out json);
        return json;
    }

    static string QuerySnapshotJson(uint skipPid)
    {
        string wins;
        EnumTopVisibleWindows(skipPid, out wins);
        string mons = QueryMonitorsJson();
        return "{\"monitors\":" + mons + ",\"windows\":" + wins + "}";
    }

    static string MapControlRole(ControlType ct)
    {
        if (ct == null) return "";
        if (ct == ControlType.Button || ct == ControlType.SplitButton) return "按钮";
        if (ct == ControlType.Edit || ct == ControlType.ComboBox || ct == ControlType.Spinner) return "输入框";
        if (ct == ControlType.TabItem) return "标签页";
        if (ct == ControlType.ToolBar || ct == ControlType.MenuBar) return "工具栏";
        if (ct == ControlType.MenuItem || ct == ControlType.Menu) return "菜单";
        if (ct == ControlType.ListItem || ct == ControlType.TreeItem || ct == ControlType.DataItem) return "列表项";
        if (ct == ControlType.Image) return "图片";
        if (ct == ControlType.CheckBox || ct == ControlType.RadioButton) return "选项";
        if (ct == ControlType.Hyperlink) return "链接";
        if (ct == ControlType.Tab || ct == ControlType.List || ct == ControlType.Tree || ct == ControlType.Table || ct == ControlType.DataGrid) return "列表区";
        if (ct == ControlType.Group || ct == ControlType.Pane || ct == ControlType.Document || ct == ControlType.StatusBar || ct == ControlType.Header) return "面板";
        return "";
    }

    static bool IsOccludedByHigherWindows(List<TopWinEntry> topWins, int winIdx, int cx, int cy)
    {
        for (int i = 0; i < winIdx; i++)
        {
            RECT hr = topWins[i].Rect;
            if (cx >= hr.Left && cx <= hr.Right && cy >= hr.Top && cy <= hr.Bottom)
            {
                return true;
            }
        }
        return false;
    }

    static string QueryUiaElementsJson(uint skipPid, int monX, int monY, int monW, int monH)
    {
        var sb = new StringBuilder(4096);
        sb.Append('[');
        bool first = true;
        try
        {
            string dummy;
            var topWins = EnumTopVisibleWindows(skipPid, out dummy);
            var sw = Stopwatch.StartNew();
            var cacheReq = new CacheRequest();
            cacheReq.Add(AutomationElement.BoundingRectangleProperty);
            cacheReq.Add(AutomationElement.ControlTypeProperty);
            cacheReq.Add(AutomationElement.NameProperty);
            cacheReq.Add(AutomationElement.IsOffscreenProperty);
            cacheReq.TreeScope = TreeScope.Element;
            cacheReq.TreeFilter = Automation.ControlViewCondition;

            int monR = monX + monW;
            int monB = monY + monH;
            int inspectedWins = 0;
            int nextSyntheticId = 1;

            for (int wIdx = 0; wIdx < topWins.Count && inspectedWins < 5; wIdx++)
            {
                if (sw.ElapsedMilliseconds > 165) break;
                TopWinEntry tw = topWins[wIdx];
                int ix0 = Math.Max(monX, tw.Rect.Left);
                int iy0 = Math.Max(monY, tw.Rect.Top);
                int ix1 = Math.Min(monR, tw.Rect.Right);
                int iy1 = Math.Min(monB, tw.Rect.Bottom);
                if (ix1 - ix0 < 40 || iy1 - iy0 < 30) continue;

                inspectedWins++;
                int winW = tw.Rect.Right - tw.Rect.Left;
                int winH = tw.Rect.Bottom - tw.Rect.Top;
                var seen = new List<RECT>();
                var queue = new Queue<KeyValuePair<AutomationElement, int>>();

                try
                {
                    using (cacheReq.Activate())
                    {
                        var root = AutomationElement.FromHandle(tw.Hwnd);
                        if (root == null) continue;
                        queue.Enqueue(new KeyValuePair<AutomationElement, int>(root, 0));
                        int visited = 0;

                        while (queue.Count > 0 && visited < 260 && sw.ElapsedMilliseconds <= 175)
                        {
                            var pair = queue.Dequeue();
                            visited++;
                            AutomationElement cur = pair.Key;
                            int depth = pair.Value;

                            if (depth > 0)
                            {
                                try
                                {
                                    if (!cur.Cached.IsOffscreen)
                                    {
                                        Rect br = cur.Cached.BoundingRectangle;
                                        if (!br.IsEmpty && !double.IsInfinity(br.Width) && !double.IsNaN(br.Width))
                                        {
                                            int ex0 = Math.Max(ix0, (int)Math.Round(br.Left));
                                            int ey0 = Math.Max(iy0, (int)Math.Round(br.Top));
                                            int ex1 = Math.Min(ix1, (int)Math.Round(br.Right));
                                            int ey1 = Math.Min(iy1, (int)Math.Round(br.Bottom));
                                            int ew = ex1 - ex0;
                                            int eh = ey1 - ey0;

                                            if (ew >= 18 && eh >= 14 && !(ew >= winW - 10 && eh >= winH - 10))
                                            {
                                                int midX = ex0 + ew / 2;
                                                int midY = ey0 + eh / 2;
                                                if (!IsOccludedByHigherWindows(topWins, wIdx, midX, midY))
                                                {
                                                    string role = MapControlRole(cur.Cached.ControlType);
                                                    if (!string.IsNullOrEmpty(role))
                                                    {
                                                        bool dup = false;
                                                        for (int s = 0; s < seen.Count; s++)
                                                        {
                                                            RECT sr = seen[s];
                                                            if (Math.Abs(sr.Left - ex0) <= 4 && Math.Abs(sr.Top - ey0) <= 4 &&
                                                                Math.Abs((sr.Right - sr.Left) - ew) <= 4 && Math.Abs((sr.Bottom - sr.Top) - eh) <= 4)
                                                            {
                                                                dup = true;
                                                                break;
                                                            }
                                                        }
                                                        if (!dup && seen.Count < 90)
                                                        {
                                                            seen.Add(new RECT { Left = ex0, Top = ey0, Right = ex1, Bottom = ey1 });
                                                            string rawName = (cur.Cached.Name ?? "").Trim();
                                                            if (rawName.Length > 22) rawName = rawName.Substring(0, 22) + "…";
                                                            string label = string.IsNullOrEmpty(rawName) ? role : (role + " · " + rawName);
                                                            if (!first) sb.Append(',');
                                                            first = false;
                                                            sb.Append("{\"id\":").Append(900000 + (nextSyntheticId++))
                                                              .Append(",\"pid\":").Append(tw.Pid)
                                                              .Append(",\"parentId\":").Append(tw.Hwnd.ToInt64())
                                                              .Append(",\"x\":").Append(ex0)
                                                              .Append(",\"y\":").Append(ey0)
                                                              .Append(",\"w\":").Append(ew)
                                                              .Append(",\"h\":").Append(eh)
                                                              .Append(",\"z\":").Append(10000 - tw.Order)
                                                              .Append(",\"order\":").Append(tw.Order)
                                                              .Append(",\"max\":false,\"child\":true,\"uia\":true")
                                                              .Append(",\"role\":\"").Append(EscapeJson(role)).Append('"')
                                                              .Append(",\"cls\":\"\",\"title\":\"").Append(EscapeJson(label)).Append("\"}");
                                                        }
                                                    }
                                                }
                                            }
                                        }
                                    }
                                }
                                catch { }
                            }

                            if (depth < 8 && sw.ElapsedMilliseconds <= 170)
                            {
                                try
                                {
                                    AutomationElementCollection kids = cur.FindAll(TreeScope.Children, Automation.ControlViewCondition);
                                    if (kids != null)
                                    {
                                        int kCount = Math.Min(kids.Count, 48);
                                        for (int k = 0; k < kCount; k++)
                                        {
                                            AutomationElement child = kids[k];
                                            if (child == null) continue;
                                            try
                                            {
                                                Rect cbr = child.Cached.BoundingRectangle;
                                                if (!cbr.IsEmpty && (cbr.Right <= ix0 || cbr.Left >= ix1 || cbr.Bottom <= iy0 || cbr.Top >= iy1))
                                                {
                                                    continue;
                                                }
                                            }
                                            catch { }
                                            queue.Enqueue(new KeyValuePair<AutomationElement, int>(child, depth + 1));
                                        }
                                    }
                                }
                                catch { }
                            }
                        }
                    }
                }
                catch { }
            }
        }
        catch { }

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
                if (trimmed.StartsWith("place:"))
                {
                    string[] parts = trimmed.Substring(6).Split(':');
                    if (parts.Length >= 6)
                    {
                        long h;
                        int px, py, pw, ph, top;
                        if (long.TryParse(parts[0], out h) &&
                            int.TryParse(parts[1], out px) &&
                            int.TryParse(parts[2], out py) &&
                            int.TryParse(parts[3], out pw) &&
                            int.TryParse(parts[4], out ph) &&
                            int.TryParse(parts[5], out top))
                        {
                            PlaceWindowPhysical(h, px, py, pw, ph, top == 1);
                        }
                    }
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
                if (trimmed.StartsWith("snapshot:"))
                {
                    string rest = trimmed.Substring(9);
                    uint reqPid = skipPid;
                    int sepIdx = rest.IndexOf('|');
                    if (sepIdx >= 0)
                    {
                        uint pPid;
                        if (uint.TryParse(rest.Substring(0, sepIdx), out pPid)) reqPid = pPid;
                        long clipH;
                        if (long.TryParse(rest.Substring(sepIdx + 1), out clipH)) ApplyNoAnimation(clipH, true);
                    }
                    else
                    {
                        uint pPid;
                        if (uint.TryParse(rest, out pPid)) reqPid = pPid;
                    }
                    Console.WriteLine(QuerySnapshotJson(reqPid));
                    Console.Out.Flush();
                    continue;
                }
                if (trimmed.StartsWith("uia:"))
                {
                    string[] parts = trimmed.Substring(4).Split(':');
                    uint reqPid = skipPid;
                    int mx = 0, my = 0, mw = 2560, mh = 1440;
                    if (parts.Length >= 5)
                    {
                        uint.TryParse(parts[0], out reqPid);
                        int.TryParse(parts[1], out mx);
                        int.TryParse(parts[2], out my);
                        int.TryParse(parts[3], out mw);
                        int.TryParse(parts[4], out mh);
                    }
                    Console.WriteLine(QueryUiaElementsJson(reqPid, mx, my, mw, mh));
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
