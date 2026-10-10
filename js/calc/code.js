/* code.js —— 代码速查（C 10 / Python 12 / MATLAB 7 模板 + 一键复制）
 * Python 模板支持"▶ 载入运行器"（Pyodide 在线执行）；需本地环境的标注说明
 */
(function () {
  'use strict';
  var App = window.App;

  // 模板库（key 与下拉选项 value 对应）
  var TEMPLATES = {
    c: [
      {
        title: '位运算技巧',
        code: 'int x = 5;\nint y = x << 1;      // 左移1位 = ×2 → 10\nint z = x >> 1;      // 右移1位 = ÷2 → 2\nint m = x & 1;       // 取最低位（判奇偶）\nint n = a ^ b ^ b;   // 异或两次还原 → a\n// 不用临时变量交换两数\na ^= b; b ^= a; a ^= b;'
      },
      {
        title: '快速排序（递归版）',
        code: 'void quickSort(int a[], int lo, int hi) {\n    if (lo >= hi) return;\n    int i = lo, j = hi, pivot = a[lo];\n    while (i < j) {\n        while (i < j && a[j] >= pivot) j--;\n        a[i] = a[j];\n        while (i < j && a[i] <= pivot) i++;\n        a[j] = a[i];\n    }\n    a[i] = pivot;\n    quickSort(a, lo, i - 1);\n    quickSort(a, i + 1, hi);\n}'
      },
      {
        title: '单链表逆置',
        code: 'struct Node { int val; struct Node *next; };\n\nstruct Node *reverse(struct Node *head) {\n    struct Node *prev = NULL, *cur = head;\n    while (cur) {\n        struct Node *next = cur->next;\n        cur->next = prev;   // 指针反向\n        prev = cur;\n        cur = next;\n    }\n    return prev;           // 新头结点\n}'
      },
      {
        title: '大小端判断',
        code: 'int checkEndian(void) {\n    union { int  i; char c; } u;\n    u.i = 1;\n    return u.c;  // 返回1为小端，0为大端\n}'
      },
      {
        title: '冒泡排序 + 优化（提前退出）',
        code: 'void bubbleSort(int a[], int n) {\n    for (int i = 0; i < n - 1; i++) {\n        int swapped = 0;\n        for (int j = 0; j < n - 1 - i; j++) {\n            if (a[j] > a[j + 1]) {\n                int t = a[j]; a[j] = a[j + 1]; a[j + 1] = t;\n                swapped = 1;\n            }\n        }\n        if (!swapped) break;  // 一趟无交换说明已有序\n    }\n}'
      },
      {
        title: '二分查找（循环版）',
        code: 'int binarySearch(int a[], int n, int key) {\n    int lo = 0, hi = n - 1;\n    while (lo <= hi) {\n        int mid = lo + (hi - lo) / 2;  // 防溢出写法\n        if (a[mid] == key) return mid;\n        if (a[mid] < key) lo = mid + 1;\n        else hi = mid - 1;\n    }\n    return -1;\n}'
      },
      {
        title: '环形缓冲区（嵌入式常用）',
        code: '#define BUF_SIZE 64\ntypedef struct {\n    char buf[BUF_SIZE];\n    volatile int head, tail;  // 写/读指针\n} RingBuf;\n\nint rbPush(RingBuf *rb, char c) {\n    int next = (rb->head + 1) % BUF_SIZE;\n    if (next == rb->tail) return -1;  // 满\n    rb->buf[rb->head] = c;\n    rb->head = next;\n    return 0;\n}\nint rbPop(RingBuf *rb, char *c) {\n    if (rb->head == rb->tail) return -1;  // 空\n    *c = rb->buf[rb->tail];\n    rb->tail = (rb->tail + 1) % BUF_SIZE;\n    return 0;\n}'
      },
      {
        title: '软件延时 / 定时器节拍',
        code: '// 51/STM32 常用粗略延时（SysTick 精确版看手册）\nvoid delayUs(uint32_t us) {\n    uint32_t n = us * (SystemCoreClock / 1000000 / 5);\n    while (n--) __NOP();   // 约5个时钟周期一次循环（需实测校准）\n}\n\n// 基于 HAL 的精确毫秒延时\nvoid delayMs(uint32_t ms) {\n    HAL_Delay(ms);\n}'
      },
      {
        title: 'ADC 多通道采集均值滤波',
        code: '#define N 10\nuint16_t adcFilter(ADC_HandleTypeDef *hadc, uint32_t ch) {\n    uint32_t sum = 0;\n    ADC_ChannelConfTypeDef cfg = {0};\n    cfg.Channel = ch; cfg.Rank = 1;\n    cfg.SamplingTime = ADC_SAMPLETIME_55CYCLES_5;\n    HAL_ADC_ConfigChannel(hadc, &cfg);\n    for (int i = 0; i < N; i++) {\n        HAL_ADC_Start(hadc);\n        HAL_ADC_PollForConversion(hadc, 10);\n        sum += HAL_ADC_GetValue(hadc);\n    }\n    return (uint16_t)(sum / N);  // 均值滤波抗干扰\n}'
      },
      {
        title: '状态机框架（按键/流程控制通用）',
        code: 'typedef enum { ST_IDLE, ST_RUN, ST_PAUSE, ST_ERR } State;\n\nvoid stateMachine(State *st, int event) {\n    switch (*st) {\n    case ST_IDLE:\n        if (event == 1) { *st = ST_RUN; startMotor(); }\n        break;\n    case ST_RUN:\n        if (event == 2) *st = ST_PAUSE;\n        else if (event == 9) *st = ST_ERR;\n        break;\n    case ST_PAUSE:\n        if (event == 1) *st = ST_RUN;\n        break;\n    case ST_ERR:\n        stopAll(); alarmOn();\n        if (event == 0) *st = ST_IDLE;  // 复位\n        break;\n    }\n}'
      }
    ],
    python: [
      {
        title: '位运算技巧',
        code: `x = 5
y = x << 1      # 左移1位 = ×2 → 10
z = x >> 1      # 右移1位 = ÷2 → 2
m = x & 1       # 取最低位（判奇偶）
n = 10 ^ 3 ^ 3  # 异或两次还原 → 10
a, b = 3, 9
a ^= b; b ^= a; a ^= b   # 不用临时变量交换
print(y, z, m, n, a, b)`
      },
      {
        title: '水仙花数 / 斐波那契',
        code: `# 水仙花数：各位立方和等于自身
narc = [n for n in range(100, 1000)
        if n == sum(int(d)**3 for d in str(n))]
print("水仙花数:", narc)

# 斐波那契（生成器写法）
def fib():
    a, b = 0, 1
    while True:
        yield a
        a, b = b, a + b

f = fib()
print("前15项:", [next(f) for _ in range(15)])`
      },
      {
        title: '文件读写（需本地环境）',
        local: true,
        code: `# 读整个文件
with open("data.txt", "r", encoding="utf-8") as f:
    text = f.read()

# 逐行处理（省内存）
with open("data.txt", "r", encoding="utf-8") as f:
    for line in f:
        line = line.strip()

# 写文件
with open("out.txt", "w", encoding="utf-8") as f:
    f.write("hello\\n")`
      },
      {
        title: '实验数据统计与绘图（需本地环境）',
        local: true,
        code: `import numpy as np
import matplotlib.pyplot as plt

x = np.array([1.0, 2.0, 3.0, 4.0, 5.0])
y = np.array([0.102, 0.198, 0.305, 0.404, 0.501])

# 最小二乘线性拟合 y = a + bx
b, a = np.polyfit(x, y, 1)
print(f"y = {a:.4f} + {b:.4f}x")

plt.scatter(x, y, label="measured")
plt.plot(x, a + b * x, "r--", label="fit")
plt.xlabel("U (V)"); plt.ylabel("I (mA)")
plt.legend(); plt.grid(True)
plt.show()`
      },
      {
        title: '信号生成与采样',
        code: `import numpy as np

fs = 5000          # 采样率 Hz
T = 0.04           # 总时长 s
t = np.arange(0, T, 1/fs)   # 时间序列
f = 50             # 信号频率 Hz
x = np.sin(2 * np.pi * f * t + np.deg2rad(30))

print("采样点数:", len(t))
print("奈奎斯特:", fs > 2 * f)
print("有效值rms:", round(float(np.sqrt(np.mean(x**2))), 4))`
      },
      {
        title: '异常处理模板',
        code: `def safe_divide(a, b):
    try:
        return a / b
    except ZeroDivisionError:
        print("除数不能为0")
        return None
    except TypeError as e:
        print("类型错误:", e)
        return None

print(safe_divide(10, 2))   # 5.0
print(safe_divide(1, 0))    # 捕获除零异常`
      },
      {
        title: 'FFT 频谱分析',
        code: `import numpy as np

fs = 1000                     # 采样率
t = np.arange(0, 0.5, 1/fs)   # 0.5s
# 50Hz + 120Hz 混合信号 + 噪声
x = 0.7*np.sin(2*np.pi*50*t) + 1.0*np.sin(2*np.pi*120*t) + 0.2*np.random.randn(len(t))

N = len(x)
X = np.abs(np.fft.fft(x)) / N          # 幅度谱（归一化）
freq = np.fft.fftfreq(N, 1/fs)         # 频率轴
half = N // 2

# 找主频
idx = np.argmax(X[:half])
print(f"主频 = {freq[idx]:.1f} Hz，幅度 = {X[idx]:.3f}")
print("Top5 频率分量:")
top = np.argsort(X[:half])[-5:][::-1]
for i in top:
    print(f"  {freq[i]:7.1f} Hz  {X[i]:.3f}")`
      },
      {
        title: 'CSV 数据处理（需本地环境）',
        local: true,
        code: `import csv

# 写 CSV
rows = [["学号", "姓名", "成绩"],
        ["202401", "张三", 92],
        ["202402", "李四", 85]]
with open("score.csv", "w", newline="", encoding="utf-8-sig") as f:  # BOM 头 Excel 不乱码
    csv.writer(f).writerows(rows)

# 读 CSV
with open("score.csv", encoding="utf-8-sig") as f:
    for row in csv.reader(f):
        print(row)

# 用 pandas 更省事
import pandas as pd
df = pd.read_csv("score.csv")
print(df.describe())  # 均值/标准差/分位数一览`
      },
      {
        title: '正则表达式提取',
        code: `import re

text = "订单A20240315金额128.5元，订单B20240316金额99.0元"

# 提取订单号
ids = re.findall(r"[A-Z]\\d{8}", text)
print("订单号:", ids)

# 提取金额（分组）
amounts = re.findall(r"金额(\\d+\\.\\d+)元", text)
print("金额:", amounts)

# 替换脱敏
print(re.sub(r"\\d{8}", "********", text))`
      },
      {
        title: '简单 Web 服务器（Flask 最小例）',
        code: `# pip install flask 后在本地运行
from flask import Flask, jsonify

app = Flask(__name__)

@app.route("/")
def home():
    return "<h1>Hello 校园助手</h1>"

@app.route("/api/data")
def data():
    return jsonify({"temp": 25.3, "rh": 60})

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)`
      },
      {
        title: '串口收发（pyserial，需本地环境）',
        local: true,
        code: `# pip install pyserial
import serial, time

ser = serial.Serial("COM3", 115200, timeout=1)
time.sleep(2)  # 等设备复位

ser.write(b"AT\\r\\n")            # 发送指令
resp = ser.read(128).decode(errors="ignore")
print("收到:", resp)

# 连续读（简单协议：以 \\n 结尾）
while True:
    line = ser.readline().decode(errors="ignore").strip()
    if line:
        print(">>", line)`
      },
      {
        title: 'JSON 与网络请求（需本地环境）',
        local: true,
        code: `import json, urllib.request

# 序列化
cfg = {"ip": "192.168.1.10", "port": 8080, "tags": ["temp", "rh"]}
s = json.dumps(cfg, ensure_ascii=False, indent=2)
print(s)
obj = json.loads(s)          # 反序列化
print(obj["port"])

# GET 请求
with urllib.request.urlopen("https://httpbin.org/get") as r:
    data = json.loads(r.read())
    print("origin:", data["origin"])`
      }
    ],
    matlab: [
      {
        title: '矩阵操作速查',
        code: 'A = [1 2; 3 4];        % 2×2 矩阵\nB = A\';               % 转置\nc = A(:);              % 拉伸成列向量\nD = diag([1 2 3]);     % 对角阵\nE = eye(3);            % 单位阵\ninvA = inv(A);         % 逆矩阵（仅方阵）\npinvA = pinv(A);       % 伪逆（推荐非方阵用）\nr = rank(A);           % 秩\n[evec, eval] = eig(A);  % 特征值分解'
      },
      {
        title: '曲线拟合 polyfit',
        code: 'x = [1 2 3 4 5];\ny = [0.102 0.198 0.305 0.404 0.501];\n\np = polyfit(x, y, 1);   % 一次拟合，p(1)=斜率 p(2)=截距\nyfit = polyval(p, x);\nR2 = 1 - sum((y - yfit).^2) / sum((y - mean(y)).^2);\n\nfprintf(\'y = %.4f x + %.4f, R² = %.4f\\n\', p(1), p(2), R2);\nplot(x, y, \'o\', x, yfit, \'-r\'); grid on;\nlegend(\'数据\', \'拟合\'); xlabel(\'U (V)\'); ylabel(\'I (mA)\');'
      },
      {
        title: '正弦信号 + FFT',
        code: 'fs = 1000;              % 采样率\nt = 0 : 1/fs : 0.5-1/fs; % 时间轴\nf0 = 50;\nx = sin(2*pi*f0*t + pi/6);\n\nN = length(x);\nX = abs(fft(x)) / N;\nfAxis = (0:N-1) * fs / N;\n\nsubplot(2,1,1); plot(t, x); xlabel(\'t/s\');\nsubplot(2,1,2); plot(fAxis(1:N/2), X(1:N/2)); xlabel(\'f/Hz\');'
      },
      {
        title: 'Simulink 仿真参数设置（脚本版）',
        code: '% 用脚本配置仿真并跑出数据（免手调参数）\nsimIn = Simulink.SimulationInput(\'my_model\');\nsimIn = simIn.setVariable(\'R\', 1000);\nsimIn = simIn.setVariable(\'C\', 1e-6);\nsimIn = simIn.setVariable(\'tStop\', 0.01);\n\nout = sim(simIn);           % 运行仿真\nplot(out.tout, out.yout);   % 画输出\nxlabel(\'t/s\'); grid on;'
      },
      {
        title: '传递函数与频响分析',
        code: '% 一阶 RC 低通的频响\nR = 1000; C = 1e-6;\nsys = tf(1, [R*C, 1]);      % H(s) = 1/(RCs+1)\n\nbode(sys); grid on;          % 波特图\nfc = 1/(2*pi*R*C);\ntitle(sprintf(\'RC 低通，fc = %.1f Hz\', fc));\n\nfigure; step(sys); grid on;  % 阶跃响应'
      },
      {
        title: '数据导入导出（Excel/文本）',
        code: '% 读 Excel\ndata = readmatrix(\'实验数据.xlsx\', \'Range\', \'A2:B21\');\nx = data(:,1); y = data(:,2);\n\n% 写回 Excel（含表头）\nT = table(x, y, x.^2, \'VariableNames\', {\'x\',\'y\',\'x2\'});\nwritetable(T, \'结果.xlsx\');\n\n% 读文本（分隔符自动识别）\nM = dlmread(\'data.txt\');\n% 或 readtable（更智能）\nT2 = readtable(\'data.txt\', \'Delimiter\', \' \');'
      },
      {
        title: '滤波器设计（butter 一行流）',
        code: 'fs = 1000; fc = 100;         % 采样率/截止频率\norder = 4;\n\n% 低通巴特沃斯\n[b, a] = butter(order, fc/(fs/2));\n\n% 频响\nfreqz(b, a, 512, fs); grid on;\n\n% 滤波含噪信号：50Hz信号 + 300Hz干扰\nt = 0:1/fs:1-1/fs;\nx = sin(2*pi*50*t) + 0.5*sin(2*pi*300*t);\ny = filter(b, a, x);\nfigure;\nsubplot(2,1,1); plot(t(1:200), x(1:200)); title(\'滤波前\');\nsubplot(2,1,2); plot(t(1:200), y(1:200)); title(\'滤波后\'); grid on;'
      }
    ]
  };

  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  function render(lang) {
    var box = document.getElementById('codeList');
    var items = TEMPLATES[lang] || [];
    var html = items.map(function (item, i) {
      // Python 可在线跑的模板提供"载入运行器"；需本地环境的显示标注；C/MATLAB 仅复制
      var extra = '';
      if (lang === 'python') {
        extra = item.local
          ? '<span class="code-item__local">需本地环境</span>'
          : '<button class="code-item__copy" data-load="' + i + '">▶ 载入运行器</button>';
      }
      return '<div class="code-item">' +
        '<div class="code-item__head"><span>' + esc(item.title) + '</span><span>' +
        extra + ' <button class="code-item__copy" data-copy="' + i + '">复制</button></span></div>' +
        '<pre>' + esc(item.code) + '</pre>' +
        '</div>';
    }).join('');
    box.innerHTML = html;
    // 绑定复制
    Array.prototype.forEach.call(box.querySelectorAll('[data-copy]'), function (btn) {
      btn.addEventListener('click', function () {
        var text = items[+btn.getAttribute('data-copy')].code;
        copyText(text, btn);
      });
    });
    // 绑定载入运行器（填入代码并立即执行，实现一键自检）
    Array.prototype.forEach.call(box.querySelectorAll('[data-load]'), function (btn) {
      btn.addEventListener('click', function () {
        var item = items[+btn.getAttribute('data-load')];
        document.getElementById('pyCode').value = item.code;
        runPython();
      });
    });
  }

  /** 复制到剪贴板（优先现代 API，失败降级 execCommand） */
  function copyText(text, btn) {
    function done() {
      var old = btn.textContent;
      btn.textContent = '✓ 已复制';
      setTimeout(function () { btn.textContent = old; }, 1500);
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done, function () { fallback(); });
    } else { fallback(); }
    function fallback() {
      var ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand('copy'); done(); } catch (e) { alert('复制失败，请手动选择复制'); }
      document.body.removeChild(ta);
    }
  }

  /* ================= Python 在线运行器（Pyodide，浏览器内本地执行） ================= */
  var pyodide = null;   // 运行环境实例（全局缓存，只加载一次）
  var pyLoading = null; // 加载中的 Promise（防重复加载）
  var PYODIDE_BASE = 'https://cdn.jsdelivr.net/pyodide/v0.25.1/full/';

  function pyOut(msg) { document.getElementById('pyOutput').textContent = msg; }

  /** 懒加载 Pyodide（首次点运行才加载，不影响首屏性能） */
  function ensurePyodide() {
    if (pyodide) return Promise.resolve(pyodide);
    if (pyLoading) return pyLoading;
    pyLoading = new Promise(function (resolve, reject) {
      var s = document.createElement('script');
      s.src = PYODIDE_BASE + 'pyodide.js';
      s.onload = function () {
        window.loadPyodide({ indexURL: PYODIDE_BASE })
          .then(function (py) { pyodide = py; resolve(py); })
          .catch(reject);
      };
      s.onerror = function () { reject(new Error('Pyodide 加载失败，请检查网络后重试')); };
      document.head.appendChild(s);
    });
    return pyLoading;
  }

  /** 执行运行器里的 Python 代码，捕获 stdout/stderr */
  async function runPython() {
    var code = document.getElementById('pyCode').value;
    if (!code.trim()) { pyOut('请输入 Python 代码'); return; }
    pyOut('⏳ 正在准备 Python 运行环境（首次约 10MB，稍候）…');
    try {
      var py = await ensurePyodide();
      var buf = [];
      py.setStdout({ batched: function (s) { buf.push(s); } });
      py.setStderr({ batched: function (s) { buf.push('[stderr] ' + s); } });
      await py.runPythonAsync(code);
      pyOut(buf.length ? buf.join('\n') : '(运行完成，无输出)');
    } catch (err) {
      pyOut('❌ ' + String(err && err.message ? err.message : err));
    }
  }

  function init() {
    render('c');
    document.getElementById('codeLang').addEventListener('change', function (e) {
      render(e.target.value);
    });
    // Python 运行器
    document.getElementById('btnPyRun').addEventListener('click', runPython);
    document.getElementById('btnPyClear').addEventListener('click', function () {
      document.getElementById('pyCode').value = '';
      pyOut('输出将显示在这里');
    });
  }

  window.App.code = { init: init };
})();
