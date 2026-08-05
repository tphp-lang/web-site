## 编译流水线 {#pipeline}

从 PHP 源码到原生二进制的完整 AOT 流水线：

<div class="pipeline-flow">
    <span class="bny-tag" color="blue">PHP</span>
    <span class="arrow">→</span>
    <span class="bny-tag" color="blue">Lexer</span>
    <span class="arrow">→</span>
    <span class="bny-tag" color="blue">Token[]</span>
    <span class="arrow">→</span>
    <span class="bny-tag" color="blue">Parser</span>
    <span class="arrow">→</span>
    <span class="bny-tag" color="blue">AST</span>
    <span class="arrow">→</span>
    <span class="bny-tag" color="blue">CodeGenerator</span>
    <span class="arrow">→</span>
    <span class="bny-tag" color="blue">.c</span>
    <span class="arrow">→</span>
    <span class="bny-tag" color="blue">编译器</span>
    <span class="arrow">→</span>
    <span class="bny-tag" color="green">二进制</span>
</div>

### 阶段说明 {#stages}

1. **Lexer**（`src/Lexer.php`）— 逐字符扫描，约 75 种 Token，支持字符串插值 / heredoc / nowdoc
2. **Parser**（`src/Parser.php`）— 递归下降，完整 15 级运算符优先级，输出 AST
3. **CodeGenerator**（`src/CodeGenerator.php`）— 访问者模式，生成类型安全的 C 代码；可选 `--ssa` 启用 SSA 优化中间表示
4. **C 运行时**（`include/`）— COS 风格对象系统（16B 对象头）、setjmp/longjmp 异常、ROPE 字符串拼接、128 槽数组/对象复用池、128KB 字符串池（bump allocator）；`compat.h` 统一 TCC/GCC/Clang/MSVC 差异
5. **编译器** — 内置 TCC（mob 分支，**亚秒级编译**），支持 GCC / Clang（`-cc gcc`，`-O2` 可再快 3-10x）

> 所有源文件合并为单入口编译；`#include` 的 `.c` 文件与 `#flag` 中列出的 `.c` 自动加入编译列表。

### CLI 选项 {#cli}

| 选项 | 说明 |
|------|------|
| `-o <output>` | 输出文件路径（默认从入口文件名派生） |
| `-cc <compiler>` | 指定 C 编译器：gcc / clang / 交叉编译器（默认内置 TCC） |
| `-os <target>` | 目标系统：`windows` / `linux` / `macos` / `android` |
| `-arch <arch>` | 目标架构：`x86_64` / `aarch64` / `armv7a` / `i686` |
| `-shared` | 编译为动态库（配合 `#[Export]` 注解，见下） |
| `--no-android-apk` | Android 模式仅编译 .so，跳过 APK 打包 |
| `--debug` | 编译 + 运行 + 比对 `#debug` 预期输出 |
| `--ssa` | 启用 SSA 优化中间表示 |
| `-h / --help` / `-v / --version` | 帮助 / 版本 |

> 长参数形式 `--os=linux`、`--arch=x86_64` 亦可。Android 交叉编译需 `ANDROID_NDK` 环境变量（详见 [快速开始](quickstart.md)）。

### PHAR 分发 {#phar}

- `build.php` 将 PHP 源码打包为单文件 `tphp.phar`；`micro.sfx` + phar 拼接为独立可执行（Windows: `tphp.exe`；Linux/macOS: 直接拼接）
- 首次运行自动解压 `include/` 与 `tcc/` 到同级目录
- GitHub Actions（`.github/workflows/build.yml`）自动构建四平台产物：Windows x86_64 / Linux x86_64 / Linux aarch64 / macOS aarch64

### 平台与编译器矩阵 {#platforms}

| 平台 | 内置 TCC | GCC | Clang | 备注 |
|------|:---:|:---:|:---:|------|
| Windows x86_64 | ✅ | ✅ | ✅ | 产出 `.exe` / `.dll` |
| Linux x86_64 | ✅ | ✅ | ✅ | 产出 ELF / `.so` |
| Linux aarch64 | ✅ | ✅ | ✅ | 交叉编译 |
| macOS aarch64 | ✅ | ✅ | ✅ | 产出 Mach-O / `.dylib` |
| Android（4 ABI） | — | ✅ NDK Clang | ✅ | `-os android` → APK / `libtphp.so` |

Android ABI：`aarch64`(arm64-v8a) / `x86_64` / `armv7a`(armeabi-v7a) / `i686`(x86)；默认编译全部 4 种，`-arch` 指定单一 ABI。

### 内存优化 {#memory}

| 机制 | 说明 |
|------|------|
| SSO 小字符串 | 24B 内联缓冲区，≤23 字节零堆分配 |
| 128KB 字符串池 | bump allocator + Arena，O(1) 分配；≤512B 字符串从池分配，零 `malloc` |
| 128 槽数组/对象复用池 | LIFO + 1.5× 增长，`new`+`unset` 命中率 36-52%，热路径零 malloc |
| ROPE 多片段拼接 | 3+ 片段 `.` 链编译期展平为单次分配，concat-4 快 6x |
| Thread-Local 运行时 | 每线程独立内存池，无锁竞争 |
| `array<T>` 紧凑存储 | `array<int>` 8B/元素 vs `array<mixed>` 24B，省 67% 内存 |

### 动态库导出 #[Export] {#export}

`#[Export("name")]` 标记独立函数导出为 C 函数，配合 `-shared` 生成可被外部 C 代码调用的动态库：

```php
#[Export("add")]
function phpAdd(int $a, int $b): int { return $a + $b; }
```

```bash
tphp foo.php -shared -o foo.so      # Linux
tphp foo.php -shared -o foo.dll     # Windows
tphp foo.php -shared -o foo.dylib   # macOS
```

| 规则 | 说明 |
|------|------|
| 适用对象 | 仅独立函数（用于方法报语法错误） |
| 类型约束 | 参数/返回值允许 int/float/bool/string/void/`C.Type`；**禁止 `array`** |
| string 映射 | 直接暴露 `t_string*`（C 侧需包含 `tphp_runtime.h`） |
| 生成机制 | `TPHP_EXPORT` 宏（Win `__declspec(dllexport)` / GCC visibility）+ 运行时自动初始化（`DllMain` / constructor） |
| 非 `-shared` 模式 | 静默忽略，函数正常调用 |

> `#[Export]` 与注解系统独立，可与 `#[ROUTE(...)]` 等用户注解共存于同一函数。
